// ── retry (#40) ──────────────────────────────────────────────────────────────
// Reintento ante errores TRANSITORIOS con backoff exponencial corto. Lo usan tanto
// las llamadas a la IA (gemini.ts) como las llamadas a la GitHub API (ghFetch):
//   • IA: Gemini 503 "high demand"; OpenRouter free "Provider returned error".
//   • GitHub: 5xx puntuales y fallos de red.
// NUNCA se reintenta un 4xx no recuperable (401/403/404/422) ni una cancelación
// (AbortController). Mantener este módulo sin dependencias y agnóstico del dominio.

const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);
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

// ── #73: timeout automático en llamadas IA ────────────────────────────────────
// Si un proveedor cuelga, el spinner giraba indefinidamente: solo existía la
// cancelación MANUAL (botón "Detener"). Ahora abortamos también por TIEMPOPO.
//
// Valor por defecto de 120s: cubre los casos legítimamente largos que ve la app
//   • Modelos de razonamiento (p. ej. Ai& a 8192 tokens) que pueden tardar >30s.
//   • Generación de documentos (README + MANUAL_TECNICO, maxTokens 8192).
// 120s es un equilibrio: si a los 2 min no hay respuesta, asumimos cuelgue.
//
// Mecanismo: combinamos el signal MANUAL del usuario con un signal de TIMEOUT.
// AbortSignal.any([...]) aborta si cualquiera de los dos se dispara. La lógica de
// handling ya existe (runSend/SecurityAudit muestran "⏹️ detenido" y conservan el
// texto parcial); un timeout simplemente dispara ese mismo camino de abort, que
// withTransientRetry ya propaga sin reintentar (líneas de arriba).
export const DEFAULT_AI_TIMEOUT_MS = 120_000;

/** ¿El error viene de agotarse el timeout (AbortSignal.timeout)? Úsalo junto a
 *  isAbortError para distinguir "detenido a mano" de "cancelado por timeout". */
export function isTimeoutAbortError(err: unknown): boolean {
  // AbortSignal.timeout rechaza con DOMException name 'TimeoutError' (web) o
  // Error name 'AbortError' en algunos runtimes; el reason suele incluir "timed out".
  const name = (err as { name?: string })?.name;
  if (name === 'TimeoutError') return true;
  const reason = (err as { reason?: unknown })?.reason;
  const reasonName = (reason as { name?: string })?.name;
  if (reasonName === 'TimeoutError') return true;
  const msg = (err as { message?: string })?.message ?? '';
  return /timed out|timeout/i.test(msg);
}

/** Crea un AbortSignal que se aborta tras `timeoutMs` ms. Polyfill para runtimes
 *  sin AbortSignal.timeout (jsdom antiguo); prioriza el nativo cuando existe. */
function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const timeoutCtor = (AbortSignal as unknown as {
    timeout?: (ms: number) => AbortSignal;
  }).timeout;
  if (typeof timeoutCtor === 'function') return timeoutCtor.call(AbortSignal, timeoutMs);
  // Polyfill: controller manual abortado por setTimeout.
  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException('signal timed out', 'TimeoutError')), timeoutMs);
  return controller.signal;
}

/**
 * Combina el signal MANUAL del usuario (botón Detener) con uno de TIMEOUT (#73).
 * - Sin manual ni timeout → undefined (comportamiento histórico).
 * - Solo manual → el manual tal cual.
 * - Con timeout → AbortSignal.any([manual?, timeout]) si está disponible, o un
 *   controller puente que aborta cuando cualquiera se dispara (polyfill).
 * El timeout nunca aplica a llamadas que pasen timeoutMs explícito <= 0.
 */
export function combineSignals(
  manual?: AbortSignal,
  timeoutMs?: number,
): AbortSignal | undefined {
  const hasTimeout = typeof timeoutMs === 'number' && timeoutMs > 0;
  if (!manual && !hasTimeout) return undefined;
  if (hasTimeout && !manual) return createTimeoutSignal(timeoutMs!);
  if (!hasTimeout && manual) return manual;
  // Ambos: usar AbortSignal.any si existe (Chromium ≥116, Node 20+).
  const anyCtor = (AbortSignal as unknown as {
    any?: (signals: AbortSignal[]) => AbortSignal;
  }).any;
  if (typeof anyCtor === 'function') {
    return anyCtor.call(AbortSignal, [manual!, createTimeoutSignal(timeoutMs!)]);
  }
  // Polyfill: controller puente que aborta al primer disparo de cualquiera.
  const bridge = new AbortController();
  const abort = (reason?: unknown) => bridge.abort(reason);
  manual!.addEventListener('abort', () => abort((manual as AbortSignal & { reason?: unknown }).reason));
  const timeoutSignal = createTimeoutSignal(timeoutMs!);
  timeoutSignal.addEventListener('abort', () => abort((timeoutSignal as AbortSignal & { reason?: unknown }).reason));
  return bridge.signal;
}
