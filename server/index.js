import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Fix #2: Fail loudly if SESSION_SECRET is missing in production ────────────
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

// ─── Middleware ───────────────────────────────────────────────────────────────
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

// ─── GitHub OAuth ─────────────────────────────────────────────────────────────
app.get('/auth/github', (req, res) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(500).json({ error: 'GITHUB_CLIENT_ID not configured' });
  }

  // Fix #1: Generate a random state, store it in the session, and send it to
  // GitHub. The callback will verify it matches before exchanging the code.
  // This prevents CSRF attacks on the OAuth flow.
  const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
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
  console.log(`\n   ℹ️  AI calls go directly from the browser (user's own API key)\n`);
});
