// ─────────────────────────────────────────────────────────────────────────────
// Unified AI client — supports Google Gemini and Groq Cloud
//
// ARCHITECTURE NOTE (v2.2 - Opción D):
// Gemini calls are now proxied through the Express backend (/api/gemini).
// This is required because the Gemini API blocks direct browser requests from
// EU regions (EEA). The server is deployed in us-central1 (Cloud Run) where
// the API is fully accessible. The user's API key is sent in the HTTPS request
// body and is never stored on the server.
//
// Groq calls continue to go directly from the browser — no EU restriction applies.
//
// ZERO-STORAGE ARCHITECTURE (v2.1.0+):
// API keys live ONLY in React state (AIProviderContext), NEVER in sessionStorage.
// They are read from the context via useAIProvider() hook.
//
// Provider routing:
//   useAIProvider().provider === 'gemini'  →  POST /api/gemini (server proxy)
//   useAIProvider().provider === 'groq'    →  fetch() to Groq OpenAI endpoint
//
// OPCIÓN D - Modo dual:
//   callAI ahora acepta un tercer parámetro opcional 'mode':
//   - 'chat': Modo conversacional (consultor experto)
//   - 'action': Modo acción (agente GitHub)
//   - undefined: Usa SYSTEM_PROMPT por defecto (retrocompatible)
// ─────────────────────────────────────────────────────────────────────────────

import type { GeminiAction } from '../types';
import type { Language } from '../context/LanguageContext';
import { getProvider, modelLabel, resolveEndpoint, type AIProviderType } from './providers';
import { withTransientRetry, isAbortError, isTransientError, combineSignals, DEFAULT_AI_TIMEOUT_MS } from '../utils/retry';
// #23: los system prompts viven en archivos `.md` (mantenibilidad + base para i18n).
// Se cargan como texto crudo con el import `?raw` de Vite. `.trimEnd()` evita que un
// salto de línea final del archivo cambie el prompt respecto al literal original.
import actionSystemPrompt from '../prompts/action-system.md?raw';
import chatPromptText from '../prompts/chat.md?raw';
// #52: prompt dedicado del Modo Auditoría de Seguridad.
import securityAuditPromptText from '../prompts/security-audit.md?raw';

// ── System prompts (Opción D - Tres modos) ────────────────────────────────────

// Prompt por defecto (retrocompatible - modo acción)
export const SYSTEM_PROMPT = actionSystemPrompt.trimEnd();

// ── CHAT PROMPT (Opción D - Modo conversacional) ──────────────────────────────
export const CHAT_PROMPT = chatPromptText.trimEnd();

// ── ACTION PROMPT (Opción D - Modo acción explícito) ──────────────────────────
export const ACTION_PROMPT = SYSTEM_PROMPT;

// ── SECURITY AUDIT PROMPT (#52 - Modo Auditoría de Seguridad) ─────────────────
// Lectura-only: no genera JSON de acción. El disclaimer "filtro orientativo, no
// escáner formal" vive dentro del propio prompt.
export const SECURITY_PROMPT = securityAuditPromptText.trimEnd();

/**
 * Añade al system prompt una directiva explícita de idioma (#24 Fase 3, v3.22.0),
 * para que las respuestas del modelo respeten el idioma activo de la interfaz.
 * El prompt base (chat/action) se mantiene en español; la directiva fuerza la
 * respuesta en el idioma elegido.
 */
export function withLangDirective(prompt: string, lang: Language): string {
  const directive = lang === 'en'
    ? '\n\nIMPORTANT: Respond to the user in English.'
    : '\n\nIMPORTANTE: Responde al usuario en español.';
  return prompt + directive;
} // Alias para claridad

// ── #20: Truncado por LÍNEAS (no por caracteres) ──────────────────────────────
/**
 * Trunca el contenido a las primeras `maxLines` líneas, preservando el inicio del
 * archivo (imports y firmas de funciones) y añadiendo una nota de cuántas líneas se
 * omitieron. Cortar por caracteres parte funciones a la mitad y deja código sin
 * sentido para el modelo (#20); cortar por líneas mantiene unidades completas.
 * Función pura (testeable).
 */
export function truncateByLines(content: string, maxLines: number): string {
  if (content.trimStart().startsWith('data:')) {
    return '[ARCHIVO BINARIO O BASE64 ADJUNTO - NO SE MUESTRA CONTENIDO EN EL PROMPT]';
  }
  const lines = content.split('\n');
  if (lines.length <= maxLines) return content;
  const shown = lines.slice(0, maxLines).join('\n');
  return `${shown}\n[... ${lines.length - maxLines} líneas más ...]`;
}

// ── #41: Contexto de repo para opiniones de chat fundamentadas ────────────────
/**
 * Construye un resumen compacto del repositorio para fundamentar las opiniones
 * del modo chat: árbol completo + los primeros `maxFiles` archivos (ya vienen
 * priorizados desde fetchRepoTreeRecursive) truncados a `maxLinesPerFile` líneas,
 * para no inflar el presupuesto de tokens.
 */
export function buildRepoContextSummary(
  repoName: string,
  files: Array<{ path: string; content?: string }>,
  opts: { maxFiles?: number; maxLinesPerFile?: number; allPaths?: string[] } = {},
): string {
  const maxFiles = opts.maxFiles ?? 12;
  const maxLines = opts.maxLinesPerFile ?? 80;

  // #49: la ESTRUCTURA muestra el árbol COMPLETO del repo (`allPaths`) si se pasa, no
  // solo los archivos cuyo contenido se incluye. Así el modelo conoce TODOS los archivos
  // y no niega que existan. El CONTENIDO son los `files` (ya seleccionados por relevancia).
  const treePaths = opts.allPaths && opts.allPaths.length ? opts.allPaths : files.map(f => f.path);
  const tree = treePaths.join('\n');
  const bodies = files
    .filter(f => f.content)
    .slice(0, maxFiles)
    .map(f => `### ${f.path}\n\`\`\`\n${truncateByLines(f.content || '', maxLines)}\n\`\`\``)
    .join('\n\n');

  return `Repositorio: ${repoName}\nArchivos en el repo: ${treePaths.length}\n\n` +
    `ESTRUCTURA DEL PROYECTO (todos los archivos):\n\`\`\`\n${tree}\n\`\`\`\n\n` +
    `CONTENIDO DE LOS ARCHIVOS MÁS RELEVANTES A LA PREGUNTA:\n\n${bodies}`;
}

// ── #52: contexto específico para el Modo Auditoría de Seguridad ──────────────
/**
 * Empaqueta los ARCHIVOS SENSIBLES (manifests, lockfiles, workflows, Dockerfile,
 * plantilla .env) como contexto para el audit prompt. Estos archivos no siempre
 * entran en el resumen general de `buildRepoContextSummary` (p. ej.
 * `package-lock.json` queda fuera por el filtro `.lock` + 50KB, y los workflows
 * pueden caer del cap de 120), así que el runner los carga por path conocido y
 * los pasa por aquí. Función pura (testeable).
 *
 * @param repoName - "owner/repo"
 * @param sensitiveFiles - { path, content } de los archivos sensibles encontrados
 * @param opts.maxLinesPerFile - tope de líneas por archivo (default 120, más
 *   generoso que el chat porque un Dockerfile o workflow corto interesa entero).
 */
