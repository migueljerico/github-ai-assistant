import { useState, useEffect } from 'react';
import type { RepoAnalysis } from '../../types';
import type { PublishTarget, PublishKind, StartPublishResult, FileContext } from '../../services/assistantActions';
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
  /** #57 Tanda B fix: archivos adjuntos completos (multi-archivo). Cuando se
   *  proporciona, el modal muestra el primary (índice 0) como "a documentar" y
   *  el resto como "extras a subir" en los pasos 2 y 4. */
  allAttachedFiles?: FileContext[];
  /** #57 Tanda B: repo inicial opcional (botón "Actualizar documentación").
   *  Si se pasa, abre el stepper en el paso 2 (rama repo) con el campo pre-rellenado. */
  initialRepo?: string;

  /** Genera la documentación de un repositorio entero. Devuelve el análisis,
   *  `null` si falló, o `'repo-missing'` si el repo no existe y es del usuario
   *  (→ se ofrece crearlo + adjuntar archivos + documentar). */
  onGenerateRepo: (repoInput: string) => Promise<RepoAnalysis | null | 'repo-missing'>;
  /** Crea un repo inexistente, sube (opcionalmente) archivos y lo documenta. */
  onCreateRepoAndGenerate: (repoInput: string, files?: File[]) => Promise<RepoAnalysis | null>;
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

 // #58 Fase 2: scope "documento específico del repo"
 /** Genera documentación para un path concreto del repo.
  * #58 Fase 3: `extraInstructions` se incluye como contexto adicional para el generador. */
 onGenerateSpecific: (repoInput: string, targetPath: string, extraInstructions?: string) => Promise<string | null>;
 /** Publica (commit) un documento específico del repo. */
 onCommitSpecific: (doc: string, path: string) => Promise<void>;
 /** Crea Draft PR con un documento específico del repo. */
 onDraftPrSpecific: (doc: string, path: string) => Promise<void>;
 /** Crea Release con un documento específico del repo. */
 onReleaseSpecific: (doc: string, path: string) => Promise<void>;
 /** Árbol de archivos del repo para el selector de path (opcional, viene de RepoAnalysis.fileTree). */
 repoFileTree?: { path: string }[];
 
 // #58 Fase 3: selectividad — instrucciones adicionales para el generador (controlled)
 extraInstructions?: string;
 onExtraInstructionsChange?: (value: string) => void;
 
 onCancel: () => void;
}

