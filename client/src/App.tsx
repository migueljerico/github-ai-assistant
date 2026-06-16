import { useCallback, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useAIProvider } from './context/AIProviderContext';
import { useChat } from './hooks/useChat';
import { useActions } from './hooks/useActions';
import { callAI, parseGeminiAction, generateRepoDocs } from './services/gemini';
import { executeAction, executeActionMultiRepo } from './services/actionExecutor';
import { getFileContents, decodeBase64, fetchRepoTreeRecursive, createOrUpdateFile } from './services/github';
import Header from './components/layout/Header';
import SessionWarningBanner from './components/layout/SessionWarningBanner';
import HistoryPanel from './components/layout/HistoryPanel';
import TemplatePanel from './components/templates/TemplatePanel';
import ChatArea from './components/chat/ChatArea';
import ChatInput from './components/chat/ChatInput';
import ConfirmModal from './components/confirm/ConfirmModal';
import DocModal from './components/confirm/DocModal';
import { formatResultData } from './utils/formatResult';
import type { ChatMessage, GeminiAction, GitHubRepo, RepoAnalysis, RepoFile } from './types';

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { token, user, isAuthenticated } = useAuth();
  const { provider, apiKey, model } = useAIProvider();
  const providerName = provider === 'groq' ? 'Groq Cloud' : 'Google Gemini';

  // Custom hooks for chat and action management
  const {
    messages,
    inputValue,
    isChatLoading,
    conversationHistory,
    addMessage,
    updateMessage,
    setInputValue,
    setIsChatLoading,
    addToHistory,
    clearChat,
  } = useChat();

  const {
    pendingAction,
    isExecuting,
    selectedRepos,
    multiRepoEnabled,
    setPendingAction,
    setIsExecuting,
    setSelectedRepos,
    setMultiRepoEnabled,
    logAction,
    updateActionLog,
    clearPendingAction,
  } = useActions();

  // Sidebar state
  const [templatesOpen, setTemplatesOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);

  // Doc repo state
  const [docAnalysis, setDocAnalysis] = useState<RepoAnalysis | null>(null);
  const [isCommittingDocs, setIsCommittingDocs] = useState(false);

  // ── Send message to AI ────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || !token || !user || !provider || !apiKey || !model) return;

    const userText = inputValue.trim();
    setInputValue('');
    setIsChatLoading(true);

    addMessage({ role: 'user', content: userText });
    const loadingId = addMessage({ role: 'assistant', content: '', isLoading: true });

    const newHistory = [...conversationHistory, { role: 'user' as const, content: userText }];

    try {
      const rawResponse = await callAI(provider, apiKey, model, newHistory);
      const action = parseGeminiAction(rawResponse);

      if (!action) {
        // AI returned non-JSON — treat as plain response (Markdown mode)
        updateMessage(loadingId, { content: rawResponse, isLoading: false });
        addToHistory('assistant', rawResponse);
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
      addToHistory('assistant', rawResponse);

      if (enrichedAction.requiereConfirmacion) {
        // Show confirmation modal
        const repos = multiRepoEnabled && selectedRepos.length > 0 ? selectedRepos : [];
        setPendingAction({ action: enrichedAction, targetRepos: repos });
      } else {
        // Read-only: execute directly
        const histId = logAction('pending', enrichedAction.accion, enrichedAction.repo);
        const result = await executeAction(token, user, enrichedAction);
        updateActionLog(histId, result.success ? 'completed' : 'error', result.message);

        if (result.success && result.data) {
          addMessage({
            role: 'assistant',
            content: `✅ ${result.message}\n\n${formatResultData(result.data)}`,
          });
        }
      }
    } catch (err) {
      updateMessage(loadingId, {
        content: `❌ Error al contactar con el asistente: ${(err as Error).message}`,
        isLoading: false,
      });
    } finally {
      setIsChatLoading(false);
    }
  }, [inputValue, token, user, provider, apiKey, model, conversationHistory, multiRepoEnabled, selectedRepos, addMessage, updateMessage, setInputValue, setIsChatLoading, addToHistory, setPendingAction, logAction, updateActionLog]);

  // ── Confirm action ──────────────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (!pendingAction || !token || !user) return;
    setIsExecuting(true);

    const { action, targetRepos } = pendingAction;
    clearPendingAction();

    if (targetRepos.length > 1) {
      // Multi-repo
      await executeActionMultiRepo(token, user, action, targetRepos, {
        onProgress: (repo, status, message) => {
          logAction(status, message, repo);
        },
      });
      addMessage({ role: 'assistant', content: `✅ Acción aplicada a ${targetRepos.length} repositorios` });
    } else {
      const histId = logAction('pending', action.accion, action.repo);
      const result = await executeAction(token, user, action);
      updateActionLog(histId, result.success ? 'completed' : 'error', result.message);
      addMessage({
        role: 'assistant',
        content: result.success
          ? `✅ ${result.message}${result.data ? '\n\n' + formatResultData(result.data) : ''}`
          : `❌ ${result.message}`,
      });
    }

    setIsExecuting(false);
  }, [pendingAction, token, user, clearPendingAction, addMessage, logAction, updateActionLog, setIsExecuting]);

  // ── Document repo ──────────────────────────────────────────────────────
  const handleDocumentRepo = useCallback(async (repoName: string) => {
    if (!token || !user) return;
    setIsExecuting(true);

    try {
      const [owner, repo] = repoName.includes('/') ? repoName.split('/') : [user.login, repoName];
      const tree = await fetchRepoTreeRecursive(token, owner, repo);
      const analysis = await generateRepoDocs(token, owner, repo, tree);
      setDocAnalysis(analysis);
    } catch (err) {
      addMessage({
        role: 'assistant',
        content: `❌ Error al analizar repositorio: ${(err as Error).message}`,
      });
    } finally {
      setIsExecuting(false);
    }
  }, [token, user, addMessage, setIsExecuting]);

  const handleCommitDocs = useCallback(async (repoName: string) => {
    if (!token || !user || !docAnalysis) return;
    setIsCommittingDocs(true);

    try {
      const [owner, repo] = repoName.includes('/') ? repoName.split('/') : [user.login, repoName];
      await createOrUpdateFile(token, owner, repo, 'TECHNICAL_DOCS.md', docAnalysis.documentation);
      addMessage({
        role: 'assistant',
        content: `✅ Documentación técnica creada en ${repoName}/TECHNICAL_DOCS.md`,
      });
      setDocAnalysis(null);
    } catch (err) {
      addMessage({
        role: 'assistant',
        content: `❌ Error al guardar documentación: ${(err as Error).message}`,
      });
    } finally {
      setIsCommittingDocs(false);
    }
  }, [token, user, docAnalysis, addMessage]);

  return (
    <div className="app-container">
      <Header />
      <SessionWarningBanner />

      <div className="app-main">
        <TemplatePanel isOpen={templatesOpen} onToggle={() => setTemplatesOpen(!templatesOpen)} />

        <div className="app-center">
          <ChatArea messages={messages} isLoading={isChatLoading} />
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
          />
        </div>

        <HistoryPanel isOpen={historyOpen} onToggle={() => setHistoryOpen(!historyOpen)} />
      </div>

      {pendingAction && (
        <ConfirmModal
          action={pendingAction.action}
          isExecuting={isExecuting}
          onConfirm={handleConfirm}
          onCancel={clearPendingAction}
        />
      )}

      {docAnalysis && (
        <DocModal
          analysis={docAnalysis}
          isCommitting={isCommittingDocs}
          onCommit={() => handleCommitDocs(pendingAction?.action.repo || '')}
          onCancel={() => setDocAnalysis(null)}
        />
      )}
    </div>
  );
}
