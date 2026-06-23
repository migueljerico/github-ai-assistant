/**
 * assistantActions — lógica de orquestación de los flujos "de botón" del chat,
 * extraída de `App.tsx` (#42, Fase 2) para poder testearla de forma aislada.
 *
 * Cada función recibe un objeto `deps` con los setters/callbacks de React (estado
 * de chat e historial), de modo que NO depende de hooks ni de contexto: se testea
 * pasando mocks y mockeando los servicios. `App.tsx` mantiene su estado y envuelve
 * cada función en un handler fino. NO incluye el núcleo `handleSend`/`handleConfirm`
 * (flujo propón→confirma→ejecuta), que se aborda en la Fase 3.
 */

import { generateRepoDocs, buildRepoContextSummary } from './gemini';
import type { AIProviderConfig } from './gemini';
import { fetchRepoTreeRecursive } from './github';
import { writeDocFiles, createDocsDraftPr } from './docPublisher';
import { summarizeThread, parseThreadInput, listOpenThreads, formatThreadList } from './threadSummary';
import { resolveRepoRef } from '../utils/repoRef';
import type { ChatMessage, HistoryEntry, RepoAnalysis } from '../types';

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
