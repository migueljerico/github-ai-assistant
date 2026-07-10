import { useState, useCallback, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { useHistory } from './context/HistoryContext';
import { useAIProvider } from './context/AIProviderContext';
import { useLanguage } from './context/LanguageContext';
import { getProvider } from './services/providers';
import {
  runDocumentRepo, runLoadRepoContext, runSummarizeThread, runGenerateChangelog, runCodeHealth, runCommitDocs, runCreateDraftPr, runCreateRepoRelease,
  runSend, runConfirmAction, runCancelAction, runAttachFile,
  runGenerateFileDoc, runCreateRepo, runCreateRepoAndDocument, runStartPublish, runPublishFileDocByKind, formatConversation,
} from './services/assistantActions';
import type { RepoContext, FileContext, PublishTarget, StartPublishResult, CodeHealth } from './services/assistantActions';
import { serializeConversation, parseConversation, conversationFilename } from './utils/conversationIO';
import Header from './components/layout/Header';
import HistoryPanel from './components/layout/HistoryPanel';
import TemplatePanel from './components/templates/TemplatePanel';
import ChatArea from './components/chat/ChatArea';
import ChatInput from './components/chat/ChatInput';
import ConfirmModal from './components/confirm/ConfirmModal';
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
  const { provider, apiKey, model } = useAIProvider();
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

  // 🔥 OPCIÓN D - Modo override: 'auto' | 'chat' | 'action'
  // El setter aún no está cableado a la UI; de momento queda fijado en 'auto'.
  const [modeOverride] = useState<'auto' | 'chat' | 'action'>('auto');

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>): string => {
    const id = uid();
    setMessages(prev => [...prev, { ...msg, id, timestamp: new Date() }]);
    return id;
  }, []);

  const updateMessage = useCallback((id: string, update: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...update } : m));
  }, []);

  // ── Confirm action ─────────────────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (!pendingAction || !token || !user) return;
    const pa = pendingAction;
    setPendingAction(null);
    setIsExecuting(true);
    try {
      await runConfirmAction(
        { token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
        pa,
      );
    } finally {
      setIsExecuting(false);
    }
  }, [pendingAction, token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

  // ── Cancel action ──────────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    if (pendingAction) {
      runCancelAction(
        { token: token ?? '', user: user ?? { login: '' }, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
        pendingAction,
      );
    }
    setPendingAction(null);
  }, [pendingAction, token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

  // ── #41: Cargar repo como contexto activo del chat ─────────────────────────
  const handleLoadRepoContext = useCallback(async (repoInput: string) => {
    if (!token || !user) return;
    const ctx = await runLoadRepoContext(
      { token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      repoInput,
      provider ?? undefined,
    );
    if (ctx) setRepoContext(ctx);
  }, [token, user, provider, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

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
    const deps = { token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading };
    // Procesa cada archivo y acumula los que se lean correctamente (no reemplaza).
    const loaded: FileContext[] = [];
    for (const file of files) {
      const ctx = await runAttachFile(deps, file);
      if (ctx) loaded.push({ ...ctx, file }); // conserva el File original para subirlo al publicar (#28 4a)
    }
    if (loaded.length > 0) setFileContext(prev => [...prev, ...loaded]);
  }, [token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

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
      { token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      { provider, apiKey, model },
      repoInput,
    );
  }, [token, user, provider, apiKey, model, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

  const flowGenerateFile = useCallback(async (): Promise<string | null> => {
    // 🔥 ZERO-STORAGE: provider, apiKey y model vienen del contexto
    // #57 Tanda B: con multi-archivo, se documenta el PRIMER archivo adjunto (el
    // resto pueden subirse como extras en el paso de publicación).
    const primary = fileContext[0];
    if (!primary || !token || !user || !provider || !apiKey || !model) return null;
    return runGenerateFileDoc(
      { token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      { provider, apiKey, model },
      primary,
      buildConversationText(),
    );
  }, [fileContext, token, user, provider, apiKey, model, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, buildConversationText]);

  // Publicación de la doc de repo (destino fijo = repo analizado).
  const flowCommitRepo = useCallback(async (analysis: RepoAnalysis): Promise<void> => {
    if (!token || !user) return;
    await runCommitDocs(
      { token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      analysis,
    );
  }, [token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

  const flowDraftPrRepo = useCallback(async (analysis: RepoAnalysis): Promise<void> => {
    if (!token || !user) return;
    await runCreateDraftPr(
      { token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      analysis,
    );
  }, [token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

  const flowReleaseRepo = useCallback(async (analysis: RepoAnalysis, version: string): Promise<void> => {
    if (!token || !user) return;
    await runCreateRepoRelease(
      { token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      analysis,
      version || undefined,
    );
  }, [token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

  // #57 Tanda B: crear repo inexistente + subir archivos + documentarlo (scope repo).
  const flowCreateRepoAndGenerateRepo = useCallback(async (
    repoInput: string,
    files?: File[],
  ): Promise<RepoAnalysis | null> => {
    // 🔥 ZERO-STORAGE: provider, apiKey y model vienen del contexto
    if (!token || !user || !provider || !apiKey || !model) return null;
    return runCreateRepoAndDocument(
      { token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      { provider, apiKey, model },
      repoInput,
      files,
    );
  }, [token, user, provider, apiKey, model, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading]);

  // Publicación de la doc del archivo (destino elegido; maneja repo inexistente).
  const flowPublishFile = useCallback(async (target: PublishTarget): Promise<StartPublishResult> => {
    if (!token || !user) return 'handled';
    const deps = { token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading };
    return runStartPublish(deps, target, target.owner === user.login);
  }, [token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

  const flowCreateRepoAndPublishFile = useCallback(async (target: PublishTarget): Promise<StartPublishResult> => {
    if (!token || !user) return 'handled';
    const deps = { token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading };
    const ok = await runCreateRepo(deps, target.repo);
    if (!ok) return 'handled';
    await runPublishFileDocByKind(deps, target);
    return 'published';
  }, [token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

  // ── Send message to AI (Opción D - con detección de modo) ──────────────────
  // Con un archivo adjunto, resolveMode (en runSend) fuerza SIEMPRE chat: el archivo
  // se conversa/analiza. Documentar/publicar es EXPLÍCITO (botón "📤 Documentar y
  // publicar"), no se adivina por palabras clave (se quitó esa heurística frágil).
  // #40: controlador para cancelar la generación en curso (botón Detener).
  const abortRef = useRef<AbortController | null>(null);

  const handleSend = useCallback(async () => {
    // 🔥 ZERO-STORAGE: provider, apiKey y model vienen del contexto
    if (!inputValue.trim() || !token || !user || !provider || !apiKey || !model) return;
    const userText = inputValue.trim();
    setInputValue('');

    const controller = new AbortController();
    abortRef.current = controller;

    await runSend(
      { token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading, setConversationHistory, setPendingAction },
      { provider, apiKey, model },
      { userText, conversationHistory, modeOverride, repoContext, fileContext, multiRepoEnabled, selectedRepos, signal: controller.signal },
    );
  }, [inputValue, token, user, provider, apiKey, model, providerName, t, lang, conversationHistory, multiRepoEnabled, selectedRepos, modeOverride, repoContext, fileContext, addMessage, updateMessage, addEntry, updateEntry]);

  // #40: cancela la petición en vuelo; runSend mostrará "⏹️ detenido".
  const handleStop = useCallback(() => abortRef.current?.abort(), []);

  // ── Resumir hilo (#32) ───────────────────────────────────────────────────────
  const handleSummarizeThread = useCallback(async (input: string) => {
    // 🔥 ZERO-STORAGE: provider, apiKey y model vienen del contexto
    if (!token || !user || !provider || !apiKey || !model) return;
    await runSummarizeThread(
      { token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      { provider, apiKey, model },
      input,
      repoContext?.repoName ?? null,
    );
  }, [token, user, provider, apiKey, model, providerName, t, lang, repoContext, addMessage, updateMessage, addEntry, updateEntry]);

  // ── Generar changelog del repo (#34) ─────────────────────────────────────────
  const handleGenerateChangelog = useCallback(async (input: string) => {
    if (!token || !user || !provider || !apiKey || !model) return;
    await runGenerateChangelog(
      { token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      { provider, apiKey, model },
      input,
    );
  }, [token, user, provider, apiKey, model, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

  // ── Salud del código — dashboard (#44) ───────────────────────────────────────
  const handleCodeHealth = useCallback(async (input: string) => {
    if (!token || !user) return;
    const result = await runCodeHealth(
      { token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      input,
    );
    if (result) setCodeHealth(result);
  }, [token, user, providerName, t, lang, addMessage, updateMessage, addEntry, updateEntry]);

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
          <ChatArea messages={messages} />
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
