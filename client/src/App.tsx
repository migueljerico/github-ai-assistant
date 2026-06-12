import { useState, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { useHistory } from './context/HistoryContext';
import { useAIProvider } from './context/AIProviderContext';
import { callAI, parseGeminiAction, generateRepoDocs } from './services/gemini';
import { executeAction, executeActionMultiRepo } from './services/actionExecutor';
import { getFileContents, decodeBase64, fetchRepoTreeRecursive, createOrUpdateFile } from './services/github';
import Header from './components/layout/Header';
import HistoryPanel from './components/layout/HistoryPanel';
import TemplatePanel from './components/templates/TemplatePanel';
import ChatArea from './components/chat/ChatArea';
import ChatInput from './components/chat/ChatInput';
import ConfirmModal from './components/confirm/ConfirmModal';
import DocModal from './components/confirm/DocModal';
import { formatResultData } from './utils/formatResult';
import type { ChatMessage, GeminiAction, GitHubRepo, PendingAction, RepoAnalysis, RepoFile } from './types';

// Use CSPRNG for unique IDs (crypto.randomUUID — UUID v4, guaranteed unique)
const uid = () => crypto.randomUUID();



// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { token, user, isAuthenticated } = useAuth();
  const { addEntry, updateEntry } = useHistory();
  // Fix #12: read active AI provider to show correct name in status messages
  const { provider } = useAIProvider();
  const providerName = provider === 'groq' ? 'Groq Cloud' : 'Google Gemini';

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  // Sidebar state
  const [templatesOpen, setTemplatesOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);

  // Multi-repo state
  const [multiRepoEnabled, setMultiRepoEnabled] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState<GitHubRepo[]>([]);

  // Pending action (confirmation modal)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Doc repo state
  const [docAnalysis, setDocAnalysis] = useState<RepoAnalysis | null>(null);
  const [isCommittingDocs, setIsCommittingDocs] = useState(false);

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>): string => {
    const id = uid();
    setMessages(prev => [...prev, { ...msg, id, timestamp: new Date() }]);
    return id;
  }, []);

  const updateMessage = useCallback((id: string, update: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...update } : m));
  }, []);

  // ── Send message to AI ────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || !token || !user) return;

    const userText = inputValue.trim();
    setInputValue('');
    setIsChatLoading(true);

    addMessage({ role: 'user', content: userText });

    // Add loading bubble
    const loadingId = addMessage({ role: 'assistant', content: '', isLoading: true });

    const newHistory = [...conversationHistory, { role: 'user' as const, content: userText }];

    try {
      const rawResponse = await callAI(newHistory);
      const action = parseGeminiAction(rawResponse);

      if (!action) {
        // AI returned non-JSON — treat as plain response
        updateMessage(loadingId, { content: rawResponse, isLoading: false });
        setConversationHistory([...newHistory, { role: 'assistant', content: rawResponse }]);
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
        content: `❌ Error al contactar con el asistente: ${(err as Error).message}`,
        isLoading: false,
      });
    } finally {
      setIsChatLoading(false);
    }
  }, [inputValue, token, user, conversationHistory, multiRepoEnabled, selectedRepos, addMessage, updateMessage, addEntry, updateEntry]);

  // ── Confirm action ──────────────────────────────────────────────────────
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

  // ── Cancel action ─────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    if (pendingAction) {
      addEntry({ status: 'cancelled', description: `Cancelado: ${pendingAction.action.accion}`, repo: pendingAction.action.repo });
      addMessage({ role: 'assistant', content: '⏸️ Acción cancelada.' });
    }
    setPendingAction(null);
  }, [pendingAction, addEntry, addMessage]);

  // ── Document repo ───────────────────────────────────────────────────────
  const handleDocumentRepo = useCallback(async (repoInput: string) => {
    if (!token || !user) return;

    const [owner, repoName] = repoInput.includes('/')
      ? repoInput.split('/', 2)
      : [user.login, repoInput];

    setIsChatLoading(true);
    const loadingId = addMessage({
      role: 'assistant',
      content: `📄 Analizando repositorio **${owner}/${repoName}**...`,
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

      // Convert github service files to RepoFile format for generateRepoDocs()
      const repoFiles: RepoFile[] = files.map(f => ({
        path: f.path,
        content: f.content,
      }));

      const { readme, manualTecnico } = await generateRepoDocs(repoFiles);

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
  }, [token, user, providerName, addMessage, updateMessage, addEntry, updateEntry]);

  // ── Commit docs ────────────────────────────────────────────────────────
  const handleCommitDocs = useCallback(async () => {
    if (!docAnalysis || !token || !user) return;
    setIsCommittingDocs(true);

    const [owner, repo] = docAnalysis.repoName.split('/');
    const histId = addEntry({ status: 'pending', description: `Commiteando documentación en ${docAnalysis.repoName}`, repo: docAnalysis.repoName });

    try {
      // README.md
      let readmeSha: string | undefined;
      try {
        const existing = await getFileContents(token, owner, repo, 'README.md');
        readmeSha = existing.sha;
      } catch { /* new file */ }
      await createOrUpdateFile(token, owner, repo, 'README.md', docAnalysis.readme, 'docs: generate README via Asistente de IA', readmeSha);

      // MANUAL_TECNICO.md
      let manualSha: string | undefined;
      try {
        const existing = await getFileContents(token, owner, repo, 'MANUAL_TECNICO.md');
        manualSha = existing.sha;
      } catch { /* new file */ }
      await createOrUpdateFile(token, owner, repo, 'MANUAL_TECNICO.md', docAnalysis.manualTecnico, 'docs: generate MANUAL_TECNICO via Asistente de IA', manualSha);

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

  return (
    <>
      <Header
        onToggleTemplates={() => setTemplatesOpen(v => !v)}
        onToggleHistory={() => setHistoryOpen(v => !v)}
        templatesOpen={templatesOpen}
        historyOpen={historyOpen}
      />

      <div className="main-layout">
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
          onCancel={() => setDocAnalysis(null)}
          isCommitting={isCommittingDocs}
        />
      )}
    </>
  );
}
