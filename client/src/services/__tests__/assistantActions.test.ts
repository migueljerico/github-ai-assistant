import { describe, it, expect, vi, beforeEach } from 'vitest';
import { es } from '../../i18n/es';

// Mock de los servicios de los que dependen las acciones
vi.mock('../gemini', () => ({
  generateRepoDocs: vi.fn(),
  generateFileDoc: vi.fn(),
  generateSpecificDoc: vi.fn(),
  buildRepoContextSummary: vi.fn(() => 'GENERAL_CTX'),
  buildSecurityAuditContext: vi.fn(() => 'AUDIT_CTX'),
  callAI: vi.fn(),
  parseGeminiAction: vi.fn(),
  isAbortError: (err: unknown) => (err as { name?: string })?.name === 'AbortError',
  chatPromptWithContext: vi.fn(() => 'CTX_PROMPT'),
  // #24 Fase 3: helper real (devuelve el prompt con la directiva de idioma).
  withLangDirective: (prompt: string, lang: string) =>
    prompt + (lang === 'en' ? '\n\nIMPORTANT: Respond to the user in English.' : '\n\nIMPORTANTE: Responde al usuario en español.'),
  CHAT_PROMPT: 'CHAT_PROMPT',
  ACTION_PROMPT: 'ACTION_PROMPT',
  SECURITY_PROMPT: 'SECURITY_PROMPT',
}));
vi.mock('../github', () => {
  class GitHubAPIError extends Error {
    status: number;
    constructor(message: string, status: number) { super(message); this.status = status; }
  }
  return {
    fetchRepoTreeRecursive: vi.fn(),
    getFileContents: vi.fn(),
    decodeBase64: vi.fn((s: string) => `decoded(${s})`),
    createRepo: vi.fn(),
    repoExists: vi.fn(),
    getRepo: vi.fn(),
    updateRepo: vi.fn().mockResolvedValue(undefined),
    listCommitDates: vi.fn(),
    listRecentCommits: vi.fn(),
    getCommit: vi.fn(),
    GitHubAPIError,
  };
});
vi.mock('../docPublisher', () => ({
  writeDocFiles: vi.fn(),
  createDocsDraftPr: vi.fn(),
  publishFileDoc: vi.fn(),
  uploadFilesToRepo: vi.fn(),
}));
vi.mock('../../utils/releaseGenerator', () => ({
  createGitHubRelease: vi.fn(),
  suggestNextVersion: vi.fn(),
}));
vi.mock('../../utils/releaseAssets', () => ({
  uploadReleaseAsset: vi.fn(),
  getMimeType: vi.fn(() => 'application/octet-stream'),
}));
vi.mock('../threadSummary', () => ({
  summarizeThread: vi.fn(),
  parseThreadInput: vi.fn(),
  listOpenThreads: vi.fn(),
  formatThreadList: vi.fn(),
}));
vi.mock('../actionExecutor', () => ({
  executeAction: vi.fn(),
  executeActionMultiRepo: vi.fn(),
  // #53 (v3.50.0): exportado por actionExecutor; replica el comportamiento real
  // para que runSend pueda resolver owner/name del repo destino.
  parseRepoTarget: vi.fn((repoFullName: string | null, user: { login: string }) => {
    if (!repoFullName) return { owner: user.login, repo: '' };
    if (repoFullName.includes('/')) {
      const [owner, repo] = repoFullName.split('/');
      return { owner, repo };
    }
    return { owner: user.login, repo: repoFullName };
  }),
}));
vi.mock('../../utils/modeDetection', () => ({ resolveMode: vi.fn() }));
vi.mock('../../utils/formatResult', () => ({ formatResultData: vi.fn(() => 'FORMATTED') }));
vi.mock('../../utils/pdfReader', () => ({
  assertSupportedFile: vi.fn(),
  readFileContent: vi.fn(),
  formatFileContentForAI: vi.fn((name: string, content: string) => `FMT(${name}):${content}`),
}));
vi.mock('../../utils/spreadsheetReader', () => ({
  readSpreadsheet: vi.fn(),
  SPREADSHEET_SAMPLE_ROWS: 100,
}));
vi.mock('../../utils/powerbiReader', () => ({ readPowerBI: vi.fn() }));
vi.mock('../../utils/docxReader', () => ({ readDocx: vi.fn() }));
vi.mock('../changelogGenerator', () => ({ generateChangelog: vi.fn() }));

import { generateRepoDocs, generateFileDoc, generateSpecificDoc, buildRepoContextSummary, callAI, parseGeminiAction, chatPromptWithContext } from '../gemini';
import { assertSupportedFile, readFileContent } from '../../utils/pdfReader';
import { readSpreadsheet } from '../../utils/spreadsheetReader';
import { readPowerBI } from '../../utils/powerbiReader';
import { readDocx } from '../../utils/docxReader';
import { fetchRepoTreeRecursive, getFileContents, createRepo, repoExists, getRepo, updateRepo, listCommitDates, listRecentCommits, getCommit } from '../github';
import { writeDocFiles, createDocsDraftPr, publishFileDoc, uploadFilesToRepo } from '../docPublisher';
import { summarizeThread, parseThreadInput, listOpenThreads, formatThreadList } from '../threadSummary';
import { generateChangelog } from '../changelogGenerator';
import { executeAction, executeActionMultiRepo } from '../actionExecutor';
import { createGitHubRelease, suggestNextVersion } from '../../utils/releaseGenerator';
import { uploadReleaseAsset } from '../../utils/releaseAssets';
import { resolveMode } from '../../utils/modeDetection';
import {
  runDocumentRepo,
  runLoadRepoContext,
  runSummarizeThread,
  runGenerateChangelog,
  runCodeHealth,
  runCommitDocs,
  runCreateDraftPr,
  runSend,
  runConfirmAction,
  runCancelAction,
  runAttachFile,
  runGenerateFileDoc,
  runPublishFileDoc,
  runCreateFileRelease,
  runCreateRepo,
  runCreateRepoAndDocument,
  runStartPublish,
  runPublishFileDocByKind,
  runCreateRepoRelease,
  runSyncRepoStatus,
  runSecurityAudit,
  runGenerateSpecificDoc,
  runPublishSpecificDoc,
  formatConversation,
  buildSignature,
} from '../assistantActions';

const CONFIG = { provider: 'groq' as const, apiKey: 'k', model: 'm' };

describe('formatConversation (#28 v3.7.0)', () => {
  it('formatea el historial como Usuario/Asistente', () => {
    const out = formatConversation([
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: 'qué tal' },
    ]);
    expect(out).toBe('Usuario: hola\n\nAsistente: qué tal');
  });

  it('historial vacío → cadena vacía', () => {
    expect(formatConversation([])).toBe('');
  });
});

function makeDeps() {
  let n = 0;
  return {
    token: 'tok',
    user: { login: 'me' },
    providerName: 'Groq',
    model: 'llama-3.1-8b-instant',
    provider: 'groq' as const,
    lang: 'es' as const,
    // Mock de t() que usa el diccionario ES real + interpolación de {params},
    // para que los tests que asertan contenido de mensajes sigan pasando.
    t: vi.fn((key: string, params?: Record<string, string | number>) => {
      let out = (es as Record<string, string>)[key] ?? key;
      if (params) for (const [k, v] of Object.entries(params)) out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      return out;
    }),
    addMessage: vi.fn(() => `msg-${++n}`),
    updateMessage: vi.fn(),
    addEntry: vi.fn(() => 'hist-1'),
    updateEntry: vi.fn(),
    setIsChatLoading: vi.fn(),
    setConversationHistory: vi.fn(),
    setPendingAction: vi.fn(),
  };
}

const SEND_PARAMS = {
  userText: 'hola',
  conversationHistory: [] as Array<{ role: 'user' | 'assistant'; content: string }>,
  modeOverride: 'auto' as const,
  repoContext: null,
  fileContext: [] as Array<{ name: string; contextText: string; file?: File }>,
  multiRepoEnabled: false,
  selectedRepos: [] as never[],
};

const ANALYSIS = {
  readme: 'R', manualTecnico: 'M', filesAnalyzed: 2, totalFiles: 2, truncated: false, repoName: 'owner/repo',
};

beforeEach(() => { vi.clearAllMocks(); });

