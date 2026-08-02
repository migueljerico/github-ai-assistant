import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

// v3.66.0 (Frente B): tests de la rama no-streaming del handler POST /api/gemini.
// Valida que finishReason != STOP y blockReason se traduzcan a respuestas
// accionables (502 con mensaje claro) en vez de un {text:""} silencioso que luego
// provocaba el engañoso "no devolvió JSON válido" en generateRepoDocs.
//
// Al igual que geminiModelsProxy.test.js, NO arrancamos server/index.js completo
// (requeriría .env/OAuth/puerto). Replicamos aquí la rama no-streaming del handler
// para testear la lógica de finishReason/blockReason de forma aislada. Debe
// mantenerse alineada con server/index.js.

// Factoría de "response" del SDK con finishReason/blockReason configurables.
function makeSdkResponse(text, { finishReason, blockReason } = {}) {
  return {
    response: {
      candidates: finishReason ? [{ finishReason, content: { parts: [{ text }] } }] : undefined,
      promptFeedback: blockReason ? { blockReason } : undefined,
      text: () => text,
    },
  };
}

// Réplica mínima de la rama no-streaming del handler /api/gemini (server/index.js).
const createTestApp = (sdkResponse) => {
  const app = express();
  app.use(express.json());

  // Mock del SDK: el handler real hace new GoogleGenerativeAI(apiKey) y encadena.
  // Aquí inyectamos sdkResponse directamente vía una función startChat/sendMessage.
  app.post('/api/gemini', async (req, res) => {
    const { messages } = req.body;
    try {
      const result = await sdkResponse;
      const response = result.response;
      const blockReason = response?.promptFeedback?.blockReason;
      const finishReason = response?.candidates?.[0]?.finishReason;
      if (blockReason && blockReason !== 'BLOCK_REASON_UNSPECIFIED') {
        return res.status(502).json({
          error: `Gemini bloqueó la respuesta (${blockReason}). Reformula el prompt o prueba con otro modelo.`,
        });
      }
      if (finishReason && finishReason !== 'STOP' && finishReason !== 'FINISH_REASON_UNSPECIFIED') {
        return res.status(502).json({
          error: `La respuesta de Gemini se cortó (${finishReason}). Prueba con un repositorio más pequeño o un modelo con más tokens de salida.`,
        });
      }
      const text = response.text();
      return res.json({ text });
    } catch (err) {
      return res.status(500).json({ error: err?.message || 'Error' });
    }
  });

  return app;
};

const BASE_BODY = {
  apiKey: 'k', model: 'gemini-2.5-flash',
  messages: [{ role: 'user', content: 'hola' }],
  systemPrompt: 'sys',
};

describe('POST /api/gemini — finishReason/blockReason (v3.66.0 Frente B)', () => {
  it('devuelve {text} cuando finishReason es STOP', async () => {
    const app = createTestApp(makeSdkResponse('respuesta ok', { finishReason: 'STOP' }));
    const res = await request(app).post('/api/gemini').send(BASE_BODY);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ text: 'respuesta ok' });
  });

  it('devuelve 502 accionable cuando finishReason es MAX_TOKENS (truncamiento)', async () => {
    const app = createTestApp(makeSdkResponse('', { finishReason: 'MAX_TOKENS' }));
    const res = await request(app).post('/api/gemini').send(BASE_BODY);
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/se cortó.*MAX_TOKENS|más tokens de salida/);
  });

  it('devuelve 502 accionable cuando hay blockReason de seguridad', async () => {
    const app = createTestApp(makeSdkResponse('', { blockReason: 'SAFETY' }));
    const res = await request(app).post('/api/gemini').send(BASE_BODY);
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/bloqueó la respuesta.*SAFETY/);
  });

  it('no bloquea con FINISH_REASON_UNSPECIFIED (caso normal sin finishReason explícito)', async () => {
    const app = createTestApp(makeSdkResponse('ok', { finishReason: 'FINISH_REASON_UNSPECIFIED' }));
    const res = await request(app).post('/api/gemini').send(BASE_BODY);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ text: 'ok' });
  });
});
