import { useCallback, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useAIProvider } from './context/AIProviderContext';
import { useChat } from './hooks/useChat';
import { useActions } from './hooks/useActions';
import {
  callAI,
  parseGeminiAction,
  generateRepoDocs,
  SYSTEM_PROMPT,
  CONVERSATION_SYSTEM_PROMPT,          // FIX 1: import the new prompt
} from './services/gemini';
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
    'descarga', 'descargar', 'clona', 'clonar',
  ];
  
  const lower = message.toLowerCase();
  return actionKeywords.some(keyword => lower.includes(keyword));
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { token, user, isAuthenticated } = useAuth();
  const { provider, apiKey, model } = useAIProvider();
  const providerName = provider === 'groq' ? 'Groq Cloud' : 'Google Gemini';

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

  const [templatesOpen, setTemplatesOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
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

    const isConversation = isConversationRequest(userText);
    const isAction = isActionRequest(userText);

    try {
      // ─────────────────────────────────────────────────────────────────────
      // FIX 1: CORRECCIÓN DEL ERROR TS2322
      //
      // PROBLEMA ANTERIOR (no compilaba):
      //   enhancedHistory = [
      //     ...newHistory,
      //     { role: 'system' as const, content: '...' }  // ← TS2322
      //   ];
      //   callAI(provider, apiKey, model, enhancedHistory)
      //
      // Por qué fallaba:
      //   - Message.role solo acepta 'user' | 'assistant'
      //   - 'system' no es asignable a ese tipo → error de compilación
      //   - Además, el proxy Gemini envía messages[last] como "current turn",
      //     así que el mensaje 'system' era lo que el modelo recibía, no la
      //     pregunta del usuario (bug de lógica además del de tipos)
      //
      // SOLUCIÓN: pasar CONVERSATION_SYSTEM_PROMPT como 5º argumento de callAI()
      //   que ya tiene ese parámetro, en lugar de inyectarlo en el array.
      // ─────────────────────────────────────────────────────────────────────
      const activeSystemPrompt = (isConversation && !isAction)
        ? CONVERSATION_SYSTEM_PROMPT
        : SYSTEM_PROMPT;

      const rawResponse = await callAI(provider, apiKey, model, newHistory, activeSystemPrompt);

      // ── MODO CONVERSACIÓN ──────────────────────────────────────────────────
      if (isConversation && !isAction) {
        const action = parseGeminiAction(rawResponse);

        if (!action) {
          // ✅ El modelo respondió en Markdown directamente
          updateMessage(loadingId, { content: rawResponse, isLoading: false });
          addToHistory('assistant', rawResponse);
          return;
        }

        // El modelo generó JSON a pesar del prompt conversacional.
        // Solución pragmática: si es GET (lectura segura), ejecutar y pedir opinión.
        if (action.metodo === 'GET') {
          try {
            const histId = logAction('pending', action.accion, action.repo);
            const result = await executeAction(token, user, action);
            updateActionLog(histId, result.success ? 'completed' : 'error', result.message);

            if (result.success && result.data) {
              const dataStr = formatResultData(result.data);
              const opinionHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [
                ...newHistory,
                { role: 'assistant', content: `He obtenido los datos:\n\n${dataStr}` },
                { role: 'user', content: `Basándote en estos datos, ${userText}. Da tu análisis experto en Markdown.` },
              ];
              const opinionResponse = await callAI(
                provider, apiKey, model,
                opinionHistory,
                CONVERSATION_SYSTEM_PROMPT,
              );
              const finalText = parseGeminiAction(opinionResponse)
                ? `**Resultado:**\n\n${dataStr}`
                : opinionResponse;
              updateMessage(loadingId, { content: finalText, isLoading: false });
              addToHistory('assistant', finalText);
            } else {
              updateMessage(loadingId, {
                content: `No pude obtener los datos: ${result.message}`,
                isLoading: false,
              });
            }
          } catch (execErr) {
            updateMessage(loadingId, {
              content: `❌ Error al obtener datos: ${(execErr as Error).message}`,
              isLoading: false,
            });
          }
          return;
        }

        // El modelo quiere escritura en modo conversación → bloquear
        const blockedMsg = `Como me pediste una opinión, no ejecutaré acciones de escritura. Si quieres que **${action.accion}**, dímelo directamente.`;
        updateMessage(loadingId, { content: blockedMsg, isLoading: false });
        addToHistory('assistant', blockedMsg);
        return;
      }

      // ── MODO ACCIÓN (flujo normal) ─────────────────────────────────────────
      const action = parseGeminiAction(rawResponse);

      if (!action) {
        updateMessage(loadingId, { content: rawResponse, isLoading: false });
        addToHistory('assistant', rawResponse);
        return;
      }

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
    if (!token || !user || !provider || !apiKey || !model) return;
    setIsExecuting(true);

    try {
      const [owner, repo] = repoName.includes('/') ? repoName.split('/') : [user.login, repoName];
      const treeResult = await fetchRepoTreeRecursive(token, owner, repo);

      // ─────────────────────────────────────────────────────────────────────
      // FIX 2: CORRECCIÓN DEL ERROR TS2554
      //
      // PROBLEMA ANTERIOR (no compilaba):
      //   generateRepoDocs(token, owner, repo, tree)
      //
      // Por qué fallaba:
      //   - Firma real: generateRepoDocs(provider, apiKey, model, repoName, files[])
      //   - Solo se pasaban 4 argumentos en vez de 5 → TS2554
      //   - token(string) no es asignable a provider(AIProviderType) → TS2345
      //   - tree(FetchTreeResult) no es string → TS2345
      //
      // SOLUCIÓN: pasar los 5 argumentos correctos con sus tipos correctos.
      // ─────────────────────────────────────────────────────────────────────
      const analysis = await generateRepoDocs(
        provider,                    // AIProviderType ✅
        apiKey,                      // string ✅
        model,                       // string ✅
        `${owner}/${repo}`,          // repoName string ✅
        treeResult.files,            // RepoFile[] ✅ (FetchTreeResult.files is compatible)
      );
      setDocAnalysis(analysis);
    } catch (err) {
      addMessage({
        role: 'assistant',
        content: `❌ Error al analizar repositorio: ${(err as Error).message}`,
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