describe('runDocumentRepo', () => {
  it('devuelve el análisis en el camino feliz', async () => {
    // v3.22.3: runDocumentRepo ahora pre-chequea getRepo y usa su default_branch.
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }, { path: 'b' }], totalScanned: 2, truncated: false, allPaths: ['a', 'b'] } as any);
    vi.mocked(generateRepoDocs).mockResolvedValue({ readme: 'R', manualTecnico: 'M' } as any);
    const deps = makeDeps();

    const result = await runDocumentRepo(deps, CONFIG, 'owner/repo');

    expect(result).toEqual({ readme: 'R', manualTecnico: 'M', filesAnalyzed: 2, totalFiles: 2, truncated: false, repoName: 'owner/repo', alreadyDocumented: false });
    expect(getRepo).toHaveBeenCalledWith('tok', 'owner', 'repo');
    expect(fetchRepoTreeRecursive).toHaveBeenCalledWith('tok', 'owner', 'repo', 'main');
    expect(generateRepoDocs).toHaveBeenCalledWith('owner/repo', expect.any(Array), CONFIG, 'es');
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'pending' }));
    expect(deps.setIsChatLoading).toHaveBeenLastCalledWith(false);
  });

  it('marca alreadyDocumented cuando el repo ya tiene README.md (#57 Tanda B)', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'README.md' }, { path: 'src/a' }], totalScanned: 2, truncated: false, allPaths: ['README.md', 'src/a'] } as any);
    vi.mocked(generateRepoDocs).mockResolvedValue({ readme: 'R', manualTecnico: 'M' } as any);
    const deps = makeDeps();

    const result = await runDocumentRepo(deps, CONFIG, 'owner/repo');

    expect(result).toEqual(expect.objectContaining({ alreadyDocumented: true, repoName: 'owner/repo' }));
  });

  it('devuelve null y marca error si falla la descarga', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockRejectedValue(new Error('boom'));
    const deps = makeDeps();

    const result = await runDocumentRepo(deps, CONFIG, 'owner/repo');

    expect(result).toBeNull();
    expect(deps.updateMessage).toHaveBeenLastCalledWith('msg-1', expect.objectContaining({ content: expect.stringContaining('boom'), isLoading: false }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'error' }));
  });

  it('repo 404 ajeno → null con mensaje accionable (no puede crear en otra cuenta)', async () => {
    const { GitHubAPIError } = await import('../github');
    vi.mocked(getRepo).mockRejectedValue(new GitHubAPIError('Not Found', 404));
    const deps = makeDeps(); // user.login = 'me' → 'owner/repo' no es propio

    const result = await runDocumentRepo(deps, CONFIG, 'owner/repo');

    expect(result).toBeNull();
    const notice = deps.t('chat.docRepoMissingOther', { repo: 'owner/repo' });
    expect(deps.updateMessage).toHaveBeenLastCalledWith('msg-1', expect.objectContaining({ content: notice, isLoading: false }));
  });

  it('repo 404 propio → "repo-missing" para ofrecer crear (#57 Tanda B)', async () => {
    const { GitHubAPIError } = await import('../github');
    vi.mocked(getRepo).mockRejectedValue(new GitHubAPIError('Not Found', 404));
    const deps = makeDeps(); // user.login = 'me'

    const result = await runDocumentRepo(deps, CONFIG, 'me/nuevo-repo');

    expect(result).toBe('repo-missing');
    const notice = deps.t('chat.docRepoMissingCreate', { repo: 'me/nuevo-repo' });
    expect(deps.updateMessage).toHaveBeenLastCalledWith('msg-1', expect.objectContaining({ content: notice, isLoading: false }));
  });
});

describe('runLoadRepoContext', () => {
  it('devuelve el contexto en el camino feliz (owner por defecto = usuario)', async () => {
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }], totalScanned: 1, truncated: false } as any);
    vi.mocked(buildRepoContextSummary).mockReturnValue('CTX');
    const deps = makeDeps();

    const ctx = await runLoadRepoContext(deps, 'mi-repo');

    // #49: ahora el contexto incluye también los archivos en memoria y el árbol completo.
    expect(ctx).toEqual({
      repoName: 'me/mi-repo', contextText: 'CTX', filesAnalyzed: 1, totalFiles: 1, truncated: false,
      files: [{ path: 'a' }], allPaths: ['a'],
    });
  });

  it('devuelve null si falla', async () => {
    vi.mocked(fetchRepoTreeRecursive).mockRejectedValue(new Error('x'));
    const deps = makeDeps();
    expect(await runLoadRepoContext(deps, 'owner/repo')).toBeNull();
  });
});

describe('runSummarizeThread', () => {
  it('si no se entiende la referencia, avisa y no carga', async () => {
    vi.mocked(parseThreadInput).mockReturnValue(null);
    const deps = makeDeps();

    await runSummarizeThread(deps, CONFIG, 'basura', null);

    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('No entendí') }));
    expect(deps.setIsChatLoading).not.toHaveBeenCalled();
  });

  it('si solo se da el repo, lista los hilos abiertos', async () => {
    vi.mocked(parseThreadInput).mockReturnValue({ owner: 'o', repo: 'r' } as any);
    vi.mocked(listOpenThreads).mockResolvedValue([{ number: 1, title: 't', isPr: false }] as any);
    vi.mocked(formatThreadList).mockReturnValue('LISTA');
    const deps = makeDeps();

    await runSummarizeThread(deps, CONFIG, 'o/r', null);

    expect(listOpenThreads).toHaveBeenCalledWith('tok', 'o', 'r');
    expect(deps.updateMessage).toHaveBeenCalledWith(expect.any(String), { content: 'LISTA', isLoading: false });
    expect(summarizeThread).not.toHaveBeenCalled();
  });

  it('con número, resume el hilo', async () => {
    vi.mocked(parseThreadInput).mockReturnValue({ owner: 'o', repo: 'r', number: 5 } as any);
    vi.mocked(summarizeThread).mockResolvedValue('SUMMARY');
    const deps = makeDeps();

    await runSummarizeThread(deps, CONFIG, 'o/r#5', null);

    expect(summarizeThread).toHaveBeenCalledWith('tok', 'o', 'r', 5, CONFIG);
    expect(deps.updateMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ content: expect.stringContaining('SUMMARY') }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'completed' }));
  });

  it('usa el repo de contexto cuando solo se da el número', async () => {
    vi.mocked(parseThreadInput).mockReturnValue({ number: 9 } as any);
    vi.mocked(summarizeThread).mockResolvedValue('S');
    const deps = makeDeps();

    await runSummarizeThread(deps, CONFIG, '#9', 'acme/proj');

    expect(summarizeThread).toHaveBeenCalledWith('tok', 'acme', 'proj', 9, CONFIG);
  });

  it('marca error si summarizeThread falla', async () => {
    vi.mocked(parseThreadInput).mockReturnValue({ owner: 'o', repo: 'r', number: 5 } as any);
    vi.mocked(summarizeThread).mockRejectedValue(new Error('LLM down'));
    const deps = makeDeps();

    await runSummarizeThread(deps, CONFIG, 'o/r#5', null);

    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'error' }));
  });
});

describe('runGenerateChangelog (#34)', () => {
  it('genera el changelog y lo muestra como burbuja', async () => {
    vi.mocked(generateChangelog).mockResolvedValue('## Novedades\n- algo');
    const deps = makeDeps();

    await runGenerateChangelog(deps, CONFIG, 'owner/repo');

    expect(generateChangelog).toHaveBeenCalledWith('tok', 'owner', 'repo', CONFIG);
    expect(deps.updateMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ content: expect.stringContaining('Changelog de owner/repo'), isLoading: false }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'completed' }));
  });

  it('muestra ❌ con el error si falla', async () => {
    vi.mocked(generateChangelog).mockRejectedValue(new Error('No hay commits nuevos desde el último release (v1.0.0).'));
    const deps = makeDeps();

    await runGenerateChangelog(deps, CONFIG, 'owner/repo');

    expect(deps.updateMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ content: expect.stringContaining('No hay commits nuevos'), isLoading: false }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'error' }));
  });
});

describe('runCodeHealth (#44)', () => {
  it('reúne lenguajes, deuda y commits del repo', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({
      files: [{ path: 'src/a.ts', content: '// TODO: x' }, { path: 'src/b.py', content: 'ok' }],
      totalScanned: 2,
      truncated: false,
      allPaths: ['src/a.ts', 'src/b.py', 'README.md'],
    } as any);
    vi.mocked(listCommitDates).mockResolvedValue([new Date().toISOString()]);
    const deps = makeDeps();

    const result = await runCodeHealth(deps, 'owner/repo');

    expect(result).not.toBeNull();
    expect(result!.repoName).toBe('owner/repo');
    expect(result!.languages).toContainEqual({ language: 'TypeScript', count: 1 });
    expect(result!.debt.total).toBe(1);
    expect(result!.commits.reduce((a, w) => a + w.count, 0)).toBe(1);
    expect(getRepo).toHaveBeenCalledWith('tok', 'owner', 'repo');
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'completed' }));
  });

  it('devuelve null y marca error si falla la descarga', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockRejectedValue(new Error('boom'));
    vi.mocked(listCommitDates).mockResolvedValue([]);
    const deps = makeDeps();

    const result = await runCodeHealth(deps, 'owner/repo');

    expect(result).toBeNull();
    expect(deps.updateMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ content: expect.stringContaining('boom'), isLoading: false }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'error' }));
  });
});

describe('runCommitDocs', () => {
  it('commitea y registra éxito', async () => {
    vi.mocked(writeDocFiles).mockResolvedValue(undefined as any);
    const deps = makeDeps();

    await runCommitDocs(deps, ANALYSIS);

    // v3.31.0: writeDocFiles ahora recibe (token, owner, repo, readme, manual, branch?, signature?).
    expect(writeDocFiles).toHaveBeenCalledWith('tok', 'owner', 'repo', 'R', 'M', undefined,
      expect.stringContaining('Creado por @me y documentado por Groq'));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'completed' }));
  });

  it('registra error si el commit falla', async () => {
    vi.mocked(writeDocFiles).mockRejectedValue(new Error('409'));
    const deps = makeDeps();

    await runCommitDocs(deps, ANALYSIS);

    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('409') }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'error' }));
  });
});

