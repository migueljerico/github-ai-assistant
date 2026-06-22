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
  label: string;
  description?: string;
  recommended?: boolean;
  free?: boolean;
}

export interface ProviderDef {
  id: AIProviderType;
  name: string;        // nombre completo, p.ej. "Google Gemini"
  shortName: string;   // nombre corto para el badge, p.ej. "Gemini"
  emoji: string;
  cardDesc: string;    // subtítulo de la tarjeta de selección
  transport: ProviderTransport;
  chatEndpoint?: string;     // solo openai-compatible
  modelsEndpoint?: string;   // solo openai-compatible (catálogo dinámico)
  modelsNeedKey?: boolean;   // ¿el endpoint de modelos requiere Authorization?
  staticModels: ModelOption[];
  defaultModel: string;
  keyPlaceholder: string;
  keyPrefix?: string;        // comprobación ligera en cliente (no validación real)
  signupUrl: string;
  signupLabel: string;
  note?: string;             // aviso opcional bajo el selector (p.ej. deprecación)
  extraHeaders?: Record<string, string>;
}

// Modelos de Gemini (movidos desde AIProviderPanel).
// IMPORTANTE: gemini-2.0-flash, 1.5-flash y 1.5-pro tienen cuota gratuita = 0
// (Google) y devuelven 429. Solo la familia 2.5-* tiene cuota gratuita activa.
const GEMINI_MODELS: ModelOption[] = [
  {
    value: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash ⭐ Recomendado',
    description:
      'Mejor calidad · Ideal para generación de documentación completa de repositorios · ~500 peticiones/día gratuitas',
    recommended: true,
  },
  {
    value: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    description:
      'Más rápido y más cuota gratuita · Puede generar documentación incompleta en repos grandes · Recomendado solo para instrucciones simples',
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
    cardDesc: 'Modelos 2.5 · free tier activo',
    transport: 'gemini-proxy',
    staticModels: GEMINI_MODELS,
    defaultModel: GEMINI_MODELS[0].value,
    keyPlaceholder: 'AIzaSy...',
    signupUrl: 'https://aistudio.google.com/apikey',
    signupLabel: 'Obtener clave gratuita en aistudio.google.com →',
    note: 'ℹ️ Los modelos gemini-2.0 y gemini-1.5 están deprecados y tienen cuota = 0. Solo usa modelos 2.5.',
  },
  groq: {
    id: 'groq',
    name: 'Groq Cloud',
    shortName: 'Groq',
    emoji: '⚡',
    cardDesc: 'Ultrarrápido · Tier gratuito muy generoso',
    transport: 'openai-compatible',
    chatEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
    modelsEndpoint: 'https://api.groq.com/openai/v1/models',
    modelsNeedKey: true,
    staticModels: GROQ_FALLBACK,
    defaultModel: GROQ_FALLBACK[0].value,
    keyPlaceholder: 'gsk_...',
    keyPrefix: 'gsk_',
    signupUrl: 'https://console.groq.com',
    signupLabel: 'Obtener clave gratuita en console.groq.com →',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    shortName: 'OpenRouter',
    emoji: '🌐',
    cardDesc: 'Pasarela a 300+ modelos · gratis y de pago (OpenAI, Claude, Llama…)',
    transport: 'openai-compatible',
    chatEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
    modelsEndpoint: 'https://openrouter.ai/api/v1/models',
    modelsNeedKey: false, // el catálogo de OpenRouter es público
    staticModels: OPENROUTER_FALLBACK,
    defaultModel: OPENROUTER_FALLBACK[0].value,
    keyPlaceholder: 'sk-or-...',
    keyPrefix: 'sk-or-',
    signupUrl: 'https://openrouter.ai/keys',
    signupLabel: 'Obtener clave (incluye modelos gratuitos) en openrouter.ai →',
    note: '🆓 Los modelos marcados son gratuitos. Una sola key da acceso también a OpenAI, Claude y Llama (de pago).',
    extraHeaders: { 'X-Title': 'GitHub AI Assistant' },
  },
};

export function getProvider(id: AIProviderType): ProviderDef {
  return PROVIDERS[id];
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
