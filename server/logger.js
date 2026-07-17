// ─── Logs estructurados (#65, v3.39.0 — parte 1 de #25) ───────────────────────
// Helper de logging que emite **una línea JSON por evento** a stdout/stderr.
// Pensado para Cloud Run: Logs Explorer parsea cada línea como jsonPayload y
// permite filtrar por `jsonPayload.provider`, `jsonPayload.level`,
// `jsonPayload.requestId`, etc. — algo imposible con los `console.*` de texto
// plano que había antes.
//
// Formato de cada línea:
//   {"ts":"2026-07-17T12:00:00.000Z","level":"info","msg":"upstream","provider":"nim","status":200,"requestId":"a1b2"}
//
// Zero-Storage (seguridad crítica): aquí NUNCA se loguean bodies, cabeceras
// Authorization ni API keys — solo metadatos (status, provider, requestId,
// content-type). Los call sites ya seguían esa regla; este helper la hace
// explícita al animar campos estructurados en vez de interpolar strings.
//
// Sin dependencias: JSON.stringify + process.stdout/stderr.write. No se añade
// winston/pino — coherente con el backend thin de un solo archivo.

import { randomUUID } from 'node:crypto';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * Emite un evento de log como una línea JSON.
 * @param {string} level - debug | info | warn | error (cae a 'info' si es otro).
 * @param {string} msg   - mensaje corto que identifica el evento (p. ej. 'upstream', 'proxy_error').
 * @param {object} [ctx] - campos extra a mergear dentro del JSON (provider, status, requestId…).
 */
export function logEvent(level, msg, ctx = {}) {
  const lvl = LEVELS[level] ? level : 'info';
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level: lvl,
    msg,
    ...ctx,
  });
  const stream = lvl === 'error' ? process.stderr : process.stdout;
  stream.write(line + '\n');
}

// Conveniencias para los call sites: log.info('upstream', {...}) en vez de
// logEvent('info', ...). Mantiene corto el reemplazo de los antiguos console.*.
export const log = {
  debug: (msg, ctx) => logEvent('debug', msg, ctx),
  info:  (msg, ctx) => logEvent('info', msg, ctx),
  warn:  (msg, ctx) => logEvent('warn', msg, ctx),
  error: (msg, ctx) => logEvent('error', msg, ctx),
};

/**
 * Middleware Express: asigna un `req.id` (UUID) por petición para correlación
 * entre logs. Si el cliente envía un `X-Request-Id` válido, se reutiliza;
 * si no (o viene vacío / demasiado largo), se genera uno nuevo. Lo devuelve en
 * el header `X-Request-Id` de la respuesta para que el cliente pueda reportarlo.
 *
 * Uso: app.use(requestIdMiddleware) — una sola vez, antes de las rutas.
 */
export function requestIdMiddleware(req, res, next) {
  const incoming = req.headers['x-request-id'];
  req.id = (typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 64)
    ? incoming
    : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
