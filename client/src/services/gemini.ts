// ─────────────────────────────────────────────────────────────────────────────
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
// ─────────────────────────────────────────────────────────────────────────────

import type { GeminiAction } from '../types';
import type { AIProviderType } from '../context/AIProviderContext';

// ── System prompt ─────────────────────────────────────────────────────────────
//
// DESIGN DECISIONS:
//
// 1. JSON-only responses: We instruct the AI to respond ONLY with a JSON object.
//    This makes responses machine-parseable so the frontend can display a
//    structured confirmation UI (not just a text blob).
//
// 2. Never execute: The AI is explicitly told NOT to execute actions. It only
//    generates a description. Execution happens in actionExecutor.ts after the
//    user confirms in the UI. This is the key safety guarantee of the system.
//
// 3. Endpoint rules: Early versions of the app had the AI generate placeholder
//    endpoints like `/users/{username}/repos` which the GitHub API rejected with
//    404. The explicit rules below prevent this, with resolveEndpoint() in
//    actionExecutor.ts as a second safety net.
//
// 4. Language: The prompt is in Spanish because the target user interacts in
//    Spanish. The JSON field names are in Spanish for the same reason.

export const SYSTEM_PROMPT = `Eres un agente experto en la GitHub REST API v3.
Cuando el usuario te dé una instrucción en lenguaje natural, responde
ÚNICAMENTE con un JSON que describa la acción a tomar, antes de ejecutarla.

Formato del JSON de respuesta:
{
  "tipo": "lectura|escritura|creacion|listado",
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

Para operaciones de escritura en archivos existentes, incluye
"contenidoActual" con el contenido actual del archivo (obtenido
previamente con GET) para permitir mostrar el diff.

Nunca ejecutes directamente — solo genera el JSON descriptivo.
El frontend se encargará de la confirmación y ejecución.

IMPORTANTE: responde SOLO con el JSON, sin texto adicional, sin markdown, sin \`\`\`json.`;

// ── Message type ──────────────────────────────────────────────────────────────

/** A single message in the conversation history */
export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// ── Read provider config from sessionStorage ──────────────────────────────────

/**
 * Read the active AI provider configuration from sessionStorage.
 * Throws if no provider has been connected yet (should not happen in normal
 * flow because AIProviderGate prevents reaching this code without a valid config).
 *
 * @returns { provider, apiKey, model } — all guaranteed non-null
 * @throws Error if any required key is missing from sessionStorage
 */
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

/** Base URL for the Groq OpenAI-compatible chat completions endpoint */
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Call the Groq Cloud API using the OpenAI-compatible REST endpoint.
 * Calls are made directly from the browser — no EU restriction applies to Groq.
 *
 * Message translation from internal format to OpenAI format:
 *   'assistant' → role 'assistant'
 *   'user'      → role 'user'
 *   systemPrompt is prepended as a separate 'system' message
 *
 * Settings: temperature 0.1 (low, deterministic JSON output), max_tokens 4096
 *
 * @param apiKey       - Groq API key (starts with `gsk_`)
 * @param model        - Model identifier (e.g. `llama-3.3-70b-versatile`)
 * @param messages     - Conversation history in internal Message format
 * @param systemPrompt - System-level instruction prepended to the message array
 * @returns The assistant's text response
 * @throws Error with HTTP status attached if the API returns an error
 */
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

// ── Gemini implementation (proxied through server) ────────────────────────────

/**
 * Call the Google Gemini API via the server-side proxy endpoint (/api/gemini).
 *
 * WHY A PROXY: The Gemini API (generativelanguage.googleapis.com) blocks direct
 * browser requests from EU/EEA regions. By routing calls through the Express
 * server deployed in us-central1 (Cloud Run), the restriction is bypassed.
 *
 * The full conversation structure (messages array + systemPrompt) is preserved —
 * the server reconstructs the multi-turn chat using the Gemini SDK before
 * forwarding the request, so context is maintained exactly as in the direct call.
 *
 * Security: the API key is sent in the HTTPS request body and is never stored,
 * logged or cached by the server. It is used only for this single SDK call.
 *
 * @param apiKey       - Google AI Studio API key (starts with `AIzaSy`)
 * @param model        - Gemini model identifier (e.g. `gemini-2.0-flash`)
 * @param messages     - Conversation history in internal Message format
 * @param systemPrompt - System instruction forwarded to the proxy
 * @returns The model's text response
 * @throws Error with HTTP status from the proxy if the Gemini API returns an error
 */
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

// ── Unified callAI ────────────────────────────────────────────────────────────

/**
 * Unified AI call function — routes to the correct provider based on the
 * configuration stored in sessionStorage by AIProviderPanel.
 *
 * Routing logic:
 *   provider === 'groq'    → callGroq()         (direct browser → Groq API)
 *   provider === 'gemini'  → callGeminiDirect()  (browser → /api/gemini → Gemini)
 *
 * The system prompt defaults to SYSTEM_PROMPT (GitHub agent) but can be
 * overridden for other use cases (e.g. generateRepoDocs uses a documentation prompt).
 *
 * @param messages     - Full conversation history including the new user message
 * @param systemPrompt - Instruction for the AI (defaults to SYSTEM_PROMPT)
 * @returns The AI's response text
 * @throws Error if no provider is configured or the API call fails
 */
