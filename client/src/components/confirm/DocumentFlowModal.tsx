import { useState, useEffect } from 'react';
// #58 Fase 6: hook de persistencia avanzada del selector de documento específico
import { useDocTargetSelector } from '../../hooks/useDocTargetSelector';
import type { RepoAnalysis } from '../../types';
import type { PublishTarget, PublishKind, StartPublishResult, FileContext, GenerateSpecificResult } from '../../services/assistantActions';
import type { DocTarget } from '../../services/docPublisher';
import { docPathFor } from '../../services/assistantActions';
import { resolveRepoRef } from '../../utils/repoRef';
import PublishActions from './PublishActions';
import DiffViewer from './DiffViewer';
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
  /** #58 (b): trae el contenido actual de `docs/{base}.md` en el repo destino,
   *  para mostrar el diff old↔new en el paso 4 del scope file. `null` = alta nueva. */
  onFetchExistingDoc?: (owner: string, repo: string, fileName: string) => Promise<string | null>;

 // #58 Fase 2: scope "documento específico del repo"
 /** Genera documentación para un path concreto del repo.
  * #58 Fase 3: `extraInstructions` se incluye como contexto adicional para el generador.
  * #58 (b): devuelve `{doc, currentContent}` para que el modal pueda mostrar el
  * diff old↔new; `currentContent` es `undefined` cuando el documento es nuevo. */
 onGenerateSpecific: (repoInput: string, targetPath: string, extraInstructions?: string) => Promise<GenerateSpecificResult | null>;
 /** Publica (commit) un documento específico del repo.
  * v3.66.0: se propaga `repoInput` para que el destino sea el repo tecleado por
  * el usuario en el paso 2 (specificRepoInput), no el login hardcodeado. */
 onCommitSpecific: (doc: string, path: string, repoInput?: string) => Promise<void>;
 /** Crea Draft PR con un documento específico del repo. */
 onDraftPrSpecific: (doc: string, path: string, repoInput?: string) => Promise<void>;
 /** Crea Release con un documento específico del repo. */
 onReleaseSpecific: (doc: string, path: string, repoInput?: string) => Promise<void>;
 /** #58 (a): bulk multi-archivo atómico (commit directo a la rama por defecto). */
 onCommitBulk?: (owner: string, repo: string, targets: DocTarget[]) => Promise<void>;
 /** #58 (a): bulk multi-archivo atómico como Draft PR (rama nueva docs/bulk-{ts}). */
 onDraftPrBulk?: (owner: string, repo: string, targets: DocTarget[]) => Promise<void>;
 /** Árbol de archivos del repo para el selector de path (opcional, viene de RepoAnalysis.fileTree). */
 repoFileTree?: { path: string }[];
 
 // #58 Fase 3: selectividad — instrucciones adicionales para el generador (controlled)
 extraInstructions?: string;
 onExtraInstructionsChange?: (value: string) => void;
 /** Valida si un repositorio existe antes de generar documentación (#XX).
  *  Devuelve `true` si el repo existe, `false` si no. */
 onCheckRepoExists?: (repoInput: string) => Promise<boolean>;

 onCancel: () => void;
}

