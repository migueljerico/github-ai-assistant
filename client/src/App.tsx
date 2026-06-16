import { useCallback, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useAIProvider } from './context/AIProviderContext';
import { useChat } from './hooks/useChat';
import { useActions } from './hooks/useActions';
import { callAI, parseGeminiAction, generateRepoDocs, CHAT_PROMPT, ACTION_PROMPT } from './services/gemini';
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

// ── Detect conversation requests (opiniones, análisis, consejos) ────────────
function isConversationRequest(message: string): boolean {
  const keywords = [
    'opinión', 'opinion', 'qué opinas', 'que opinas', 'piensas',
    'consejo', 'recomendación', 'recomendacion', 'recomiendas',
    'crítica', 'critica', 'constructiva', 'constructivo', 'feedback',
    'mejora', 'mejorar', 'propón', 'propon', 'propuesta', 'sugerencia',
    'analiza', 'análisis', 'analisis', 'evalúa', 'evalua', 'valoración',
    'qué te parece', 'que te parece', 'cómo puedo', 'como puedo',
    'debería', 'deberia', 'es buena', 'es malo', 'es mejor',
    'ventajas', 'desventajas', 'pros', 'contras',
    'explícame', 'explicame', 'qué es', 'que es', 'cómo funciona',
    'ayuda', 'help', 'guía', 'guia', 'tutorial',
    'documentación', 'documentacion', 'información', 'informacion'
  ];
  
  const lower = message.toLowerCase();
  return keywords.some(keyword => lower.includes(keyword));
}

