import { useLanguage } from '../../context/LanguageContext';

// ── PublishActions ──────────────────────────────────────────────────────────────
// Barra de acciones de publicación COMPARTIDA por los dos flujos de documentación
// (v3.10.0): "Documentar repo" (DocModal) y "📤 Documentar y publicar archivo"
// (FilePublishModal). Antes cada modal duplicaba estos botones y fueron divergiendo
// ronda a ronda; unificarlos garantiza las mismas capacidades, etiquetas y estados
// (commit / Draft PR / Release + versión) en ambos sitios.
//
// Es un componente puramente presentacional: el estado (versión, repo, extras…) y
// la lógica de escritura siguen en cada modal/orquestador. Mantiene la garantía
// propón→confirma→ejecuta (el modal que lo contiene es la confirmación).

interface RepoMissing {
  owner: string;
  repo: string;
}

interface PublishActionsProps {
  /** Versión del Release (vacío = se sugiere automáticamente). */
  version: string;
  onVersionChange: (value: string) => void;
  onCommit: () => void;
  onDraftPr: () => void;
  onRelease: () => void;
  onCancel: () => void;
  /** Deshabilita todo mientras hay una operación en curso. */
  busy: boolean;
  /** Spinners por acción (opcionales: cada flujo activa el que esté ejecutando). */
  isCommitting?: boolean;
  isCreatingDraftPr?: boolean;
  isCreatingRelease?: boolean;
  /** Deshabilita SOLO las 3 acciones de publicar (p. ej. si aún falta el repo destino). */
  publishDisabled?: boolean;
  /** Si está, el repo destino no existe: se ofrece crearlo y publicar en vez de publicar. */
  repoMissing?: RepoMissing | null;
  onCreateRepoAndPublish?: () => void;
  onCancelCreate?: () => void;
}

export default function PublishActions({
  version,
  onVersionChange,
  onCommit,
  onDraftPr,
  onRelease,
  onCancel,
  busy,
  isCommitting,
  isCreatingDraftPr,
  isCreatingRelease,
  publishDisabled,
  repoMissing,
  onCreateRepoAndPublish,
  onCancelCreate,
}: PublishActionsProps) {
  const { t } = useLanguage();

  // Oferta de crear un repo inexistente (solo el flujo de archivo la usa).
  if (repoMissing) {
    return (
      <div className="modal-footer">
        <button id="publish-create-cancel-btn" className="btn btn-secondary" onClick={onCancelCreate} disabled={busy}>
          {t('modal.publish.changeTarget')}
        </button>
        <button id="publish-create-repo-btn" className="btn btn-success" onClick={onCreateRepoAndPublish} disabled={busy}>
          {busy ? <><span className="spinner spinner-sm" /> {t('modal.publish.creating')}...</> : t('modal.publish.createAndPublish')}
        </button>
      </div>
    );
  }

  const pubDisabled = busy || !!publishDisabled;

  return (
    <div className="modal-footer" style={{ flexWrap: 'wrap', gap: '8px' }}>
      <input
        id="publish-version-input"
        className="input"
        type="text"
        placeholder={t('modal.publish.versionPlaceholder')}
        value={version}
        onChange={e => onVersionChange(e.target.value)}
        disabled={busy}
        style={{ flex: '1 1 160px', fontSize: '0.85rem', padding: '8px 10px' }}
      />
      <button id="publish-cancel-btn" className="btn btn-danger" onClick={onCancel} disabled={busy}>
        {t('modal.publish.cancel')}
      </button>
      <button id="publish-draftpr-btn" className="btn btn-secondary" onClick={onDraftPr} disabled={pubDisabled}>
        {isCreatingDraftPr ? <><span className="spinner spinner-sm" /> {t('modal.publish.draftPrCreating')}...</> : t('modal.publish.draftPr')}
      </button>
      <button id="publish-release-btn" className="btn btn-secondary" onClick={onRelease} disabled={pubDisabled}>
        {isCreatingRelease ? <><span className="spinner spinner-sm" /> {t('modal.publish.releaseCreating')}...</> : t('modal.publish.release')}
      </button>
      <button id="publish-commit-btn" className="btn btn-success" onClick={onCommit} disabled={pubDisabled}>
        {isCommitting ? <><span className="spinner spinner-sm" /> {t('modal.publish.commitCreating')}...</> : t('modal.publish.commit')}
      </button>
    </div>
  );
}