type Step = 1 | 2 | 3 | 4;
type Scope = 'repo' | 'file' | 'specific';

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
  initialRepo,
  allAttachedFiles,
  onGenerateRepo,
  onCreateRepoAndGenerate,
  onGenerateFile,
  onCommitRepo,
  onDraftPrRepo,
  onReleaseRepo,
  onPublishFile,
  onCreateRepoAndPublish,
  // #58 Fase 2: callbacks para "documento específico del repo"
  onGenerateSpecific,
  onCommitSpecific,
  onDraftPrSpecific,
  onReleaseSpecific,
  repoFileTree,
  // #58 Fase 3: selectividad — instrucciones adicionales
  extraInstructions,
  onExtraInstructionsChange,
  onCancel,
}: DocumentFlowModalProps) {
  const { t } = useLanguage();
  const modalRef = useModalDialog<HTMLDivElement>(onCancel);

  // #57 Tanda B: si llega `initialRepo` (botón "Actualizar documentación"), abre
  // directo en el paso 2 (rama repo) con el campo pre-rellenado.
  // Defensa (regresión v3.30): sanea a string. Si un caller pasa React.MouseEvent
  // u otro valor truthy no-string (p. ej. DocumentRepoButton con onClick={onOpen}
  // sin envolver), `repoInput.trim()` en el render lanzaría "is not a function".
  const safeInitialRepo = typeof initialRepo === 'string' ? initialRepo : '';
  const [step, setStep] = useState<Step>(safeInitialRepo ? 2 : 1);
  const [scope, setScope] = useState<Scope | null>(safeInitialRepo ? 'repo' : null);

  // Paso 2 (repo)
  const [repoInput, setRepoInput] = useState(safeInitialRepo);
  const [analysis, setAnalysis] = useState<RepoAnalysis | null>(null);

// Paso 2 (archivo)
const [fileDoc, setFileDoc] = useState<string | null>(null);

// Paso 2 (instrucciones adicionales de selectividad — Fase 3)
// #58 Fase 3: componente controlado; se delega en `onExtraInstructionsChange` del caller.

// #58 Fase 2: scope "documento específico del repo"
const [specificRepoInput, setSpecificRepoInput] = useState('');
const [specificPath, setSpecificPath] = useState('');
const [specificDoc, setSpecificDoc] = useState<string | null>(null);
const [specificMissing, setSpecificMissing] = useState<{ owner: string; repo: string } | null>(null);

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

  // #57 Tanda B: archivos para poblar el repo recién creado (scope repo, rama crear).
  const [createExtras, setCreateExtras] = useState<File[]>([]);

  // #57 Tanda B fix: al entrar en Paso 4 (publicación, scope archivo), auto-poblar
  // los extras con los archivos no-principales del contexto multi-archivo.
  useEffect(() => {
    if (step === 4 && scope === 'file' && allAttachedFiles && allAttachedFiles.length > 1) {
      const nonPrimary = allAttachedFiles.slice(1).map(f => f.file).filter((f): f is File => !!f);
      setExtras(nonPrimary);
    }
  }, [step, scope, allAttachedFiles]);

  // ── Paso 2: generación ─────────────────────────────────────────────────────────
  const handleGenerateRepo = async () => {
    if (!repoInput.trim()) return;
    setBusy(true);
    try {
      const a = await onGenerateRepo(repoInput.trim());
      if (a === 'repo-missing') {
        // El repo no existe y es del usuario → ofrecer crearlo + adjuntar archivos.
        const ref = resolveRepoRef(repoInput.trim(), currentUserLogin);
        setRepoMissing({ owner: ref.owner, repo: ref.repo });
      } else if (a) {
        setAnalysis(a);
        setDestRepo(a.repoName); // el destino fijo es el repo analizado
        setStep(3);
      }
    } finally {
      setBusy(false);
    }
  };

  // #57 Tanda B fix: crear el repo inexistente, subir archivos adjuntos y documentarlo.
  const doCreateRepoAndGenerate = async () => {
    if (!repoInput.trim() || !repoMissing) return;
    setBusy(true);
    try {
      // Merge manual createExtras with remaining multi-archivo files (non-primary).
      const remainingFromContext = allAttachedFiles && allAttachedFiles.length > 1
        ? allAttachedFiles.slice(1).map(f => f.file).filter((f): f is File => !!f)
        : [];
      const merged = [...createExtras, ...remainingFromContext];
      const a = await onCreateRepoAndGenerate(
        repoInput.trim(),
        merged.length > 0 ? merged : undefined,
      );
      if (a) {
        setRepoMissing(null);
        setCreateExtras([]);
        setAnalysis(a);
        setDestRepo(a.repoName);
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

// #58 Fase 2: generar documentación para un path concreto del repo
const handleGenerateSpecific = async () => {
 if (!specificRepoInput.trim() || !specificPath.trim()) return;
 setBusy(true);
 try {
 const doc = await onGenerateSpecific(specificRepoInput.trim(), specificPath.trim(), extraInstructions);
 if (doc === 'repo-missing') {
 const ref = resolveRepoRef(specificRepoInput.trim(), currentUserLogin);
 setSpecificMissing({ owner: ref.owner, repo: ref.repo });
 } else if (doc != null) {
 setSpecificDoc(doc);
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

// #58 Fase 2: handlers de publicación para "documento específico del repo"
const doCommitSpecific = async () => {
  if (!specificDoc || !specificRepoInput.trim()) return;
  setPending('commit'); setBusy(true);
  try {
    await onCommitSpecific(specificDoc, specificPath.trim());
  } finally { setBusy(false); setPending(null); onCancel(); }
};
const doDraftPrSpecific = async () => {
  if (!specificDoc || !specificRepoInput.trim()) return;
  setPending('draftpr'); setBusy(true);
  try { await onDraftPrSpecific(specificDoc, specificPath.trim()); }
  finally { setBusy(false); setPending(null); onCancel(); }
};
const doReleaseSpecific = async () => {
  if (!specificDoc || !specificRepoInput.trim()) return;
  setPending('release'); setBusy(true);
  try { await onReleaseSpecific(specificDoc, specificPath.trim()); }
  finally { setBusy(false); setPending(null); onCancel(); }
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
const isSpecific = scope === 'specific';

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
{/* #58 Fase 2: botón "Documento específico del repo" */}
<button
  id="flow-scope-specific"
  type="button"
  className="btn btn-secondary"
  style={{ textAlign: 'left', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}
  onClick={() => { setScope('specific'); setStep(2); }}
>
  <strong>{t('modal.flow.scopeSpecific')}</strong>
  <small style={{ opacity: 0.8, fontWeight: 400 }}>{t('modal.flow.scopeSpecificDesc')}</small>
</button>
              </div>
            </>
          )}

          {/* ── Paso 2: generar ── */}
{step === 2 && isFile && (
  <>
    <p>{t('modal.flow.stepScope')}</p>
    <div style={{ marginTop: '8px' }}>
      {allAttachedFiles && allAttachedFiles.length > 1 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
          {allAttachedFiles.map((fc, i) => (
            <div key={`${fc.name}-${i}`} style={{
              padding: '8px 10px', borderRadius: '6px', fontSize: '0.85rem',
              background: i === 0 ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.1)',
              border: `1px solid ${i === 0 ? 'rgba(34,197,94,0.3)' : 'rgba(148,163,184,0.2)'}`,
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <span>{i === 0 ? '📝' : '📎'}</span>
              <strong>{fc.name}</strong>
              <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>
                {i === 0 ? '(se documentará)' : '(se subirá al repo)'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontWeight: 600, marginBottom: '10px' }}>📎 {attachedFileName}</div>
      )}
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
{/* #58 Fase 2: formulario para "documento específico del repo" */}
{step === 2 && isSpecific && (
  <>
    <p>{t('modal.flow.scopeSpecific')}</p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
      <input
        id="flow-specific-repo-input"
        autoFocus
        type="text"
        className="input"
        placeholder={t('chat.repoInputPlaceholder')}
        value={specificRepoInput}
        onChange={e => setSpecificRepoInput(e.target.value)}
        style={{ fontSize: '0.85rem', padding: '8px 10px' }}
      />
      <input
        id="flow-specific-path-input"
        type="text"
        className="input"
        placeholder={t('modal.flow.specificPathPlaceholder')}
        value={specificPath}
        onChange={e => setSpecificPath(e.target.value)}
        style={{ fontSize: '0.85rem', padding: '8px 10px' }}
      />
      {repoFileTree && repoFileTree.length > 0 && (
        <select
          id="flow-specific-path-select"
          className="input"
          value={specificPath}
          onChange={e => setSpecificPath(e.target.value)}
          style={{ fontSize: '0.85rem', padding: '8px 10px' }}
        >
          <option value="">— {t('modal.flow.specificPathSelectPlaceholder')} —</option>
          {repoFileTree.map(ft => (
            <option key={ft.path} value={ft.path}>{ft.path}</option>
          ))}
        </select>
      )}
      {/* #58 Fase 3: selectividad — instrucciones adicionales para el generador */}
      <div style={{ marginTop: '4px' }}>
        <label style={{ fontSize: '0.8rem', opacity: 0.75, display: 'block', marginBottom: '4px' }}>
          {t('modal.flow.extraInstructions')}
        </label>
        <textarea
          id="flow-extra-instructions"
          className="input"
          rows={2}
          placeholder={t('modal.flow.extraInstructionsPlaceholder')}
          value={extraInstructions}
          onChange={e => onExtraInstructionsChange?.(e.target.value)}
          disabled={busy}
          style={{ fontSize: '0.85rem', padding: '8px 10px', resize: 'vertical', minHeight: '48px' }}
        />
      </div>
      <button
        id="flow-generate-specific-btn"
        type="button"
        className="btn btn-success"
        disabled={!specificRepoInput.trim() || !specificPath.trim() || busy}
        onClick={handleGenerateSpecific}
      >
        {busy ? t('modal.flow.generating') : t('modal.flow.generateSpecific')}
      </button>
      {specificMissing && (
        <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '6px', fontSize: '0.85rem', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.4)' }}>
          {t('modal.flow.repoMissing', { repo: `${specificMissing.owner}/${specificMissing.repo}` })}
        </div>
      )}
    </div>
  </>
)}


{step === 2 && !isFile && !isSpecific && (
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

              {/* #57 Tanda B: el repo no existe y es del usuario → crear + adjuntar + documentar */}
              {repoMissing && (
                <div
                  id="flow-repo-missing-create"
                  style={{
                    marginTop: '12px', padding: '10px 12px', borderRadius: '8px', fontSize: '0.85rem',
                    background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.4)',
                  }}
                >
                  <div style={{ marginBottom: '8px' }}>
                    {t('modal.flow.repoMissing', { repo: `${repoMissing.owner}/${repoMissing.repo}` })}
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <label id="flow-create-add-extras" className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-block', padding: '6px 10px' }}>
                      {t('modal.flow.addExtrasCreate')}
                      <input
                        type="file"
                        multiple
                        style={{ display: 'none' }}
                        disabled={busy}
                        onChange={e => { const fl = e.target.files; if (fl) setCreateExtras(prev => [...prev, ...Array.from(fl)]); e.target.value = ''; }}
                      />
                    </label>
                    {createExtras.length > 0 && (
                      <ul id="flow-create-extras-list" style={{ margin: '8px 0 0', paddingLeft: '18px' }}>
                        {createExtras.map((f, i) => (
                          <li key={`create-${f.name}-${i}`}>
                            <strong>{f.name}</strong> → <code>{destFor(f.name)}</code>
                            <button
                              type="button"
                              className="repo-context-clear"
                              disabled={busy}
                              onClick={() => setCreateExtras(prev => prev.filter((_, j) => j !== i))}
                              aria-label={t('modal.filepub.removeExtra', { fileName: f.name })}
                              style={{ marginLeft: '8px' }}
                            >✕</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
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
              {analysis.alreadyDocumented && (
                <div className="info-banner" style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.4)' }}>
                  {t('modal.flow.alreadyDocumented')}
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
{/* #58 Fase 2: preview del documento específico generado */}
{step === 3 && isSpecific && specificDoc != null && (
  <div className="doc-preview-content" style={{ whiteSpace: 'pre-wrap' }}>
    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '8px' }}>
      {specificPath}
    </div>
    {specificDoc}
  </div>
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
            {repoMissing && !isFile && (
              <>
                <button
                  id="flow-cancel-create-btn"
                  className="btn btn-secondary"
                  onClick={() => setRepoMissing(null)}
                  disabled={busy}
                >
                  {t('modal.publish.changeTarget')}
                </button>
                <button
                  id="flow-create-repo-btn"
                  className="btn btn-success"
                  onClick={doCreateRepoAndGenerate}
                  disabled={busy}
                >
                  {busy ? <><span className="spinner spinner-sm" /> {t('modal.publish.creating')}...</> : t('modal.flow.createAndDocument')}
                </button>
              </>
            )}
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

{/* #58 Fase 2: Paso 4 para scope "specific" reutiliza PublishActions */}
{step === 4 && scope === 'specific' && (
  <PublishActions
    version={version}
    onVersionChange={setVersion}
    onCommit={doCommitSpecific}
    onDraftPr={doDraftPrSpecific}
    onRelease={doReleaseSpecific}
    onCancel={onCancel}
    busy={busy}
    isCommitting={busy && pending === 'commit'}
    isCreatingDraftPr={busy && pending === 'draftpr'}
    isCreatingRelease={busy && pending === 'release'}
  />
)}
      </div>
    </div>
  );
}
