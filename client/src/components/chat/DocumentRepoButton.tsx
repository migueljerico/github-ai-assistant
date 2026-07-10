import { useLanguage } from '../../context/LanguageContext';

interface DocumentRepoButtonProps {
  disabled: boolean;
  /** Abre el flujo único de documentación (#57). */
  onOpen: () => void;
}

// #57: ya no pide el repo aquí; el paso 2 del flujo unificado (DocumentFlowModal)
// solicita el repo (o el archivo adjunto) y centraliza la generación y publicación.
export default function DocumentRepoButton({ disabled, onOpen }: DocumentRepoButtonProps) {
  const { t } = useLanguage();

  return (
    <button
      id="doc-repo-btn"
      className="doc-repo-btn"
      onClick={onOpen}
      disabled={disabled}
      type="button"
    >
      📄 {t('chat.documentRepo')}
    </button>
  );
}
