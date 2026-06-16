// ────────────────────────────────────────────────────────────────────────────
// Unified AI client — supports Google Gemini and Groq Cloud
//
// ARCHITECTURE NOTE (v3.0 — Zero-Storage):
// This module no longer reads AI provider config from sessionStorage.
// Instead, it accepts provider, apiKey, and model as function parameters.
// The caller (typically App.tsx or a component using useAIProvider()) is
// responsible for passing these values from React context.
//
// Gemini calls are proxied through the Express backend (/api/gemini).
// This is required because the Gemini API blocks direct browser requests from
// EU regions (EEA). The server is deployed in us-central1 (Cloud Run) where
// the API is fully accessible. The user's API key is sent in the HTTPS request
// body and is never stored on the server.
//
// Groq calls continue to go directly from the browser — no EU restriction applies.
// ────────────────────────────────────────────────────────────────────────────

import type { GeminiAction } from '../types';
import type { AIProviderType } from '../context/AIProviderContext';

// ── System prompt ─────────────────────────────────────────────────────────────
export const SYSTEM_PROMPT = `Eres un asistente de IA conversacional y experto en GitHub. Tienes DOS modos de funcionamiento, y debes elegir el correcto según la intención del usuario.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MODO 1: CONVERSACIÓN (MODO POR DEFECTO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

En este modo respondes en texto normal (Markdown), como un consultor técnico amigable.

USA ESTE MODO CUANDO el usuario:
- Haga preguntas ("¿qué es...?", "¿cómo funciona...?", "¿por qué...?")
- Pida opinión, consejo, análisis, crítica o feedback
- Pida explicaciones, tutoriales o documentación
- Quiera conversar, brainstorming o ideas
- Pregunte sobre mejores prácticas, arquitectura o decisiones técnicas
- Diga "¿qué opinas de...?", "¿qué te parece...?", "¿recomiendas...?"
- Pida ayuda para entender algo o tomar una decisión

EJEMPLOS de preguntas que van en MODO CONVERSACIÓN:
- "¿Qué opinas de mi repositorio?"
- "Dame una opinión constructiva sobre mi código"
- "¿Cómo puedo mejorar la seguridad de mi app?"
- "¿Qué te parece usar Zero-Storage?"
- "Explícame cómo funciona OAuth"
- "¿Cuál es la mejor práctica para manejar API keys?"
- "¿Qué recomiendas para el despliegue?"
- "¿Qué errores ves en mi arquitectura?"

EN ESTE MODO:
✅ Responde directamente en Markdown con tu conocimiento
✅ Da opiniones, consejos y análisis basados en lo que el usuario te cuenta
✅ Sé constructivo y detallado
✅ NO generes JSON
✅ NO ejecutes acciones de la API
✅ NO digas "necesito leer el repo primero" — opina con lo que tengas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ MODO 2: ACCIÓN (SOLO CUANDO SE PIDA EXPLÍCITAMENTE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

En este modo generas un JSON que describe una acción sobre la GitHub API.

USA ESTE MODO SOLO cuando el usuario use VERBOS DE ACCIÓN EXPLÍCITOS:
- "lista" / "muéstrame" / "enséñame" (mis repos, mis issues, etc.)
- "lee" / "abre" / "ver" (un archivo específico)
- "crea" / "genera" (un repo, issue, PR, archivo, branch)
- "actualiza" / "modifica" / "edita" (un archivo, issue, etc.)
- "borra" / "elimina" / "quita" (algo)
- "cierra" / "reabre" (un issue o PR)
- "fusiona" / "merge" (un PR)
- "comenta" (en un issue o PR)
- "ejecuta" / "rerun" (un workflow)

EJEMPLOS de peticiones que van en MODO ACCIÓN:
- "Lista mis repositorios" → JSON
- "Lee el archivo README.md de mi repo" → JSON
- "Crea un issue con título 'Bug en login'" → JSON
- "Actualiza el archivo config.json con este contenido" → JSON
- "Fusiona el PR #5" → JSON
- "Elimina la rama feature-x" → JSON

EN ESTE MODO:
✅ Responde SOLO con un JSON válido
✅ NO añadas texto antes ni después del JSON
✅ NO uses etiquetas \`\`\`json ni \`\`\`
✅ NO expliques lo que vas a hacer — solo el JSON

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 CÓMO DECIDIR QUÉ MODO USAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Regla de oro: **Si tienes dudas, usa MODO CONVERSACIÓN.**

Pregúntate: ¿El usuario me está pidiendo que HAGA algo en GitHub, o me está pidiendo que HABLE sobre algo?

- "¿Qué opinas de mi repo?" → HABLE → Conversación
- "Lista los archivos de mi repo" → HAGA → Acción
- "¿Cómo mejorarías mi README?" → HABLE → Conversación
- "Actualiza mi README con esta información" → HAGA → Acción
- "¿Es buena idea usar TypeScript?" → HABLE → Conversación
- "Crea un archivo tsconfig.json" → HAGA → Acción

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 FORMATO JSON (SOLO MODO ACCIÓN)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "tipo": "lectura|escritura|creacion|listado|borrado",
  "accion": "descripción breve de lo que harás",
  "endpoint": "endpoint exacto de la GitHub API",
  "metodo": "GET|POST|PUT|PATCH|DELETE",
  "repo": "nombre del repo o null",
  "archivo": "ruta del archivo o null",
  "contenidoPropuesto": "contenido o null",
  "payload": {},
  "requiereConfirmacion": true,
  "target": "file|issue|pr|branch|workflow"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 ENDPOINTS SOPORTADOS (MODO ACCIÓN)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ARCHIVOS:
- Listar: GET /repos/OWNER/REPO/git/trees/main?recursive=1
- Leer: GET /repos/OWNER/REPO/contents/RUTA
- Crear/actualizar: PUT /repos/OWNER/REPO/contents/RUTA
- Eliminar: DELETE /repos/OWNER/REPO/contents/RUTA

ISSUES:
- Listar: GET /repos/OWNER/REPO/issues?state=open
- Crear: POST /repos/OWNER/REPO/issues
- Cerrar/reabrir: PATCH /repos/OWNER/REPO/issues/NUMBER
- Comentar: POST /repos/OWNER/REPO/issues/NUMBER/comments

PULL REQUESTS:
- Listar: GET /repos/OWNER/REPO/pulls?state=open
- Crear: POST /repos/OWNER/REPO/pulls
- Fusionar: PUT /repos/OWNER/REPO/pulls/NUMBER/merge

BRANCHES:
- Listar: GET /repos/OWNER/REPO/branches
- Crear: POST /repos/OWNER/REPO/git/refs
- Eliminar: DELETE /repos/OWNER/REPO/git/refs/heads/NOMBRE

WORKFLOWS:
- Listar: GET /repos/OWNER/REPO/actions/workflows
- Runs: GET /repos/OWNER/REPO/actions/workflows/ID/runs
- Re-ejecutar: POST /repos/OWNER/REPO/actions/runs/ID/rerun

REGLAS DE ENDPOINTS:
- Repos del usuario autenticado: "/user/repos" (NUNCA "/users/{username}/repos")
- Perfil del usuario: "/user" (NUNCA "/users/{username}")
- Nunca uses placeholders como {username}, {owner}, {repo} — usa el nombre real
- Para archivos: "/repos/OWNER/REPO/contents/RUTA"
- Siempre especifica el campo "target"

REGLA DE requiereConfirmacion:
- false → SOLO LECTURA: listar, ver archivos, obtener info
- true → MODIFICAR: crear, actualizar, eliminar, cerrar, fusionar

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
️ RECORDATORIO FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. El usuario quiere un ASISTENTE CONVERSACIONAL que también sepa de GitHub
2. Por DEFECTO, responde en texto/Markdown con consejos y opiniones
3. SOLO usa JSON cuando te pidan EXPLÍCITAMENTE hacer una acción en GitHub
4. Si no estás seguro → MODO CONVERSACIÓN
5. NUNCA digas "no puedo hacer eso" — siempre puedes opinar o aconsejar
6. NUNCA leas repositorios sin que te lo pidan explícitamente`;

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

