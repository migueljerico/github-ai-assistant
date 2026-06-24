/**
 * assistantActions — lógica de orquestación del chat, extraída de `App.tsx`
 * (#42) para poder testearla de forma aislada.
 *
 * Cada función recibe un objeto `deps` con los setters/callbacks de React (estado
 * de chat e historial), de modo que NO depende de hooks ni de contexto: se testea
 * pasando mocks y mockeando los servicios. `App.tsx` mantiene su estado y envuelve
 * cada función en un handler fino. Incluye los flujos "de botón" (Fase 2) y el
 * núcleo del chat `runSend`/`runConfirmAction`/`runCancelAction` (Fase 3).
 */

import { generateRepoDocs, generateFileDoc, buildRepoContextSummary, callAI, parseGeminiAction, CHAT_PROMPT, ACTION_PROMPT, chatPromptWithContext } from './gemini';
import type { AIProviderConfig } from './gemini';
import { fetchRepoTreeRecursive, getFileContents, decodeBase64 } from './github';
import { writeDocFiles, createDocsDraftPr, publishFileDoc } from './docPublisher';
import { summarizeThread, parseThreadInput, listOpenThreads, formatThreadList } from './threadSummary';
import { executeAction, executeActionMultiRepo } from './actionExecutor';
import { createGitHubRelease, suggestNextVersion } from '../utils/releaseGenerator';
import { resolveMode } from '../utils/modeDetection';
import { resolveRepoRef } from '../utils/repoRef';
import { readFileContent, formatFileContentForAI, assertSupportedFile } from '../utils/pdfReader';
import { readSpreadsheet, SPREADSHEET_SAMPLE_ROWS } from '../utils/spreadsheetReader';
import { formatResultData } from '../utils/formatResult';
import type { ChatMessage, HistoryEntry, RepoAnalysis, GitHubRepo, PendingAction } from '../types';

/** Contexto de repo activo para opiniones de chat fundamentadas (#41). */
export interface RepoContext {
  repoName: string;
  contextText: string;
  filesAnalyzed: number;
  totalFiles: number;
  truncated: boolean;
}

/** Dependencias inyectadas (estado de chat e historial) que usan las acciones. */
export interface ChatDeps {
  token: string;
  user: { login: string };
  providerName: string;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, update: Partial<ChatMessage>) => void;
  addEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => string;
  updateEntry: (id: string, update: Partial<HistoryEntry>) => void;
  setIsChatLoading: (loading: boolean) => void;
}

/** Deps adicionales que necesita `runSend` (núcleo del chat). */
export interface SendDeps extends ChatDeps {
  setConversationHistory: (history: Array<{ role: 'user' | 'assistant'; content: string }>) => void;
  setPendingAction: (action: PendingAction | null) => void;
}

/** Archivo local adjunto como contexto del chat (#28, Fase 1). */
export interface FileContext {
  name: string;
  contextText: string;
}

/** Parámetros (estado de App) que `runSend` necesita leer en cada envío. */
export interface SendParams {
  userText: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  modeOverride: 'auto' | 'chat' | 'action';
  repoContext: RepoContext | null;
  fileContext: FileContext | null;
  multiRepoEnabled: boolean;
  selectedRepos: GitHubRepo[];
}

/**
 * Documenta un repo entero (README + MANUAL). Devuelve el análisis para que App
 * lo muestre en el DocModal, o `null` si falló.
 */
