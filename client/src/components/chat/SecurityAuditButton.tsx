import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface SecurityAuditButtonProps {
  disabled: boolean;
  /** Lanza el Modo Auditoría de Seguridad sobre el repo activo o el indicado. */
  onOpen: (initialRepo?: string) => void;
  /** Nombre del repo cargado en contexto (p. ej. "owner/repo"), si lo hay. */
  repoContextName: string | null;
}

// #52: Modo Auditoría de Seguridad. Botón que lanza runSecurityAudit sobre el
// repo activo (si lo hay) o sobre el que el usuario indique. Revisión orientativa
// (no sustituye a gitleaks/Dependabot) — el disclaimer vive en el prompt y en la
// burbuja de carga. Lectura-only: no abre ConfirmModal.
//
// v3.43.0: si NO hay repo activo, en vez de soltar "chat.repoNeeded" y colgarse
// (bug previo: App.tsx:351-355), el botón abre un input inline `owner/repo`.
// Al confirmar, App carga el contexto (aparece el chip "Contexto") y encadena la
// auditoría sobre ese repo — un solo gesto del usuario.
export default function SecurityAuditButton({ disabled, onOpen, repoContextName }: SecurityAuditButtonProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [repoInput, setRepoInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = repoInput.trim();
    if (trimmed) {
      onOpen(trimmed);
      setRepoInput('');
      setIsOpen(false);
    }
  };

  // Repo activo → botón directo (comportamiento previo, sin cambios).
  if (repoContextName) {
    return (
      <button
        id="security-audit-btn"
        className="doc-repo-btn"
        disabled={disabled}
        type="button"
        title={t('chat.auditSecurity')}
        onClick={() => onOpen(repoContextName)}
      >
        {t('chat.auditSecurity')}
      </button>
    );
  }

  // Sin repo activo → botón que abre input inline (mismo patrón que
  // RepoContextButton/ChangelogButton). Así nunca se alcanza el estado
  // "repoNeeded" por la vía de la UI.
  if (!isOpen) {
    return (
      <button
        id="security-audit-btn"
        className="doc-repo-btn"
        disabled={disabled}
        type="button"
        title={t('chat.auditSecurity')}
        onClick={() => setIsOpen(true)}
      >
        {t('chat.auditSecurity')}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <input
        id="security-audit-input"
        autoFocus
        type="text"
        className="input"
        placeholder={t('chat.repoInputPlaceholder')}
        value={repoInput}
        onChange={e => setRepoInput(e.target.value)}
        style={{ fontSize: '0.8rem', padding: '6px 10px', minWidth: '200px' }}
      />
      <button
        id="security-audit-submit-btn"
        type="submit"
        className="btn btn-sm"
        style={{ background: 'var(--gradient)', color: 'white', border: 'none' }}
        disabled={!repoInput.trim()}
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
