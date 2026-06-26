import { useState } from 'react';

// ── Props ──────────────────────────────────────────────────────────────────────
interface FilePublishModalProps {
  fileName: string;
  /** Documentación (Markdown) generada a partir del archivo adjunto. */
  doc: string;
  busy: boolean;
  /** Repo destino precargado (p. ej. al pedir "publícalo en X" por lenguaje natural). */
  initialRepo?: string;
  /** Nombre del archivo fuente adjunto: si está, se ofrece subirlo junto a la doc (#28 4a). */
  sourceFileName?: string;
  /** Si está, el repo destino no existe: se ofrece crearlo y publicar (#28 fix). */
  repoMissing?: { owner: string; repo: string } | null;
  onCommit: (repo: string, uploadSource: boolean, extras: File[]) => void;
  onDraftPr: (repo: string, uploadSource: boolean, extras: File[]) => void;
  onRelease: (repo: string, version: string, uploadSource: boolean, extras: File[]) => void;
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
  initialRepo,
  sourceFileName,
  repoMissing,
  onCommit,
  onDraftPr,
  onRelease,
  onCreateRepoAndPublish,
  onCancelCreate,
  onCancel,
}: FilePublishModalProps) {
  const [repo, setRepo] = useState(initialRepo ?? '');
  const [version, setVersion] = useState('');
  const [uploadSource, setUploadSource] = useState(true);
  const [extras, setExtras] = useState<File[]>([]);
  const repoOk = repo.trim().length > 0;

  // Destino sugerido de un extra (imágenes→screenshots/, datos→data/, resto→raíz).
  const destFor = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'screenshots/';
    if (['xlsx', 'xls', 'csv', 'json', 'parquet'].includes(ext)) return 'data/';
    return 'raíz';
  };

  const addExtras = (files: FileList | null) => {
    if (files) setExtras(prev => [...prev, ...Array.from(files)]);
  };

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

          {sourceFileName && (
            <label id="filepub-upload-source" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={uploadSource}
                onChange={e => setUploadSource(e.target.checked)}
                disabled={busy}
              />
              📎 Subir también el archivo original (<strong>{sourceFileName}</strong>) al repositorio
            </label>
          )}

          {/* #28 Fase 4b — extras para subir (imágenes→screenshots/, datos→data/, resto→raíz) */}
          <div style={{ marginTop: '10px', fontSize: '0.85rem' }}>
            <label id="filepub-add-extras" className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-block', padding: '6px 10px' }}>
              ➕ Añadir archivos para subir (imágenes, datos…)
              <input type="file" multiple style={{ display: 'none' }} disabled={busy} onChange={e => { addExtras(e.target.files); e.target.value = ''; }} />
            </label>
            {extras.length > 0 && (
              <ul id="filepub-extras-list" style={{ margin: '8px 0 0', paddingLeft: '18px' }}>
                {extras.map((f, i) => (
                  <li key={`${f.name}-${i}`}>
                    <strong>{f.name}</strong> → <code>{destFor(f.name)}</code>
                    <button type="button" className="repo-context-clear" disabled={busy} onClick={() => setExtras(prev => prev.filter((_, j) => j !== i))} aria-label={`Quitar ${f.name}`} style={{ marginLeft: '6px' }}>✕</button>
                  </li>
                ))}
              </ul>
            )}
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
            <button id="filepub-commit-btn" className="btn btn-secondary" onClick={() => onCommit(repo.trim(), uploadSource, extras)} disabled={busy || !repoOk}>
              📥 Commit directo
            </button>
            <button id="filepub-draftpr-btn" className="btn btn-secondary" onClick={() => onDraftPr(repo.trim(), uploadSource, extras)} disabled={busy || !repoOk}>
              🔀 Draft PR
            </button>
            <button id="filepub-release-btn" className="btn btn-success" onClick={() => onRelease(repo.trim(), version.trim(), uploadSource, extras)} disabled={busy || !repoOk}>
              {busy ? <><span className="spinner spinner-sm" /> Publicando...</> : '🏷️ Crear Release'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