export async function runDocumentRepo(
  deps: ChatDeps,
  config: AIProviderConfig,
  repoInput: string,
): Promise<RepoAnalysis | null> {
  const { token, user, providerName, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading } = deps;
  const { owner, repo: repoName } = resolveRepoRef(repoInput, user.login);

  setIsChatLoading(true);
  const loadingId = addMessage({
    role: 'assistant',
    content: ` Analizando repositorio **${owner}/${repoName}**...`,
    isLoading: true,
  });
  const histId = addEntry({ status: 'pending', description: `Documentando ${owner}/${repoName}`, repo: `${owner}/${repoName}` });

  try {
    const { files, totalScanned, truncated } = await fetchRepoTreeRecursive(token, owner, repoName);
    updateMessage(loadingId, {
      content: `📄 Analizando ${files.length} archivos de **${owner}/${repoName}**${truncated ? ` (de ${totalScanned} totales)` : ''}... Generando documentación con ${providerName}...`,
      isLoading: true,
    });

    const { readme, manualTecnico } = await generateRepoDocs(`${owner}/${repoName}`, files, config);

    updateMessage(loadingId, {
      content: `✅ Documentación generada para **${owner}/${repoName}**. Revisa el contenido antes de hacer commit.`,
      isLoading: false,
    });
    updateEntry(histId, { status: 'pending', description: `Documentación lista — esperando confirmación` });

    return { readme, manualTecnico, filesAnalyzed: files.length, totalFiles: totalScanned, truncated, repoName: `${owner}/${repoName}` };
  } catch (err) {
    updateMessage(loadingId, { content: `❌ Error al documentar: ${(err as Error).message}`, isLoading: false });
    updateEntry(histId, { status: 'error', description: `Error al documentar ${owner}/${repoName}` });
    return null;
  } finally {
    setIsChatLoading(false);
  }
}

/**
 * Carga un repo como contexto activo del chat (#41). Devuelve el contexto para
 * que App lo guarde en estado, o `null` si falló.
 */
export async function runLoadRepoContext(deps: ChatDeps, repoInput: string): Promise<RepoContext | null> {
  const { token, user, addMessage, updateMessage, setIsChatLoading } = deps;
  const { owner, repo: repoName } = resolveRepoRef(repoInput, user.login);

  setIsChatLoading(true);
  const loadingId = addMessage({
    role: 'assistant',
    content: ` Cargando el contexto de **${owner}/${repoName}**...`,
    isLoading: true,
  });

  try {
    const { files, totalScanned, truncated } = await fetchRepoTreeRecursive(token, owner, repoName);
    const contextText = buildRepoContextSummary(`${owner}/${repoName}`, files);
    updateMessage(loadingId, {
      content:
        `✅ Contexto cargado de **${owner}/${repoName}** ` +
        `(${files.length} archivos${truncated ? ` de ${totalScanned}` : ''}). ` +
        `A partir de ahora mis opiniones en el chat se basarán en tu código real — ` +
        `pregúntame lo que quieras sobre el repositorio.`,
      isLoading: false,
    });
    return { repoName: `${owner}/${repoName}`, contextText, filesAnalyzed: files.length, totalFiles: totalScanned, truncated };
  } catch (err) {
    updateMessage(loadingId, { content: `❌ No pude cargar el contexto de **${owner}/${repoName}**: ${(err as Error).message}`, isLoading: false });
    return null;
  } finally {
    setIsChatLoading(false);
  }
}

/**
 * Resume el hilo de un issue/PR (#32). Si solo se da el repo (sin número), lista
 * los issues/PRs abiertos para que el usuario elija.
 */
