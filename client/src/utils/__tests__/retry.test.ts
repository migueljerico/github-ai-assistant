import { describe, it, expect } from 'vitest';
import { isContextTooLargeError, isTransientError, isAbortError, withTransientRetry } from '../retry';

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
      expect(isContextTooLargeError(new Error('rate limit exceeded'))).toBe(true);
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
  });
});
