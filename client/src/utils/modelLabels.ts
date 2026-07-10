/**
 * Etiquetas amigables para los modelos de IA (Gemini y Groq).
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
};

/** Devuelve la etiqueta amigable de un modelo, o su id si no hay etiqueta conocida. */
export function modelLabel(id: string): string {
  return MODEL_LABELS[id] ?? id;
}
