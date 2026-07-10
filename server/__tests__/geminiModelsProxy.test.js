import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock del SDK de Google antes de importar nada que lo use.
// El endpoint real hace `new GoogleGenerativeAI(apiKey).listModels()`.
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    constructor(apiKey) { this.apiKey = apiKey; }
    async listModels() {
      // Simula la respuesta del SDK: { models: [{ name, displayName, ... }] }
      if (this.apiKey === 'INVALID') {
        const err = new Error('API key not valid');
        err.status = 400;
        throw err;
      }
      return {
        models: [
          { name: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
          { name: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' },
          { name: 'text-embedding-004', displayName: 'Text Embedding 004' },
          { name: 'gemini-2.0-flash-vision', displayName: 'Gemini 2.0 Flash Vision' },
        ],
      };
    }
  },
}));

// Importa el SDK mockeado y monta una app de prueba aislada con el endpoint.
// (No arrancamos server/index.js completo: requeriría .env, OAuth, puerto…)
const { GoogleGenerativeAI } = await import('@google/generative-ai');

const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Réplica mínima del endpoint /api/gemini/models de server/index.js (#58).
  app.post('/api/gemini/models', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'Falta el campo requerido: apiKey' });
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const { models } = await genAI.listModels();
      const GEMINI_EXCLUDED = ['embed', 'vision', 'aqa', 'imagen', 'chirp'];
      const chatModels = models
        .filter(m => !GEMINI_EXCLUDED.some(p => m.name.includes(p)))
        .map(m => ({ id: m.name, name: m.displayName || m.name }));
      res.json({ data: chatModels });
    } catch (err) {
      const status = err?.status ?? 500;
      const safeStatus = (status >= 400 && status < 600) ? status : 500;
      res.status(safeStatus).json({ error: err?.message || 'Error' });
    }
  });

  return app;
};

describe('POST /api/gemini/models — proxy de catálogo (#58)', () => {
  let app;
  beforeEach(() => { app = createTestApp(); });

  it('devuelve { data: [...] } con los modelos generativos y filtra los no-chat', async () => {
    const res = await request(app)
      .post('/api/gemini/models')
      .send({ apiKey: 'VALID_KEY' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const ids = res.body.data.map(m => m.id);
    expect(ids).toContain('gemini-2.5-flash');
    expect(ids).toContain('gemini-2.5-pro');
    // Filtrados (no generativos)
    expect(ids).not.toContain('text-embedding-004');
    expect(ids).not.toContain('gemini-2.0-flash-vision');
    // El name llega como displayName legible
    expect(res.body.data.find(m => m.id === 'gemini-2.5-flash').name).toBe('Gemini 2.5 Flash');
  });

  it('responde 400 si falta la apiKey', async () => {
    const res = await request(app).post('/api/gemini/models').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/apiKey/);
  });

  it('propaga el error del SDK con su status (API key inválida)', async () => {
    const res = await request(app)
      .post('/api/gemini/models')
      .send({ apiKey: 'INVALID' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not valid/i);
  });
});
