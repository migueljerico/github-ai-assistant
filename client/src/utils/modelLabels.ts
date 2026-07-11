/**
 * Etiquetas amigables para los modelos de IA (Gemini, Groq, NIM, Zenmux).
 *
 * Se usan tanto en el selector del panel de conexión (`AIProviderPanel`) como en
 * el badge del header (`AIProviderBadge`). Para cualquier id desconocido se
 * devuelve el id tal cual, de modo que añadir modelos nuevos nunca rompe nada.
 */
export const MODEL_LABELS: Record<string, string> = {
  // ── Gemini / Google AI (catálogo fijo) ──
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-3.5-flash': 'Gemini 3.5 Flash',
  'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemma-4-31b-it': 'Gemma 4 31B',
  // ── Groq ──
  'llama-3.3-70b-versatile': 'Llama 3.3 70B',
  'llama-3.1-8b-instant': 'Llama 3.1 8B',
  'llama3-70b-8192': 'Llama 3 70B',
  'llama3-8b-8192': 'Llama 3 8B',
  'gemma2-9b-it': 'Gemma 2 9B',
  'qwen-qwq-32b': 'Qwen QwQ 32B',
  'qwen-2.5-32b': 'Qwen 2.5 32B',
  'deepseek-r1-distill-llama-70b': 'DeepSeek R1 70B',
  'mixtral-8x7b-32768': 'Mixtral 8x7B',
  // ── NVIDIA NIM ──
  'nvidia/nemotron-3-ultra-550b-a55b': 'Nemotron 3 Ultra',
  'z-ai/glm-5.2': 'GLM 5.2',
  'meta/llama-3.3-70b-instruct': 'Llama 3.3 70B',
  'meta/llama-3.1-405b-instruct': 'Llama 3.1 405B',
  'mistralai/codestral-22b-instruct-v0.1': 'Codestral 22B (código)',
  'deepseek-ai/deepseek-v4-pro': 'DeepSeek V4 Pro',
  'minimaxai/minimax-m3': 'Minimax M3',
  'qwen/qwen3-next-80b-a3b-instruct': 'Qwen3 Next 80B',
  'google/gemma-4-31b-it': 'Gemma 4 31B',
  'stepfun-ai/step-3.7-flash': 'Step 3.7 Flash',
  'mistralai/mistral-medium-3.5-128b': 'Mistral Medium 3.5',
  'nvidia/llama-3.3-nemotron-super-49b-v1.5': 'Nemotron Super 49B',
  // ── Zenmux (modelos FREE) ──
  'stepfun/step-3.7-flash-free': 'Step 3.7 Flash',
  'x-ai/grok-4.5-free': 'Grok 4.5 (500K ctx)',
  'z-ai/glm-4.7-flash-free': 'GLM 4.7 Flash',
  'z-ai/glm-4.6v-flash-free': 'GLM 4.6V Flash',
  'inclusionai/ling-2.6-flash': 'Ling 2.6 Flash',
  'minimax/minimax-m2.5-lightning': 'MiniMax M2.5 Lightning',
  'qwen/qwen3-asr-flash': 'Qwen3 ASR Flash',
};

/** Devuelve la etiqueta amigable de un modelo, o su id si no hay etiqueta conocida. */
export function modelLabel(id: string): string {
  return MODEL_LABELS[id] ?? id;
}