type Step = 1 | 2 | 3 | 4;
type Scope = 'repo' | 'file' | 'specific' | 'bulk';

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
  // #58 (b): fetch del contenido actual de docs/{base}.md en el repo destino.
  onFetchExistingDoc,
  // #58 Fase 2: callbacks para "documento específico del repo"
  onGenerateSpecific,
  onCommitSpecific,
  onDraftPrSpecific,
  onReleaseSpecific,
  // #58 (a): callbacks para bulk multi-archivo atómico
  onCommitBulk,
  onDraftPrBulk,
  repoFileTree,
  // #58 Fase 3: selectividad — instrucciones adicionales
  extraInstructions,
  onExtraInstructionsChange,
  onCheckRepoExists,
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
// #58 (b): contenido actual del documento en el repo (para diff). `undefined`
// cuando es un alta nueva; `string` cuando ya existía y se va a actualizar.
const [specificExistingContent, setSpecificExistingContent] = useState<string | undefined>(undefined);
// #XX: error de validación del repo en scope specific (nombre incorrecto o sin acceso)
const [specificRepoError, setSpecificRepoError] = useState<string | null>(null);
// #58 (a): estado del scope bulk
const [bulkRepoInput, setBulkRepoInput] = useState('');
// Paths del repoFileTree seleccionados para generar doc vía IA (multi-select).
const [bulkPaths, setBulkPaths] = useState<string[]>([]);
// Targets ya resueltos (path+content+origen) listos para el commit atómico.
const [bulkTargets, setBulkTargets] = useState<Array<{ path: string; content: string; origin: 'ai' | 'attached' }>>([]);
// Progreso de generación IA (para el botón "Generando done/total").
const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
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

  // #58 (b): contenido actual de docs/{base}.md en el repo destino (scope file).
  // Se carga asíncronamente al entrar en paso 4 con un `destRepo` válido, para
  // mostrar el diff old↔new antes de publicar. `status` guía el render.
  const [fileExistingContent, setFileExistingContent] = useState<string | null>(null);
  const [fileExistingStatus, setFileExistingStatus] = useState<'idle' | 'loading' | 'found' | 'notfound' | 'error'>('idle');

  // #57 Tanda B: archivos para poblar el repo recién creado (scope repo, rama crear).
  const [createExtras, setCreateExtras] = useState<File[]>([]);

  // #57 Tanda B fix: al entrar en Paso 4 (publicación, scope archivo), auto-poblar
  // los extras con los archivos no-principales del contexto multi-archivo.
  // Sincronización de estado con una condición del flujo (step+scope+contexto
  // del caller): no es derivable en render porque depende del momento exacto
  // de entrada al paso 4. set-state-in-effect es intencionado aquí.
  useEffect(() => {
    if (step === 4 && scope === 'file' && allAttachedFiles && allAttachedFiles.length > 1) {
      const nonPrimary = allAttachedFiles.slice(1).map(f => f.file).filter((f): f is File => !!f);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-poblar extras al entrar al paso 4 (side-effect de flujo)
      setExtras(nonPrimary);
    }
  }, [step, scope, allAttachedFiles]);

  // #58 (b): al entrar en paso 4 (scope file) con un `destRepo` válido, dispara
  // el fetch del contenido actual de docs/{base}.md para el diff. Se re-dispara
  // si el usuario cambia el repo destino. set-state-in-effect intencionado:
  // la carga es asíncrona y depende del momento exacto de entrada al paso 4.
  useEffect(() => {
    if (step !== 4 || scope !== 'file' || !onFetchExistingDoc) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset a 'idle' fuera del paso 4/file (early-return del fetch síncrono)
      setFileExistingStatus('idle');
      setFileExistingContent(null);
      return;
    }
    const trimmed = destRepo.trim();
    const primary = allAttachedFiles?.[0]?.name ?? attachedFileName;
    if (!trimmed || !primary) {
      setFileExistingStatus('idle');
      setFileExistingContent(null);
      return;
    }
    let cancelled = false;
    setFileExistingStatus('loading');
    const ref = resolveRepoRef(trimmed, currentUserLogin);
    onFetchExistingDoc(ref.owner, ref.repo, primary)
      .then(content => {
        if (cancelled) return;
        if (content == null) {
          setFileExistingStatus('notfound');
          setFileExistingContent(null);
        } else {
          setFileExistingStatus('found');
          setFileExistingContent(content);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setFileExistingStatus('error');
        setFileExistingContent(null);
      });
    return () => { cancelled = true; };
  }, [step, scope, destRepo, allAttachedFiles, attachedFileName, onFetchExistingDoc, currentUserLogin]);

  // #58 Fase 6: hook de persistencia avanzada del selector de documento específico
  const {
    state: savedState,
    setScope: saveScope,
    setSpecificRepoInput: saveSpecificRepoInput,
    setSpecificPath: saveSpecificPath,
    setExtraInstructions: saveExtraInstructions,
    clear,
  } = useDocTargetSelector();

  // Restaurar estado guardado al montar (solo si no hay initialRepo que sobrescribe).
  // Fix #XX: si se abre con initialRepo, limpiar localStorage para evitar restaurar
  // un nombre de repo incorrecto de sesión anterior (p. ej. "mercadona-dashboard"
  // en vez de "powerbi-dashboard-mercadona").
  useEffect(() => {
    if (initialRepo) {
      clear(); // descarta estado persisted que podría tener un repo name obsoleto
      return;
    }
    if (savedState?.scope === 'specific') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- run-once: hidratar estado persistido al montar
      setScope('specific');
      setSpecificRepoInput(savedState.specificRepoInput);
      setSpecificPath(savedState.specificPath);
      if (savedState.extraInstructions && onExtraInstructionsChange) {
        onExtraInstructionsChange(savedState.extraInstructions);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- solo al montar: savedState estable, onExtraInstructionsChange controlado por padre

  // Persistir cambios de scope
  useEffect(() => {
    if (scope) saveScope(scope);
  }, [scope, saveScope]);

  // Persistir cambios en specificRepoInput
  useEffect(() => {
    if (scope === 'specific') saveSpecificRepoInput(specificRepoInput);
  }, [specificRepoInput, scope, saveSpecificRepoInput]);

  // Persistir cambios en specificPath
  useEffect(() => {
    if (scope === 'specific') saveSpecificPath(specificPath);
  }, [specificPath, scope, saveSpecificPath]);

  // Persistir cambios en extraInstructions (sincronización bidireccional con prop controlled)
  useEffect(() => {
    if (scope === 'specific' && extraInstructions !== undefined) {
      saveExtraInstructions(extraInstructions);
    }
  }, [extraInstructions, scope, saveExtraInstructions]);


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
 // #XX: validación temprana — verificar que el repo existe antes de generar doc.
 // Evita que la IA genere contenido con un nombre de repo incorrecto y que el
 // commit falle después con 404 (p. ej. "mercadona-dashboard" en vez de
 // "powerbi-dashboard-mercadona").
 if (onCheckRepoExists) {
   const exists = await onCheckRepoExists(specificRepoInput.trim());
   if (!exists) {
     setSpecificRepoError(specificRepoInput.trim());
     return;
   }
 }
 setSpecificRepoError(null);
 setBusy(true);
 try {
 const result = await onGenerateSpecific(specificRepoInput.trim(), specificPath.trim(), extraInstructions);
 // #58 (b): result es siempre GenerateSpecificResult | null. `currentContent`
 // es `undefined` cuando el documento es nuevo → el paso 3 muestra <pre> sin diff.
 if (result && typeof result === 'object' && result.doc != null) {
 setSpecificDoc(result.doc);
 setSpecificExistingContent(result.currentContent);
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
// v3.66.0 (Frente C): propagamos specificRepoInput al callback para que el destino
// sea el repo tecleado por el usuario (p. ej. powerbi-dashboard-mercadona), no el
// login del usuario autenticado. Antes se descartaba → publicaba en user/user.
const doCommitSpecific = async () => {
  if (!specificDoc || !specificRepoInput.trim()) return;
  setPending('commit'); setBusy(true);
  try {
    await onCommitSpecific(specificDoc, specificPath.trim(), specificRepoInput.trim());
  } finally { setBusy(false); setPending(null); onCancel(); }
};
const doDraftPrSpecific = async () => {
  if (!specificDoc || !specificRepoInput.trim()) return;
  setPending('draftpr'); setBusy(true);
  try { await onDraftPrSpecific(specificDoc, specificPath.trim(), specificRepoInput.trim()); }
  finally { setBusy(false); setPending(null); onCancel(); }
};
const doReleaseSpecific = async () => {
  if (!specificDoc || !specificRepoInput.trim()) return;
  setPending('release'); setBusy(true);
  try { await onReleaseSpecific(specificDoc, specificPath.trim(), specificRepoInput.trim()); }
  finally { setBusy(false); setPending(null); onCancel(); }
};

// ── #58 (a): handlers del scope bulk ──────────────────────────────────────────
// Toggle de un path del repoFileTree en la selección multi-archivo.
const toggleBulkPath = (path: string) => {
  setBulkPaths(prev => prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]);
};

// Genera la doc (IA) para cada path seleccionado del repo y combina con los
// archivos adjuntos del usuario. El resultado queda en `bulkTargets` (paso 3).
const handleGenerateBulk = async () => {
  if (busy) return;
  const trimmedRepo = bulkRepoInput.trim();
  const hasPaths = bulkPaths.length > 0;
  const attached = allAttachedFiles ?? [];
  if (!trimmedRepo || (hasPaths === false && attached.length === 0)) return;
  setBusy(true);
  setBulkProgress({ done: 0, total: bulkPaths.length });
  try {
    const targets: Array<{ path: string; content: string; origin: 'ai' | 'attached' }> = [];
    // 1. Generar doc con IA para cada path seleccionado (en serie para respetar
    //    rate limits de la IA y poder reportar progreso).
    for (let i = 0; i < bulkPaths.length; i++) {
      const p = bulkPaths[i];
      const result = await onGenerateSpecific(trimmedRepo, p, extraInstructions);
      if (result && typeof result === 'object' && result.doc != null) {
        targets.push({ path: p, content: result.doc, origin: 'ai' });
      }
      setBulkProgress({ done: i + 1, total: bulkPaths.length });
    }
    // 2. Adjuntos del usuario: cada archivo se convierte en {path: name, content: text}.
    for (const fc of attached) {
      if (!fc.file) continue;
      try {
        const text = await fc.file.text();
        targets.push({ path: fc.name, content: text, origin: 'attached' });
      } catch {
        // Binarios no legibles como texto: se ignoran (no son aptos para commit de texto).
      }
    }
    if (targets.length === 0) return;
    setBulkTargets(targets);
    // Destino por defecto del bulk = el repo introducido en paso 2.
    setDestRepo(trimmedRepo);
    setStep(3);
  } finally {
    setBusy(false);
    setBulkProgress(null);
  }
};

// Paso 4 bulk: commit directo o Draft PR al destino elegido.
const doCommitBulk = async (kind: 'commit' | 'draftpr') => {
  if (bulkTargets.length === 0 || !destRepo.trim()) return;
  const handler = kind === 'commit' ? onCommitBulk : onDraftPrBulk;
  if (!handler) return;
  setPending(kind); setBusy(true);
  try {
    const ref = resolveRepoRef(destRepo.trim(), currentUserLogin);
    const docTargets: DocTarget[] = bulkTargets.map(t => ({ path: t.path, content: t.content }));
    await handler(ref.owner, ref.repo, docTargets);
  } finally { setBusy(false); setPending(null); onCancel(); }
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
const isBulk = scope === 'bulk';

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
                  onClick={() => { setScope('repo'); saveScope('repo'); setStep(2); }}
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
                  onClick={() => { if (hasAttachedFile) { setScope('file'); saveScope('file'); setStep(2); } }}
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
  onClick={() => {
    setScope('specific'); saveScope('specific'); setStep(2);
    // Fix #XX: auto-fill desde initialRepo si el input está vacío (evita que el
    // usuario teclee un nombre incompleto tipo "mercadona-dashboard" en vez del
    // nombre completo del repo cargado en contexto).
    if (!specificRepoInput.trim() && safeInitialRepo) {
      setSpecificRepoInput(safeInitialRepo);
    }
  }}
>
  <strong>{t('modal.flow.scopeSpecific')}</strong>
  <small style={{ opacity: 0.8, fontWeight: 400 }}>{t('modal.flow.scopeSpecificDesc')}</small>
</button>
{/* #58 (a): botón "Varios archivos a la vez" (bulk atómico) */}
<button
  id="flow-scope-bulk"
  type="button"
  className="btn btn-secondary"
  style={{ textAlign: 'left', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}
  onClick={() => { setScope('bulk'); saveScope('bulk'); setStep(2); }}
>
  <strong>{t('modal.flow.scopeBulk')}</strong>
  <small style={{ opacity: 0.8, fontWeight: 400 }}>{t('modal.flow.scopeBulkDesc')}</small>
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
        onChange={e => { setSpecificRepoInput(e.target.value); saveSpecificRepoInput(e.target.value); setSpecificRepoError(null); }}
        style={{ fontSize: '0.85rem', padding: '8px 10px' }}
      />
      <input
        id="flow-specific-path-input"
        type="text"
        className="input"
        placeholder={t('modal.flow.specificPathPlaceholder')}
        value={specificPath}
        onChange={e => { setSpecificPath(e.target.value); saveSpecificPath(e.target.value); }}
        style={{ fontSize: '0.85rem', padding: '8px 10px' }}
      />
      {repoFileTree && repoFileTree.length > 0 && (
        <select
          id="flow-specific-path-select"
          className="input"
          value={specificPath}
          onChange={e => { setSpecificPath(e.target.value); saveSpecificPath(e.target.value); }}
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
      {/* #XX: error de validación del repo (no existe o sin acceso) */}
      {specificRepoError && (
        <div style={{
          padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem',
          background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)',
        }}>
          ❌ No encontré el repositorio <code>{specificRepoError}</code>. Verifica el nombre — ¿existe y tienes acceso?
        </div>
      )}
      <button
        id="flow-generate-specific-btn"
        type="button"
        className="btn btn-success"
        disabled={!specificRepoInput.trim() || !specificPath.trim() || busy}
        onClick={handleGenerateSpecific}
      >
        {busy ? t('modal.flow.generating') : t('modal.flow.generateSpecific')}
      </button>
    </div>
  </>
)}

{/* #58 (a): formulario del scope bulk — repo + multi-select de paths + adjuntos */}
{step === 2 && isBulk && (
  <>
    <p>{t('modal.flow.scopeBulk')}</p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
      <label style={{ fontSize: '0.8rem', opacity: 0.75 }}>{t('modal.flow.bulkRepo')}</label>
      <input
        id="flow-bulk-repo-input"
        autoFocus
        type="text"
        className="input"
        placeholder={t('modal.flow.bulkRepoPlaceholder')}
        value={bulkRepoInput}
        onChange={e => setBulkRepoInput(e.target.value)}
        disabled={busy}
        style={{ fontSize: '0.85rem', padding: '8px 10px' }}
      />

      {/* Multi-select de paths del repoFileTree */}
      <div>
        <div style={{ fontSize: '0.8rem', opacity: 0.75, marginBottom: '4px' }}>{t('modal.flow.bulkSelectPaths')}</div>
        <small style={{ display: 'block', fontSize: '0.72rem', opacity: 0.6, marginBottom: '6px' }}>
          {t('modal.flow.bulkSelectPathsHint')}
        </small>
        {(!repoFileTree || repoFileTree.length === 0) ? (
          <small style={{ fontSize: '0.78rem', opacity: 0.7 }}>{t('modal.flow.bulkNoTree')}</small>
        ) : (
          <div id="flow-bulk-paths-list" style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: '6px', padding: '4px' }}>
            {repoFileTree.map(ft => (
              <label key={ft.path} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={bulkPaths.includes(ft.path)}
                  onChange={() => toggleBulkPath(ft.path)}
                  disabled={busy}
                />
                <code style={{ fontSize: '0.78rem' }}>{ft.path}</code>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Resumen de adjuntos disponibles */}
      <div>
        <div style={{ fontSize: '0.8rem', opacity: 0.75, marginBottom: '4px' }}>{t('modal.flow.bulkAttached')}</div>
        {(allAttachedFiles && allAttachedFiles.length > 0) ? (
          <ul style={{ margin: '0', paddingLeft: '18px', fontSize: '0.8rem' }}>
            {allAttachedFiles.map((fc, i) => (
              <li key={`bulk-att-${fc.name}-${i}`}>
                <strong>{fc.name}</strong>{fc.file ? '' : ' ⚠️'}
              </li>
            ))}
          </ul>
        ) : (
          <small style={{ fontSize: '0.78rem', opacity: 0.6 }}>{t('modal.flow.bulkNoAttached')}</small>
        )}
      </div>

      {/* Instrucciones adicionales (compartidas con specific) */}
      <div>
        <label style={{ fontSize: '0.8rem', opacity: 0.75, display: 'block', marginBottom: '4px' }}>
          {t('modal.flow.extraInstructions')}
        </label>
        <textarea
          id="flow-bulk-extra-instructions"
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
        id="flow-generate-bulk-btn"
        type="button"
        className="btn btn-success"
        disabled={busy || !bulkRepoInput.trim() || (bulkPaths.length === 0 && !(allAttachedFiles && allAttachedFiles.length > 0))}
        onClick={handleGenerateBulk}
      >
        {bulkProgress
          ? t('modal.flow.bulkGenerating', { done: bulkProgress.done, total: bulkProgress.total })
          : t('modal.flow.bulkGenerate')}
      </button>
      {bulkPaths.length === 0 && !(allAttachedFiles && allAttachedFiles.length > 0) && (
        <small style={{ fontSize: '0.78rem', opacity: 0.7 }}>{t('modal.flow.bulkEmpty')}</small>
      )}
    </div>
  </>
)}


{step === 2 && !isFile && !isSpecific && !isBulk && (
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
              {/* #58 (b): si el README/MANUAL ya existe en el repo, renderiza el
                  diff old↔new; si no, mantiene el <pre> en crudo. Una rama por tab. */}
              {activeTab === 'readme' ? (
                analysis.readmeActual != null ? (
                  <div className="doc-preview-diff">
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '8px' }}>
                      {t('modal.flow.diffVsExisting')} · <code>README.md</code>
                    </div>
                    <DiffViewer filename="README.md" oldContent={analysis.readmeActual} newContent={analysis.readme} />
                  </div>
                ) : (
                  <div className="doc-preview-content">{analysis.readme}</div>
                )
              ) : (
                analysis.manualActual != null ? (
                  <div className="doc-preview-diff">
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '8px' }}>
                      {t('modal.flow.diffVsExisting')} · <code>MANUAL_TECNICO.md</code>
                    </div>
                    <DiffViewer filename="MANUAL_TECNICO.md" oldContent={analysis.manualActual} newContent={analysis.manualTecnico} />
                  </div>
                ) : (
                  <div className="doc-preview-content">{analysis.manualTecnico}</div>
                )
              )}
            </>
          )}
{step === 3 && isFile && fileDoc != null && (
  <div className="doc-preview-content" style={{ whiteSpace: 'pre-wrap' }}>{fileDoc}</div>
)}
{/* #58 Fase 2: preview del documento específico generado */}
{/* #58 (b): si el documento ya existía en el repo, renderiza el diff old↔new
    reutilizando DiffViewer. Si es un alta nueva, mantiene el <pre> en crudo. */}
{step === 3 && isSpecific && specificDoc != null && (
  specificExistingContent != null ? (
    <div className="doc-preview-diff">
      <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '8px' }}>
        {t('modal.flow.diffVsExisting')} · <code>{specificPath}</code>
      </div>
      <DiffViewer
        filename={specificPath}
        oldContent={specificExistingContent}
        newContent={specificDoc}
      />
    </div>
  ) : (
    <div className="doc-preview-content" style={{ whiteSpace: 'pre-wrap' }}>
      <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '8px' }}>
        {specificPath}
      </div>
      {specificDoc}
    </div>
  )
)}

