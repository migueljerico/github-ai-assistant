import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── #73: timeout automático en llamadas IA (defensa en profundidad server) ────
// El proxy server aplica signal: AbortSignal.timeout(120s) al fetch upstream; si
// este se dispara (o el cliente desaparece), el catch responde 504 Gateway
// Timeout con un mensaje accionable, en vez del 502 genérico.
//
// Aquí no arrancamos server/index.js completo (requeriría .env/OAuth/puerto).
// Replicamos el handler de un proxy POST (mismo patrón que /api/nim etc.) con la
// lógica de timeout real (isUpstreamTimeout) inline, y mockeamos fetch para que
// rechace con un error de timeout. Así validamos el shaping 504 del producto.
const UPSTREAM_TIMEOUT_MS = 120_000;
function upstreamSignal() {
  if (typeof AbortSignal?.timeout === 'function') return AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  return controller.signal;
}
function isUpstreamTimeout(err) {
  const name = err?.name;
  if (name === 'TimeoutError' || name === 'AbortError') return true;
  return /timed out|timeout|abort/i.test(err?.message || String(err));
}

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.post('/api/test-proxy', async (req, res) => {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Falta API key' });
    try {
      const upstream = await fetch('https://example.test/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
        signal: upstreamSignal(),
      });
      res.status(upstream.status);
      await upstream.text(); // piped
      res.end();
    } catch (err) {
      const status = isUpstreamTimeout(err) ? 504 : 502;
      const error = isUpstreamTimeout(err) ? 'Timeout upstream' : 'Error upstream';
      if (!res.headersSent) res.status(status).json({ error, detail: err?.message || String(err) });
      else { try { res.end(); } catch { /* noop */ } }
    }
  });
  return app;
};

describe('Proxy upstream timeout → 504 (#73)', () => {
  let app;
  let fetchSpy;

  beforeEach(() => {
    app = createTestApp();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('responde 504 cuando el fetch upstream agota el timeout', async () => {
    // AbortSignal.timeout rechaza con DOMException name 'TimeoutError' (Node 18+/Chromium).
    fetchSpy.mockRejectedValue(Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' }));

    const res = await request(app)
      .post('/api/test-proxy')
      .set('Authorization', 'Bearer KEY')
      .send({ messages: [{ role: 'user', content: 'hola' }] });

    expect(res.status).toBe(504);
    expect(res.body.error).toMatch(/timeout/i);
    // El signal de timeout se pasó al fetch upstream.
    const init = fetchSpy.mock.calls[0][1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('detecta también AbortError puro como timeout (segundo camino del helper)', async () => {
    fetchSpy.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const res = await request(app)
      .post('/api/test-proxy')
      .set('Authorization', 'Bearer KEY')
      .send({ messages: [{ role: 'user', content: 'hola' }] });
    expect(res.status).toBe(504);
  });

  it('sigue respondiendo 502 para errores de upstream NO relacionados con timeout', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNRESET de red'));
    const res = await request(app)
      .post('/api/test-proxy')
      .set('Authorization', 'Bearer KEY')
      .send({ messages: [{ role: 'user', content: 'hola' }] });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/upstream/i);
  });

  it('responde 401 si falta la API key', async () => {
    const res = await request(app).post('/api/test-proxy').send({ messages: [] });
    expect(res.status).toBe(401);
  });
});

describe('upstreamSignal / isUpstreamTimeout (unitarios)', () => {
  it('upstreamSignal devuelve un AbortSignal no abortado', () => {
    const sig = upstreamSignal();
    expect(sig).toBeInstanceOf(AbortSignal);
    expect(sig.aborted).toBe(false);
  });

  it('isUpstreamTimeout reconoce TimeoutError, AbortError y mensajes con timeout', () => {
    expect(isUpstreamTimeout(Object.assign(new Error('x'), { name: 'TimeoutError' }))).toBe(true);
    expect(isUpstreamTimeout(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(true);
    expect(isUpstreamTimeout(new Error('request timeout'))).toBe(true);
    expect(isUpstreamTimeout(new Error('Unauthorized'))).toBe(false);
  });
});
