import { useLanguage } from '../../context/LanguageContext';

interface SyncRepoStatusButtonProps {
  disabled?: boolean;
  onSyncRepoStatus: (repoName: string) => void;
}

export default function SyncRepoStatusButton({
  disabled = false,
  onSyncRepoStatus,
}: SyncRepoStatusButtonProps) {
  const { t } = useLanguage();

  const handleClick = () => {
    // #26 (v4.0.52): el `?? 'Introduce...'` era código muerto — t() siempre
    // devuelve un string (fallback final a la clave cruda en LanguageContext).
    const repo = prompt(t('syncRepo.prompt'));
    if (repo && repo.trim()) {
      onSyncRepoStatus(repo.trim());
    }
  };

  return (
    <button
      id="sync-repo-status-btn"
      className="btn btn-ghost btn-sm"
      onClick={handleClick}
      disabled={disabled}
      title={t('syncRepo.tooltip')}
      aria-label={t('syncRepo.title')}
    >
      🔄 <span className="btn-label">{t('syncRepo.title')}</span>
    </button>
  );
}
