import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface RepoContextButtonProps {
  disabled: boolean;
  /** Nombre del repo cargado como contexto activo, o null si no hay ninguno. */
  activeContext: string | null;
  onLoadContext: (repoName: string) => void;
  onClearContext: () => void;
}

/**
 * Botón "Cargar repo" (#41, v3.43.0): carga un repositorio como "contexto
 * activo" del chat SIN opinar (solo inyecta el árbol de archivos + contenido en
 * la conversación; el LLM no se llama hasta el próximo turno del usuario).
 * Antes era "💬 Opinar sobre repo" — nombre engañoso, renombrado en v3.43.0.
 * Replica el patrón de DocumentRepoButton. Cuando hay un contexto cargado,
 * muestra un chip con el repo y un botón para descartarlo.
 */
export default function RepoContextButton({
  disabled,
  activeContext,
  onLoadContext,
  onClearContext,
}: RepoContextButtonProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [repoName, setRepoName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (repoName.trim()) {
      onLoadContext(repoName.trim());
      setRepoName('');
      setIsOpen(false);
    }
  };

  // Contexto ya cargado → mostrar chip con opción de descartar
  if (activeContext) {
    return (
      <span className="repo-context-chip" id="repo-context-chip">
        📂 {t('chat.contextPrefix')}: <strong>{activeContext}</strong>
        <button
          type="button"
          className="repo-context-clear"
          onClick={onClearContext}
          aria-label={t('chat.contextClearAria')}
          title={t('chat.contextClearTitle')}
        >
          ✕
        </button>
      </span>
    );
  }

  if (!isOpen) {
    return (
      <button
        id="repo-context-btn"
        className="doc-repo-btn"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        type="button"
      >
        {t('chat.opinionRepo')}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <input
        id="repo-context-input"
        autoFocus
        type="text"
        className="input"
        placeholder={t('chat.repoInputPlaceholder')}
        value={repoName}
        onChange={e => setRepoName(e.target.value)}
        style={{ fontSize: '0.8rem', padding: '6px 10px', minWidth: '200px' }}
      />
      <button
        id="repo-context-submit-btn"
        type="submit"
        className="btn btn-sm"
        style={{ background: 'var(--gradient)', color: 'white', border: 'none' }}
        disabled={!repoName.trim()}
      >
        ✓
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setIsOpen(false)}
      >
        ✕
      </button>
    </form>
  );
}
