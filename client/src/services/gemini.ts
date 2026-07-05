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
import { getProvider, type AIProviderType } from './providers';
import { withTransientRetry, isAbortError, isTransientError } from '../utils/retry';
// #23: los system prompts viven en archivos `.md` (mantenibilidad + base para i18n).
// Se cargan como texto crudo con el import `?raw` de Vite. `.trimEnd()` evita que un
// salto de línea final del archivo cambie el prompt respecto al literal original.
import actionSystemPrompt from '../prompts/action-system.md?raw';
import chatPromptText from '../prompts/chat.md?raw';

// ── System prompts (Opción D - Tres modos) ────────────────────────────────────

// Prompt por defecto (retrocompatible - modo acción)
export const SYSTEM_PROMPT = actionSystemPrompt.trimEnd();

// ── CHAT PROMPT (Opción D - Modo conversacional) ──────────────────────────────
export const CHAT_PROMPT = chatPromptText.trimEnd();

// ── ACTION PROMPT (Opción D - Modo acción explícito) ──────────────────────────
export const ACTION_PROMPT = SYSTEM_PROMPT;

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
    max_tokens: 4096,
    ...(stream ? { stream: true } : {}),
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = (err?.error as Record<string, unknown>)?.message as string | undefined;
    const hint = ' — el modelo no está disponible ahora mismo (saturación del tier gratuito). Prueba otro modelo (p.ej. Gemma) o cambia a Gemini/Groq.';
    throw Object.assign(new Error((msg || `AI provider error ${res.status}`) + hint), { status: res.status });
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
): Promise<string> {
  const stream = Boolean(onToken);
  const body: Record<string, unknown> = { apiKey, model, messages, systemPrompt };

  // Solo añadir mode si está definido (retrocompatible)
  if (mode) body.mode = mode;
  if (stream) body.stream = true;

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
): Promise<string> {
  const def = getProvider(provider);
  // Reintento ante errores transitorios del servidor (503 "high demand",
  // "Provider returned error"…). La validación de clave llama a las funciones
  // internas directamente, así que no se ve afectada por este reintento.
  // Con streaming, `onToken` recibe el texto ACUMULADO (semántica "set"): si hay
  // reintento, el stream reinicia y sobrescribe la burbuja sin duplicar.
  return withTransientRetry(() =>
    def.transport === 'gemini-proxy'
      ? callGeminiDirect(apiKey, model, messages, systemPrompt, mode, onToken, signal)
      : callOpenAICompatible(def.chatEndpoint!, apiKey, model, messages, systemPrompt, mode, def.extraHeaders, onToken, signal),
  );
}

/** @deprecated Use callAI() directly. */
export const callGemini = callAI;