// ── Detect action requests (verbos de acción explícitos) ─────────────────────
function isActionRequest(message: string): boolean {
  const keywords = [
    'lista', 'muéstrame', 'muestra', 'enséñame', 'enseñame', 'ver',
    'lee', 'leer', 'abre', 'abrir', 'carga', 'cargar',
    'crea', 'crear', 'genera', 'generar', 'haz', 'hacer',
    'actualiza', 'actualizar', 'modifica', 'modificar', 'edita', 'editar',
    'borra', 'borrar', 'elimina', 'eliminar', 'quita', 'quitar',
    'cierra', 'cerrar', 'reabre', 'reabrir',
    'fusiona', 'merge', 'une', 'unir',
    'comenta', 'comentar', 'responde', 'responder',
    'ejecuta', 'ejecutar', 'rerun', 'corre', 'correr',
    'sube', 'subir', 'publica', 'publicar',
    'descarga', 'descargar', 'clona', 'clonar'
  ];
  
  const lower = message.toLowerCase();
  return keywords.some(keyword => lower.includes(keyword));
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { token, user, isAuthenticated } = useAuth();
  const { provider, apiKey, model } = useAIProvider();
  const providerName = provider === 'groq' ? 'Groq Cloud' : 'Google Gemini';

  // Custom hooks
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

  // 🔥 OPCIÓN D - MODO MANUAL: 'auto' | 'chat' | 'action'
  const [modeOverride, setModeOverride] = useState<'auto' | 'chat' | 'action'>('auto');

  // ── Send message to AI ────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || !token || !user || !provider || !apiKey || !model) return;

    const userText = inputValue.trim();
    setInputValue('');
    setIsChatLoading(true);

    addMessage({ role: 'user', content: userText });
    const loadingId = addMessage({ role: 'assistant', content: '', isLoading: true });

    const newHistory = [...conversationHistory, { role: 'user' as const, content: userText }];

    // 🔥 OPCIÓN D - DETECCIÓN DE MODO
    const isConversation = isConversationRequest(userText);
    const isAction = isActionRequest(userText);
    
    // Determinar modo final (manual override o automático)
    let finalMode: 'chat' | 'action';
    if (modeOverride === 'auto') {
      finalMode = isConversation && !isAction ? 'chat' : 'action';
    } else {
      finalMode = modeOverride;
    }

    // 🔥 OPCIÓN D - SELECCIONAR SYSTEM PROMPT SEGÚN MODO
    const systemPrompt = finalMode === 'chat' ? CHAT_PROMPT : ACTION_PROMPT;

    // 🔥 DEBUG: Log en consola para verificar detección
    console.log(`[Opción D] Modo detectado: ${finalMode} | Override: ${modeOverride} | Conv: ${isConversation} | Action: ${isAction}`);

    try {
      // 🔥 CRÍTICO: Pasar finalMode como sexto parámetro a callAI
      const rawResponse = await callAI(
        provider, 
        apiKey, 
        model, 
        newHistory, 
        systemPrompt,
        finalMode  // ← ESTO ES LO NUEVO - Propaga el modo al backend
      );

      // 🔥 MODO CHAT: Forzar respuesta en texto, bloquear JSON
      if (finalMode === 'chat') {
        const action = parseGeminiAction(rawResponse);
        
        if (action) {
          // La IA generó JSON en modo chat - EXTRAER TEXTO Y NO EJECUTAR
          let textResponse = rawResponse;
          
          if (action.accion && action.accion.length > 100) {
            textResponse = action.accion;
          } else if (action.endpoint) {
            textResponse = `💡 **Análisis detectado**: ${action.accion}\n\n${rawResponse}`;
          }
          
          updateMessage(loadingId, { 
            content: textResponse, 
            isLoading: false 
          });
          addToHistory('assistant', textResponse);
        } else {
          // Perfecto - respuesta en Markdown
          updateMessage(loadingId, { content: rawResponse, isLoading: false });
          addToHistory('assistant', rawResponse);
        }
        setIsChatLoading(false);
        return; // ⛔ NO EJECUTAR NADA EN MODO CHAT
      }

      // 🔥 MODO ACCIÓN: Procesar JSON normalmente
      const action = parseGeminiAction(rawResponse);

      if (!action) {
        // Respuesta en texto (Markdown) en modo acción
        updateMessage(loadingId, { content: rawResponse, isLoading: false });
        addToHistory('assistant', rawResponse);
        setIsChatLoading(false);
        return;
      }

      // Enriquecer acción con contenido actual si es PUT
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
          // Archivo no existe - es creación
        }
      }

      updateMessage(loadingId, { content: enrichedAction.accion, isLoading: false, action: enrichedAction });
      addToHistory('assistant', rawResponse);

      if (enrichedAction.requiereConfirmacion) {
        const repos = multiRepoEnabled && selectedRepos.length > 0 ? selectedRepos : [];
        setPendingAction({ action: enrichedAction, targetRepos: repos });
      } else {
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
        content: `❌ Error: ${(err as Error).message}`,
        isLoading: false,
      });
    } finally {
      setIsChatLoading(false);
    }
  }, [inputValue, token, user, provider, apiKey, model, conversationHistory, multiRepoEnabled, selectedRepos, modeOverride, addMessage, updateMessage, setInputValue, setIsChatLoading, addToHistory, setPendingAction, logAction, updateActionLog]);

  // ── Confirm action ──────────────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (!pendingAction || !token || !user) return;
    setIsExecuting(true);

    const { action, targetRepos } = pendingAction;
    clearPendingAction();

    if (targetRepos.length > 1) {
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
      const analysis = await generateRepoDocs(provider, apiKey, model, repoName, tree);
      setDocAnalysis(analysis);
    } catch (err) {
      addMessage({
        role: 'assistant',
        content: `❌ Error: ${(err as Error).message}`,
      });
    } finally {
      setIsExecuting(false);
    }
  }, [token, user, provider, apiKey, model, addMessage, setIsExecuting]);

  const handleCommitDocs = useCallback(async (repoName: string) => {
    if (!token || !user || !docAnalysis) return;
    setIsCommittingDocs(true);

    try {
      const [owner, repo] = repoName.includes('/') ? repoName.split('/') : [user.login, repoName];
      await createOrUpdateFile(token, owner, repo, 'TECHNICAL_DOCS.md', docAnalysis.manualTecnico || docAnalysis.readme || '');
      addMessage({
        role: 'assistant',
        content: `✅ Documentación creada en ${repoName}/TECHNICAL_DOCS.md`,
      });
      setDocAnalysis(null);
    } catch (err) {
      addMessage({
        role: 'assistant',
        content: `❌ Error: ${(err as Error).message}`,
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
            modeOverride={modeOverride}
            onModeOverrideChange={setModeOverride}
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
