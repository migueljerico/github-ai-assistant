import { useRef } from 'react';
import { SUPPORTED_FILE_EXTENSIONS } from '../../utils/pdfReader';

interface FileAttachButtonProps {
  disabled: boolean;
  /** Nombre del archivo adjunto como contexto, o null si no hay ninguno. */
  fileName: string | null;
  onAttach: (file: File) => void;
  onClear: () => void;
}

/**
 * #28 (Fase 1): adjuntar un archivo local (PDF/texto/código) como contexto del
 * chat. Replica el patrón de RepoContextButton: cuando hay un archivo cargado,
 * muestra un chip con su nombre y un botón para descartarlo. Zero-Storage: el
 * archivo solo se lee en memoria.
 */
const ACCEPT = SUPPORTED_FILE_EXTENSIONS.map(e => `.${e}`).join(',');

export default function FileAttachButton({ disabled, fileName, onAttach, onClear }: FileAttachButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onAttach(file);
    e.target.value = ''; // permite volver a elegir el mismo archivo
  };

  // Archivo ya adjunto → chip con opción de descartar.
  if (fileName) {
    return (
      <span className="repo-context-chip" id="file-context-chip">
        📎 <strong>{fileName}</strong>
        <button
          type="button"
          className="repo-context-clear"
          onClick={onClear}
          aria-label="Quitar archivo adjunto"
          title="Quitar archivo"
        >
          ✕
        </button>
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
        📎 Adjuntar archivo
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        style={{ display: 'none' }}
        onChange={handleChange}
      />
    </>
  );
}
