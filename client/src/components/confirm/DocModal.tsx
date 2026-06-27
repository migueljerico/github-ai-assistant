import { useState } from 'react';
import type { RepoAnalysis } from '../../types';
import PublishActions from './PublishActions';
import { useModalDialog } from '../../hooks/useModalDialog';

// ── Props ──────────────────────────────────────────────────────────────────────
interface DocModalProps {
  analysis: RepoAnalysis;
  onConfirm: () => void;
  onCreateDraftPr: () => void;
  /** Crea un GitHub Release con la doc generada (versión vacía = sugerida). #28 v3.8.0 */
  onCreateRelease: (version: string) => void;
  onCancel: () => void;
  isCommitting: boolean;
  isCreatingDraftPr: boolean;
  isCreatingRelease: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────
// Modal de revisión de la documentación generada (#45): el usuario revisa el
// README/MANUAL y elige entre commit directo o abrir un Draft PR. Extraído de
// App.tsx (#42) para aligerar el orquestador y poder testearlo de forma aislada.
export default function DocModal({
  analysis,
  onConfirm,
  onCreateDraftPr,
  onCreateRelease,
  onCancel,
  isCommitting,
  isCreatingDraftPr,
  isCreatingRelease,
}: DocModalProps) {
  const [activeTab, setActiveTab] = useState<'readme' | 'manual'>('readme');
  const [version, setVersion] = useState('');
  const busy = isCommitting || isCreatingDraftPr || isCreatingRelease;
  const modalRef = useModalDialog<HTMLDivElement>(onCancel);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="doc-modal-title">
      <div className="modal doc-repo-modal" ref={modalRef}>
        <div className="modal-header">
          <span className="modal-icon">📄</span>
          <div>
            <div className="modal-title" id="doc-modal-title">Documentación generada para {analysis.repoName}</div>
            <div className="modal-subtitle">
              Analicé {analysis.filesAnalyzed} archivo{analysis.filesAnalyzed !== 1 ? 's' : ''}.
              Revisa el contenido antes de publicarlo.
              <br />
              <small style={{ opacity: 0.7 }}>
                ¿Querías documentar un archivo suelto (con su fuente y extras)? Adjúntalo y usa 📤 Documentar y publicar.
              </small>
            </div>
          </div>
          <button id="doc-modal-close-btn" className="btn btn-ghost btn-icon" onClick={onCancel} style={{ marginLeft: 'auto' }}>✕</button>
        </div>
        <div className="modal-body">
          {analysis.truncated && (
            <div className="warning-banner">
              ⚠️ Repo muy grande — analizando los primeros {analysis.filesAnalyzed} archivos
            </div>
          )}
          <div className="doc-preview-tabs">
            <button id="doc-tab-readme" className={`doc-preview-tab ${activeTab === 'readme' ? 'active' : ''}`} onClick={() => setActiveTab('readme')}>
              📖 README.md
            </button>
            <button id="doc-tab-manual" className={`doc-preview-tab ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => setActiveTab('manual')}>
              🔧 MANUAL_TECNICO.md
            </button>
          </div>
          <div className="doc-preview-content">
            {activeTab === 'readme' ? analysis.readme : analysis.manualTecnico}
          </div>
        </div>
        <PublishActions
          version={version}
          onVersionChange={setVersion}
          onCommit={onConfirm}
          onDraftPr={onCreateDraftPr}
          onRelease={() => onCreateRelease(version.trim())}
          onCancel={onCancel}
          busy={busy}
          isCommitting={isCommitting}
          isCreatingDraftPr={isCreatingDraftPr}
          isCreatingRelease={isCreatingRelease}
        />
      </div>
    </div>
  );
}