describe('runCreateDraftPr', () => {
  it('crea el Draft PR y enlaza el número', async () => {
    vi.mocked(createDocsDraftPr).mockResolvedValue({ pr: { number: 7, html_url: 'http://pr/7' }, branchName: 'docs/auto-1' } as any);
    const deps = makeDeps();

    await runCreateDraftPr(deps, ANALYSIS);

    // v3.31.0: createDocsDraftPr ahora recibe (token, owner, repo, docs, now, signature).
    expect(createDocsDraftPr).toHaveBeenCalledWith('tok', 'owner', 'repo',
      expect.objectContaining({ repoName: 'owner/repo' }),
      expect.any(Number),
      expect.stringContaining('Creado por @me y documentado por Groq'));
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('#7') }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'completed' }));
  });

  it('registra error si falla la creación del PR', async () => {
    vi.mocked(createDocsDraftPr).mockRejectedValue(new Error('no perms'));
    const deps = makeDeps();

    await runCreateDraftPr(deps, ANALYSIS);

    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'error' }));
  });
});

describe('runSummarizeThread (ramas residuales)', () => {
  it('avisa si no puede determinar el repositorio (solo número, sin contexto)', async () => {
    vi.mocked(parseThreadInput).mockReturnValue({ number: 9 } as any);
    const deps = makeDeps();

    await runSummarizeThread(deps, CONFIG, '#9', null);

    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('No pude determinar el repositorio') }));
    expect(summarizeThread).not.toHaveBeenCalled();
  });

  it('marca error si listOpenThreads falla', async () => {
    vi.mocked(parseThreadInput).mockReturnValue({ owner: 'o', repo: 'r' } as any);
    vi.mocked(listOpenThreads).mockRejectedValue(new Error('rate limit'));
    const deps = makeDeps();

    await runSummarizeThread(deps, CONFIG, 'o/r', null);

    expect(deps.updateMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ content: expect.stringContaining('rate limit'), isLoading: false }));
  });
});

describe('runSend', () => {
  it('modo chat sin JSON: muestra el texto y NO ejecuta', async () => {
    vi.mocked(resolveMode).mockReturnValue('chat');
    vi.mocked(callAI).mockResolvedValue('Mi opinión en Markdown');
    vi.mocked(parseGeminiAction).mockReturnValue(null);
    const deps = makeDeps();

    await runSend(deps, CONFIG, SEND_PARAMS);

    expect(deps.updateMessage).toHaveBeenCalledWith('msg-2', { content: 'Mi opinión en Markdown', isLoading: false });
    expect(deps.setConversationHistory).toHaveBeenCalled();
    expect(executeAction).not.toHaveBeenCalled();
    expect(deps.setPendingAction).not.toHaveBeenCalled();
  });

  it('modo chat con JSON: extrae texto largo de la acción y NO ejecuta', async () => {
    vi.mocked(resolveMode).mockReturnValue('chat');
    vi.mocked(callAI).mockResolvedValue('{...}');
    vi.mocked(parseGeminiAction).mockReturnValue({ accion: 'x'.repeat(60), endpoint: '/r' } as any);
    const deps = makeDeps();

    await runSend(deps, CONFIG, SEND_PARAMS);

    expect(deps.updateMessage).toHaveBeenCalledWith('msg-2', { content: 'x'.repeat(60), isLoading: false });
    expect(executeAction).not.toHaveBeenCalled();
  });

  it('pasa hasRepoContext y hasFileContext por separado a resolveMode (#28 fix)', async () => {
    // Con archivo adjunto, resolveMode debe recibir hasFileContext=true (4º arg) para
    // forzar chat — independientemente del formato (todos producen un fileContext).
    vi.mocked(resolveMode).mockReturnValue('chat');
    vi.mocked(callAI).mockResolvedValue('texto');
    vi.mocked(parseGeminiAction).mockReturnValue(null);
    const deps = makeDeps();

    await runSend(deps, CONFIG, {
      ...SEND_PARAMS,
      userText: 'háblame del PBIX que acabo de subir',
      fileContext: [{ name: 'x.pbix', contextText: 'CTX' }],
    });

    expect(resolveMode).toHaveBeenCalledWith('háblame del PBIX que acabo de subir', 'auto', false, true);
  });

  it('modo acción sin JSON: muestra aviso + texto plano (v3.22.2)', async () => {
    vi.mocked(resolveMode).mockReturnValue('action');
    vi.mocked(callAI).mockResolvedValue('texto');
    vi.mocked(parseGeminiAction).mockReturnValue(null);
    const deps = makeDeps();

    await runSend(deps, CONFIG, SEND_PARAMS);

    // v3.22.2: ahora se antepone un aviso (chat.actionParseFailed) al texto crudo,
    // para que el usuario entienda que el modelo no devolvió una acción válida.
    const notice = deps.t('chat.actionParseFailed');
    expect(deps.updateMessage).toHaveBeenCalledWith('msg-2', { content: `${notice}\n\n---\ntexto`, isLoading: false });
    expect(deps.setPendingAction).not.toHaveBeenCalled();
  });

  it('modo acción con requiereConfirmacion: abre el modal (setPendingAction)', async () => {
    vi.mocked(resolveMode).mockReturnValue('action');
    vi.mocked(callAI).mockResolvedValue('{...}');
    vi.mocked(parseGeminiAction).mockReturnValue({ accion: 'Crear repo', metodo: 'POST', repo: 'r', requiereConfirmacion: true } as any);
    const deps = makeDeps();

    await runSend(deps, CONFIG, { ...SEND_PARAMS, multiRepoEnabled: false });

    expect(deps.setPendingAction).toHaveBeenCalledWith(expect.objectContaining({ action: expect.objectContaining({ accion: 'Crear repo' }), targetRepos: [] }));
    expect(executeAction).not.toHaveBeenCalled();
  });

  it('modo acción de solo lectura: ejecuta directo y muestra el resultado', async () => {
    vi.mocked(resolveMode).mockReturnValue('action');
    vi.mocked(callAI).mockResolvedValue('{...}');
    vi.mocked(parseGeminiAction).mockReturnValue({ accion: 'Listar', metodo: 'GET', repo: 'r', requiereConfirmacion: false } as any);
    vi.mocked(executeAction).mockResolvedValue({ success: true, message: 'OK', data: [1, 2] } as any);
    const deps = makeDeps();

    await runSend(deps, CONFIG, SEND_PARAMS);

    expect(executeAction).toHaveBeenCalled();
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'completed' }));
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('OK') }));
  });

  it('enriquece un PUT con el contenido actual para el diff', async () => {
    vi.mocked(resolveMode).mockReturnValue('action');
    vi.mocked(callAI).mockResolvedValue('{...}');
    vi.mocked(parseGeminiAction).mockReturnValue({ accion: 'Actualizar', metodo: 'PUT', repo: 'o/r', archivo: 'README.md', requiereConfirmacion: true } as any);
    vi.mocked(getFileContents).mockResolvedValue({ content: 'base64' } as any);
    const deps = makeDeps();

    await runSend(deps, CONFIG, SEND_PARAMS);

    expect(getFileContents).toHaveBeenCalledWith('tok', 'o', 'r', 'README.md');
    expect(deps.setPendingAction).toHaveBeenCalledWith(expect.objectContaining({
      action: expect.objectContaining({ contenidoActual: 'decoded(base64)' }),
    }));
  });

  it('captura errores de la IA en una burbuja', async () => {
    vi.mocked(resolveMode).mockReturnValue('action');
    vi.mocked(callAI).mockRejectedValue(new Error('503 down'));
    const deps = makeDeps();

    await runSend(deps, CONFIG, SEND_PARAMS);

    expect(deps.updateMessage).toHaveBeenCalledWith('msg-2', expect.objectContaining({ content: expect.stringContaining('503 down'), isLoading: false }));
  });

  it('si el usuario cancela (AbortError) muestra "detenido", no una burbuja de error (#40)', async () => {
    vi.mocked(resolveMode).mockReturnValue('action');
    vi.mocked(callAI).mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const deps = makeDeps();

    await runSend(deps, CONFIG, SEND_PARAMS);

    expect(deps.updateMessage).toHaveBeenCalledWith('msg-2', { content: '⏹️ Generación detenida.', isLoading: false });
    expect(deps.setPendingAction).not.toHaveBeenCalled();
  });

  it('con repoContext re-selecciona los archivos relevantes a la pregunta (#49)', async () => {
    vi.mocked(resolveMode).mockReturnValue('chat');
    vi.mocked(callAI).mockResolvedValue('opinión');
    vi.mocked(parseGeminiAction).mockReturnValue(null);
    const deps = makeDeps();

    const repoContext = {
      repoName: 'owner/repo',
      contextText: 'VIEJO',
      filesAnalyzed: 2,
      totalFiles: 3,
      truncated: false,
      files: [
        { path: 'a.ts', content: 'codigo cualquiera', size: 0 },
        { path: 'MEJORAS_FUTURAS.md', content: 'roadmap del proyecto', size: 0 },
      ],
      allPaths: ['a.ts', 'MEJORAS_FUTURAS.md', 'extra.ts'],
    };

    await runSend(deps, CONFIG, {
      ...SEND_PARAMS,
      userText: '¿qué te parece MEJORAS_FUTURAS.md?',
      repoContext: repoContext as any,
    });

    // buildRepoContextSummary se llama con los archivos RANKEADOS por la pregunta
    // (MEJORAS_FUTURAS.md primero por la mención) y el árbol completo (allPaths).
    // #50: con provider=groq, el presupuesto es 6 archivos / 60 líneas (no 12/80).
    const calls = vi.mocked(buildRepoContextSummary).mock.calls;
    const call = calls[calls.length - 1];
    expect(call[0]).toBe('owner/repo');
    expect((call[1] as any[])[0].path).toBe('MEJORAS_FUTURAS.md');
    expect(call[2]).toEqual({ allPaths: ['a.ts', 'MEJORAS_FUTURAS.md', 'extra.ts'], maxFiles: 6, maxLinesPerFile: 60 });
    // #51: la lista de archivos consultados se propaga al mensaje del asistente.
    const updateCalls = vi.mocked(deps.updateMessage).mock.calls;
    const lastUpdate = updateCalls[updateCalls.length - 1][1];
    expect(lastUpdate.consultedFiles).toEqual(['MEJORAS_FUTURAS.md', 'a.ts']);
  });

  it('provider con budget alto (gemini) usa 12/80 (#50)', async () => {
    vi.mocked(resolveMode).mockReturnValue('chat');
    vi.mocked(callAI).mockResolvedValue('opinión');
    vi.mocked(parseGeminiAction).mockReturnValue(null);
    const deps = makeDeps();

    await runSend(deps, { provider: 'gemini' as const, apiKey: 'k', model: 'm' }, {
      ...SEND_PARAMS,
      userText: '¿qué me dices de a.ts?',
      repoContext: {
        repoName: 'owner/repo',
        contextText: 'VIEJO',
        filesAnalyzed: 1,
        totalFiles: 1,
        truncated: false,
        files: [{ path: 'a.ts', content: 'codigo', size: 0 }],
        allPaths: ['a.ts'],
      } as any,
    });

    const calls = vi.mocked(buildRepoContextSummary).mock.calls;
    const call = calls[calls.length - 1];
    // Gemini no declara contextBudget → defaults 12/80.
    expect(call[2]).toEqual({ allPaths: ['a.ts'], maxFiles: 12, maxLinesPerFile: 80 });
  });

  it('reintenta con menos contexto si el primer intento falla por TPM (#50)', async () => {
    vi.mocked(resolveMode).mockReturnValue('chat');
    // Primer intento: error de contexto excesivo (too large). Segundo: éxito.
    const tooLargeErr = Object.assign(new Error('Request too large for model'), { contextTooLarge: true });
    vi.mocked(callAI)
      .mockRejectedValueOnce(tooLargeErr)
      .mockResolvedValueOnce('opinión reducida');
    vi.mocked(parseGeminiAction).mockReturnValue(null);
    const deps = makeDeps();

    await runSend(deps, CONFIG, {
      ...SEND_PARAMS,
      userText: 'pregunta sobre MEJORAS_FUTURAS',
      repoContext: {
        repoName: 'owner/repo',
        contextText: 'VIEJO',
        filesAnalyzed: 2,
        totalFiles: 3,
        truncated: false,
        files: [
          { path: 'a.ts', content: 'codigo', size: 0 },
          { path: 'MEJORAS_FUTURAS.md', content: 'roadmap', size: 0 },
          { path: 'extra.ts', content: 'extra', size: 0 },
          { path: 'd.ts', content: 'd', size: 0 },
          { path: 'e.ts', content: 'e', size: 0 },
          { path: 'f.ts', content: 'f', size: 0 },
        ],
        allPaths: ['a.ts', 'MEJORAS_FUTURAS.md', 'extra.ts', 'd.ts', 'e.ts', 'f.ts'],
      } as any,
    });

    // Tras el error, se reintenta con la mitad de archivos (groq 6 → 3).
    const calls = vi.mocked(buildRepoContextSummary).mock.calls;
    expect(calls.length).toBe(2);
    expect((calls[0][2] as any).maxFiles).toBe(6);
    expect((calls[1][2] as any).maxFiles).toBe(3);
    // El mensaje final refleja la respuesta del segundo intento.
    const updateCalls = vi.mocked(deps.updateMessage).mock.calls;
    const lastUpdate = updateCalls[updateCalls.length - 1][1];
    expect(lastUpdate.content).toBe('opinión reducida');
  });

  it('al cancelar en streaming conserva el texto parcial con la nota (detenido) (#40)', async () => {
    vi.mocked(resolveMode).mockReturnValue('chat');
    vi.mocked(callAI).mockImplementation((async (...args: any[]) => {
      const onToken = args[6] as ((t: string) => void) | undefined;
      onToken?.('texto parcial');
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    }) as any);
    const deps = makeDeps();

    await runSend(deps, CONFIG, SEND_PARAMS);

    expect(deps.updateMessage).toHaveBeenLastCalledWith('msg-2', { content: 'texto parcial\n\n⏹️ _(detenido)_', isLoading: false });
  });
});

