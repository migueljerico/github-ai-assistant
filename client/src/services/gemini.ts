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
import { getProvider, type AIProviderType } from './providers';

// ── System prompts (Opción D - Tres modos) ────────────────────────────────────

// Prompt por defecto (retrocompatible - modo acción)
export const SYSTEM_PROMPT = `Eres un agente experto en la GitHub REST API v3.
Cuando el usuario te dé una instrucción en lenguaje natural, responde
ÚNICAMENTE con un JSON que describa la acción a tomar, antes de ejecutarla.

Formato del JSON de respuesta:
{
  "tipo": "lectura|escritura|creacion|listado|borrado",
  "accion": "descripción breve en lenguaje natural de lo que harás",
  "endpoint": "el endpoint exacto de la GitHub API (sin parámetros de plantilla)",
  "metodo": "GET|POST|PUT|PATCH|DELETE",
  "repo": "nombre del repo (solo el nombre, sin owner) o null",
  "archivo": "ruta del archivo o null",
  "contenidoPropuesto": "contenido en markdown/texto o null",
  "payload": { "objeto JSON con los parámetros para la API" },
  "requiereConfirmacion": true
}

REGLAS IMPORTANTES PARA LOS ENDPOINTS:
- Para listar los repos del usuario autenticado: usa SIEMPRE "/user/repos" (NO "/users/{username}/repos")
- Para el perfil del usuario autenticado: usa "/user" (NO "/users/{username}")
- Nunca uses placeholders literales como {username}, {owner}, {repo} — usa el nombre real
- Para repos de otro usuario: "/users/NOMBRE_REAL/repos" con el nombre real, no un placeholder
- Para archivos: "/repos/OWNER/REPO/contents/RUTA"

REGLA OBLIGATORIA SOBRE requiereConfirmacion:
- false → operaciones de SOLO LECTURA que no modifican datos: listar repos, ver archivos,
          obtener información del perfil, consultar estadísticas. tipo = "lectura" o "listado"
- true  → operaciones que CREAN, MODIFICAN O BORRAN datos: subir archivos, crear repos,
          actualizar contenido, eliminar. tipo = "escritura", "creacion" o "borrado"
Ejemplo: "lista mis repositorios" → requiereConfirmacion: false
Ejemplo: "crea un README" → requiereConfirmacion: true

Para operaciones de escritura en archivos existentes, incluye
"contenidoActual" con el contenido actual del archivo (obtenido
previamente con GET) para permitir mostrar el diff.

Nunca ejecutes directamente — solo genera el JSON descriptivo.
El frontend se encargará de la confirmación y ejecución.

IMPORTANTE: responde SOLO con el JSON, sin texto adicional, sin markdown, sin \`\`\`json.`;

// ── CHAT PROMPT (Opción D - Modo conversacional) ──────────────────────────────
export const CHAT_PROMPT = `Eres un desarrollador senior experto en arquitectura de software, GitHub y mejores prácticas.

Tu comportamiento es CONVERSAR y DAR OPINIONES en texto normal (Markdown).

✅ Responde directamente con:
- Opiniones constructivas sobre código y arquitectura
- Análisis de patrones y mejores prácticas
- Consejos sobre seguridad, rendimiento y mantenibilidad
- Explicaciones técnicas detalladas
- Recomendaciones personalizadas

❌ NUNCA generes JSON en este modo
❌ NUNCA digas "necesito leer el repo primero"
❌ NUNCA ejecutes acciones de la API
❌ NUNCA uses bloques de código JSON

Eres un consultor experto - DA TU OPINIÓN directamente con tu conocimiento.
Responde en Markdown con formato rico (títulos, listas, negritas, código).`;

