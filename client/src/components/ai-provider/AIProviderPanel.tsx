import { useState, useEffect } from 'react';
import { useAIProvider } from '../../context/AIProviderContext';
import { validateProviderKey } from '../../services/gemini';
import { PROVIDERS, getProvider, fetchModels, pickDefaultModel, type AIProviderType, type ModelOption } from '../../services/providers';
import { modelLabel } from '../../utils/modelLabels';

const PROVIDER_LIST = Object.values(PROVIDERS);

const initKeys = () => Object.fromEntries(PROVIDER_LIST.map(p => [p.id, ''])) as Record<AIProviderType, string>;
const initModels = () => Object.fromEntries(PROVIDER_LIST.map(p => [p.id, p.defaultModel])) as Record<AIProviderType, string>;
const initCatalog = () => Object.fromEntries(PROVIDER_LIST.map(p => [p.id, p.staticModels])) as Record<AIProviderType, ModelOption[]>;
const initLoaded = () => Object.fromEntries(PROVIDER_LIST.map(p => [p.id, false])) as Record<AIProviderType, boolean>;

/** Texto de la opción: usa la etiqueta descriptiva si la hay; si no, prettifica el id. */
function optionLabel(m: ModelOption): string {
  const base = m.label !== m.value ? m.label : modelLabel(m.value);
  return m.free ? `🆓 ${base}` : base;
}

