import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface ChangelogButtonProps {
  disabled: boolean;
  onGenerateChangelog: (input: string) => void;
}

/**
 * #34 — Botón "Generar changelog". Toggle entre botón y formulario (mismo patrón
 * que ThreadSummaryButton/DocumentRepoButton). El usuario introduce `owner/repo`
 * (o solo el repo) y se generan las notas del release desde el último publicado.
 */
export default function ChangelogButton({ disabled, onGenerateChangelog }: ChangelogButtonProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onGenerateChangelog(value.trim());
      setValue('');
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        id="changelog-btn"
        className="doc-repo-btn"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        type="button"
      >
        📋 {t('chat.changelog')}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <input
        id="changelog-input"
        autoFocus
        type="text"
        className="input"
        placeholder={t('chat.changelogPlaceholder')}
        value={value}
        onChange={e => setValue(e.target.value)}
        style={{ fontSize: '0.8rem', padding: '6px 10px', minWidth: '200px' }}
      />
      <button
        id="changelog-submit-btn"
        type="submit"
        className="btn btn-sm"
        style={{ background: 'var(--gradient)', color: 'white', border: 'none' }}
        disabled={!value.trim()}
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
