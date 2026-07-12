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

export type AIProviderType = 'gemini' | 'groq' | 'openrouter' | 'nvidia' | 'zenmux' | 'openzen' | 'cloudflare';
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
    value: 'gemini-3-flash-preview',
    label: 'provider.gemini.model.flashPreview',
    description: 'provider.gemini.model.flashPreviewDesc',
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

// Modelos NIM no-chat a excluir del catálogo dinámico (embeddings, rerank, vision, safety, etc.)
export const NIM_EXCLUDED = [
  'embed', 'rerank', 'ranking', 'vision', 'vlm', 'clip',
  'nemo', 'guard', 'safety', 'audio', 'tts', 'asr', 'whisper',
  'retrieval', 'embedding', 'detector', 'nemoretriever', 'parse',
  'neva', 'vila', 'riva', 'nv-embed', 'nvclip', 'content-safety',
  'reasoning', 'ising', 'gliner', 'calibration', 'translate',
];

// URL del feed de modelos destacados de NVIDIA (NGC) para priorizar activos
const NIM_FEATURED_URL = 'https://assets.ngc.nvidia.com/products/api-catalog/featured-models.json';

// Fallback de NVIDIA NIM mientras carga el catálogo o si la API falla.
// Incluye modelos destacados (featured) y modelos clave para documentación de código.
// NIM no distingue gratis/pago en la API → sin flag free.
const NIM_FALLBACK: ModelOption[] = [
  { value: 'nvidia/nemotron-3-ultra-550b-a55b', label: 'Nemotron 3 Ultra ⭐', recommended: true },
  { value: 'z-ai/glm-5.2', label: 'GLM 5.2' },
  { value: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
  { value: 'meta/llama-3.1-405b-instruct', label: 'Llama 3.1 405B' },
  { value: 'mistralai/codestral-22b-instruct-v0.1', label: 'Codestral 22B (código)' },
  { value: 'deepseek-ai/deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { value: 'minimaxai/minimax-m3', label: 'Minimax M3' },
  { value: 'qwen/qwen3-next-80b-a3b-instruct', label: 'Qwen3 Next 80B' },
  { value: 'google/gemma-4-31b-it', label: 'Gemma 4 31B' },
  { value: 'stepfun-ai/step-3.7-flash', label: 'Step 3.7 Flash' },
  { value: 'mistralai/mistral-medium-3.5-128b', label: 'Mistral Medium 3.5' },
  { value: 'nvidia/llama-3.3-nemotron-super-49b-v1.5', label: 'Nemotron Super 49B' },
];

// Fallback de Zenmux — TUS 7 modelos FREE confirmados (4 tuyos + 3 detectados en catálogo)
const ZENMUX_FALLBACK: ModelOption[] = [
  { value: 'stepfun/step-3.7-flash-free', label: 'Step 3.7 Flash', free: true, recommended: true },
  { value: 'x-ai/grok-4.5-free', label: 'Grok 4.5 (500K ctx)', free: true },
  { value: 'z-ai/glm-4.7-flash-free', label: 'GLM 4.7 Flash', free: true },
  { value: 'z-ai/glm-4.6v-flash-free', label: 'GLM 4.6V Flash', free: true },
  { value: 'inclusionai/ling-2.6-flash', label: 'Ling 2.6 Flash', free: true },
  { value: 'minimax/minimax-m2.5-lightning', label: 'MiniMax M2.5 Lightning', free: true },
  { value: 'qwen/qwen3-asr-flash', label: 'Qwen3 ASR Flash', free: true },
];

// Fallback de OpenCode Zen mientras carga el catálogo dinámico o si la API falla.
// El catálogo real es PÚBLICO y se filtra a los modelos gratuitos (sufijo "-free"),
// pero dejamos unos cuantos conocidos como red de seguridad. Token keyless `public`.
const OPENZEN_FALLBACK: ModelOption[] = [
  { value: 'hy3-free', label: 'Hy3 Flash (free)', free: true, recommended: true },
  { value: 'deepseek-v4-flash-free', label: 'DeepSeek V4 Flash (free)', free: true },
  { value: 'mimo-v2.5-free', label: 'Mimo 2.5 (free)', free: true },
  { value: 'nemotron-3-ultra-free', label: 'Nemotron 3 Ultra (free)', free: true },
  { value: 'north-mini-code-free', label: 'North Mini Code (free)', free: true },
];

// Fallback de Cloudflare Workers AI — modelos estables y útiles configurados en ZCode.
// Catálogo ESTÁTICO (sin fetch dinámico que falla por CORS). El proxy /api/cloudflare
// elude el bloqueo del navegador, pero la lista de modelos es fija: los que el usuario
// tiene configurados aquí.
const CLOUDFLARE_FALLBACK: ModelOption[] = [
  { value: '@cf/moonshotai/kimi-k2.7-code', label: 'Kimi K2.7 Code', recommended: true },
  { value: '@cf/zai-org/glm-5.2', label: 'GLM 5.2' },
  { value: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', label: 'DeepSeek R1 Distill Qwen 32B' },
  { value: '@cf/meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B' },
  { value: '@cf/meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
  { value: '@cf/mistral/mistral-7b-instruct-v0.1', label: 'Mistral 7B' },
  { value: '@cf/qwen/qwen2.5-7b-instruct', label: 'Qwen 2.5 7B' },
  { value: '@cf/google/gemma-2-9b-it', label: 'Gemma 2 9B' },
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
  nvidia: {
    id: 'nvidia',
    name: 'NVIDIA Build (NIM)',
    shortName: 'NIM',
    emoji: '🟢',
    cardDesc: 'provider.nvidia.cardDesc',
    transport: 'openai-compatible',
    // Proxy backend /api/nim (no acceso directo). NVIDIA NIM no envía
    // cabeceras CORS, así que las llamadas directas desde el navegador se
    // bloquean con "Failed to fetch". El proxy en server/index.js reenvía la
    // petición al upstream (https://integrate.api.nvidia.com/v1/chat/completions)
    // de servidor a servidor, donde CORS no aplica (mismo patrón que /api/gemini).
    // El CATÁLOGO de modelos es ESTÁTICO (NIM_FALLBACK): el catálogo dinámico de
    // NIM es enorme y ruidoso (chat + embeddings + rerank + vision + safety…),
    // así que mostramos solo la lista curada de 12 modelos que configuramos aquí.
    chatEndpoint: '/api/nim',
    staticModels: NIM_FALLBACK,
    defaultModel: NIM_FALLBACK[0].value,
    keyPlaceholder: 'nvapi-...',
    keyPrefix: 'nvapi-',
    signupUrl: 'https://build.nvidia.com/explore/discover',
    signupLabel: 'provider.nvidia.signupLabel',
    note: 'provider.nvidia.note',
  },
  zenmux: {
    id: 'zenmux',
    name: 'Zenmux',
    shortName: 'Zenmux',
    emoji: '🧘',
    cardDesc: 'provider.zenmux.cardDesc',
    transport: 'openai-compatible',
    chatEndpoint: 'https://zenmux.ai/api/v1/chat/completions',
    modelsEndpoint: 'https://zenmux.ai/api/v1/models',
    modelsNeedKey: true,
    staticModels: ZENMUX_FALLBACK,
    defaultModel: ZENMUX_FALLBACK[0].value,
    keyPlaceholder: 'sk-ai-v1-...',
    keyPrefix: 'sk-ai-v1-',
    signupUrl: 'https://zenmux.ai',
    signupLabel: 'provider.zenmux.signupLabel',
    note: 'provider.zenmux.note',
  },
  openzen: {
    id: 'openzen',
    name: 'OpenCode Zen',
    shortName: 'OpenCode',
    emoji: '☯️',
    cardDesc: 'provider.openzen.cardDesc',
    transport: 'openai-compatible',
    // Proxy backend /api/openzen (elude bloqueo CORS de opencode.ai).
    // El catálogo es ESTÁTICO (OPENZEN_FALLBACK): el endpoint de modelos opencode.ai
    // no envía Access-Control-Allow-Origin y el navegador lo bloquea. Usamos la lista
    // curada de 5 modelos conocidos.
    chatEndpoint: '/api/openzen',
    modelsNeedKey: false, // OpenCode Zen NO requiere API key (catálogo público)
    staticModels: OPENZEN_FALLBACK,
    defaultModel: OPENZEN_FALLBACK[0].value,
    keyPlaceholder: 'API key de opencode.ai',
    signupUrl: 'https://opencode.ai',
    signupLabel: 'provider.openzen.signupLabel',
    note: 'provider.openzen.note',
  },
  // Cloudflare Workers AI: VA AL FINAL del listado (decisión del usuario).
  // Exige account_id en la ruta URL + token por cuenta; el proxy recibe el
  // account_id por header X-Account-Id y construye la URL del upstream.
  // Catálogo ESTÁTICO (CLOUDFLARE_FALLBACK): los modelos que usa el usuario en ZCode.
  cloudflare: {
    id: 'cloudflare',
    name: 'Cloudflare Workers AI',
    shortName: 'Workers AI',
    emoji: '🟠',
    cardDesc: 'provider.cloudflare.cardDesc',
    transport: 'openai-compatible',
    // Proxy backend /api/cloudflare (elude bloqueo CORS de Cloudflare).
    chatEndpoint: '/api/cloudflare',
    modelsNeedKey: true, // requiere el API token (Bearer) y el account_id
    staticModels: CLOUDFLARE_FALLBACK,
    defaultModel: CLOUDFLARE_FALLBACK[0].value,
    keyPlaceholder: 'API Token de Cloudflare',
    signupUrl: 'https://dash.cloudflare.com/profile/api-tokens',
    signupLabel: 'provider.cloudflare.signupLabel',
    note: 'provider.cloudflare.note',
  },
};

export function getProvider(id: AIProviderType): ProviderDef {
  return PROVIDERS[id];
}

/**
 * Sustituye el marcador `{account_id}` en un endpoint por el accountId real del
 * usuario (p. ej. Cloudflare Workers AI, que lo exige en la ruta URL). Si no hay
 * accountId o el endpoint no tiene el marcador, devuelve la URL sin cambios.
 * Función pura (testeable).
 */
export function resolveEndpoint(endpoint: string, accountId?: string | null): string {
  if (!accountId) return endpoint;
  return endpoint.replace(/\{account_id\}/g, encodeURIComponent(accountId));
}

/**
 * Devuelve la etiqueta legible de un modelo para mostrarla al usuario (p. ej. en
 * la firma de documentación). Si el `value` está en el catálogo estático del
 * proveedor y su `.label` es texto legible (tiene espacios), usa la label; si la
 * label es una clave de traducción (sin espacios, p. ej.
 * "provider.gemini.model.recommended") o el modelo no está en el catálogo,
 * devuelve el `value` tal cual (identificador real y predecible, sin depender de
 * i18n). Función pura (testeable).
 */
export function modelLabel(provider: AIProviderType, model: string): string {
  const def = PROVIDERS[provider];
  const hit = def.staticModels.find(m => m.value === model);
  // Una clave i18n no tiene espacios ("provider.gemini.model.recommended"); una
  // label legible sí ("Llama 3.1 8B (fast)"). Si hay duda, preferimos el value.
  if (hit && /\s/.test(hit.label)) return hit.label;
  return model;
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

interface OpenRouterModelNew {
  id: string;
  name?: string;
  pricing?: { prompt?: Array<{ value: number | string }>; completion?: Array<{ value: number | string }> };
}

/** Indica si un modelo de OpenRouter es gratuito (por sufijo o por pricing a 0). */
function isFreeOpenRouterModel(m: OpenRouterModel | OpenRouterModelNew): boolean {
  if (m.id.endsWith(':free')) return true;
  const p = m.pricing;
  if (!p) return false;
  // Old format: strings
  if (typeof p.prompt === 'string') {
    return (p.prompt === '0' || p.prompt === '0.0') && (p.completion === '0' || p.completion === '0.0');
  }
  // New format: arrays of { value: number | string }
  const promptPrice = p.prompt as Array<{ value: number | string }> | undefined;
  const completionPrice = p.completion as Array<{ value: number | string }> | undefined;
  if (!promptPrice && !completionPrice) return true;
  const allZero = [...(promptPrice || []), ...(completionPrice || [])]
    .every(v => Number(v.value) === 0);
  return allZero;
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
  accountId?: string | null,
): Promise<ModelOption[] | null> {
  if (!def.modelsEndpoint) return null;
  if (def.modelsNeedKey && !apiKey) return null;
  // Cloudflare (y cualquier endpoint con {account_id}) también necesita el accountId.
  if (def.modelsEndpoint.includes('{account_id}') && !accountId) return null;

  const cacheKey = `${def.id}_models_cache${accountId ? '_' + accountId : ''}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      const { models, ts } = JSON.parse(cached) as { models: ModelOption[]; ts: number };
      if (Date.now() - ts < MODELS_CACHE_TTL) return models;
    } catch { /* cache corrupta — ignorar */ }
  }

  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(resolveEndpoint(def.modelsEndpoint, accountId), { headers });
  if (!res.ok) throw new Error(`models endpoint error ${res.status}`);
  // Type varies by provider; we'll cast per-branch
  const data = await res.json() as {
    data: Array<{
      id: string;
      name?: string;
      display_name?: string;
      pricing?: {
        prompt?: Array<{ value: number | string }>;
        completion?: Array<{ value: number | string }>;
      };
    }>
  };

  let models: ModelOption[];
  if (def.id === 'openrouter') {
    models = data.data
      .map((m: { id: string; name?: string; pricing?: { prompt?: Array<{ value: number | string }>; completion?: Array<{ value: number | string }> } }) => ({
        value: m.id,
        label: m.name || m.id,
        free: isFreeOpenRouterModel(m),
      }))
      // gratis primero, luego alfabético por etiqueta
      .sort((a: ModelOption, b: ModelOption) => (Number(b.free) - Number(a.free)) || a.label.localeCompare(b.label));
  } else if (def.id === 'gemini') {
    // #58 (v3.23.0): catálogo dinámico de Gemini vía proxy. El backend ya filtra
    // los no-generativos, pero repetimos el filtro aquí (defensa en profundidad).
    models = data.data
      .filter((m: { id: string; name?: string }) => !GEMINI_EXCLUDED.some(p => m.id.includes(p)))
      .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id))
      .map((m: { id: string; name?: string }) => ({ value: m.id, label: m.name || m.id }));
  } else if (def.id === 'nvidia') {
    // NIM: catálogo ruidoso (chat + embeddings + rerank + vision + safety...)
    // 1) Filtrar no-chat usando NIM_EXCLUDED
    // 2) Enriquecer con featured-models.json (NGC) para priorizar activos
    // 3) Sin flag free (NIM no distingue gratis/pago en la API)
    let nimModels = data.data
      .filter((m: { id: string; name?: string }) => !NIM_EXCLUDED.some(p => m.id.toLowerCase().includes(p)))
      .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id))
      .map((m: { id: string; name?: string }) => ({ value: m.id, label: m.name || m.id }));

    // Intentar enriquecer con featured models (best-effort, no bloquear si falla)
    try {
      const featuredRes = await fetch(NIM_FEATURED_URL, { headers: { Accept: 'application/json' } });
      if (featuredRes.ok) {
        const featuredData = await featuredRes.json() as { 'featured-models': Array<{ model: string }> };
        const featuredIds = new Set(featuredData['featured-models'].map(f => f.model));
        // Reordenar: featured primero, luego el resto alfabético
        nimModels = nimModels.sort((a: ModelOption, b: ModelOption) => {
          const aFeatured = featuredIds.has(a.value) ? 0 : 1;
          const bFeatured = featuredIds.has(b.value) ? 0 : 1;
          if (aFeatured !== bFeatured) return aFeatured - bFeatured;
          return a.label.localeCompare(b.label);
        });
      }
    } catch { /* featured fetch falló — usar orden alfabético */ }

    models = nimModels;
  } else if (def.id === 'zenmux') {
    // Zenmux: catálogo con pricing → marcar free donde pricing sea 0 o ausente
    // (patrón OpenRouter). Filtrar modelos obviamente no-chat (embedding, whisper, etc.)
    const ZENMUX_EXCLUDED = ['embed', 'whisper', 'tts', 'asr', 'rerank', 'vision', 'clip', 'audio'];
    models = data.data
      .filter((m: { id: string; display_name?: string; name?: string; pricing?: { prompt?: Array<{ value: number | string }>; completion?: Array<{ value: number | string }> } }) => !ZENMUX_EXCLUDED.some(p => m.id.toLowerCase().includes(p)))
      .map((m: { id: string; display_name?: string; name?: string; pricing?: { prompt?: Array<{ value: number | string }>; completion?: Array<{ value: number | string }> } }) => {
        const pricing = m.pricing;
        let free = false;
        if (!pricing) {
          free = true;
        } else {
          const promptPrice = pricing.prompt;
          const completionPrice = pricing.completion;
          if (!promptPrice && !completionPrice) {
            free = true;
          } else {
            const allZero = [...(promptPrice || []), ...(completionPrice || [])]
              .every(p => Number(p.value) === 0);
            free = allZero;
          }
        }
        return {
          value: m.id,
          label: m.display_name || m.name || m.id,
          free,
        };
      })
      // free primero, luego alfabético
      .sort((a: ModelOption, b: ModelOption) => (Number(b.free) - Number(a.free)) || a.label.localeCompare(b.label));
  } else if (def.id === 'openzen') {
    // OpenCode Zen: catálogo PÚBLICO (no requiere key). La API no expone pricing
    // ni display_name: solo { id, object, created, owned_by }. Los modelos gratuitos
    // se identifican por el sufijo "-free". Búsqueda dinámica de SOLO los modelos
    // free (decisión del usuario). Todos los listados se marcan como free.
    models = data.data
      .filter((m: { id: string }) => m.id.toLowerCase().endsWith('-free'))
      .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id))
      .map((m: { id: string }) => ({ value: m.id, label: m.id, free: true }));
  } else if (def.id === 'cloudflare') {
    // Cloudflare Workers AI: catálogo COMPLETO (sin filtro free) para que el usuario
    // elija. Respuesta envoltorio { result: [...] }; cada item trae `name`
    // (p.ej. "@cf/meta/llama-3.1-8b-instruct"), `description` y `task`. El account_id
    // ya viene sustituido en modelsEndpoint vía resolveEndpoint().
    const cfSource = (data as { result?: Array<{ name?: string; description?: string }> }).result
      ?? (data.data as Array<{ name?: string; description?: string }>);
    models = cfSource
      .filter((m): m is { name: string; description?: string } => !!m.name)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => ({ value: m.name, label: m.name }));
  } else {
    // Groq (y cualquier OpenAI-compatible genérico): filtra no-chat
    models = data.data
      .filter((m: { id: string }) => !GROQ_EXCLUDED.some(p => m.id.startsWith(p)))
      .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id))
      .map((m: { id: string }) => ({ value: m.id, label: m.id }));
  }

  if (models.length === 0) throw new Error('empty catalog');

  sessionStorage.setItem(cacheKey, JSON.stringify({ models, ts: Date.now() }));
  return models;
}