describe('runConfirmAction', () => {
  it('ejecuta una acción single y registra el resultado', async () => {
    vi.mocked(executeAction).mockResolvedValue({ success: true, message: 'Hecho' } as any);
    const deps = makeDeps();

    await runConfirmAction(deps, { action: { accion: 'A', repo: 'r' }, targetRepos: [] } as any);

    expect(executeAction).toHaveBeenCalled();
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'completed' }));
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Hecho') }));
  });

  it('muestra ❌ si la acción single falla', async () => {
    vi.mocked(executeAction).mockResolvedValue({ success: false, message: 'No autorizado' } as any);
    const deps = makeDeps();

    await runConfirmAction(deps, { action: { accion: 'A', repo: 'r' }, targetRepos: [] } as any);

    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('No autorizado') }));
  });

  it('aplica la acción a varios repos (multi-repo)', async () => {
    vi.mocked(executeActionMultiRepo).mockResolvedValue(undefined as any);
    const deps = makeDeps();
    const repos = [{ name: 'r1' }, { name: 'r2' }] as any;

    await runConfirmAction(deps, { action: { accion: 'A', repo: null }, targetRepos: repos } as any);

    expect(executeActionMultiRepo).toHaveBeenCalled();
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('2 repositorios') }));
    expect(executeAction).not.toHaveBeenCalled();
  });
});

describe('runCancelAction', () => {
  it('registra la cancelación y avisa', () => {
    const deps = makeDeps();

    runCancelAction(deps, { action: { accion: 'Crear repo', repo: 'r' }, targetRepos: [] } as any);

    expect(deps.addEntry).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled', description: expect.stringContaining('Crear repo') }));
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('cancelada') }));
  });
});

describe('runSend — streaming (#38)', () => {
  it('en modo chat pasa onToken y renderiza el texto acumulado en vivo', async () => {
    vi.mocked(resolveMode).mockReturnValue('chat');
    vi.mocked(callAI).mockImplementation(async (...args: any[]) => {
      const onToken = args[6];
      onToken?.('Parcial');
      onToken?.('Parcial completo');
      return 'Parcial completo';
    });
    vi.mocked(parseGeminiAction).mockReturnValue(null);
    const deps = makeDeps();

    await runSend(deps, CONFIG, SEND_PARAMS);

    expect(deps.updateMessage).toHaveBeenCalledWith('msg-2', { content: 'Parcial', isLoading: true });
    expect(deps.updateMessage).toHaveBeenCalledWith('msg-2', { content: 'Parcial completo', isLoading: true });
  });

  it('en modo acción NO pasa onToken (no se streamea el JSON)', async () => {
    vi.mocked(resolveMode).mockReturnValue('action');
    let received: unknown = 'UNSET';
    vi.mocked(callAI).mockImplementation(async (...args: any[]) => { received = args[6]; return 'texto'; });
    vi.mocked(parseGeminiAction).mockReturnValue(null);
    const deps = makeDeps();

    await runSend(deps, CONFIG, SEND_PARAMS);

    expect(received).toBeUndefined();
  });
});