// ── ACTION PROMPT (Opción D - Modo acción explícito) ──────────────────────────
export const ACTION_PROMPT = SYSTEM_PROMPT; // Alias para claridad

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
  opts: { maxFiles?: number; maxLinesPerFile?: number } = {},
): string {
  const maxFiles = opts.maxFiles ?? 12;
  const maxLines = opts.maxLinesPerFile ?? 80;

  const tree = files.map(f => f.path).join('\n');
  const bodies = files
    .filter(f => f.content)
    .slice(0, maxFiles)
    .map(f => {
      const lines = (f.content || '').split('\n');
      const shown = lines.slice(0, maxLines).join('\n');
      const rest = lines.length > maxLines
        ? `\n[... ${lines.length - maxLines} líneas más ...]`
        : '';
      return `### ${f.path}\n\`\`\`\n${shown}${rest}\n\`\`\``;
    })
    .join('\n\n');

  return `Repositorio: ${repoName}\nArchivos analizados: ${files.length}\n\n` +
    `ESTRUCTURA DEL PROYECTO:\n\`\`\`\n${tree}\n\`\`\`\n\n` +
    `CONTENIDO DE ARCHIVOS CLAVE:\n\n${bodies}`;
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
- Si algo no aparece en el contexto, dilo en lugar de inventarlo.

${contextSummary}`;
}

// ── Message type ──────────────────────────────────────────────────────────────
export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

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

// ── OpenAI-compatible implementation (Groq, OpenRouter, …) ────────────────────
/**
 * Cliente para cualquier API compatible con OpenAI Chat Completions (Groq,
 * OpenRouter, etc.). Mismo cuerpo y misma forma de respuesta para todos; solo
 * cambian el `endpoint` y, opcionalmente, headers extra (p.ej. el `X-Title` de
 * OpenRouter).
 */
async function callOpenAICompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: Message[],
  systemPrompt: string,
  mode?: 'chat' | 'action',  // ← OPCIÓN D: ajusta la temperatura según el modo
  extraHeaders?: Record<string, string>,
): Promise<string> {
  // Modo chat necesita más creatividad (0.7); modo acción debe ser determinista
  // para producir JSON estable (0.1). Por defecto se mantiene el comportamiento
  // determinista previo.
  const temperature = mode === 'chat' ? 0.7 : 0.1;

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
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = (err?.error as Record<string, unknown>)?.message as string | undefined;
    const hint = ' (posible límite/saturación o contexto excesivo del modelo gratuito — prueba con otro modelo)';
    throw Object.assign(new Error((msg || `AI provider error ${res.status}`) + hint), { status: res.status });
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content || !content.trim()) {
    // Algunos modelos gratuitos devuelven contenido vacío (o sin choices) ante
    // prompts grandes; damos un error claro y accionable en vez de una burbuja vacía.
    throw new Error(
      'El modelo no devolvió contenido. Prueba con otro modelo del desplegable ' +
      '(p.ej. Llama 3.3 70B free o DeepSeek R1 free) o con un repositorio más pequeño.',
    );
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
): Promise<string> {
  const body: Record<string, unknown> = { 
    apiKey, 
    model, 
    messages, 
    systemPrompt 
  };
  
  // Solo añadir mode si está definido (retrocompatible)
  if (mode) {
    body.mode = mode;
  }

  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = err?.error as string | undefined;
    throw Object.assign(
      new Error(msg || `Gemini proxy error ${res.status}`),
      { status: res.status },
    );
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
): Promise<string> {
  const def = getProvider(provider);
  if (def.transport === 'gemini-proxy') {
    return callGeminiDirect(apiKey, model, messages, systemPrompt, mode);
  }
  return callOpenAICompatible(def.chatEndpoint!, apiKey, model, messages, systemPrompt, mode, def.extraHeaders);
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
export function parseGeminiAction(rawText: string): GeminiAction | null {
  try {
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.tipo || !parsed.accion || !parsed.metodo) return null;
    return parsed as GeminiAction;
  } catch {
    return null;
  }
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
   Footer: <p align="center">Desarrollado por @[autor] · [año]</p>

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
    .map(f =>
      `### ${f.path}\n` +
      (f.content || '').slice(0, 2000) +
      ((f.content || '').length > 2000 ? '\n[... truncado a 2000 chars ...]' : '')
    )
    .join('\n\n---\n\n');

  const userMessage =
    `Repositorio: ${repoName}\n` +
    `Lenguaje principal detectado: ${primaryLanguage}\n` +
    `Archivos analizados: ${files.length}\n\n` +
    `ESTRUCTURA DEL PROYECTO:\n\`\`\`\n${treeOverview}\n\`\`\`\n\n` +
    `CONTENIDO DE ARCHIVOS CLAVE:\n\n${fileContents}`;

  // 🔥 ZERO-STORAGE: Si tenemos config, lo pasamos a callAI. Si no, usamos defaults (para tests).
  let rawText: string;
  if (config) {
    rawText = await callAI(
      [{ role: 'user', content: userMessage }],
      docSystemPrompt,
      config.provider,
      config.apiKey,
      config.model,
    );
  } else {
    // Fallback para tests: usa valores por defecto
    rawText = await callAI(
      [{ role: 'user', content: userMessage }],
      docSystemPrompt,
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
