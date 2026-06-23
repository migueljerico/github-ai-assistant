import { useState, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { useHistory } from './context/HistoryContext';
import { useAIProvider } from './context/AIProviderContext';
import { getProvider } from './services/providers';
import { resolveMode } from './utils/modeDetection';
import { callAI, parseGeminiAction, CHAT_PROMPT, ACTION_PROMPT, chatPromptWithContext } from './services/gemini';
import { executeAction, executeActionMultiRepo } from './services/actionExecutor';
import { getFileContents, decodeBase64 } from './services/github';
import { runDocumentRepo, runLoadRepoContext, runSummarizeThread, runCommitDocs, runCreateDraftPr } from './services/assistantActions';
import type { RepoContext } from './services/assistantActions';
import { formatResultData } from './utils/formatResult';
import { resolveRepoRef } from './utils/repoRef';
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
    // 🔥 ZERO-STORAGE: Verificar que tenemos provider, apiKey y model del contexto
    if (!inputValue.trim() || !token || !user || !provider || !apiKey || !model) return;

    const userText = inputValue.trim();
    setInputValue('');
    setIsChatLoading(true);

    addMessage({ role: 'user', content: userText });

    // Add loading bubble
    const loadingId = addMessage({ role: 'assistant', content: '', isLoading: true });

    const newHistory = [...conversationHistory, { role: 'user' as const, content: userText }];

    // 🔥 OPCIÓN D - DETECCIÓN DE MODO
    // #41: si hay un repo cargado como contexto, resolveMode sesga a chat (salvo
    // acción explícita), para que la opinión use el contexto sin nombrar el repo.
    const finalMode = resolveMode(userText, modeOverride, repoContext !== null);

    // 🔥 OPCIÓN D - SELECCIONAR SYSTEM PROMPT SEGÚN MODO
    // #41: en modo chat, si hay un repo cargado como contexto, reforzar el prompt
    // con su código real para que la opinión sea específica y no genérica.
    const systemPrompt = finalMode === 'chat'
      ? (repoContext ? chatPromptWithContext(repoContext.contextText) : CHAT_PROMPT)
      : ACTION_PROMPT;

    // 🔥 DEBUG: Log en consola para verificar detección
    console.log(`[Opción D] Modo: ${finalMode} | Override: ${modeOverride} | Contexto: ${repoContext !== null}`);

    try {
      // 🔥 ZERO-STORAGE + OPCIÓN D: Pasar provider, apiKey, model desde el contexto
      const rawResponse = await callAI(newHistory, systemPrompt, provider, apiKey, model, finalMode);

      // 🔥 OPCIÓN D - MODO CHAT: Forzar respuesta en texto, bloquear JSON
      if (finalMode === 'chat') {
        const action = parseGeminiAction(rawResponse);
        
        if (action) {
          // La IA generó JSON en modo chat - EXTRAER TEXTO Y NO EJECUTAR
          let textResponse = rawResponse;
          
          // Intentar extraer algo útil del JSON para mostrar como texto
          if (action.accion && action.accion.length > 50) {
            textResponse = action.accion;
          } else if (action.endpoint) {
            textResponse = `💡 **Análisis detectado**: ${action.accion}\n\nEntiendo que quieres información sobre tu repositorio. Aquí tienes mi opinión como consultor:\n\n${rawResponse}`;
          } else {
            textResponse = rawResponse;
          }
          
          updateMessage(loadingId, { content: textResponse, isLoading: false });
          setConversationHistory([...newHistory, { role: 'assistant', content: textResponse }]);
          setIsChatLoading(false);
          return; // ⛔ NO EJECUTAR NADA EN MODO CHAT
        } else {
          // Perfecto - respuesta en Markdown
          updateMessage(loadingId, { content: rawResponse, isLoading: false });
          setConversationHistory([...newHistory, { role: 'assistant', content: rawResponse }]);
          setIsChatLoading(false);
          return;
        }
      }

      // 🔥 MODO ACCIÓN: Procesar JSON normalmente (comportamiento original)
      const action = parseGeminiAction(rawResponse);

      if (!action) {
        // AI returned non-JSON — treat as plain response
        updateMessage(loadingId, { content: rawResponse, isLoading: false });
        setConversationHistory([...newHistory, { role: 'assistant', content: rawResponse }]);
        setIsChatLoading(false);
        return;
      }

      // For file updates, fetch the current content for diff
      let enrichedAction = action;
      if (action.metodo === 'PUT' && action.repo && action.archivo && !action.contenidoActual) {
        try {
          const { owner, repo } = resolveRepoRef(action.repo, user.login);
          const file = await getFileContents(token, owner, repo, action.archivo);
          if (file.content) {
            enrichedAction = { ...action, contenidoActual: decodeBase64(file.content) };
          }
        } catch {
          // File doesn't exist yet — it's a creation
        }
      }

      updateMessage(loadingId, { content: enrichedAction.accion, isLoading: false, action: enrichedAction });
      setConversationHistory([...newHistory, { role: 'assistant', content: rawResponse }]);

      if (enrichedAction.requiereConfirmacion) {
        // Show confirmation modal
        const repos = multiRepoEnabled && selectedRepos.length > 0 ? selectedRepos : [];
        setPendingAction({ action: enrichedAction, targetRepos: repos });
      } else {
        // Read-only: execute directly
        const histId = addEntry({ status: 'pending', description: enrichedAction.accion, repo: enrichedAction.repo });
        updateEntry(histId, { status: 'pending' });
        const result = await executeAction(token, user, enrichedAction);
        updateEntry(histId, { status: result.success ? 'completed' : 'error', description: result.message });

        if (result.success && result.data) {
          addMessage({
            role: 'assistant',
            content: `✅ ${result.message}\n\n${formatResultData(result.data)}`,
          });
        }
      }
    } catch (err) {
      updateMessage(loadingId, {
        content: ` Error al contactar con el asistente: ${(err as Error).message}`,
        isLoading: false,
      });
    } finally {
      setIsChatLoading(false);
    }
  }, [inputValue, token, user, provider, apiKey, model, conversationHistory, multiRepoEnabled, selectedRepos, modeOverride, repoContext, addMessage, updateMessage, addEntry, updateEntry]);

  // ── Confirm action ─────────────────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (!pendingAction || !token || !user) return;
    setIsExecuting(true);

    const { action, targetRepos } = pendingAction;
    setPendingAction(null);

    if (targetRepos.length > 1) {
      // Multi-repo
      await executeActionMultiRepo(token, user, action, targetRepos, {
        onProgress: (repo, status, message) => {
          addEntry({ status, description: message, repo });
        },
      });
      addMessage({ role: 'assistant', content: `✅ Acción aplicada a ${targetRepos.length} repositorios` });
    } else {
      const histId = addEntry({ status: 'pending', description: action.accion, repo: action.repo });
      const result = await executeAction(token, user, action);
      updateEntry(histId, { status: result.success ? 'completed' : 'error', description: result.message });
      addMessage({
        role: 'assistant',
        content: result.success
          ? `✅ ${result.message}${result.data ? '\n\n' + formatResultData(result.data) : ''}`
          : `❌ ${result.message}`,
      });
    }

    setIsExecuting(false);
  }, [pendingAction, token, user, addEntry, updateEntry, addMessage]);

  // ── Cancel action ──────────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    if (pendingAction) {
      addEntry({ status: 'cancelled', description: `Cancelado: ${pendingAction.action.accion}`, repo: pendingAction.action.repo });
      addMessage({ role: 'assistant', content: '⏸️ Acción cancelada.' });
    }
    setPendingAction(null);
  }, [pendingAction, addEntry, addMessage]);

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