// ── Key validation ────────────────────────────────────────────────────────────
export async function validateProviderKey(
  provider: AIProviderType,
  apiKey: string,
  model: string,
): Promise<{ valid: boolean; error?: string }> {
  const def = getProvider(provider);
  try {
    if (def.transport === 'gemini-proxy') {
      await callGeminiDirect(apiKey, model, [{ role: 'user', content: 'Hi' }], 'Reply with one word.');
    } else {
      await callOpenAICompatible(def.chatEndpoint!, apiKey, model, [{ role: 'user', content: 'Hi' }], 'Reply with one word.', undefined, def.extraHeaders);
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

// ── Response parsing ──────────────────────────────────────────────────────────
// #40: allowlists para validar el JSON de acción antes de proponer→confirmar→ejecutar.
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const ALLOWED_TYPES = new Set(['lectura', 'escritura', 'creacion', 'listado', 'borrado']);

/**
 * Valida la forma de una acción ya parseada (#40). Refuerza la garantía
 * propón→confirma→ejecuta: método y tipo dentro de una allowlist, y el endpoint —si
 * viene— debe ser un path RELATIVO (empieza por `/`, sin `://`) para que nunca apunte
 * a un host externo. Función pura.
 */
function isValidAction(a: Record<string, unknown>): boolean {
  if (!a.tipo || !a.accion || !a.metodo) return false;
  if (typeof a.metodo !== 'string' || !ALLOWED_METHODS.has(a.metodo.toUpperCase())) return false;
  if (typeof a.tipo !== 'string' || !ALLOWED_TYPES.has(a.tipo)) return false;
  if (a.endpoint !== undefined && a.endpoint !== null) {
    if (typeof a.endpoint !== 'string') return false;
    if (a.endpoint.includes('://') || !a.endpoint.startsWith('/')) return false;
  }
  if (a.requiereConfirmacion !== undefined && typeof a.requiereConfirmacion !== 'boolean') return false;
  return true;
}

export function parseGeminiAction(rawText: string): GeminiAction | null {
  // v3.22.2: además de quitar fences, extraemos el primer bloque `{...}` balanceado.
  // Algunos modelos (Qwen, Gemma) envuelven el JSON en prosa ("Aquí tienes: {...}");
  // el parser anterior exigía que TODA la cadena fuera JSON y fallaba en silencio.
  const candidates = extractJsonCandidates(rawText);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      // #40: validación estricta (allowlist de método/tipo + endpoint relativo). Si no
      // cumple, se trata como respuesta conversacional (null), igual que un JSON inválido.
      if (isValidAction(parsed)) return parsed as GeminiAction;
    } catch {
      // probamos el siguiente candidato
    }
  }
  return null;
}

/**
 * Extrae posibles substrings JSON de la respuesta del modelo, en orden de
 * preferencia: (1) la cadena entera sin fences, (2) el primer bloque `{...}`
 * balanceado (para modelos que envuelven el JSON en prosa).
 */
function extractJsonCandidates(rawText: string): string[] {
  const candidates: string[] = [];
  // (1) cadena entera sin fences ```json ... ```
  const stripped = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  candidates.push(stripped);
  // (2) primer {...} balanceado (ignora strings con llaves escapadas)
  const balanced = firstBalancedJsonObject(rawText);
  if (balanced && balanced !== stripped) candidates.push(balanced);
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

// ── Repo documentation generator ──────────────────────────────────────────────
/**
 * Generate README.md and MANUAL_TECNICO.md for a repository.
 * 
 * 🔥 ZERO-STORAGE: Acepta un objeto config opcional con provider/apiKey/model.
 * Si no se pasa (ej: en tests), usa valores por defecto para compatibilidad.
 * 
 * Acepta dos formatos de llamada:
 * - generateRepoDocs(files) - solo archivos (para tests)
 * - generateRepoDocs(files, config) - archivos + config (para tests con provider)
 * - generateRepoDocs(repoName, files) - con nombre del repo (legacy)
 * - generateRepoDocs(repoName, files, config) - con nombre y config (App.tsx)
 */
export async function generateRepoDocs(
  fileTreeOrRepoName: Array<{ path: string; content?: string }> | string,
  fileTreeOrConfig?: Array<{ path: string; content?: string }> | AIProviderConfig,
  maybeConfig?: AIProviderConfig,
  lang: Language = 'es',
): Promise<GeneratedDocs> {
  
  let repoName: string;
  let files: Array<{ path: string; content?: string }>;
  let config: AIProviderConfig | undefined;
  
  // Soporte para múltiples formatos de llamada
  if (typeof fileTreeOrRepoName === 'string') {
    // Formato: generateRepoDocs(repoName, files, config?)
    repoName = fileTreeOrRepoName;
    files = (fileTreeOrConfig as Array<{ path: string; content?: string }>) || [];
    config = maybeConfig;
  } else {
    // Formato: generateRepoDocs(files, config?)
    repoName = 'unknown-repo';
    files = fileTreeOrRepoName;
    // fileTreeOrConfig podría ser el config si se llama con (files, config)
    if (fileTreeOrConfig && typeof fileTreeOrConfig === 'object' && 'provider' in fileTreeOrConfig) {
      config = fileTreeOrConfig as AIProviderConfig;
    }
  }

  // Validación
  if (!files || files.length === 0) {
    throw new Error('No hay archivos para analizar');
  }

  const primaryLanguage = detectPrimaryLanguage(files);
  // Autor y año REALES (no dejar que el modelo los invente — caso real: footer "· 2024").
  const docOwner = repoName.includes('/') ? repoName.split('/')[0] : repoName;
  const docYear = new Date().getFullYear();

  // ── Rich system prompt with structure template ────────────────────────────
  const docSystemPrompt = `Eres un experto en documentación técnica de software de nivel profesional.
Tu tarea es analizar el código de un repositorio y generar documentación completa, detallada y visualmente atractiva.
Responde ÚNICAMENTE con un objeto JSON con este formato exacto (sin markdown exterior, sin texto adicional):
{ "readme": "...", "manualTecnico": "...", "resumen": "...", "metadatos": {...} }

═══════════════════════════════════════════════════════
REQUISITOS OBLIGATORIOS PARA EL README.md
═══════════════════════════════════════════════════════

1. CABECERA:
   - Título con emoji descriptivo del proyecto
   - Fila de badges shields.io (for-the-badge): lenguaje principal, framework/stack,
     estado (Publicado/En desarrollo), tipo de licencia
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
   Footer EXACTO (NO inventes autor ni año; usa EXACTAMENTE estos valores reales):
   <p align="center">Desarrollado por @${docOwner} · ${docYear}</p>

3. CALIDAD:
   - Usa el contenido REAL del código para las explicaciones (nombres de funciones, rutas, comandos)
   - Los bloques de código deben contener comandos reales (npm install, python main.py, etc.)
   - Las tablas deben tener filas con información concreta, no placeholders genéricos
   - Detecta el lenguaje principal y usa badges específicos de ese ecosistema

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

═══════════════════════════════════════════════════════
LENGUAJE PRIMARIO DETECTADO: ${primaryLanguage}
REPOSITORIO: ${repoName}
═══════════════════════════════════════════════════════

Recuerda: responde SOLO con el JSON { "readme": "...", "manualTecnico": "...", "resumen": "...", "metadatos": {...} }.
No incluyas ningún texto fuera del JSON. No uses bloques de código externos.`;

  // ── Build message: tree overview + file contents ──────────────────────────
  const treeOverview = files.map(f => f.path).join('\n');
  const fileContents = files
    .filter(f => f.content) // Solo archivos con contenido
    // #20: truncado por líneas (preserva imports/firmas) en vez de cortar a 2000 chars.
    .map(f => `### ${f.path}\n${truncateByLines(f.content || '', 80)}`)
    .join('\n\n---\n\n');

  const userMessage =
    `Repositorio: ${repoName}\n` +
    `Lenguaje principal detectado: ${primaryLanguage}\n` +
    `Archivos analizados: ${files.length}\n\n` +
    `ESTRUCTURA DEL PROYECTO:\n\`\`\`\n${treeOverview}\n\`\`\`\n\n` +
    `CONTENIDO DE ARCHIVOS CLAVE:\n\n${fileContents}`;

  // 🔥 ZERO-STORAGE: Si tenemos config, lo pasamos a callAI. Si no, usamos defaults (para tests).
  // #24 Fase 3: la documentación respeta el idioma activo de la interfaz.
  const prompt = withLangDirective(docSystemPrompt, lang);
  let rawText: string;
  if (config) {
    rawText = await callAI(
      [{ role: 'user', content: userMessage }],
      prompt,
      config.provider,
      config.apiKey,
      config.model,
    );
  } else {
    // Fallback para tests: usa valores por defecto
    rawText = await callAI(
      [{ role: 'user', content: userMessage }],
      prompt,
      'groq',
      'test-key',
      'test-model',
    );
  }

  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('La IA no devolvió JSON válido');
  }

  // Validación de campos requeridos
  if (!parsed.readme || typeof parsed.readme !== 'string') {
    throw new Error('La IA no devolvió el campo "readme" en el formato esperado');
  }
  if (!parsed.manualTecnico || typeof parsed.manualTecnico !== 'string') {
    throw new Error('La IA no devolvió el campo "manualTecnico" en el formato esperado');
  }

  // Manejo de errores del modelo
  if (parsed.error) {
    throw new Error(`Error del modelo: ${parsed.error}`);
  }
  
  // Construir metadatos por defecto si no están en la respuesta
  const defaultMetadatos = {
    lenguaje: primaryLanguage,
    filesCount: files.length,
  };

  return {
    readme: parsed.readme as string,
    manualTecnico: parsed.manualTecnico as string,
    resumen: (parsed.resumen as string) || `Documentación generada para ${repoName}`,
    metadatos: (parsed.metadatos as Record<string, unknown>) || defaultMetadatos,
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
  // #24 Fase 3: el idioma de la documentación sigue al idioma activo de la interfaz.
  const langInstruction = lang === 'en' ? 'IN ENGLISH' : 'EN ESPAÑOL';
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

Reglas: básate ÚNICAMENTE en el contenido aportado (y, si se incluye, en la conversación con el usuario); no inventes. ${conversation ? 'INCORPORA los puntos relevantes de la conversación con el usuario que aparece abajo, sin contradecir el contenido del archivo. ' : ''}Responde SOLO con el Markdown, sin texto introductorio ni bloques de código externos que envuelvan todo.`;

  const userMessage = conversation
    ? `Archivo: ${fileName}\n\nCONTENIDO:\n${content}\n\n--- CONVERSACIÓN PREVIA CON EL USUARIO (para enriquecer la documentación) ---\n${conversation}\n--- Fin de la conversación ---`
    : `Archivo: ${fileName}\n\nCONTENIDO:\n${content}`;

  const raw = await callAI(
    [{ role: 'user', content: userMessage }],
    withLangDirective(docSystemPrompt, lang),
    config.provider,
    config.apiKey,
    config.model,
  );

  const doc = raw
    .replace(/^```(?:markdown)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  if (!doc) throw new Error('La IA no devolvió documentación. Prueba con otro modelo o un archivo más pequeño.');
  return doc;
}
