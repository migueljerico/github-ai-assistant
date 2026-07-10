import { useState, useEffect } from 'react';
import { useAIProvider } from '../../context/AIProviderContext';
import { validateProviderKey } from '../../services/gemini';
import { PROVIDERS, getProvider, fetchModels, pickDefaultModel, type AIProviderType, type ModelOption } from '../../services/providers';
import { modelLabel } from '../../utils/modelLabels';
import { loadProviderPref } from '../../utils/providerPrefs';
import { useLanguage } from '../../context/LanguageContext';

const PROVIDER_LIST = Object.values(PROVIDERS);

const initKeys = () => Object.fromEntries(PROVIDER_LIST.map(p => [p.id, ''])) as Record<AIProviderType, string>;
// #40: tras recargar, precarga el modelo recordado para su proveedor (la key NO se
// recuerda: el usuario solo tiene que volver a pegarla).
const initModels = () => {
  const base = Object.fromEntries(PROVIDER_LIST.map(p => [p.id, p.defaultModel])) as Record<AIProviderType, string>;
  const pref = loadProviderPref();
  if (pref) base[pref.provider] = pref.model;
  return base;
};
const initCatalog = () => Object.fromEntries(PROVIDER_LIST.map(p => [p.id, p.staticModels])) as Record<AIProviderType, ModelOption[]>;
const initLoaded = () => Object.fromEntries(PROVIDER_LIST.map(p => [p.id, false])) as Record<AIProviderType, boolean>;

export default function AIProviderPanel() {
  const { connect } = useAIProvider();
  const { t } = useLanguage();
  // #40: arranca en el proveedor recordado (si lo hay) en vez de Gemini por defecto.
  const [selected, setSelected] = useState<AIProviderType>(() => loadProviderPref()?.provider ?? 'gemini');
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
    // Si el endpoint requiere key, espera a que tenga pinta válida.
    // keyPrefix es opcional: si no está definido, basta con longitud mínima.
    // Antes `!def.keyPrefix` bloqueaba Gemini por completo y el catálogo
    // dinámico nunca se pedía (#58 hotfix v3.23.2).
    if (def.modelsNeedKey) {
      if (!key || key.length < 20) return;
      if (def.keyPrefix && !key.startsWith(def.keyPrefix)) return;
    }

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

  /** Texto de la opción: traduce si es clave, formatea si es literal. */
  const optionLabel = (m: ModelOption): string => {
    // Si la etiqueta es una clave de traducción (ej. 'provider.gemini...'), la traduce.
    // Si es un literal dinámico (ej. 'llama-3.3-70b'), usa modelLabel.
    const translated = t(m.label);
    const base = translated !== m.label ? translated : modelLabel(m.value);
    return m.free ? `🆓 ${base}` : base;
  };

  return (
    <div className="auth-screen">
      <div className="auth-card ai-provider-card">

        {/* Header */}
        <div className="ai-provider-header">
          <div className="ai-provider-icon">⚡</div>
          <h2 className="ai-provider-title gradient-text">{t('aipanel.title')}</h2>
          <p className="ai-provider-subtitle">
            {t('aipanel.subtitle')}
          </p>
          <div className="ai-provider-privacy-badge">{t('aipanel.privacyBadge')}</div>
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
                    <div className="provider-card-desc">{t(p.cardDesc)}</div>
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
                        {t('aipanel.model')} {!loadingModels && ` · ${activeCatalog.length} ${t('aipanel.available')}${freeCount ? ` · ${freeCount} 🆓` : ''}`}
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
                        ? <option value="">{t('aipanel.loadingModels')}</option>
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
                        {selectedModelInfo.recommended ? '✅' : '⚠️'} {t(selectedModelInfo.description)}
                      </p>
                    )}

                    {/* Estado de carga del catálogo dinámico */}
                    {p.modelsEndpoint && loadingModels && (
                      <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '3px 0 6px' }}>
                        {t('aipanel.loadingCatalog')}
                      </p>
                    )}
                    {p.modelsEndpoint && !loadingModels && modelsLoaded[p.id] && (
                      <p style={{ fontSize: '0.72rem', color: 'var(--color-success, #22c55e)', margin: '3px 0 6px' }}>
                        {t('aipanel.catalogLoaded')}
                      </p>
                    )}

                    {/* Nota del proveedor (deprecación Gemini, gratis OpenRouter…) */}
                    {p.note && (
                      <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '8px', lineHeight: 1.45 }}>
                        {t(p.note)}
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
                        aria-label={t('aipanel.toggleKeyVisibility')}>
                        {showKey ? '🙈' : '👁️'}
                      </button>
                    </div>

                    <a href={p.signupUrl} target="_blank"
                      rel="noopener noreferrer" className="provider-link">
                      {t(p.signupLabel)}
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
          {status === 'validating' && <><span className="spinner spinner-sm" /> {t('aipanel.verifyingKey')}</>}
          {status === 'success'    && <>✅ {t('aipanel.connected')}</>}
          {status === 'idle'       && t('aipanel.connectWith', { provider: def.name })}
          {status === 'error'      && t('aipanel.retryWith', { provider: def.name })}
        </button>

        <p className="provider-footer-note">
          🔒 {t('aipanel.footer1')} <strong>{t('aipanel.footer2')}</strong> {t('aipanel.footer3')} <strong>{t('aipanel.footer4')}</strong> {t('aipanel.footer5')}
        </p>
      </div>
    </div>
  );
}
