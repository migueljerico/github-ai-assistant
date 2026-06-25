import { useState } from 'react';

// ── Props ──────────────────────────────────────────────────────────────────────
interface FilePublishModalProps {
  fileName: string;
  /** Documentación (Markdown) generada a partir del archivo adjunto. */
  doc: string;
  busy: boolean;
  /** Si está, el repo destino no existe: se ofrece crearlo y publicar (#28 fix). */
  repoMissing?: { owner: string; repo: string } | null;
  onCommit: (repo: string) => void;
  onDraftPr: (repo: string) => void;
  onRelease: (repo: string, version: string) => void;
  /** Confirmar la creación del repo inexistente y publicar el `kind` pendiente. */
  onCreateRepoAndPublish?: () => void;
  /** Descartar la oferta de crear repo (volver a editar el destino). */
  onCancelCreate?: () => void;
  onCancel: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────
// #28 Fase 2: tras generar la documentación de un archivo adjunto, el usuario
// elige el repo destino y cómo publicarla: commit directo, Draft PR o Release.
// Cada acción es propón→confirma→ejecuta (este modal es la confirmación).
export default function FilePublishModal({
  fileName,
  doc,
  busy,
  repoMissing,
  onCommit,
  onDraftPr,
  onRelease,
  onCreateRepoAndPublish,
  onCancelCreate,
  onCancel,
}: FilePublishModalProps) {
  const [repo, setRepo] = useState('');
  const [version, setVersion] = useState('');
  const repoOk = repo.trim().length > 0;

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="modal doc-repo-modal">
        <div className="modal-header">
          <span className="modal-icon">📤</span>
          <div>
            <div className="modal-title">Documentar y publicar — {fileName}</div>
            <div className="modal-subtitle">
              Revisa la documentación generada, indica el repositorio destino y elige cómo publicarla.
            </div>
          </div>
          <button id="filepub-close-btn" className="btn btn-ghost btn-icon" onClick={onCancel} style={{ marginLeft: 'auto' }}>✕</button>
        </div>

        <div className="modal-body">
          <div className="doc-preview-content" style={{ whiteSpace: 'pre-wrap' }}>{doc}</div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
            <input
              id="filepub-repo-input"
              className="input"
              type="text"
              placeholder="repo destino: owner/repo o repo"
              value={repo}
              onChange={e => setRepo(e.target.value)}
              style={{ flex: '1 1 220px', fontSize: '0.85rem', padding: '8px 10px' }}
            />
            <input
              id="filepub-version-input"
              className="input"
              type="text"
              placeholder="versión release (vacío = sugerida)"
              value={version}
              onChange={e => setVersion(e.target.value)}
              style={{ flex: '1 1 180px', fontSize: '0.85rem', padding: '8px 10px' }}
            />
          </div>

          {repoMissing && (
            <div
              id="filepub-repo-missing"
              style={{
                marginTop: '12px', padding: '10px 12px', borderRadius: '8px', fontSize: '0.85rem',
                background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.4)',
              }}
            >
              ⚠️ El repositorio <strong>{repoMissing.owner}/{repoMissing.repo}</strong> no existe en tu
              cuenta. ¿Quieres que lo cree y publique ahí?
            </div>
          )}
        </div>

        {repoMissing ? (
          <div className="modal-footer">
            <button id="filepub-create-cancel-btn" className="btn btn-secondary" onClick={onCancelCreate} disabled={busy}>
              ← Cambiar destino
            </button>
            <button id="filepub-create-repo-btn" className="btn btn-success" onClick={onCreateRepoAndPublish} disabled={busy}>
              {busy ? <><span className="spinner spinner-sm" /> Creando...</> : `➕ Crear repo y publicar`}
            </button>
          </div>
        ) : (
          <div className="modal-footer">
            <button id="filepub-cancel-btn" className="btn btn-danger" onClick={onCancel} disabled={busy}>❌ Cancelar</button>
            <button id="filepub-commit-btn" className="btn btn-secondary" onClick={() => onCommit(repo.trim())} disabled={busy || !repoOk}>
              📥 Commit directo
            </button>
            <button id="filepub-draftpr-btn" className="btn btn-secondary" onClick={() => onDraftPr(repo.trim())} disabled={busy || !repoOk}>
              🔀 Draft PR
            </button>
            <button id="filepub-release-btn" className="btn btn-success" onClick={() => onRelease(repo.trim(), version.trim())} disabled={busy || !repoOk}>
              {busy ? <><span className="spinner spinner-sm" /> Publicando...</> : '🏷️ Crear Release'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
