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
export default function SecurityAuditButton({ disabled, onOpen, repoContextName }: SecurityAuditButtonProps) {
  const { t } = useLanguage();

  return (
    <button
      id="security-audit-btn"
      className="doc-repo-btn"
      disabled={disabled}
      type="button"
      title={t('chat.auditSecurity')}
      onClick={() => onOpen(repoContextName ?? undefined)}
    >
      🛡️ {t('chat.auditSecurity')}
    </button>
  );
}
