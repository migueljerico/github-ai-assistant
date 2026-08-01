import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// El endpoint real llama a la REST API de Cloudflare con `fetch` (global):
// GET /accounts/{account_id}/ai/models/search. Aquí mockeamos `fetch` para simular
// la respuesta real ({ success, result: [{ id, name, description, task, properties }] })
// y validar el shaping del proxy: filtro task==='Text Generation', exclusión de los 3
// modelos no-Free (kimi-k2.6, kimi-k2.7-code, glm-5.2), orden por precio input asc,
// propagación de status. El test refleja el código en producción.
//
// (v3.65.0) Proxy de catálogo dinámico para Cloudflare Workers AI.
const TG = 'Text Generation';
function cfModel(name, opts = {}) {
  const { task = TG, price } = opts;
  const properties = [];
  if (price !== undefined) {
    properties.push({
      property_id: 'price',
      value: [
        { unit: 'per M input tokens', price: price[0] ?? 0, currency: 'USD' },
        { unit: 'per M output tokens', price: price[1] ?? 0, currency: 'USD' },
      ],
    });
  }
  return { id: 'uuid-' + name, source: 1, name, description: name, task: { name: task }, created_at: '', tags: [], properties };
}

const cloudflareModelsPayload = {
  success: true,
  result: [
    cfModel('@cf/qwen/qwen3-30b-a3b-fp8', { price: [0.0509, 0.335] }),     // barato
    cfModel('@cf/meta/llama-3.1-8b-instruct-fp8', { price: [0.152, 0.287] }),
    cfModel('@cf/openai/gpt-oss-120b', { price: [0.35, 0.75] }),
    cfModel('@cf/nvidia/nemotron-3-120b-a12b', { price: [0.5, 1.5] }),
    cfModel('@cf/moonshotai/kimi-k2.6', { price: [0.95, 4] }),             // no-Free
    cfModel('@cf/moonshotai/kimi-k2.7-code', { price: [0.95, 4] }),        // no-Free
    cfModel('@cf/zai-org/glm-5.2', { price: [1.4, 4.4] }),                 // no-Free
    cfModel('@cf/baai/bge-m3', { task: 'Text Embeddings' }),               // no-chat
    cfModel('@cf/pipecat-ai/smart-turn-v2', { task: 'Dumb Pipe' }),        // no-chat
  ],
};

function mockCloudflareResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

