import { useState, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { useHistory } from './context/HistoryContext';
import { useAIProvider } from './context/AIProviderContext';
import { getProvider } from './services/providers';
import {
  runDocumentRepo, runLoadRepoContext, runSummarizeThread, runCommitDocs, runCreateDraftPr,
  runSend, runConfirmAction, runCancelAction, runAttachFile,
} from './services/assistantActions';
import type { RepoContext, FileContext } from './services/assistantActions';
import Header from './components/layout/Header';
import HistoryPanel from './components/layout/HistoryPanel';
import TemplatePanel from './components/templates/TemplatePanel';
import ChatArea from './components/chat/ChatArea';
import ChatInput from './components/chat/ChatInput';
import ConfirmModal from './components/confirm/ConfirmModal';
import DocModal from './components/confirm/DocModal';
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

  // Doc repo state
  const [docAnalysis, setDocAnalysis] = useState<RepoAnalysis | null>(null);
  const [isCommittingDocs, setIsCommittingDocs] = useState(false);
  const [isCreatingDraftPr, setIsCreatingDraftPr] = useState(false);

  // #41 - Contexto de repo activo para opiniones de chat fundamentadas
  const [repoContext, setRepoContext] = useState<RepoContext | null>(null);

  // #28 - Archivo local adjunto como contexto del chat
  const [fileContext, setFileContext] = useState<FileContext | null>(null);

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

  // ── Send message to AI (Opción D - con detección de modo) ──────────────────
  const handleSend = useCallback(async () => {
    // 🔥 ZERO-STORAGE: provider, apiKey y model vienen del contexto
    if (!inputValue.trim() || !token || !user || !provider || !apiKey || !model) return;
    const userText = inputValue.trim();
    setInputValue('');
    await runSend(
      { token, user, providerName, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading, setConversationHistory, setPendingAction },
      { provider, apiKey, model },
      { userText, conversationHistory, modeOverride, repoContext, fileContext, multiRepoEnabled, selectedRepos },
    );
  }, [inputValue, token, user, provider, apiKey, model, providerName, conversationHistory, multiRepoEnabled, selectedRepos, modeOverride, repoContext, fileContext, addMessage, updateMessage, addEntry, updateEntry]);

  // ── Confirm action ─────────────────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (!pendingAction || !token || !user) return;
    const pa = pendingAction;
    setPendingAction(null);
    setIsExecuting(true);
    try {
      await runConfirmAction(
        { token, user, providerName, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
        pa,
      );
    } finally {
      setIsExecuting(false);
    }
  }, [pendingAction, token, user, providerName, addMessage, updateMessage, addEntry, updateEntry]);

  // ── Cancel action ──────────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    if (pendingAction) {
      runCancelAction(
        { token: token ?? '', user: user ?? { login: '' }, providerName, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
        pendingAction,
      );
    }
    setPendingAction(null);
  }, [pendingAction, token, user, providerName, addMessage, updateMessage, addEntry, updateEntry]);

  // ── #41: Cargar repo como contexto activo del chat ─────────────────────────
  const handleLoadRepoContext = useCallback(async (repoInput: string) => {
    if (!token || !user) return;
    const ctx = await runLoadRepoContext(
      { token, user, providerName, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      repoInput,
    );
    if (ctx) setRepoContext(ctx);
  }, [token, user, providerName, addMessage, updateMessage, addEntry, updateEntry]);

  const handleClearRepoContext = useCallback(() => {
    setRepoContext(null);
    addMessage({
      role: 'assistant',
      content: '🧹 Contexto del repositorio descartado. Volveré a opinar sin contexto específico.',
    });
  }, [addMessage]);

  // ── #28: Adjuntar archivo local como contexto ───────────────────────────────
  const handleAttachFile = useCallback(async (file: File) => {
    if (!token || !user) return;
    const ctx = await runAttachFile(
      { token, user, providerName, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      file,
    );
    if (ctx) setFileContext(ctx);
  }, [token, user, providerName, addMessage, updateMessage, addEntry, updateEntry]);

  const handleClearFile = useCallback(() => {
    setFileContext(null);
    addMessage({ role: 'assistant', content: '🧹 Archivo adjunto descartado.' });
  }, [addMessage]);

  // ── Document repo ──────────────────────────────────────────────────────────
  const handleDocumentRepo = useCallback(async (repoInput: string) => {
    // 🔥 ZERO-STORAGE: provider, apiKey y model vienen del contexto
    if (!token || !user || !provider || !apiKey || !model) return;
    const analysis = await runDocumentRepo(
      { token, user, providerName, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      { provider, apiKey, model },
      repoInput,
    );
    if (analysis) setDocAnalysis(analysis);
  }, [token, user, provider, apiKey, model, providerName, addMessage, updateMessage, addEntry, updateEntry]);

  // ── Resumir hilo (#32) ───────────────────────────────────────────────────────
  const handleSummarizeThread = useCallback(async (input: string) => {
    // 🔥 ZERO-STORAGE: provider, apiKey y model vienen del contexto
    if (!token || !user || !provider || !apiKey || !model) return;
    await runSummarizeThread(
      { token, user, providerName, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
      { provider, apiKey, model },
      input,
      repoContext?.repoName ?? null,
    );
  }, [token, user, provider, apiKey, model, providerName, repoContext, addMessage, updateMessage, addEntry, updateEntry]);

  // ── Commit docs (commit directo a la rama por defecto) ───────────────────────
  const handleCommitDocs = useCallback(async () => {
    if (!docAnalysis || !token || !user) return;
    setIsCommittingDocs(true);
    try {
      await runCommitDocs(
        { token, user, providerName, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
        docAnalysis,
      );
    } finally {
      setIsCommittingDocs(false);
      setDocAnalysis(null);
    }
  }, [docAnalysis, token, user, providerName, addMessage, updateMessage, addEntry, updateEntry]);

  // ── Crear Draft PR con la documentación (#45) ────────────────────────────────
  const handleCreateDraftPr = useCallback(async () => {
    if (!docAnalysis || !token || !user) return;
    setIsCreatingDraftPr(true);
    try {
      await runCreateDraftPr(
        { token, user, providerName, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading },
        docAnalysis,
      );
    } finally {
      setIsCreatingDraftPr(false);
      setDocAnalysis(null);
    }
  }, [docAnalysis, token, user, providerName, addMessage, updateMessage, addEntry, updateEntry]);

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
            isLoading={isChatLoading}
            disabled={!isAuthenticated}
            multiRepoEnabled={multiRepoEnabled}
            onMultiRepoChange={setMultiRepoEnabled}
            selectedRepos={selectedRepos}
            onSelectedReposChange={setSelectedRepos}
            onDocumentRepo={handleDocumentRepo}
            onSummarizeThread={handleSummarizeThread}
            repoContextName={repoContext?.repoName ?? null}
            onLoadRepoContext={handleLoadRepoContext}
            onClearRepoContext={handleClearRepoContext}
            fileContextName={fileContext?.name ?? null}
            onAttachFile={handleAttachFile}
            onClearFile={handleClearFile}
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

      {/* Documentation modal */}
      {docAnalysis && (
        <DocModal
          analysis={docAnalysis}
          onConfirm={handleCommitDocs}
          onCreateDraftPr={handleCreateDraftPr}
          onCancel={() => setDocAnalysis(null)}
          isCommitting={isCommittingDocs}
          isCreatingDraftPr={isCreatingDraftPr}
        />
      )}
    </>
  );
}
