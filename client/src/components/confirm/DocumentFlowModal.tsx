import { useState } from 'react';
import type { RepoAnalysis } from '../../types';
import type { PublishTarget, PublishKind, StartPublishResult } from '../../services/assistantActions';
import { resolveRepoRef } from '../../utils/repoRef';
import PublishActions from './PublishActions';
import { useModalDialog } from '../../hooks/useModalDialog';
import { useLanguage } from '../../context/LanguageContext';

// ── Props ────────────────────────────────────────────────────────────────────────
interface DocumentFlowModalProps {
  /** Hay un archivo adjunto disponible para la opción "Archivo adjunto". */
  hasAttachedFile: boolean;
  /** Nombre del archivo adjunto (para la revisión y subir el original). */
  attachedFileName?: string;
  /** File original adjunto, para subirlo junto a la doc del archivo. */
  attachedFile?: File;
  /** Login del usuario (dueño por defecto al resolver el repo destino). */
  currentUserLogin: string;

  /** Genera la documentación de un repositorio entero. Devuelve el análisis o null. */
  onGenerateRepo: (repoInput: string) => Promise<RepoAnalysis | null>;
  /** Genera la documentación del archivo adjunto. Devuelve el Markdown o null. */
  onGenerateFile: () => Promise<string | null>;

  /** Publica la doc de repo (destino fijo = repo analizado). */
  onCommitRepo: (analysis: RepoAnalysis) => Promise<void>;
  onDraftPrRepo: (analysis: RepoAnalysis) => Promise<void>;
  onReleaseRepo: (analysis: RepoAnalysis, version: string) => Promise<void>;

  /** Publica la doc del archivo en el repo destino. Devuelve el resultado. */
  onPublishFile: (target: PublishTarget) => Promise<StartPublishResult>;
  /** Crea el repo inexistente y publica la doc del archivo. Devuelve el resultado. */
  onCreateRepoAndPublish: (target: PublishTarget) => Promise<StartPublishResult>;

  onCancel: () => void;
}

type Step = 1 | 2 | 3 | 4;
type Scope = 'repo' | 'file';

