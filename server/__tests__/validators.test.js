import { describe, it, expect } from 'vitest';
import {
  validateMessages,
  validateChatBody,
  MAX_MESSAGES,
  MAX_CONTENT_BYTES,
} from '../validators.js';

// ─── validateMessages: validación pura de la forma de `messages` ──────────────
// Cubre los Hallazgos #1+#3 (v3.50.0): un body malformado NO debe llegar al
// upstream. El helper devuelve un string de error humano (null = OK).
describe('validateMessages', () => {
  it('acepta un array válido de mensajes { role, content }', () => {
    expect(validateMessages([
      { role: 'system', content: 'Eres un asistente.' },
      { role: 'user', content: 'Hola' },
    ])).toBeNull();
  });

  it('acepta todos los roles OpenAI válidos', () => {
    const roles = ['system', 'user', 'assistant', 'developer', 'tool'];
    for (const role of roles) {
      expect(validateMessages([{ role, content: 'x' }])).toBeNull();
    }
  });

  it('rechaza si messages no es array', () => {
    expect(validateMessages(undefined)).toMatch(/messages.*array/i);
    expect(validateMessages(null)).toMatch(/messages.*array/i);
    expect(validateMessages({})).toMatch(/messages.*array/i);
    expect(validateMessages('hola')).toMatch(/messages.*array/i);
  });

  it('rechaza array vacío', () => {
    expect(validateMessages([])).toMatch(/vacío/i);
  });

  it('rechaza si excede MAX_MESSAGES turnos', () => {
    const tooMany = Array.from({ length: MAX_MESSAGES + 1 }, () => ({
      role: 'user', content: 'x',
    }));
    expect(validateMessages(tooMany)).toMatch(new RegExp(`máximo de ${MAX_MESSAGES}`));
  });

  it('rechaza item que no es objeto', () => {
    expect(validateMessages(['texto'])).toMatch(/messages\[0\].*objeto/i);
    expect(validateMessages([null])).toMatch(/messages\[0\].*objeto/i);
    expect(validateMessages([[]])).toMatch(/messages\[0\].*objeto/i);
  });

  it('rechaza role vacío o no-string', () => {
    expect(validateMessages([{ role: '', content: 'x' }])).toMatch(/role.*string/i);
    expect(validateMessages([{ role: 5, content: 'x' }])).toMatch(/role.*string/i);
    expect(validateMessages([{ content: 'x' }])).toMatch(/role.*string/i);
  });

  it('rechaza content no-string (cargas multimodales no admitidas)', () => {
    expect(validateMessages([{ role: 'user', content: ['img'] }])).toMatch(/content.*string/i);
    expect(validateMessages([{ role: 'user', content: 42 }])).toMatch(/content.*string/i);
    expect(validateMessages([{ role: 'user' }])).toMatch(/content.*string/i);
  });

  it('rechaza content que supera MAX_CONTENT_BYTES', () => {
    // Generamos un string UTF-8 que supere el límite en bytes (multi-byte para
    // verificar que contamos bytes, no code units).
    const char = 'ñ';  // 2 bytes en UTF-8
    const big = char.repeat(Math.ceil(MAX_CONTENT_BYTES / 2) + 1);
    expect(validateMessages([{ role: 'user', content: big }])).toMatch(
      new RegExp(`supera el máximo de ${MAX_CONTENT_BYTES} bytes`)
    );
  });

  it('acepta content justo en el límite de bytes', () => {
    const exact = 'a'.repeat(MAX_CONTENT_BYTES);  // ASCII = 1 byte cada uno
    expect(validateMessages([{ role: 'user', content: exact }])).toBeNull();
  });

  it('rechaza role fuera de la lista permitida', () => {
    expect(validateMessages([{ role: 'admin', content: 'x' }])).toMatch(/role "admin".*no es/i);
    expect(validateMessages([{ role: 'function', content: 'x' }])).toMatch(/role "function".*no es/i);
  });

  it('el índice del mensaje aparece en el mensaje de error', () => {
    expect(validateMessages([
      { role: 'user', content: 'ok' },
      { role: 'user', content: 5 },
    ])).toMatch(/messages\[1\]/);
  });
});

// ─── validateChatBody: middleware express que envuelve validateMessages ───────
// Verifica content-type (415) y delega en validateMessages (400). No arranca
// server/index.js: el middleware es una función (req, res, next) pura.
describe('validateChatBody (middleware express)', () => {
  const mkReq = (overrides = {}) => ({
    headers: { 'content-type': 'application/json' },
    body: { messages: [{ role: 'user', content: 'hola' }] },
    ...overrides,
  });
  const mkRes = () => {
    const res = { statusCode: 200, body: null, headers: {} };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (payload) => { res.body = payload; return res; };
    res.setHeader = (k, v) => { res.headers[k] = v; };
    return res;
  };

  it('llama a next() cuando el body es válido', () => {
    const req = mkReq();
    const res = mkRes();
    let called = false;
    validateChatBody(req, res, () => { called = true; });
    expect(called).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBeNull();
  });

  it('responde 415 si el content-type no es JSON', () => {
    const req = mkReq({ headers: { 'content-type': 'text/plain' } });
    const res = mkRes();
    validateChatBody(req, res, () => {});
    expect(res.statusCode).toBe(415);
    expect(res.body.error).toMatch(/application\/json/i);
  });

  it('responde 415 si falta el content-type', () => {
    const req = mkReq({ headers: {} });
    const res = mkRes();
    validateChatBody(req, res, () => {});
    expect(res.statusCode).toBe(415);
  });

  it('acepta content-type con charset (application/json; charset=utf-8)', () => {
    const req = mkReq({ headers: { 'content-type': 'application/json; charset=utf-8' } });
    const res = mkRes();
    let called = false;
    validateChatBody(req, res, () => { called = true; });
    expect(called).toBe(true);
  });

  it('responde 400 si messages falta en el body', () => {
    const req = mkReq({ body: {} });
    const res = mkRes();
    validateChatBody(req, res, () => {});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/messages/i);
  });

  it('responde 400 si messages está mal formado', () => {
    const req = mkReq({ body: { messages: [{ role: 'user', content: 5 }] } });
    const res = mkRes();
    validateChatBody(req, res, () => {});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/content.*string/i);
  });

  it('no llama a next() cuando rechaza', () => {
    const req = mkReq({ body: {} });
    const res = mkRes();
    let called = false;
    validateChatBody(req, res, () => { called = true; });
    expect(called).toBe(false);
  });

  it('tolera req.body undefined (no rompe)', () => {
    const req = { headers: { 'content-type': 'application/json' }, body: undefined };
    const res = mkRes();
    validateChatBody(req, res, () => {});
    expect(res.statusCode).toBe(400);
  });
});