export async function callAI(
  messages: Message[],
  systemPrompt: string = SYSTEM_PROMPT,
): Promise<string> {
  const { provider, apiKey, model } = getConfig();

  if (provider === 'groq') {
    return callGroq(apiKey, model, messages, systemPrompt);
  }
  // Default: gemini (proxied through server)
  return callGeminiDirect(apiKey, model, messages, systemPrompt);
}

/**
 * Backward-compatible alias for callAI.
 * @deprecated Use callAI() directly.
 */
export const callGemini = callAI;

// ── Key validation ────────────────────────────────────────────────────────────

/**
 * Validate an AI provider API key by making a real test call.
 *
 * Sends a minimal prompt ("Hi" with system "Reply with one word.") to
 * avoid consuming tokens. Error handling:
 *   - HTTP 401 / `API_KEY_INVALID` / `invalid_api_key` → key is invalid
 *   - HTTP 429 → quota exceeded but key is valid → treated as success
 *   - Any other error → propagated as an error message
 *
 * @param provider - The AI provider to validate against
 * @param apiKey   - The API key to test
 * @param model    - The model to use for the test call
 * @returns `{ valid: true }` on success, `{ valid: false, error: string }` on failure
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

    if (
      status === 401 ||
      message.includes('401') ||
      message.toLowerCase().includes('api_key_invalid') ||
      message.toLowerCase().includes('invalid_api_key')
    ) {
      return {
        valid: false,
        error: 'Clave inválida, compruébala en tu panel de ' +
          (provider === 'groq' ? 'Groq' : 'Google AI Studio'),
      };
    }
    if (status === 429 || message.includes('429')) {
      // Quota exhausted but key is valid — let them proceed
      return { valid: true };
    }
    return { valid: false, error: message || 'Error de conexión con el proveedor de IA' };
  }
}

// ── Response parsing ──────────────────────────────────────────────────────────

/**
 * Parse the raw AI text response into a `GeminiAction` object.
 *
 * The AI is instructed to return pure JSON, but may occasionally wrap it in
 * markdown code fences. This function strips those fences before parsing.
 *
 * Returns `null` if:
 * - The text is not valid JSON
 * - The JSON is missing required fields (`tipo`, `accion`, `metodo`)
 * - The AI returned a plain-text response (treated as a conversational reply)
 *
 * @param rawText - Raw text response from the AI
 * @returns Parsed GeminiAction or null if the response is not an action JSON
 */
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

// ── Repo documentation generator ──────────────────────────────────────────────

/**
 * Generate README.md and MANUAL_TECNICO.md content for a repository.
 *
 * Workflow:
 * 1. Receives a flat list of files with their decoded content
 * 2. Builds a prompt including each file's path and first 2000 chars of content
 * 3. Calls `callAI()` with a documentation-specific system prompt
 * 4. Parses the returned JSON: `{ readme: string, manualTecnico: string }`
 *
 * @param repoName - Full repo name in `owner/repo` format
 * @param fileTree - Array of files with their paths and decoded content
 * @returns Object containing `readme` and `manualTecnico` as markdown strings
 * @throws Error if the AI response is not valid JSON or missing expected fields
 */
export async function generateRepoDocs(
  repoName: string,
  fileTree: Array<{ path: string; content: string }>,
): Promise<{ readme: string; manualTecnico: string }> {
  const docSystemPrompt = `Eres un experto en documentación de software.
Analiza la estructura y el código del repositorio proporcionado y genera documentación completa.
Responde ÚNICAMENTE con un JSON con este formato exacto:
{
  "readme": "contenido completo del README.md en markdown",
  "manualTecnico": "contenido completo del MANUAL_TECNICO.md en markdown"
}
El README debe incluir: badges relevantes, descripción, instalación, uso, estructura de archivos, herramientas/dependencias, y licencia.
El MANUAL_TECNICO debe incluir: arquitectura, flujo de datos, configuración, APIs/endpoints, y guía de despliegue.
Responde SOLO con el JSON, sin texto adicional.`;

  const treeText = fileTree
    .map(f => `### Archivo: ${f.path}\n${f.content.slice(0, 2000)}${f.content.length > 2000 ? '\n[... truncado ...]' : ''}`)
    .join('\n\n---\n\n');

  const userMessage = `Repositorio: ${repoName}\n\nArchivos:\n\n${treeText}`;

  const rawText = await callAI(
    [{ role: 'user', content: userMessage }],
    docSystemPrompt,
  );

  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  const parsed = JSON.parse(cleaned);
  return { readme: parsed.readme, manualTecnico: parsed.manualTecnico };
}