// ── Componente ──────────────────────────────────────────────────────────────────
// #57: flujo único de documentación (stepper de 4 pasos) que unifica los dos
// flujos divergentes previos ("Documentar repo" → DocModal y "Documentar y publicar"
// → FilePublishModal). Reutiliza PublishActions y las funciones run* del orquestador.
// Pasos: (1) elegir alcance · (2) generar · (3) revisar · (4) destino + método.
export default function DocumentFlowModal({
  hasAttachedFile,
  attachedFileName,
  attachedFile,
  currentUserLogin,
  onGenerateRepo,
  onGenerateFile,
  onCommitRepo,
  onDraftPrRepo,
  onReleaseRepo,
  onPublishFile,
  onCreateRepoAndPublish,
  onCancel,
}: DocumentFlowModalProps) {
  const { t } = useLanguage();
  const modalRef = useModalDialog<HTMLDivElement>(onCancel);

  const [step, setStep] = useState<Step>(1);
  const [scope, setScope] = useState<Scope | null>(null);

  // Paso 2 (repo)
  const [repoInput, setRepoInput] = useState('');
  const [analysis, setAnalysis] = useState<RepoAnalysis | null>(null);

  // Paso 2 (archivo)
  const [fileDoc, setFileDoc] = useState<string | null>(null);

  // Paso 3 (revisión)
  const [activeTab, setActiveTab] = useState<'readme' | 'manual'>('readme');

  // Paso 4 (destino + método) — compartido
  const [destRepo, setDestRepo] = useState('');
  const [version, setVersion] = useState('');
  const [uploadSource, setUploadSource] = useState(true);
  const [extras, setExtras] = useState<File[]>([]);
  const [pending, setPending] = useState<'commit' | 'draftpr' | 'release' | null>(null);
  const [pendingKind, setPendingKind] = useState<PublishKind>('commit');
  const [busy, setBusy] = useState(false);
  const [repoMissing, setRepoMissing] = useState<{ owner: string; repo: string } | null>(null);

  // ── Paso 2: generación ─────────────────────────────────────────────────────────
  const handleGenerateRepo = async () => {
    if (!repoInput.trim()) return;
    setBusy(true);
    try {
      const a = await onGenerateRepo(repoInput.trim());
      if (a) {
        setAnalysis(a);
        setDestRepo(a.repoName); // el destino fijo es el repo analizado
        setStep(3);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateFile = async () => {
    setBusy(true);
    try {
      const d = await onGenerateFile();
      if (d != null) {
        setFileDoc(d);
        setStep(3);
      }
    } finally {
      setBusy(false);
    }
  };

  // ── Paso 4 (repo): publicación con destino fijo ─────────────────────────────────
  const doCommitRepo = async () => {
    if (!analysis) return;
    setPending('commit'); setBusy(true);
    try { await onCommitRepo(analysis); } finally { setBusy(false); setPending(null); onCancel(); }
  };
  const doDraftPrRepo = async () => {
    if (!analysis) return;
    setPending('draftpr'); setBusy(true);
    try { await onDraftPrRepo(analysis); } finally { setBusy(false); setPending(null); onCancel(); }
  };
  const doReleaseRepo = async () => {
    if (!analysis) return;
    setPending('release'); setBusy(true);
    try { await onReleaseRepo(analysis, version.trim()); } finally { setBusy(false); setPending(null); onCancel(); }
  };

  // ── Paso 4 (archivo): publicación con destino elegido ───────────────────────────
  const buildTarget = (ref: ReturnType<typeof resolveRepoRef>, kind: PublishKind): PublishTarget => ({
    owner: ref.owner,
    repo: ref.repo,
    fileName: attachedFileName || t('modal.confirm.defaultFile'),
    doc: fileDoc || '',
    kind,
    version: version.trim() || undefined,
    sourceFile: uploadSource && attachedFile ? attachedFile : undefined,
    extraFiles: extras,
  });

  const startFilePublish = async (kind: PublishKind) => {
    if (!fileDoc || !destRepo.trim()) return;
    setPendingKind(kind);
    setPending(kind);
    setBusy(true);
    try {
      const ref = resolveRepoRef(destRepo.trim(), currentUserLogin);
      const res = await onPublishFile(buildTarget(ref, kind));
      if (res === 'repo-missing') setRepoMissing({ owner: ref.owner, repo: ref.repo });
      else if (res === 'published') onCancel();
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const doCreateRepoAndPublishFile = async () => {
    if (!repoMissing) return;
    const ref = resolveRepoRef(`${repoMissing.owner}/${repoMissing.repo}`, currentUserLogin);
    setBusy(true);
    try {
      const res = await onCreateRepoAndPublish(buildTarget(ref, pendingKind));
      if (res === 'published') onCancel();
    } finally {
      setBusy(false);
    }
  };

  // ── Helpers de extras (reutilizados del flujo de archivo) ───────────────────────
  const destFor = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'screenshots/';
    if (['xlsx', 'xls', 'csv', 'json', 'parquet'].includes(ext)) return 'data/';
    return t('modal.filepub.rootDest');
  };

  const addExtras = (files: FileList | null) => {
    if (files) setExtras(prev => [...prev, ...Array.from(files)]);
  };

  const isFile = scope === 'file';

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="flow-modal-title">
      <div className="modal doc-repo-modal" ref={modalRef}>
        <div className="modal-header">
          <span className="modal-icon">📄</span>
          <div>
            <div className="modal-title" id="flow-modal-title">{t('modal.flow.title')}</div>
            <div className="modal-subtitle" id="flow-step-indicator">
              {t('modal.flow.step', { current: step, total: 4 })}
            </div>
          </div>
          <button id="flow-close-btn" className="btn btn-ghost btn-icon" onClick={onCancel} style={{ marginLeft: 'auto' }}>✕</button>
        </div>

        <div className="modal-body">
          {/* ── Paso 1: elegir alcance ── */}
          {step === 1 && (
            <>
              <p>{t('modal.flow.stepScope')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                <button
                  id="flow-scope-repo"
                  type="button"
                  className="btn btn-secondary"
                  style={{ textAlign: 'left', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}
                  onClick={() => { setScope('repo'); setStep(2); }}
                >
                  <strong>{t('modal.flow.scopeRepo')}</strong>
                  <small style={{ opacity: 0.8, fontWeight: 400 }}>{t('modal.flow.scopeRepoDesc')}</small>
                </button>
                <button
                  id="flow-scope-file"
                  type="button"
                  className="btn btn-secondary"
                  style={{ textAlign: 'left', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}
                  disabled={!hasAttachedFile}
                  onClick={() => { if (hasAttachedFile) { setScope('file'); setStep(2); } }}
                >
                  <strong>{t('modal.flow.scopeFile')}</strong>
                  <small style={{ opacity: 0.8, fontWeight: 400 }}>{t('modal.flow.scopeFileDesc')}</small>
                  {!hasAttachedFile && (
                    <small style={{ opacity: 0.7, fontStyle: 'italic' }}>{t('modal.flow.scopeFileDisabled')}</small>
                  )}
                </button>
              </div>
            </>
          )}

          {/* ── Paso 2: generar ── */}
          {step === 2 && isFile && (
            <>
              <p>{t('modal.flow.stepScope')}</p>
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontWeight: 600, marginBottom: '10px' }}>📎 {attachedFileName}</div>
                <button
                  id="flow-generate-btn"
                  type="button"
                  className="btn btn-success"
                  disabled={busy}
                  onClick={handleGenerateFile}
                >
                  {busy ? t('modal.flow.generating') : t('modal.flow.generate')}
                </button>
              </div>
            </>
          )}
          {step === 2 && !isFile && (
            <>
              <p>{t('modal.flow.scopeRepo')}</p>
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <input
                  id="flow-repo-input"
                  autoFocus
                  type="text"
                  className="input"
                  placeholder={t('chat.repoInputPlaceholder')}
                  value={repoInput}
                  onChange={e => setRepoInput(e.target.value)}
                  style={{ flex: '1 1 220px', fontSize: '0.85rem', padding: '8px 10px' }}
                />
                <button
                  id="flow-generate-btn"
                  type="button"
                  className="btn btn-success"
                  disabled={!repoInput.trim() || busy}
                  onClick={handleGenerateRepo}
                >
                  {busy ? t('modal.flow.generating') : t('modal.flow.generate')}
                </button>
              </div>
            </>
          )}

          {/* ── Paso 3: revisar ── */}
          {step === 3 && !isFile && analysis && (
            <>
              {analysis.truncated && (
                <div className="warning-banner">
                  {t('modal.doc.truncatedWarning', { filesAnalyzed: analysis.filesAnalyzed })}
                </div>
              )}
              <div className="doc-preview-tabs">
                <button id="flow-tab-readme" className={`doc-preview-tab ${activeTab === 'readme' ? 'active' : ''}`} onClick={() => setActiveTab('readme')}>
                  {t('modal.doc.readme')}
                </button>
                <button id="flow-tab-manual" className={`doc-preview-tab ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => setActiveTab('manual')}>
                  {t('modal.doc.manual')}
                </button>
              </div>
              <div className="doc-preview-content">
                {activeTab === 'readme' ? analysis.readme : analysis.manualTecnico}
              </div>
            </>
          )}
          {step === 3 && isFile && fileDoc != null && (
            <div className="doc-preview-content" style={{ whiteSpace: 'pre-wrap' }}>{fileDoc}</div>
          )}

          {/* ── Paso 4: destino + método ── */}
          {step === 4 && !isFile && analysis && (
            <div style={{ fontSize: '0.9rem' }}>
              <div style={{ opacity: 0.8, marginBottom: '4px' }}>{t('modal.flow.destination')}</div>
              <code style={{ display: 'inline-block', padding: '6px 10px', background: 'var(--surface, rgba(255,255,255,0.06))', borderRadius: '8px' }}>
                {analysis.repoName}
              </code>
            </div>
          )}
          {step === 4 && isFile && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                <input
                  id="flow-dest-input"
                  className="input"
                  type="text"
                  placeholder={t('modal.flow.destinationPlaceholder')}
                  value={destRepo}
                  onChange={e => setDestRepo(e.target.value)}
                  style={{ flex: '1 1 220px', fontSize: '0.85rem', padding: '8px 10px' }}
                />
              </div>

              {attachedFile && (
                <label id="flow-upload-source" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={uploadSource}
                    onChange={e => setUploadSource(e.target.checked)}
                    disabled={busy}
                  />
                  {t('modal.filepub.uploadSource', { fileName: attachedFileName || '' })}
                </label>
              )}

              <div style={{ marginTop: '10px', fontSize: '0.85rem' }}>
                <label id="flow-add-extras" className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-block', padding: '6px 10px' }}>
                  {t('modal.filepub.addExtras')}
                  <input type="file" multiple style={{ display: 'none' }} disabled={busy} onChange={e => { addExtras(e.target.files); e.target.value = ''; }} />
                </label>
                {extras.length > 0 && (
                  <ul id="flow-extras-list" style={{ margin: '8px 0 0', paddingLeft: '18px' }}>
                    {extras.map((f, i) => (
                      <li key={`${f.name}-${i}`}>
                        <strong>{f.name}</strong> → <code>{destFor(f.name)}</code>
                        <button type="button" className="repo-context-clear" disabled={busy} onClick={() => setExtras(prev => prev.filter((_, j) => j !== i))} aria-label={t('modal.filepub.removeExtra', { fileName: f.name })} style={{ marginLeft: '8px' }}>✕</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {repoMissing && (
                <div
                  id="flow-repo-missing"
                  style={{
                    marginTop: '12px', padding: '10px 12px', borderRadius: '8px', fontSize: '0.85rem',
                    background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.4)',
                  }}
                >
                  {t('modal.filepub.repoMissing', { owner: repoMissing.owner, repo: repoMissing.repo })}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footers por paso ── */}
        {step === 1 && (
          <div className="modal-footer">
            <button id="flow-cancel-btn" className="btn btn-danger" onClick={onCancel}>{t('modal.publish.cancel')}</button>
          </div>
        )}

        {step === 2 && (
          <div className="modal-footer">
            <button id="flow-cancel-btn" className="btn btn-danger" onClick={onCancel}>{t('modal.publish.cancel')}</button>
            <button id="flow-back-btn" className="btn btn-secondary" onClick={() => setStep(1)}>{t('modal.flow.back')}</button>
          </div>
        )}

        {step === 3 && (
          <div className="modal-footer">
            <button id="flow-cancel-btn" className="btn btn-danger" onClick={onCancel}>{t('modal.publish.cancel')}</button>
            <button id="flow-back-btn" className="btn btn-secondary" onClick={() => setStep(2)}>{t('modal.flow.back')}</button>
            <button id="flow-continue-btn" className="btn btn-success" onClick={() => setStep(4)}>{t('modal.flow.continue')}</button>
          </div>
        )}

        {step === 4 && !isFile && analysis && (
          <PublishActions
            version={version}
            onVersionChange={setVersion}
            onCommit={doCommitRepo}
            onDraftPr={doDraftPrRepo}
            onRelease={doReleaseRepo}
            onCancel={onCancel}
            busy={busy}
            isCommitting={busy && pending === 'commit'}
            isCreatingDraftPr={busy && pending === 'draftpr'}
            isCreatingRelease={busy && pending === 'release'}
          />
        )}

        {step === 4 && isFile && (
          <PublishActions
            version={version}
            onVersionChange={setVersion}
            onCommit={() => startFilePublish('commit')}
            onDraftPr={() => startFilePublish('draftpr')}
            onRelease={() => startFilePublish('release')}
            onCancel={onCancel}
            busy={busy}
            isCommitting={busy && pending === 'commit'}
            isCreatingDraftPr={busy && pending === 'draftpr'}
            isCreatingRelease={busy && pending === 'release'}
            publishDisabled={!destRepo.trim()}
            repoMissing={repoMissing}
            onCreateRepoAndPublish={doCreateRepoAndPublishFile}
            onCancelCreate={() => setRepoMissing(null)}
          />
        )}
      </div>
    </div>
  );
}
