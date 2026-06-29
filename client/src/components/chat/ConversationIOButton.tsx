import { useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface ConversationIOButtonProps {
  disabled: boolean;
  /** Hay mensajes en la conversación (si no, no se puede exportar). */
  hasMessages: boolean;
  onExport: () => void;
  onImport: (file: File) => void;
}

// #46 — Exportar/importar la conversación (Zero-Storage: el usuario controla el
// fichero, nada se auto-persiste). Patrón del input oculto de FileAttachButton.
export default function ConversationIOButton({ disabled, hasMessages, onExport, onImport }: ConversationIOButtonProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImport(file);
    e.target.value = ''; // permite volver a elegir el mismo archivo
  };

  return (
    <>
      <button
        id="export-conversation-btn"
        className="doc-repo-btn"
        onClick={onExport}
        disabled={disabled || !hasMessages}
        type="button"
        title={t('chat.exportTitle')}
      >
        💾 {t('chat.export')}
      </button>
      <button
        id="import-conversation-btn"
        className="doc-repo-btn"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        type="button"
        title={t('chat.importTitle')}
      >
        📂 {t('chat.import')}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
    </>
  );
}
