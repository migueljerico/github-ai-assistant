// ────────────────────────────────────────────────────────────────────────────
// Registro de proveedores de IA — fuente única de verdad.
//
// Describe cada proveedor (config ESTÁTICA, sin secretos): cómo se llama, su
// transporte (proxy de Gemini vs OpenAI-compatible), endpoints, modelos, dónde
// obtener la key, etc. El resto del código (callAI, validación, panel, badge)
// consume este registro, de modo que añadir un proveedor nuevo es rellenar una
// entrada aquí — no tocar media docena de ficheros.
//
// ZERO-STORAGE: este módulo NO maneja credenciales. La API key del usuario sigue
// viviendo solo en estado de React (AIProviderContext). Lo único que se cachea en
// sessionStorage es la LISTA de modelos (catálogo), nunca la clave.
// ────────────────────────────────────────────────────────────────────────────

export type AIProviderType = 'gemini' | 'groq' | 'openrouter';
export type ProviderTransport = 'gemini-proxy' | 'openai-compatible';

export interface ModelOption {
  value: string;
  label: string; // Puede ser una clave de traducción o un texto literal
  description?: string; // Clave de traducción
  recommended?: boolean;
  free?: boolean;
}

export interface ProviderDef {
  id: AIProviderType;
  name: string;        // nombre completo, p.ej. "Google Gemini"
  shortName: string;   // nombre corto para el badge, p.ej. "Gemini"
  emoji: string;
  cardDesc: string;    // clave de traducción
  transport: ProviderTransport;
  chatEndpoint?: string;     // solo openai-compatible
  modelsEndpoint?: string;   // solo openai-compatible (catálogo dinámico)
  modelsNeedKey?: boolean;   // ¿el endpoint de modelos requiere Authorization?
  staticModels: ModelOption[];
  defaultModel: string;
  keyPlaceholder: string;
  keyPrefix?: string;        // comprobación ligera en cliente (no validación real)
  signupUrl: string;
  signupLabel: string; // clave de traducción
  note?: string;             // clave de traducción
  extraHeaders?: Record<string, string>;
  // #50: presupuesto de contexto adaptativo para que el chat con repo cargado
  // funcione también en modelos con TPM bajo (p. ej. Groq free rechazaba la
  // petición por tamaño). Si se omite, runSend usa los defaults 12 archivos / 80 líneas.
  contextBudget?: { maxFiles: number; maxLinesPerFile: number };
}

// Catálogo FIJO de Gemini. El listado dinámico vía proxy fue retirado: la API
// de Google no era fiable en prod (CORS/fallo del proxy), devolvía modelos
// incompatibles y el usuario no veía los modelos correctos. Esta lista es la
// fuente única de verdad — contiene exactamente los modelos operativos.
const GEMINI_MODELS: ModelOption[] = [
  {
    value: 'gemini-2.5-flash',
    label: 'provider.gemini.model.recommended',
    description: 'provider.gemini.model.recommendedDesc',
    recommended: true,
  },
  {
    value: 'gemini-2.5-pro',
    label: 'provider.gemini.model.pro',
    description: 'provider.gemini.model.proDesc',
  },
  {
    value: 'gemini-3.5-flash',
    label: 'provider.gemini.model.flash35',
    description: 'provider.gemini.model.flash35Desc',
  },
  {
    value: 'gemini-3.1-flash-lite',
    label: 'provider.gemini.model.flash31Lite',
    description: 'provider.gemini.model.flash31LiteDesc',
  },
  {
    value: 'gemini-2.0-flash',
    label: 'provider.gemini.model.flash20',
    description: 'provider.gemini.model.flash20Desc',
  },
  {
    value: 'gemma-4-31b-it',
    label: 'provider.gemini.model.gemma',
    description: 'provider.gemini.model.gemmaDesc',
  },
];

// Fallback de Groq mientras carga el catálogo o si la API falla.
// Ordenado por relevancia en el tier gratuito. `llama-3.1-8b-instant` como default
// (rápido y fiable). `llama-3.3-70b-versatile` queda segundo aunque se deprecie
// en agosto — al recargar el catálogo desaparece solo del selector; aquí es red de
// seguridad si la API falla.
const GROQ_FALLBACK: ModelOption[] = [
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (fast)' },
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (versatile)' },
  { value: 'gemma2-9b-it', label: 'Gemma 2 9B' },
  { value: 'llama3-70b-8192', label: 'Llama 3 70B' },
  { value: 'llama3-8b-8192', label: 'Llama 3 8B' },
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
];

