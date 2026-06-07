import { useState } from 'react';
import { useAIProvider, type AIProviderType } from '../../context/AIProviderContext';
import { validateProviderKey } from '../../services/gemini';

const GROQ_MODELS = [
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B · Versatile (recomendado)' },
  { value: 'qwen-qwq-32b', label: 'Qwen QwQ 32B · Razonamiento' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B · Ultrarrápido' },
];

const GEMINI_MODELS = [
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (recomendado)' },
  { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite · Más cuota' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash · Estable' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro · Más potente' },
];

export default function AIProviderPanel() {
  const { connect } = useAIProvider();
  const [selected, setSelected] = useState<AIProviderType>('gemini');
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [geminiModel, setGeminiModel] = useState(GEMINI_MODELS[0].value);
  const [groqModel, setGroqModel] = useState(GROQ_MODELS[0].value);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [status, setStatus] = useState<'idle' | 'validating' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const activeKey = selected === 'gemini' ? geminiKey : groqKey;
  const activeModel = selected === 'gemini' ? geminiModel : groqModel;

  const handleConnect = async () => {
    if (!activeKey.trim()) return;
    setStatus('validating');
    setErrorMsg('');

    const result = await validateProviderKey(selected, activeKey.trim(), activeModel);

    if (result.valid) {
      setStatus('success');
      // Brief success flash before entering the app
      setTimeout(() => {
        connect(selected, activeKey.trim(), activeModel);
      }, 800);
    } else {
      setStatus('error');
      setErrorMsg(result.error || 'Error desconocido');
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card ai-provider-card">
        {/* Header */}
        <div className="ai-provider-header">
          <div className="ai-provider-icon">⚡</div>
          <h2 className="ai-provider-title gradient-text">Conecta tu asistente de IA</h2>
          <p className="ai-provider-subtitle">
            Tu clave se usa solo en tu navegador y no se envía a nuestros servidores
          </p>
          <div className="ai-provider-privacy-badge">
            🔒 100% privado · Solo en tu dispositivo
          </div>
        </div>

        {/* Provider cards */}
        <div className="provider-cards">
          {/* Gemini */}
          <button
            id="select-gemini-btn"
            className={`provider-card ${selected === 'gemini' ? 'selected' : ''}`}
            onClick={() => setSelected('gemini')}
            type="button"
          >
            <div className="provider-card-header">
              <div className="provider-logo provider-logo-gemini">🤖</div>
              <div>
                <div className="provider-card-name">Google Gemini</div>
                <div className="provider-card-desc">Modelos multimodales de Google</div>
              </div>
            </div>
            {selected === 'gemini' && (
              <div className="provider-card-inputs" onClick={e => e.stopPropagation()}>
                {/* Model selector */}
                <select
                  id="gemini-model-select"
                  className="input provider-select"
                  value={geminiModel}
                  onChange={e => setGeminiModel(e.target.value)}
                >
                  {GEMINI_MODELS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                {/* Key input */}
                <div className="key-input-row">
                  <input
                    id="gemini-key-input"
                    type={showGeminiKey ? 'text' : 'password'}
                    className="input"
                    placeholder="AIzaSy..."
                    value={geminiKey}
                    onChange={e => { setGeminiKey(e.target.value); setStatus('idle'); }}
                    autoComplete="off"
                    spellCheck={false}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
                  />
                  <button
                    type="button"
                    className="key-toggle-btn"
                    onClick={() => setShowGeminiKey(v => !v)}
                    aria-label="Mostrar/ocultar clave"
                  >{showGeminiKey ? '🙈' : '👁️'}</button>
                </div>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="provider-link"
                >
                  Obtener clave gratuita en aistudio.google.com →
                </a>
              </div>
            )}
          </button>

          {/* Groq */}
          <button
            id="select-groq-btn"
            className={`provider-card ${selected === 'groq' ? 'selected' : ''}`}
            onClick={() => setSelected('groq')}
            type="button"
          >
            <div className="provider-card-header">
              <div className="provider-logo provider-logo-groq">⚡</div>
              <div>
                <div className="provider-card-name">Groq Cloud</div>
                <div className="provider-card-desc">Ultrarrápido · Tier gratuito muy generoso</div>
              </div>
            </div>
            {selected === 'groq' && (
              <div className="provider-card-inputs" onClick={e => e.stopPropagation()}>
                {/* Model selector */}
                <select
                  id="groq-model-select"
                  className="input provider-select"
                  value={groqModel}
                  onChange={e => setGroqModel(e.target.value)}
                >
                  {GROQ_MODELS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                {/* Key input */}
                <div className="key-input-row">
                  <input
                    id="groq-key-input"
                    type={showGroqKey ? 'text' : 'password'}
                    className="input"
                    placeholder="gsk_..."
                    value={groqKey}
                    onChange={e => { setGroqKey(e.target.value); setStatus('idle'); }}
                    autoComplete="off"
                    spellCheck={false}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
                  />
                  <button
                    type="button"
                    className="key-toggle-btn"
                    onClick={() => setShowGroqKey(v => !v)}
                    aria-label="Mostrar/ocultar clave"
                  >{showGroqKey ? '🙈' : '👁️'}</button>
                </div>
                <a
                  href="https://console.groq.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="provider-link"
                >
                  Obtener clave gratuita en console.groq.com →
                </a>
              </div>
            )}
          </button>
        </div>

        {/* Error message */}
        {status === 'error' && (
          <div className="provider-error">
            ❌ {errorMsg}
          </div>
        )}

        {/* Connect button */}
        <button
          id="ai-connect-btn"
          className={`btn ai-connect-btn ${status === 'success' ? 'btn-success-state' : ''}`}
          onClick={handleConnect}
          disabled={!activeKey.trim() || status === 'validating' || status === 'success'}
          style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
        >
          {status === 'validating' && <><span className="spinner spinner-sm" /> Verificando clave...</>}
          {status === 'success' && <>✅ ¡Conectado! Entrando a la app...</>}
          {status === 'idle' && `Conectar con ${selected === 'gemini' ? 'Google Gemini' : 'Groq Cloud'}`}
          {status === 'error' && `Reintentar con ${selected === 'gemini' ? 'Google Gemini' : 'Groq Cloud'}`}
        </button>

        <p className="provider-footer-note">
          Tu clave se almacena en <code>sessionStorage</code> y se elimina al cerrar la pestaña.
        </p>
      </div>
    </div>
  );
}
