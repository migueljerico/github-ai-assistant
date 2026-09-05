/**
 * Etiquetas amigables para los modelos de IA (Gemini, Groq, NIM, Zenmux, Cloudflare).
 *
 * Se usan tanto en el selector del panel de conexión (`AIProviderPanel`) como en
 * el badge del header (`AIProviderBadge`). Para cualquier id desconocido se
 * devuelve el id tal cual, de modo que añadir modelos nuevos nunca rompe nada.
 */
export const MODEL_LABELS: Record<string, string> = {
  // ── Gemini / Google AI (catálogo fijo: 20 modelos a día de hoy) ──
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-3.8-flash': 'Gemini 3.8 Flash',
  'gemini-3.7-flash': 'Gemini 3.7 Flash',
  'gemini-3.5-flash': 'Gemini 3.5 Flash',
  'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemma-4-31b-it': 'Gemma 4 31B',
  'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite',
  'gemma-4-26b-a4b-it': 'Gemma 4 26B A4B',
  'gemini-flash-latest': 'Gemini Flash Latest',
  'gemini-flash-lite-latest': 'Gemini Flash Lite Latest',
  'gemini-pro-latest': 'Gemini Pro Latest',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
  'gemini-3-pro-preview': 'Gemini 3 Pro Preview',
  'gemini-3-flash-preview': 'Gemini 3 Flash Preview',
  'gemini-3.1-pro-preview': 'Gemini 3.1 Pro Preview',
  'gemini-3.1-flash-lite-preview': 'Gemini 3.1 Flash Lite Preview',
  'gemini-3.5-flash-lite': 'Gemini 3.5 Flash Lite',
  'gemini-3.6-flash': 'Gemini 3.6 Flash',
  // ── Groq (catálogo dinámico + GROQ_FALLBACK vigente, 2026-08-01) ──
  // Los dos Llama (llama-3.3-70b-versatile, llama-3.1-8b-instant) se retiraron del
  // mapa en v3.65.1 (deprecation Groq 2026-08-16); el catálogo dinámico los filtra.
  'openai/gpt-oss-20b': 'GPT-OSS 20B (fast)',
  'openai/gpt-oss-120b': 'GPT-OSS 120B',
  'groq/compound': 'Compound (agéntico)',
  'groq/compound-mini': 'Compound Mini (agéntico)',
  'qwen/qwen3.8-27b': 'Qwen 3.8 27B',
  'qwen/qwen3.6-27b': 'Qwen 3.6 27B',
  // ── NVIDIA NIM (fallback verificado en vivo, 2026-09-05 — v4.0.47) ──
  'nvidia/nemotron-3-ultra-550b-a55b': 'Nemotron 3 Ultra',
  'nvidia/nemotron-3.5-lightning-30b-a3b': 'Nemotron 3.5 Lightning 30B',
  'nvidia/nemotron-3-super-120b-a12b': 'Nemotron 3 Super 120B',
  'nvidia/nemotron-nano-3-30b-a3b': 'Nemotron Nano 3 30B',
  'meta/muse-glimmer-30b': 'Muse Glimmer 30B',
  'moonshotai/kimi-k3': 'Kimi K3',
  'moonshotai/kimi-k2.6': 'Kimi K2.6',
  'deepseek-ai/deepseek-v4-pro-0813': 'DeepSeek V4 Pro',
  'deepseek-ai/deepseek-v4-flash-0731': 'DeepSeek V4 Flash',
  'minimaxai/minimax-m3': 'Minimax M3',
  'google/gemma-4-31b-it': 'Gemma 4 31B',
  'mistralai/mistral-large-2-instruct': 'Mistral Large 2',
  'meta/llama-3.1-405b-instruct': 'Llama 3.1 405B',
  'mistralai/codestral-22b-instruct-v0.1': 'Codestral 22B (código)',
  // ── Zenmux (modelos FREE verificados por pricing a 0, 2026-09-05 — v4.0.47) ──
  'sapiens-ai/agnes-2.5-flash': 'Agnes 2.5 Flash',
  'inclusionai/ling-3.0-tiny': 'Ling 3.0 Tiny',
  'inclusionai/ling-3.0-flash': 'Ling 3.0 Flash',
  'z-ai/glm-4.7-flash-free': 'GLM 4.7 Flash',
  'z-ai/glm-4.6v-flash-free': 'GLM 4.6V Flash',
  // ── OpenRouter / Kilo (fallbacks free verificados en vivo, 2026-09-05 — v4.0.47) ──
  'google/gemma-4-26b-a4b-it:free': 'Gemma 4 26B A4B (free)',
  'google/gemma-4-31b-it:free': 'Gemma 4 31B (free)',
  'z-ai/glm-5.2:free': 'GLM 5.2 (free)',
  'nvidia/nemotron-3-ultra-550b-a55b:free': 'Nemotron 3 Ultra (free)',
  'nvidia/nemotron-3-super-120b-a12b:free': 'Nemotron 3 Super (free)',
  'minimax/minimax-m3:free': 'MiniMax M3 (free)',
  'inclusionai/ling-3.0-flash-fin:free': 'Ling 3.0 Flash Fin (free)',
  'inclusionai/ling-3.0-flash-sante:free': 'Ling 3.0 Flash Sante (free)',
  'poolside/laguna-s-2.1:free': 'Laguna S 2.1 (free)',
  'cohere/north-mini-code:free': 'North Mini Code (free)',
  'stepfun/step-3.7-flash:free': 'Step 3.7 Flash (free)',
  // ── Cloudflare Workers AI (catálogo @cf/, API oficial 2026-07-31) ──
  // Etiquetas para los modelos que aparecen en CLOUDFLARE_FALLBACK y/o en el
  // catálogo dinámico; los ids @cf/... sin etiqueta se muestran tal cual.
  '@cf/qwen/qwen3-30b-a3b-fp8': 'Qwen3 30B A3B',
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': 'Llama 3.3 70B FP8',
  '@cf/meta/llama-3.2-3b-instruct': 'Llama 3.2 3B',
  '@cf/meta/llama-3.2-1b-instruct': 'Llama 3.2 1B',
  '@cf/meta/llama-3.1-8b-instruct-fp8': 'Llama 3.1 8B FP8',
  '@cf/meta/llama-4-scout-17b-16e-instruct': 'Llama 4 Scout 17B',
  '@cf/openai/gpt-oss-120b': 'GPT-OSS 120B',
  '@cf/openai/gpt-oss-20b': 'GPT-OSS 20B',
  '@cf/google/gemma-4-26b-a4b-it': 'Gemma 4 26B A4B',
  '@cf/nvidia/nemotron-3-120b-a12b': 'Nemotron 3 120B',
  // ── BazaarLink (free verificados en vivo, 2026-09-05 — v4.0.47) ──
  'qwen/qwen3.7-flash:free': 'Qwen 3.7 Flash',
  'auto:free': 'Auto Router (free)',
  // ── QwenCloud ──
  'qwen3.7-flash': 'Qwen 3.7 Flash',
  'qwen-plus-character': 'Qwen Plus Character',
  'qwen-flash-character': 'Qwen Flash Character',
  'qwen3-coder-flash': 'Qwen 3 Coder Flash',
  'qwen3-coder-next': 'Qwen 3 Coder Next',
  'qwen3.7-plus': 'Qwen 3.7 Plus',
  'qwen3.8-max': 'Qwen 3.8 Max',
  'qwen3.6-flash': 'Qwen 3.6 Flash',
  'qwen3.5-flash': 'Qwen 3.5 Flash',
  'qwen-flash': 'Qwen Flash',
  'qwen-turbo': 'Qwen Turbo',
  'deepseek-v4-flash': 'DeepSeek V4 Flash',
  'qwen3-coder-480b-a35b-instruct': 'Qwen 3 Coder 480B',
};

/** Devuelve la etiqueta amigable de un modelo, o su id si no hay etiqueta conocida. */
export function modelLabel(id: string): string {
  return MODEL_LABELS[id] ?? id;
}
