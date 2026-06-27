// ── retry (#40) ──────────────────────────────────────────────────────────────
// Reintento ante errores TRANSITORIOS con backoff exponencial corto. Lo usan tanto
// las llamadas a la IA (gemini.ts) como las llamadas a la GitHub API (ghFetch):
//   • IA: Gemini 503 "high demand"; OpenRouter free "Provider returned error".
//   • GitHub: 5xx puntuales y fallos de red.
// NUNCA se reintenta un 4xx no recuperable (401/403/404/422) ni una cancelación
// (AbortController). Mantener este módulo sin dependencias y agnóstico del dominio.

const TRANSIENT_STATUS = new Set([500, 502, 503, 504]);
const TRANSIENT_PATTERN =
  /overloaded|high demand|currently experiencing|service unavailable|provider returned error|temporarily|try again|failed to fetch|network|timeout|econnreset/i;

/** ¿El error viene de cancelar la petición (AbortController)? Nunca se reintenta. */
export function isAbortError(err: unknown): boolean {
  return (err as { name?: string })?.name === 'AbortError';
}

/** ¿El error es transitorio y merece la pena reintentar (5xx, red, patrones conocidos)? */
export function isTransientError(err: unknown): boolean {
  const e = err as { status?: number; transient?: boolean; message?: string };
  if (e?.transient) return true;
  if (typeof e?.status === 'number' && TRANSIENT_STATUS.has(e.status)) return true;
  return TRANSIENT_PATTERN.test(e?.message ?? '');
}

/**
 * Ejecuta `fn` reintentando ante errores transitorios con backoff exponencial.
 * Por defecto: hasta 2 reintentos (800ms, 1600ms). Los errores no transitorios y
 * las cancelaciones (AbortError) se propagan de inmediato.
 */
export async function withTransientRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  baseDelayMs = 800,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      // Una cancelación (AbortController) NUNCA se reintenta: se propaga al instante.
      if (isAbortError(err)) throw err;
      // En el último intento, o si el error no es transitorio, se propaga.
      if (attempt >= retries || !isTransientError(err)) throw err;
      await new Promise(r => setTimeout(r, baseDelayMs * 2 ** attempt));
    }
  }
}
