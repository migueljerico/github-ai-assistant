// ── retry (#40) ──────────────────────────────────────────────────────────────
// Reintento ante errores TRANSITORIOS con backoff exponencial corto. Lo usan tanto
// las llamadas a la IA (gemini.ts) como las llamadas a la GitHub API (ghFetch):
//   • IA: Gemini 503 "high demand"; OpenRouter free "Provider returned error".
//   • GitHub: 5xx puntuales y fallos de red.
// NUNCA se reintenta un 4xx no recuperable (401/403/404/422) ni una cancelación
// (AbortController). Mantener este módulo sin dependencias y agnóstico del dominio.

const TRANSIENT_STATUS = new Set([500, 502, 503, 504]);
const TRANSIENT_PATTERN =
  /overloaded|high demand|currently experiencing|service unavailable|provider returned error|temporarily|try again|failed to fetch|network|timeout|econnreset|rate limit|429/i;

/** ¿El error viene de cancelar la petición (AbortController)? Nunca se reintenta. */
export function isAbortError(err: unknown): boolean {
  return (err as { name?: string })?.name === 'AbortError';
}

/** ¿El error es transitorio y merece la pena reintentar (5xx, red, patrones conocidos)? */
export function isTransientError(err: unknown): boolean {
  const e = err as { status?: number; transient?: boolean; message?: string; name?: string };
  if (e?.transient) return true;
  // 429 de GitHub se maneja en ghFetch con headers de rate-limit; no reintentar aquí.
  if (typeof e?.status === 'number' && e.status === 429 && e.name === 'GitHubAPIError') return false;
  if (typeof e?.status === 'number' && TRANSIENT_STATUS.has(e.status)) return true;
  return TRANSIENT_PATTERN.test(e?.message ?? '');
}

// ── #50: contexto excesivo (TPM / context length) ────────────────────────────
// Distinto de un error transitorio: reintentar tal cual no sirve (el prompt es
// igual de grande). En runSend se reintenta SOLO tras reducir el contexto.
// Patrones cubiertos: "Request too large" (Groq), "Please reduce the length of
// the messages", "tokens per minute" (TPM), "context length"/"maximum context
// tokens", 413 Payload Too Large.
const CONTEXT_TOO_LARGE_PATTERN =
  /too large|reduce the length|tokens per minute|context length|maximum.{0,12}tokens|payload too|rate limit/i;

/** ¿El error indica que el contexto supera el límite (TPM/context length)? */
export function isContextTooLargeError(err: unknown): boolean {
  const e = err as { status?: number; contextTooLarge?: boolean; message?: string };
  if (e?.contextTooLarge) return true;
  if (e?.status === 413) return true;
  return CONTEXT_TOO_LARGE_PATTERN.test(e?.message ?? '');
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
