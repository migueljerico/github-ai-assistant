import { useState, useCallback, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { useHistory } from './context/HistoryContext';
import { useAIProvider } from './context/AIProviderContext';
import { useLanguage } from './context/LanguageContext';
import { getProvider } from './services/providers';
import {
  runDocumentRepo, runLoadRepoContext, runSummarizeThread, runGenerateChangelog, runCodeHealth, runCommitDocs, runCreateDraftPr, runCreateRepoRelease, runSecurityAudit, runSyncRepoStatus,
  runSend, runConfirmAction, runCancelAction, runAttachFile,
  runGenerateFileDoc, runCreateRepo, runCreateRepoAndDocument, runGenerateSpecificDoc,
runPublishSpecificDoc, runStartPublish, runPublishFileDocByKind, formatConversation,
fetchExistingFileDoc, runPublishBulk,
} from './services/assistantActions';
import type { RepoContext, FileContext, PublishTarget, StartPublishResult, CodeHealth, GenerateSpecificResult } from './services/assistantActions';
import type { DocTarget } from './services/docPublisher';
import { serializeConversation, parseConversation, conversationFilename } from './utils/conversationIO';
import Header from './components/layout/Header';
import SessionWarningBanner from './components/layout/SessionWarningBanner';
import HistoryPanel from './components/layout/HistoryPanel';
import TemplatePanel from './components/templates/TemplatePanel';
import ChatArea from './components/chat/ChatArea';
import ChatInput from './components/chat/ChatInput';
import ConfirmModal from './components/confirm/ConfirmModal';
import ChangeReviewModal from './components/confirm/ChangeReviewModal';
import DocumentFlowModal from './components/confirm/DocumentFlowModal';
import CodeHealthModal from './components/dashboard/CodeHealthModal';
import type { ChatMessage, GitHubRepo, PendingAction, RepoAnalysis } from './types';

// Generate a simple unique ID
const uid = () => crypto.randomUUID();

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const { token, user, isAuthenticated } = useAuth();
  const { addEntry, updateEntry } = useHistory();
  // 🔥 ZERO-STORAGE: Extraemos provider, apiKey Y model del contexto (no de sessionStorage)
  const { provider, apiKey, model, accountId, timeoutMs } = useAIProvider();
  const providerName = provider ? getProvider(provider).name : 'IA';
  const { t, lang } = useLanguage();

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  // Sidebar state — en móvil (≤900px) los paneles laterales son overlays fijos;
  // arrancarlos abiertos taparía el chat, así que en pantallas estrechas empiezan
  // cerrados (en escritorio, abiertos como hasta ahora).
  const startPanelsOpen = () => typeof window === 'undefined' || window.innerWidth > 900;
  const [templatesOpen, setTemplatesOpen] = useState(startPanelsOpen);
  const [historyOpen, setHistoryOpen] = useState(startPanelsOpen);

  // Multi-repo state
  const [multiRepoEnabled, setMultiRepoEnabled] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState<GitHubRepo[]>([]);

  // Pending action (confirmation modal)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // #57 - Flujo único de documentación (stepper)
  const [documentFlowOpen, setDocumentFlowOpen] = useState(false);
  // #57 Tanda B: repo inicial opcional (botón "Actualizar documentación" sobre repoContext).
  const [documentFlowInitialRepo, setDocumentFlowInitialRepo] = useState<string | undefined>(undefined);
  const [codeHealth, setCodeHealth] = useState<CodeHealth | null>(null);

  // #41 - Contexto de repo activo para opiniones de chat fundamentadas
  const [repoContext, setRepoContext] = useState<RepoContext | null>(null);

  // #28 - Archivos locales adjuntos como contexto del chat (#57 Tanda B: multi-archivo)
  const [fileContext, setFileContext] = useState<FileContext[]>([]);

  // 🔥 OPCIÓN D - Modo override: 'auto' | 'chat' | 'action' | 'review'
  const [modeOverride, setModeOverride] = useState<'auto' | 'chat' | 'action' | 'review'>('auto');

  // #58 (c) - Modo revisión: acumula acciones para revisión uno-a-uno
  const [reviewActions, setReviewActions] = useState<PendingAction[]>([]);

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>): string => {
    const id = uid();
    setMessages(prev => [...prev, { ...msg, id, timestamp: new Date() }]);
    return id;
  }, []);

  const updateMessage = useCallback((id: string, update: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...update } : m));
  }, []);

  // ── Confirm action ─────────────────────────────────────────────────────────
  // #53 (v3.50.0): onConfirm recibe opcionalmente el mensaje de commit editado
  // por el usuario en el textarea del modal. Lo fusionamos en el PendingAction
  // antes de ejecutar, para que runConfirmAction lo propague a createOrUpdateFile.
  const handleConfirm = useCallback(async (editedCommitMessage?: string) => {
    if (!pendingAction || !token || !user) return;
    // editedCommitMessage === undefined → el modal no mostró textarea (lectura)
    // o el usuario dejó el campo vacío. Solo sobreescribimos si hay valor real.
    const pa = editedCommitMessage
      ? { ...pendingAction, commitMessage: editedCommitMessage }
      : pendingAction;
    setPendingAction(null);
    setIsExecuting(true);
    try {
      await runConfirmAction(
        { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
        pa,
      );
    } finally {
      setIsExecuting(false);
    }
  }, [pendingAction, token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

  // ── Cancel action ──────────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    if (pendingAction) {
runCancelAction(
{ token: token ?? '', user: user ?? { login: '' }, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
        pendingAction,
      );
    }
    setPendingAction(null);
  }, [pendingAction, token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

  // ── #41: Cargar repo como contexto activo del chat ─────────────────────────
  const handleLoadRepoContext = useCallback(async (repoInput: string) => {
    if (!token || !user) return;
    const ctx = await runLoadRepoContext(
      { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      repoInput,
      provider ?? undefined,
    );
    if (ctx) setRepoContext(ctx);
  }, [token, user, provider, providerName, model, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

  const handleClearRepoContext = useCallback(() => {
    setRepoContext(null);
    addMessage({
      role: 'assistant',
      content: '🧹 Contexto del repositorio descartado. Volveré a opinar sin contexto específico.',
    });
  }, [addMessage]);

  // ── #28: Adjuntar archivos locales como contexto (multi-archivo, #57 Tanda B) ──
  const handleAttachFiles = useCallback(async (files: File[]) => {
    if (!token || !user) return;
    const deps = { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading };
    // Procesa cada archivo y acumula los que se lean correctamente (no reemplaza).
    const loaded: FileContext[] = [];
    for (const file of files) {
      const ctx = await runAttachFile(deps, file);
      if (ctx) loaded.push({ ...ctx, file }); // conserva el File original para subirlo al publicar (#28 4a)
    }
    if (loaded.length > 0) setFileContext(prev => [...prev, ...loaded]);
  }, [token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

  const handleClearFileAt = useCallback((index: number) => {
    setFileContext(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearAllFiles = useCallback(() => {
    setFileContext([]);
    addMessage({ role: 'assistant', content: '🧹 Archivos adjuntos descartados.' });
  }, [addMessage]);

  // Texto plano de la conversación, como contexto al documentar (el doc refleja lo
  // charlado). La lógica vive en formatConversation (testeable). Se define antes del
  // flujo de documentación porque flowGenerateFile lo usa.
  const buildConversationText = useCallback(
    () => formatConversation(conversationHistory),
    [conversationHistory],
  );

  // ── #57: Flujo único de documentación (stepper) ───────────────────────────────
  // Sustituye los dos flujos divergentes previos ("Documentar repo" → DocModal y
  // "Documentar y publicar" → FilePublishModal). El modal (DocumentFlowModal) orquesta
  // los pasos y estas funciones cablean estado/UI con las run* (patrón #42).
  // #57 Tanda B: `openDocumentFlow` admite un repo inicial opcional para el flujo
  // "Actualizar documentación" cuando hay un repo cargado en memoria (repoContext).
  const openDocumentFlow = useCallback((initialRepo?: string) => {
    if (initialRepo) setDocumentFlowInitialRepo(initialRepo);
    setDocumentFlowOpen(true);
  }, []);
  const closeDocumentFlow = useCallback(() => {
    setDocumentFlowOpen(false);
    setDocumentFlowInitialRepo(undefined);
  }, []);

  const flowGenerateRepo = useCallback(async (repoInput: string): Promise<RepoAnalysis | null | 'repo-missing'> => {
    // 🔥 ZERO-STORAGE: provider, apiKey y model vienen del contexto
    if (!token || !user || !provider || !apiKey || !model) return null;
    return runDocumentRepo(
      { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      { provider, apiKey, model, accountId, timeoutMs },
      repoInput,
    );
  }, [token, user, provider, apiKey, model, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, accountId]);

  const flowGenerateFile = useCallback(async (): Promise<string | null> => {
    // 🔥 ZERO-STORAGE: provider, apiKey y model vienen del contexto
    // #57 Tanda B: con multi-archivo, se documenta el PRIMER archivo adjunto (el
    // resto pueden subirse como extras en el paso de publicación).
    const primary = fileContext[0];
    if (!primary || !token || !user || !provider || !apiKey || !model) return null;
    return runGenerateFileDoc(
      { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      { provider, apiKey, model, accountId, timeoutMs },
      primary,
      buildConversationText(),
    );
  }, [fileContext, token, user, provider, apiKey, model, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, buildConversationText, accountId]);

  // #58 (b): trae el contenido actual de docs/{base}.md en el repo destino para
  // que el paso 4 del scope file muestre el diff old↔new antes de publicar.
  const flowFetchExistingDoc = useCallback(async (owner: string, repo: string, fileName: string): Promise<string | null> => {
    if (!token) return null;
    return fetchExistingFileDoc(token, owner, repo, fileName);
  }, [token]);

  // Publicación de la doc de repo (destino fijo = repo analizado).
  const flowCommitRepo = useCallback(async (analysis: RepoAnalysis): Promise<void> => {
    if (!token || !user) return;
    await runCommitDocs(
      { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      analysis,
    );
  }, [token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

  const flowDraftPrRepo = useCallback(async (analysis: RepoAnalysis): Promise<void> => {
    if (!token || !user) return;
    await runCreateDraftPr(
      { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      analysis,
    );
  }, [token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

  const flowReleaseRepo = useCallback(async (analysis: RepoAnalysis, version: string): Promise<void> => {
    if (!token || !user) return;
    await runCreateRepoRelease(
      { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      analysis,
      version || undefined,
    );
  }, [token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

  // #57 Tanda B: crear repo inexistente + subir archivos + documentarlo (scope repo).
  const flowCreateRepoAndGenerateRepo = useCallback(async (
    repoInput: string,
    files?: File[],
  ): Promise<RepoAnalysis | null> => {
    // 🔥 ZERO-STORAGE: provider, apiKey y model vienen del contexto
    if (!token || !user || !provider || !apiKey || !model) return null;
    return runCreateRepoAndDocument(
      { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      { provider, apiKey, model, accountId, timeoutMs },
      repoInput,
      files,
    );
  }, [token, user, provider, apiKey, model, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading, accountId]);

  // Publicación de la doc del archivo (destino elegido; maneja repo inexistente).
  const flowPublishFile = useCallback(async (target: PublishTarget): Promise<StartPublishResult> => {
    if (!token || !user) return 'handled';
    const deps = { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading };
    return runStartPublish(deps, target, target.owner === user.login);
  }, [token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

const flowCreateRepoAndPublishFile = useCallback(async (target: PublishTarget): Promise<StartPublishResult> => {
  if (!token || !user) return 'handled';
  const deps = { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading };
  const ok = await runCreateRepo(deps, target.repo);
  if (!ok) return 'handled';
  await runPublishFileDocByKind(deps, target);
  return 'published';
}, [token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

// #58 Fase 2: callbacks para "documento específico del repo"
// #58 (b): devuelve GenerateSpecificResult ({doc, currentContent}) en vez de
// string plano, para que el modal pueda renderizar el diff old↔new.
const flowGenerateSpecific = useCallback(async (repoInput: string, targetPath: string, extraInstructions?: string): Promise<GenerateSpecificResult | null> => {
 // 🔥 ZERO-STORAGE: provider, apiKey y model vienen del contexto
 if (!token || !user || !provider || !apiKey || !model) return null;
 const deps = {
 token, user, providerName, model, provider, t, lang,
 addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading,
 };
 return runGenerateSpecificDoc(deps, { provider, apiKey, model, accountId, timeoutMs }, repoInput, targetPath, undefined, extraInstructions);
}, [token, user, providerName, model, provider, apiKey, accountId, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading]);

const flowCommitSpecific = useCallback(async (doc: string, path: string): Promise<void> => {
  if (!token || !user) return;
  const deps = { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading };
  await runPublishSpecificDoc(deps, user.login, user.login, path, doc, 'commit');
}, [token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading]);

const flowDraftPrSpecific = useCallback(async (doc: string, path: string): Promise<void> => {
  if (!token || !user) return;
  const deps = { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading };
  await runPublishSpecificDoc(deps, user.login, user.login, path, doc, 'draftpr');
}, [token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading]);

const flowReleaseSpecific = useCallback(async (doc: string, path: string): Promise<void> => {
  if (!token || !user) return;
  const deps = { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading };
  await runPublishSpecificDoc(deps, user.login, user.login, path, doc, 'release');
}, [token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading]);

// #58 (a): bulk multi-archivo atómico. Recibe (owner, repo, targets) explícitos
// (a diferencia de flowCommitSpecific que hardcodea user.login — limitación prexistente,
// no tocada aquí). El destino lo resuelve el modal en el paso 4.
const flowCommitBulk = useCallback(async (owner: string, repo: string, targets: DocTarget[]): Promise<void> => {
  if (!token || !user) return;
  const deps = { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading };
  await runPublishBulk(deps, owner, repo, targets, 'commit');
}, [token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading]);

const flowDraftPrBulk = useCallback(async (owner: string, repo: string, targets: DocTarget[]): Promise<void> => {
  if (!token || !user) return;
  const deps = { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading };
  await runPublishBulk(deps, owner, repo, targets, 'draftpr');
}, [token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading]);

// ── Send message to AI (Opción D - con detección de modo) ──────────────────
  // Con un archivo adjunto, resolveMode (en runSend) fuerza SIEMPRE chat: el archivo
  // se conversa/analiza. Documentar/publicar es EXPLÍCITO (botón "📄 Documentar repo",
  // DocumentFlowModal), no se adivina por palabras clave (se quitó esa heurística frágil).
  // #40: controlador para cancelar la generación en curso (botón Detener).
  const abortRef = useRef<AbortController | null>(null);

  const handleSend = useCallback(async (overrideText?: string) => {
    // 🔥 ZERO-STORAGE: provider, apiKey y model vienen del contexto.
    // v3.56.0: overrideText permite reenviar una petición concreta (p. ej. tras un
    // cambio de modo sugerido por la IA) sin depender del closure de inputValue.
    const userText = (overrideText ?? inputValue).trim();
    if (!userText || !token || !user || !provider || !apiKey || !model) return;
    if (!overrideText) setInputValue('');

    const controller = new AbortController();
    abortRef.current = controller;

    await runSend(
      { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading, setConversationHistory, setPendingAction, addReviewAction: (pa) => setReviewActions(prev => [...prev, pa]) },
      { provider, apiKey, model, accountId, timeoutMs },
      { userText, conversationHistory, modeOverride, repoContext, fileContext, multiRepoEnabled, selectedRepos, signal: controller.signal, reviewMode: modeOverride === 'review' },
    );
  }, [inputValue, token, user, provider, apiKey, model, providerName, t, lang, conversationHistory, multiRepoEnabled, selectedRepos, modeOverride, repoContext, fileContext, addMessage, updateMessage, addEntry, updateEntry, accountId]);

  /**
   * v3.56.0: handler del botón 1-clic "cambiar de modo" en un mensaje de la IA.
   * Cambia el modo al sugerido y reenvía automáticamente la petición original en el
   * modo correcto, sin que el usuario tenga que reescribirla ni recordar pulsar Enter.
   */
  const handleSwitchMode = useCallback((mode: 'chat' | 'action', retryText: string) => {
    setModeOverride(mode);
    // Dejamos el texto en el input por si el usuario quiere editarlo antes del reenvío,
    // pero disparamos el envío de inmediato (handleSend usa overrideText, no inputValue).
    setInputValue(retryText);
    handleSend(retryText);
  }, [handleSend]);

  // #40: cancela la petición en vuelo; runSend mostrará "⏹️ detenido".
  const handleStop = useCallback(() => abortRef.current?.abort(), []);

  // ── Resumir hilo (#32) ───────────────────────────────────────────────────────
  const handleSummarizeThread = useCallback(async (input: string) => {
    // 🔥 ZERO-STORAGE: provider, apiKey y model vienen del contexto
    if (!token || !user || !provider || !apiKey || !model) return;
    await runSummarizeThread(
      { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      { provider, apiKey, model, accountId, timeoutMs },
      input,
      repoContext?.repoName ?? null,
    );
  }, [token, user, provider, apiKey, model, providerName, t, lang, repoContext, addMessage, updateMessage, addEntry, updateEntry, accountId]);

  // ── Generar changelog del repo (#34) ─────────────────────────────────────────
  const handleGenerateChangelog = useCallback(async (input: string) => {
    if (!token || !user || !provider || !apiKey || !model) return;
    await runGenerateChangelog(
      { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      { provider, apiKey, model, accountId, timeoutMs },
      input,
    );
  }, [token, user, provider, apiKey, model, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, accountId]);

  // ── Salud del código — dashboard (#44) ───────────────────────────────────────
  const handleCodeHealth = useCallback(async (input: string) => {
    if (!token || !user) return;
    const result = await runCodeHealth(
      { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      input,
    );
    if (result) setCodeHealth(result);
  }, [token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

  // ── Modo Auditoría de Seguridad (#52) — lectura-only, lanza runSecurityAudit ──
  // Sobre el repo activo si lo hay; si no, SecurityAuditButton abre un input
  // inline y el repo llega aquí vía initialRepo. v3.43.0: si el repo indicado no
  // es el que ya está en repoContext, lo cargamos primero (aparece el chip
  // "Contexto" para futuras preguntas) y luego encadenamos la auditoría — un
  // solo gesto del usuario, sin el "repoNeeded y se cuelga" previo.
  // Reutiliza el mismo AbortController del chat para que el botón Detener lo cancele.
  const handleSecurityAudit = useCallback(async (initialRepo?: string) => {
    // 🔥 ZERO-STORAGE: provider, apiKey y model vienen del contexto
    if (!token || !user || !provider || !apiKey || !model) return;
    const repoInput = initialRepo ?? repoContext?.repoName ?? '';
    if (!repoInput.trim()) {
      // Red de seguridad: por la UI ya no se llega aquí (SecurityAuditButton pide
      // input inline cuando no hay repo activo), pero protegemos llamadas directas.
      addMessage({ role: 'assistant', content: t('chat.repoNeeded') });
      return;
    }

    // Si el repo indicado no coincide con el contexto activo, cargarlo primero.
    // runLoadRepoContext NO llama al LLM: solo inyecta árbol + contenido en la
    // conversación y deja el chip "Contexto: X" (Zero-Storage intacto).
    let ctx = repoContext;
    if (!ctx || ctx.repoName !== repoInput) {
      ctx = await runLoadRepoContext(
        { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
        repoInput,
        provider ?? undefined,
      );
      if (ctx) setRepoContext(ctx);
    }
    if (!ctx) return; // runLoadRepoContext ya emitió su mensaje de error

    const controller = new AbortController();
    abortRef.current = controller;
    await runSecurityAudit(
      { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      { provider, apiKey, model, accountId, timeoutMs },
      repoInput,
      { repoContext: ctx, signal: controller.signal },
    );
  }, [token, user, provider, apiKey, model, providerName, t, lang, repoContext, addMessage, updateMessage, addEntry, updateEntry, accountId]);

  // ── SyncRepoStatus (#70/#48) — resumen pull-based de commits recientes. ───────
  // El servicio resuelve el ref del repo internamente (resolveRepoRef), así que no
  // hace falta cargar repoContext antes: lista los últimos commits vía API de GitHub
  // y los resume con la IA. Zero-Storage intacto: credenciales solo en memoria.
  const handleSyncRepoStatus = useCallback(async (repoInput: string) => {
    // 🔥 ZERO-STORAGE: provider, apiKey y model vienen del contexto
    if (!token || !user || !provider || !apiKey || !model) return;
    if (!repoInput.trim()) {
      addMessage({ role: 'assistant', content: t('chat.repoNeeded') });
      return;
    }
    await runSyncRepoStatus(
      { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      repoInput,
      { provider, apiKey, model, accountId, timeoutMs },
    );
  }, [token, user, provider, apiKey, model, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, accountId]);

  // ── Exportar / importar conversación (#46, Zero-Storage) ─────────────────────
  const handleExportConversation = useCallback(() => {
    const json = serializeConversation(messages, conversationHistory, repoContext?.repoName ?? null);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = conversationFilename(repoContext?.repoName ?? null);
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, conversationHistory, repoContext]);

  const handleImportConversation = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const { messages: imported, conversationHistory: history, repoContextName } = parseConversation(text);
      setMessages(imported);
      setConversationHistory(history);
      addMessage({ role: 'assistant', content: `📂 Conversación importada — ${imported.length} mensaje${imported.length !== 1 ? 's' : ''} restaurado${imported.length !== 1 ? 's' : ''}.` });
      if (repoContextName && token && user) handleLoadRepoContext(repoContextName);
    } catch (err) {
      addMessage({ role: 'assistant', content: `❌ ${(err as Error).message}` });
    }
  }, [token, user, addMessage, handleLoadRepoContext]);

  // #57: la publicación de la doc de repo la orquesta DocumentFlowModal
  // (flowCommitRepo / flowDraftPrRepo / flowReleaseRepo, definidos arriba).

  return (
    <>
      <Header
        onToggleTemplates={() => {
          const opening = !templatesOpen;
          setTemplatesOpen(opening);
          // En móvil solo cabe un overlay a la vez: al abrir uno, cierra el otro.
          if (opening && window.innerWidth <= 900) setHistoryOpen(false);
        }}
        onToggleHistory={() => {
          const opening = !historyOpen;
          setHistoryOpen(opening);
          if (opening && window.innerWidth <= 900) setTemplatesOpen(false);
        }}
        templatesOpen={templatesOpen}
        historyOpen={historyOpen}
      />
      <SessionWarningBanner />

      <div className="main-layout">
        {/* Fondo oscuro en móvil: al tocar fuera, cierra los paneles laterales. */}
        {(templatesOpen || historyOpen) && (
          <div
            className="mobile-backdrop"
            onClick={() => { setTemplatesOpen(false); setHistoryOpen(false); }}
            aria-hidden="true"
          />
        )}
        <TemplatePanel
          isOpen={templatesOpen}
          onSelectTemplate={setInputValue}
        />

        <div className="chat-container">
          <ChatArea messages={messages} onSwitchMode={handleSwitchMode} />
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSend}
            onStop={handleStop}
            isLoading={isChatLoading}
            disabled={!isAuthenticated}
            multiRepoEnabled={multiRepoEnabled}
            onMultiRepoChange={setMultiRepoEnabled}
            selectedRepos={selectedRepos}
            onSelectedReposChange={setSelectedRepos}
            onOpenDocumentFlow={openDocumentFlow}
            onSummarizeThread={handleSummarizeThread}
            onGenerateChangelog={handleGenerateChangelog}
            onCodeHealth={handleCodeHealth}
            onOpenSecurityAudit={handleSecurityAudit}
            onSyncRepoStatus={handleSyncRepoStatus}
            onExportConversation={handleExportConversation}
            onImportConversation={handleImportConversation}
            hasMessages={messages.length > 0}
            repoContextName={repoContext?.repoName ?? null}
            onLoadRepoContext={handleLoadRepoContext}
            onClearRepoContext={handleClearRepoContext}
            fileContextNames={fileContext.map(f => f.name)}
            onAttachFiles={handleAttachFiles}
            onClearFileAt={handleClearFileAt}
            onClearAllFiles={handleClearAllFiles}
            modeOverride={modeOverride}
            onModeOverrideChange={setModeOverride}
          />
        </div>

        <HistoryPanel isOpen={historyOpen} />
      </div>

      {/* Confirmation modal */}
      {pendingAction && (
        <ConfirmModal
          pendingAction={pendingAction}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          isExecuting={isExecuting}
        />
      )}

      {/* #58 (c) - Review mode modal */}
      {reviewActions.length > 0 && (
        <ChangeReviewModal
          actions={reviewActions}
          onAccept={() => {}}
          onReject={() => {}}
          onApplyAccepted={async (acceptedIndices: number[]) => {
            // v3.56.0: antes era un stub (TODO) que solo limpiaba la lista. Ahora
            // ejecutamos de verdad las acciones aceptadas, una a una, con el mismo
            // flujo que handleConfirm (runConfirmAction gestiona single/multi-repo,
            // historial y mensajes de chat). Las rechazadas se quedan sin tocar.
            if (!token || !user) return;
            const toApply = acceptedIndices
              .map(i => reviewActions[i])
              .filter((pa): pa is PendingAction => !!pa);
            setReviewActions(prev => prev.filter((_, i) => !acceptedIndices.includes(i)));
            setIsExecuting(true);
            try {
              for (const pa of toApply) {
                await runConfirmAction(
                  { token, user, providerName, model, provider, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
                  pa,
                );
              }
            } finally {
              setIsExecuting(false);
            }
          }}
          onClear={() => setReviewActions([])}
          onCancel={() => setReviewActions([])}
          isExecuting={isExecuting}
        />
      )}

      {/* #57 - Flujo único de documentación (stepper) */}
      {documentFlowOpen && (
        <DocumentFlowModal
          hasAttachedFile={fileContext.length > 0}
          attachedFileName={fileContext[0]?.name}
          attachedFile={fileContext[0]?.file}
          currentUserLogin={user?.login ?? ''}
          initialRepo={documentFlowInitialRepo}
          allAttachedFiles={fileContext}
          onGenerateRepo={flowGenerateRepo}
          onCreateRepoAndGenerate={flowCreateRepoAndGenerateRepo}
          onGenerateFile={flowGenerateFile}
          onCommitRepo={flowCommitRepo}
          onDraftPrRepo={flowDraftPrRepo}
          onReleaseRepo={flowReleaseRepo}
    onPublishFile={flowPublishFile}
    onCreateRepoAndPublish={flowCreateRepoAndPublishFile}
    // #58 (b): fetch del doc ya existente en el repo destino (scope file, paso 4).
    onFetchExistingDoc={flowFetchExistingDoc}
    // #58 Fase 2: callbacks para "documento específico del repo"
    onGenerateSpecific={flowGenerateSpecific}
    onCommitSpecific={flowCommitSpecific}
    onDraftPrSpecific={flowDraftPrSpecific}
    onReleaseSpecific={flowReleaseSpecific}
    // #58 (a): bulk multi-archivo atómico (commit directo + Draft PR)
    onCommitBulk={flowCommitBulk}
    onDraftPrBulk={flowDraftPrBulk}
    repoFileTree={repoContext?.fileTree}
    onCancel={closeDocumentFlow}
        />
      )}

      {/* #44 - Dashboard "Salud del Código" */}
      {codeHealth && (
        <CodeHealthModal data={codeHealth} onClose={() => setCodeHealth(null)} />
      )}
    </>
  );
}
