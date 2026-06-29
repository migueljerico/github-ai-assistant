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
}

// Modelos de Gemini (movidos desde AIProviderPanel).
// IMPORTANTE: gemini-2.0-flash, 1.5-flash y 1.5-pro tienen cuota gratuita = 0
// (Google) y devuelven 429. Solo la familia 2.5-* tiene cuota gratuita activa.
const GEMINI_MODELS: ModelOption[] = [
  {
    value: 'gemini-2.5-flash',
    label: 'provider.gemini.model.recommended',
    description: 'provider.gemini.model.recommendedDesc',
    recommended: true,
  },
  {
    value: 'gemini-2.5-flash-lite',
    label: 'provider.gemini.model.lite',
    description: 'provider.gemini.model.liteDesc',
    recommended: false,
  },
];

const GROQ_FALLBACK: ModelOption[] = [
  { value: 'llama-3.3-70b-versatile', label: 'llama-3.3-70b-versatile' },
  { value: 'llama-3.1-8b-instant', label: 'llama-3.1-8b-instant' },
];

// Prefijos de modelos Groq no-chat que se excluyen del selector.
export const GROQ_EXCLUDED = ['whisper', 'distil-whisper', 'playai', 'llama-guard', 'tts'];

// Fallback de OpenRouter mientras carga el catálogo o si la API falla.
// Modelos gratuitos (:free) conocidos y estables.
const OPENROUTER_FALLBACK: ModelOption[] = [
  { value: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 (free)', free: true },
  { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (free)', free: true },
  { value: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash exp (free)', free: true },
];

export const PROVIDERS: Record<AIProviderType, ProviderDef> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    shortName: 'Gemini',
    emoji: '🤖',
    cardDesc: 'provider.gemini.cardDesc',
    transport: 'gemini-proxy',
    staticModels: GEMINI_MODELS,
    defaultModel: GEMINI_MODELS[0].value,
    keyPlaceholder: 'AIzaSy...',
    signupUrl: 'https://aistudio.google.com/apikey',
    signupLabel: 'provider.gemini.signupLabel',
    note: 'provider.gemini.note',
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
const RELIABLE_MODEL_PREFS = ['gemma', 'llama-3.3-70b', 'deepseek', 'qwen'];

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
