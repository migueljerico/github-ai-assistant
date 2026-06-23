import { useState, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { useHistory } from './context/HistoryContext';
import { useAIProvider } from './context/AIProviderContext';
import { getProvider } from './services/providers';
import { resolveMode } from './utils/modeDetection';
import { callAI, parseGeminiAction, generateRepoDocs, CHAT_PROMPT, ACTION_PROMPT, buildRepoContextSummary, chatPromptWithContext } from './services/gemini';
import { executeAction, executeActionMultiRepo } from './services/actionExecutor';
import { getFileContents, decodeBase64, fetchRepoTreeRecursive } from './services/github';
import { writeDocFiles, createDocsDraftPr } from './services/docPublisher';
import { summarizeThread, parseThreadInput, listOpenThreads, formatThreadList } from './services/threadSummary';
import { formatResultData } from './utils/formatResult';
import Header from './components/layout/Header';
import HistoryPanel from './components/layout/HistoryPanel';
import TemplatePanel from './components/templates/TemplatePanel';
import ChatArea from './components/chat/ChatArea';
import ChatInput from './components/chat/ChatInput';
import ConfirmModal from './components/confirm/ConfirmModal';
import type { ChatMessage, GitHubRepo, PendingAction, RepoAnalysis } from './types';

// Generate a simple unique ID
const uid = () => crypto.randomUUID();

// ── Documentation Modal ────────────────────────────────────────────────────────
function DocModal({
  analysis,
  onConfirm,
  onCreateDraftPr,
  onCancel,
  isCommitting,
  isCreatingDraftPr,
}: {
  analysis: RepoAnalysis;
  onConfirm: () => void;
  onCreateDraftPr: () => void;
  onCancel: () => void;
  isCommitting: boolean;
  isCreatingDraftPr: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'readme' | 'manual'>('readme');
  const busy = isCommitting || isCreatingDraftPr;

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="modal doc-repo-modal">
        <div className="modal-header">
          <span className="modal-icon"></span>
          <div>
            <div className="modal-title">Documentación generada para {analysis.repoName}</div>
            <div className="modal-subtitle">
              Analicé {analysis.filesAnalyzed} archivo{analysis.filesAnalyzed !== 1 ? 's' : ''}.
              Revisa el contenido antes de hacer commit.
            </div>
          </div>
          <button id="doc-modal-close-btn" className="btn btn-ghost btn-icon" onClick={onCancel} style={{ marginLeft: 'auto' }}>✕</button>
        </div>
        <div className="modal-body">
          {analysis.truncated && (
            <div className="warning-banner">
              ⚠️ Repo muy grande — analizando los primeros {analysis.filesAnalyzed} archivos
            </div>
          )}
          <div className="doc-preview-tabs">
            <button id="doc-tab-readme" className={`doc-preview-tab ${activeTab === 'readme' ? 'active' : ''}`} onClick={() => setActiveTab('readme')}>
              📖 README.md
            </button>
            <button id="doc-tab-manual" className={`doc-preview-tab ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => setActiveTab('manual')}>
              🔧 MANUAL_TECNICO.md
            </button>
          </div>
          <div className="doc-preview-content">
            {activeTab === 'readme' ? analysis.readme : analysis.manualTecnico}
          </div>
        </div>
        <div className="modal-footer">
          <button id="doc-cancel-btn" className="btn btn-danger" onClick={onCancel} disabled={busy}>❌ Cancelar</button>
          <button id="doc-draft-pr-btn" className="btn btn-secondary" onClick={onCreateDraftPr} disabled={busy}>
            {isCreatingDraftPr ? <><span className="spinner spinner-sm" /> Creando Draft PR...</> : '🔀 Crear Draft PR'}
          </button>
          <button id="doc-confirm-btn" className="btn btn-success" onClick={onConfirm} disabled={busy}>
            {isCommitting ? <><span className="spinner spinner-sm" /> Haciendo commit...</> : '✅ Hacer commit directo'}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [repoContext, setRepoContext] = useState<{
    repoName: string;
    contextText: string;
    filesAnalyzed: number;
    totalFiles: number;
    truncated: boolean;
  } | null>(null);

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
          const [owner, repo] = action.repo.includes('/')
            ? action.repo.split('/')
            : [user.login, action.repo];
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

    const [owner, repoName] = repoInput.includes('/')
      ? repoInput.split('/', 2)
      : [user.login, repoInput];

    setIsChatLoading(true);
    const loadingId = addMessage({
      role: 'assistant',
      content: ` Cargando el contexto de **${owner}/${repoName}**...`,
      isLoading: true,
    });

    try {
      const { files, totalScanned, truncated } = await fetchRepoTreeRecursive(token, owner, repoName);
      const contextText = buildRepoContextSummary(`${owner}/${repoName}`, files);
      setRepoContext({
        repoName: `${owner}/${repoName}`,
        contextText,
        filesAnalyzed: files.length,
        totalFiles: totalScanned,
        truncated,
      });
      updateMessage(loadingId, {
        content:
          `✅ Contexto cargado de **${owner}/${repoName}** ` +
          `(${files.length} archivos${truncated ? ` de ${totalScanned}` : ''}). ` +
          `A partir de ahora mis opiniones en el chat se basarán en tu código real — ` +
          `pregúntame lo que quieras sobre el repositorio.`,
        isLoading: false,
      });
    } catch (err) {
      updateMessage(loadingId, {
        content: `❌ No pude cargar el contexto de **${owner}/${repoName}**: ${(err as Error).message}`,
        isLoading: false,
      });
    } finally {
      setIsChatLoading(false);
    }
  }, [token, user, addMessage, updateMessage]);

  const handleClearRepoContext = useCallback(() => {
    setRepoContext(null);
    addMessage({
      role: 'assistant',
      content: '🧹 Contexto del repositorio descartado. Volveré a opinar sin contexto específico.',
    });
  }, [addMessage]);

  // ── Document repo ──────────────────────────────────────────────────────────
  const handleDocumentRepo = useCallback(async (repoInput: string) => {
    // 🔥 ZERO-STORAGE: Verificar que tenemos provider, apiKey y model del contexto
    if (!token || !user || !provider || !apiKey || !model) return;

    const [owner, repoName] = repoInput.includes('/')
      ? repoInput.split('/', 2)
      : [user.login, repoInput];

    setIsChatLoading(true);
    const loadingId = addMessage({
      role: 'assistant',
      content: ` Analizando repositorio **${owner}/${repoName}**...`,
      isLoading: true,
    });
    const histId = addEntry({ status: 'pending', description: `Documentando ${owner}/${repoName}`, repo: `${owner}/${repoName}` });

    try {
      const { files, totalScanned, truncated } = await fetchRepoTreeRecursive(token, owner, repoName);

      // Fix #12: show the active AI provider name instead of hardcoded "Gemini"
      updateMessage(loadingId, {
        content: `📄 Analizando ${files.length} archivos de **${owner}/${repoName}**${truncated ? ` (de ${totalScanned} totales)` : ''}... Generando documentación con ${providerName}...`,
        isLoading: true,
      });

      // 🔥 ZERO-STORAGE: Pasar provider, apiKey, model desde el contexto
      const { readme, manualTecnico } = await generateRepoDocs(
        `${owner}/${repoName}`,
        files,
        { provider, apiKey, model }
      );

      updateMessage(loadingId, {
        content: `✅ Documentación generada para **${owner}/${repoName}**. Revisa el contenido antes de hacer commit.`,
        isLoading: false,
      });

      setDocAnalysis({
        readme,
        manualTecnico,
        filesAnalyzed: files.length,
        totalFiles: totalScanned,
        truncated,
        repoName: `${owner}/${repoName}`,
      });

      updateEntry(histId, { status: 'pending', description: `Documentación lista — esperando confirmación` });
    } catch (err) {
      updateMessage(loadingId, { content: `❌ Error al documentar: ${(err as Error).message}`, isLoading: false });
      updateEntry(histId, { status: 'error', description: `Error al documentar ${owner}/${repoName}` });
    } finally {
      setIsChatLoading(false);
    }
  }, [token, user, provider, apiKey, model, providerName, addMessage, updateMessage, addEntry, updateEntry]);

  // ── Resumir hilo (#32) ───────────────────────────────────────────────────────
  const handleSummarizeThread = useCallback(async (input: string) => {
    // 🔥 ZERO-STORAGE: provider, apiKey y model vienen del contexto
    if (!token || !user || !provider || !apiKey || !model) return;

    const parsed = parseThreadInput(input);
    if (!parsed) {
      addMessage({
        role: 'assistant',
        content: '❌ No entendí la referencia del hilo. Indica un issue/PR como `owner/repo#42`, pega su URL de GitHub, o escribe solo el repo para elegir de una lista.',
      });
      return;
    }

    // Resolver owner/repo: explícito > repo de contexto activo > usuario
    let owner = parsed.owner;
    let repo = parsed.repo;
    if (!repo && repoContext?.repoName?.includes('/')) {
      [owner, repo] = repoContext.repoName.split('/', 2);
    }
    if (repo && !owner) owner = user.login;
    if (!owner || !repo) {
      addMessage({
        role: 'assistant',
        content: '❌ No pude determinar el repositorio. Indícalo como `owner/repo#42` o carga un repo de contexto primero.',
      });
      return;
    }

    setIsChatLoading(true);

    // El usuario dio solo el repo (sin nº de issue/PR): un "hilo" es un issue/PR
    // concreto, así que listamos los abiertos para que elija cuál resumir.
    if (parsed.number === undefined) {
      const listId = addMessage({
        role: 'assistant',
        content: `🔎 Buscando issues y PRs abiertos en **${owner}/${repo}**...`,
        isLoading: true,
      });
      try {
        const threads = await listOpenThreads(token, owner, repo);
        updateMessage(listId, { content: formatThreadList(owner, repo, threads), isLoading: false });
      } catch (err) {
        updateMessage(listId, { content: `❌ No pude listar los hilos de ${owner}/${repo}: ${(err as Error).message}`, isLoading: false });
      } finally {
        setIsChatLoading(false);
      }
      return;
    }

    const ref = `${owner}/${repo}#${parsed.number}`;
    const loadingId = addMessage({
      role: 'assistant',
      content: `🔎 Resumiendo el hilo **${ref}** con ${providerName}...`,
      isLoading: true,
    });
    const histId = addEntry({ status: 'pending', description: `Resumiendo hilo ${ref}`, repo: `${owner}/${repo}` });

    try {
      const summary = await summarizeThread(token, owner, repo, parsed.number, { provider, apiKey, model });
      updateMessage(loadingId, {
        content: `📌 **Resumen del hilo ${ref}**\n\n${summary}`,
        isLoading: false,
      });
      updateEntry(histId, { status: 'completed', description: `Hilo ${ref} resumido` });
    } catch (err) {
      updateMessage(loadingId, { content: `❌ Error al resumir el hilo ${ref}: ${(err as Error).message}`, isLoading: false });
      updateEntry(histId, { status: 'error', description: `Error al resumir ${ref}` });
    } finally {
      setIsChatLoading(false);
    }
  }, [token, user, provider, apiKey, model, providerName, repoContext, addMessage, updateMessage, addEntry, updateEntry]);

  // ── Commit docs (commit directo a la rama por defecto) ───────────────────────
  const handleCommitDocs = useCallback(async () => {
    if (!docAnalysis || !token || !user) return;
    setIsCommittingDocs(true);

    const [owner, repo] = docAnalysis.repoName.split('/');
    const histId = addEntry({ status: 'pending', description: `Commiteando documentación en ${docAnalysis.repoName}`, repo: docAnalysis.repoName });

    try {
      await writeDocFiles(token, owner, repo, docAnalysis.readme, docAnalysis.manualTecnico);
      addMessage({ role: 'assistant', content: `✅ README.md y MANUAL_TECNICO.md commiteados en **${docAnalysis.repoName}**` });
      updateEntry(histId, { status: 'completed', description: `Documentación commiteada en ${docAnalysis.repoName}` });
    } catch (err) {
      addMessage({ role: 'assistant', content: `❌ Error al hacer commit: ${(err as Error).message}` });
      updateEntry(histId, { status: 'error', description: `Error al commitear documentación` });
    } finally {
      setIsCommittingDocs(false);
      setDocAnalysis(null);
    }
  }, [docAnalysis, token, user, addMessage, addEntry, updateEntry]);

  // ── Crear Draft PR con la documentación (#45) ────────────────────────────────
  const handleCreateDraftPr = useCallback(async () => {
    if (!docAnalysis || !token || !user) return;
    setIsCreatingDraftPr(true);

    const [owner, repo] = docAnalysis.repoName.split('/');
    const histId = addEntry({ status: 'pending', description: `Creando Draft PR de documentación en ${docAnalysis.repoName}`, repo: docAnalysis.repoName });

    try {
      const { pr, branchName } = await createDocsDraftPr(token, owner, repo, {
        readme: docAnalysis.readme,
        manualTecnico: docAnalysis.manualTecnico,
        filesAnalyzed: docAnalysis.filesAnalyzed,
        repoName: docAnalysis.repoName,
      });
      addMessage({ role: 'assistant', content: `✅ Draft PR [#${pr.number}](${pr.html_url}) creado en **${docAnalysis.repoName}** (rama \`${branchName}\`). Revísalo antes de mergear.` });
      updateEntry(histId, { status: 'completed', description: `Draft PR #${pr.number} creado en ${docAnalysis.repoName}` });
    } catch (err) {
      addMessage({ role: 'assistant', content: `❌ Error al crear Draft PR: ${(err as Error).message}` });
      updateEntry(histId, { status: 'error', description: `Error al crear Draft PR en ${docAnalysis.repoName}` });
    } finally {
      setIsCreatingDraftPr(false);
      setDocAnalysis(null);
    }
  }, [docAnalysis, token, user, addMessage, addEntry, updateEntry]);

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
