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

export type AIProviderType = 'gemini' | 'groq' | 'openrouter' | 'nvidia' | 'zenmux' | 'openzen' | 'cloudflare' | 'ollama' | 'kilo' | 'bazaarlink' | 'qwencloud';
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
  // v3.38.0: límite de salida preferido por proveedor. Si se omite, callAI usa
  // 4096. Modelos de razonamiento con salidas largas (p. ej. Ai&) lo suben aquí
  // para evitar respuestas vacías / emptyError falso por truncado del max_tokens.
  maxOutputTokens?: number;
}

// Catálogo FIJO de Gemini. El listado dinámico vía proxy fue retirado: la API
// de Google no era fiable en prod (CORS/fallo del proxy), devolvía modelos
// incompatibles y el usuario no veía los modelos correctos. Esta lista es la
// fuente única de verdad — contiene exactamente los 20 modelos operativos a día de hoy.
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
    value: 'gemini-2.0-flash',
    label: 'provider.gemini.model.flash20',
    description: 'provider.gemini.model.flash20Desc',
  },
  {
    value: 'gemini-2.0-flash-lite',
    label: 'provider.gemini.model.flash20Lite',
    description: 'provider.gemini.model.flash20LiteDesc',
  },
  {
    value: 'gemma-4-26b-a4b-it',
    label: 'provider.gemini.model.gemma26b',
    description: 'provider.gemini.model.gemma26bDesc',
  },
  {
    value: 'gemma-4-31b-it',
    label: 'provider.gemini.model.gemma',
    description: 'provider.gemini.model.gemmaDesc',
  },
  {
    value: 'gemini-flash-latest',
    label: 'provider.gemini.model.flashLatest',
    description: 'provider.gemini.model.flashLatestDesc',
  },
  {
    value: 'gemini-flash-lite-latest',
    label: 'provider.gemini.model.flashLiteLatest',
    description: 'provider.gemini.model.flashLiteLatestDesc',
  },
  {
    value: 'gemini-pro-latest',
    label: 'provider.gemini.model.proLatest',
    description: 'provider.gemini.model.proLatestDesc',
  },
  {
    value: 'gemini-2.5-flash-lite',
    label: 'provider.gemini.model.flash25Lite',
    description: 'provider.gemini.model.flash25LiteDesc',
  },
  {
    value: 'gemini-3-pro-preview',
    label: 'provider.gemini.model.pro3Preview',
    description: 'provider.gemini.model.pro3PreviewDesc',
  },
  {
    value: 'gemini-3-flash-preview',
    label: 'provider.gemini.model.flashPreview',
    description: 'provider.gemini.model.flashPreviewDesc',
  },
  {
    value: 'gemini-3.1-pro-preview',
    label: 'provider.gemini.model.pro31Preview',
    description: 'provider.gemini.model.pro31PreviewDesc',
  },
  {
    value: 'gemini-3.1-flash-lite-preview',
    label: 'provider.gemini.model.flash31LitePreview',
    description: 'provider.gemini.model.flash31LitePreviewDesc',
  },
  {
    value: 'gemini-3.1-flash-lite',
    label: 'provider.gemini.model.flash31Lite',
    description: 'provider.gemini.model.flash31LiteDesc',
  },
  {
    value: 'gemini-3.5-flash',
    label: 'provider.gemini.model.flash35',
    description: 'provider.gemini.model.flash35Desc',
  },
  {
    value: 'gemini-3.5-flash-lite',
    label: 'provider.gemini.model.flash35Lite',
    description: 'provider.gemini.model.flash35LiteDesc',
  },
  {
    value: 'gemini-3.6-flash',
    label: 'provider.gemini.model.flash36',
    description: 'provider.gemini.model.flash36Desc',
  },
  {
    value: 'gemini-3.7-flash',
    label: 'provider.gemini.model.flash37',
    description: 'provider.gemini.model.flash37Desc',
  },
  {
    value: 'gemini-3.8-flash',
    label: 'provider.gemini.model.flash38',
    description: 'provider.gemini.model.flash38Desc',
  },
];

