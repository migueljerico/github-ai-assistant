import { useState } from 'react';

interface RepoContextButtonProps {
  disabled: boolean;
  /** Nombre del repo cargado como contexto activo, o null si no hay ninguno. */
  activeContext: string | null;
  onLoadContext: (repoName: string) => void;
  onClearContext: () => void;
}

/**
 * Disparador para cargar un repositorio como "contexto activo" del chat (#41).
 * Replica el patrón de DocumentRepoButton. Cuando hay un contexto cargado,
 * muestra un chip con el repo y un botón para descartarlo.
 */
export default function RepoContextButton({
  disabled,
  activeContext,
  onLoadContext,
  onClearContext,
}: RepoContextButtonProps) {
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
        💬 Contexto: <strong>{activeContext}</strong>
        <button
          type="button"
          className="repo-context-clear"
          onClick={onClearContext}
          aria-label="Descartar contexto del repositorio"
          title="Descartar contexto"
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
        💬 Opinar sobre repo
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
        placeholder="nombre-del-repo o owner/repo"
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
