import { useAIProvider } from '../../context/AIProviderContext';
import { modelLabel } from '../../utils/modelLabels';

export default function AIProviderBadge() {
  const { provider, model, isConnected, disconnect } = useAIProvider();

  if (!isConnected || !provider || !model) return null;

  const isGemini = provider === 'gemini';
  const emoji = isGemini ? '🤖' : '⚡';
  const providerName = isGemini ? 'Gemini' : 'Groq';
  const modelLabelText = modelLabel(model);

  return (
    <div
      id="ai-provider-badge"
      className="ai-provider-badge"
      title={`Proveedor de IA: ${providerName} · ${model}\nHaz clic para desconectar`}
      onClick={disconnect}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && disconnect()}
      aria-label={`IA: ${providerName} ${modelLabelText}. Clic para desconectar.`}
    >
      <span className={`ai-badge-dot ai-badge-dot-${provider}`} />
      <span className="ai-badge-text">
        {emoji} {providerName} · {modelLabelText}
      </span>
    </div>
  );
}
