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

// ── Detect opinion/analysis/conversation requests ───────────────────────────
function isConversationRequest(message: string): boolean {
  const conversationKeywords = [
    // Opiniones y análisis
    'opinión', 'opinion', 'qué opinas', 'que opinas', 'piensas', 'piensas que',
    'consejo', 'recomendación', 'recomendacion', 'recomiendas',
    'crítica', 'critica', 'constructiva', 'constructivo', 'feedback',
    'mejora', 'mejorar', 'propón', 'propon', 'propuesta', 'sugerencia',
    'analiza', 'análisis', 'analisis', 'evalúa', 'evalua', 'valoración',
    // Preguntas
    'qué te parece', 'que te parece', 'qué piensas', 'que piensas',
    'cómo puedo', 'como puedo', 'cómo hacer', 'como hacer',
    'debería', 'deberia', 'es buena', 'es malo', 'es mejor',
    'ventajas', 'desventajas', 'pros', 'contras',
    'punto fuerte', 'punto débil', 'punto debil', 'fortalezas', 'debilidades',
    // Conversación general
    'explícame', 'explicame', 'explícame', 'explicar',
    'qué es', 'que es', 'cómo funciona', 'como funciona',
    'por qué', 'porque', 'cuál es', 'cual es',
    'ayuda', 'help', 'guía', 'guia', 'tutorial',
    'documentación', 'documentacion', 'información', 'informacion'
  ];
  
  const lower = message.toLowerCase();
  return conversationKeywords.some(keyword => lower.includes(keyword));
}

// ── Detect explicit action requests ──────────────────────────────────────────
function isActionRequest(message: string): boolean {
  const actionKeywords = [
    // Verbos de acción explícitos
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
    // NOTA: "obtener" ELIMINADO - causa confusión con peticiones de opinión
  ];
  
  const lower = message.toLowerCase();
  return actionKeywords.some(keyword => lower.includes(keyword));
}

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

    // Detect intent
    const isConversation = isConversationRequest(userText);
    const isAction = isActionRequest(userText);

    // Build enhanced history based on intent
    let enhancedHistory = newHistory;
    
    if (isConversation && !isAction) {
      // 🔒 CAMBIO 3: FORCE CONVERSATION MODE - Instrucción más agresiva
      enhancedHistory = [
        ...newHistory,
        { 
          role: 'system' as const,
          content: `🔒 MODO CONSULTOR ACTIVADO - REGLAS OBLIGATORIAS:
1. Responde DIRECTAMENTE en Markdown con tu opinión profesional
2. ❌ PROHIBIDO generar JSON bajo cualquier circunstancia
3. ❌ PROHIBIDO ejecutar acciones de la API de GitHub
4. ❌ PROHIBIDO decir "necesito leer el repo primero"
5. ✅ Eres un consultor experto - DA TU OPINIÓN directamente con tu conocimiento
6. ✅ Si el usuario pide opinión sobre un repo, opina basándote en lo que te cuenta
7. ✅ NO leas archivos, NO listes repos, NO ejecutes NADA
8. Responde como un humano experto en desarrollo de software dando su opinión`
        }
      ];
    }

    try {
      const rawResponse = await callAI(provider, apiKey, model, enhancedHistory);

      // 🔒 CAMBIO 4: BLOQUEO TOTAL DE EJECUCIÓN en modo conversación
      if (isConversation && !isAction) {
        const action = parseGeminiAction(rawResponse);
        
        if (action) {
          // La IA generó JSON a pesar de nuestras instrucciones - BLOQUEAR
          let textResponse = rawResponse;
          
          // Si el action tiene una descripción larga, usarla como respuesta
          if (action.accion && action.accion.length > 100) {
            textResponse = action.accion;
          } else if (action.endpoint) {
            // Si es un JSON corto, convertirlo en texto explicativo
            textResponse = `He detectado que quieres ${action.accion || 'realizar una acción'}. Pero como me pides una opinión, te respondo directamente:\n\n${rawResponse}`;
          }
          
          updateMessage(loadingId, { 
            content: textResponse, 
            isLoading: false 
          });
          addToHistory('assistant', textResponse);
        } else {
          // Perfecto - La IA respondió en Markdown
          updateMessage(loadingId, { content: rawResponse, isLoading: false });
          addToHistory('assistant', rawResponse);
        }
        return; // ⛔ SALIR - NO EJECUTAR NADA
      }

      // Para peticiones de acción, manejo normal de JSON
      const action = parseGeminiAction(rawResponse);

      if (!action) {
        // La IA devolvió texto no-JSON — tratar como respuesta normal
        updateMessage(loadingId, { content: rawResponse, isLoading: false });
        addToHistory('assistant', rawResponse);
        return;
      }

      // Para actualizaciones de archivos, obtener contenido actual para diff
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
          // El archivo no existe aún — es una creación
        }
      }

      updateMessage(loadingId, { content: enrichedAction.accion, isLoading: false, action: enrichedAction });
      addToHistory('assistant', rawResponse);

      if (enrichedAction.requiereConfirmacion) {
        // Mostrar modal de confirmación
        const repos = multiRepoEnabled && selectedRepos.length > 0 ? selectedRepos : [];
        setPendingAction({ action: enrichedAction, targetRepos: repos });
      } else {
        // Solo lectura: ejecutar directamente
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
