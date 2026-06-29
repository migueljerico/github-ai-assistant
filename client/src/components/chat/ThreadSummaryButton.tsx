import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface ThreadSummaryButtonProps {
  disabled: boolean;
  onSummarizeThread: (input: string) => void;
}

/**
 * #32 — Botón "Resumir hilo". Toggle entre botón y formulario (mismo patrón que
 * DocumentRepoButton). El usuario introduce `owner/repo#42` (o `#42` si hay un
 * repo de contexto activo) y se dispara el resumen del hilo de ese issue/PR.
 */
export default function ThreadSummaryButton({ disabled, onSummarizeThread }: ThreadSummaryButtonProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSummarizeThread(value.trim());
      setValue('');
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        id="thread-summary-btn"
        className="doc-repo-btn"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        type="button"
      >
        📝 {t('chat.threadSummary')}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <input
        id="thread-summary-input"
        autoFocus
        type="text"
        className="input"
        placeholder={t('chat.threadSummaryPlaceholder')}
        value={value}
        onChange={e => setValue(e.target.value)}
        style={{ fontSize: '0.8rem', padding: '6px 10px', minWidth: '200px' }}
      />
      <button
        id="thread-summary-submit-btn"
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