export function buildSecurityAuditContext(
  repoName: string,
  sensitiveFiles: Array<{ path: string; content?: string }>,
  opts: { maxLinesPerFile?: number } = {},
): string {
  const maxLinesPerFile = opts.maxLinesPerFile ?? 120;
  const bodies = sensitiveFiles
    .filter(f => f.content && f.content.trim())
    .map(f => `### ${f.path}\n\`\`\`\n${truncateByLines(f.content || '', maxLinesPerFile)}\n\`\`\``)
    .join('\n\n');

  if (!bodies) {
    return `Repositorio: ${repoName}\n\nNo se encontraron archivos sensibles típicos (manifests, lockfiles, Dockerfile, workflows, .env.example) accesibles. Trabaja con la estructura general y recomienda al usuario que te comparta manualmente package.json, Dockerfile o workflows si quiere un análisis más profundo.`;
  }

  return `Repositorio: ${repoName}\n\n` +
    `ARCHIVOS SENSIBLES CARGADOS PARA LA AUDITORÍA:\n\n${bodies}`;
}

/**
 * Devuelve el CHAT_PROMPT reforzado con el contexto real del repositorio (#41),
 * para que las opiniones sean específicas y no genéricas/plantilla.
 */
export function chatPromptWithContext(contextSummary: string): string {
  return `${CHAT_PROMPT}

═══════════════════════════════════════════════════════
CONTEXTO REAL DEL REPOSITORIO DEL USUARIO
═══════════════════════════════════════════════════════
Tienes acceso al código y la estructura REALES de su repositorio. Reglas:
- BASA tu opinión en este contexto: cita archivos, funciones y decisiones concretas.
- NO des consejos genéricos de plantilla ni asumas carencias que el contexto
  desmiente (si hay tests, documentación, CI/CD, medidas de seguridad, etc.,
  reconócelo explícitamente).
- La sección ESTRUCTURA lista TODOS los archivos del repositorio. Si te preguntan por un
  archivo que SÍ está en ESTRUCTURA pero cuyo CONTENIDO no se incluye aquí, NO niegues que
  exista: di que está en el repo pero que no tienes su contenido cargado ahora mismo, y
  ofrece analizarlo (el usuario puede preguntarte específicamente por él).
- Si algo no aparece NI en la estructura ni en el contenido, dilo en lugar de inventarlo.

${contextSummary}`;
}

// ── Message type ──────────────────────────────────────────────────────────────
export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// ── Reintento ante errores transitorios (#40) ─────────────────────────────────
// La lógica de reintento vive ahora en `utils/retry.ts` (genérica, compartida con
// las llamadas a GitHub). Se importa arriba para uso interno (callAI) y se re-exporta
// aquí para no romper imports/tests previos. `isTransientAIError` = alias histórico.
export { withTransientRetry, isAbortError };
export { isTransientError as isTransientAIError };

// ── Types for repo documentation generation (exportados para tests) ───────────
export type RepoFile = { path: string; content?: string };
export type GeneratedDocs = {
  readme: string;
  manualTecnico: string;
  resumen?: string;
  metadatos?: Record<string, unknown>;
};

// ── AI Provider Config (Zero-Storage) ─────────────────────────────────────────
export interface AIProviderConfig {
  provider: AIProviderType;
  apiKey: string;
  model: string;
  /** Solo Cloudflare Workers AI: account_id necesario en la ruta URL del endpoint. */
  accountId?: string | null;
  /** #73: timeout de la llamada IA en ms (null/undefined = default 180s). */
  timeoutMs?: number | null;
}

// ── Streaming (SSE) — helper compartido (#38) ─────────────────────────────────
/**
 * Lee un cuerpo `text/event-stream` y llama `onChunk` con el payload de cada
 * línea `data:` (ignora `[DONE]` y los keep-alive vacíos). Soporta tanto el SSE
 * de los proveedores OpenAI-compatibles como el de nuestro proxy de Gemini.
 */
async function readSSEStream(res: Response, onChunk: (json: string) => void): Promise<void> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const flushLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const payload = trimmed.slice(5).trim();
    if (payload && payload !== '[DONE]') onChunk(payload);
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) flushLine(line);
  }
  flushLine(buffer);
}

// ── OpenAI-compatible implementation (Groq, OpenRouter, …) ────────────────────
/**
 * Cliente para cualquier API compatible con OpenAI Chat Completions (Groq,
 * OpenRouter, etc.). Mismo cuerpo y misma forma de respuesta para todos; solo
 * cambian el `endpoint` y, opcionalmente, headers extra (p.ej. el `X-Title` de
 * OpenRouter).
 *
 * Si se pasa `onToken`, se solicita `stream: true` y se entrega el texto
 * **acumulado** en cada fragmento (semántica "set": segura ante reintentos).
 */
async function callOpenAICompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: Message[],
  systemPrompt: string,
  mode?: 'chat' | 'action',  // ← OPCIÓN D: ajusta la temperatura según el modo
  extraHeaders?: Record<string, string>,
  onToken?: (textSoFar: string) => void,  // ← #38: streaming opcional
  signal?: AbortSignal,  // ← #40: permite cancelar la petición (botón Detener)
  maxTokens?: number,  // ← v3.31.0: límite de salida (4096 por defecto; docs usa 8192)
  accountId?: string | null,  // ← v3.33.1: Cloudflare — se envía como header X-Account-Id al proxy
): Promise<string> {
  // Modo chat necesita más creatividad (0.7); modo acción debe ser determinista
  // para producir JSON estable (0.1). Por defecto se mantiene el comportamiento
  // determinista previo.
  const temperature = mode === 'chat' ? 0.7 : 0.1;
  const stream = Boolean(onToken);

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    ],
    temperature,
    max_tokens: maxTokens ?? 4096,
    ...(stream ? { stream: true } : {}),
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
      ...(accountId ? { 'X-Account-Id': accountId } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    const rawError = err?.error;
    const msg = typeof rawError === 'string'
      ? rawError
      : (rawError as Record<string, unknown>)?.message as string | undefined
        || (err?.message as string | undefined)
        || (err?.detail as string | undefined)
        || (Array.isArray(err?.errors) && typeof (err.errors[0] as Record<string, unknown>)?.message === 'string'
            ? (err.errors[0] as Record<string, unknown>).message as string
            : undefined);
    // #50: distinguir el error de contexto excesivo (TPM/context length) del de
    // saturación del tier. El primero se marca con `contextTooLarge` para que runSend
    // pueda reintentar con menos contexto y mostrar un mensaje accionable; el segundo
    // mantiene el hint de "prueba otro modelo".
    const base = msg || `AI provider error ${res.status}`;
    const isTooLarge = typeof msg === 'string' && /too large|reduce the length|tokens per minute|context length|context window|maximum.{0,12}tokens|payload too|input length|exceeds max|exceeds the max|too long|out of range|token limit/i.test(msg);
    if (isTooLarge || res.status === 413) {
      throw Object.assign(new Error(base), { status: res.status, contextTooLarge: true });
    }
    // Cloudflare 403/429: mensaje accionable con modelos aptos para el plan Free.
    if ((res.status === 403 || res.status === 429) && endpoint.includes('/api/cloudflare')) {
      const hint = ' — Modelo no disponible en tu cuenta Cloudflare (cuota agotada o requiere plan Paid). Prueba con Qwen3 30B o Llama 3.1 8B en el selector.';
      throw Object.assign(new Error(base + hint), { status: res.status });
    }
    // BazaarLink 429: mensaje accionable.
    if ((res.status === 403 || res.status === 429) && endpoint.includes('/api/bazaarlink')) {
      const hint = ' — Demasiadas peticiones o límite alcanzado en BazaarLink (429). Espera un minuto o cambia a otro modelo/proveedor en ⚙️.';
      throw Object.assign(new Error(base + hint), { status: res.status });
    }
    // QwenCloud 403/401: error de permisos/activación en consola DashScope.
    if ((res.status === 403 || res.status === 401) && endpoint.includes('/api/qwencloud')) {
      const isUnpurchased = typeof msg === 'string' && /unpurchased|access.{0,12}denied|eligible|free tier|quota|not active/i.test(msg);
      const hint = isUnpurchased
        ? ' — El modelo requiere activación previa en tu consola de QwenCloud / Alibaba Cloud Model Studio (activa la prueba gratuita o paquete de tokens en la consola).'
        : ' — Error de autenticación o permisos en QwenCloud (403/401). Verifica tu API key en qwencloud.com / DashScope.';
      throw Object.assign(new Error((msg || base) + hint), { status: res.status });
    }
    // Genérico 429 para cualquier otro proveedor (ej. Zenmux, Groq, OpenRouter)
    if (res.status === 429) {
      const hint = ' — Demasiadas peticiones o límite de cuota alcanzado (429). Los modelos gratuitos tienen límites estrictos de peticiones por minuto. Espera un momento o cambia de proveedor.';
      throw Object.assign(new Error(base + hint), { status: res.status });
    }
    if (res.status === 401) {
      throw Object.assign(new Error(base), { status: 401 });
    }
    const hint = ' — el modelo no está disponible ahora mismo (saturación del tier gratuito). Prueba otro modelo (p. ej. Gemma) o cambia a Gemini/Groq.';
    throw Object.assign(new Error(base + hint), { status: res.status });
  }

  // Mensaje de error reutilizado cuando el modelo no devuelve contenido.
  const emptyError = 'El modelo no devolvió contenido. Prueba con otro modelo del desplegable ' +
    '(p.ej. Gemma o Llama 3.3 70B free) o con un repositorio más pequeño.';

  if (stream && res.body) {
    let acc = '';
    await readSSEStream(res, (json) => {
      try {
        const parsed = JSON.parse(json) as { choices?: Array<{ delta?: { content?: string } }> };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) { acc += delta; onToken!(acc); }
      } catch { /* línea no-JSON (keep-alive): se ignora */ }
    });
    if (!acc.trim()) throw new Error(emptyError);
    return acc;
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content || !content.trim()) {
    // Algunos modelos gratuitos devuelven contenido vacío (o sin choices) ante
    // prompts grandes; damos un error claro y accionable en vez de una burbuja
    // vacía. No se marca como transitorio (suele ser determinista del modelo).
    throw new Error(emptyError);
  }
  return content;
}

