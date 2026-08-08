import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseRateLimitHeaders,
  formatRemainingTime,
  createRateLimitCountdown,
  isRateLimitError,
  enhanceErrorWithRateLimit,
} from '../rateLimitHandler';

describe('rateLimitHandler', () => {
  describe('parseRateLimitHeaders', () => {
    it('returns non-rate-limited info if X-RateLimit-Reset header is missing', () => {
      const response = new Response(null, { headers: {} });
      const result = parseRateLimitHeaders(response);
      expect(result).toEqual({
        isRateLimited: false,
        resetTime: 0,
        remainingSeconds: 0,
        message: '',
      });
    });

    it('parses reset time and remaining header when remaining is 0', () => {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const resetTime = nowInSeconds + 120; // 2 minutes in future
      const response = new Response(null, {
        headers: {
          'X-RateLimit-Reset': resetTime.toString(),
          'X-RateLimit-Remaining': '0',
        },
      });

      const result = parseRateLimitHeaders(response);
      expect(result.isRateLimited).toBe(true);
      expect(result.resetTime).toBe(resetTime);
      expect(result.remainingSeconds).toBeGreaterThan(0);
      expect(result.message).toContain('Disponible en 2 minutos.');
    });

    it('handles singular minute display and non-zero remaining header', () => {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const resetTime = nowInSeconds + 45; // 45s -> 1 minute
      const response = new Response(null, {
        headers: {
          'X-RateLimit-Reset': resetTime.toString(),
          'X-RateLimit-Remaining': '5',
        },
      });

      const result = parseRateLimitHeaders(response);
      expect(result.isRateLimited).toBe(true);
      expect(result.message).toContain('Intenta de nuevo en 1 minuto.');
    });

    it('defaults remaining to 0 if X-RateLimit-Remaining header is missing', () => {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const resetTime = nowInSeconds + 180;
      const response = new Response(null, {
        headers: {
          'X-RateLimit-Reset': resetTime.toString(),
        },
      });

      const result = parseRateLimitHeaders(response);
      expect(result.isRateLimited).toBe(true);
      expect(result.message).toContain('Disponible en 3 minutos.');
    });
  });

  describe('formatRemainingTime', () => {
    it('returns "Disponible ahora" when seconds <= 0', () => {
      expect(formatRemainingTime(0)).toBe('Disponible ahora');
      expect(formatRemainingTime(-10)).toBe('Disponible ahora');
    });

    it('formats seconds only when minutes is 0', () => {
      expect(formatRemainingTime(45)).toBe('45s');
    });

    it('formats minutes only when secs is 0', () => {
      expect(formatRemainingTime(120)).toBe('2m');
    });

    it('formats minutes and seconds when both are non-zero', () => {
      expect(formatRemainingTime(150)).toBe('2m 30s');
    });
  });

  describe('createRateLimitCountdown', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('ticks every second and calls onTick with remaining time', () => {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const resetTime = nowInSeconds + 3;
      const onTick = vi.fn();

      const cleanup = createRateLimitCountdown(resetTime, onTick);

      vi.advanceTimersByTime(1000);
      expect(onTick).toHaveBeenCalledWith(2);

      vi.advanceTimersByTime(1000);
      expect(onTick).toHaveBeenCalledWith(1);

      cleanup();
    });

    it('clears interval automatically when remaining reaches 0', () => {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const resetTime = nowInSeconds + 1;
      const onTick = vi.fn();

      createRateLimitCountdown(resetTime, onTick);

      vi.advanceTimersByTime(1000);
      expect(onTick).toHaveBeenLastCalledWith(0);

      // Advance time further to ensure no more ticks occur
      vi.advanceTimersByTime(2000);
      expect(onTick).toHaveBeenCalledTimes(1);
    });
  });

  describe('isRateLimitError', () => {
    it('returns true for 429 and 403', () => {
      expect(isRateLimitError(429)).toBe(true);
      expect(isRateLimitError(403)).toBe(true);
    });

    it('returns false for other status codes', () => {
      expect(isRateLimitError(200)).toBe(false);
      expect(isRateLimitError(400)).toBe(false);
      expect(isRateLimitError(404)).toBe(false);
      expect(isRateLimitError(500)).toBe(false);
    });
  });

  describe('enhanceErrorWithRateLimit', () => {
    it('returns original error if status is not rate limit error', () => {
      const response = new Response(null, { status: 500 });
      expect(enhanceErrorWithRateLimit(response, 'Internal Server Error')).toBe('Internal Server Error');
    });

    it('returns rate limit message if rate limit headers are present', () => {
      const resetTime = Math.floor(Date.now() / 1000) + 60;
      const response = new Response(null, {
        status: 429,
        headers: {
          'X-RateLimit-Reset': resetTime.toString(),
        },
      });

      const enhanced = enhanceErrorWithRateLimit(response, 'Too Many Requests');
      expect(enhanced).toContain('Rate limit alcanzado');
    });

    it('returns default 429 message if headers missing but status is 429', () => {
      const response = new Response(null, { status: 429 });
      const enhanced = enhanceErrorWithRateLimit(response, 'Too Many Requests');
      expect(enhanced).toBe('⏱️ Rate limit alcanzado. Por favor, intenta de nuevo en unos minutos.');
    });

    it('returns original error if headers missing and status is 403 (non-429)', () => {
      const response = new Response(null, { status: 403 });
      const enhanced = enhanceErrorWithRateLimit(response, 'Forbidden');
      expect(enhanced).toBe('Forbidden');
    });
  });
});
