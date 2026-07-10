import express from 'express';
import cors from 'cors';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Fix #2: Fail loudly if SESSION_SECRET is missing in production ───────────
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET must be set in production. Exiting.');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

const {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  SESSION_SECRET = 'dev-secret-change-in-production',
  FRONTEND_URL = 'https://github-ai-assistant-748914382449.us-central1.run.app/',
} = process.env;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '4mb' }));
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24h
  },
}));

// ─── Health Check (required for Cloud Run) ────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ─── Rate Limiting para Gemini Proxy (#14) ────────────────────────────────────
// Previene abuso del endpoint de Gemini (40 peticiones por minuto por IP)
const geminiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 40, // 40 peticiones por ventana
  message: {
    error: 'Demasiadas peticiones a Gemini. Por favor espera un minuto.',
  },
  standardHeaders: true, // Devuelve headers RateLimit-*
  legacyHeaders: false, // Desactiva headers X-RateLimit-*
});

// ─── Gemini API Proxy (Opción D - Acepta 'mode' opcional) ─────────────────────
// The Gemini API blocks direct browser requests from EU regions (EEA).
// This proxy routes Gemini calls through the server, which is deployed in
// us-central1 (Cloud Run) where the API is fully accessible.
//
// The user's API key travels in the HTTPS request body and is used only for
// the duration of this call — it is never stored, logged, or cached.
//
// Request body: { apiKey, model, messages: [{role, content}], systemPrompt, mode?, stream? }
// Response:     { text }  — o, si stream===true, un flujo SSE de `data: {"text": "<chunk>"}`
//               terminado con `data: [DONE]` (#38).
    //
    // Groq calls are NOT proxied — they go directly from the browser (no EU block).
    app.post('/api/gemini', geminiLimiter, async (req, res) => {
      // 🔥 OPCIÓN D: Extraemos 'mode' opcional del body. #38: 'stream' opcional.
      const { apiKey, model, messages, systemPrompt, mode, stream } = req.body;
    
      if (!apiKey || !model || !Array.isArray(messages) || !systemPrompt) {
        return res.status(400).json({
          error: 'Faltan campos requeridos: apiKey, model, messages, systemPrompt',
        });
      }
    
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const gemModel = genAI.getGenerativeModel({
          model,
          systemInstruction: systemPrompt,
        });
    
        // 🔥 OPCIÓN D: Log para ver el modo en Cloud Run (útil para debugging)
        if (mode) {
          console.log(`[Opción D] Gemini proxy received mode: ${mode}${stream ? ' (streaming)' : ''}`);
        }
    
        // Translate from internal Message format → Gemini SDK format.
        // All messages except the last form the chat history.

    // ─── Gemini Dynamic Models Proxy (#58 v3.23.0 + hotfix v3.23.2) ──────────────────
    // Permite al frontend obtener la lista de modelos de Gemini disponibles para una key.
    // La API de listado de Gemini también bloquea en UE, por lo que necesita proxy.
    // El frontend espera `{ models: [{ value: string, label: string }] }`.
    // La API de Google AI devuelve `{ models: [{ name, displayName, supportedGenerationMethods }] }`
    // Filtramos los no generativos y los adaptamos al formato del frontend.
    app.get('/api/gemini/models', geminiLimiter, async (req, res) => {
      const authHeader = req.headers.authorization;
      const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (!apiKey) {
        return res.status(400).json({ error: 'API Key no proporcionada en el header Authorization.' });
      }

      try {
        const geminiModelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const modelsRes = await fetch(geminiModelsUrl);

        if (!modelsRes.ok) {
          const errorText = await modelsRes.text();
          console.error(`Gemini models API error ${modelsRes.status}: ${errorText}`);
          return res.status(modelsRes.status).json({
            error: `Error al obtener modelos de Gemini: ${modelsRes.statusText || 'Unknown error'}`,
            details: errorText,
          });
        }

        const { models } = await modelsRes.json();

        const GEMINI_EXCLUDED = ['embed', 'vision', 'aqa', 'imagen', 'chirp']; // Consistente con frontend

        const filteredModels = models
          .filter(m => m.supportedGenerationMethods?.includes('generateContent') && !GEMINI_EXCLUDED.some(p => m.name.includes(p)))
          .map(m => ({
            value: m.name.replace('models/', ''),
            label: m.displayName || m.name.replace('models/', ''),
          }))
          .sort((a, b) => a.label.localeCompare(b.label));

        res.status(200).json({ data: filteredModels });
      } catch (error) {
        console.error('Error in Gemini models proxy:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener modelos de Gemini.' });
      }
    });

        // Translate from internal Message format → Gemini SDK format.
        // All messages except the last form the chat history.
    // Internal role 'assistant' maps to Gemini role 'model'.
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const chat = gemModel.startChat({ history });
    const lastMessage = messages[messages.length - 1];

    // #38: streaming vía SSE. Obtenemos el stream ANTES de enviar cabeceras, para
    // que un fallo de setup (clave/modelo inválidos) salga como JSON de error.
    if (stream) {
      const result = await chat.sendMessageStream(lastMessage.content);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();
      for await (const chunk of result.stream) {
        const t = chunk.text();
        if (t) res.write(`data: ${JSON.stringify({ text: t })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    const result = await chat.sendMessage(lastMessage.content);
    const text = result.response.text();
    res.json({ text });
  } catch (err) {
    console.error('Gemini proxy error:', err);
    // Si ya empezó el stream (cabeceras enviadas), solo cerramos la conexión.
    if (res.headersSent) {
      try { res.end(); } catch { /* noop */ }
      return;
    }
    // Surface the HTTP status from the Gemini SDK error when available
    const status = err?.status ?? err?.httpErrorCode ?? 500;
    const safeStatus = (status >= 400 && status < 600) ? status : 500;
    res.status(safeStatus).json({
      error: err?.message || 'Error al contactar con la API de Gemini',
    });
  }
});

// ─── Gemini Models Proxy (#58, v3.23.0 / hotfix v3.23.2) ─────────────────────
// La API de listado de Gemini también está bloqueada en UE desde el navegador
// (como el chat), así que el catálogo de modelos se pide a través del proxy.
// Devuelve { data: [{ id, name }] } — el formato que fetchModels ya parsea.
// La apiKey del usuario viaja en el header Authorization (mismo patrón que
// Groq/OpenRouter en fetchModels), nunca se persiste. Mismo rate limit que el
// chat. Es GET para encajar con fetchModels (que hace fetch GET + header).
//
// IMPORTANTE: @google/generative-ai (0.21–0.24) NO expone listModels(). Hay que
// llamar a la REST API de Google AI. Los `name` llegan como "models/gemini-…";
// se recorta el prefijo para que coincida con getGenerativeModel({ model }).
app.get('/api/gemini/models', geminiLimiter, async (req, res) => {
  const auth = req.headers.authorization || '';
  const apiKey = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!apiKey) {
    return res.status(400).json({ error: 'Falta la apiKey (header Authorization: Bearer ...)' });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const upstream = await fetch(url);
    if (!upstream.ok) {
      let message = 'Error al contactar con la API de Gemini';
      try {
        const body = await upstream.json();
        message = body?.error?.message || message;
      } catch { /* respuesta no-JSON */ }
      const safeStatus = (upstream.status >= 400 && upstream.status < 600) ? upstream.status : 500;
      return res.status(safeStatus).json({ error: message });
    }

    const payload = await upstream.json();
    const models = Array.isArray(payload?.models) ? payload.models : [];
    // Filtrar no generativos: exige generateContent + denylist de subcadenas.
    // El catálogo de Gemini incluye embeddings, imagen, AQA, etc.
    const GEMINI_EXCLUDED = ['embed', 'vision', 'aqa', 'imagen', 'chirp'];
    const chatModels = models
      .filter(m => {
        const methods = m.supportedGenerationMethods || [];
        if (!methods.includes('generateContent')) return false;
        const id = String(m.name || '').replace(/^models\//, '');
        return !GEMINI_EXCLUDED.some(p => id.includes(p));
      })
      .map(m => {
        const id = String(m.name || '').replace(/^models\//, '');
        return { id, name: m.displayName || id };
      });
    res.json({ data: chatModels });
  } catch (err) {
    console.error('Gemini models proxy error:', err);
    const status = err?.status ?? err?.httpErrorCode ?? 500;
    const safeStatus = (status >= 400 && status < 600) ? status : 500;
    res.status(safeStatus).json({
      error: err?.message || 'Error al contactar con la API de Gemini',
    });
  }
});

// ─── GitHub OAuth ─────────────────────────────────────────────────────────────
app.get('/auth/github', (req, res) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(500).json({ error: 'GITHUB_CLIENT_ID not configured' });
  }

  // Fix #1: Generate a random state, store it in the session, and send it to
  // GitHub. The callback will verify it matches before exchanging the code.
  // This prevents CSRF attacks on the OAuth flow.
  // Seguridad: el `state` anti-CSRF debe ser IMPREDECIBLE → CSPRNG (`randomUUID`,
  // 122 bits), no `Math.random()` (xorshift128+, no criptográfico).
  const state = randomUUID();
  req.session.oauthState = state;

  // BALA DE PLATA: Si el host contiene 'run.app', forzamos el https sí o sí
  const host = req.get('host') || '';
  const baseUrl = host.includes('run.app') ? `https://${host}` : `${req.protocol}://${host}`;

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: `${baseUrl}/auth/callback`,
    scope: 'repo user read:org',
    state,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;

  // Fix #1: Verify the state matches what we stored in the session.
  // Mismatch means the request was not initiated by this server (CSRF attempt).
  const expectedState = req.session.oauthState;
  delete req.session.oauthState; // consume it — single use only

  if (!state || !expectedState || state !== expectedState) {
    console.error('OAuth state mismatch — possible CSRF attempt');
    return res.redirect(`${FRONTEND_URL}/#error=state_mismatch`);
  }

  if (!code) {
    return res.redirect(`${FRONTEND_URL}/#error=no_code`);
  }
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return res.redirect(`${FRONTEND_URL}/#error=not_configured`);
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error('GitHub OAuth error:', tokenData.error_description);
      return res.redirect(`${FRONTEND_URL}/#error=${encodeURIComponent(tokenData.error_description)}`);
    }

    // Return token to frontend via URL hash — stays in sessionStorage, never on the server
    res.redirect(`${FRONTEND_URL}/#access_token=${tokenData.access_token}&token_type=${tokenData.token_type}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(`${FRONTEND_URL}/#error=server_error`);
  }
});

// ─── Static Frontend (production) ────────────────────────────────────────────
const clientDistPath = join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// Catch-all: serve index.html for SPA routing
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(join(clientDistPath, 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Asistente de IA para Publicar Repositorios`);
  console.log(`   Server:  http://localhost:${PORT}`);
  console.log(`   Health:  http://localhost:${PORT}/health`);
  console.log(`   OAuth:   http://localhost:${PORT}/auth/github`);
  console.log(`   Proxy:   POST http://localhost:${PORT}/api/gemini`);
  console.log(`   🛡️  Rate Limit: 40 req/min en /api/gemini`);
  console.log(`\n   ℹ️  Groq  → llamadas directas desde el navegador`);
  console.log(`   ℹ️  Gemini → proxiado via /api/gemini (elude bloqueo EU)\n`);
});