// ── Gemini implementation (proxied through server) ────────────────────────────
// 🔥 OPCIÓN D: Ahora acepta 'mode' opcional y lo envía al backend
async function callGeminiDirect(
  apiKey: string,
  model: string,
  messages: Message[],
  systemPrompt: string,
  mode?: 'chat' | 'action',  // ← NUEVO: modo opcional
  onToken?: (textSoFar: string) => void,  // ← #38: streaming opcional (vía proxy SSE)
  signal?: AbortSignal,  // ← #40: permite cancelar la petición (botón Detener)
  maxTokens?: number,  // ← v3.31.0: límite de salida (docs usa 8192)
): Promise<string> {
  const stream = Boolean(onToken);
  const body: Record<string, unknown> = { apiKey, model, messages, systemPrompt };

  // Solo añadir mode si está definido (retrocompatible)
  if (mode) body.mode = mode;
  if (stream) body.stream = true;
  // v3.31.0: límite de salida. El proxy lo traduce a generationConfig.maxOutputTokens.
  if (maxTokens) body.maxOutputTokens = maxTokens;

  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = err?.error as string | undefined;
    throw Object.assign(
      new Error(msg || `Gemini proxy error ${res.status}`),
      { status: res.status },
    );
  }

  if (stream && res.body) {
    let acc = '';
    await readSSEStream(res, (json) => {
      try {
        const parsed = JSON.parse(json) as { text?: string };
        if (parsed.text) { acc += parsed.text; onToken!(acc); }
      } catch { /* línea no-JSON: se ignora */ }
    });
    if (!acc.trim()) {
      throw new Error('El modelo no devolvió contenido. Prueba con otro modelo o vuelve a intentarlo.');
    }
    return acc;
  }

  const data = await res.json() as { text: string };
  // v3.66.0 (Frente B): validación de respuesta vacía que FALTABA en la rama no-
  // streaming (la streaming sí la tenía en l.381-383, y callOpenAICompatible en
  // ambos casos). Antes, un {text:""} del proxy fluía silenciosamente al parser
  // JSON de docs y provocaba el engañoso "no devolvió JSON válido".
  if (!data.text?.trim()) {
    throw new Error('El modelo no devolvió contenido. Prueba con otro modelo o vuelve a intentarlo.');
  }
  return data.text;
}

// ── Unified callAI (Zero-Storage + Opción D) ──────────────────────────────────
// 🔥 ZERO-STORAGE: Recibe provider, apiKey, model del contexto (NO de sessionStorage)
// 🔥 OPCIÓN D: Quinto parámetro 'mode' es opcional (retrocompatible)
export async function callAI(
  messages: Message[],
  systemPrompt: string = SYSTEM_PROMPT,
  provider: AIProviderType,
  apiKey: string,
  model: string,
  mode?: 'chat' | 'action',  // ← NUEVO: modo opcional
  onToken?: (textSoFar: string) => void,  // ← #38: si se pasa, la respuesta llega en streaming
  signal?: AbortSignal,  // ← #40: cancelación de la petición (botón Detener)
  maxTokens?: number,  // ← v3.31.0: límite de salida (docs usa 8192 para no truncar el JSON)
  accountId?: string | null,  // ← Cloudflare: sustituye {account_id} en el endpoint
  timeoutMs?: number | null,  // ← #73: timeout automático (default DEFAULT_AI_TIMEOUT_MS si undefined/null)
): Promise<string> {
  const def = getProvider(provider);
  // v3.38.0: límite de salida efectivo. Resolución por prioridad:
  //   1) maxTokens explícito del llamador (docs usa 8192 para salidas largas).
  //   2) maxOutputTokens del proveedor (p. ej. Ai& → 8192, evita respuestas vacías
  //      en modelos de razonamiento y emptyError falso por truncado del max_tokens).
  //   3) 4096 (default histórico; antes solo se aplicaba en la rama OpenAI-compat,
  //      ahora también en Gemini para coherencia entre transportes).
  const effectiveMaxTokens = maxTokens ?? def.maxOutputTokens ?? 4096;
  // #73: combina el signal MANUAL del usuario con uno de TIMEOUT (180s por defecto).
  // null/undefined → default; <=0 → desactiva el timeout en una llamada concreta.
  const effectiveTimeout = timeoutMs ?? DEFAULT_AI_TIMEOUT_MS;
  const combinedSignal = combineSignals(signal, effectiveTimeout);
  // Reintento ante errores transitorios del servidor (503 "high demand",
  // "Provider returned error"…). La validación de clave llama a las funciones
  // internas directamente, así que no se ve afectada por este reintento.
  // Con streaming, `onToken` recibe el texto ACUMULADO (semántica "set"): si hay
  // reintento, el stream reinicia y sobrescribe la burbuja sin duplicar.
  const chatEndpoint = resolveEndpoint(def.chatEndpoint!, accountId);
  return withTransientRetry(() =>
    def.transport === 'gemini-proxy'
      ? callGeminiDirect(apiKey, model, messages, systemPrompt, mode, onToken, combinedSignal, effectiveMaxTokens)
      : callOpenAICompatible(chatEndpoint, apiKey, model, messages, systemPrompt, mode, def.extraHeaders, onToken, combinedSignal, effectiveMaxTokens, accountId),
  );
}

