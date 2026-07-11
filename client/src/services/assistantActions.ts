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

import { generateRepoDocs, generateFileDoc, buildRepoContextSummary, callAI, parseGeminiAction, isAbortError, CHAT_PROMPT, ACTION_PROMPT, chatPromptWithContext, withLangDirective } from './gemini';
import type { Language } from '../context/LanguageContext';
import type { AIProviderConfig } from './gemini';
import { getProvider, modelLabel, type AIProviderType } from './providers';
import { fetchRepoTreeRecursive, getFileContents, decodeBase64, createRepo, repoExists, getRepo, updateRepo, listCommitDates, GitHubAPIError, type RepoTreeFile } from './github';
import { rankFilesByQuery } from '../utils/contextRanker';
import { isContextTooLargeError } from '../utils/retry';
import { languageDistribution, countTechnicalDebt, commitsByWeek, type LanguageSlice, type TechnicalDebt, type CommitWeek } from '../utils/codeHealth';
import { writeDocFiles, createDocsDraftPr, publishFileDoc, uploadFilesToRepo } from './docPublisher';
import { summarizeThread, parseThreadInput, listOpenThreads, formatThreadList } from './threadSummary';
import { generateChangelog } from './changelogGenerator';
import { executeAction, executeActionMultiRepo } from './actionExecutor';
import { createGitHubRelease, suggestNextVersion } from '../utils/releaseGenerator';
import { uploadReleaseAsset, getMimeType } from '../utils/releaseAssets';
import { resolveMode } from '../utils/modeDetection';
import { resolveRepoRef } from '../utils/repoRef';
import { readFileContent, formatFileContentForAI, assertSupportedFile } from '../utils/pdfReader';
import { readSpreadsheet, SPREADSHEET_SAMPLE_ROWS } from '../utils/spreadsheetReader';
import { readPowerBI } from '../utils/powerbiReader';
import { readDocx } from '../utils/docxReader';
import { formatResultData } from '../utils/formatResult';
import type { ChatMessage, HistoryEntry, RepoAnalysis, GitHubRepo, PendingAction } from '../types';

/** Contexto de repo activo para opiniones de chat fundamentadas (#41). */
export interface RepoContext {
  repoName: string;
  contextText: string;
  filesAnalyzed: number;
  totalFiles: number;
  truncated: boolean;
  /** #49: archivos con contenido en memoria, para re-seleccionar por relevancia a cada
   *  pregunta (Zero-Storage: viven solo en estado React). */
  files: RepoTreeFile[];
  /** #49: rutas de TODOS los archivos del repo (árbol completo, sin contenido). */
  allPaths: string[];
}

/** Datos del dashboard "Salud del Código" (#44). */
export interface CodeHealth {
  repoName: string;
  languages: LanguageSlice[];
  debt: TechnicalDebt;
  commits: CommitWeek[];
  filesAnalyzed: number;
  truncated: boolean;
}

/** Presupuesto de contexto (archivos × líneas/archivo) para el resumen de repo. */
export interface ContextBudget {
  maxFiles: number;
  maxLinesPerFile: number;
}

/** Defaults de contexto cuando el proveedor no declara `contextBudget` (#50). */
export const DEFAULT_CONTEXT_BUDGET: ContextBudget = { maxFiles: 12, maxLinesPerFile: 80 };

/**
 * #50: presupuesto de contexto adaptativo al proveedor. Los proveedores con TPM
 * bajo (p. ej. Groq free) declaran un `contextBudget` menor en `providers.ts`;
 * los que no, usan los defaults (12/80). Función pura (testeable).
 */
export function getActiveContextBudget(provider: AIProviderType): ContextBudget {
  return getProvider(provider).contextBudget ?? DEFAULT_CONTEXT_BUDGET;
}

/** Dependencias inyectadas (estado de chat e historial) que usan las acciones. */
export interface ChatDeps {
  token: string;
  user: { login: string };
  providerName: string;
  /** v3.31.0: modelo de IA activo (value, p. ej. "gemini-2.5-flash"). Se usa en
   *  la firma de documentación (buildSignature). */
  model: string | null;
  /** v3.31.0: proveedor activo (id, p. ej. "gemini"). Se usa en la firma. */
  provider: AIProviderType | null;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, update: Partial<ChatMessage>) => void;
  addEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => string;
  updateEntry: (id: string, update: Partial<HistoryEntry>) => void;
  setIsChatLoading: (loading: boolean) => void;
  /** Función de traducción (i18n) inyectada desde el componente vía useLanguage(). */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Idioma activo (i18n) — inyectado para adaptar los system prompts del modelo. */
  lang: Language;
}

/**
 * v3.31.0: construye la firma de documentación localizada (ES/EN) con el usuario
 * autenticado y el proveedor+modelo de IA activos. Se usa en el "about" del repo,
 * en los commit messages, en los PR bodies y en el footer del README. Función pura
 * (testeable). Formato:
 *   ES: "Creado por @{login} y documentado por {Provider} ({model}) desde la App Asistente de IA"
 *   EN: "Created by @{login} and documented by {Provider} ({model}) from the AI Assistant App"
 */
export function buildSignature(
  deps: Pick<ChatDeps, 'user' | 'providerName' | 'model' | 'provider' | 'lang'>,
): string {
  const login = deps.user.login;
  const provider = deps.providerName;
  const model = deps.model && deps.provider
    ? modelLabel(deps.provider, deps.model)
    : (deps.model ?? 'IA');
  if (deps.lang === 'en') {
    return `Created by @${login} and documented by ${provider} (${model}) from the AI Assistant App`;
  }
  return `Creado por @${login} y documentado por ${provider} (${model}) desde la App Asistente de IA`;
}

