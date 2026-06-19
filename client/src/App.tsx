import { useState, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { useHistory } from './context/HistoryContext';
import { useAIProvider } from './context/AIProviderContext';
import { callAI, parseGeminiAction, generateRepoDocs, CHAT_PROMPT, ACTION_PROMPT } from './services/gemini';
import { executeAction, executeActionMultiRepo } from './services/actionExecutor';
import { getFileContents, decodeBase64, fetchRepoTreeRecursive, createOrUpdateFile } from './services/github';
import Header from './components/layout/Header';
import HistoryPanel from './components/layout/HistoryPanel';
import TemplatePanel from './components/templates/TemplatePanel';
import ChatArea from './components/chat/ChatArea';
import ChatInput from './components/chat/ChatInput';
import ConfirmModal from './components/confirm/ConfirmModal';
import type { ChatMessage, GeminiAction, GitHubRepo, PendingAction, RepoAnalysis } from './types';

// Generate a simple unique ID
const uid = () => crypto.randomUUID();

// ─ Detect conversation requests (opiniones, análisis, consejos) ─────────────
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

// ── Documentation Modal ────────────────────────────────────────────────────────
function DocModal({
  analysis,
  onConfirm,
  onCancel,
  isCommitting,
}: {
  analysis: RepoAnalysis;
  onConfirm: () => void;
  onCancel: () => void;
  isCommitting: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'readme' | 'manual'>('readme');

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
          <button id="doc-cancel-btn" className="btn btn-danger" onClick={onCancel} disabled={isCommitting}>❌ Cancelar</button>
          <button id="doc-confirm-btn" className="btn btn-success" onClick={onConfirm} disabled={isCommitting}>
            {isCommitting ? <><span className="spinner spinner-sm" /> Haciendo commit...</> : '✅ Hacer commit de ambos archivos'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Smart result formatter ────────────────────────────────────────────────────
// Turns GitHub API responses into readable text rather than raw JSON dumps

interface GitHubRepoItem {
  name: string;
  full_name: string;
  description?: string | null;
  private: boolean;
  html_url: string;
  stargazers_count?: number;
  language?: string | null;
  updated_at?: string;
  fork?: boolean;
}

function formatResultData(data: unknown): string {
  // ── Array of repos ──────────────────────────────────────────────────────────
  if (Array.isArray(data) && data.length > 0 && (data[0] as GitHubRepoItem)?.full_name) {
    const repos = data as GitHubRepoItem[];
    const lines: string[] = [];
    for (const r of repos) {
      const visibility = r.private ? ' Privado' : '🌐 Público';
      const stars = r.stargazers_count ? ` ⭐ ${r.stargazers_count}` : '';
      const lang = r.language ? ` · ${r.language}` : '';
      const fork = r.fork ? ' · 🍴 Fork' : '';
      const desc = r.description ? `\n   ${r.description}` : '';
      const updated = r.updated_at
        ? ` · actualizado ${new Date(r.updated_at).toLocaleDateString('es-ES')}`
        : '';
      lines.push(`**${r.name}** — ${visibility}${stars}${lang}${fork}${updated}${desc}`);
    }
    return lines.join('\n\n');
  }

  // ─ Empty array ─────────────────────────────────────────────────────────────
  if (Array.isArray(data) && data.length === 0) {
    return '_No se encontraron resultados._';
  }

  // ── Single repo object ──────────────────────────────────────────────────────
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const r = data as Record<string, unknown>;
    if (r.full_name && r.html_url) {
      const repo = r as unknown as GitHubRepoItem;
      const lines = [
        ` **${repo.full_name}** — ${repo.private ? '🔒 Privado' : ' Público'}`,
        repo.description ? `> ${repo.description}` : '',
        `🔗 ${repo.html_url}`,
        repo.language ? ` Lenguaje: ${repo.language}` : '',
        repo.stargazers_count !== undefined ? `⭐ Estrellas: ${repo.stargazers_count}` : '',
      ].filter(Boolean);
      return lines.join('\n');
    }

    // ── File content (GitHub contents API) ───────────────────────────────────
    if (typeof r.content === 'string' && r.encoding === 'base64') {
      return '_Contenido del archivo obtenido. Usa la información en tu siguiente instrucción._';
    }

    // ── Generic object: compact key-value ───────────────────────────────────
    const entries = Object.entries(r)
      .filter(([, v]) => typeof v !== 'object' && v !== null && v !== '')
      .slice(0, 12)
      .map(([k, v]) => `**${k}**: ${String(v)}`);
    if (entries.length > 0) return entries.join('\n');
  }

  // ── Plain string ────────────────────────────────────────────────────────────
  if (typeof data === 'string') {
    const trimmed = data.slice(0, 1500);
    return `\`\`\`\n${trimmed}${data.length > 1500 ? '\n...' : ''}\n\`\`\``;
  }

  // ── Fallback: compact JSON (capped) ─────────────────────────────────────────
  const json = JSON.stringify(data, null, 2);
  const capped = json.slice(0, 1200);
  return `\`\`\`json\n${capped}${json.length > 1200 ? '\n...' : ''}\n\`\`\``;
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const { token, user, isAuthenticated } = useAuth();
  const { addEntry, updateEntry } = useHistory();
  // 🔥 ZERO-STORAGE: Extraemos provider, apiKey Y model del contexto (no de sessionStorage)
  const { provider, apiKey, model } = useAIProvider();
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

  // 🔥 OPCIÓN D - Modo override: 'auto' | 'chat' | 'action'
  const [modeOverride, setModeOverride] = useState<'auto' | 'chat' | 'action'>('auto');

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
    const isConversation = isConversationRequest(userText);
    const isAction = isActionRequest(userText);
    
    // Determinar modo final (manual override o automático)
    let finalMode: 'chat' | 'action';
    if (modeOverride === 'auto') {
      // Auto: si parece conversación Y no parece acción → chat, sino → action
      finalMode = isConversation && !isAction ? 'chat' : 'action';
    } else {
      finalMode = modeOverride;
    }

    // 🔥 OPCIÓN D - SELECCIONAR SYSTEM PROMPT SEGÚN MODO
    const systemPrompt = finalMode === 'chat' ? CHAT_PROMPT : ACTION_PROMPT;

    // 🔥 DEBUG: Log en consola para verificar detección
    console.log(`[Opción D] Modo: ${finalMode} | Override: ${modeOverride} | Conv: ${isConversation} | Action: ${isAction}`);

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
  }, [inputValue, token, user, provider, apiKey, model, conversationHistory, multiRepoEnabled, selectedRepos, modeOverride, addMessage, updateMessage, addEntry, updateEntry]);

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

  // ── Commit docs ────────────────────────────────────────────────────────────
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