/** @deprecated Use callAI() directly. */
export const callGemini = callAI;

// ── Key validation ────────────────────────────────────────────────────────────
export async function validateProviderKey(
  provider: AIProviderType,
  apiKey: string,
  model: string,
  accountId?: string | null,
): Promise<{ valid: boolean; error?: string }> {
  const def = getProvider(provider);
  try {
    if (def.transport === 'gemini-proxy') {
      await callGeminiDirect(apiKey, model, [{ role: 'user', content: 'Hi' }], 'Reply with one word.');
    } else {
      const chatEndpoint = resolveEndpoint(def.chatEndpoint!, accountId);
      await callOpenAICompatible(
        chatEndpoint,
        apiKey,
        model,
        [{ role: 'user', content: 'Hi' }],
        'Reply with one word.',
        undefined,
        def.extraHeaders,
        undefined,
        undefined,
        undefined,
        accountId,
      );
    }
    return { valid: true };
  } catch (err) {
    const status = (err as { status?: number }).status;
    const message = (err as Error).message ?? '';
    if (status === 401 || message.includes('401') ||
        message.toLowerCase().includes('api_key_invalid') ||
        message.toLowerCase().includes('invalid_api_key')) {
      return {
        valid: false,
        error: `Clave inválida, compruébala en el panel de ${def.name}`,
      };
    }
    if (status === 429 || message.includes('429')) return { valid: true };
    return { valid: false, error: message || 'Error de conexión con el proveedor de IA' };
  }
}

/**
 * Sanea caracteres de control y saltos de línea crudos dentro de valores string en JSON
 * producidos por modelos como Qwen o DeepSeek al emitir documentos multilínea.
 */
function sanitizeUnescapedStringChars(input: string): string {
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        result += ch;
      } else if (ch === '\\') {
        escaped = true;
        result += ch;
      } else if (ch === '"') {
        inString = false;
        result += ch;
      } else if (ch === '\n') {
        result += '\\n';
      } else if (ch === '\r') {
        result += '\\r';
      } else if (ch === '\t') {
        result += '\\t';
      } else {
        result += ch;
      }
    } else {
      if (ch === '"') {
        inString = true;
      }
      result += ch;
    }
  }
  return result;
}

/**
 * Normaliza un fragmento de texto JSON antes de parsearlo. Algunos modelos devuelven
 * JSON casi válido con defectos muy repetidos; en vez de descartarlo, lo reparo aquí
 * cuando es seguro (no inventa datos):
 *  - comentarios de bloque y línea → eliminados.
 *  - trailing commas (`,}` o `,]`) → eliminadas.
 *  - comillas tipográficas (“ ” ‘ ’) → comillas rectas estándar.
 *  - saltos de línea crudos dentro de strings ("contenidoPropuesto") → escapados a \n.
 * Si el texto no es JSON repairable, se devuelve tal cual y JSON.parse dará el error.
 */
function normalizeJsonText(input: string): string {
  const cleanedComments = input
    // comentarios de bloque y de línea (fuera de strings es seguro enough para LLM output)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    // comillas tipográficas → rectas
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    // trailing commas antes de } o ]
    .replace(/,(\s*[}\]])/g, '$1');

  return sanitizeUnescapedStringChars(cleanedComments);
}

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const ALLOWED_TYPES = new Set(['lectura', 'escritura', 'creacion', 'listado', 'borrado', 'edicion', 'eliminacion', 'consulta', 'configuracion']);

type ValidationResult = { ok: true } | { ok: false; reason: string };

/**
 * Valida la forma de una acción ya parseada (#40). Refuerza la garantía
 * propón→confirma→ejecuta: método y tipo dentro de una allowlist, y el endpoint —si
 * viene— debe ser un path RELATIVO (empieza por `/`, sin `://`) para que nunca apunte
 * a un host externo. Función pura. Devuelve un resultado con `reason` legible para
 * poder mostrar al usuario por qué se rechazó la acción.
 */
function isValidAction(a: Record<string, unknown>): ValidationResult {
  if (!a.tipo || !a.accion || !a.metodo) {
    return { ok: false, reason: 'faltan campos obligatorios (tipo, accion o metodo)' };
  }
  if (typeof a.metodo === 'string') {
    a.metodo = a.metodo.toUpperCase();
  }
  if (typeof a.tipo === 'string') {
    a.tipo = a.tipo.toLowerCase();
  }
  if (typeof a.metodo !== 'string' || !ALLOWED_METHODS.has(a.metodo)) {
    return { ok: false, reason: `método "${a.metodo}" no permitido` };
  }
  if (typeof a.tipo !== 'string' || !ALLOWED_TYPES.has(a.tipo)) {
    return { ok: false, reason: `tipo "${a.tipo}" no reconocido` };
  }
  if (a.endpoint !== undefined && a.endpoint !== null) {
    if (typeof a.endpoint !== 'string') {
      return { ok: false, reason: 'el campo endpoint no es texto' };
    }
    if (a.endpoint.includes('://') || !a.endpoint.startsWith('/')) {
      return { ok: false, reason: `endpoint "${a.endpoint}" debe ser una ruta relativa (empezar por /)` };
    }
  }
  if (a.requiereConfirmacion !== undefined && typeof a.requiereConfirmacion !== 'boolean') {
    return { ok: false, reason: 'requiereConfirmacion debe ser true/false' };
  }
  return { ok: true };
}

/**
 * Resultado del parseo de UNA acción con diagnóstico. Si `action` es null, `error`
 * explica por qué (sintaxis inválida con posición, JSON truncado, o validación de
 * schema fallida con la regla concreta). Pensado para mostrar al usuario un mensaje
 * útil en vez del error genérico de antes.
 */
export type ParseOneResult = { action: GeminiAction } | { action: null; error: string };

function parseOneWithDiagnostic(rawText: string): ParseOneResult {
  const candidates = extractJsonCandidates(rawText);
  let lastSchemaReason: string | null = null;
  for (const candidate of candidates) {
    const normalized = normalizeJsonText(candidate);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(normalized);
    } catch (err) {
      // Detectamos truncamiento: string sin cerrar o objeto sin cerrar en el último
      // candidato balanceado (probablemente el modelo cortó la respuesta por tamaño).
      const msg = (err as Error).message;
      const looksTruncated = /unexpected end|EOF/i.test(msg)
        && (normalized.includes('"contenidoPropuesto"') || normalized.includes('"content"'));
      if (looksTruncated) {
        return { action: null, error: 'la respuesta se cortó (JSON truncado); prueba un contenido más corto o divide en varias acciones' };
      }
      // No es JSON válido; probamos el siguiente candidato pero guardamos el detalle.
      continue;
    }
    const validation = isValidAction(parsed);
    if (validation.ok) return { action: parsed as unknown as GeminiAction };
    lastSchemaReason = validation.reason;
  }
  if (lastSchemaReason) {
    return { action: null, error: lastSchemaReason };
  }
  return { action: null, error: 'no se encontró JSON de acción válido' };
}

export function parseGeminiAction(rawText: string): GeminiAction | null {
  return parseOneWithDiagnostic(rawText).action;
}

/**
 * Igual que parseGeminiAction pero devuelve el diagnóstico para que la UI lo muestre.
 * Es la versión que debería usar runSend para dar feedback al usuario.
 */