/** Deps adicionales que necesita `runSend` (núcleo del chat). */
export interface SendDeps extends ChatDeps {
  setConversationHistory: (history: Array<{ role: 'user' | 'assistant'; content: string }>) => void;
  setPendingAction: (action: PendingAction | null) => void;
}

/**
 * Formatea el historial de conversación a texto plano (Usuario/Asistente), para
 * pasarlo como contexto al documentar (#28 v3.7.0). Vacío si no hay historial.
 */
export function formatConversation(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): string {
  return history
    .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
    .join('\n\n');
}

/** Archivo local adjunto como contexto del chat (#28, Fase 1). */
export interface FileContext {
  name: string;
  contextText: string;
  /** El `File` original, para poder subirlo al repo al publicar (#28 Fase 4a). */
  file?: File;
}

/** Parámetros (estado de App) que `runSend` necesita leer en cada envío. */
export interface SendParams {
  userText: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  modeOverride: 'auto' | 'chat' | 'action';
  repoContext: RepoContext | null;
  /** #57 Tanda B: ahora multi-archivo (array, vacío = ninguno). */
  fileContext: FileContext[];
  multiRepoEnabled: boolean;
  selectedRepos: GitHubRepo[];
  /** #40: si se pasa, permite cancelar la generación en curso (botón Detener). */
  signal?: AbortSignal;
}

/**
 * Documenta un repo entero (README + MANUAL). Devuelve el análisis para que App
 * lo muestre en el DocModal, o `null` si falló.
 *
 * Si el repo NO existe y es de la cuenta del usuario, devuelve `'repo-missing'`
 * (señal distinguible) para que App ofrezca crearlo + adjuntar archivos y
 * documentarlo — equiparando el flujo de repo al de archivo (#57 Tanda B).
 */
export async function runDocumentRepo(
  deps: ChatDeps,
  config: AIProviderConfig,
  repoInput: string,
): Promise<RepoAnalysis | null | 'repo-missing'> {
  const { token, user, providerName, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading } = deps;
  const { owner, repo: repoName } = resolveRepoRef(repoInput, user.login);

  setIsChatLoading(true);
  const loadingId = addMessage({
    role: 'assistant',
    content: ` Analizando repositorio **${owner}/${repoName}**...`,
    isLoading: true,
  });
  const histId = addEntry({ status: 'pending', description: deps.t('history.documenting', { repo: `${owner}/${repoName}` }), repo: `${owner}/${repoName}` });

  try {
    // v3.22.3: pre-chequeo amable (antes el 404 crudo "Not Found" subía sin traducir)
    // + uso de la rama por defecto real (no asumir 'main'; repos con otra rama daban 404).
    // Patrón tomado de runCodeHealth (#44), que ya resolvía esto correctamente.
    const meta = await getRepo(token, owner, repoName);
    const { files, totalScanned, truncated, allPaths } = await fetchRepoTreeRecursive(token, owner, repoName, meta.default_branch);
    updateMessage(loadingId, {
      content: `📄 Analizando ${files.length} archivos de **${owner}/${repoName}**${truncated ? ` (de ${totalScanned} totales)` : ''}... Generando documentación con ${providerName}...`,
      isLoading: true,
    });

    const { readme, manualTecnico, resumen } = await generateRepoDocs(`${owner}/${repoName}`, files, config, deps.lang);

    // #57 Tanda B: detectar si el repo ya está documentado (README.md o
    // MANUAL_TECNICO.md en la raíz) para avisar al usuario de que se actualizará.
    // `allPaths` trae el árbol completo de ficheros de texto (puede ser undefined si
    // el fetch truncó); caemos a los paths de `files` cargados en memoria como respaldo.
    const knownPaths = allPaths ?? files.map(f => f.path);
    const alreadyDocumented = knownPaths.some(p => p === 'README.md' || p === 'MANUAL_TECNICO.md');

    updateMessage(loadingId, {
      content: `✅ Documentación generada para **${owner}/${repoName}**. Revisa el contenido antes de hacer commit.`,
      isLoading: false,
    });
    updateEntry(histId, { status: 'pending', description: deps.t('history.docReady') });

    return { readme, manualTecnico, filesAnalyzed: files.length, totalFiles: totalScanned, truncated, repoName: `${owner}/${repoName}`, alreadyDocumented, resumen };
  } catch (err) {
    // v3.22.3: distinguir "repo no encontrado / sin acceso" (404) de otros errores.
    const status = err instanceof GitHubAPIError ? err.status : undefined;
    const isNotFound = status === 404 || /not found/i.test((err as Error).message);
    if (isNotFound) {
      // #57 Tanda B: si el repo no existe y es de la cuenta del usuario, ofrecer crearlo
      // + adjuntar archivos + documentar (igual que ya hace el flujo de archivo).
      // Si es de otra cuenta, no podemos crearlo: mensaje accionable y nada que hacer aquí.
      const isOwnAccount = owner === user.login;
      updateMessage(loadingId, {
        content: isOwnAccount
          ? deps.t('chat.docRepoMissingCreate', { repo: `${owner}/${repoName}` })
          : deps.t('chat.docRepoMissingOther', { repo: `${owner}/${repoName}` }),
        isLoading: false,
      });
      updateEntry(histId, { status: 'error', description: deps.t('history.errorDocumenting', { repo: `${owner}/${repoName}` }) });
      return isOwnAccount ? 'repo-missing' : null;
    }
    updateMessage(loadingId, { content: `❌ Error al documentar: ${(err as Error).message}`, isLoading: false });
    updateEntry(histId, { status: 'error', description: deps.t('history.errorDocumenting', { repo: `${owner}/${repoName}` }) });
    return null;
  } finally {
    setIsChatLoading(false);
  }
}

/**
 * Carga un repo como contexto activo del chat (#41). Devuelve el contexto para
 * que App lo guarde en estado, o `null` si falló.
 */
