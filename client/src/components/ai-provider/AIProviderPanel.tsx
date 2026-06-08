import { useState, useEffect } from 'react';
import { useAIProvider, type AIProviderType } from '../../context/AIProviderContext';
import { validateProviderKey } from '../../services/gemini';

// ── Gemini models ─────────────────────────────────────────────────────────────
// IMPORTANT: gemini-2.0-flash, gemini-1.5-flash and gemini-1.5-pro have their
// free-tier quota set to 0 by Google and will always return a 429 error.
// Only models in the gemini-2.5-* family have active free quota.
const GEMINI_MODELS = [
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

// Fallback shown while Groq models load or if the API call fails
const GROQ_FALLBACK: Array<{ value: string; label: string }> = [
  { value: 'llama-3.3-70b-versatile', label: 'llama-3.3-70b-versatile' },
  { value: 'llama-3.1-8b-instant',    label: 'llama-3.1-8b-instant' },
];

// Prefixes of non-chat Groq models to exclude from the selector
const GROQ_EXCLUDED = ['whisper', 'distil-whisper', 'playai', 'llama-guard', 'tts'];

export default function AIProviderPanel() {
  const { connect } = useAIProvider();
  const [selected, setSelected]           = useState<AIProviderType>('gemini');
  const [geminiKey, setGeminiKey]         = useState('');
  const [groqKey, setGroqKey]             = useState('');
  const [geminiModel, setGeminiModel]     = useState(GEMINI_MODELS[0].value);
  const [groqModel, setGroqModel]         = useState(GROQ_FALLBACK[0].value);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showGroqKey, setShowGroqKey]     = useState(false);
  const [status, setStatus]               = useState<'idle' | 'validating' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg]           = useState('');

  // Dynamic Groq model catalogue
  const [groqModels, setGroqModels]         = useState(GROQ_FALLBACK);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsLoaded, setModelsLoaded]     = useState(false);

  const activeKey   = selected === 'gemini' ? geminiKey   : groqKey;
  const activeModel = selected === 'gemini' ? geminiModel : groqModel;
  const geminiInfo  = GEMINI_MODELS.find(m => m.value === geminiModel);

  // ── Load Groq models dynamically when the key looks valid ──────────────────
  useEffect(() => {
    if (selected !== 'groq') return;
    if (!groqKey.startsWith('gsk_') || groqKey.length < 20) return;

    const CACHE_KEY = 'groq_models_cache';
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { models, ts } = JSON.parse(cached) as {
          models: Array<{ value: string; label: string }>;
          ts: number;
        };
        if (Date.now() - ts < 3_600_000) {   // cache valid 1 hour
          setGroqModels(models);
          setModelsLoaded(true);
          return;
        }
      } catch { /* corrupt cache — ignore */ }
    }

    const fetchModels = async () => {
      setIsLoadingModels(true);
      try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${groqKey}` },
        });
        if (!res.ok) throw new Error('API error');

        const data = await res.json() as { data: Array<{ id: string }> };
        const models = data.data
          .filter(m => !GROQ_EXCLUDED.some(p => m.id.startsWith(p)))
          .sort((a, b) => a.id.localeCompare(b.id))
          .map(m => ({ value: m.id, label: m.id }));

        if (models.length === 0) throw new Error('empty');

        setGroqModels(models);
        setModelsLoaded(true);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ models, ts: Date.now() }));

        // Keep current selection if still available; otherwise prefer 70b
        if (!models.find(m => m.value === groqModel)) {
          const pref = models.find(m => m.value === 'llama-3.3-70b-versatile');
          setGroqModel(pref ? pref.value : models[0].value);
        }
      } catch {
        // Silent fallback — GROQ_FALLBACK stays in state
      } finally {
        setIsLoadingModels(false);
      }
    };

    void fetchModels();
  }, [selected, groqKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnect = async () => {
    if (!activeKey.trim()) return;
    setStatus('validating');
    setErrorMsg('');

    const result = await validateProviderKey(selected, activeKey.trim(), activeModel);
    if (result.valid) {
      setStatus('success');
      setTimeout(() => connect(selected, activeKey.trim(), activeModel), 800);
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
          <div className="ai-provider-privacy-badge">🔒 100% privado · Solo en tu dispositivo</div>
        </div>

        {/* Provider cards */}
        <div className="provider-cards">

          {/* ── Gemini ── */}
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
                <div className="provider-card-desc">Modelos 2.5 · free tier activo</div>
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

                {/* Model description */}
                {geminiInfo && (
                  <p style={{
                    fontSize: '0.74rem',
                    color: geminiInfo.recommended ? 'var(--color-success, #22c55e)' : '#f59e0b',
                    margin: '4px 0 8px',
                    lineHeight: 1.45,
                  }}>
                    {geminiInfo.recommended ? '✅' : '⚠️'} {geminiInfo.description}
                  </p>
                )}

                {/* Deprecation notice */}
                <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                  ℹ️ Los modelos <strong>gemini-2.0</strong> y <strong>gemini-1.5</strong> están deprecados y tienen cuota = 0. Solo usa modelos <strong>2.5</strong>.
                </p>

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
                  <button type="button" className="key-toggle-btn"
                    onClick={() => setShowGeminiKey(v => !v)}
                    aria-label="Mostrar/ocultar clave">
                    {showGeminiKey ? '🙈' : '👁️'}
                  </button>
                </div>

                <a href="https://aistudio.google.com/apikey" target="_blank"
                  rel="noopener noreferrer" className="provider-link">
                  Obtener clave gratuita en aistudio.google.com →
                </a>
              </div>
            )}
          </button>

          {/* ── Groq ── */}
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

                {/* Model selector — dynamic */}
                <select
                  id="groq-model-select"
                  className="input provider-select"
                  value={groqModel}
                  onChange={e => setGroqModel(e.target.value)}
                  disabled={isLoadingModels}
                >
                  {isLoadingModels
                    ? <option value="">Cargando modelos...</option>
                    : groqModels.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))
                  }
                </select>

                {/* Model status feedback */}
                {isLoadingModels && (
                  <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '3px 0 6px' }}>
                    ⏳ Cargando catálogo actualizado desde Groq...
                  </p>
                )}
                {!isLoadingModels && modelsLoaded && (
                  <p style={{ fontSize: '0.72rem', color: 'var(--color-success, #22c55e)', margin: '3px 0 6px' }}>
                    ✅ {groqModels.length} modelos disponibles · Catálogo en tiempo real
                  </p>
                )}

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
                  <button type="button" className="key-toggle-btn"
                    onClick={() => setShowGroqKey(v => !v)}
                    aria-label="Mostrar/ocultar clave">
                    {showGroqKey ? '🙈' : '👁️'}
                  </button>
                </div>

                <a href="https://console.groq.com" target="_blank"
                  rel="noopener noreferrer" className="provider-link">
                  Obtener clave gratuita en console.groq.com →
                </a>
              </div>
            )}
          </button>
        </div>

        {/* Error */}
        {status === 'error' && (
          <div className="provider-error">❌ {errorMsg}</div>
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
          {status === 'success'    && <>✅ ¡Conectado! Entrando a la app...</>}
          {status === 'idle'       && `Conectar con ${selected === 'gemini' ? 'Google Gemini' : 'Groq Cloud'}`}
          {status === 'error'      && `Reintentar con ${selected === 'gemini' ? 'Google Gemini' : 'Groq Cloud'}`}
        </button>

        <p className="provider-footer-note">
          Tu clave se almacena en <code>sessionStorage</code> y se elimina al cerrar la pestaña.
        </p>
      </div>
    </div>
  );
}