export function parseGeminiActionWithReason(rawText: string): ParseOneResult {
  return parseOneWithDiagnostic(rawText);
}

/**
 * #58 (c): extrae TODOS los objetos JSON válidos de la respuesta del modelo.
 * A diferencia de parseGeminiAction (que devuelve solo el primero), este parser
 * busca múltiples acciones cuando el usuario pide varios cambios a la vez.
 * Retrocompatible: si solo hay 1 JSON, devuelve array de 1 elemento.
 *
 * v3.56.0: aplica la misma normalización (comillas tipográficas, trailing commas,
 * comentarios) que el parser singular, para que los JSON malformados comunes se
 * reparen antes de descartarlos.
 */
export function parseGeminiActions(rawText: string): GeminiAction[] {
  const results: GeminiAction[] = [];
  const cleaned = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<reflection>[\s\S]*?<\/reflection>/gi, '')
    .replace(/<details>[\s\S]*?<\/details>/gi, '')
    .trim();
  let searchFrom = 0;
  while (searchFrom < cleaned.length) {
    const start = cleaned.indexOf('{', searchFrom);
    if (start === -1) break;
    const balanced = firstBalancedJsonObjectFrom(cleaned, start);
    if (!balanced) break;
    try {
      const normalized = normalizeJsonText(balanced);
      const parsed = JSON.parse(normalized);
      if (isValidAction(parsed).ok) results.push(parsed as GeminiAction);
    } catch { /* skip malformed */ }
    searchFrom = start + balanced.length;
  }
  return results;
}

/** Busca el primer objeto JSON balanceado desde una posición dada. */
function firstBalancedJsonObjectFrom(text: string, start: number): string | null {
  if (start >= text.length || text[start] !== '{') return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Extrae posibles substrings JSON de la respuesta del modelo, en orden de
 * preferencia: (1) la cadena entera sin fences, (2) bloques ```json ... ``` embebidos,
 * (3) el primer bloque `{...}` balanceado.
 */
function extractJsonCandidates(rawText: string): string[] {
  const candidates: string[] = [];
  // v3.22.3: quitamos los bloques de razonamiento visibles que algunos modelos
  // (Qwen, QwQ, DeepSeek-R1) emiten ANTES del JSON. Si no, firstBalancedJsonObject
  // se queda con el JSON de ejemplo del interior del <think> y descarta el real.
  const cleaned = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<reflection>[\s\S]*?<\/reflection>/gi, '')
    .replace(/<details>[\s\S]*?<\/details>/gi, '')
    .trim();

  // (1) cadena entera sin fences ```json ... ```
  const stripped = cleaned
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  candidates.push(stripped);

  // (2) extraer el contenido de cualquier bloque ```json ... ``` embebido en prosa (p. ej. Qwen 3.8 Max)
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(cleaned)) !== null) {
    const fenceContent = match[1].trim();
    if (fenceContent && !candidates.includes(fenceContent)) {
      candidates.push(fenceContent);
    }
  }

  // (3) primer {...} balanceado (ignora strings con llaves escapadas)
  const balanced = firstBalancedJsonObject(cleaned);
  if (balanced && !candidates.includes(balanced)) candidates.push(balanced);

  return candidates;
}





/** Encuentra el primer objeto JSON balanceado `{...}` dentro de un texto. */
function firstBalancedJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// ── Primary language detector ─────────────────────────────────────────────────
/**
 * Infers the primary programming language of a repo from file extension counts.
 * Used to provide language-specific context to the documentation generator.
 */