export async function runLoadRepoContext(deps: ChatDeps, repoInput: string, provider?: AIProviderType): Promise<RepoContext | null> {
  const { token, user, addMessage, updateMessage, setIsChatLoading } = deps;
  const { owner, repo: repoName } = resolveRepoRef(repoInput, user.login);
  // #50: aplicar el presupuesto de contexto del proveedor (Groq = 6/60; resto = 12/80).
  const budget = provider ? getActiveContextBudget(provider) : DEFAULT_CONTEXT_BUDGET;

  setIsChatLoading(true);
  const loadingId = addMessage({
    role: 'assistant',
    content: ` Cargando el contexto de **${owner}/${repoName}**...`,
    isLoading: true,
  });

  try {
    const { files, totalScanned, truncated, allPaths } = await fetchRepoTreeRecursive(token, owner, repoName);
    const safeAllPaths = allPaths ?? files.map(f => f.path);
    // Contexto inicial (sin pregunta aún): árbol completo + primeros archivos por prioridad.
    // En cada turno, runSend lo reconstruye seleccionando los relevantes a la pregunta (#49).
    const contextText = buildRepoContextSummary(`${owner}/${repoName}`, files, { allPaths: safeAllPaths, maxFiles: budget.maxFiles, maxLinesPerFile: budget.maxLinesPerFile });
    updateMessage(loadingId, {
      content:
        `✅ Contexto cargado de **${owner}/${repoName}** ` +
        `(${safeAllPaths.length} archivos${truncated ? ` — analizo el contenido de ${files.length}` : ''}). ` +
        `A partir de ahora mis opiniones en el chat se basarán en tu código real — ` +
        `pregúntame lo que quieras sobre el repositorio.`,
      isLoading: false,
    });
    return { repoName: `${owner}/${repoName}`, contextText, filesAnalyzed: files.length, totalFiles: totalScanned, truncated, files, allPaths: safeAllPaths };
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
      content: deps.t('chat.threadRefNotFound'),
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
      content: deps.t('chat.repoNotFound'),
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
  const histId = addEntry({ status: 'pending', description: deps.t('history.summarizingThread', { ref }), repo: `${owner}/${repo}` });

  try {
    const summary = await summarizeThread(token, owner, repo, parsed.number, config);
    updateMessage(loadingId, { content: `📌 **Resumen del hilo ${ref}**\n\n${summary}`, isLoading: false });
    updateEntry(histId, { status: 'completed', description: deps.t('history.threadSummarized', { ref }) });
  } catch (err) {
    updateMessage(loadingId, { content: `❌ Error al resumir el hilo ${ref}: ${(err as Error).message}`, isLoading: false });
    updateEntry(histId, { status: 'error', description: deps.t('history.errorSummarizing', { ref }) });
  } finally {
    setIsChatLoading(false);
  }
}

/**
 * Genera las notas de release de un repo (#34) y las muestra como burbuja de chat.
 * Enfoque híbrido (agrupar por prefijo + pulir con IA) en `generateChangelog`.
 */
export async function runGenerateChangelog(deps: ChatDeps, config: AIProviderConfig, input: string): Promise<void> {
  const { token, user, providerName, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading } = deps;
  const { owner, repo } = resolveRepoRef(input, user.login);
  if (!repo) {
    addMessage({ role: 'assistant', content: deps.t('chat.repoNeeded') });
    return;
  }

  setIsChatLoading(true);
  const ref = `${owner}/${repo}`;
  const loadingId = addMessage({ role: 'assistant', content: `🔎 Generando el changelog de **${ref}** con ${providerName}...`, isLoading: true });
  const histId = addEntry({ status: 'pending', description: deps.t('history.generatingChangelog', { ref }), repo: ref });

  try {
    const md = await generateChangelog(token, owner, repo, config);
    updateMessage(loadingId, { content: `📋 **Changelog de ${ref}**\n\n${md}`, isLoading: false });
    updateEntry(histId, { status: 'completed', description: deps.t('history.changelogGenerated', { ref }) });
  } catch (err) {
    updateMessage(loadingId, { content: `❌ ${(err as Error).message}`, isLoading: false });
    updateEntry(histId, { status: 'error', description: deps.t('history.errorChangelog', { ref }) });
  } finally {
    setIsChatLoading(false);
  }
}

/**
 * Salud del código (#44): reúne distribución de lenguajes, frecuencia de commits y
 * deuda técnica de un repo. Devuelve el objeto para que App abra el modal, o `null`
 * si falló. Reutiliza fetchRepoTreeRecursive (árbol + contenidos) y listCommitDates.
 */
export async function runCodeHealth(deps: ChatDeps, repoInput: string): Promise<CodeHealth | null> {
  const { token, user, addMessage, updateMessage, addEntry, updateEntry, setIsChatLoading } = deps;
  const { owner, repo } = resolveRepoRef(repoInput, user.login);
  if (!repo) {
    addMessage({ role: 'assistant', content: deps.t('chat.repoNeeded') });
    return null;
  }

  setIsChatLoading(true);
  const ref = `${owner}/${repo}`;
  const loadingId = addMessage({ role: 'assistant', content: `📊 Analizando la salud de **${ref}**...`, isLoading: true });
  const histId = addEntry({ status: 'pending', description: deps.t('history.codeHealthOf', { ref }), repo: ref });

  try {
    const meta = await getRepo(token, owner, repo);
    const [tree, dates] = await Promise.all([
      fetchRepoTreeRecursive(token, owner, repo, meta.default_branch),
      listCommitDates(token, owner, repo),
    ]);

    const health: CodeHealth = {
      repoName: ref,
      languages: languageDistribution(tree.allPaths ?? tree.files.map(f => f.path)),
      debt: countTechnicalDebt(tree.files),
      commits: commitsByWeek(dates),
      filesAnalyzed: tree.files.length,
      truncated: tree.truncated,
    };

    updateMessage(loadingId, { content: `📊 Salud del código de **${ref}** lista — revisa el panel.`, isLoading: false });
    updateEntry(histId, { status: 'completed', description: deps.t('history.codeHealthOf', { ref }) });
    return health;
  } catch (err) {
    updateMessage(loadingId, { content: `❌ ${(err as Error).message}`, isLoading: false });
    updateEntry(histId, { status: 'error', description: deps.t('history.errorCodeHealth', { ref }) });
    return null;
  } finally {
    setIsChatLoading(false);
  }
}

/**
 * v3.31.0: fija el "about" (descripción) del repo tras publicar la documentación.
 * Compone "resumen IA — firma" y hace PATCH `/repos/...`. Es secundario: si falla
 * (sin permiso de admin, rate limit…) NO rompe la publicación, solo lo avisa.
 */
async function updateRepoAbout(
  deps: ChatDeps,
  owner: string,
  repo: string,
  analysis: RepoAnalysis,
): Promise<void> {
  const signature = buildSignature(deps);
  const description = analysis.resumen
    ? `${analysis.resumen} — ${signature}`
    : signature;
  try {
    await updateRepo(deps.token, owner, repo, { description });
  } catch (err) {
    // No fatal: la doc ya está publicada. Se avisa sin bloquear el flujo.
    deps.addMessage({ role: 'assistant', content: `ℹ️ No pude actualizar el «about» de **${owner}/${repo}** (${(err as Error).message}). La documentación se ha publicado correctamente.` });
  }
}

/** Commit directo de la documentación generada a la rama por defecto. */
export async function runCommitDocs(deps: ChatDeps, analysis: RepoAnalysis): Promise<void> {
  const { token, user, addMessage, addEntry, updateEntry } = deps;
  const { owner, repo } = resolveRepoRef(analysis.repoName, user.login);
  const histId = addEntry({ status: 'pending', description: deps.t('history.committingDocs', { repo: analysis.repoName }), repo: analysis.repoName });
  const signature = buildSignature(deps);

  try {
    await writeDocFiles(token, owner, repo, analysis.readme, analysis.manualTecnico, undefined, signature);
    addMessage({ role: 'assistant', content: `✅ README.md y MANUAL_TECNICO.md commiteados en **${analysis.repoName}**` });
    updateEntry(histId, { status: 'completed', description: deps.t('history.docsCommitted', { repo: analysis.repoName }) });
    // v3.31.0: actualiza el "about" del repo (resumen + firma). No rompe si falla.
    await updateRepoAbout(deps, owner, repo, analysis);
  } catch (err) {
    addMessage({ role: 'assistant', content: `❌ Error al hacer commit: ${(err as Error).message}` });
    updateEntry(histId, { status: 'error', description: deps.t('history.errorCommittingDocs') });
  }
}

/** Crea un Draft PR con la documentación generada (#45). */
export async function runCreateDraftPr(deps: ChatDeps, analysis: RepoAnalysis): Promise<void> {
  const { token, user, addMessage, addEntry, updateEntry } = deps;
  const { owner, repo } = resolveRepoRef(analysis.repoName, user.login);
  const histId = addEntry({ status: 'pending', description: deps.t('history.creatingDraftPr', { repo: analysis.repoName }), repo: analysis.repoName });
  const signature = buildSignature(deps);

  try {
    const { pr, branchName } = await createDocsDraftPr(token, owner, repo, {
      readme: analysis.readme,
      manualTecnico: analysis.manualTecnico,
      filesAnalyzed: analysis.filesAnalyzed,
      repoName: analysis.repoName,
    }, Date.now(), signature);
    addMessage({ role: 'assistant', content: `✅ Draft PR [#${pr.number}](${pr.html_url}) creado en **${analysis.repoName}** (rama \`${branchName}\`). Revísalo antes de mergear.` });
    updateEntry(histId, { status: 'completed', description: deps.t('history.draftPrCreated', { number: pr.number, repo: analysis.repoName }) });
    // v3.31.0: actualiza el "about" del repo (resumen + firma). No rompe si falla.
    await updateRepoAbout(deps, owner, repo, analysis);
  } catch (err) {
    addMessage({ role: 'assistant', content: `❌ Error al crear Draft PR: ${(err as Error).message}` });
    updateEntry(histId, { status: 'error', description: deps.t('history.errorDraftPr', { repo: analysis.repoName }) });
  }
}

/**
 * Crea un GitHub Release a partir de la documentación generada de un repo (#28
 * Parte A v3.8.0). Usa el README como notas. Versión vacía → sugerida. Reutiliza
 * `suggestNextVersion`/`createGitHubRelease`.
 */
export async function runCreateRepoRelease(
  deps: ChatDeps,
  analysis: RepoAnalysis,
  version?: string,
): Promise<void> {
  const { token, user, addMessage, addEntry, updateEntry } = deps;
  const { owner, repo } = resolveRepoRef(analysis.repoName, user.login);
  const histId = addEntry({ status: 'pending', description: deps.t('history.creatingRelease', { repo: analysis.repoName }), repo: analysis.repoName });

  try {
    const tag = version?.trim() || await suggestNextVersion(token, owner, repo);
    const { url } = await createGitHubRelease(token, owner, repo, {
      version: tag,
      title: `${tag} — ${repo}`,
      body: analysis.readme,
    });
    addMessage({ role: 'assistant', content: `✅ Release [${tag}](${url}) creado en **${analysis.repoName}** con la documentación generada.` });
    updateEntry(histId, { status: 'completed', description: deps.t('history.releaseCreated', { tag, repo: analysis.repoName }) });
  } catch (err) {
    addMessage({ role: 'assistant', content: `❌ Error al crear el release: ${describePublishError(err, owner, repo, deps.t)}` });
    updateEntry(histId, { status: 'error', description: deps.t('history.errorRelease', { repo: analysis.repoName }) });
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
  // #57 Tanda B: fileContext ahora es un array (multi-archivo).
  const hasContext = repoContext !== null || fileContext.length > 0;

  // #50: presupuesto de contexto adaptativo al proveedor (Groq free = 6/60; el
  // resto = 12/80). Si el primer intento falla por contexto excesivo (TPM/context
  // length), abajo se reintenta con un presupuesto reducido a la mitad.
  let activeBudget = getActiveContextBudget(config.provider);

  // Con archivo adjunto, resolveMode fuerza chat (ninguna acción de GitHub lee un
  // archivo local); el repo y el archivo se pasan por separado.
  const finalMode = resolveMode(userText, modeOverride, repoContext !== null, fileContext.length > 0);

  // #38: en modo chat (texto Markdown largo) mostramos la respuesta en streaming,
  // token a token. En modo acción la respuesta es JSON → no se streamea (se vería feo).
  // #40: rastreamos el texto parcial para conservarlo si el usuario pulsa Detener.
  let lastText = '';
  const onToken = finalMode === 'chat'
    ? (textSoFar: string) => { lastText = textSoFar; updateMessage(loadingId, { content: textSoFar, isLoading: true }); }
    : undefined;

  // #49/#51: construye el contexto del repo re-seleccionando los archivos relevantes
  // a la pregunta (ranking léxico) según el presupuesto activo, y devuelve también la
  // lista de rutas consultadas para mostrársela al usuario (transparencia #51).
  const buildContextForBudget = (budget: ContextBudget): { contextText: string | undefined; consultedPaths: string[] } => {
    if (!repoContext) return { contextText: undefined, consultedPaths: [] };
    if (!repoContext.files || !repoContext.files.length) return { contextText: repoContext.contextText, consultedPaths: [] };
    const ranked = rankFilesByQuery(userText, repoContext.files, budget.maxFiles);
    return {
      contextText: buildRepoContextSummary(repoContext.repoName, ranked, { allPaths: repoContext.allPaths, maxFiles: budget.maxFiles, maxLinesPerFile: budget.maxLinesPerFile }),
      consultedPaths: ranked.map(f => f.path),
    };
  };

  // #50: intenta la llamada con el presupuesto activo; si falla por contexto excesivo
  // (TPM/context length), reintenta una vez con la mitad de archivos. Devuelve la
  // respuesta y la lista de archivos realmente enviados.
  const attemptSend = async (): Promise<{ rawResponse: string; consultedPaths: string[] }> => {
    for (let attempt = 0; ; attempt++) {
      const { contextText: repoContextText, consultedPaths } = buildContextForBudget(activeBudget);
      const combinedContext = [repoContextText, ...fileContext.map(f => f.contextText)].filter(Boolean).join('\n\n');
      const basePrompt = finalMode === 'chat'
        ? (combinedContext ? chatPromptWithContext(combinedContext) : CHAT_PROMPT)
        : ACTION_PROMPT;
      // #24 Fase 3: la directiva de idioma SOLO aplica al modo chat (texto Markdown).
      const systemPrompt = finalMode === 'chat' ? withLangDirective(basePrompt, deps.lang) : basePrompt;
      try {
        const rawResponse = await callAI(newHistory, systemPrompt, config.provider, config.apiKey, config.model, finalMode, onToken, params.signal);
        return { rawResponse, consultedPaths };
      } catch (err) {
        // #50: si el contexto es demasiado grande, reintentar con menos archivos (una sola vez).
        if (attempt === 0 && isContextTooLargeError(err) && repoContext && activeBudget.maxFiles > 2) {
          activeBudget = { maxFiles: Math.max(2, Math.floor(activeBudget.maxFiles / 2)), maxLinesPerFile: activeBudget.maxLinesPerFile };
          console.log(`[#50] Contexto excesivo — reintentando con ${activeBudget.maxFiles} archivos (era ${activeBudget.maxFiles * 2})`);
          continue;
        }
        throw err;
      }
    }
  };

  console.log(`[Opción D] Modo: ${finalMode} | Override: ${modeOverride} | Contexto: ${hasContext} | Presupuesto: ${activeBudget.maxFiles}/${activeBudget.maxLinesPerFile}`);

  try {
    const { rawResponse, consultedPaths } = await attemptSend();
    const consultedUpdate = consultedPaths.length ? { consultedFiles: consultedPaths } : {};

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
      updateMessage(loadingId, { content: textResponse, isLoading: false, ...consultedUpdate });
      setConversationHistory([...newHistory, { role: 'assistant', content: textResponse }]);
      setIsChatLoading(false);
      return;
    }

    // Modo acción: procesar JSON.
    const action = parseGeminiAction(rawResponse);
    if (!action) {
      // v3.22.2: antes esto fallaba en silencio (mostraba el texto crudo sin explicar).
      // Ahora avisamos al usuario de que el modelo no devolvió una acción válida,
      // para que sepa que puede probar otro modelo o reformular.
      const notice = deps.t('chat.actionParseFailed');
      const content = `${notice}\n\n---\n${rawResponse}`;
      updateMessage(loadingId, { content, isLoading: false, ...consultedUpdate });
      setConversationHistory([...newHistory, { role: 'assistant', content }]);
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

    updateMessage(loadingId, { content: enrichedAction.accion, isLoading: false, action: enrichedAction, ...consultedUpdate });
    setConversationHistory([...newHistory, { role: 'assistant', content: rawResponse }]);

    if (enrichedAction.requiereConfirmacion) {
      const repos = multiRepoEnabled && selectedRepos.length > 0 ? selectedRepos : [];
      setPendingAction({ action: enrichedAction, targetRepos: repos });
    } else {
      // Solo lectura: ejecutar directamente.
      const histId = addEntry({ status: 'pending', description: enrichedAction.accion, repo: enrichedAction.repo });
      updateEntry(histId, { status: 'pending' });
      const result = await executeAction(token, user, enrichedAction, undefined, deps.t);
      updateEntry(histId, { status: result.success ? 'completed' : 'error', description: result.message });
      if (result.success && result.data) {
        addMessage({ role: 'assistant', content: `✅ ${result.message}\n\n${formatResultData(result.data)}` });
      }
    }
  } catch (err) {
    // #40: si el usuario pulsó Detener, no es un error: conserva lo ya generado
    // (si lo hay) y márcalo como detenido, sin burbuja de error roja.
    if (isAbortError(err)) {
      updateMessage(loadingId, {
        content: lastText ? `${lastText}\n\n⏹️ _(detenido)_` : deps.t('chat.generationStopped'),
        isLoading: false,
      });
    } else if (isContextTooLargeError(err)) {
      // #50: el contexto sigue siendo demasiado grande incluso tras el reintento con
      // menos archivos. Mensaje accionable (no el de "saturación" genérico).
      updateMessage(loadingId, { content: deps.t('chat.contextTooLarge'), isLoading: false });
    } else {
      updateMessage(loadingId, { content: `${deps.t('chat.contactError')}: ${(err as Error).message}`, isLoading: false });
    }
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
  const { token, user, addMessage, addEntry, updateEntry, t } = deps;
  const { action, targetRepos } = pendingAction;

  if (targetRepos.length > 1) {
    await executeActionMultiRepo(token, user, action, targetRepos, {
      onProgress: (repo, status, message) => {
        addEntry({ status, description: message, repo });
      },
    }, t);
    addMessage({ role: 'assistant', content: t(targetRepos.length !== 1 ? 'history.multiRepoAppliedPlural' : 'history.multiRepoApplied', { count: targetRepos.length }) });
  } else {
    const histId = addEntry({ status: 'pending', description: action.accion, repo: action.repo });
    const result = await executeAction(token, user, action, undefined, t);
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
  addEntry({ status: 'cancelled', description: deps.t('history.cancelledAction', { action: pendingAction.action.accion }), repo: pendingAction.action.repo });
  addMessage({ role: 'assistant', content: deps.t('chat.actionCancelled') });
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
    // Guía explícita del flujo (#28 v3.7.0): conversar primero, y documentar/publicar
    // con el botón — ya no se adivina por palabras clave.
    const docHint = deps.t('chat.attachDocHint');

    // #28 Fase 3a — hojas de cálculo: muestra de filas + aviso de tokens (evita 400).
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      const { text, summary, truncated } = await readSpreadsheet(file);
      // El tamaño ya está acotado en readSpreadsheet (muestra de filas + tope por
      // hoja), así que NO reusamos el recorte a 4000 chars de formatFileContentForAI
      // (mutilaría la muestra y haría falso el aviso de "100 filas").
      const contextText = `\n\n--- Datos del archivo adjunto: ${file.name} (hoja de cálculo) ---\n${text}\n--- Fin del archivo ---\n`;
      updateMessage(loadingId, {
        content: truncated
          ? `📎 Cargado **${file.name}** — ${summary}. Es grande, así que analizaré una **muestra de las primeras ${SPREADSHEET_SAMPLE_ROWS} filas**. Pregúntame lo que quieras sobre los datos. ${docHint}`
          : `📎 Adjuntado **${file.name}** — ${summary}. Pregúntame lo que quieras sobre los datos o pídeme tu opinión/análisis. ${docHint}`,
        isLoading: false,
      });
      return { name: file.name, contextText };
    }

    // #28 Fase 3b/3b-bis — Power BI (.pbix/.pbit): informe (páginas/visuales),
    // modelo/DAX (solo .pbit) y Power Query / M (orígenes y transformaciones).
    // Extrae solo la estructura del ZIP (Zero-Storage).
    if (ext === 'pbix' || ext === 'pbit') {
      const { text, summary, truncated } = await readPowerBI(file);
      const contextText = `\n\n--- Estructura del archivo Power BI: ${file.name} (${ext}) ---\n${text}\n--- Fin del archivo ---\n`;
      updateMessage(loadingId, {
        content: truncated
          ? `📎 Cargado **${file.name}** — ${summary}. Es grande, así que incluyo una **muestra acotada** de su estructura. Pregúntame por el informe, el modelo o las consultas (Power Query). ${docHint}`
          : `📎 Adjuntado **${file.name}** — ${summary}. Pregúntame lo que quieras sobre el informe, el modelo o los orígenes/consultas (Power Query), o pídeme tu opinión/análisis. ${docHint}`,
        isLoading: false,
      });
      return { name: file.name, contextText };
    }

    // #28 — documentos Word (.docx): ZIP OOXML, se extrae el texto de word/document.xml.
    if (ext === 'docx') {
      const { text, summary, truncated } = await readDocx(file);
      const contextText = `\n\n--- Contenido del documento Word: ${file.name} ---\n${text}\n--- Fin del archivo ---\n`;
      updateMessage(loadingId, {
        content: truncated
          ? `📎 Cargado **${file.name}** — ${summary}. Es largo, así que analizaré una **parte acotada** del texto. Pregúntame lo que quieras o pídeme tu opinión/análisis. ${docHint}`
          : `📎 Adjuntado **${file.name}** — ${summary}. Pregúntame lo que quieras sobre él o pídeme tu opinión/análisis. ${docHint}`,
        isLoading: false,
      });
      return { name: file.name, contextText };
    }

    const content = await readFileContent(file);
    if (!content.trim()) {
      throw new Error(deps.t('chat.fileTextExtractFailed'));
    }
    const contextText = formatFileContentForAI(file.name, content);
    const kb = Math.max(1, Math.round(file.size / 1024));
    updateMessage(loadingId, {
      content: `📎 Adjuntado **${file.name}** (${kb} KB). Pregúntame lo que quieras sobre él o pídeme tu opinión/análisis. ${docHint}`,
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
  conversation?: string,
): Promise<string | null> {
  const { providerName, addMessage, updateMessage, setIsChatLoading } = deps;
  setIsChatLoading(true);
  const loadingId = addMessage({ role: 'assistant', content: `📝 Generando documentación de **${fileContext.name}** con ${providerName}...`, isLoading: true });
  try {
    const doc = await generateFileDoc(fileContext.name, fileContext.contextText, config, conversation, deps.lang);
    updateMessage(loadingId, { content: `✅ Documentación de **${fileContext.name}** lista. Elige cómo publicarla.`, isLoading: false });
    return doc;
  } catch (err) {
    updateMessage(loadingId, { content: `❌ Error al documentar: ${(err as Error).message}`, isLoading: false });
    return null;
  } finally {
    setIsChatLoading(false);
  }
}

/**
 * Traduce un error de publicación a lenguaje claro (principio rector). Un 404 de
 * GitHub suele significar "el repo no existe o no tengo acceso", no un fallo técnico.
 */
function describePublishError(err: unknown, owner: string, repo: string, t: ChatDeps['t']): string {
  const message = (err as Error).message || t('chat.unknownError');
  const status = err instanceof GitHubAPIError ? err.status : undefined;
  if (status === 404 || /not found/i.test(message)) {
    return `No encontré el repositorio **${owner}/${repo}** (¿existe y tienes acceso?).`;
  }
  return message;
}

/**
 * Crea un repositorio en la cuenta del usuario (reutiliza `createRepo`, con
 * `auto_init` para que tenga rama por defecto y se pueda commitear/publicar de
 * inmediato). Devuelve `true` si se creó. Mensajes de progreso/error en el chat.
 */
export async function runCreateRepo(
  deps: ChatDeps,
  name: string,
  opts: { description?: string } = {},
): Promise<boolean> {
  const { token, addMessage, addEntry, updateEntry } = deps;
  const histId = addEntry({ status: 'pending', description: deps.t('history.creatingRepo', { name }), repo: name });
  try {
    await createRepo(token, name, opts.description ?? buildSignature(deps));
    addMessage({ role: 'assistant', content: `✅ Repositorio **${name}** creado en tu cuenta.` });
    updateEntry(histId, { status: 'completed', description: deps.t('history.repoCreated', { name }) });
    return true;
  } catch (err) {
    addMessage({ role: 'assistant', content: `❌ No pude crear el repositorio **${name}**: ${(err as Error).message}` });
    updateEntry(histId, { status: 'error', description: deps.t('history.errorRepo', { name }) });
    return false;
  }
}

/**
 * Crea un repositorio inexistente en la cuenta del usuario, sube (opcionalmente)
 * archivos adjuntos para poblarlo y, a continuación, lo documenta. Orquesta los
 * tres pasos del flujo "crear + documentar" del scope repo (#57 Tanda B):
 *   1. `runCreateRepo` (crea con auto_init → rama por defecto lista).
 *   2. `uploadFilesToRepo` (sube archivos del usuario; routing por tipo).
 *   3. `runDocumentRepo` (reintenta la generación ahora que el repo existe).
 *
 * @returns el análisis generado, o `null` si algún paso falló (los mensajes de
 *          error ya se publican en el chat dentro de cada run*).
 */
export async function runCreateRepoAndDocument(
  deps: ChatDeps,
  config: AIProviderConfig,
  repoInput: string,
  files?: File[],
): Promise<RepoAnalysis | null> {
  const { token, user, addMessage } = deps;
  const { owner, repo: repoName } = resolveRepoRef(repoInput, user.login);
  const isOwnAccount = owner === user.login;
  if (!isOwnAccount) {
    addMessage({ role: 'assistant', content: deps.t('chat.docRepoMissingOther', { repo: `${owner}/${repoName}` }) });
    return null;
  }
  // 1. Crear el repo (mensajes de progreso dentro de runCreateRepo).
  const ok = await runCreateRepo(deps, repoName);
  if (!ok) return null;
  // 2. Subir archivos adjuntos (si los hay) para poblar el repo recién creado.
  if (files && files.length > 0) {
    try {
      await uploadFilesToRepo(token, owner, repoName, files);
      addMessage({ role: 'assistant', content: `📎 Subidos ${files.length} archivo(s) a **${owner}/${repoName}**.` });
    } catch (err) {
      addMessage({ role: 'assistant', content: `⚠️ No pude subir los archivos a **${owner}/${repoName}** (${(err as Error).message}). Procedo a documentar el repo igualmente.` });
    }
  }
  // 3. Reintentar la documentación ahora que el repo existe. Tras crearlo no cabe
  // un 'repo-missing' (ya existe), pero el tipo de runDocumentRepo lo permite → se
  // filtra para devolver solo RepoAnalysis | null.
  const analysis = await runDocumentRepo(deps, config, repoInput);
  return analysis === 'repo-missing' ? null : analysis;
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
  opts: { draft?: boolean; sourceFile?: File; extraFiles?: File[] },
): Promise<void> {
  const { token, addMessage, addEntry, updateEntry } = deps;
  const path = docPathFor(fileName);
  const histId = addEntry({ status: 'pending', description: deps.t('history.publishing', { path, repo: `${owner}/${repo}` }), repo: `${owner}/${repo}` });
  try {
    const { pr } = await publishFileDoc(token, owner, repo, path, doc, { draft: opts.draft, sourceFile: opts.sourceFile, extraFiles: opts.extraFiles });
    const nExtra = (opts.sourceFile ? 1 : 0) + (opts.extraFiles?.length ?? 0);
    const extra = nExtra > 0 ? ` + ${nExtra} archivo(s) adjunto(s)` : '';
    addMessage({
      role: 'assistant',
      content: pr
        ? `✅ Draft PR [#${pr.number}](${pr.html_url}) con \`${path}\`${extra} en **${owner}/${repo}**. Revísalo antes de mergear.`
        : `✅ \`${path}\`${extra} commiteado en **${owner}/${repo}**.`,
    });
    updateEntry(histId, { status: 'completed', description: deps.t('history.published', { repo: `${owner}/${repo}` }) });
  } catch (err) {
    addMessage({ role: 'assistant', content: `❌ Error al publicar la documentación: ${describePublishError(err, owner, repo, deps.t)}` });
    updateEntry(histId, { status: 'error', description: deps.t('history.errorPublishing', { repo: `${owner}/${repo}` }) });
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
  sourceFile?: File,
  extraFiles?: File[],
): Promise<void> {
  const { token, addMessage, addEntry, updateEntry } = deps;
  const histId = addEntry({ status: 'pending', description: deps.t('history.creatingRelease', { repo: `${owner}/${repo}` }), repo: `${owner}/${repo}` });
  try {
    const tag = version?.trim() || await suggestNextVersion(token, owner, repo);
    const { url, id } = await createGitHubRelease(token, owner, repo, {
      version: tag,
      title: `${tag} — ${fileName}`,
      body: doc,
    });
    addMessage({ role: 'assistant', content: `✅ Release [${tag}](${url}) creado en **${owner}/${repo}** con la documentación de ${fileName}.` });
    // Adjunta el archivo fuente + extras como assets del release (#28 Fase 4a/4b).
    // No-fatal: si alguno falla, el release ya está creado, solo se avisa.
    const assets = [...(sourceFile ? [sourceFile] : []), ...(extraFiles ?? [])];
    for (const file of assets) {
      try {
        const asset = { name: file.name, file, contentType: getMimeType(file.name) };
        const { url: assetUrl } = await uploadReleaseAsset(token, owner, repo, id, asset);
        addMessage({ role: 'assistant', content: `📦 **${file.name}** adjuntado al release: [descargar](${assetUrl}).` });
      } catch (assetErr) {
        addMessage({ role: 'assistant', content: `⚠️ El release se creó, pero no pude adjuntar **${file.name}**: ${(assetErr as Error).message}` });
      }
    }
    updateEntry(histId, { status: 'completed', description: deps.t('history.releaseCreated', { tag, repo: `${owner}/${repo}` }) });
  } catch (err) {
    addMessage({ role: 'assistant', content: `❌ Error al crear el release: ${describePublishError(err, owner, repo, deps.t)}` });
    updateEntry(histId, { status: 'error', description: deps.t('history.errorRelease', { repo: `${owner}/${repo}` }) });
  }
}

/** Forma de publicar la doc del archivo adjunto. */
export type PublishKind = 'commit' | 'draftpr' | 'release';

/** Datos para publicar la doc generada en un repo concreto. */
export interface PublishTarget {
  owner: string;
  repo: string;
  fileName: string;
  doc: string;
  kind: PublishKind;
  version?: string;
  /** Archivo fuente original a subir junto a la doc (#28 Fase 4a). */
  sourceFile?: File;
  /** Extras a subir (imágenes→screenshots/, datos→data/, resto→raíz) — #28 Fase 4b. */
  extraFiles?: File[];
}

/** Despacha la publicación según el `kind` (commit / Draft PR / Release). */
export async function runPublishFileDocByKind(deps: ChatDeps, t: PublishTarget): Promise<void> {
  if (t.kind === 'release') {
    await runCreateFileRelease(deps, t.owner, t.repo, t.fileName, t.doc, t.version, t.sourceFile, t.extraFiles);
  } else {
    await runPublishFileDoc(deps, t.owner, t.repo, t.fileName, t.doc, { draft: t.kind === 'draftpr', sourceFile: t.sourceFile, extraFiles: t.extraFiles });
  }
}

/** Resultado de iniciar la publicación. `repo-missing` → App ofrece crear el repo. */
export type StartPublishResult = 'published' | 'repo-missing' | 'handled';

/**
 * Inicia la publicación comprobando antes que el repo destino existe (evita el crudo
 * "Not Found"). Si no existe y es de la cuenta del usuario, devuelve `repo-missing`
 * para que App ofrezca crearlo; si es de otra cuenta o hay error, lo notifica y
 * devuelve `handled`. Si existe, publica y devuelve `published`.
 */
export async function runStartPublish(
  deps: ChatDeps,
  target: PublishTarget,
  isOwnAccount: boolean,
): Promise<StartPublishResult> {
  const { token, addMessage } = deps;
  const { owner, repo } = target;
  let exists: boolean;
  try {
    exists = await repoExists(token, owner, repo);
  } catch (err) {
    addMessage({ role: 'assistant', content: `❌ No pude comprobar el repositorio **${owner}/${repo}**: ${(err as Error).message}` });
    return 'handled';
  }
  if (!exists) {
    if (!isOwnAccount) {
      addMessage({ role: 'assistant', content: `❌ No encontré **${owner}/${repo}** y solo puedo crear repositorios en tu cuenta. Créalo en GitHub o elige otro destino.` });
      return 'handled';
    }
    return 'repo-missing';
  }
  await runPublishFileDocByKind(deps, target);
  return 'published';
}
