import { useAIProvider } from '../../context/AIProviderContext';

const MODEL_LABELS: Record<string, string> = {
  'gemini-2.0-flash': '2.0 Flash',
  'gemini-2.0-flash-lite': '2.0 Lite',
  'gemini-1.5-flash': '1.5 Flash',
  'gemini-1.5-pro': '1.5 Pro',
  'llama-3.3-70b-versatile': 'Llama 3.3 70B',
  'qwen-qwq-32b': 'Qwen QwQ 32B',
  'llama-3.1-8b-instant': 'Llama 3.1 8B',
};

export default function AIProviderBadge() {
  const { provider, model, isConnected, disconnect } = useAIProvider();

  if (!isConnected || !provider || !model) return null;

  const isGemini = provider === 'gemini';
  const emoji = isGemini ? '🤖' : '⚡';
  const providerName = isGemini ? 'Gemini' : 'Groq';
  const modelLabel = MODEL_LABELS[model] ?? model;

  return (
    <div
      id="ai-provider-badge"
      className="ai-provider-badge"
      title={`Proveedor de IA: ${providerName} · ${model}\nHaz clic para desconectar`}
      onClick={disconnect}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && disconnect()}
      aria-label={`IA: ${providerName} ${modelLabel}. Clic para desconectar.`}
    >
      <span className={`ai-badge-dot ai-badge-dot-${provider}`} />
      <span className="ai-badge-text">
        {emoji} {providerName} · {modelLabel}
      </span>
    </div>
  );
}