// Fallback de OpenRouter mientras carga el catálogo o si la API falla.
// Modelos gratuitos (:free, pricing 0/0) confirmados hoy en la fuente oficial
// (https://openrouter.ai/models?order=pricing-low-to-high, 2026-07-28), más los
// "routers" nuevos de OpenRouter (enrutadores dinámicos, no free pero útiles).
// El catálogo dinámico es la fuente viva; esto es red de seguridad.
const OPENROUTER_FALLBACK: ModelOption[] = [
  // Modelos free individuales (chat/texto; pricing 0/0) — primero, para que el
  // defaultModel ([0]) sea un free concreto y fiable, no un router.
  { value: 'openai/gpt-oss-20b:free', label: 'GPT-OSS 20B (free)', free: true, recommended: true },
  { value: 'nvidia/nemotron-3-ultra-550b-a55b:free', label: 'Nemotron 3 Ultra (free)', free: true },
  { value: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 3 Super (free)', free: true },
  { value: 'inclusionai/ling-3.0-flash:free', label: 'Ling 3.0 Flash (free)', free: true },
  { value: 'poolside/laguna-s-2.1:free', label: 'Laguna S 2.1 (free)', free: true },
  { value: 'cohere/north-mini-code:free', label: 'North Mini Code (free)', free: true },
  { value: 'google/gemma-4-26b-a4b-it:free', label: 'Gemma 4 26B A4B (free)', free: true },
  // Routers (enrutamiento dinámico; NO son free — pricing -1/-1 salvo openrouter/free 0/0)
  { value: 'openrouter/auto', label: 'Auto Router', description: 'provider.openrouter.model.autoDesc' },
  { value: 'openrouter/free', label: 'Free Models Router (200K)', free: true },
  { value: 'openrouter/pareto-code', label: 'Pareto Code Router', description: 'provider.openrouter.model.paretoDesc' },
];

// Fallback de Groq mientras carga el catálogo o si la API falla.
// Modelos PRODUCTION confirmados en la fuente oficial (console.groq.com/docs/models).
// Los dos Llama (`llama-3.1-8b-instant`, `llama-3.3-70b-versatile`) se RETIRAN de Groq
// el 2026-08-16 (deprecation page); el default se migró a `openai/gpt-oss-20b`
// (production, 131K). `qwen/qwen3-32b` retirado el 2026-07-17. En v3.65.1 se eliminaron
// del fallback y del catálogo dinámico ANTES de la fecha: quien los tuviera guardados
// vería error al chatear el 16-ago. `groq/compound` = sistemas agénticos GPT-OSS+tools.
export const GROQ_FALLBACK: ModelOption[] = [
  { value: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B (fast)', recommended: true },
  { value: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
  { value: 'groq/compound', label: 'Compound (agéntico)' },
  { value: 'groq/compound-mini', label: 'Compound Mini (agéntico)' },
];

// Prefijos de modelos Groq no-chat que se excluyen del selector (whisper, tts, guard…).
export const GROQ_EXCLUDED = ['whisper', 'distil-whisper', 'playai', 'llama-guard', 'tts'];

// IDs de modelos Groq RETIRADOS que el catálogo dinámico aún pudiera devolver (la API
// los sigue sirviendo hasta la fecha de deprecation). Se filtran por defensa en
// profundidad para no ofrecer modelos que dejan de funcionar. Tras el 2026-08-16 la API
// ya no los devuelve, por lo que esta lista puede borrarse sin riesgo.
export const GROQ_DEPRECATED = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

// Subcadenas de modelos Gemini no generativos (embeddings, visión, etc.) que se
// excluyen del selector. Debe coincidir con el filtro del backend (#58).
export const GEMINI_EXCLUDED = ['embed', 'vision', 'aqa', 'imagen', 'chirp'];

// Modelos NIM no-chat a excluir del catálogo dinámico (embeddings, rerank, vision, safety, etc.)
// Nota: 'nemo' se retiró (v3.60.1) porque el filtro es por substring y 'nemo' es substring de
// 'nemotron' → excluía por error los modelos de CHAT Nemotron (familia principal de NVIDIA).
// El caso NeMo Retriever queda cubierto por 'nemoretriever'.
export const NIM_EXCLUDED = [
  'embed', 'rerank', 'ranking', 'vision', 'vlm', 'clip',
  'guard', 'safety', 'audio', 'tts', 'asr', 'whisper',
  'retrieval', 'embedding', 'detector', 'nemoretriever', 'parse',
  'neva', 'vila', 'riva', 'nv-embed', 'nvclip', 'content-safety',
  'reasoning', 'ising', 'gliner', 'calibration', 'translate',
];

// URL del feed de modelos destacados de NVIDIA (NGC) para priorizar activos
const NIM_FEATURED_URL = 'https://assets.ngc.nvidia.com/products/api-catalog/featured-models.json';

// Fallback de NVIDIA NIM mientras carga el catálogo o si la API falla.
// Modelos chat/código destacados confirmados en la fuente oficial
// (integrate.api.nvidia.com/v1/models, 2026-08-12). NIM NO distingue gratis/pago
// en la API → sin flag free (el acceso free es un entitlement del programa Developer).
// El catálogo DINÁMICO se habilita vía modelsEndpoint: '/api/nim/models' (proxy
// en server/index.js línea 480). NIM_FALLBACK es red de seguridad mientras carga.
const NIM_FALLBACK: ModelOption[] = [
  { value: 'nvidia/nemotron-3-ultra-550b-a55b', label: 'Nemotron 3 Ultra ⭐', recommended: true },
  { value: 'nvidia/llama-3.3-nemotron-super-49b-v1', label: 'Nemotron Super 49B' },
  { value: 'nvidia/nemotron-3-super-120b-a12b', label: 'Nemotron 3 Super 120B' },
  { value: 'nvidia/nemotron-3-nano-30b-a3b', label: 'Nemotron 3 Nano 30B' },
  // Nuevos modelos free endpoint (nim_type_preview, 2026-08-12)
  { value: 'nvidia/nemotron-3.5-lightning-30b-a3b', label: 'Nemotron 3.5 Lightning 30B ⚡' },
  { value: 'meta/muse-glimmer-30b', label: 'Muse Glimmer 30B' },
  { value: 'z-ai/glm-5.2', label: 'GLM 5.2' },
  { value: 'deepseek-ai/deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { value: 'deepseek-ai/deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { value: 'stepfun-ai/step-3.7-flash', label: 'Step 3.7 Flash' },
  { value: 'minimaxai/minimax-m3', label: 'Minimax M3' },
  { value: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
  { value: 'moonshotai/kimi-k2.6', label: 'Kimi K2.6' },
  { value: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
  { value: 'mistralai/mistral-medium-3.5-128b', label: 'Mistral Medium 3.5' },
];

// Fallback de Zenmux — los 6 modelos FREE confirmados hoy en la fuente oficial
// (https://zenmux.ai/models?price_filter=free, 2026-08-12). El catálogo dinámico es la
// fuente viva; este array es red de seguridad mientras carga o si la API falla.
// IDs autoritativos extraídos de la web de Zenmux (sin sufijo -free los agnes y ling-tiny,
// con sufijo -free los deepseek y glm — igual que aparecen en la API de Zenmux).
const ZENMUX_FALLBACK: ModelOption[] = [
  { value: 'deepseek/deepseek-v4-flash-free', label: 'DeepSeek V4 Flash', free: true, recommended: true },
  { value: 'sapiens-ai/agnes-2.5-flash', label: 'Agnes 2.5 Flash', free: true },
  { value: 'inclusionai/ling-3.0-tiny', label: 'Ling 3.0 Tiny', free: true },
  { value: 'sapiens-ai/agnes-2.0-flash', label: 'Agnes 2.0 Flash', free: true },
  { value: 'z-ai/glm-4.7-flash-free', label: 'GLM 4.7 Flash', free: true },
  { value: 'z-ai/glm-4.6v-flash-free', label: 'GLM 4.6V Flash', free: true },
];

// Fallback de OpenCode Zen mientras carga el catálogo dinámico o si la API falla.
// Los 8 modelos FREE confirmados hoy en la fuente oficial
// (https://opencode.ai/docs/es/zen/#pricing, 2026-08-12). El catálogo real es PÚBLICO y se
// filtra a los gratuitos (sufijo "-free"); este fallback es red de seguridad.
// `big-pickle` es la excepción sin sufijo. Token keyless `public`.
// Cambios respecto a 2026-08-05: longcat-2.0-free y north-mini-code-free retirados;
// nuevos: hy3-free, ling-3.0-tiny-free, nemotron-3.5-lightning-free.
const OPENZEN_FALLBACK: ModelOption[] = [
  { value: 'big-pickle', label: 'Big Pickle (free)', free: true, recommended: true },
  { value: 'deepseek-v4-flash-free', label: 'DeepSeek V4 Flash (free)', free: true },
  { value: 'mimo-v2.5-free', label: 'MiMo-V2.5 (free)', free: true },
  { value: 'hy3-free', label: 'Hy3 (free)', free: true },
  { value: 'laguna-s-2.1-free', label: 'Laguna S 2.1 (free)', free: true },
  { value: 'ling-3.0-tiny-free', label: 'Ling 3.0 Tiny (free)', free: true },
  { value: 'nemotron-3-ultra-free', label: 'Nemotron 3 Ultra (free)', free: true },
  { value: 'nemotron-3.5-lightning-free', label: 'Nemotron 3.5 Lightning (free)', free: true },
];

// Fallback de Cloudflare Workers AI — modelos @cf/ text-generation verificados hoy
// vía la API oficial (GET .../ai/models/search, 2026-07-31). El catálogo DINÁMICO es la
// fuente viva (proxy /api/cloudflare/models); este array es red de seguridad mientras
// carga o si la API falla. Ordenado por precio ascendente (baratos primero = aptos para
// el plan Free de 10 000 Neurons/día). EXCLUIDOS del plan Free (caros, requieren Paid):
// @cf/moonshotai/kimi-k2.6, @cf/moonshotai/kimi-k2.7-code y @cf/zai-org/glm-5.2
// (developers.cloudflare.com/workers-ai/platform/pricing/). El recommended Qwen3 30B
// equilibra calidad y bajo consumo de Neurons (0.05/0.33 $/M tokens).
const CLOUDFLARE_FALLBACK: ModelOption[] = [
  { value: '@cf/qwen/qwen3-30b-a3b-fp8', label: 'Qwen3 30B A3B', recommended: true },
  { value: '@cf/meta/llama-3.2-3b-instruct', label: 'Llama 3.2 3B' },
  { value: '@cf/meta/llama-3.2-1b-instruct', label: 'Llama 3.2 1B' },
  { value: '@cf/meta/llama-3.1-8b-instruct-fp8', label: 'Llama 3.1 8B FP8' },
  { value: '@cf/openai/gpt-oss-20b', label: 'GPT-OSS 20B' },
  { value: '@cf/openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
  { value: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'Llama 3.3 70B FP8' },
  { value: '@cf/meta/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B' },
  { value: '@cf/google/gemma-4-26b-a4b-it', label: 'Gemma 4 26B A4B' },
  { value: '@cf/nvidia/nemotron-3-120b-a12b', label: 'Nemotron 3 120B' },
];

// Fallback de Ollama Cloud — modelos cloud verificados hoy vía la API oficial
// (GET https://ollama.com/v1/models, 2026-07-28, 19 modelos). La API NO expone
// pricing ni flag free (el free es un entitlement del plan Free/Pro/Max por cuota),
// así que marcamos todos como free: el tier Free llega a todos, limitado por cuota.
// IDs antiguos inexistentes corregidos (qwen3-coder:480b, devstral-*, ministral-*).
const OLLAMA_FALLBACK: ModelOption[] = [
  { value: 'kimi-k3', label: 'Kimi K3', free: true, recommended: true },
  { value: 'glm-5.2', label: 'GLM 5.2', free: true },
  { value: 'glm-5.1', label: 'GLM 5.1', free: true },
  { value: 'minimax-m3', label: 'MiniMax M3', free: true },
  { value: 'minimax-m2.7', label: 'MiniMax M2.7', free: true },
  { value: 'minimax-m2.5', label: 'MiniMax M2.5', free: true },
  { value: 'nemotron-3-ultra', label: 'Nemotron 3 Ultra', free: true },
  { value: 'nemotron-3-super', label: 'Nemotron 3 Super', free: true },
  { value: 'nemotron-3-nano:30b', label: 'Nemotron 3 Nano 30B', free: true },
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', free: true },
  { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', free: true },
  { value: 'qwen3.5:397b', label: 'Qwen 3.5 (397B)', free: true },
  { value: 'kimi-k2.7-code', label: 'Kimi K2.7 Code', free: true },
  { value: 'kimi-k2.6', label: 'Kimi K2.6', free: true },
  { value: 'kimi-k2.5', label: 'Kimi K2.5', free: true },
  { value: 'mistral-large-3:675b', label: 'Mistral Large 3', free: true },
  { value: 'gemma4:31b', label: 'Gemma 4 31B', free: true },
  { value: 'gpt-oss:120b', label: 'GPT-OSS 120B', free: true },
  { value: 'gpt-oss:20b', label: 'GPT-OSS 20B', free: true },
];



// Fallback de Kilo (api.kilo.ai/api/gateway) mientras carga el catálogo o si falla.
// Pasarela OpenAI-compatible con catálogo PÚBLICO (GET /models no requiere key) que
// distingue modelos gratuitos por el sufijo ":free" en el id. Estos son los 3 modelos
// free configurados hoy (262K contexto, solo texto). El selector marca 🆓 vía flag free.
const KILO_FALLBACK: ModelOption[] = [
  { value: 'inclusionai/ling-3.0-flash:free', label: 'Ling 3.0 Flash (free)', free: true, recommended: true },
  { value: 'poolside/laguna-s-2.1:free', label: 'Laguna S 2.1 (free)', free: true },
  { value: 'nex-agi/nex-n2-pro:free', label: 'Nex N2 Pro (free)', free: true },
];

// Fallback de BazaarLink (bazaarlink.ai/api/v1) mientras carga el catálogo dinámico o si falla.
// Pasarela OpenAI-compatible. Acceso vía PROXY backend /api/bazaarlink.
// El catálogo es PÚBLICO (GET /models no requiere key -> modelsNeedKey: false).
// Modelos gratuitos solicitados por el usuario (IDs reales de la API bazaarlink.ai):
const BAZAARLINK_FALLBACK: ModelOption[] = [
  { value: 'deepseek/deepseek-v4-flash:free', label: 'DeepSeek V4 Flash (free)', free: true, recommended: true },
  { value: 'qwen/qwen3.7-flash:free', label: 'Qwen 3.7 Flash (free)', free: true },
  { value: 'auto:free', label: 'Auto Router (free)', free: true },
];

// Fallback de QwenCloud (qwencloud.com / DashScope) mientras carga el catálogo dinámico o si falla.
// Pasarela OpenAI-compatible. Acceso vía PROXY backend /api/qwencloud.
// Modelos gratuitos de text & code confirmados en la web oficial de QwenCloud:
const QWENCLOUD_FALLBACK: ModelOption[] = [
  { value: 'qwen3.7-flash', label: 'Qwen 3.7 Flash (free)', free: true, recommended: true },
  { value: 'qwen-plus-character', label: 'Qwen Plus Character (free - instant)', free: true },
  { value: 'qwen-flash-character', label: 'Qwen Flash Character (free - instant)', free: true },
  { value: 'qwen3-coder-flash', label: 'Qwen 3 Coder Flash (free)', free: true },
  { value: 'qwen3-coder-next', label: 'Qwen 3 Coder Next (free)', free: true },
  { value: 'qwen3.7-plus', label: 'Qwen 3.7 Plus (free)', free: true },
  { value: 'qwen3.8-max', label: 'Qwen 3.8 Max (free)', free: true },
  { value: 'qwen3.6-flash', label: 'Qwen 3.6 Flash (free)', free: true },
  { value: 'qwen3.5-flash', label: 'Qwen 3.5 Flash (free)', free: true },
  { value: 'qwen-flash', label: 'Qwen Flash (free)', free: true },
  { value: 'qwen-turbo', label: 'Qwen Turbo (free)', free: true },
  { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash (free)', free: true },
  { value: 'qwen3-coder-480b-a35b-instruct', label: 'Qwen 3 Coder 480B (free)', free: true },
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
    maxOutputTokens: 8192,
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
    // El CATÁLOGO de modelos es DINÁMICO vía /api/nim/models (proxy en
    // server/index.js línea 480). NIM_FALLBACK es red de seguridad mientras carga.
    // El catálogo dinámico se filtra con NIM_EXCLUDED (no-chat) y se enriquece
    // con featured-models.json (NGC) para priorizar los 57 free endpoints activos.
    chatEndpoint: '/api/nim',
    modelsEndpoint: '/api/nim/models',
    modelsNeedKey: true, // NIM requiere nvapi-... key para consultar el catálogo
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
    chatEndpoint: '/api/zenmux',
    modelsEndpoint: '/api/zenmux/models',
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
    // El catálogo es DINÁMICO vía /api/openzen/models (proxy añadido v4.0.28,
    // retransmite a https://opencode.ai/zen/v1/models). La rama `openzen` de
    // fetchModels filtra solo los que terminan en '-free' o son 'big-pickle'.
    // OPENZEN_FALLBACK es red de seguridad mientras carga o si la API falla.
    chatEndpoint: '/api/openzen',
    modelsEndpoint: '/api/openzen/models',
    modelsNeedKey: true, // /zen/v1/models requiere Authorization: Bearer <key>
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
  // Catálogo DINÁMICO vía proxy /api/cloudflare/models (elude CORS); el account_id se
  // envía como header X-Account-Id y la key como Bearer. CLOUDFLARE_FALLBACK es red de
  // seguridad mientras carga o si la API falla.
  cloudflare: {
    id: 'cloudflare',
    name: 'Cloudflare Workers AI',
    shortName: 'Workers AI',
    emoji: '🟠',
    cardDesc: 'provider.cloudflare.cardDesc',
    transport: 'openai-compatible',
    // Proxy backend /api/cloudflare (elude bloqueo CORS de Cloudflare).
    chatEndpoint: '/api/cloudflare',
    // Proxy backend /api/cloudflare/models (catálogo dinámico; elude CORS).
    modelsEndpoint: '/api/cloudflare/models',
    modelsNeedKey: true, // requiere el API token (Bearer) y el account_id
    staticModels: CLOUDFLARE_FALLBACK,
    defaultModel: CLOUDFLARE_FALLBACK[0].value,
    keyPlaceholder: 'API Token de Cloudflare',
    signupUrl: 'https://dash.cloudflare.com/profile/api-tokens',
    signupLabel: 'provider.cloudflare.signupLabel',
    note: 'provider.cloudflare.note',
  },
  // Ollama Cloud: VA AL FINAL (antes de cloudflare según handoff: "justo delante de CloudFlare y después de OpenCode Zen").
  // API OpenAI-compatible en https://ollama.com/v1. Requiere API key sk-ollama-...
  // PROXY BACKEND /api/ollama (elude bloqueo CORS de ollama.com).
  // Catálogo dinámico vía /api/ollama/models; fallback estático con 11 modelos verificados.
  ollama: {
    id: 'ollama',
    name: 'Ollama Cloud',
    shortName: 'Ollama',
    emoji: '🦙',
    cardDesc: 'provider.ollama.cardDesc',
    transport: 'openai-compatible',
    chatEndpoint: '/api/ollama',
    modelsEndpoint: '/api/ollama/models',
    modelsNeedKey: true,
    staticModels: OLLAMA_FALLBACK,
    defaultModel: OLLAMA_FALLBACK[0].value, // 'kimi-k3'
    keyPlaceholder: 'sk-ollama-...',
    keyPrefix: 'sk-ollama-',
    signupUrl: 'https://ollama.com',
    signupLabel: 'provider.ollama.signupLabel',
    note: 'provider.ollama.note',
  },

  // Kilo (api.kilo.ai/api/gateway): VA AL FINAL (último proveedor añadido, v3.58.0).
  // Pasarela OpenAI-compatible. Acceso vía PROXY backend /api/kilo (sigue el mismo
  // patrón que NIM/OpenZen/Cloudflare/Ollama/Ai& para eludir el bloqueo CORS del
  // navegador). La API key es un JWT personal de Kilo.ai (cabecera "eyJ...", HS256)
  // que viaja en memoria (Zero-Storage) y se reenvía por Authorization al server.
  // El CATÁLOGO de modelos es PÚBLICO (GET /models no requiere auth → modelsNeedKey:
  // false) y distingue los gratuitos por el sufijo ":free"; la rama genérica de
  // fetchModels (else de Groq) los parsea sin necesidad de rama propia porque la
  // respuesta es { data: [{ id }] } estándar OpenAI. Fallback estático KILO_FALLBACK.
  kilo: {
    id: 'kilo',
    name: 'Kilo',
    shortName: 'Kilo',
    emoji: '⚖️',
    cardDesc: 'provider.kilo.cardDesc',
    transport: 'openai-compatible',
    chatEndpoint: '/api/kilo',
    modelsEndpoint: '/api/kilo/models',
    modelsNeedKey: false, // el catálogo de Kilo es público (GET /models sin auth)
    staticModels: KILO_FALLBACK,
    defaultModel: KILO_FALLBACK[0].value, // 'inclusionai/ling-3.0-flash:free'
    // La API key de Kilo es un JWT (HS256): empieza por "eyJ" (payload base64url).
    // Validación ligera en cliente (no es validación real de la clave).
    keyPlaceholder: 'eyJhbGciOi...',
    keyPrefix: 'eyJ',
    signupUrl: 'https://kilo.ai',
    signupLabel: 'provider.kilo.signupLabel',
  },
  // BazaarLink (bazaarlink.ai/api/v1): Pasarela OpenAI-compatible.
  // Acceso vía PROXY backend /api/bazaarlink (elude bloqueo CORS del navegador).
  // Catálogo dinámico vía /api/bazaarlink/models (público, modelsNeedKey: false).
  bazaarlink: {
    id: 'bazaarlink',
    name: 'BazaarLink',
    shortName: 'BazaarLink',
    emoji: '🛍️',
    cardDesc: 'provider.bazaarlink.cardDesc',
    transport: 'openai-compatible',
    chatEndpoint: '/api/bazaarlink',
    modelsEndpoint: '/api/bazaarlink/models',
    modelsNeedKey: false, // El catálogo de BazaarLink es público (GET /v1/models sin auth)
    staticModels: BAZAARLINK_FALLBACK,
    defaultModel: BAZAARLINK_FALLBACK[0].value,
    keyPlaceholder: 'sk-bl-...',
    keyPrefix: 'sk-bl-',
    signupUrl: 'https://bazaarlink.ai',
    signupLabel: 'provider.bazaarlink.signupLabel',
    note: 'provider.bazaarlink.note',
  },
  // QwenCloud (qwencloud.com / DashScope): pasarela OpenAI-compatible.
  // Acceso vía PROXY backend /api/qwencloud (elude bloqueo CORS del navegador).
  // Catálogo dinámico vía /api/qwencloud/models.
  qwencloud: {
    id: 'qwencloud',
    name: 'QwenCloud',
    shortName: 'QwenCloud',
    emoji: '☁️',
    cardDesc: 'provider.qwencloud.cardDesc',
    transport: 'openai-compatible',
    chatEndpoint: '/api/qwencloud',
    modelsEndpoint: '/api/qwencloud/models',
    modelsNeedKey: true,
    staticModels: QWENCLOUD_FALLBACK,
    defaultModel: QWENCLOUD_FALLBACK[0].value,
    keyPlaceholder: 'sk-...',
    keyPrefix: 'sk-',
    signupUrl: 'https://www.qwencloud.com',
    signupLabel: 'provider.qwencloud.signupLabel',
    note: 'provider.qwencloud.note',
    maxOutputTokens: 8192,
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
// Nota: `gpt-oss` primero para que en Groq (y OpenRouter) se priorice GPT-OSS 20B
// sobre modelos de preview o bloqueados a nivel de proyecto (p. ej. Qwen 3.8 en Groq).
const RELIABLE_MODEL_PREFS = ['gpt-oss', 'gemma', 'llama', 'deepseek', 'qwen'];

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
  // Cloudflare exige account_id por header X-Account-Id aunque el endpoint no lleve
  // el placeholder {account_id} (el proxy server-side construye la URL del upstream).
  if (def.id === 'cloudflare' && !accountId) return null;

  const cacheKey = `${def.id}_models_cache_v3${accountId ? '_' + accountId : ''}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      const { models, ts } = JSON.parse(cached) as { models: ModelOption[]; ts: number };
      if (Date.now() - ts < MODELS_CACHE_TTL) return models;
    } catch { /* cache corrupta — ignorar */ }
  }

  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  // Cloudflare: account_id requerido en el header X-Account-Id (v3.33.1, chat proxy).
  if (def.id === 'cloudflare' && accountId) headers['X-Account-Id'] = accountId;

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
    // Zenmux: catálogo con pricing → marcar free SOLO cuando el campo `pricing`
    // existe Y todos sus valores son 0. Si `pricing` es undefined/null, NO se
    // marca como free (la API de Zenmux omite el campo en modelos de pago, no
    // en los gratuitos — lección registrada v4.0.28: la lógica anterior marcaba
    // todos los modelos sin pricing como free, mostrando erróneamente todos como 🆓).
    // Filtrar modelos obviamente no-chat (embedding, whisper, etc.)
    const ZENMUX_EXCLUDED = ['embed', 'whisper', 'tts', 'asr', 'rerank', 'vision', 'clip', 'audio'];
    models = data.data
      .filter((m: { id: string; display_name?: string; name?: string; pricings?: Record<string, Array<{ value?: number | string; price?: number | string }>>; pricing?: Record<string, Array<{ value?: number | string; price?: number | string }>> }) => !ZENMUX_EXCLUDED.some(p => m.id.toLowerCase().includes(p)))
      .map((m: { id: string; display_name?: string; name?: string; pricings?: Record<string, Array<{ value?: number | string; price?: number | string }>>; pricing?: Record<string, Array<{ value?: number | string; price?: number | string }>> }) => {
        const pricing = m.pricings || m.pricing;
        let free = false;
        if (pricing) {
          const promptPrice = pricing.prompt || [];
          const completionPrice = pricing.completion || [];
          const allPrices = [...promptPrice, ...completionPrice];
          free = allPrices.length === 0 || allPrices.every(p => Number(p.value ?? p.price ?? 0) === 0);
        }
        if (!free && m.id.toLowerCase().endsWith('-free')) {
          free = true;
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
      .filter((m: { id: string }) => m.id.toLowerCase().endsWith('-free') || m.id.toLowerCase() === 'big-pickle')
      .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id))
      .map((m: { id: string }) => ({ value: m.id, label: m.id, free: true }));
  } else if (def.id === 'cloudflare') {
    // Cloudflare Workers AI: el proxy /api/cloudflare/models ya filtra task ===
    // 'Text Generation' y excluye los 3 modelos no-Free (kimi-k2.6, kimi-k2.7-code,
    // glm-5.2). Aquí re-aplicamos la exclusión no-Free por defensa en profundidad y
    // enriquecemos con etiquetas amigables (CLOUDFLARE_FALLBACK). Respuesta envoltorio
    // { result: [{ name, ... }] }. Orden: por precio input ascendente (baratos =
    // aptos para el plan Free de 10 000 Neurons/día); a igualdad, alfabético.
    // El plan Free no se distingue por modelo: marcamos free a los económicos que
    // mejor consumen la cuota diaria (heurística por id).
    const CF_NOT_FREE = ['kimi-k2.6', 'kimi-k2.7-code', 'glm-5.2'];
    const cfLabel = (id: string): string => {
      const hit = CLOUDFLARE_FALLBACK.find(m => m.value === id);
      return hit ? hit.label : id;
    };
    const cfIsLikelyFree = (id: string): boolean => {
      const low = id.toLowerCase();
      // LoRA y modelos muy pequeños/ligeritos son los que mejor aprovechan la cuota.
      return low.includes('lora') || low.includes('1b') || low.includes('3b')
        || low.includes('8b') || low.includes('gpt-oss-20b') || low.includes('qwen3-30b');
    };
    const cfSource = (data as { result?: Array<{ name?: string }> }).result
      ?? (data.data as Array<{ name?: string }>);
    models = cfSource
      .filter((m): m is { name: string } => !!m.name)
      .filter(m => !CF_NOT_FREE.some(nf => m.name.toLowerCase().includes(nf)))
      .map((m) => ({
        value: m.name,
        label: cfLabel(m.name),
        ...(cfIsLikelyFree(m.name) ? { free: true } : {}),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

  } else if (def.id === 'kilo') {
    // Kilo (api.kilo.ai/api/gateway): pasarela OpenAI-compatible con catálogo público.
    // Los modelos gratuitos se identifican por el sufijo ":free" (igual que OpenRouter/
    // OpenZen). La API NO trae campo pricing en todos los items, así que el sufijo es la
    // señal autoritativa. Filtramos modelos obviamente no-chat (embedding, whisper, tts…)
    // y marcamos free por sufijo para que el selector muestre 🆓. free primero, luego alfabético.
    const KILO_EXCLUDED = ['embed', 'whisper', 'tts', 'asr', 'rerank', 'vision', 'clip', 'audio'];
    models = data.data
      .filter((m: { id: string }) => !KILO_EXCLUDED.some(p => m.id.toLowerCase().includes(p)))
      .map((m: { id: string }) => ({
        value: m.id,
        label: m.id,
        free: m.id.toLowerCase().endsWith(':free'),
      }))
      .sort((a: ModelOption, b: ModelOption) => (Number(b.free) - Number(a.free)) || a.label.localeCompare(b.label));
  } else if (def.id === 'bazaarlink') {
    // BazaarLink (bazaarlink.ai/api/v1): pasarela OpenAI-compatible con catálogo público.
    // Identifica free por sufijo :free, pricing a 0 o alias exactos conocidos.
    // Filtra modelos obviamente no-chat (embedding, whisper, tts…). Deduplica por id.
    const BAZAARLINK_FREE_EXACT = ['deepseek/deepseek-v4-flash:free', 'qwen/qwen3.7-flash:free', 'auto:free'];
    const BAZAARLINK_EXCLUDED = ['embed', 'whisper', 'tts', 'asr', 'rerank', 'vision', 'clip', 'audio'];
    type BazaarlinkItem = {
      id: string;
      name?: string;
      display_name?: string;
      pricing?: { prompt?: string | number; completion?: string | number };
    };
    const seen = new Set<string>();
    models = (data.data as unknown as BazaarlinkItem[])
      .filter((m) => !BAZAARLINK_EXCLUDED.some(p => m.id.toLowerCase().includes(p)))
      .filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      })
      .map((m) => {
        const idLow = m.id.toLowerCase();
        const promptPrice = m.pricing?.prompt;
        const completionPrice = m.pricing?.completion;
        const priceIsZero = promptPrice !== undefined && Number(promptPrice) === 0 && Number(completionPrice) === 0;
        const isFree = idLow.endsWith(':free') || priceIsZero || BAZAARLINK_FREE_EXACT.includes(idLow);
        return {
          value: m.id,
          label: m.name || m.display_name || m.id,
          free: isFree,
        };
      })
      .sort((a: ModelOption, b: ModelOption) => (Number(b.free) - Number(a.free)) || a.label.localeCompare(b.label));
  } else if (def.id === 'qwencloud') {
    // QwenCloud (qwencloud.com / DashScope): pasarela OpenAI-compatible.
    // Identifica modelos de chat/código filtrando los no-chat (embeddings, rerank, audio, vision...).
    // Distingue los modelos gratuitos (Qwen / DeepSeek) de los modelos comerciales de pago (GLM 5.2, Zhipu, Baichuan, Minimax...).
    const QWENCLOUD_EXCLUDED = ['embed', 'whisper', 'tts', 'asr', 'rerank', 'clip', 'audio', 'wan', 'happyhorse', 'image'];
    const QWENCLOUD_FREE_PATTERNS = ['qwen', 'deepseek'];
    const QWENCLOUD_PAID_PATTERNS = ['glm', 'zhipu', 'baichuan', 'minimax', 'moonshot', 'yi', 'claude', 'gpt'];

    const isQwencloudFree = (id: string): boolean => {
      const low = id.toLowerCase();
      if (low.endsWith(':free') || low.endsWith('-free')) return true;
      if (QWENCLOUD_PAID_PATTERNS.some(p => low.includes(p))) return false;
      return QWENCLOUD_FREE_PATTERNS.some(p => low.includes(p));
    };

    type QwencloudItem = {
      id: string;
      name?: string;
      display_name?: string;
    };
    const seen = new Set<string>();
    models = (data.data as unknown as QwencloudItem[])
      .filter((m) => !QWENCLOUD_EXCLUDED.some(p => m.id.toLowerCase().includes(p)))
      .filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      })
      .map((m) => ({
        value: m.id,
        label: m.name || m.display_name || m.id,
        free: isQwencloudFree(m.id),
      }))
      .sort((a: ModelOption, b: ModelOption) => (Number(b.free) - Number(a.free)) || a.label.localeCompare(b.label));
  } else {
    // Groq (y cualquier OpenAI-compatible genérico): filtra no-chat (GROQ_EXCLUDED) y
    // modelos retirados que la API aún devuelve (GROQ_DEPRECATED; p. ej. los dos Llama
    // que se deprecaban el 2026-08-16). Defensa en profundidad sobre el catálogo dinámico.
    models = data.data
      .filter((m: { id: string }) => !GROQ_EXCLUDED.some(p => m.id.startsWith(p)))
      .filter((m: { id: string }) => !GROQ_DEPRECATED.includes(m.id))
      .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id))
      .map((m: { id: string }) => ({ value: m.id, label: m.id }));
  }

  if (models.length === 0) throw new Error('empty catalog');

  sessionStorage.setItem(cacheKey, JSON.stringify({ models, ts: Date.now() }));
  return models;
}