// Réplica mínima del endpoint /api/cloudflare/models de server/index.js (v3.65.0).
// (No arrancamos server/index.js completo: requeriría .env, OAuth, puerto…)
// Debe mantenerse alineada con el handler real.
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  app.get('/api/cloudflare/models', async (req, res) => {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Falta la API key de Cloudflare (header Authorization: Bearer ...)' });
    }
    const accountId = req.headers['x-account-id'];
    if (!accountId) {
      return res.status(400).json({ error: 'Falta accountId (header X-Account-Id).' });
    }
    try {
      const upstreamUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/models/search`;
      const upstream = await fetch(upstreamUrl, { method: 'GET', headers: { 'Authorization': auth } });
      if (!upstream.ok) {
        let message = 'Error al contactar con la API de Cloudflare';
        try { const body = await upstream.json(); message = body?.errors?.[0]?.message || body?.error?.message || body?.message || message; } catch { /* */ }
        const safeStatus = (upstream.status >= 400 && upstream.status < 600) ? upstream.status : 500;
        return res.status(safeStatus).json({ error: message });
      }
      const payload = await upstream.json();
      const all = Array.isArray(payload?.result) ? payload.result : [];
      const CF_NOT_FREE = ['kimi-k2.6', 'kimi-k2.7-code', 'glm-5.2'];
      const isFreeExcluded = (name) => {
        const low = String(name || '').toLowerCase();
        return CF_NOT_FREE.some(nf => low.includes(nf));
      };
      const inputPrice = (m) => {
        const props = Array.isArray(m?.properties) ? m.properties : [];
        const price = props.find(p => p?.property_id === 'price');
        const tiers = Array.isArray(price?.value) ? price.value : [];
        const inp = tiers.find(t => String(t?.unit || '').includes('input'));
        return Number(inp?.price ?? 0);
      };
      const chatModels = all
        .filter(m => (m?.task?.name || '') === 'Text Generation')
        .filter(m => !!m.name && !isFreeExcluded(m.name))
        .map(m => ({ name: m.name, description: m.description, _price: inputPrice(m) }))
        .sort((a, b) => (a._price - b._price) || String(a.name).localeCompare(String(b.name)))
        .map(({ _price, ...rest }) => rest);
      res.json({ result: chatModels });
    } catch (err) {
      const status = err?.status ?? 500;
      const safeStatus = (status >= 400 && status < 600) ? status : 500;
      res.status(safeStatus).json({ error: err?.message || 'Error' });
    }
  });

  return app;
};

describe('GET /api/cloudflare/models — proxy de catálogo (v3.65.0)', () => {
  let app;
  let fetchSpy;

  beforeEach(() => {
    app = createTestApp();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('devuelve { result: [...] } solo con Text Generation, sin los 3 no-Free, ordenados por precio input asc', async () => {
    fetchSpy.mockResolvedValue(mockCloudflareResponse(200, cloudflareModelsPayload));

    const res = await request(app)
      .get('/api/cloudflare/models')
      .set('Authorization', 'Bearer VALID_TOKEN')
      .set('X-Account-Id', 'ACC123');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.result)).toBe(true);
    const names = res.body.result.map(m => m.name);
    // Se incluyen los modelos de chat aptos para Free.
    expect(names).toContain('@cf/qwen/qwen3-30b-a3b-fp8');
    expect(names).toContain('@cf/openai/gpt-oss-120b');
    // Se excluyen los 3 modelos no-Free (requieren Workers Paid).
    expect(names).not.toContain('@cf/moonshotai/kimi-k2.6');
    expect(names).not.toContain('@cf/moonshotai/kimi-k2.7-code');
    expect(names).not.toContain('@cf/zai-org/glm-5.2');
    // Se excluyen modelos que no son de chat (otras tareas).
    expect(names).not.toContain('@cf/baai/bge-m3');
    expect(names).not.toContain('@cf/pipecat-ai/smart-turn-v2');
    // Orden por precio input ascendente: Qwen3 (0.0509) antes que GPT-OSS 120B (0.35)
    // antes que Nemotron (0.5) — el más barato queda el primero.
    expect(names[0]).toBe('@cf/qwen/qwen3-30b-a3b-fp8');
    expect(names.indexOf('@cf/qwen/qwen3-30b-a3b-fp8')).toBeLessThan(names.indexOf('@cf/openai/gpt-oss-120b'));
    expect(names.indexOf('@cf/openai/gpt-oss-120b')).toBeLessThan(names.indexOf('@cf/nvidia/nemotron-3-120b-a12b'));
    // El account_id viaja en la URL del upstream.
    expect(fetchSpy.mock.calls[0][0]).toContain('/accounts/ACC123/ai/models/search');
  });

  it('responde 401 si falta el token (sin header Authorization)', async () => {
    const res = await request(app)
      .get('/api/cloudflare/models')
      .set('X-Account-Id', 'ACC123');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/API key|Bearer/i);
  });

  it('responde 400 si falta el accountId (sin header X-Account-Id)', async () => {
    const res = await request(app)
      .get('/api/cloudflare/models')
      .set('Authorization', 'Bearer VALID_TOKEN');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/accountId|X-Account-Id/i);
  });

  it('propaga el error de Cloudflare con su status (token inválido → 401)', async () => {
    fetchSpy.mockResolvedValue(mockCloudflareResponse(401, {
      success: false,
      errors: [{ code: 10000, message: 'Authentication error' }],
    }));

    const res = await request(app)
      .get('/api/cloudflare/models')
      .set('Authorization', 'Bearer INVALID')
      .set('X-Account-Id', 'ACC123');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication error/i);
  });
});