describe('runAttachFile (#28)', () => {
  it('lee un archivo de texto y devuelve el contexto', async () => {
    vi.mocked(assertSupportedFile).mockReturnValue(undefined);
    vi.mocked(readFileContent).mockResolvedValue('contenido del archivo');
    const deps = makeDeps();

    const ctx = await runAttachFile(deps, new File(['contenido del archivo'], 'notas.md'));

    expect(ctx).toEqual({ name: 'notas.md', contextText: expect.stringContaining('contenido del archivo') });
    expect(deps.updateMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ content: expect.stringContaining('Adjuntado'), isLoading: false }));
  });

  it('devuelve null y avisa si el archivo no es válido', async () => {
    vi.mocked(assertSupportedFile).mockImplementation(() => { throw new Error('No puedo leer archivos «.exe»'); });
    const deps = makeDeps();

    const ctx = await runAttachFile(deps, new File(['x'], 'app.exe'));

    expect(ctx).toBeNull();
    expect(deps.updateMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ content: expect.stringContaining('.exe') }));
  });

  it('devuelve null si no hay texto extraíble', async () => {
    vi.mocked(assertSupportedFile).mockReturnValue(undefined);
    vi.mocked(readFileContent).mockResolvedValue('   ');

    const ctx = await runAttachFile(makeDeps(), new File(['x'], 'scan.pdf'));

    expect(ctx).toBeNull();
  });

  it('Excel grande: usa readSpreadsheet y avisa de la muestra de filas (#28 Fase 3a)', async () => {
    vi.mocked(assertSupportedFile).mockReturnValue(undefined);
    vi.mocked(readSpreadsheet).mockResolvedValue({
      text: '### Hoja "Datos" (50000 filas × 12 columnas)\n...',
      summary: '"Datos" (50.000 filas × 12 columnas)',
      truncated: true,
    });
    const deps = makeDeps();

    const ctx = await runAttachFile(deps, new File(['x'], 'ventas.xlsx'));

    expect(readSpreadsheet).toHaveBeenCalled();
    expect(readFileContent).not.toHaveBeenCalled();
    expect(ctx).toEqual({ name: 'ventas.xlsx', contextText: expect.stringContaining('hoja de cálculo') });
    expect(deps.updateMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      content: expect.stringContaining('muestra de las primeras 100 filas'),
      isLoading: false,
    }));
  });

  it('CSV pequeño: usa readSpreadsheet sin aviso de truncado', async () => {
    vi.mocked(assertSupportedFile).mockReturnValue(undefined);
    vi.mocked(readSpreadsheet).mockResolvedValue({
      text: '### Hoja "Sheet1" (3 filas × 2 columnas)\n...',
      summary: '"Sheet1" (3 filas × 2 columnas)',
      truncated: false,
    });
    const deps = makeDeps();

    const ctx = await runAttachFile(deps, new File(['a,b\n1,2'], 'mini.csv'));

    expect(readSpreadsheet).toHaveBeenCalled();
    expect(ctx).not.toBeNull();
    expect(deps.updateMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      content: expect.stringContaining('Adjuntado'),
    }));
    const msg = vi.mocked(deps.updateMessage).mock.calls[0][1] as { content: string };
    expect(msg.content).not.toContain('muestra de las primeras');
    // #28 v3.7.0: el mensaje guía explica el botón explícito de documentar.
    expect(msg.content).toContain('Documentar repo');
  });

  it('Power BI .pbit: usa readPowerBI y devuelve el contexto (#28 Fase 3b)', async () => {
    vi.mocked(assertSupportedFile).mockReturnValue(undefined);
    vi.mocked(readPowerBI).mockResolvedValue({
      text: '## Informe\n### Página "Ventas"...',
      summary: 'Informe: 2 páginas, 8 visuales · Modelo: 3 tablas, 12 medidas',
      truncated: false,
    });
    const deps = makeDeps();

    const ctx = await runAttachFile(deps, new File(['x'], 'informe.pbit'));

    expect(readPowerBI).toHaveBeenCalled();
    expect(readFileContent).not.toHaveBeenCalled();
    expect(ctx).toEqual({ name: 'informe.pbit', contextText: expect.stringContaining('Power BI') });
    expect(deps.updateMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      content: expect.stringContaining('Modelo: 3 tablas'),
      isLoading: false,
    }));
  });

  it('Power BI grande: avisa de muestra acotada cuando truncado', async () => {
    vi.mocked(assertSupportedFile).mockReturnValue(undefined);
    vi.mocked(readPowerBI).mockResolvedValue({
      text: '## Informe...',
      summary: 'Informe: 40 páginas, 300 visuales',
      truncated: true,
    });
    const deps = makeDeps();

    await runAttachFile(deps, new File(['x'], 'grande.pbix'));

    expect(deps.updateMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      content: expect.stringContaining('muestra acotada'),
    }));
  });

  it('Word .docx: usa readDocx y devuelve el contexto (#28)', async () => {
    vi.mocked(assertSupportedFile).mockReturnValue(undefined);
    vi.mocked(readDocx).mockResolvedValue({
      text: 'Texto de la memoria del proyecto...',
      summary: 'Documento Word: ~520 palabras',
      truncated: false,
    });
    const deps = makeDeps();

    const ctx = await runAttachFile(deps, new File(['x'], 'memoria.docx'));

    expect(readDocx).toHaveBeenCalled();
    expect(readFileContent).not.toHaveBeenCalled();
    expect(ctx).toEqual({ name: 'memoria.docx', contextText: expect.stringContaining('documento Word') });
    expect(deps.updateMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      content: expect.stringContaining('Documento Word: ~520 palabras'),
      isLoading: false,
    }));
  });

  it('Word .docx largo: avisa de parte acotada cuando truncado', async () => {
    vi.mocked(assertSupportedFile).mockReturnValue(undefined);
    vi.mocked(readDocx).mockResolvedValue({
      text: 'Texto largo...',
      summary: 'Documento Word: ~9000 palabras',
      truncated: true,
    });
    const deps = makeDeps();

    await runAttachFile(deps, new File(['x'], 'tesis.docx'));

    expect(deps.updateMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      content: expect.stringContaining('parte acotada'),
    }));
  });
});

describe('runSend — contexto de archivo (#28)', () => {
  it('inyecta el archivo adjunto en el prompt de chat', async () => {
    vi.mocked(resolveMode).mockReturnValue('chat');
    vi.mocked(callAI).mockResolvedValue('ok');
    vi.mocked(parseGeminiAction).mockReturnValue(null);
    const deps = makeDeps();

    await runSend(deps, CONFIG, { ...SEND_PARAMS, fileContext: [{ name: 'a.md', contextText: 'FILE_CTX' }] });

    expect(chatPromptWithContext).toHaveBeenCalledWith(expect.stringContaining('FILE_CTX'));
  });
});

describe('runGenerateFileDoc (#28 Fase 2)', () => {
  const FILE_CTX = { name: 'notas.txt', contextText: 'contenido' };

  it('genera el doc, muestra progreso y lo devuelve', async () => {
    vi.mocked(generateFileDoc).mockResolvedValue('# Doc generada');
    const deps = makeDeps();

    const doc = await runGenerateFileDoc(deps, CONFIG, FILE_CTX);

    expect(generateFileDoc).toHaveBeenCalledWith('notas.txt', 'contenido', CONFIG, undefined, 'es');
    expect(doc).toBe('# Doc generada');
    expect(deps.addMessage).toHaveBeenCalled();
    expect(deps.updateMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ isLoading: false }));
    expect(deps.setIsChatLoading).toHaveBeenLastCalledWith(false);
  });

  it('reenvía la conversación a generateFileDoc (v3.5.0)', async () => {
    vi.mocked(generateFileDoc).mockResolvedValue('# Doc');
    const deps = makeDeps();

    await runGenerateFileDoc(deps, CONFIG, FILE_CTX, 'Usuario: hola');

    expect(generateFileDoc).toHaveBeenCalledWith('notas.txt', 'contenido', CONFIG, 'Usuario: hola', 'es');
  });

  it('ante un error muestra el mensaje y devuelve null', async () => {
    vi.mocked(generateFileDoc).mockRejectedValue(new Error('boom'));
    const deps = makeDeps();

    const doc = await runGenerateFileDoc(deps, CONFIG, FILE_CTX);

    expect(doc).toBeNull();
    expect(deps.updateMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      content: expect.stringContaining('boom'),
      isLoading: false,
    }));
  });
});

describe('runPublishFileDoc (#28 Fase 2)', () => {
  it('commit directo: deriva docs/{base}.md y muestra confirmación', async () => {
    vi.mocked(publishFileDoc).mockResolvedValue({ pr: null, branchName: null });
    const deps = makeDeps();

    await runPublishFileDoc(deps, 'owner', 'repo', 'notas.txt', '# Doc', { draft: false });

    expect(publishFileDoc).toHaveBeenCalledWith('tok', 'owner', 'repo', 'docs/notas.md', '# Doc', { draft: false, sourceFile: undefined });
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('`docs/notas.md` commiteado'),
    }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'completed' }));
  });

  it('reenvía sourceFile + extraFiles a publishFileDoc y avisa del nº de adjuntos (#28 4a/4b)', async () => {
    vi.mocked(publishFileDoc).mockResolvedValue({ pr: null, branchName: null });
    const deps = makeDeps();
    const sourceFile = { name: 'informe.pbit' } as unknown as File;
    const extraFiles = [{ name: 'captura.png' } as unknown as File];

    await runPublishFileDoc(deps, 'owner', 'repo', 'informe.pbit', '# Doc', { draft: false, sourceFile, extraFiles });

    expect(publishFileDoc).toHaveBeenCalledWith('tok', 'owner', 'repo', 'docs/informe.md', '# Doc', { draft: false, sourceFile, extraFiles });
    // 1 fuente + 1 extra = 2 adjuntos.
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('2 archivo(s) adjunto(s)'),
    }));
  });

  it('Draft PR: muestra el enlace al PR', async () => {
    vi.mocked(publishFileDoc).mockResolvedValue({ pr: { number: 5, html_url: 'http://pr/5' } as any, branchName: 'docs/file-1' });
    const deps = makeDeps();

    await runPublishFileDoc(deps, 'owner', 'repo', 'notas.txt', '# Doc', { draft: true });

    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('[#5](http://pr/5)'),
    }));
  });

  it('ante un error marca la entrada de historial como error', async () => {
    vi.mocked(publishFileDoc).mockRejectedValue(new Error('falló'));
    const deps = makeDeps();

    await runPublishFileDoc(deps, 'owner', 'repo', 'a.md', '# D', {});

    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('falló'),
    }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'error' }));
  });
});

