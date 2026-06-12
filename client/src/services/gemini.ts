// ────────────────────────────────────────────────────────────────────────────
// Unified AI client — supports Google Gemini and Groq Cloud
//
// ARCHITECTURE NOTE (v2.1):
// Gemini calls are now proxied through the Express backend (/api/gemini).
// This is required because the Gemini API blocks direct browser requests from
// EU regions (EEA). The server is deployed in us-central1 (Cloud Run) where
// the API is fully accessible. The user's API key is sent in the HTTPS request
// body and is never stored on the server.
//
// Groq calls continue to go directly from the browser — no EU restriction applies.
//
// Provider routing:
//   sessionStorage['ai_provider'] === 'gemini'  →  POST /api/gemini (server proxy)
//   sessionStorage['ai_provider'] === 'groq'    →  fetch() to Groq OpenAI endpoint
// ────────────────────────────────────────────────────────────────────────────

import type { GeminiAction } from '../types';
import type { AIProviderType } from '../context/AIProviderContext';

// ── System prompt ─────────────────────────────────────────────────────────────
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

// ── Message type ─────────────────────────────────────────────────────────────
export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// ── Types for repo documentation generation ───────────────────────────────────
export type RepoFile = { path: string; content?: string };
export type GeneratedDocs = {
  readme: string;
  manualTecnico: string;
  resumen?: string;
  metadatos?: Record<string, unknown>;
};

// ── Read provider config from sessionStorage ───────────────────────────────────
function getConfig(): { provider: AIProviderType; apiKey: string; model: string } {
  const provider = sessionStorage.getItem('ai_provider') as AIProviderType | null;
  const apiKey = sessionStorage.getItem('ai_api_key');
  const model = sessionStorage.getItem('ai_model');
  if (!provider || !apiKey || !model) {
    throw new Error('No hay proveedor de IA configurado. Por favor conecta tu cuenta.');
  }
  return { provider, apiKey, model };
}

// ── Groq implementation ───────────────────────────────────────────────────────
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';

async function callGroq(
  apiKey: string,
  model: string,
  messages: Message[],
  systemPrompt: string,
): Promise<string> {
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    ],
    temperature: 0.1,
    max_tokens: 4096,
  };

  const res = await fetch(GROQ_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = (err?.error as Record<string, unknown>)?.message as string | undefined;
    throw Object.assign(new Error(msg || `Groq error ${res.status}`), { status: res.status });
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0].message.content;
}

// ── Gemini implementation (proxied through server) ─────────────────────────────
async function callGeminiDirect(
  apiKey: string,
  model: string,
  messages: Message[],
  systemPrompt: string,
): Promise<string> {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, model, messages, systemPrompt }),
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

// ── Unified callAI ───────────────────────────────────────────────────────────
export async function callAI(
  messages: Message[],
  systemPrompt: string = SYSTEM_PROMPT,
): Promise<string> {
  const { provider, apiKey, model } = getConfig();
  if (provider === 'groq') return callGroq(apiKey, model, messages, systemPrompt);
  return callGeminiDirect(apiKey, model, messages, systemPrompt);
}

/** @deprecated Use callAI() directly. */
export const callGemini = callAI;

// ── Key validation ───────────────────────────────────────────────────────────
export async function validateProviderKey(
  provider: AIProviderType,
  apiKey: string,
  model: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    if (provider === 'groq') {
      await callGroq(apiKey, model, [{ role: 'user', content: 'Hi' }], 'Reply with one word.');
    } else {
      await callGeminiDirect(apiKey, model, [{ role: 'user', content: 'Hi' }], 'Reply with one word.');
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
        error: 'Clave inválida, compruébala en tu panel de ' +
          (provider === 'groq' ? 'Groq' : 'Google AI Studio'),
      };
    }
    if (status === 429 || message.includes('429')) return { valid: true };
    return { valid: false, error: message || 'Error de conexión con el proveedor de IA' };
  }
}

// ── Response parsing ────────────────────────────────────────────────────────
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

// ── Primary language detector ───────────────────────────────────────────────
/**
 * Infers the primary programming language of a repo from file extension counts.
 * Used to provide language-specific context to the documentation generator.
 *
 * @param files Array of RepoFile objects with path property
 * @returns The detected primary language or 'múltiple' as fallback
 */
export function detectPrimaryLanguage(files: RepoFile[]): string {
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

// ── Extract JSON from model response ────────────────────────────────────────
/**
 * Attempts to extract valid JSON from model response, handling:
 * - Markdown code fences (```json ... ```)
 * - Plain backticks (` ... `)
 * - Raw JSON
 * - JSON wrapped in prose
 */
function extractJSON(rawText: string): Record<string, unknown> {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    // Try to find JSON object in the text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        throw new Error(`No se pudo parsear el JSON extraído: ${match[0].slice(0, 100)}...`);
      }
    }
    throw new Error(`No se encontró JSON válido en la respuesta del modelo`);
  }
}