// Prefijos de modelos Groq no-chat que se excluyen del selector.
export const GROQ_EXCLUDED = ['whisper', 'distil-whisper', 'playai', 'llama-guard', 'tts'];

// Subcadenas de modelos Gemini no generativos (embeddings, visión, etc.) que se
// excluyen del selector. Debe coincidir con el filtro del backend (#58).
export const GEMINI_EXCLUDED = ['embed', 'vision', 'aqa', 'imagen', 'chirp'];

// Fallback de OpenRouter mientras carga el catálogo o si la API falla.
// Modelos gratuitos (:free) conocidos y estables.
const OPENROUTER_FALLBACK: ModelOption[] = [
  { value: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 (free)', free: true },
  { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (free)', free: true },
  { value: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash exp (free)', free: true },
  { value: 'google/gemma-2-9b-it:free', label: 'Gemma 2 9B (free)', free: true },
  { value: 'qwen/qwen-2.5-7b-instruct:free', label: 'Qwen 2.5 7B (free)', free: true },
  { value: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B (free)', free: true },
  { value: 'nousresearch/hermes-3-llama-3.1-8b:free', label: 'Hermes 3 8B (free)', free: true },
];

export const PROVIDERS: Record<AIProviderType, ProviderDef> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    shortName: 'Gemini',
    emoji: '🤖',
    cardDesc: 'provider.gemini.cardDesc',
    transport: 'gemini-proxy',
    // Catálogo FIJO: no hay modelsEndpoint, así que AIProviderPanel usa
    // directamente staticModels sin intentar ningún fetch dinámico.
    staticModels: GEMINI_MODELS,
    defaultModel: GEMINI_MODELS[0].value,
    keyPlaceholder: 'AIzaSy...',
    // Prefijo real de las keys de Google AI Studio (AIzaSy…). Validación ligera
    // en cliente (no es una validación real de la clave).
    keyPrefix: 'AIza',
    signupUrl: 'https://aistudio.google.com/apikey',
    signupLabel: 'provider.gemini.signupLabel',
  },
  groq: {
    id: 'groq',
    name: 'Groq Cloud',
    shortName: 'Groq',
    emoji: '⚡',
    cardDesc: 'provider.groq.cardDesc',
    transport: 'openai-compatible',
    chatEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
    modelsEndpoint: 'https://api.groq.com/openai/v1/models',
    modelsNeedKey: true,
    staticModels: GROQ_FALLBACK,
    defaultModel: GROQ_FALLBACK[0].value,
    keyPlaceholder: 'gsk_...',
    keyPrefix: 'gsk_',
    signupUrl: 'https://console.groq.com',
    signupLabel: 'provider.groq.signupLabel',
    // #50: el tier gratuito de Groq tiene un TPM bajo (~6-12k) y rechazaba el
    // contexto completo (12 archivos / 80 líneas). Aquí lo recortamos para que
    // el chat con repo cargado funcione sin superar el límite.
    contextBudget: { maxFiles: 6, maxLinesPerFile: 60 },
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    shortName: 'OpenRouter',
    emoji: '🌐',
    cardDesc: 'provider.openrouter.cardDesc',
    transport: 'openai-compatible',
    chatEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
    modelsEndpoint: 'https://openrouter.ai/api/v1/models',
    modelsNeedKey: false, // el catálogo de OpenRouter es público
    staticModels: OPENROUTER_FALLBACK,
    defaultModel: OPENROUTER_FALLBACK[0].value,
    keyPlaceholder: 'sk-or-...',
    keyPrefix: 'sk-or-',
    signupUrl: 'https://openrouter.ai/keys',
    signupLabel: 'provider.openrouter.signupLabel',
    note: 'provider.openrouter.note',
    extraHeaders: { 'X-Title': 'GitHub AI Assistant' },
  },
};

export function getProvider(id: AIProviderType): ProviderDef {
  return PROVIDERS[id];
}

// ── Elección de modelo por defecto ────────────────────────────────────────────
// Los endpoints :free de OpenRouter están a menudo saturados/caídos ("Provider
// returned error"), pero unos pocos suelen estar disponibles. Cuando el catálogo
// se carga, preferimos uno de esos modelos fiables como default en vez de un :free
// arbitrario (el primero alfabético), para que la primera petición tenga más
// probabilidad de funcionar. Comparación por substring sobre el `value` del modelo.
// Nota: `llama` (genérico) en vez de `llama-3.3-70b` para ser robusto a las
// deprecaciones de Groq (Llama 3.3 70B se retira en agosto; el catálogo es dinámico).
const RELIABLE_MODEL_PREFS = ['gemma', 'llama', 'deepseek', 'qwen'];

/**
 * Escoge un modelo por defecto de un catálogo: prioriza modelos gratuitos fiables
 * conocidos (Gemma, Llama 3.3 70B, DeepSeek…), luego cualquier gratuito, luego el
 * primero de la lista. Si no hay modelos, devuelve `fallback`.
 */
export function pickDefaultModel(models: ModelOption[], fallback = ''): string {
  if (models.length === 0) return fallback;
  const free = models.filter(m => m.free);
  const pool = free.length > 0 ? free : models;
  for (const pref of RELIABLE_MODEL_PREFS) {
    const hit = pool.find(m => m.value.toLowerCase().includes(pref));
    if (hit) return hit.value;
  }
  return pool[0].value;
}

// ── Catálogo dinámico de modelos ──────────────────────────────────────────────

interface OpenRouterModel {
  id: string;
  name?: string;
  pricing?: { prompt?: string; completion?: string };
}

/** Indica si un modelo de OpenRouter es gratuito (por sufijo o por pricing a 0). */
function isFreeOpenRouterModel(m: OpenRouterModel): boolean {
  if (m.id.endsWith(':free')) return true;
  const p = m.pricing;
  if (!p) return false;
  return (p.prompt === '0' || p.prompt === '0.0') && (p.completion === '0' || p.completion === '0.0');
}

const MODELS_CACHE_TTL = 3_600_000; // 1 hora

/**
 * Carga el catálogo de modelos de un proveedor OpenAI-compatible.
 * Cachea la LISTA (no la key) en sessionStorage durante 1h.
 * Devuelve `null` si el proveedor no tiene catálogo dinámico o si falla.
 */
export async function fetchModels(
  def: ProviderDef,
  apiKey?: string,
): Promise<ModelOption[] | null> {
  if (!def.modelsEndpoint) return null;
  if (def.modelsNeedKey && !apiKey) return null;

  const cacheKey = `${def.id}_models_cache`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      const { models, ts } = JSON.parse(cached) as { models: ModelOption[]; ts: number };
      if (Date.now() - ts < MODELS_CACHE_TTL) return models;
    } catch { /* cache corrupta — ignorar */ }
  }

  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(def.modelsEndpoint, { headers });
  if (!res.ok) throw new Error(`models endpoint error ${res.status}`);
  const data = await res.json() as { data: Array<{ id: string; name?: string; pricing?: { prompt?: string; completion?: string } }> };

  let models: ModelOption[];
  if (def.id === 'openrouter') {
    models = data.data
      .map(m => ({
        value: m.id,
        label: m.name || m.id,
        free: isFreeOpenRouterModel(m),
      }))
      // gratis primero, luego alfabético por etiqueta
      .sort((a, b) => (Number(b.free) - Number(a.free)) || a.label.localeCompare(b.label));
  } else if (def.id === 'gemini') {
    // #58 (v3.23.0): catálogo dinámico de Gemini vía proxy. El backend ya filtra
    // los no-generativos, pero repetimos el filtro aquí (defensa en profundidad).
    models = data.data
      .filter(m => !GEMINI_EXCLUDED.some(p => m.id.includes(p)))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(m => ({ value: m.id, label: m.name || m.id }));
  } else {
    // Groq (y cualquier OpenAI-compatible genérico): filtra no-chat
    models = data.data
      .filter(m => !GROQ_EXCLUDED.some(p => m.id.startsWith(p)))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(m => ({ value: m.id, label: m.id }));
  }

  if (models.length === 0) throw new Error('empty catalog');

  sessionStorage.setItem(cacheKey, JSON.stringify({ models, ts: Date.now() }));
  return models;
}