describe('runCreateFileRelease (#28 Fase 2)', () => {
  it('usa la versión sugerida cuando no se indica y crea el release', async () => {
    vi.mocked(suggestNextVersion).mockResolvedValue('v1.2.0');
    vi.mocked(createGitHubRelease).mockResolvedValue({ url: 'http://rel', id: 1 } as any);
    const deps = makeDeps();

    await runCreateFileRelease(deps, 'owner', 'repo', 'notas.txt', '# Doc');

    expect(suggestNextVersion).toHaveBeenCalledWith('tok', 'owner', 'repo');
    expect(createGitHubRelease).toHaveBeenCalledWith('tok', 'owner', 'repo', expect.objectContaining({
      version: 'v1.2.0',
      body: '# Doc',
    }));
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('[v1.2.0](http://rel)'),
    }));
  });

  it('respeta la versión indicada y NO llama a suggestNextVersion', async () => {
    vi.mocked(createGitHubRelease).mockResolvedValue({ url: 'http://rel', id: 1 } as any);
    const deps = makeDeps();

    await runCreateFileRelease(deps, 'owner', 'repo', 'a.md', '# D', 'v9.9.9');

    expect(suggestNextVersion).not.toHaveBeenCalled();
    expect(createGitHubRelease).toHaveBeenCalledWith('tok', 'owner', 'repo', expect.objectContaining({ version: 'v9.9.9' }));
  });

  it('con sourceFile lo sube como asset del release (#28 4a)', async () => {
    vi.mocked(createGitHubRelease).mockResolvedValue({ url: 'http://rel', id: 77 } as any);
    vi.mocked(uploadReleaseAsset).mockResolvedValue({ url: 'http://asset', name: 'informe.pbit' });
    const deps = makeDeps();
    const sourceFile = { name: 'informe.pbit' } as unknown as File;

    await runCreateFileRelease(deps, 'owner', 'repo', 'informe.pbit', '# D', 'v1.0.0', sourceFile);

    expect(uploadReleaseAsset).toHaveBeenCalledWith('tok', 'owner', 'repo', 77, expect.objectContaining({ name: 'informe.pbit', file: sourceFile }));
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('adjuntado al release'),
    }));
  });

  it('sube el sourceFile y los extras como assets del release (#28 4b)', async () => {
    vi.mocked(createGitHubRelease).mockResolvedValue({ url: 'http://rel', id: 5 } as any);
    vi.mocked(uploadReleaseAsset).mockResolvedValue({ url: 'http://asset', name: 'x' });
    const deps = makeDeps();
    const sourceFile = { name: 'informe.pbit' } as unknown as File;
    const extraFiles = [{ name: 'captura.png' } as unknown as File, { name: 'datos.xlsx' } as unknown as File];

    await runCreateFileRelease(deps, 'owner', 'repo', 'informe.pbit', '# D', 'v1.0.0', sourceFile, extraFiles);

    const names = vi.mocked(uploadReleaseAsset).mock.calls.map(c => (c[4] as { name: string }).name);
    expect(names).toEqual(['informe.pbit', 'captura.png', 'datos.xlsx']);
  });

  it('ante un error marca la entrada como error', async () => {
    vi.mocked(suggestNextVersion).mockResolvedValue('v1.0.0');
    vi.mocked(createGitHubRelease).mockRejectedValue(new Error('rel-err'));
    const deps = makeDeps();

    await runCreateFileRelease(deps, 'owner', 'repo', 'a.md', '# D');

    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'error' }));
  });
});

describe('runCreateRepoRelease (#28 v3.8.0)', () => {
  const ANALYSIS_R = {
    readme: '# README', manualTecnico: '# Manual', filesAnalyzed: 3, totalFiles: 3,
    truncated: false, repoName: 'owner/repo',
  };

  it('usa la versión sugerida si no se indica y crea el release con el README como notas', async () => {
    vi.mocked(suggestNextVersion).mockResolvedValue('v1.2.0');
    vi.mocked(createGitHubRelease).mockResolvedValue({ url: 'http://rel', id: 1 } as any);
    const deps = makeDeps();

    await runCreateRepoRelease(deps, ANALYSIS_R as any);

    expect(suggestNextVersion).toHaveBeenCalledWith('tok', 'owner', 'repo');
    expect(createGitHubRelease).toHaveBeenCalledWith('tok', 'owner', 'repo', expect.objectContaining({
      version: 'v1.2.0',
      body: '# README',
    }));
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('[v1.2.0](http://rel)'),
    }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'completed' }));
  });

  it('respeta la versión indicada y, ante error, marca la entrada como error', async () => {
    vi.mocked(createGitHubRelease).mockRejectedValue(new Error('boom'));
    const deps = makeDeps();

    await runCreateRepoRelease(deps, ANALYSIS_R as any, 'v9.9.9');

    expect(suggestNextVersion).not.toHaveBeenCalled();
    expect(createGitHubRelease).toHaveBeenCalledWith('tok', 'owner', 'repo', expect.objectContaining({ version: 'v9.9.9' }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'error' }));
  });
});

describe('runCreateRepo (#28 fix)', () => {
  it('crea el repo y devuelve true', async () => {
    vi.mocked(createRepo).mockResolvedValue({ full_name: 'me/nuevo' } as any);
    const deps = makeDeps();

    const ok = await runCreateRepo(deps, 'nuevo');

    expect(ok).toBe(true);
    // v3.31.0: la descripción por defecto es ahora la firma dinámica (usuario + IA).
    expect(createRepo).toHaveBeenCalledWith('tok', 'nuevo',
      expect.stringContaining('Creado por @me y documentado por Groq'));
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('creado'),
    }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'completed' }));
  });

  it('respeta una descripción explícita si se pasa (no usa la firma)', async () => {
    vi.mocked(createRepo).mockResolvedValue({ full_name: 'me/nuevo' } as any);
    const deps = makeDeps();

    await runCreateRepo(deps, 'nuevo', { description: 'descripción personalizada' });

    expect(createRepo).toHaveBeenCalledWith('tok', 'nuevo', 'descripción personalizada');
  });

  it('ante un error devuelve false y avisa', async () => {
    vi.mocked(createRepo).mockRejectedValue(new Error('name already exists'));
    const deps = makeDeps();

    const ok = await runCreateRepo(deps, 'nuevo');

    expect(ok).toBe(false);
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('No pude crear'),
    }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'error' }));
  });
});

describe('runPublishFileDocByKind (#28 fix)', () => {
  const target = (kind: 'commit' | 'draftpr' | 'release', version?: string) =>
    ({ owner: 'me', repo: 'r', fileName: 'a.md', doc: '# D', kind, version });

  it('commit → publishFileDoc sin draft', async () => {
    vi.mocked(publishFileDoc).mockResolvedValue({ pr: null, branchName: null } as any);
    await runPublishFileDocByKind(makeDeps(), target('commit'));
    expect(publishFileDoc).toHaveBeenCalledWith('tok', 'me', 'r', 'docs/a.md', '# D', { draft: false });
  });

  it('draftpr → publishFileDoc con draft', async () => {
    vi.mocked(publishFileDoc).mockResolvedValue({ pr: { number: 1, html_url: 'u' }, branchName: 'b' } as any);
    await runPublishFileDocByKind(makeDeps(), target('draftpr'));
    expect(publishFileDoc).toHaveBeenCalledWith('tok', 'me', 'r', 'docs/a.md', '# D', { draft: true });
  });

  it('release → createGitHubRelease', async () => {
    vi.mocked(createGitHubRelease).mockResolvedValue({ url: 'http://rel', id: 1 } as any);
    await runPublishFileDocByKind(makeDeps(), target('release', 'v2.0.0'));
    expect(createGitHubRelease).toHaveBeenCalledWith('tok', 'me', 'r', expect.objectContaining({ version: 'v2.0.0' }));
  });
});

describe('runStartPublish (#28 fix)', () => {
  const target = { owner: 'me', repo: 'r', fileName: 'a.md', doc: '# D', kind: 'commit' as const };

  it('repo existe → publica y devuelve "published"', async () => {
    vi.mocked(repoExists).mockResolvedValue(true);
    vi.mocked(publishFileDoc).mockResolvedValue({ pr: null, branchName: null } as any);
    const deps = makeDeps();

    const res = await runStartPublish(deps, target, true);

    expect(res).toBe('published');
    expect(publishFileDoc).toHaveBeenCalled();
  });

  it('repo no existe y es de la cuenta → "repo-missing" sin publicar', async () => {
    vi.mocked(repoExists).mockResolvedValue(false);
    const deps = makeDeps();

    const res = await runStartPublish(deps, target, true);

    expect(res).toBe('repo-missing');
    expect(publishFileDoc).not.toHaveBeenCalled();
  });

  it('repo no existe y es de otra cuenta → "handled" + aviso claro', async () => {
    vi.mocked(repoExists).mockResolvedValue(false);
    const deps = makeDeps();

    const res = await runStartPublish(deps, { ...target, owner: 'otra' }, false);

    expect(res).toBe('handled');
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('solo puedo crear repositorios en tu cuenta'),
    }));
    expect(publishFileDoc).not.toHaveBeenCalled();
  });

  it('error al comprobar → "handled" + aviso', async () => {
    vi.mocked(repoExists).mockRejectedValue(new Error('boom'));
    const deps = makeDeps();

    const res = await runStartPublish(deps, target, true);

    expect(res).toBe('handled');
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('No pude comprobar'),
    }));
  });
});