export function detectPrimaryLanguage(files: Array<{ path: string }>): string {
  const extMap: Record<string, string> = {
    '.ts': 'TypeScript', '.tsx': 'TypeScript',
    '.js': 'JavaScript', '.jsx': 'JavaScript',
    '.py': 'Python', '.java': 'Java', '.go': 'Go',
    '.rs': 'Rust', '.rb': 'Ruby', '.php': 'PHP',
    '.cs': 'C#', '.cpp': 'C++', '.c': 'C',
    '.swift': 'Swift', '.kt': 'Kotlin',
    '.r': 'R', '.scala': 'Scala',
  };
  const counts: Record<string, number> = {};
  for (const f of files) {
    const ext = '.' + (f.path.split('.').pop() ?? '').toLowerCase();
    if (extMap[ext]) counts[ext] = (counts[ext] ?? 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? extMap[top[0]] : 'múltiple';
}

/**
 * Sanea y elimina cualquier footer o firma previa (bloques `<p align="center">...`
 * o firmas markdown de pie de página) de un documento para evitar duplicaciones.
 */
export function cleanDocFooter(text: string): string {
  if (!text) return '';
  let cleaned = text;

  // Elimina todos los bloques HTML <p align="center">...</p> que contengan firmas de autor/documentación
  const footerHtmlRegex = /<p\s+align=["']center["']\s*>[\s\S]*?(?:Desarrollado|Creado|Created|Documentado|Documented|Asistente\s+de\s+IA|AI\s+Assistant|github\.com)[\s\S]*?<\/p>/gi;
  cleaned = cleaned.replace(footerHtmlRegex, '');

  // Elimina líneas o párrafos finales que contengan firmas residuales
  const lines = cleaned.split('\n');
  while (lines.length > 0) {
    const lastLine = lines[lines.length - 1].trim();
    if (
      !lastLine ||
      /^(?:Desarrollado|Creado|Created|Documentado|Documented)\s+por|by/i.test(lastLine) ||
      (/<p\s+align=["']center["']/i.test(lastLine) && /(?:Desarrollado|Creado|Created|Documentado|Documented|Asistente|AI\s+Assistant|github\.com|ljerico)/i.test(lastLine)) ||
      /ljerico<\/a>/i.test(lastLine)
    ) {
      lines.pop();
    } else {
      break;
    }
  }

  return lines.join('\n').trimEnd();
}

/**
 * Inyecta un bloque de vista previa de imágenes (Markdown/HTML) en una posición
 * idónea dentro de un documento README.md (antes de secciones como Tecnologías,
 * Instalación, Funcionalidades o Estructura).
 */
export function injectImagePreviewBlock(readme: string, previewBlock: string): string {
  if (!readme || !previewBlock) return readme || '';
  const block = previewBlock.startsWith('\n') ? previewBlock : '\n\n' + previewBlock;
  const targetRegex = /(##\s+(?:⚙️|✨|🛠️|📁|🚀|📋)\s+)/i;
  const match = targetRegex.exec(readme);
  if (match) {
    const idx = match.index;
    return readme.slice(0, idx).trimEnd() + block + '\n\n' + readme.slice(idx);
  }
  return readme.trimEnd() + block;
}

/**
 * Genera documentación para un repositorio completo (README.md + MANUAL_TECNICO.md).
 */
export async function generateRepoDocs(
  repoName: string,
  files: Array<{ path: string; content?: string }>,
  config?: AIProviderConfig,
  lang: Language = 'es',
  extraImageFiles?: string[],
): Promise<GeneratedDocs> {
  if (!files || files.length === 0) {
    throw new Error('No hay archivos para analizar en el repositorio.');
  }

  const primaryLanguage = detectPrimaryLanguage(files);
  const docOwner = repoName.includes('/') ? repoName.split('/')[0] : repoName;
  const now = new Date();
  const docYear = now.getFullYear();
  const currentDateStr = now.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { month: 'long', year: 'numeric' });
  const currentIsoDate = now.toISOString().split('T')[0];

  const providerLabel = config ? getProvider(config.provider).name : 'IA';
  const modelLabelVal = config ? modelLabel(config.provider, config.model) : 'IA';
  const docFooter = lang === 'en'
    ? `<p align="center">Created by <a href="https://github.com/${docOwner}">@${docOwner}</a> and documented by ${providerLabel} (${modelLabelVal}) from the AI Assistant App · ${docYear}</p>`
    : `<p align="center">Creado por <a href="https://github.com/${docOwner}">@${docOwner}</a> y documentado por ${providerLabel} (${modelLabelVal}) desde la App Asistente de IA · ${docYear}</p>`;

  const dateDirective = `\n\n═══════════════════════════════════════════════════════\nFECHA Y AÑO ACTUAL EN CURSO (OBLIGATORIO):\n- Año actual: ${docYear}\n- Fecha actual: ${currentDateStr} (${currentIsoDate})\n\nREGLA ESTRICTA DE FECHA/AÑO: Si incluyes alguna fecha, versión o año en el documento (encabezados, badges, notas o pie de página), DEBES usar obligatoriamente la fecha u año actual indicado arriba (${docYear}). NUNCA alucines ni incluyas años o fechas pasadas (como 2025 o anteriores) para la versión o actualización actual. Si el contenido existente contenía "2025" o fechas pasadas en la cabecera/versión/fecha, ACTUALÍZALO obligatoriamente a ${docYear}.\n═══════════════════════════════════════════════════════`;

  const imagesDirective = extraImageFiles && extraImageFiles.length > 0
    ? `\n\n═══════════════════════════════════════════════════════\nCAPTURAS / IMÁGENES ADJUNTAS A SUBIR EN EL REPOSITORIO (OBLIGATORIO INCLUIR EN EL README.md):\nSe están adjuntando y subiendo las siguientes imágenes a la carpeta \`./screenshots/\`:\n${extraImageFiles.map(n => `- ./screenshots/${n}`).join('\n')}\n\nREQUISITO OBLIGATORIO:\nEn el README.md generado, DEBES incluir explícitamente una sección o bloque de vista previa visual (en Descripción, Acceso/Demo o en una sección dedicada 🖼️ Vista previa) que muestre cada una de estas imágenes usando sintaxis Markdown estándar (NUNCA envuelvas en <p align="center"> ni uses anchos fijos como width="750"):\n![Vista previa](./screenshots/${extraImageFiles[0]})\nSi hay múltiples imágenes, incluye la vista previa de cada una.\n═══════════════════════════════════════════════════════`
    : '';

  // Detectar y sanear README y MANUAL existentes para pedir "mejora" en vez de "copia"
  const rawExistingReadme = files.find(f => /^readme(\.|$)/i.test(f.path))?.content;
  const rawExistingManual = files.find(f => /manual[_-]tecnico/i.test(f.path))?.content;

  const existingReadme = rawExistingReadme ? cleanDocFooter(rawExistingReadme) : undefined;
  const existingManual = rawExistingManual ? cleanDocFooter(rawExistingManual) : undefined;

  const treeOverview = files.map(f => f.path).join('\n');
  const fileContents = files
    .filter(f => f.content)
    .map(f => `### ${f.path}\n${truncateByLines(f.content || '', 80)}`)
    .join('\n\n---\n\n');
  const sharedUserContext =
    `Repositorio: ${repoName}\n` +
    `Lenguaje principal detectado: ${primaryLanguage}\n` +
    `Archivos analizados: ${files.length}\n\n` +
    `ESTRUCTURA DEL PROYECTO:\n\`\`\`\n${treeOverview}\n\`\`\`\n\n` +
    `CONTENIDO DE ARCHIVOS CLAVE:\n\n${fileContents}`;

  const readmeExistingDirective = existingReadme
    ? `\n\nCONTENIDO ACTUAL DEL README (debes MEJORARLO y ENRIQUECERLO — REGLA DE ORO DE PRESERVACIÓN: CONSERVA TODAS SUS SECCIONES RICAS PREEXISTENTES. No lo reemplaces por una plantilla simplificada; conserva todos sus badges, tablas de métricas, capturas, modelo de seguridad, comparativas y secciones detalladas, actualizando solo datos obsoletos):\n${existingReadme}`
    : '\n\nEl README NO existe aún — créalo desde cero con contenido profesional.';


  const readmeSystemPrompt = `Eres un experto en documentación técnica de software de nivel profesional.
Tu tarea es analizar el código de un repositorio y generar el contenido del archivo README.md en Markdown plano, completo, detallado y visualmente atractivo. Responde ÚNICAMENTE con el Markdown del README, sin texto introductorio ni bloques de código externos que envuelvan todo.

═══════════════════════════════════════════════════════
REQUISITOS OBLIGATORIOS PARA EL README.md
═══════════════════════════════════════════════════════

1. CABECERA:
   - Título con emoji descriptivo del proyecto
   - Fila de badges shields.io (for-the-badge): lenguaje principal, framework/stack,
     estado (Publicado/En desarrollo), tipo de licencia, CI/E2E/cobertura y proveedores
   - Tagline en cursiva describiendo el proyecto en una frase

2. SECCIONES (en este orden, con emojis en los títulos):
   🔗 Acceso / Demo (si hay URL de despliegue)
   📋 Descripción (2-3 párrafos explicando el propósito, qué problema resuelve y para quién)
   ✨ Funcionalidades (tabla con columna Funcionalidad y columna Descripción)
   ⚙️ Instalación (pasos numerados con bloques de código reales)
   🚀 Uso (ejemplos de uso con código real extraído del proyecto)
   📁 Estructura del proyecto (árbol de carpetas formateado en bloque de código)
   🛠️ Tecnologías (tabla: Herramienta | Versión/Detalle | Uso en el proyecto)
   📚 Contexto formativo o motivación del proyecto (si aplica)

3. CALIDAD Y PRESERVACIÓN NO DESTRUCTIVA:
   - REGLA DE PRESERVACIÓN Y ENRIQUECIMIENTO: Si el README existente ya posee secciones ricas (como métricas del proyecto, seguridad Zero-Storage, comparativas, desarrollo asistido por IA, limitaciones conocidas, contexto educativo, galerías de capturas o grupos extensos de badges), MANTÉN Y AMPLÍA TODAS ESTAS SECCIONES. NUNCA resumas ni elimines contenido rico preexistente.
   - Usa el contenido REAL del código para las explicaciones (nombres de funciones, rutas, comandos)
   - Los bloques de código deben contener comandos reales (npm install, python main.py, etc.)
   - Las tablas deben tener filas con información concreta, no placeholders genéricos
   - Detecta el lenguaje principal y usa badges específicos de ese ecosistema
   - Si el README existente referencia archivos de imagen (*.png, *.jpg, *.gif,
     *.svg, *.webp) que NO aparecen en la estructura del proyecto (ESTRUCTURA DEL
     PROYECTO más arriba), ELIMINA esa referencia de imagen completa. No dejes enlaces a archivos inexistentes.
   - Si el README referencia imágenes, usa la ruta ./screenshots/FILENAME (no la raíz) y sintaxis Markdown ![alt](./screenshots/FILENAME) (NUNCA fijes anchos como width="750" ni envuelvas en <p align="center"> para no distorsionar ni forzar alineado centrado).
${readmeExistingDirective}${dateDirective}${imagesDirective}

═══════════════════════════════════════════════════════
LENGUAJE PRIMARIO DETECTADO: ${primaryLanguage}
REPOSITORIO: ${repoName}
═══════════════════════════════════════════════════════`;

  const manualExistingDirective = existingManual
    ? `\n\nCONTENIDO ACTUAL DEL MANUAL_TECNICO (debes MEJORARLO, no copiarlo ni reemplazarlo ciegamente — mantén su estructura y tono, corrige lo obsoleto y añade/aumenta secciones con información real del código):\n${existingManual}`
    : '\n\nEl MANUAL_TECNICO NO existe aún — créalo desde cero con contenido profesional.';

  const manualSystemPrompt = `Eres un experto en documentación técnica de software de nivel profesional.
Tu tarea es analizar el código de un repositorio y generar el contenido del archivo MANUAL_TECNICO.md en Markdown plano, detallado y riguroso. Responde ÚNICAMENTE con el Markdown del manual, sin texto introductorio ni bloques de código externos que envuelvan todo.

═══════════════════════════════════════════════════════
REQUISITOS OBLIGATORIOS PARA EL MANUAL_TECNICO.md
═══════════════════════════════════════════════════════

1. Arquitectura general con diagrama ASCII de capas o flujo:
   └── Capa de presentación → Capa de lógica → Capa de datos/API

2. Descripción de cada módulo o componente principal:
   Para cada archivo/carpeta relevante: nombre, responsabilidad, funciones exportadas clave

3. APIs y endpoints documentados (si aplica):
   Tabla: Método | Ruta | Descripción | Parámetros

4. Variables de entorno:
   Tabla: Variable | Valor de ejemplo | Obligatoria | Descripción

5. Guía de despliegue paso a paso para el stack detectado

6. Limitaciones conocidas y posibles mejoras futuras
${manualExistingDirective}${dateDirective}

═══════════════════════════════════════════════════════
LENGUAJE PRIMARIO DETECTADO: ${primaryLanguage}
REPOSITORIO: ${repoName}
═══════════════════════════════════════════════════════`;

  const provider = config?.provider ?? 'groq';
  const apiKey = config?.apiKey ?? 'test-key';
  const model = config?.model ?? 'test-model';
  const accountId = config?.accountId;
  const timeoutMs = config?.timeoutMs;

  const stripFences = (raw: string): string =>
    raw.replace(/^```(?:markdown)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  const readmeRaw = await callAI(
    [{ role: 'user', content: sharedUserContext }],
    withLangDirective(readmeSystemPrompt, lang),
    provider, apiKey, model,
    undefined, undefined, undefined,
    8192, accountId, timeoutMs,
  );
  let readmeStripped = cleanDocFooter(stripFences(readmeRaw));
  if (!readmeStripped) {
    throw new Error('La IA no devolvió el README. Prueba con otro modelo o vuelve a intentarlo.');
  }

  // Garantizar que las imágenes adjuntas queden referenciadas en el README.md
  if (extraImageFiles && extraImageFiles.length > 0) {
    const missingImages = extraImageFiles.filter(
      img => !readmeStripped.toLowerCase().includes(img.toLowerCase())
    );
    if (missingImages.length > 0) {
      const previewItems = missingImages
        .map(img => `![Vista previa - ${img}](./screenshots/${img})`)
        .join('\n\n');
      const previewBlock = `\n\n### 🖼️ Vista previa\n\n${previewItems}`;
      readmeStripped = injectImagePreviewBlock(readmeStripped, previewBlock);
    }
  }

  const readme = readmeStripped + '\n\n' + docFooter;

  const manualRaw = await callAI(
    [{ role: 'user', content: sharedUserContext }],
    withLangDirective(manualSystemPrompt, lang),
    provider, apiKey, model,
    undefined, undefined, undefined,
    8192, accountId, timeoutMs,
  );
  const manualStripped = cleanDocFooter(stripFences(manualRaw));
  if (!manualStripped) {
    throw new Error('La IA no devolvió el MANUAL_TECNICO. Prueba con otro modelo o vuelve a intentarlo.');
  }
  const manualTecnico = manualStripped + '\n\n' + docFooter;

  return {
    readme,
    manualTecnico,
    resumen: `Documentación generada para ${repoName}`,
    metadatos: { lenguaje: primaryLanguage, filesCount: files.length },
  };
}

/**
 * #28 Fase 2: genera documentación en Markdown a partir del contenido de un
 * archivo adjunto (no de un repo). Una sola llamada LLM; el Markdown resultante
 * sirve tanto para commitear como fichero como para el cuerpo de un release.
 */
export async function generateFileDoc(
  fileName: string,
  content: string,
  config: AIProviderConfig,
  conversation?: string,
  lang: Language = 'es',
): Promise<string> {
  const langInstruction = lang === 'en' ? 'IN ENGLISH' : 'EN ESPAÑOL';
  const currentYear = new Date().getFullYear();
  const docSystemPrompt = `Eres un experto en documentación técnica con registro PROFESIONAL. A partir del contenido de un archivo, redacta documentación clara y útil ${langInstruction}, en **Markdown**, con estas secciones:

# {Título descriptivo del documento}
## 📋 Resumen
(2-3 frases sobre qué es y para qué sirve.)
## 🔑 Puntos clave
- (lo más importante del contenido)
## 📝 Detalle
(explicación estructurada del contenido; usa subtítulos, listas y tablas si ayudan.)
## ✅ Conclusiones / siguientes pasos
(si aplica.)

Reglas:
- Básate ÚNICAMENTE en el contenido aportado (y, si se incluye, en la conversación con el usuario); no inventes. ${conversation ? 'INCORPORA los puntos relevantes de la conversación con el usuario que aparece abajo, sin contradecir el contenido del archivo. ' : ''}
- Si se requiere fecha o año, utiliza el año actual (${currentYear}). No utilices fechas pasadas como 2025.
- Responde SOLO con el Markdown, sin texto introductorio ni bloques de código externos que envuelvan todo.`;

  const safeContent = content.trimStart().startsWith('data:')
    ? '[ARCHIVO BINARIO O BASE64 ADJUNTO - NO SE MUESTRA CONTENIDO EN EL PROMPT]'
    : content;

  const userMessage = conversation
    ? `Archivo: ${fileName}\n\nCONTENIDO:\n${safeContent}\n\n--- CONVERSACIÓN PREVIA CON EL USUARIO (para enriquecer la documentación) ---\n${conversation}\n--- Fin de la conversación ---`
    : `Archivo: ${fileName}\n\nCONTENIDO:\n${safeContent}`;

  const raw = await callAI(
    [{ role: 'user', content: userMessage }],
    withLangDirective(docSystemPrompt, lang),
    config.provider,
    config.apiKey,
    config.model,
    undefined, undefined, undefined,
    undefined, config.accountId, config.timeoutMs,
  );

  const doc = cleanDocFooter(
    raw
      .replace(/^```(?:markdown)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()
  );

  if (!doc) throw new Error('La IA no devolvió documentación. Prueba con otro modelo o un archivo más pequeño.');
  return doc;
}

/**
 * #58 Fase 2: genera documentación para un archivo ESPECÍFICO del repo (no es el
 * flujo de repo completo ni de archivo adjunto). El prompt se adapta al tipo de
 * documento según el path. Si `existingContent` viene, se pide actualizar el
 * documento existente en vez de generarlo desde cero.
 */
export async function generateSpecificDoc(
  targetPath: string,
  existingContent?: string,
  repoContext?: string,
  config?: AIProviderConfig,
  lang: Language = 'es',
  extraImageFiles?: string[],
): Promise<string> {
  const langInstruction = lang === 'en' ? 'IN ENGLISH' : 'EN ESPAÑOL';
  const ext = targetPath.split('.').pop()?.toLowerCase() || '';
  const baseName = targetPath.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-') || 'archivo';

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentDateStr = now.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { month: 'long', year: 'numeric' });
  const currentIsoDate = now.toISOString().split('T')[0];
  const dateDirective = `\n\nFECHA Y AÑO ACTUAL EN CURSO: ${currentDateStr} (${currentIsoDate}, ${currentYear}). Si incluyes la versión o fecha de actualización, utiliza obligatoriamente el año/fecha actual (${currentYear}) y NO mantengas ni alucines con fechas pasadas como 2025.`;

  const imagesDirective = extraImageFiles && extraImageFiles.length > 0
    ? `\n\n═══════════════════════════════════════════════════════\nCAPTURAS / IMÁGENES ADJUNTAS A SUBIR EN EL REPOSITORIO (OBLIGATORIO INCLUIR EN EL DOCUMENTO):\nSe están adjuntando y subiendo las siguientes imágenes a la carpeta \`./screenshots/\`:\n${extraImageFiles.map(n => `- ./screenshots/${n}`).join('\n')}\n\nREQUISITO OBLIGATORIO:\nEn la documentación generada, DEBES incluir explícitamente la vista previa visual en Markdown estándar (sin <p align="center"> ni anchos fijos como width="750"):\n![Vista previa de ${extraImageFiles[0]}](./screenshots/${extraImageFiles[0]})\n═══════════════════════════════════════════════════════`
    : '';

  // Prompt base adaptado al tipo de documento
  // eslint-disable-next-line no-useless-assignment -- falso positivo: se reasigna en todas las ramas del if/else y se usa más abajo; el linter no sigue el flujo.
  let typeDirective = '';
  if (targetPath.toLowerCase() === 'changelog.md' || (ext === 'md' && baseName.toLowerCase() === 'changelog')) {
    typeDirective = 'TIPO: Changelog. Genera entradas de cambios legibles para un público no técnico, agrupadas por categorías (Added, Fixed, Changed). Básate en el contexto del repo (commits recientes, estructura).';
  } else if (targetPath.toLowerCase() === 'mejoras_futuras.md' || (ext === 'md' && baseName.toLowerCase() === 'mejoras-futuras')) {
    typeDirective = 'TIPO: Roadmap de mejoras. Analiza el código actual del repo, detecta límites reales y propone mejoras ordenadas por prioridad (Alta/Media/Baja). Cada mejora debe incluir: problema actual, solución propuesta, esfuerzo estimado y beneficio.';
  } else if (targetPath.startsWith('docs/') || targetPath.startsWith('doc/')) {
    typeDirective = 'TIPO: Documentación de proyecto. Genera documentación completa y profesional para el archivo indicado, con secciones descriptivas, ejemplos y tablas.';
  } else if (targetPath.toLowerCase() === 'readme.md') {
    typeDirective = 'TIPO: README. Genera o actualiza un README profesional. Si el archivo ya posee secciones detalladas (Badges de estado/CI/E2E/cobertura/stack/proveedores, Métricas, Capturas, Seguridad Zero-Storage, Comparativas, Desarrollo con IA, Limitaciones), MANTÉN TODAS ESTAS SECCIONES Y ENRIQUÉCELAS. Prohibido podar o simplificar un README rico preexistente.';
  } else if (targetPath.toLowerCase() === 'manual_tecnico.md' || targetPath.toLowerCase() === 'manual-tecnico.md') {
    typeDirective = 'TIPO: Manual técnico. Genera documentación técnica detallada: arquitectura, diagrama ASCII, estructura del proyecto, flujos, servicios, seguridad y despliegue.';
  } else {
    typeDirective = `TIPO: Documento personalizado (${targetPath}). Genera documentación profesional y útil para este archivo según su función en el repo.`;
  }

  // "mejora, no copies" sobre el contenido existente.
  const hasUserInstruction = Boolean(repoContext && repoContext.trim());

  const cleanedExistingContent = existingContent ? cleanDocFooter(existingContent) : undefined;

  const existingDirective = cleanedExistingContent
    ? `\n\nCONTENIDO ACTUAL DEL ARCHIVO (úsalo como referencia — actualízalo, no reemplazarlo ciegamente; REGLA DE PRESERVACIÓN: úsalo como base y ENRIQUÉCELO${hasUserInstruction ? ' aplicando la instrucción del usuario' : ' — MANTÉN TODAS LAS SECCIONES RICAS EXISTENTES (tablas, métricas, badges, comparativas) y no podes contenido de calidad'}):\n${cleanedExistingContent}`
    : '\n\nEl archivo NO existe aún — créalo desde cero con contenido profesional.';


  const userInstructionDirective = hasUserInstruction
    ? `\n\nINSTRUCCIÓN EXPLÍCITA DEL USUARIO (PREVALECE sobre el contenido actual — aplícala aunque implique reescritura completa):\n${repoContext}`
    : '';

  const systemPrompt = `Eres un experto en documentación técnica con registro PROFESIONAL. Tu tarea es generar o actualizar documentación para un archivo del repo. ${langInstruction}.${dateDirective}${imagesDirective}

${typeDirective}${existingDirective}${userInstructionDirective}

Reglas:
- ${hasUserInstruction ? 'APLICA la instrucción del usuario indicada arriba, aunque implique reescribir el archivo desde cero o contradecir la estructura existente.' : 'Básate en el contexto aportado; no inventes información sobre el repo que no esté en el contexto.'}
- Usa Markdown limpio y profesional (emojis en títulos, tablas, bloques de código cuando corresponda).
- ${hasUserInstruction ? 'No limites la reescritura para preservar lo existente: el usuario ha pedido cambios concretos.' : 'Si hay contenido existente, respeta su estructura y tono; solo actualiza/añade. PROHIBIDO eliminar secciones ricas como métricas, seguridad o comparativas.'}
- Responde SOLO con el Markdown del documento, sin texto introductorio ni bloques de código externos que envuelvan todo.`;


  const userMessage = hasUserInstruction
    ? `Documento objetivo: \`${targetPath}\`\n\nReescribe el archivo aplicando la siguiente instrucción del usuario (es lo que ha pedido explícitamente):\n\n---\n${repoContext}\n---\n\nGenera ÚNICAMENTE el Markdown resultante.`
    : `Documento objetivo: \`${targetPath}\`\n\nGenera la documentación completa para este archivo teniendo en cuenta las reglas y el contexto arriba indicados.`;

  const provider = config?.provider ?? 'groq';
  const apiKey = config?.apiKey ?? 'test-key';
  const model = config?.model ?? 'test-model';
  const accountId = config?.accountId;
  const timeoutMs = config?.timeoutMs;

  const raw = await callAI(
    [{ role: 'user', content: userMessage }],
    withLangDirective(systemPrompt, lang),
    provider,
    apiKey,
    model,
    undefined,
    undefined,
    undefined,
    8192, accountId, timeoutMs,
  );

  let doc = cleanDocFooter(
    raw
      .replace(/^```(?:markdown)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()
  );

  if (extraImageFiles && extraImageFiles.length > 0) {
    const missingImages = extraImageFiles.filter(
      img => !doc.toLowerCase().includes(img.toLowerCase())
    );
    if (missingImages.length > 0) {
      const previewItems = missingImages
        .map(img => `![Vista previa - ${img}](./screenshots/${img})`)
        .join('\n\n');
      const previewBlock = `\n\n### 🖼️ Vista previa\n\n${previewItems}`;
      doc = injectImagePreviewBlock(doc, previewBlock);
    }
  }

  if (!doc) throw new Error('La IA no devolvió documentación. Prueba con otro modelo o un archivo más pequeño.');
  return doc;
}