// ── Unified callAI (Zero-Storage: parameters passed explicitly) ───────────────
/**
 * Call the AI provider with the given messages and system prompt.
 *
 * ZERO-STORAGE: This function accepts provider, apiKey, and model as explicit
 * parameters. It does NOT read from sessionStorage. The caller must obtain
 * these values from React context (useAIProvider()) and pass them here.
 *
 * @param provider     - 'groq' or 'gemini'
 * @param apiKey       - The provider's API key (from React state, NOT storage)
 * @param model        - The model name (e.g., 'gpt-4', 'gemini-2.5-flash')
 * @param messages     - Chat history
 * @param systemPrompt - System instructions for the model
 * @returns The model's response text
 * @throws Error if the API call fails
 */
export async function callAI(
  provider: AIProviderType,
  apiKey: string,
  model: string,
  messages: Message[],
  systemPrompt: string = SYSTEM_PROMPT,
): Promise<string> {
  if (provider === 'groq') return callGroq(apiKey, model, messages, systemPrompt);
  return callGeminiDirect(apiKey, model, messages, systemPrompt);
}

/** @deprecated Use callAI() directly with explicit parameters. */
export const callGemini = callAI;

// ── Key validation ───────────────────────────────────────────────────────────
/**
 * Validate that a provider API key is valid by making a test call.
 *
 * ZERO-STORAGE: This function accepts credentials as explicit parameters.
 *
 * @param provider - 'groq' or 'gemini'
 * @param apiKey   - The provider's API key
 * @param model    - The model name
 * @returns Object with valid flag and optional error message
 */
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
  // Try markdown code fence
  let match = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) return JSON.parse(match[1]);

  // Try plain backticks
  match = rawText.match(/`([\s\S]*?)`/);
  if (match) return JSON.parse(match[1]);

  // Try to find JSON object in the text
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (jsonMatch) return JSON.parse(jsonMatch[0]);

  throw new Error('No JSON found in response');
}