// ── runCreateRepoAndDocument (#57 Tanda B fix) ────────────────────────────────
describe('runCreateRepoAndDocument (#57 Tanda B fix)', () => {
  const makeFile = (name: string) => new File(['x'], name, { type: 'text/plain' });

  it('crea el repo, sube archivos extras y devuelve el análisis', async () => {
    vi.mocked(createRepo).mockResolvedValue({ full_name: 'me/nuevo' } as any);
    vi.mocked(uploadFilesToRepo).mockResolvedValue(undefined);
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }], totalScanned: 1, truncated: false, allPaths: ['a'] } as any);
    vi.mocked(generateRepoDocs).mockResolvedValue({ readme: 'R', manualTecnico: 'M' } as any);
    const deps = makeDeps();

    const files = [makeFile('logo.png'), makeFile('data.csv')];
    const result = await runCreateRepoAndDocument(deps, CONFIG, 'me/nuevo-repo', files);

    expect(result).not.toBeNull();
    expect(createRepo).toHaveBeenCalledWith('tok', 'nuevo-repo', expect.any(String));
    expect(uploadFilesToRepo).toHaveBeenCalledWith('tok', 'me', 'nuevo-repo', files);
    expect(generateRepoDocs).toHaveBeenCalled();
  });

  it('sin archivos extras: solo crea el repo y documenta', async () => {
    vi.mocked(createRepo).mockResolvedValue({ full_name: 'me/nuevo' } as any);
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }], totalScanned: 1, truncated: false, allPaths: ['a'] } as any);
    vi.mocked(generateRepoDocs).mockResolvedValue({ readme: 'R', manualTecnico: 'M' } as any);
    const deps = makeDeps();

    const result = await runCreateRepoAndDocument(deps, CONFIG, 'me/nuevo-repo');

    expect(result).not.toBeNull();
    expect(uploadFilesToRepo).not.toHaveBeenCalled();
  });

  it('repo de otra cuenta → aviso y null', async () => {
    const deps = makeDeps();
    const result = await runCreateRepoAndDocument(deps, CONFIG, 'otro/nuevo-repo');
    expect(result).toBeNull();
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('solo puedo crear repositorios en tu cuenta'),
    }));
  });
});

// ── buildSignature (v3.31.0) ──────────────────────────────────────────────────
describe('buildSignature (v3.31.0)', () => {
  it('ES: "Creado por @{login} y documentado por {Provider} ({model}) desde la App Asistente de IA"', () => {
    const sig = buildSignature({
      user: { login: 'migueljerico' },
      providerName: 'Google Gemini',
      model: 'gemini-2.5-flash',
      provider: 'gemini',
      lang: 'es',
    });
    // gemini-2.5-flash tiene label i18n (provider.gemini.model.*) → se usa el value.
    expect(sig).toBe('Creado por @migueljerico y documentado por Google Gemini (gemini-2.5-flash) desde la App Asistente de IA');
  });

  it('EN: "Created by @{login} and documented by {Provider} ({model}) from the AI Assistant App"', () => {
    const sig = buildSignature({
      user: { login: 'migueljerico' },
      providerName: 'Google Gemini',
      model: 'gemini-2.5-flash',
      provider: 'gemini',
      lang: 'en',
    });
    expect(sig).toBe('Created by @migueljerico and documented by Google Gemini (gemini-2.5-flash) from the AI Assistant App');
  });

  it('usa la label legible cuando no es clave i18n (Groq fallback)', () => {
    const sig = buildSignature({
      user: { login: 'me' },
      providerName: 'Groq Cloud',
      model: 'llama-3.1-8b-instant',
      provider: 'groq',
      lang: 'es',
    });
    expect(sig).toContain('Llama 3.1 8B (fast)');
  });

  it('cae al value si el modelo no está en el catálogo estático', () => {
    const sig = buildSignature({
      user: { login: 'me' },
      providerName: 'OpenRouter',
      model: 'foo/bar:free',
      provider: 'openrouter',
      lang: 'es',
    });
    expect(sig).toContain('foo/bar:free');
  });
});

// ── runCommitDocs actualiza el about del repo (v3.31.0) ───────────────────────
describe('runCommitDocs — about del repo (v3.31.0)', () => {
  it('tras commitear, actualiza el about con resumen + firma', async () => {
    vi.mocked(writeDocFiles).mockResolvedValue(undefined as any);
    const deps = makeDeps();
    const analysis = { ...ANALYSIS, resumen: 'Dashboard de Power BI de ventas' };

    await runCommitDocs(deps, analysis);

    expect(updateRepo).toHaveBeenCalledWith('tok', 'owner', 'repo', {
      description: expect.stringContaining('Dashboard de Power BI de ventas — Creado por @me'),
    });
  });

  it('si updateRepo falla, no rompe la publicación (la doc ya está commiteada)', async () => {
    vi.mocked(writeDocFiles).mockResolvedValue(undefined as any);
    vi.mocked(updateRepo).mockRejectedValueOnce(new Error('403 forbidden') as any);
    const deps = makeDeps();

    await runCommitDocs(deps, ANALYSIS);

    // El commit se hizo y el entry quedó completed; el fallo del about solo avisa.
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'completed' }));
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('about'),
    }));
  });
});

// ── runSyncRepoStatus (#48) ───────────────────────────────────────────────────
describe('runSyncRepoStatus (#48)', () => {
  const makeDepsSync = () => ({
    token: 'tok',
    user: { login: 'me' },
    providerName: 'Groq',
    model: 'llama-3.1-70b-versatile',
    provider: 'groq' as const,
    addMessage: vi.fn(() => `msg-${Date.now()}`),
    updateMessage: vi.fn(),
    addEntry: vi.fn(() => 'hist-1'),
    updateEntry: vi.fn(),
    setIsChatLoading: vi.fn(),
    t: (k: string) => k,
    lang: 'es' as const,
  });

  const COMMIT_DETAILS = [
    {
      sha: 'abc12345',
      message: 'feat: add new feature\n\nDescription here',
      author: { name: 'John', email: 'john@example.com', date: '2024-01-15T10:00:00Z' },
      files: [
        { filename: 'src/feature.ts', status: 'added', additions: 50, deletions: 0, changes: 50, patch: '+export function foo() {}\n' },
      ],
    },
    {
      sha: 'def67890',
      message: 'fix: resolve bug in login',
      author: { name: 'Jane', email: 'jane@example.com', date: '2024-01-14T15:00:00Z' },
      files: [
        { filename: 'src/auth.ts', status: 'modified', additions: 10, deletions: 5, changes: 15, patch: '-const x = 1;\n+const x = 2;\n' },
      ],
    },
  ];

  it('analiza commits recientes y devuelve resumen IA', async () => {
    vi.mocked(listRecentCommits).mockResolvedValue([
      { sha: 'abc12345', message: 'feat: add new feature' },
      { sha: 'def67890', message: 'fix: resolve bug' },
    ]);
    vi.mocked(getCommit)
      .mockResolvedValueOnce(COMMIT_DETAILS[0] as any)
      .mockResolvedValueOnce(COMMIT_DETAILS[1] as any);
    vi.mocked(callAI).mockResolvedValue('Resumen IA: 2 commits analizados (1 feature, 1 fix).');

    const deps = makeDepsSync();
    const result = await runSyncRepoStatus(deps, 'owner/repo', { provider: 'groq', apiKey: 'k', model: 'm' });

    expect(result).not.toBeNull();
    expect(result!.commitsAnalyzed).toBe(2);
    expect(result!.summary).toBe('Resumen IA: 2 commits analizados (1 feature, 1 fix).');
    expect(listRecentCommits).toHaveBeenCalledWith('tok', 'owner', 'repo', 10);
    expect(getCommit).toHaveBeenCalledTimes(2);
    expect(callAI).toHaveBeenCalled();
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'completed' }));
  });

  it('devuelve null si no hay commits recientes', async () => {
    vi.mocked(listRecentCommits).mockResolvedValue([]);
    const deps = makeDepsSync();

    const result = await runSyncRepoStatus(deps, 'owner/repo', { provider: 'groq', apiKey: 'k', model: 'm' });

    expect(result).not.toBeNull();
    expect(result!.commitsAnalyzed).toBe(0);
    expect(result!.summary).toBe('syncRepo.noCommits');
    expect(deps.updateMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ content: expect.stringContaining('commits recientes'), isLoading: false }));
  });

  it('maneja error al obtener commits', async () => {
    vi.mocked(listRecentCommits).mockRejectedValue(new Error('404 Not Found'));
    const deps = makeDepsSync();

    const result = await runSyncRepoStatus(deps, 'owner/repo', { provider: 'groq', apiKey: 'k', model: 'm' });

    expect(result).toBeNull();
    expect(deps.updateMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ content: expect.stringContaining('404'), isLoading: false }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'error' }));
  });

  it('respeta opciones maxCommits e includeDiffs', async () => {
    vi.mocked(listRecentCommits).mockResolvedValue([
      { sha: 'a1', message: 'c1' },
      { sha: 'a2', message: 'c2' },
      { sha: 'a3', message: 'c3' },
    ]);
    vi.mocked(getCommit).mockResolvedValue(COMMIT_DETAILS[0] as any);
    vi.mocked(callAI).mockResolvedValue('OK');

    const deps = makeDepsSync();
    await runSyncRepoStatus(deps, 'owner/repo', { provider: 'groq', apiKey: 'k', model: 'm' }, { maxCommits: 2, includeDiffs: false });

    expect(listRecentCommits).toHaveBeenCalledWith('tok', 'owner', 'repo', 2);
  });
});