{/* #58 (a): paso 3 bulk — resumen tabular de los targets generados/recogidos */}
{step === 3 && isBulk && bulkTargets.length > 0 && (
  <div style={{ marginTop: '8px' }}>
    <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '8px' }}>
      {t('modal.flow.bulkSummary', { count: bulkTargets.length, s: bulkTargets.length !== 1 ? 's' : '' })}
    </div>
    <table className="bulk-summary-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
      <thead>
        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border, rgba(255,255,255,0.1))' }}>
          <th style={{ padding: '6px 8px' }}>{t('modal.flow.specificPathPlaceholder').split(':')[0]}</th>
          <th style={{ padding: '6px 8px' }}>{t('modal.flow.bulkSelectPaths').split(' ')[0]}</th>
          <th style={{ padding: '6px 8px', textAlign: 'right' }}>{t('modal.flow.bulkLines', { count: '' }).replace('{count}', '').trim() || 'Líneas'}</th>
        </tr>
      </thead>
      <tbody>
        {bulkTargets.map((tgt, i) => (
          <tr key={`bulk-tgt-${tgt.path}-${i}`} style={{ borderBottom: '1px solid var(--border, rgba(255,255,255,0.05))' }}>
            <td style={{ padding: '6px 8px' }}><code style={{ fontSize: '0.78rem' }}>{tgt.path}</code></td>
            <td style={{ padding: '6px 8px' }}>
              {tgt.origin === 'ai' ? t('modal.flow.bulkOriginAI') : t('modal.flow.bulkOriginAttached')}
            </td>
            <td style={{ padding: '6px 8px', textAlign: 'right', opacity: 0.7 }}>
              {tgt.content.split('\n').length}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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

              {/* #58 (b): diff old↔new frente a docs/{base}.md ya existente en el repo destino. */}
              {fileExistingStatus === 'loading' && (
                <div style={{ marginTop: '12px', fontSize: '0.85rem', opacity: 0.7 }}>
                  ⏳ {t('modal.flow.fetchingExisting')}
                </div>
              )}
              {fileExistingStatus === 'notfound' && fileDoc != null && (
                <div style={{
                  marginTop: '12px', padding: '10px 12px', borderRadius: '8px', fontSize: '0.85rem',
                  background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.4)',
                }}>
                  {t('modal.flow.newDocNotice')}
                </div>
              )}
              {fileExistingStatus === 'found' && fileExistingContent != null && fileDoc != null && (
                <div className="doc-preview-diff" style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '8px' }}>
                    {t('modal.flow.diffVsExisting')}
                  </div>
                  <DiffViewer
                    filename={docPathFor(allAttachedFiles?.[0]?.name ?? attachedFileName ?? 'archivo')}
                    oldContent={fileExistingContent}
                    newContent={fileDoc}
                  />
                </div>
              )}
              {fileExistingStatus === 'error' && (
                <div style={{
                  marginTop: '12px', padding: '10px 12px', borderRadius: '8px', fontSize: '0.85rem',
                  background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)',
                }}>
                  {t('modal.flow.fetchExistingError')}
                </div>
              )}

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

          {/* #58 (a): paso 4 bulk — input destino (el método va en el footer) */}
          {step === 4 && isBulk && bulkTargets.length > 0 && (
            <div style={{ fontSize: '0.9rem' }}>
              <div style={{ opacity: 0.8, marginBottom: '4px' }}>{t('modal.flow.bulkDest')}</div>
              <input
                id="flow-bulk-dest-input"
                className="input"
                type="text"
                placeholder={t('modal.flow.destinationPlaceholder')}
                value={destRepo}
                onChange={e => setDestRepo(e.target.value)}
                disabled={busy}
                style={{ fontSize: '0.85rem', padding: '8px 10px' }}
              />
            </div>
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

{/* #58 (a): footer paso 4 bulk — 2 botones (Commit directo + Draft PR) */}
{step === 4 && isBulk && (
  <div className="modal-footer">
    <button id="flow-cancel-btn" className="btn btn-danger" onClick={onCancel} disabled={busy}>{t('modal.publish.cancel')}</button>
    <button id="flow-back-btn" className="btn btn-secondary" onClick={() => setStep(3)} disabled={busy}>{t('modal.flow.back')}</button>
    <button
      id="flow-bulk-commit-btn"
      className="btn btn-success"
      onClick={() => doCommitBulk('commit')}
      disabled={busy || !destRepo.trim()}
    >
      {busy && pending === 'commit' ? <><span className="spinner spinner-sm" /> {t('modal.flow.generating')}</> : t('modal.flow.bulkCommitDirect')}
    </button>
    <button
      id="flow-bulk-draftpr-btn"
      className="btn btn-success"
      onClick={() => doCommitBulk('draftpr')}
      disabled={busy || !destRepo.trim()}
    >
      {busy && pending === 'draftpr' ? <><span className="spinner spinner-sm" /> {t('modal.flow.generating')}</> : t('modal.flow.bulkDraftPr')}
    </button>
  </div>
)}
      </div>
    </div>
  );
}
