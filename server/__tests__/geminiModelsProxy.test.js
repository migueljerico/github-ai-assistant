import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// El endpoint real llama a la REST API de Google AI con `fetch` (global), no al
// SDK: @google/generative-ai (0.21–0.24) NO expone listModels(). Aquí mockeamos
// `fetch` para simular la respuesta REST real de Google y validar el shaping del
// endpoint (filtro por generateContent + denylist, recorte del prefijo
// "models/", propagación de status). Así el test sí refleja el código en producción.
//
// NOTA (v3.24.0): el frontend usa ahora un catálogo FIJO y no llama a este
// endpoint, pero el proxy sigue desplegado por compatibilidad/observabilidad.
const googleModelsPayload = {
  models: [
    { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportedGenerationMethods: ['generateContent', 'countTokens'] },
    { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', supportedGenerationMethods: ['generateContent', 'countTokens'] },
    { name: 'models/text-embedding-004', displayName: 'Text Embedding 004', supportedGenerationMethods: ['embedContent'] },
    { name: 'models/gemini-2.0-flash-vision', displayName: 'Gemini 2.0 Flash Vision', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/imagen-4.0', displayName: 'Imagen 4.0', supportedGenerationMethods: ['predictLongRunning'] },
  ],
};

function mockGoogleResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

// Réplica mínima del endpoint /api/gemini/models de server/index.js (#58).
// (No arrancamos server/index.js completo: requeriría .env, OAuth, puerto…)
// Debe mantenerse alineada con el handler real.
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  app.get('/api/gemini/models', async (req, res) => {
    const auth = req.headers.authorization || '';
    const apiKey = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!apiKey) return res.status(400).json({ error: 'Falta la apiKey' });
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
      const upstream = await fetch(url);
      if (!upstream.ok) {
        let message = 'Error al contactar con la API de Gemini';
        try { const body = await upstream.json(); message = body?.error?.message || message; } catch { /* */ }
        const safeStatus = (upstream.status >= 400 && upstream.status < 600) ? upstream.status : 500;
        return res.status(safeStatus).json({ error: message });
      }
      const payload = await upstream.json();
      const models = Array.isArray(payload?.models) ? payload.models : [];
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
      const status = err?.status ?? 500;
      const safeStatus = (status >= 400 && status < 600) ? status : 500;
      res.status(safeStatus).json({ error: err?.message || 'Error' });
    }
  });

  return app;
};

describe('GET /api/gemini/models — proxy de catálogo (#58)', () => {
  let app;
  let fetchSpy;

  beforeEach(() => {
    app = createTestApp();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('devuelve { data: [...] } con los modelos generativos y filtra los no-chat', async () => {
    fetchSpy.mockResolvedValue(mockGoogleResponse(200, googleModelsPayload));

    const res = await request(app)
      .get('/api/gemini/models')
      .set('Authorization', 'Bearer VALID_KEY');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const ids = res.body.data.map(m => m.id);
    expect(ids).toContain('gemini-2.5-flash');
    expect(ids).toContain('gemini-2.5-pro');
    // Filtrados: sin generateContent (embedding) o en el denylist (vision, imagen)
    expect(ids).not.toContain('text-embedding-004');
    expect(ids).not.toContain('gemini-2.0-flash-vision');
    expect(ids).not.toContain('imagen-4.0');
    // El name llega como displayName legible
    expect(res.body.data.find(m => m.id === 'gemini-2.5-flash').name).toBe('Gemini 2.5 Flash');
    // El prefijo "models/" se recorta para encajar con getGenerativeModel({ model })
    expect(ids.every(id => !id.startsWith('models/'))).toBe(true);
  });

  it('responde 400 si falta la apiKey (sin header Authorization)', async () => {
    const res = await request(app).get('/api/gemini/models');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/apiKey/i);
  });

  it('propaga el error de Google con su status (API key inválida → 400)', async () => {
    fetchSpy.mockResolvedValue(mockGoogleResponse(400, {
      error: { code: 400, message: 'API key not valid. Please pass a valid API key.' },
    }));

    const res = await request(app)
      .get('/api/gemini/models')
      .set('Authorization', 'Bearer INVALID');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not valid/i);
  });
});