describe('runSecurityAudit (#52)', () => {
  const CONFIG = { provider: 'groq' as const, apiKey: 'k', model: 'm' };

  it('camino feliz: carga archivos sensibles, llama a callAI en modo chat con SECURITY_PROMPT', async () => {
    // fetchRepoTreeRecursive devuelve allPaths con un workflow (lo descubre resolveSensitivePaths).
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({
      files: [], totalScanned: 0, truncated: false, allPaths: ['.github/workflows/ci.yml'],
    } as any);
    // package.json existe; package-lock.json NO (404 → se traga).
    vi.mocked(getFileContents).mockImplementation(async (...args: unknown[]) => {
      const path = args[3] as string;
      if (path === 'package-lock.json') {
        const { GitHubAPIError } = await import('../github');
        throw new GitHubAPIError('Not Found', 404);
      }
      return { content: btoa(`content of ${path}`) } as any;
    });
    vi.mocked(callAI).mockResolvedValue('AUDITORÍA OK');

    const deps = makeDeps();
    await runSecurityAudit(deps, CONFIG, 'owner/repo');

    // 1. callAI recibe modo 'chat' (lectura-only) y el prompt de seguridad con directiva ES.
    expect(callAI).toHaveBeenCalledTimes(1);
    const args = vi.mocked(callAI).mock.calls[0];
    expect(args[5]).toBe('chat'); // 6º arg = mode
    expect(String(args[1])).toContain('SECURITY_PROMPT');
    expect(String(args[1])).toContain('IMPORTANTE: Responde al usuario en español.');

    // 2. Se intentó cargar package.json y package-lock.json (entre los fijos).
    const fetchedPaths = vi.mocked(getFileContents).mock.calls.map(c => c[3]);
    expect(fetchedPaths).toContain('package.json');
    expect(fetchedPaths).toContain('package-lock.json');
    expect(fetchedPaths).toContain('.github/workflows/ci.yml');

    // 3. El resultado se vuelca en la burbuja (no se persiste en ningún sitio).
    expect(deps.updateMessage).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ content: 'AUDITORÍA OK', isLoading: false }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'completed' }));
  });

  it('sin repo (input vacío) → avisa con chat.repoNeeded y no llama a la IA', async () => {
    const deps = makeDeps();
    await runSecurityAudit(deps, CONFIG, '');
    expect(callAI).not.toHaveBeenCalled();
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('owner/repo') }));
  });

  it('traga 404 sin romper y prosigue con los archivos que sí existen', async () => {
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [], totalScanned: 0, truncated: false, allPaths: [] } as any);
    vi.mocked(getFileContents).mockImplementation(async () => {
      const { GitHubAPIError } = await import('../github');
      throw new GitHubAPIError('Not Found', 404);
    });
    vi.mocked(callAI).mockResolvedValue('SIN ARCHIVOS SENSIBLES');

    const deps = makeDeps();
    await runSecurityAudit(deps, CONFIG, 'owner/repo');

    // Todos los ficheros dieron 404 pero la auditoría no aborta: llama a la IA y
    // responde (el prompt ya indica cómo actuar sin archivos sensibles).
    expect(callAI).toHaveBeenCalledTimes(1);
    expect(deps.updateMessage).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ content: 'SIN ARCHIVOS SENSIBLES', isLoading: false }));
  });
});

// ── runGenerateSpecificDoc / runPublishSpecificDoc (#58 Fase 2, #26 v3.50.6) ─
// Estas dos funciones estaban exportadas pero sin suite propia.

describe('runGenerateSpecificDoc', () => {
  it('camino feliz: genera la doc y la devuelve', async () => {
    vi.mocked(getFileContents).mockResolvedValue({ content: 'b64', sha: 's1' } as any);
    vi.mocked(generateSpecificDoc).mockResolvedValue('# Doc generada');

    const deps = makeDeps();
    const doc = await runGenerateSpecificDoc(deps, CONFIG, 'owner/repo', 'src/a.ts');

    expect(doc).toBe('# Doc generada');
    expect(generateSpecificDoc).toHaveBeenCalledWith('src/a.ts', 'decoded(b64)', undefined, CONFIG, 'es');
    expect(deps.updateMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ isLoading: false, content: expect.stringContaining('🔄 Se actualizará') })
    );
    expect(deps.setIsChatLoading).toHaveBeenLastCalledWith(false);
  });

  it('si el archivo no existe (getFileContents 404), genera doc nueva desde cero', async () => {
    vi.mocked(getFileContents).mockRejectedValue(new Error('404'));
    vi.mocked(generateSpecificDoc).mockResolvedValue('# Nueva doc');

    const deps = makeDeps();
    const doc = await runGenerateSpecificDoc(deps, CONFIG, 'owner/repo', 'nuevo.md');

    expect(doc).toBe('# Nueva doc');
    expect(generateSpecificDoc).toHaveBeenCalledWith('nuevo.md', undefined, undefined, CONFIG, 'es');
    expect(deps.updateMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ content: expect.stringContaining('✨ Es un documento nuevo') })
    );
  });

  it('usa existingContent explícito en vez de hacer fetch (#58 Fase 3)', async () => {
    vi.mocked(generateSpecificDoc).mockResolvedValue('# Actualizada');

    const deps = makeDeps();
    await runGenerateSpecificDoc(deps, CONFIG, 'owner/repo', 'a.ts', 'CONTENIDO_PREVIO');

    expect(getFileContents).not.toHaveBeenCalled();
    expect(generateSpecificDoc).toHaveBeenCalledWith('a.ts', 'CONTENIDO_PREVIO', undefined, CONFIG, 'es');
  });

  it('incorpora la conversación como contexto cuando se pasa', async () => {
    vi.mocked(generateSpecificDoc).mockResolvedValue('# Doc');

    const deps = makeDeps();
    await runGenerateSpecificDoc(deps, CONFIG, 'owner/repo', 'a.ts', undefined, 'pregunta previa del usuario');

    expect(generateSpecificDoc).toHaveBeenCalledWith(
      'a.ts', undefined, 'Usuario: pregunta previa del usuario', CONFIG, 'es'
    );
  });

  it('si la IA falla, devuelve null y marca la entrada como error', async () => {
    vi.mocked(getFileContents).mockRejectedValue(new Error('404'));
    vi.mocked(generateSpecificDoc).mockRejectedValue(new Error('IA caída'));

    const deps = makeDeps();
    const doc = await runGenerateSpecificDoc(deps, CONFIG, 'owner/repo', 'a.ts');

    expect(doc).toBeNull();
    expect(deps.updateMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ content: expect.stringContaining('IA caída'), isLoading: false })
    );
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'error' }));
    expect(deps.setIsChatLoading).toHaveBeenLastCalledWith(false);
  });
});

describe('runPublishSpecificDoc', () => {
  it('kind=commit → publishFileDoc sin draft y commitea', async () => {
    vi.mocked(publishFileDoc).mockResolvedValue({ pr: null } as any);

    const deps = makeDeps();
    await runPublishSpecificDoc(deps, 'owner', 'repo', 'a.ts', '# Doc', 'commit');

    expect(publishFileDoc).toHaveBeenCalledWith('tok', 'owner', 'repo', 'a.ts', '# Doc', expect.objectContaining({ draft: false }));
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('commiteado'),
    }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'completed' }));
  });

  it('kind=draftpr → publishFileDoc con draft:true y abre PR', async () => {
    vi.mocked(publishFileDoc).mockResolvedValue({ pr: { number: 7, html_url: 'https://gh/pr/7' } } as any);

    const deps = makeDeps();
    await runPublishSpecificDoc(deps, 'owner', 'repo', 'a.ts', '# Doc', 'draftpr');

    expect(publishFileDoc).toHaveBeenCalledWith('tok', 'owner', 'repo', 'a.ts', '# Doc', expect.objectContaining({ draft: true }));
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Draft PR'),
    }));
  });

  it('kind=release → suggestNextVersion + createGitHubRelease', async () => {
    vi.mocked(suggestNextVersion).mockResolvedValue('v1.2.0');
    vi.mocked(createGitHubRelease).mockResolvedValue({ url: 'https://gh/release/1' } as any);

    const deps = makeDeps();
    await runPublishSpecificDoc(deps, 'owner', 'repo', 'a.ts', '# Doc', 'release');

    expect(suggestNextVersion).toHaveBeenCalledWith('tok', 'owner', 'repo');
    expect(createGitHubRelease).toHaveBeenCalledWith('tok', 'owner', 'repo', expect.objectContaining({
      version: 'v1.2.0', body: '# Doc',
    }));
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('v1.2.0'),
    }));
    expect(publishFileDoc).not.toHaveBeenCalled();
  });

  it('propaga el error como mensaje de assistant y marca entry error', async () => {
    vi.mocked(publishFileDoc).mockRejectedValue(new Error('403 forbidden'));

    const deps = makeDeps();
    await runPublishSpecificDoc(deps, 'owner', 'repo', 'a.ts', '# Doc', 'commit');

    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Error al publicar a.ts'),
    }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'error' }));
  });
});