export async function runSummarizeThread(
  deps: ChatDeps,
  config: AIProviderConfig,
  input: string,
  repoContextName: string | null,
): Promise<void> {
  const { token, user, providerName, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading } = deps;

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
  if (!repo && repoContextName?.includes('/')) {
    [owner, repo] = repoContextName.split('/', 2);
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

  // Solo repo (sin nº): listar issues/PRs abiertos para elegir.
  if (parsed.number === undefined) {
    const listId = addMessage({ role: 'assistant', content: `🔎 Buscando issues y PRs abiertos en **${owner}/${repo}**...`, isLoading: true });
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
  const loadingId = addMessage({ role: 'assistant', content: `🔎 Resumiendo el hilo **${ref}** con ${providerName}...`, isLoading: true });
  const histId = addEntry({ status: 'pending', description: `Resumiendo hilo ${ref}`, repo: `${owner}/${repo}` });

  try {
    const summary = await summarizeThread(token, owner, repo, parsed.number, config);
    updateMessage(loadingId, { content: `📌 **Resumen del hilo ${ref}**\n\n${summary}`, isLoading: false });
    updateEntry(histId, { status: 'completed', description: `Hilo ${ref} resumido` });
  } catch (err) {
    updateMessage(loadingId, { content: `❌ Error al resumir el hilo ${ref}: ${(err as Error).message}`, isLoading: false });
    updateEntry(histId, { status: 'error', description: `Error al resumir ${ref}` });
  } finally {
    setIsChatLoading(false);
  }
}

/** Commit directo de la documentación generada a la rama por defecto. */
export async function runCommitDocs(deps: ChatDeps, analysis: RepoAnalysis): Promise<void> {
  const { token, user, addMessage, addEntry, updateEntry } = deps;
  const { owner, repo } = resolveRepoRef(analysis.repoName, user.login);
  const histId = addEntry({ status: 'pending', description: `Commiteando documentación en ${analysis.repoName}`, repo: analysis.repoName });

  try {
    await writeDocFiles(token, owner, repo, analysis.readme, analysis.manualTecnico);
    addMessage({ role: 'assistant', content: `✅ README.md y MANUAL_TECNICO.md commiteados en **${analysis.repoName}**` });
    updateEntry(histId, { status: 'completed', description: `Documentación commiteada en ${analysis.repoName}` });
  } catch (err) {
    addMessage({ role: 'assistant', content: `❌ Error al hacer commit: ${(err as Error).message}` });
    updateEntry(histId, { status: 'error', description: `Error al commitear documentación` });
  }
}

/** Crea un Draft PR con la documentación generada (#45). */
export async function runCreateDraftPr(deps: ChatDeps, analysis: RepoAnalysis): Promise<void> {
  const { token, user, addMessage, addEntry, updateEntry } = deps;
  const { owner, repo } = resolveRepoRef(analysis.repoName, user.login);
  const histId = addEntry({ status: 'pending', description: `Creando Draft PR de documentación en ${analysis.repoName}`, repo: analysis.repoName });

  try {
    const { pr, branchName } = await createDocsDraftPr(token, owner, repo, {
      readme: analysis.readme,
      manualTecnico: analysis.manualTecnico,
      filesAnalyzed: analysis.filesAnalyzed,
      repoName: analysis.repoName,
    });
    addMessage({ role: 'assistant', content: `✅ Draft PR [#${pr.number}](${pr.html_url}) creado en **${analysis.repoName}** (rama \`${branchName}\`). Revísalo antes de mergear.` });
    updateEntry(histId, { status: 'completed', description: `Draft PR #${pr.number} creado en ${analysis.repoName}` });
  } catch (err) {
    addMessage({ role: 'assistant', content: `❌ Error al crear Draft PR: ${(err as Error).message}` });
    updateEntry(histId, { status: 'error', description: `Error al crear Draft PR en ${analysis.repoName}` });
  }
}

// ── Núcleo del chat (Fase 3) ────────────────────────────────────────────────────

/**
 * Envía el mensaje del usuario a la IA y procesa la respuesta (Opción D):
 * - Modo chat → muestra texto (bloquea JSON; si la IA devuelve acción, extrae texto).
 * - Modo acción → parsea la acción; si requiere confirmación abre el modal
 *   (`setPendingAction`), si es de solo lectura la ejecuta directa.
 * Porta `handleSend` sin cambiar el comportamiento.
 */
export async function runSend(deps: SendDeps, config: AIProviderConfig, params: SendParams): Promise<void> {
  const { token, user, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading, setConversationHistory, setPendingAction } = deps;
  const { userText, conversationHistory, modeOverride, repoContext, fileContext, multiRepoEnabled, selectedRepos } = params;

  setIsChatLoading(true);
  addMessage({ role: 'user', content: userText });
  const loadingId = addMessage({ role: 'assistant', content: '', isLoading: true });

  const newHistory = [...conversationHistory, { role: 'user' as const, content: userText }];

  // #41/#28: si hay repo y/o archivo como contexto, resolveMode sesga a chat (salvo
  // acción explícita) y se combinan ambos contextos en el prompt.
  const hasContext = repoContext !== null || fileContext !== null;
  const combinedContext = [repoContext?.contextText, fileContext?.contextText]
    .filter(Boolean)
    .join('\n\n');
  const finalMode = resolveMode(userText, modeOverride, hasContext);
  const systemPrompt = finalMode === 'chat'
    ? (combinedContext ? chatPromptWithContext(combinedContext) : CHAT_PROMPT)
    : ACTION_PROMPT;

  console.log(`[Opción D] Modo: ${finalMode} | Override: ${modeOverride} | Contexto: ${hasContext}`);

  // #38: en modo chat (texto Markdown largo) mostramos la respuesta en streaming,
  // token a token. En modo acción la respuesta es JSON → no se streamea (se vería feo).
  const onToken = finalMode === 'chat'
    ? (textSoFar: string) => updateMessage(loadingId, { content: textSoFar, isLoading: true })
    : undefined;

  try {
    const rawResponse = await callAI(newHistory, systemPrompt, config.provider, config.apiKey, config.model, finalMode, onToken);

    // Modo chat: forzar texto, nunca ejecutar.
    if (finalMode === 'chat') {
      const action = parseGeminiAction(rawResponse);
      let textResponse = rawResponse;
      if (action) {
        if (action.accion && action.accion.length > 50) {
          textResponse = action.accion;
        } else if (action.endpoint) {
          textResponse = `💡 **Análisis detectado**: ${action.accion}\n\nEntiendo que quieres información sobre tu repositorio. Aquí tienes mi opinión como consultor:\n\n${rawResponse}`;
        } else {
          textResponse = rawResponse;
        }
      }
      updateMessage(loadingId, { content: textResponse, isLoading: false });
      setConversationHistory([...newHistory, { role: 'assistant', content: textResponse }]);
      setIsChatLoading(false);
      return;
    }

    // Modo acción: procesar JSON.
    const action = parseGeminiAction(rawResponse);
    if (!action) {
      updateMessage(loadingId, { content: rawResponse, isLoading: false });
      setConversationHistory([...newHistory, { role: 'assistant', content: rawResponse }]);
      setIsChatLoading(false);
      return;
    }

    // Para updates de archivo, traer el contenido actual para el diff.
    let enrichedAction = action;
    if (action.metodo === 'PUT' && action.repo && action.archivo && !action.contenidoActual) {
      try {
        const { owner, repo } = resolveRepoRef(action.repo, user.login);
        const file = await getFileContents(token, owner, repo, action.archivo);
        if (file.content) {
          enrichedAction = { ...action, contenidoActual: decodeBase64(file.content) };
        }
      } catch {
        // El archivo no existe aún — es una creación.
      }
    }

    updateMessage(loadingId, { content: enrichedAction.accion, isLoading: false, action: enrichedAction });
    setConversationHistory([...newHistory, { role: 'assistant', content: rawResponse }]);

    if (enrichedAction.requiereConfirmacion) {
      const repos = multiRepoEnabled && selectedRepos.length > 0 ? selectedRepos : [];
      setPendingAction({ action: enrichedAction, targetRepos: repos });
    } else {
      // Solo lectura: ejecutar directamente.
      const histId = addEntry({ status: 'pending', description: enrichedAction.accion, repo: enrichedAction.repo });
      updateEntry(histId, { status: 'pending' });
      const result = await executeAction(token, user, enrichedAction);
      updateEntry(histId, { status: result.success ? 'completed' : 'error', description: result.message });
      if (result.success && result.data) {
        addMessage({ role: 'assistant', content: `✅ ${result.message}\n\n${formatResultData(result.data)}` });
      }
    }
  } catch (err) {
    updateMessage(loadingId, { content: ` Error al contactar con el asistente: ${(err as Error).message}`, isLoading: false });
  } finally {
    setIsChatLoading(false);
  }
}

/**
 * Ejecuta una acción ya confirmada (single o multi-repo) y registra el resultado.
 * Porta el cuerpo de `handleConfirm`; el estado de UI (`setIsExecuting`,
 * `setPendingAction(null)`) lo gestiona el wrapper de App.
 */
export async function runConfirmAction(deps: ChatDeps, pendingAction: PendingAction): Promise<void> {
  const { token, user, addMessage, addEntry, updateEntry } = deps;
  const { action, targetRepos } = pendingAction;

  if (targetRepos.length > 1) {
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
}

/**
 * Registra la cancelación de una acción pendiente (entry 'cancelled' + mensaje).
 * El `setPendingAction(null)` lo hace el wrapper de App.
 */
export function runCancelAction(deps: ChatDeps, pendingAction: PendingAction): void {
  const { addMessage, addEntry } = deps;
  addEntry({ status: 'cancelled', description: `Cancelado: ${pendingAction.action.accion}`, repo: pendingAction.action.repo });
  addMessage({ role: 'assistant', content: '⏸️ Acción cancelada.' });
}

// ── Adjuntar archivo local (#28, Fase 1) ──────────────────────────────────────

/**
 * Adjunta un archivo local como contexto del chat: lee su contenido (PDF vía
 * pdfjs con fallback, o texto/código), lo formatea para la IA y devuelve el
 * contexto. Devuelve `null` + mensaje de error claro si el archivo no es válido
 * o no tiene texto extraíble. Zero-Storage: el contenido vive solo en memoria.
 */
export async function runAttachFile(deps: ChatDeps, file: File): Promise<FileContext | null> {
  const { addMessage, updateMessage, setIsChatLoading } = deps;
  setIsChatLoading(true);
  const loadingId = addMessage({ role: 'assistant', content: ` Leyendo **${file.name}**...`, isLoading: true });
  try {
    assertSupportedFile(file);
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    // #28 Fase 3a — hojas de cálculo: muestra de filas + aviso de tokens (evita 400).
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      const { text, summary, truncated } = await readSpreadsheet(file);
      // El tamaño ya está acotado en readSpreadsheet (muestra de filas + tope por
      // hoja), así que NO reusamos el recorte a 4000 chars de formatFileContentForAI
      // (mutilaría la muestra y haría falso el aviso de "100 filas").
      const contextText = `\n\n--- Datos del archivo adjunto: ${file.name} (hoja de cálculo) ---\n${text}\n--- Fin del archivo ---\n`;
      updateMessage(loadingId, {
        content: truncated
          ? `📎 Cargado **${file.name}** — ${summary}. Es grande, así que analizaré una **muestra de las primeras ${SPREADSHEET_SAMPLE_ROWS} filas**. Si necesitas cálculos sobre el dataset completo, dime qué quieres calcular (sumas, medias, filtros…).`
          : `📎 Adjuntado **${file.name}** — ${summary}. Pregúntame lo que quieras sobre los datos o pídeme que lo documente.`,
        isLoading: false,
      });
      return { name: file.name, contextText };
    }

    const content = await readFileContent(file);
    if (!content.trim()) {
      throw new Error('No pude extraer texto del archivo (¿es un PDF escaneado o una imagen?). Prueba con un PDF de texto o un archivo de texto/código.');
    }
    const contextText = formatFileContentForAI(file.name, content);
    const kb = Math.max(1, Math.round(file.size / 1024));
    updateMessage(loadingId, {
      content: `📎 Adjuntado **${file.name}** (${kb} KB). Pregúntame lo que quieras sobre él o pídeme que lo documente.`,
      isLoading: false,
    });
    return { name: file.name, contextText };
  } catch (err) {
    updateMessage(loadingId, { content: `❌ ${(err as Error).message}`, isLoading: false });
    return null;
  } finally {
    setIsChatLoading(false);
  }
}

// ── Documentar y publicar el archivo adjunto (#28, Fase 2) ────────────────────

/** Genera documentación (Markdown) del archivo adjunto. Devuelve el doc o null. */
export async function runGenerateFileDoc(
  deps: ChatDeps,
  config: AIProviderConfig,
  fileContext: FileContext,
): Promise<string | null> {
  const { providerName, addMessage, updateMessage, setIsChatLoading } = deps;
  setIsChatLoading(true);
  const loadingId = addMessage({ role: 'assistant', content: `📝 Generando documentación de **${fileContext.name}** con ${providerName}...`, isLoading: true });
  try {
    const doc = await generateFileDoc(fileContext.name, fileContext.contextText, config);
    updateMessage(loadingId, { content: `✅ Documentación de **${fileContext.name}** lista. Elige cómo publicarla.`, isLoading: false });
    return doc;
  } catch (err) {
    updateMessage(loadingId, { content: `❌ Error al documentar: ${(err as Error).message}`, isLoading: false });
    return null;
  } finally {
    setIsChatLoading(false);
  }
}

/** Deriva `docs/{base}.md` a partir del nombre del archivo adjunto. */
function docPathFor(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-') || 'archivo';
  return `docs/${base}.md`;
}

/** Publica la documentación generada como fichero (commit directo o Draft PR). */
export async function runPublishFileDoc(
  deps: ChatDeps,
  owner: string,
  repo: string,
  fileName: string,
  doc: string,
  opts: { draft?: boolean },
): Promise<void> {
  const { token, addMessage, addEntry, updateEntry } = deps;
  const path = docPathFor(fileName);
  const histId = addEntry({ status: 'pending', description: `Publicando ${path} en ${owner}/${repo}`, repo: `${owner}/${repo}` });
  try {
    const { pr } = await publishFileDoc(token, owner, repo, path, doc, { draft: opts.draft });
    addMessage({
      role: 'assistant',
      content: pr
        ? `✅ Draft PR [#${pr.number}](${pr.html_url}) con \`${path}\` en **${owner}/${repo}**. Revísalo antes de mergear.`
        : `✅ \`${path}\` commiteado en **${owner}/${repo}**.`,
    });
    updateEntry(histId, { status: 'completed', description: `Documentación publicada en ${owner}/${repo}` });
  } catch (err) {
    addMessage({ role: 'assistant', content: `❌ Error al publicar la documentación: ${(err as Error).message}` });
    updateEntry(histId, { status: 'error', description: `Error al publicar en ${owner}/${repo}` });
  }
}

/** Crea un GitHub Release usando la doc generada como notas. Versión vacía → sugerida. */
export async function runCreateFileRelease(
  deps: ChatDeps,
  owner: string,
  repo: string,
  fileName: string,
  doc: string,
  version?: string,
): Promise<void> {
  const { token, addMessage, addEntry, updateEntry } = deps;
  const histId = addEntry({ status: 'pending', description: `Creando release en ${owner}/${repo}`, repo: `${owner}/${repo}` });
  try {
    const tag = version?.trim() || await suggestNextVersion(token, owner, repo);
    const { url } = await createGitHubRelease(token, owner, repo, {
      version: tag,
      title: `${tag} — ${fileName}`,
      body: doc,
    });
    addMessage({ role: 'assistant', content: `✅ Release [${tag}](${url}) creado en **${owner}/${repo}** con la documentación de ${fileName}.` });
    updateEntry(histId, { status: 'completed', description: `Release ${tag} creado en ${owner}/${repo}` });
  } catch (err) {
    addMessage({ role: 'assistant', content: `❌ Error al crear el release: ${(err as Error).message}` });
    updateEntry(histId, { status: 'error', description: `Error al crear release en ${owner}/${repo}` });
  }
}
