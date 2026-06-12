import { useState } from 'react';
import type { RepoAnalysis } from '../../types';

// ── Props ──────────────────────────────────────────────────────────────────────
interface DocModalProps {
  analysis: RepoAnalysis;
  onConfirm: () => void;
  onCancel: () => void;
  isCommitting: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function DocModal({
  analysis,
  onConfirm,
  onCancel,
  isCommitting,
}: DocModalProps) {
  const [activeTab, setActiveTab] = useState<'readme' | 'manual'>('readme');

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="modal doc-repo-modal">
        <div className="modal-header">
          <span className="modal-icon">📄</span>
          <div>
            <div className="modal-title">Documentación generada para {analysis.repoName}</div>
            <div className="modal-subtitle">
              Analicé {analysis.filesAnalyzed} archivo{analysis.filesAnalyzed !== 1 ? 's' : ''}.
              Revisa el contenido antes de hacer commit.
            </div>
          </div>
          <button
            id="doc-modal-close-btn"
            className="btn btn-ghost btn-icon"
            onClick={onCancel}
            style={{ marginLeft: 'auto' }}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {analysis.truncated && (
            <div className="warning-banner">
              ⚠️ Repo muy grande — analizando los primeros {analysis.filesAnalyzed} archivos
            </div>
          )}
          <div className="doc-preview-tabs">
            <button
              id="doc-tab-readme"
              className={`doc-preview-tab ${activeTab === 'readme' ? 'active' : ''}`}
              onClick={() => setActiveTab('readme')}
            >
              📖 README.md
            </button>
            <button
              id="doc-tab-manual"
              className={`doc-preview-tab ${activeTab === 'manual' ? 'active' : ''}`}
              onClick={() => setActiveTab('manual')}
            >
              🔧 MANUAL_TECNICO.md
            </button>
          </div>
          <div className="doc-preview-content">
            {activeTab === 'readme' ? analysis.readme : analysis.manualTecnico}
          </div>
        </div>

        <div className="modal-footer">
          <button
            id="doc-cancel-btn"
            className="btn btn-danger"
            onClick={onCancel}
            disabled={isCommitting}
          >
            ❌ Cancelar
          </button>
          <button
            id="doc-confirm-btn"
            className="btn btn-success"
            onClick={onConfirm}
            disabled={isCommitting}
          >
            {isCommitting
              ? <><span className="spinner spinner-sm" /> Haciendo commit...</>
              : '✅ Hacer commit de ambos archivos'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
