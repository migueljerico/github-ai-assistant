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

// ─── Rate Limiting para NVIDIA NIM Proxy (v3.32.1) ────────────────────────────
// Ventana propia (independiente de Gemini) para que el abuso de un proveedor no
// agote la cuota del otro. Mismo límite: 40 req/min por IP.
const nimLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  message: {
    error: 'Demasiadas peticiones a NVIDIA NIM. Por favor espera un minuto.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Rate Limiting para OpenCode Zen Proxy (v3.33.1) ──────────────────────────
// OpenCode Zen tampoco envía cabeceras CORS → el navegador bloquea las llamadas
// directas con "Failed to fetch". Mismo patrón que Gemini y NIM: proxy backend.
const openzenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  message: {
    error: 'Demasiadas peticiones a OpenCode Zen. Por favor espera un minuto.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Rate Limiting para Cloudflare Workers AI Proxy (v3.33.1) ──────────────────
// Cloudflare Workers AI tampoco envía cabeceras CORS → mismo patrón de proxy.
const cloudflareLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  message: {
    error: 'Demasiadas peticiones a Cloudflare Workers AI. Por favor espera un minuto.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// URL base de la API de NVIDIA NIM (el proxy reenvía a ella).
// NIM NO envía cabeceras CORS → el navegador bloquea las llamadas directas con
// "Failed to fetch". Este proxy elude el bloqueo igual que el de Gemini (#58).
const NIM_BASE_URL = 'https://integrate.api.nvidia.com/v1';

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
      const { apiKey, model, messages, systemPrompt, mode, stream, maxOutputTokens } = req.body;

      if (!apiKey || !model || !Array.isArray(messages) || !systemPrompt) {
        return res.status(400).json({
          error: 'Faltan campos requeridos: apiKey, model, messages, systemPrompt',
        });
      }

      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // v3.31.0: maxOutputTokens opcional. La generación de documentación
        // (README + MANUAL_TECNICO) emite salidas largas; sin este límite el SDK
        // usa el default del modelo y la respuesta puede truncarse a medias,
        // rompiendo el JSON. Retrocompatible: si no viene, no se envía.
        const modelConfig = { model, systemInstruction: systemPrompt };
        if (typeof maxOutputTokens === 'number' && maxOutputTokens > 0) {
          modelConfig.generationConfig = { maxOutputTokens };
        }
        const gemModel = genAI.getGenerativeModel(modelConfig);
    
        // 🔥 OPCIÓN D: Log para ver el modo en Cloud Run (útil para debugging)
        if (mode) {
          console.log(`[Opción D] Gemini proxy received mode: ${mode}${stream ? ' (streaming)' : ''}`);
        }
    
        // Translate from internal Message format → Gemini SDK format.
        // All messages except the last form the chat history.

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
// NOTA (v3.24.0): el frontend usa ahora un catálogo FIJO de modelos; ya NO
// llama a este endpoint. Se mantiene por compatibilidad/observabilidad y por si
// en el futuro se quiere volver a un catálogo dinámico.
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

// ─── NVIDIA NIM Proxy (v3.32.1) ───────────────────────────────────────────────
// NIM (integrate.api.nvidia.com) NO envía cabeceras CORS (Access-Control-Allow-
// Origin), de modo que las llamadas directas desde el navegador se bloquean en la
// capa de red ("Failed to fetch"). Esta pasarela resuelve el problema reenviando
// la petición desde el servidor — mismo patrón que el proxy de Gemini (#58), pero
// genérico: copia el body OpenAI-format y el header Authorization sin tocarlos, y
// devuelve la respuesta (JSON o stream SSE) tal cual llega del upstream.
//
// La API key del usuario viaja en el header Authorization (HTTPS cliente→backend) y
// se descarta al terminar la petición — nunca se persiste ni loguea (Zero-Storage).
//
//   POST /api/nim          → chat/completions (JSON o SSE streaming)
//   GET  /api/nim/models   → catálogo de modelos ({ data: [...] })
// Reenvía el cuerpo de la respuesta del upstream al cliente (res) sin bufferizar,
// vital para el streaming token a token. Soporta los dos tipos de body que puede
// devolver el fetch nativo de Node (undici):
//   • ReadableStream web (Node 18+ por defecto) → expone pipeTo(), NO pipe().
//   • stream de Node (si alguien inyecta un agente custom) → expone pipe().
// El uso de upstream.body.pipe(res) (v3.32.1) rompía en prod con 502 porque
// ReadableStream no tiene .pipe() — ver hotfix v3.32.5.
async function pipeUpstream(upstream, res) {
  const body = upstream.body;
  if (!body) { res.end(); return; }
  // ReadableStream web → se convierte a stream de Node con Readable.fromWeb() y
  // entonces sí se hace .pipe(res). Esta es la forma estable y portable (Node 18+);
  // respeta backpressure y error forwarding.
  if (typeof body.pipeTo === 'function') {
    const { Readable } = await import('node:stream');
    Readable.fromWeb(body).pipe(res);
    return;
  }
  // stream de Node clásico → pipe().
  if (typeof body.pipe === 'function') {
    body.pipe(res);
    return;
  }
  // Fallback: consumir como ArrayBuffer y escribir (bufferiza; solo si los dos
  // anteriores no aplican — no debería ocurrir con fetch nativo).
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.end(buf);
}

app.post('/api/nim', nimLimiter, async (req, res) => {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Falta la API key (header Authorization: Bearer nvapi-...)' });
  }
  try {
    const upstream = await fetch(`${NIM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
        ...(req.headers['accept'] ? { 'Accept': req.headers['accept'] } : {}),
      },
      body: JSON.stringify(req.body),
    });
    // Log de status upstream: los errores de NIM (401/403/404/429/5xx) dejan de ser
    // opacos. Solo el status (sin body ni auth) — zero-PII.
    console.log(`[NIM] upstream status=${upstream.status} ct=${upstream.headers.get('content-type') || '-'}`);
    // Pasarela transparente: copiar el status y el content-type del upstream para
    // que JSON (200) y SSE (text/event-stream) lleguen idénticos al cliente.
    res.status(upstream.status);
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    await pipeUpstream(upstream, res);
  } catch (err) {
    console.error('NIM proxy error (chat):', err);
    if (!res.headersSent) res.status(502).json({ error: 'Error al contactar con NVIDIA NIM', detail: err?.message || String(err) });
    else { try { res.end(); } catch { /* noop */ } }
  }
});

app.get('/api/nim/models', nimLimiter, async (req, res) => {
  const auth = req.headers.authorization || '';
  const apiKey = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!apiKey) {
    return res.status(401).json({ error: 'Falta la API key (header Authorization: Bearer nvapi-...)' });
  }
  try {
    const upstream = await fetch(`${NIM_BASE_URL}/models`, {
      headers: { 'Authorization': auth },
    });
    if (!upstream.ok) {
      let message = 'Error al contactar con NVIDIA NIM';
      try {
        const body = await upstream.json();
        message = body?.error?.message || body?.error || message;
      } catch { /* respuesta no-JSON */ }
      const safeStatus = (upstream.status >= 400 && upstream.status < 600) ? upstream.status : 500;
      return res.status(safeStatus).json({ error: message });
    }
    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    console.error('NIM proxy error (models):', err);
    const status = err?.status ?? 502;
    const safeStatus = (status >= 400 && status < 600) ? status : 502;
    res.status(safeStatus).json({ error: 'Error al contactar con NVIDIA NIM' });
  }
});

// ─── OpenCode Zen Proxy (v3.33.1) ─────────────────────────────────────────────
// OpenCode Zen (opencode.ai) NO envía cabeceras CORS → el navegador bloquea las
// llamadas directas con "Failed to fetch". Este proxy elude el bloqueo igual que
// el de Gemini y NIM. Reenvía el body OpenAI-format y el header Authorization
// sin tocarlos, y devuelve la respuesta (JSON o stream SSE) tal cual llega.
//
// La API key del usuario viaja en el header Authorization (HTTPS cliente→backend)
// y se descarta al terminar la petición — nunca se persiste ni loguea.
app.post('/api/openzen', openzenLimiter, async (req, res) => {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Falta la API key (header Authorization: Bearer ...)' });
  }
  try {
    const upstream = await fetch('https://opencode.ai/zen/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
        ...(req.headers['accept'] ? { 'Accept': req.headers['accept'] } : {}),
      },
      body: JSON.stringify(req.body),
    });
    console.log(`[OpenZen] upstream status=${upstream.status} ct=${upstream.headers.get('content-type') || '-'}`);
    res.status(upstream.status);
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    await pipeUpstream(upstream, res);
  } catch (err) {
    console.error('OpenCode Zen proxy error:', err);
    if (!res.headersSent) res.status(502).json({ error: 'Error al contactar con OpenCode Zen', detail: err?.message || String(err) });
    else { try { res.end(); } catch { /* noop */ } }
  }
});

// ─── Cloudflare Workers AI Proxy (v3.33.1) ─────────────────────────────────────
// Cloudflare Workers AI (api.cloudflare.com) NO envía cabeceras CORS → el navegador
// bloquea las llamadas directas con "Failed to fetch". Este proxy elude el bloqueo
// igual que el de Gemini, NIM y OpenCode Zen. Reenvía el body OpenAI-format y el
// header Authorization sin tocarlos, y devuelve la respuesta (JSON o stream SSE).
//
// Requiere account_id que se recibe del body de la petición (lo construye el frontend
// con el valor del campo Account ID del panel). La API key viaja en Authorization.
app.post('/api/cloudflare', cloudflareLimiter, async (req, res) => {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Falta la API key de Cloudflare (header Authorization: Bearer ...)' });
  }
  // Cloudflare requiere account_id en la URL; el frontend lo envía en el body.
  const accountId = req.body?.accountId;
  if (!accountId) {
    return res.status(400).json({ error: 'Falta accountId (campo accountId en el body)' });
  }
  const upstreamUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/v1/chat/completions`;
  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
        ...(req.headers['accept'] ? { 'Accept': req.headers['accept'] } : {}),
      },
      body: JSON.stringify(req.body),
    });
    console.log(`[Cloudflare] status=${upstream.status} ct=${upstream.headers.get('content-type') || '-'}`);
    res.status(upstream.status);
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    await pipeUpstream(upstream, res);
  } catch (err) {
    console.error('Cloudflare proxy error:', err);
    if (!res.headersSent) res.status(502).json({ error: 'Error al contactar con Cloudflare Workers AI', detail: err?.message || String(err) });
    else { try { res.end(); } catch { /* noop */ } }
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
  console.log(`   Proxy Gemini: POST http://localhost:${PORT}/api/gemini`);
  console.log(`   Proxy NIM:    POST http://localhost:${PORT}/api/nim · GET /api/nim/models`);
  console.log(`   Proxy OpenZen: POST http://localhost:${PORT}/api/openzen`);
  console.log(`   Proxy CF:     POST http://localhost:${PORT}/api/cloudflare`);
  console.log(`   🛡️  Rate Limit: 40 req/min en /api/gemini, /api/nim, /api/openzen y /api/cloudflare`);
  console.log(`\n   ℹ️  OpenRouter / Zenmux → llamadas directas desde el navegador`);
  console.log(`   ℹ️  Gemini → proxiado via /api/gemini (elude bloqueo EU)`);
  console.log(`   ℹ️  NIM / OpenCode Zen / Cloudflare → proxiados (eluden bloqueo CORS)\n`);
});
