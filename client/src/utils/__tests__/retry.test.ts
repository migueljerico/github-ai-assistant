import { describe, it, expect, afterEach } from 'vitest';
import { isContextTooLargeError, isProviderOverloadedError, isTransientError, isAbortError, withTransientRetry, combineSignals, isTimeoutAbortError, DEFAULT_AI_TIMEOUT_MS } from '../retry';

describe('retry (#40 / #50)', () => {
  describe('isAbortError', () => {
    it('detecta AbortError por nombre', () => {
      expect(isAbortError(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(true);
      expect(isAbortError(new Error('x'))).toBe(false);
    });
  });

  describe('isTransientError', () => {
    it('marca como transitorios los patrones de saturación/red', () => {
      expect(isTransientError(new Error('The model is overloaded'))).toBe(true);
      expect(isTransientError(new Error('high demand'))).toBe(true);
      expect(isTransientError({ status: 503, message: '' })).toBe(true);
    });

    it('no marca como transitorios los errores de cliente o contexto', () => {
      expect(isTransientError(new Error('Unauthorized'))).toBe(false);
      expect(isTransientError({ status: 401, message: '' })).toBe(false);
      // #50: el error de contexto excesivo NO es transitorio (reintentar tal cual no sirve).
      expect(isTransientError(new Error('Request too large'))).toBe(false);
    });
  });

  describe('isContextTooLargeError (#50)', () => {
    it('detecta mensajes de contexto excesivo / TPM', () => {
      expect(isContextTooLargeError(new Error('Request too large for model'))).toBe(true);
      expect(isContextTooLargeError(new Error('Please reduce the length of the messages'))).toBe(true);
      expect(isContextTooLargeError(new Error('exceeded your tokens per minute limit'))).toBe(true);
      expect(isContextTooLargeError(new Error('context length exceeded'))).toBe(true);
      expect(isContextTooLargeError(new Error('rate limit exceeded'))).toBe(false);
    });

    it('detecta status 413 Payload Too Large', () => {
      expect(isContextTooLargeError({ status: 413, message: '' })).toBe(true);
    });

    it('detecta el flag marcador contextTooLarge', () => {
      const e = Object.assign(new Error('algo'), { contextTooLarge: true });
      expect(isContextTooLargeError(e)).toBe(true);
    });

    it('no marca como contexto excesivo los errores de saturación o cliente', () => {
      expect(isContextTooLargeError(new Error('The model is overloaded'))).toBe(false);
      expect(isContextTooLargeError({ status: 503, message: '' })).toBe(false);
      expect(isContextTooLargeError(new Error('Unauthorized'))).toBe(false);
    });
  });

  describe('isProviderOverloadedError', () => {
    it('detecta status 503 y patrones de sobrecarga de servidor', () => {
      expect(isProviderOverloadedError({ status: 503, message: '' })).toBe(true);
      expect(isProviderOverloadedError(new Error('The model is overloaded'))).toBe(true);
      expect(isProviderOverloadedError(new Error('currently experiencing high demand'))).toBe(true);
      expect(isProviderOverloadedError(new Error('service unavailable'))).toBe(true);
    });

    it('devuelve false para errores que no son de sobrecarga', () => {
      expect(isProviderOverloadedError(new Error('Invalid API key'))).toBe(false);
      expect(isProviderOverloadedError({ status: 400, message: '' })).toBe(false);
      expect(isProviderOverloadedError({ status: 413, message: '' })).toBe(false);
    });
  });

  describe('withTransientRetry', () => {
    it('reintenta ante error transitorio y tiene éxito', async () => {
      let calls = 0;
      const fn = async () => {
        calls++;
        if (calls < 2) throw new Error('overloaded');
        return 'ok';
      };
      await expect(withTransientRetry(fn, 2, 1)).resolves.toBe('ok');
      expect(calls).toBe(2);
    });

    it('no reintenta ante error de contexto excesivo (#50)', async () => {
      let calls = 0;
      const fn = async () => {
        calls++;
        throw Object.assign(new Error('Request too large'), { contextTooLarge: true });
      };
      await expect(withTransientRetry(fn, 2, 1)).rejects.toThrow('Request too large');
      expect(calls).toBe(1);
    });

    it('propaga cancelaciones (AbortError) sin reintentar', async () => {
      let calls = 0;
      const fn = async () => {
        calls++;
        throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      };
      await expect(withTransientRetry(fn, 2, 1)).rejects.toThrow('aborted');
      expect(calls).toBe(1);
    });

    it('propaga cancelaciones por timeout (TimeoutError) sin reintentar', async () => {
      let calls = 0;
      const fn = async () => {
        calls++;
        throw Object.assign(new Error('signal timed out'), { name: 'TimeoutError' });
      };
      await expect(withTransientRetry(fn, 2, 1)).rejects.toThrow('signal timed out');
      expect(calls).toBe(1);
    });
  });

  // ── #73: timeout automático en llamadas IA ────────────────────────────────
  describe('combineSignals (#73)', () => {
    it('expone DEFAULT_AI_TIMEOUT_MS = 180s', () => {
      expect(DEFAULT_AI_TIMEOUT_MS).toBe(180_000);
    });

    it('devuelve undefined si no hay signal manual ni timeout', () => {
      expect(combineSignals(undefined, undefined)).toBeUndefined();
      expect(combineSignals(undefined, 0)).toBeUndefined();
      expect(combineSignals(undefined, -5)).toBeUndefined();
    });

    it('devuelve el signal manual tal cual si no hay timeout', () => {
      const ac = new AbortController();
      expect(combineSignals(ac.signal, undefined)).toBe(ac.signal);
    });

    it('crea un signal de timeout puro cuando no hay manual', () => {
      const sig = combineSignals(undefined, 50);
      expect(sig).toBeInstanceOf(AbortSignal);
      expect(sig!.aborted).toBe(false);
    });

    it('combina manual + timeout: aborta al dispararse el timeout', async () => {
      const manual = new AbortController();
      const sig = combineSignals(manual.signal, 50);
      expect(sig!.aborted).toBe(false);
      await new Promise(r => setTimeout(r, 80));
      expect(sig!.aborted).toBe(true);
      // El signal manual NO debe abortarse (el combine puente respeta cada signal).
      expect(manual.signal.aborted).toBe(false);
    });

    it('combina manual + timeout: aborta al dispararse el manual', () => {
      const manual = new AbortController();
      const sig = combineSignals(manual.signal, 5000);
      manual.abort();
      expect(sig!.aborted).toBe(true);
    });
  });

  describe('isTimeoutAbortError (#73)', () => {
    it('detecta DOMException TimeoutError (AbortSignal.timeout)', () => {
      const e = new DOMException('signal timed out', 'TimeoutError');
      expect(isTimeoutAbortError(e)).toBe(true);
    });

    it('detecta error con reason TimeoutError', () => {
      const e = Object.assign(new Error('aborted'), {
        reason: new DOMException('timed out', 'TimeoutError'),
      });
      expect(isTimeoutAbortError(e)).toBe(true);
    });

    it('detecta mensaje con "timed out" / "timeout"', () => {
      expect(isTimeoutAbortError(new Error('The operation timed out'))).toBe(true);
      expect(isTimeoutAbortError(new Error('request timeout'))).toBe(true);
    });

    it('no confunde con un AbortError manual o un error normal', () => {
      expect(isTimeoutAbortError(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBe(false);
      expect(isTimeoutAbortError(new Error('Unauthorized'))).toBe(false);
    });
  });

  // ── #73: polyfills para runtimes sin AbortSignal.timeout/any ───────────────
  // jsdom/Node modernos proveen ambas APIs nativas, así que las ramas polyfill
  // de retry.ts (createTimeoutSignal/combineSignals bridge) nunca se ejecutan en
  // un test normal. Aquí las forzamos eliminando temporalmente los constructores
  // para cubrir esos caminos de fallback.
  describe('polyfills (#73) — runtimes sin AbortSignal.timeout/any', () => {
    const AS = AbortSignal as unknown as {
      timeout?: (ms: number) => AbortSignal;
      any?: (signals: AbortSignal[]) => AbortSignal;
    };
    const nativeTimeout = AS.timeout;
    const nativeAny = AS.any;

    afterEach(() => {
      // Restaura los constructores nativos para no contaminar otros tests.
      AS.timeout = nativeTimeout;
      AS.any = nativeAny;
    });

    it('createTimeoutSignal polyfill: aborta con DOMException TimeoutError al vencerse', async () => {
      // Sin AbortSignal.timeout nativo → polyfill manual (controller + setTimeout).
      AS.timeout = undefined;
      const sig = combineSignals(undefined, 40);
      expect(sig).toBeInstanceOf(AbortSignal);
      expect(sig!.aborted).toBe(false);
      await new Promise(r => setTimeout(r, 70));
      expect(sig!.aborted).toBe(true);
      // El polyfill aborta con DOMException name 'TimeoutError' (razón accionable).
      const reason = (sig as AbortSignal & { reason?: unknown }).reason as DOMException;
      expect(reason).toBeInstanceOf(DOMException);
      expect(reason.name).toBe('TimeoutError');
    });

    it('combineSignals bridge polyfill: aborta al dispararse el timeout', async () => {
      // Sin AbortSignal.any nativo → controller puente que aborta al primer disparo.
      AS.any = undefined;
      const manual = new AbortController();
      const sig = combineSignals(manual.signal, 40);
      expect(sig!.aborted).toBe(false);
      await new Promise(r => setTimeout(r, 70));
      expect(sig!.aborted).toBe(true);
      // El signal manual NO se ve afectado (el puente respeta cada signal).
      expect(manual.signal.aborted).toBe(false);
    });

    it('combineSignals bridge polyfill: aborta al dispararse el manual y propaga su reason', () => {
      AS.any = undefined;
      const manual = new AbortController();
      const sig = combineSignals(manual.signal, 5000);
      manual.abort('usuario detuvo');
      expect(sig!.aborted).toBe(true);
      // El puente propaga la reason del signal que se disparó.
      expect((sig as AbortSignal & { reason?: unknown }).reason).toBe('usuario detuvo');
    });

    it('combineSignals bridge polyfill: el reason del timeout se propaga al puente', async () => {
      AS.any = undefined;
      // createTimeoutSignal polyfill también entra en juego (sin timeout nativo).
      AS.timeout = undefined;
      const manual = new AbortController();
      const sig = combineSignals(manual.signal, 40);
      await new Promise(r => setTimeout(r, 70));
      expect(sig!.aborted).toBe(true);
      const reason = (sig as AbortSignal & { reason?: unknown }).reason as DOMException;
      expect(reason).toBeInstanceOf(DOMException);
      expect(reason.name).toBe('TimeoutError');
    });
  });
});
