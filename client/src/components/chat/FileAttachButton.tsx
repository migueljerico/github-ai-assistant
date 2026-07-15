import { useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { SUPPORTED_FILE_EXTENSIONS } from '../../utils/pdfReader';
import { SPREADSHEET_MAX_FILE_SIZE } from '../../utils/spreadsheetReader';

interface FileAttachButtonProps {
  disabled: boolean;
  /** Nombres de los archivos adjuntos como contexto (vacío = ninguno). */
  fileNames: string[];
  onAttach: (files: File[]) => void;
  /** Quita un archivo concreto por índice. */
  onClearAt: (index: number) => void;
}

/**
 * #28 (Fase 1): adjuntar archivos locales (PDF/texto/código) como contexto del
 * chat. Soporta múltiples archivos (#57 Tanda B): cuando hay archivos cargados,
 * muestra un chip por archivo con su botón de descartar individual. Zero-Storage:
 * los archivos solo se leen en memoria.
 */
const ACCEPT = SUPPORTED_FILE_EXTENSIONS.map(e => `.${e}`).join(',');
const MAX_SIZE_MB = SPREADSHEET_MAX_FILE_SIZE / (1024 * 1024);

export default function FileAttachButton({ disabled, fileNames, onAttach, onClearAt }: FileAttachButtonProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (list && list.length > 0) onAttach(Array.from(list));
    e.target.value = ''; // permite volver a elegir los mismos archivos
  };

  // Archivo(s) ya adjuntado(s) → chip por archivo con opción de descartar.
  if (fileNames.length > 0) {
    const isSpreadsheet = fileNames.some(n => /\.(xlsx?|csv)$/i.test(n));
    return (
      <span className="repo-context-chip" id="file-context-chip" style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
        {fileNames.length === 1 ? (
          <>
            📎 <strong>{fileNames[0]}</strong>
            {isSpreadsheet && (
              <span style={{ fontSize: '0.7rem', opacity: 0.6, marginLeft: '4px' }}>
                {t('chat.attachFileXlsxWarning', { maxMb: MAX_SIZE_MB })}
              </span>
            )}
            <button
              type="button"
              className="repo-context-clear"
              onClick={() => onClearAt(0)}
              aria-label={t('chat.attachFileClearAria')}
              title={t('chat.attachFileClearTitle')}
            >
              ✕
            </button>
          </>
        ) : (
          <>
            📎 {t('chat.attachFileMulti', { count: fileNames.length })}
            {fileNames.map((name, i) => (
              <span key={`${name}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                <strong style={{ fontWeight: 400, opacity: 0.85 }}>{name}</strong>
                {/\.(xlsx?|csv)$/i.test(name) && (
                  <span style={{ fontSize: '0.7rem', opacity: 0.6, marginLeft: '4px' }}>
                    {t('chat.attachFileXlsxWarning', { maxMb: MAX_SIZE_MB })}
                  </span>
                )}
                <button
                  type="button"
                  className="repo-context-clear"
                  onClick={() => onClearAt(i)}
                  aria-label={t('chat.attachFileClearAria')}
                  title={t('chat.attachFileClearTitle')}
                >
                  ✕
                </button>
              </span>
            ))}
          </>
        )}
      </span>
    );
  }

  return (
    <>
      <button
        id="attach-file-btn"
        className="doc-repo-btn"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        type="button"
      >
        📎 {t('chat.attachFile')}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '4px', maxWidth: '280px' }}>
        {t('chat.attachFileXlsxWarning', { maxMb: MAX_SIZE_MB })}
      </div>
    </>
  );
}
