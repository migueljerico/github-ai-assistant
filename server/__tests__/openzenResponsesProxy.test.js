import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── POST /api/openzen/responses (v4.0.45) ─────────────────────────────────────
// Las familias muse-spark/gpt/grok de OpenCode Zen SOLO aceptan la Responses API:
// en /chat/completions devuelven 500 "Internal server error" (caso real:
// muse-spark-1.2 y 1.3-contributor-free desde ZCode). El cliente (gemini.ts,
// isResponsesModel en providers.ts) enruta esos modelos a este proxy, que
// reenvía el body { model, instructions, input, ... } a
// https://opencode.ai/zen/v1/responses.
//
// Como el resto de tests de servidor, NO arrancamos server/index.js completo
// (requeriría .env/OAuth/puerto): replicamos la lógica del handler (validación
// de auth + Content-Type + `input`, passthrough al upstream con timeout, shaping
// 504/502) de forma aislada. Si el handler cambia en index.js, debe cambiar aquí.

const ZEN_RESPONSES_URL = 'https://opencode.ai/zen/v1/responses';
const UPSTREAM_TIMEOUT_MS = 180_000;

function getUpstreamTimeout(req) {
  const headerVal = req?.headers ? req.headers['x-timeout-ms'] : undefined;
  const bodyVal = req?.body?.timeoutMs;
  const parsed = parseInt(headerVal || bodyVal, 10);
  if (!isNaN(parsed) && parsed > 0 && parsed <= 600_000) {
    return parsed;
  }
  return UPSTREAM_TIMEOUT_MS;
}

function upstreamSignal(customTimeoutMs) {
  const timeoutMs = (typeof customTimeoutMs === 'number' && customTimeoutMs > 0) ? customTimeoutMs : UPSTREAM_TIMEOUT_MS;
  if (typeof AbortSignal?.timeout === 'function') return AbortSignal.timeout(timeoutMs);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

function isUpstreamTimeout(err) {
  const name = err?.name;
  if (name === 'TimeoutError' || name === 'AbortError') return true;
  return /timed out|timeout|abort/i.test(err?.message || String(err));
}

// Réplica del handler POST /api/openzen/responses de server/index.js.
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.post('/api/openzen/responses', async (req, res) => {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Falta la API key (header Authorization: Bearer ...)' });
    }
    const ct = req.headers['content-type'] || '';
    if (!ct.toLowerCase().includes('application/json')) {
      return res.status(415).json({ error: 'Content-Type debe ser application/json.' });
    }
    const input = req.body?.input;
    const inputOk = typeof input === 'string'
      ? input.length > 0
      : Array.isArray(input) && input.length > 0;
    if (!inputOk) {
      return res.status(400).json({ error: 'El cuerpo de la petición debe incluir "input" (string o array no vacío).' });
    }
    try {
      const upstream = await fetch(ZEN_RESPONSES_URL, {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/json',
          ...(req.headers['accept'] ? { 'Accept': req.headers['accept'] } : {}),
        },
        body: JSON.stringify(req.body),
        signal: upstreamSignal(getUpstreamTimeout(req)),
      });
      res.status(upstream.status);
      const ctUp = upstream.headers.get('content-type');
      if (ctUp) res.setHeader('Content-Type', ctUp);
      const text = await upstream.text();
      res.send(text);
    } catch (err) {
      const status = isUpstreamTimeout(err) ? 504 : 502;
      const error = isUpstreamTimeout(err) ? 'OpenCode Zen tardó demasiado (timeout). Reintenta o sube el timeout en ⚙️.' : 'Error al contactar con OpenCode Zen';
      if (!res.headersSent) res.status(status).json({ error, detail: err?.message || String(err) });
      else { try { res.end(); } catch { /* noop */ } }
    }
  });
  return app;
};

const BASE_BODY = {
  model: 'muse-spark-1.3-contributor-free',
  instructions: 'Responde con una palabra.',
  input: [{ role: 'user', content: 'Hola' }],
  temperature: 0.1,
  max_output_tokens: 4096,
};

function mockUpstream({ status = 200, body = '{"output":[]}', contentType = 'application/json' } = {}) {
  return vi.fn().mockResolvedValue({
    status,
    headers: { get: (k) => (k.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body,
  });
}

describe('POST /api/openzen/responses — proxy Responses de OpenCode Zen (v4.0.45)', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reenvía el body { instructions, input } a zen/v1/responses y devuelve su texto', async () => {
    const fetchMock = mockUpstream({ body: '{"output":[{"type":"message"}]}' });
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post('/api/openzen/responses')
      .set('Authorization', 'Bearer sk-test')
      .send(BASE_BODY);

    expect(res.status).toBe(200);
    expect(res.text).toContain('output');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(ZEN_RESPONSES_URL);
    expect(init.method).toBe('POST');
    expect(init.headers['Authorization']).toBe('Bearer sk-test');
    const sent = JSON.parse(init.body);
    expect(sent.instructions).toBe('Responde con una palabra.');
    expect(sent.input).toEqual([{ role: 'user', content: 'Hola' }]);
  });

  it('acepta input como string no vacío (además de array)', async () => {
    const fetchMock = mockUpstream();
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post('/api/openzen/responses')
      .set('Authorization', 'Bearer sk-test')
      .send({ ...BASE_BODY, input: 'Hola' });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('propaga el status del upstream (p. ej. 429 de cuota) sin reescribirlo', async () => {
    vi.stubGlobal('fetch', mockUpstream({ status: 429, body: '{"error":"Rate limit exceeded"}' }));

    const res = await request(app)
      .post('/api/openzen/responses')
      .set('Authorization', 'Bearer sk-test')
      .send(BASE_BODY);

    expect(res.status).toBe(429);
  });

  it('401 sin header Authorization (falta la API key)', async () => {
    const res = await request(app).post('/api/openzen/responses').send(BASE_BODY);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/API key/i);
  });

  it('400 si falta input o viene vacío (no consume cuota del upstream)', async () => {
    const fetchMock = mockUpstream();
    vi.stubGlobal('fetch', fetchMock);

    for (const bad of [{ ...BASE_BODY, input: undefined }, { ...BASE_BODY, input: [] }, { ...BASE_BODY, input: '' }]) {
      const res = await request(app)
        .post('/api/openzen/responses')
        .set('Authorization', 'Bearer sk-test')
        .send(bad);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/"input"/);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('504 accionable ante timeout del upstream (no el 502 genérico)', async () => {
    const err = new Error('The operation was aborted due to timeout');
    err.name = 'TimeoutError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(err));

    const res = await request(app)
      .post('/api/openzen/responses')
      .set('Authorization', 'Bearer sk-test')
      .send(BASE_BODY);

    expect(res.status).toBe(504);
    expect(res.body.error).toMatch(/tardó demasiado|timeout/i);
  });

  it('502 ante fallo de red del upstream', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));

    const res = await request(app)
      .post('/api/openzen/responses')
      .set('Authorization', 'Bearer sk-test')
      .send(BASE_BODY);

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/OpenCode Zen/i);
  });

  it('respeta el timeout manual X-Timeout-Ms (llega como signal al upstream)', async () => {
    const fetchMock = mockUpstream();
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post('/api/openzen/responses')
      .set('Authorization', 'Bearer sk-test')
      .set('X-Timeout-Ms', '600000')
      .send(BASE_BODY);

    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBeDefined();
  });
});
