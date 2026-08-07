import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logEvent, log, requestIdMiddleware } from '../logger.js';

// ─── logEvent / log ────────────────────────────────────────────────────────────
// Espiamos process.stdout/stderr.write para capturar las líneas emitidas sin
// arrancar Express ni .env. logger.js es un módulo puro, así que se puede
// testear de forma aislada (mismo patrón que geminiModelsProxy.test.js).
describe('logger — logEvent / log', () => {
  let stdoutSpy, stderrSpy;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });
  afterEach(() => { vi.restoreAllMocks(); });

  const lastWritten = (spy) => {
    const calls = spy.mock.calls;
    const line = calls[calls.length - 1]?.[0];
    return line ? JSON.parse(line) : null;
  };

  it('emite una línea JSON parseable con ts, level y msg', () => {
    logEvent('info', 'upstream', {});
    const entry = lastWritten(stdoutSpy);
    expect(entry).not.toBeNull();
    expect(entry.level).toBe('info');
    expect(entry.msg).toBe('upstream');
    // ISO 8601, parseable como fecha válida
    expect(new Date(entry.ts).toString()).not.toBe('Invalid Date');
  });

  it('mergea los campos de ctx dentro del objeto', () => {
    logEvent('info', 'upstream', { provider: 'nim', status: 200, requestId: 'abc-123' });
    const entry = lastWritten(stdoutSpy);
    expect(entry.provider).toBe('nim');
    expect(entry.status).toBe(200);
    expect(entry.requestId).toBe('abc-123');
  });

  it('escribe a stderr cuando level es "error" y a stdout en el resto', () => {
    logEvent('error', 'fatal', { reason: 'boom' });
    expect(stderrSpy).toHaveBeenCalled();
    expect(stdoutSpy).not.toHaveBeenCalled();

    stderrSpy.mockClear();
    stdoutSpy.mockClear();

    logEvent('warn', 'slow', {});
    expect(stdoutSpy).toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('cae a "info" ante un nivel inválido', () => {
    logEvent('catastrophe', 'x', {});
    const entry = lastWritten(stdoutSpy);
    expect(entry.level).toBe('info');
  });

  it('cada llamada emite exactamente una línea terminada en \\n', () => {
    logEvent('info', 'a', {});
    logEvent('info', 'b', {});
    expect(stdoutSpy.mock.calls.length).toBe(2);
    expect(stdoutSpy.mock.calls[0][0].endsWith('\n')).toBe(true);
    expect(stdoutSpy.mock.calls[1][0].endsWith('\n')).toBe(true);
  });

  it('log.info/warn/error/debug delegan en logEvent con el nivel correcto', () => {
    log.debug('d', {});
    log.info('i', {});
    log.warn('w', {});
    expect(lastWritten(stdoutSpy).level).toBe('warn');

    log.error('e', { flow: 'chat' });
    const errEntry = lastWritten(stderrSpy);
    expect(errEntry.level).toBe('error');
    expect(errEntry.flow).toBe('chat');
  });

  it('no incluye campos fuera de ctx más allá de ts/level/msg', () => {
    logEvent('info', 'upstream', { provider: 'gemini' });
    const entry = lastWritten(stdoutSpy);
    expect(Object.keys(entry).sort()).toEqual(['level', 'msg', 'provider', 'ts']);
  });
});

// ─── requestIdMiddleware ──────────────────────────────────────────────────────
describe('logger — requestIdMiddleware', () => {
  const mkRes = () => ({
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
  });

  it('genera un req.id UUID y lo devuelve en X-Request-Id', () => {
    const req = { headers: {} };
    const res = mkRes();
    let nextCalled = false;
    requestIdMiddleware(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(req.id).toEqual(expect.any(String));
    // UUID v4 canónico: 8-4-4-4-12
    expect(req.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(res.headers['X-Request-Id']).toBe(req.id);
  });

  it('respeta un X-Request-Id entrante válido', () => {
    const incoming = 'client-trace-abc-123';
    const req = { headers: { 'x-request-id': incoming } };
    const res = mkRes();
    requestIdMiddleware(req, res, () => {});
    expect(req.id).toBe(incoming);
    expect(res.headers['X-Request-Id']).toBe(incoming);
  });

  it('ignora un X-Request-Id vacío y genera uno nuevo', () => {
    const req = { headers: { 'x-request-id': '' } };
    const res = mkRes();
    requestIdMiddleware(req, res, () => {});
    expect(req.id).toEqual(expect.any(String));
    expect(req.id).not.toBe('');
    expect(req.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}/i);
  });

  it('ignora un X-Request-Id demasiado largo (>64) y genera uno nuevo', () => {
    const tooLong = 'x'.repeat(200);
    const req = { headers: { 'x-request-id': tooLong } };
    const res = mkRes();
    requestIdMiddleware(req, res, () => {});
    expect(req.id).not.toBe(tooLong);
    expect(req.id.length).toBeLessThanOrEqual(64);
  });
});
