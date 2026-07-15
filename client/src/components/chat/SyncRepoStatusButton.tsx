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
    const repo = prompt(t('syncRepo.prompt') ?? 'Introduce el repositorio (owner/repo o nombre):');
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
