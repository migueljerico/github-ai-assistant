import type { GeminiAction } from '../types';
import type { AIProviderType } from '../context/AIProviderContext';

// ── SYSTEM PROMPTS SEPARADOS (Opción D) ───────────────────────────────────────

export const CHAT_PROMPT = `Eres un desarrollador senior experto en arquitectura de software, GitHub y mejores prácticas.

Tu comportamiento por defecto es CONVERSAR y DAR OPINIONES en texto normal (Markdown).

✅ Responde directamente con:
- Opiniones constructivas sobre código y arquitectura
- Análisis de patrones y mejores prácticas
- Consejos sobre seguridad, rendimiento y mantenibilidad
- Explicaciones técnicas detalladas
- Recomendaciones personalizadas

❌ NUNCA generes JSON en este modo
❌ NUNCA digas "necesito leer el repo primero"
❌ NUNCA ejecutes acciones de la API

Eres un consultor experto - DA TU OPINIÓN directamente con tu conocimiento.`;

export const ACTION_PROMPT = `Eres un agente experto en la GitHub REST API v3.

SOLO genera JSON cuando el usuario pida EXPLÍCITAMENTE una acción:
- "lista", "muestra", "enséñame"
- "crea", "genera"
- "actualiza", "modifica", "edita"
- "borra", "elimina"
- "lee", "abre" (un archivo)
- "fusiona", "cierra", "reabre"

Formato JSON:
{
  "tipo": "lectura|escritura|creacion|listado|borrado",
  "accion": "descripción",
  "endpoint": "endpoint exacto",
  "metodo": "GET|POST|PUT|PATCH|DELETE",
  "repo": "nombre o null",
  "archivo": "ruta o null",
  "contenidoPropuesto": "contenido o null",
  "payload": {},
  "requiereConfirmacion": true,
  "target": "file|issue|pr|branch|workflow"
}

Endpoints:
- User repos: GET /user/repos
- User profile: GET /user
- Archivos: GET/PUT/DELETE /repos/OWNER/REPO/contents/RUTA
- Issues: GET/POST/PATCH /repos/OWNER/REPO/issues
- PRs: GET/POST/PUT /repos/OWNER/REPO/pulls

Reglas:
- Usa "/user/repos" (NUNCA "/users/{username}/repos")
- requiereConfirmacion: false para lectura, true para escritura`;

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

// ── Groq implementation (Tier 2 - Solo acciones, llamada directa) ─────────────
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
    temperature: 0.7,  // ← Aumentado para respuestas más naturales
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

// ── Gemini implementation (Tier 1 - Modo dual, proxiado con 'mode') ───────────
// 🔥 OPCIÓN D: Ahora acepta 'mode' y lo envía al backend para que configure
// las tools nativas de Gemini dinámicamente.
async function callGeminiDirect(
  apiKey: string,
  model: string,
  messages: Message[],
  systemPrompt: string,
  mode: 'chat' | 'action' = 'chat',  // ← NUEVO: modo por defecto 'chat'
): Promise<string> {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      apiKey, 
      model, 
      messages, 
      systemPrompt,
      mode,  // ← ENVIAR MODO AL BACKEND
    }),
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

// ── Unified callAI (Opción D - con mode) ──────────────────────────────────────
/**
 * Call the AI provider with the given messages, system prompt and mode.
 *
 * OPCIÓN D: El parámetro 'mode' controla el comportamiento del modelo:
 * - 'chat': Modo conversacional (Tier 1 - Gemini). El backend NO inyecta tools.
 * - 'action': Modo acción (Tier 1 - Gemini). El backend SÍ inyecta tools nativas.
 *
 * Para Groq (Tier 2), el 'mode' se ignora porque va directo al navegador.
 *
 * @param provider     - 'groq' or 'gemini'
 * @param apiKey       - The provider's API key (from React state, NOT storage)
 * @param model        - The model name (e.g., 'gpt-4', 'gemini-2.5-flash')
 * @param messages     - Chat history
 * @param systemPrompt - System instructions for the model
 * @param mode         - 'chat' | 'action' (solo afecta a Gemini)
 * @returns The model's response text
 * @throws Error if the API call fails
 */
export async function callAI(
  provider: AIProviderType,
  apiKey: string,
  model: string,
  messages: Message[],
  systemPrompt: string = CHAT_PROMPT,
  mode: 'chat' | 'action' = 'chat',  // ← NUEVO: modo por defecto 'chat'
): Promise<string> {
  if (provider === 'groq') return callGroq(apiKey, model, messages, systemPrompt);
  return callGeminiDirect(apiKey, model, messages, systemPrompt, mode);
}

/** @deprecated Use callAI() directly with explicit parameters. */
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
      // Para validación usamos modo 'chat' (no necesitamos tools)
      await callGeminiDirect(
        apiKey, 
        model, 
        [{ role: 'user', content: 'Hi' }], 
        'Reply with one word.',
        'chat'
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
        error: 'Clave inválida, compruébala en tu panel de ' +
          (provider === 'groq' ? 'Groq' : 'Google AI Studio'),
      };
    }
    if (status === 429 || message.includes('429')) return { valid: true };
    return { valid: false, error: message || 'Error de conexión' };
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
function extractJSON(rawText: string): Record<string, unknown> {
  let match = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) return JSON.parse(match[1]);

  match = rawText.match(/`([\s\S]*?)`/);
  if (match) return JSON.parse(match[1]);

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (jsonMatch) return JSON.parse(jsonMatch[0]);

  throw new Error('No JSON found');
}

// ── Repository documentation generation ───────────────────────────────────────
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
    .map(f => `\n### ${