// ── Repo documentation generator ────────────────────────────────────────────
/**
 * Generate README.md and MANUAL_TECNICO.md for a repository.
 *
 * @param files Array of RepoFile objects with path and optional content
 * @returns GeneratedDocs with readme, manualTecnico, optional resumen and metadatos
 *
 * Key features (v2.4):
 * - Detects primary programming language from file extensions
 * - Sends full file tree as structural overview
 * - Truncates large files at 80 lines (semantic) with explicit truncation marker
 * - Validates model response for required fields
 * - Extracts JSON from wrapped responses (backticks, markdown)
 * - Handles model errors gracefully with descriptive messages
 */
export async function generateRepoDocs(
  files: RepoFile[],
): Promise<GeneratedDocs> {
  if (!files.length) {
    throw new Error('No hay archivos para analizar. Proporciona al menos un archivo.');
  }

  const primaryLanguage = detectPrimaryLanguage(files);
  const repoName = files[0].path?.split('/')[0] ?? 'repositorio';
  const filesCount = files.length;

  // ── Rich system prompt with structure template ──────────────────────────────
  const docSystemPrompt = `Eres un experto en documentación técnica de software de nivel profesional.
Tu tarea es analizar el código de un repositorio y generar documentación completa, detallada y visualmente atractiva.
Responde ÚNICAMENTE con un objeto JSON con este formato exacto (sin markdown exterior, sin texto adicional):
{
  "readme": "<string: README completo en Markdown>",
  "manualTecnico": "<string: Manual técnico detallado en Markdown>",
  "resumen": "<string: breve resumen de 2-3 líneas>",
  "metadatos": { "lenguaje": "${primaryLanguage}", "filesCount": ${filesCount} }
}

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
   - Detecta el lenguaje principal (${primaryLanguage}) y usa badges específicos de ese ecosistema

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
TOTAL DE ARCHIVOS ANALIZADOS: ${filesCount}
═══════════════════════════════════════════════════════

Recuerda: responde SOLO con el JSON.
No inclujas ningún texto fuera del JSON. No uses bloques de código externos.
TODAS las claves (readme, manualTecnico, resumen, metadatos) son OBLIGATORIAS.`;

  // ── Build message: tree overview + file contents ─────────────────────────────
  const treeOverview = files.map(f => f.path).join('\n');
  const fileContents = files
    .filter(f => f.content)
    .map(f => {
      const content = f.content ?? '';
      // Semantic truncation: first 80 lines preserves structure better than char-based slice.
      // Code files show imports + function signatures; markdown files show headings + intro.
      const MAX_LINES = 80;
      const lines = content.split('\n');
      const truncated = lines.length > MAX_LINES;
      const truncationMarker = truncated
        ? `\n\n... (truncated — showing first ${MAX_LINES} of ${lines.length} lines)`
        : '';
      return `### ${f.path}\n${lines.slice(0, MAX_LINES).join('\n')}${truncationMarker}`;
    })
    .join('\n\n---\n\n');

  const userMessage =
    `Repositorio: ${repoName}\n` +
    `Lenguaje principal detectado: ${primaryLanguage}\n` +
    `Archivos analizados: ${filesCount}\n\n` +
    `ESTRUCTURA DEL PROYECTO:\n\`\`\`\n${treeOverview}\n\`\`\`\n\n` +
    `CONTENIDO DE ARCHIVOS CLAVE:\n\n${fileContents}`;

  try {
    const rawText = await callAI(
      [{ role: 'user', content: userMessage }],
      docSystemPrompt,
    );

    // Extract and validate JSON response
    const parsed = extractJSON(rawText);

    // Check for model errors
    if (parsed.error) {
      throw new Error(`Error del modelo: ${parsed.error}`);
    }

    // Validate required fields
    if (!parsed.readme || typeof parsed.readme !== 'string') {
      throw new Error('La IA no devolvió el campo "readme" en el formato esperado');
    }
    if (!parsed.manualTecnico || typeof parsed.manualTecnico !== 'string') {
      throw new Error('La IA no devolvió el campo "manualTecnico" en el formato esperado');
    }

    // Return GeneratedDocs with optional fields
    return {
      readme: parsed.readme,
      manualTecnico: parsed.manualTecnico,
      resumen: typeof parsed.resumen === 'string' ? parsed.resumen : undefined,
      metadatos: typeof parsed.metadatos === 'object' && parsed.metadatos !== null
        ? (parsed.metadatos as Record<string, unknown>)
        : { lenguaje: primaryLanguage, filesCount },
    };
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('parseRequest') || message.includes('Failed to parse')) {
      throw new Error(`Error de parseo del modelo: ${message}. Intenta nuevamente.`);
    }
    throw err;
  }
}