export default function AIProviderPanel() {
  const { connect } = useAIProvider();
  const [selected, setSelected] = useState<AIProviderType>('gemini');
  const [keys, setKeys] = useState<Record<AIProviderType, string>>(initKeys);
  const [models, setModels] = useState<Record<AIProviderType, string>>(initModels);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<'idle' | 'validating' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Catálogo de modelos (dinámico para proveedores con modelsEndpoint)
  const [catalog, setCatalog] = useState<Record<AIProviderType, ModelOption[]>>(initCatalog);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState<Record<AIProviderType, boolean>>(initLoaded);

  const def = getProvider(selected);
  const activeKey = keys[selected];
  const activeModel = models[selected];
  const activeCatalog = catalog[selected];
  const selectedModelInfo = activeCatalog.find(m => m.value === activeModel);
  const freeCount = activeCatalog.filter(m => m.free).length;

  // ── Carga dinámica del catálogo de modelos ─────────────────────────────────
  useEffect(() => {
    if (!def.modelsEndpoint) return;
    const key = keys[selected];
    // Si el endpoint requiere key (Groq), espera a que tenga pinta válida.
    if (def.modelsNeedKey && (!def.keyPrefix || !key.startsWith(def.keyPrefix) || key.length < 20)) return;

    let cancelled = false;
    const load = async () => {
      setLoadingModels(true);
      try {
        const list = await fetchModels(def, key || undefined);
        if (cancelled || !list) return;
        setCatalog(prev => ({ ...prev, [selected]: list }));
        setModelsLoaded(prev => ({ ...prev, [selected]: true }));
        // Respeta la elección explícita del usuario si sigue disponible. Si aún
        // tiene el default estático (no ha tocado el selector) o ese modelo ya no
        // está en el catálogo, escoge un default fiable (pickDefaultModel).
        setModels(prev => {
          const current = prev[selected];
          const stillValid = list.some(m => m.value === current);
          const userChose = current !== def.defaultModel;
          if (stillValid && userChose) return prev;
          return { ...prev, [selected]: pickDefaultModel(list, current) };
        });
      } catch {
        // Silencioso — se mantiene el fallback estático del registro.
      } finally {
        if (!cancelled) setLoadingModels(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [selected, keys, def]); // eslint-disable-line react-hooks/exhaustive-deps

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

        {/* Provider cards (generadas desde el registro) */}
        <div className="provider-cards">
          {PROVIDER_LIST.map(p => {
            const isSel = selected === p.id;
            return (
              <div
                key={p.id}
                id={`select-${p.id}-btn`}
                className={`provider-card ${isSel ? 'selected' : ''}`}
                onClick={() => { setSelected(p.id); setStatus('idle'); }}
                role="button"
                tabIndex={0}
                aria-pressed={isSel}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelected(p.id);
                    setStatus('idle');
                  }
                }}
              >
                <div className="provider-card-header">
                  <div className={`provider-logo provider-logo-${p.id}`}>{p.emoji}</div>
                  <div>
                    <div className="provider-card-name">{p.name}</div>
                    <div className="provider-card-desc">{p.cardDesc}</div>
                  </div>
                </div>

                {isSel && (
                  <div className="provider-card-inputs" onClick={e => e.stopPropagation()}>

                    {/* Etiqueta + contador (solo proveedores con catálogo dinámico) */}
                    {p.modelsEndpoint && (
                      <label
                        htmlFor={`${p.id}-model-select`}
                        style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '0 0 4px' }}
                      >
                        Modelo{!loadingModels && ` · ${activeCatalog.length} disponibles${freeCount ? ` · ${freeCount} 🆓` : ''}`}
                      </label>
                    )}

                    {/* Selector de modelo */}
                    <select
                      id={`${p.id}-model-select`}
                      className="input provider-select"
                      value={activeModel}
                      onChange={e => setModels(prev => ({ ...prev, [p.id]: e.target.value }))}
                      disabled={loadingModels}
                    >
                      {loadingModels
                        ? <option value="">Cargando modelos...</option>
                        : activeCatalog.map(m => (
                            <option key={m.value} value={m.value}>{optionLabel(m)}</option>
                          ))
                      }
                    </select>

                    {/* Descripción del modelo seleccionado (Gemini) */}
                    {selectedModelInfo?.description && (
                      <p style={{
                        fontSize: '0.74rem',
                        color: selectedModelInfo.recommended ? 'var(--color-success, #22c55e)' : '#f59e0b',
                        margin: '4px 0 8px',
                        lineHeight: 1.45,
                      }}>
                        {selectedModelInfo.recommended ? '✅' : '⚠️'} {selectedModelInfo.description}
                      </p>
                    )}

                    {/* Estado de carga del catálogo dinámico */}
                    {p.modelsEndpoint && loadingModels && (
                      <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '3px 0 6px' }}>
                        ⏳ Cargando catálogo actualizado...
                      </p>
                    )}
                    {p.modelsEndpoint && !loadingModels && modelsLoaded[p.id] && (
                      <p style={{ fontSize: '0.72rem', color: 'var(--color-success, #22c55e)', margin: '3px 0 6px' }}>
                        ✅ Catálogo cargado en tiempo real
                      </p>
                    )}

                    {/* Nota del proveedor (deprecación Gemini, gratis OpenRouter…) */}
                    {p.note && (
                      <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '8px', lineHeight: 1.45 }}>
                        {p.note}
                      </p>
                    )}

                    {/* Key input */}
                    <div className="key-input-row">
                      <input
                        id={`${p.id}-key-input`}
                        type={showKey ? 'text' : 'password'}
                        className="input"
                        placeholder={p.keyPlaceholder}
                        value={keys[p.id]}
                        onChange={e => { setKeys(prev => ({ ...prev, [p.id]: e.target.value })); setStatus('idle'); }}
                        autoComplete="off"
                        spellCheck={false}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
                      />
                      <button type="button" className="key-toggle-btn"
                        onClick={() => setShowKey(v => !v)}
                        aria-label="Mostrar/ocultar clave">
                        {showKey ? '🙈' : '👁️'}
                      </button>
                    </div>

                    <a href={p.signupUrl} target="_blank"
                      rel="noopener noreferrer" className="provider-link">
                      {p.signupLabel}
                    </a>
                  </div>
                )}
              </div>
            );
          })}
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
          {status === 'idle'       && `Conectar con ${def.name}`}
          {status === 'error'      && `Reintentar con ${def.name}`}
        </button>

        <p className="provider-footer-note">
          🔒 Tu clave vive <strong>solo en la memoria del navegador</strong> (Zero-Storage): desaparece al recargar o cerrar la pestaña y nunca se guarda.
        </p>
      </div>
    </div>
  );
}