// ── Repository documentation generation ───────────────────────────────────────
/**
 * Generate comprehensive documentation for a repository using the AI provider.
 *
 * ZERO-STORAGE: This function accepts provider credentials as explicit parameters.
 *
 * @param provider       - 'groq' or 'gemini'
 * @param apiKey         - The provider's API key
 * @param model          - The model name
 * @param repoName       - Repository name (for context)
 * @param files          - Array of repo files with content
 * @returns GeneratedDocs with readme, manualTecnico, and optional metadata
 */
export async function generateRepoDocs(
  provider: AIProviderType,
  apiKey: string,
  model: string,
  repoName: string,
  files: RepoFile[],
): Promise<GeneratedDocs> {
  const primaryLang = detectPrimaryLanguage(files);
  const filesContext = files
    .slice(0, 20)
    .map(f => `\n### ${f.path}\n\`\`\`\n${f.content?.slice(0, 500) || '(no content)'}\n\`\`\``)
    .join('\n');

  const docPrompt = `Eres un experto en documentación técnica. Analiza este repositorio y genera:

1. Un README.md profesional con descripción, características, instalación y uso.
2. Un MANUAL_TECNICO.md con arquitectura, componentes y decisiones de diseño.

Repo: ${repoName}
Lenguaje principal: ${primaryLang}

Archivos analizados:
${filesContext}

Responde SOLO con un JSON válido (sin markdown, sin \`\`\`json):
{
  "readme": "contenido del README en markdown",
  "manualTecnico": "contenido del MANUAL_TECNICO en markdown",
  "resumen": "resumen de 1-2 líneas",
  "metadatos": { "lenguaje": "${primaryLang}", "archivosAnalizados": ${files.length} }
}`;

  const response = await callAI(provider, apiKey, model, [
    { role: 'user', content: docPrompt },
  ]);

  const parsed = extractJSON(response);
  return {
    readme: (parsed.readme as string) || '',
    manualTecnico: (parsed.manualTecnico as string) || '',
    resumen: (parsed.resumen as string) || '',
    metadatos: (parsed.metadatos as Record<string, unknown>) || {},
  };
}

/**
 * Check if a response is in Markdown/conversation mode (not a JSON action).
 * This is useful for rendering Markdown content with proper formatting.
 * 
 * @param rawText - The raw response from the AI
 * @returns true if the response is Markdown/conversation, false if it's a JSON action
 */
export function isMarkdownResponse(rawText: string): boolean {
  // If parseGeminiAction returns null, it's Markdown
  return parseGeminiAction(rawText) === null;
}
