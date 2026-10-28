import { describe, it, expect, vi, beforeEach } from 'vitest';
import { es } from '../../i18n/es';

// Mock de los servicios de los que dependen las acciones
vi.mock('../gemini', () => {
  const parseGeminiAction = vi.fn();
  return {
    generateRepoDocs: vi.fn(),
    generateFileDoc: vi.fn(),
    generateSpecificDoc: vi.fn(),
    buildRepoContextSummary: vi.fn(() => 'GENERAL_CTX'),
    buildSecurityAuditContext: vi.fn(() => 'AUDIT_CTX'),
    callAI: vi.fn(),
    parseGeminiAction,
    // v3.56.0: por defecto, el parser con diagnóstico delega en parseGeminiAction.
    // Si devuelve acción, ok; si no, error genérico. Los tests nuevos pueden sobrescribir.
    parseGeminiActionWithReason: vi.fn((raw: string) => {
      const action = parseGeminiAction(raw);
      return action ? { action } : { action: null, error: 'no se encontró JSON de acción válido' };
    }),
    // v3.56.0: parser plural — por defecto envuelve el singular en un array.
    parseGeminiActions: vi.fn((raw: string) => {
      const action = parseGeminiAction(raw);
      return action ? [action] : [];
    }),
    isAbortError: (err: unknown) => (err as { name?: string })?.name === 'AbortError',
    chatPromptWithContext: vi.fn(() => 'CTX_PROMPT'),
    // #24 Fase 3: helper real (devuelve el prompt con la directiva de idioma).
    withLangDirective: (prompt: string, lang: string) =>
      prompt + (lang === 'en' ? '\n\nIMPORTANT: Respond to the user in English.' : '\n\nIMPORTANTE: Responde al usuario en español.'),
    CHAT_PROMPT: 'CHAT_PROMPT',
    ACTION_PROMPT: 'ACTION_PROMPT',
    SECURITY_PROMPT: 'SECURITY_PROMPT',
  };
});
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
  publishBulkCommit: vi.fn(),
  publishBulkDraftPr: vi.fn(),
  // v3.66.0 (Frente D): isImageFile real para que runAttachFile decida bien.
  isImageFile: (name: string) => /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name),
  uploadPathFor: (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const safe = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_');
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return `screenshots/${safe}`;
    if (['xlsx', 'xls', 'csv', 'json', 'parquet'].includes(ext)) return `data/${safe}`;
    return safe;
  },
  // #58 (b): constantes reales (no mocks) para que runDocumentRepo las use.
  README_PATH: 'README.md',
  MANUAL_PATH: 'MANUAL_TECNICO.md',
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
vi.mock('../../utils/modeDetection', () => ({
  resolveMode: vi.fn(),
  // v3.56.0: por defecto sin mismatch (comportamiento previo). Los tests que quieran
  // ejercitar la detección de desajuste lo sobrescriben con vi.mocked(...).
  detectModeMismatch: vi.fn(() => null),
}));
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

import { generateRepoDocs, generateFileDoc, generateSpecificDoc, buildRepoContextSummary, buildSecurityAuditContext, callAI, parseGeminiAction, parseGeminiActions, parseGeminiActionWithReason, chatPromptWithContext } from '../gemini';
import { assertSupportedFile, readFileContent } from '../../utils/pdfReader';
import { readSpreadsheet } from '../../utils/spreadsheetReader';
import { readPowerBI } from '../../utils/powerbiReader';
import { readDocx } from '../../utils/docxReader';
import { fetchRepoTreeRecursive, getFileContents, createRepo, repoExists, getRepo, updateRepo, listCommitDates, listRecentCommits, getCommit, GitHubAPIError } from '../github';
import { writeDocFiles, createDocsDraftPr, publishFileDoc, uploadFilesToRepo, publishBulkCommit, publishBulkDraftPr } from '../docPublisher';
import { summarizeThread, parseThreadInput, listOpenThreads, formatThreadList } from '../threadSummary';
import { generateChangelog } from '../changelogGenerator';
import { executeAction, executeActionMultiRepo } from '../actionExecutor';
import { createGitHubRelease, suggestNextVersion } from '../../utils/releaseGenerator';
import { uploadReleaseAsset } from '../../utils/releaseAssets';
import { resolveMode, detectModeMismatch } from '../../utils/modeDetection';
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
  fetchExistingFileDoc,
  docPathFor,
  runPublishBulk,
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
    // v3.56.2: mock del acumulador de acciones en modo revisión (#58c).
    addReviewAction: vi.fn(),
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
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }, { path: 'b' }], totalScanned: 2, truncated: false, allPaths: ['a', 'b'], binaryPaths: ['assets/logo.svg'] } as any);
    vi.mocked(generateRepoDocs).mockResolvedValue({ readme: 'R', manualTecnico: 'M' } as any);
    const deps = makeDeps();

    const result = await runDocumentRepo(deps, CONFIG, 'owner/repo');

    // #58 (b): cuando !alreadyDocumented, no se hacen fetches del contenido
    // actual y readmeActual/manualActual quedan como undefined.
    expect(result).toEqual({ readme: 'R', manualTecnico: 'M', filesAnalyzed: 2, totalFiles: 2, truncated: false, repoName: 'owner/repo', alreadyDocumented: false, readmeActual: undefined, manualActual: undefined });
    expect(getFileContents).not.toHaveBeenCalled();
    expect(getRepo).toHaveBeenCalledWith('tok', 'owner', 'repo');
    expect(fetchRepoTreeRecursive).toHaveBeenCalledWith('tok', 'owner', 'repo', 'main');
    // v4.0.48: los binaryPaths del árbol llegan a generateRepoDocs vía docOptions.
    expect(generateRepoDocs).toHaveBeenCalledWith('owner/repo', expect.any(Array), CONFIG, 'es', undefined, { binaryPaths: ['assets/logo.svg'] });
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'pending' }));
    expect(deps.setIsChatLoading).toHaveBeenLastCalledWith(false);
  });

  it('propaga extraFiles conteniendo imagenes a generateRepoDocs', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }], totalScanned: 1, truncated: false, allPaths: ['a'], binaryPaths: [] } as any);
    vi.mocked(generateRepoDocs).mockResolvedValue({ readme: 'R', manualTecnico: 'M' } as any);
    const deps = makeDeps();

    const imageFile = new File(['dummy'], 'screen.png', { type: 'image/png' });
    await runDocumentRepo(deps, CONFIG, 'owner/repo', [imageFile]);

    expect(generateRepoDocs).toHaveBeenCalledWith('owner/repo', expect.any(Array), CONFIG, 'es', ['screen.png'], { binaryPaths: [] });
  });

  it('propaga extraFiles saneando acentos en nombres de imagen a generateRepoDocs', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }], totalScanned: 1, truncated: false, allPaths: ['a'], binaryPaths: [] } as any);
    vi.mocked(generateRepoDocs).mockResolvedValue({ readme: 'R', manualTecnico: 'M' } as any);
    const deps = makeDeps();

    const imageFile = new File(['dummy'], 'Captura_Infografía_Notebook.png', { type: 'image/png' });
    await runDocumentRepo(deps, CONFIG, 'owner/repo', [imageFile]);

    expect(generateRepoDocs).toHaveBeenCalledWith('owner/repo', expect.any(Array), CONFIG, 'es', ['Captura_Infografia_Notebook.png'], { binaryPaths: [] });
  });

  it('notifica en el chat cuando se empleó fallbackModel por sobrecarga', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }], totalScanned: 1, truncated: false, allPaths: ['a'] } as any);
    vi.mocked(generateRepoDocs).mockResolvedValue({
      readme: 'R',
      manualTecnico: 'M',
      metadatos: { fallbackModel: 'gemini-2.5-flash', originalModel: 'gemini-3.8-flash' },
    } as any);
    const deps = makeDeps();

    await runDocumentRepo(deps, { provider: 'gemini', apiKey: 'k', model: 'gemini-3.8-flash' }, 'owner/repo');

    expect(deps.updateMessage).toHaveBeenCalledWith(
      'msg-1',
      expect.objectContaining({
        content: expect.stringContaining('usando gemini-2.5-flash por sobrecarga temporal de gemini-3.8-flash'),
      }),
    );
  });

  it('#77 (v4.0.51): avisa en el chat del contexto recortado y del reintento automático', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }], totalScanned: 1, truncated: false, allPaths: ['a'] } as any);
    vi.mocked(generateRepoDocs).mockResolvedValue({
      readme: 'R',
      manualTecnico: 'M',
      metadatos: {
        contextoAdaptativo: { maxFiles: 24, maxLinesPerFile: 50, reduced: true, reintento: true },
      },
    } as any);
    const deps = makeDeps();

    await runDocumentRepo(deps, CONFIG, 'owner/repo');

    expect(deps.updateMessage).toHaveBeenCalledWith(
      'msg-1',
      expect.objectContaining({ content: expect.stringContaining('Contexto adaptativo') }),
    );
    const calls = vi.mocked(deps.updateMessage).mock.calls;
    const content = calls[calls.length - 1][1].content as string;
    expect(content).toContain('24 archivos');
    expect(content).toContain('50 líneas');
    expect(content).toContain('reintentó automáticamente');
  });

  it('#77 (v4.0.51): no avisa de contexto adaptativo si no hubo recorte', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }], totalScanned: 1, truncated: false, allPaths: ['a'] } as any);
    vi.mocked(generateRepoDocs).mockResolvedValue({
      readme: 'R',
      manualTecnico: 'M',
      metadatos: {
        contextoAdaptativo: { maxFiles: 12, maxLinesPerFile: 80, reduced: false, reintento: false },
      },
    } as any);
    const deps = makeDeps();

    await runDocumentRepo(deps, CONFIG, 'owner/repo');

    const calls = vi.mocked(deps.updateMessage).mock.calls;
    const content = calls[calls.length - 1][1].content as string;
    expect(content).not.toContain('Contexto adaptativo');
    expect(content).not.toContain('reintentó automáticamente');
  });

  it('propaga options.modelOverride a generateRepoDocs con effectiveConfig', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }], totalScanned: 1, truncated: false, allPaths: ['a'] } as any);
    vi.mocked(generateRepoDocs).mockResolvedValue({ readme: 'R', manualTecnico: 'M' } as any);
    const deps = makeDeps();

    await runDocumentRepo(deps, { provider: 'gemini', apiKey: 'k', model: 'gemini-3.8-flash' }, 'owner/repo', undefined, { modelOverride: 'gemini-2.5-flash' });

    expect(generateRepoDocs).toHaveBeenCalledWith(
      'owner/repo',
      expect.any(Array),
      expect.objectContaining({ model: 'gemini-2.5-flash' }),
      'es',
      undefined,
      { modelOverride: 'gemini-2.5-flash' },
    );
  });

  it('#58 (b): cuando alreadyDocumented=true, trae el README/MANUAL actual y lo propaga', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'README.md' }, { path: 'MANUAL_TECNICO.md' }], totalScanned: 2, truncated: false, allPaths: ['README.md', 'MANUAL_TECNICO.md'] } as any);
    vi.mocked(generateRepoDocs).mockResolvedValue({ readme: 'R nueva', manualTecnico: 'M nueva' } as any);
    // El mock de getFileContents devuelve contenido base64; decodeBase64 lo decodifica.
    vi.mocked(getFileContents).mockImplementation(async (_t: string, _o: string, _r: string, path: string) =>
      ({ content: path === 'README.md' ? 'b64-r' : 'b64-m', sha: 's' }) as any
    );
    const deps = makeDeps();

    const result = await runDocumentRepo(deps, CONFIG, 'owner/repo');

    expect(result).toEqual(expect.objectContaining({
      alreadyDocumented: true,
      readmeActual: 'decoded(b64-r)',
      manualActual: 'decoded(b64-m)',
    }));
    expect(getFileContents).toHaveBeenCalledWith('tok', 'owner', 'repo', 'README.md');
    expect(getFileContents).toHaveBeenCalledWith('tok', 'owner', 'repo', 'MANUAL_TECNICO.md');
  });

  it('#58 (b): si el README existe pero el MANUAL da 404, readmeActual se rellena y manualActual queda undefined', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'README.md' }], totalScanned: 1, truncated: false, allPaths: ['README.md', 'MANUAL_TECNICO.md'] } as any);
    vi.mocked(generateRepoDocs).mockResolvedValue({ readme: 'R nueva', manualTecnico: 'M nueva' } as any);
    vi.mocked(getFileContents).mockImplementation(async (_t: string, _o: string, _r: string, path: string) => {
      if (path === 'MANUAL_TECNICO.md') throw new Error('404');
      return { content: 'b64-r', sha: 's' } as any;
    });
    const deps = makeDeps();

    const result = await runDocumentRepo(deps, CONFIG, 'owner/repo');

    expect(result).toEqual(expect.objectContaining({
      readmeActual: 'decoded(b64-r)',
      manualActual: undefined,
    }));
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

  it('detecta error de contexto excesivo (TPM) y devuelve "context-too-large" con mensaje pedagógico en el chat', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }], totalScanned: 1, truncated: false, allPaths: ['a'] } as any);
    const err = Object.assign(new Error('Request too large for model qwen3.8-27b on tokens per minute (TPM): Limit 8000, Requested 65348'), {
      status: 413,
      contextTooLarge: true,
    });
    vi.mocked(generateRepoDocs).mockRejectedValue(err);
    const deps = makeDeps();

    const result = await runDocumentRepo(deps, CONFIG, 'owner/repo');

    expect(result).toBe('context-too-large');
    const expectedNotice = deps.t('chat.docContextTooLarge', {
      provider: 'Groq Cloud',
      model: 'm',
      repo: 'owner/repo',
    });
    expect(deps.updateMessage).toHaveBeenLastCalledWith('msg-1', expect.objectContaining({ content: expectedNotice, isLoading: false }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({
      status: 'error',
      description: deps.t('history.errorDocumentingContextTooLarge', { repo: 'owner/repo' }),
    }));
  });

  it('detecta timeout del signal y devuelve "timeout" con mensaje pedagógico en el chat', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }], totalScanned: 1, truncated: false, allPaths: ['a'] } as any);
    vi.mocked(generateRepoDocs).mockRejectedValue(Object.assign(new Error('signal timed out'), { name: 'TimeoutError' }));
    const deps = makeDeps();

    const result = await runDocumentRepo(deps, CONFIG, 'owner/repo');

    expect(result).toBe('timeout');
    const expectedNotice = deps.t('chat.docTimeout', {
      provider: 'Groq Cloud',
      model: 'm',
      repo: 'owner/repo',
    });
    expect(deps.updateMessage).toHaveBeenLastCalledWith('msg-1', expect.objectContaining({ content: expectedNotice, isLoading: false }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({
      status: 'error',
      description: deps.t('history.errorDocumentingTimeout', { repo: 'owner/repo' }),
    }));
  });

  it('detecta sobrecarga del proveedor (503) y devuelve "overloaded" con mensaje pedagógico en el chat', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }], totalScanned: 1, truncated: false, allPaths: ['a'] } as any);
    vi.mocked(generateRepoDocs).mockRejectedValue(Object.assign(new Error('The model is overloaded'), { status: 503 }));
    const deps = makeDeps();

    const result = await runDocumentRepo(deps, CONFIG, 'owner/repo');

    expect(result).toBe('overloaded');
    const expectedNotice = deps.t('chat.docOverloaded', {
      provider: 'Groq Cloud',
      model: 'm',
      repo: 'owner/repo',
    });
    expect(deps.updateMessage).toHaveBeenLastCalledWith('msg-1', expect.objectContaining({ content: expectedNotice, isLoading: false }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({
      status: 'error',
      description: deps.t('history.errorDocumentingOverloaded', { repo: 'owner/repo' }),
    }));
  });

  it('propaga options.lightMode a generateRepoDocs y actualiza mensaje de carga con "(modo ligero)"', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }], totalScanned: 1, truncated: false, allPaths: ['a'] } as any);
    vi.mocked(generateRepoDocs).mockResolvedValue({
      readme: 'R',
      manualTecnico: 'M',
      resumen: 'res',
      metadatos: { filesCount: 1, lightMode: true },
    } as any);
    const deps = makeDeps();

    const result = await runDocumentRepo(deps, CONFIG, 'owner/repo', undefined, { lightMode: true });

    expect(result).toEqual(expect.objectContaining({
      readme: 'R',
      manualTecnico: 'M',
      filesAnalyzed: 1,
    }));
    expect(deps.updateMessage).toHaveBeenCalledWith(
      'msg-1',
      expect.objectContaining({
        content: expect.stringContaining('(modo ligero)'),
        isLoading: true,
      }),
    );
    expect(generateRepoDocs).toHaveBeenCalledWith(
      'owner/repo',
      expect.any(Array),
      CONFIG,
      'es',
      undefined,
      { lightMode: true },
    );
  });

  it('propaga options.lightMode con imágenes adjuntas a generateRepoDocs', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }], totalScanned: 1, truncated: false, allPaths: ['a'] } as any);
    vi.mocked(generateRepoDocs).mockResolvedValue({
      readme: 'R',
      manualTecnico: 'M',
      resumen: 'res',
      metadatos: { filesCount: 1, lightMode: true },
    } as any);
    const deps = makeDeps();
    const imageFile = new File(['img'], 'captura.png', { type: 'image/png' });

    await runDocumentRepo(deps, CONFIG, 'owner/repo', [imageFile], { lightMode: true });

    expect(generateRepoDocs).toHaveBeenCalledWith(
      'owner/repo',
      expect.any(Array),
      CONFIG,
      'es',
      ['captura.png'],
      { lightMode: true },
    );
  });
});

describe('runLoadRepoContext', () => {
  it('devuelve el contexto en el camino feliz (owner por defecto = usuario)', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
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

    // v3.31.0: writeDocFiles ahora recibe (token, owner, repo, readme, manual, branch?, signature?, extraFiles?).
    expect(writeDocFiles).toHaveBeenCalledWith('tok', 'owner', 'repo', 'R', 'M', undefined,
      expect.stringContaining('Creado por @me y documentado por Groq'), undefined);
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

  it('modo acción sin JSON: muestra aviso con diagnóstico + texto plano (v3.56.0)', async () => {
    vi.mocked(resolveMode).mockReturnValue('action');
    vi.mocked(callAI).mockResolvedValue('texto');
    vi.mocked(parseGeminiAction).mockReturnValue(null);
    // v3.56.0: el parser con diagnóstico ahora devuelve un reason legible.
    vi.mocked(parseGeminiActionWithReason).mockReturnValue({ action: null, error: 'método "FETCH" no permitido' });
    const deps = makeDeps();

    await runSend(deps, CONFIG, SEND_PARAMS);

    // v3.56.0: el aviso usa chat.actionParseFailed.reason con el diagnóstico concreto,
    // para que el usuario sepa por qué se rechazó (no solo "JSON mal formado").
    const notice = deps.t('chat.actionParseFailed.reason', { reason: 'método "FETCH" no permitido' });
    expect(deps.updateMessage).toHaveBeenCalledWith('msg-2', { content: `${notice}\n\n---\ntexto`, isLoading: false });
    expect(deps.setPendingAction).not.toHaveBeenCalled();
  });

  it('modo acción con requiereConfirmacion: abre el modal (setPendingAction)', async () => {
    vi.mocked(resolveMode).mockReturnValue('action');
    vi.mocked(callAI).mockResolvedValue('{...}');
    const action = { accion: 'Crear repo', metodo: 'POST', repo: 'r', requiereConfirmacion: true } as any;
    vi.mocked(parseGeminiAction).mockReturnValue(action);
    vi.mocked(parseGeminiActionWithReason).mockReturnValue({ action });
    const deps = makeDeps();

    await runSend(deps, CONFIG, { ...SEND_PARAMS, multiRepoEnabled: false });

    expect(deps.setPendingAction).toHaveBeenCalledWith(expect.objectContaining({ action: expect.objectContaining({ accion: 'Crear repo' }), targetRepos: [] }));
    expect(executeAction).not.toHaveBeenCalled();
  });

  it('modo acción de solo lectura: ejecuta directo y muestra el resultado', async () => {
    vi.mocked(resolveMode).mockReturnValue('action');
    vi.mocked(callAI).mockResolvedValue('{...}');
    const action = { accion: 'Listar', metodo: 'GET', repo: 'r', requiereConfirmacion: false } as any;
    vi.mocked(parseGeminiAction).mockReturnValue(action);
    vi.mocked(parseGeminiActionWithReason).mockReturnValue({ action });
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
    const action = { accion: 'Actualizar', metodo: 'PUT', repo: 'o/r', archivo: 'README.md', requiereConfirmacion: true } as any;
    vi.mocked(parseGeminiAction).mockReturnValue(action);
    vi.mocked(parseGeminiActionWithReason).mockReturnValue({ action });
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

  // v3.56.0 — detección de desajuste de modo (botón 1-clic)
  it('mismatch de modo: inyecta mensaje con actionMode SIN llamar a la IA (v3.56.0)', async () => {
    vi.mocked(resolveMode).mockReturnValue('chat');
    vi.mocked(detectModeMismatch).mockReturnValue({ suggestMode: 'action', retryText: 'crea un README' });
    const callAIMock = vi.mocked(callAI);
    const deps = makeDeps();

    await runSend(deps, CONFIG, SEND_PARAMS);

    // No se llama al modelo: ahorro de tokens y latencia.
    expect(callAIMock).not.toHaveBeenCalled();
    // El mensaje asistente lleva la sugerencia accionable.
    expect(deps.updateMessage).toHaveBeenCalledWith('msg-2', expect.objectContaining({
      actionMode: { mode: 'action', retryText: 'crea un README' },
      isLoading: false,
    }));
  });

  it('sin mismatch: flujo normal, no se añade actionMode al mensaje', async () => {
    vi.mocked(resolveMode).mockReturnValue('chat');
    vi.mocked(detectModeMismatch).mockReturnValue(null);
    vi.mocked(callAI).mockResolvedValue('opinión normal');
    const deps = makeDeps();

    await runSend(deps, CONFIG, SEND_PARAMS);

    const calls = vi.mocked(deps.updateMessage).mock.calls;
    const lastUpdate = calls[calls.length - 1][1];
    expect(lastUpdate.actionMode).toBeUndefined();
  });

  // v3.56.2 — Modo Revisión: processReviewActions (parser plural + encolado)
  describe('modo revisión (#58c + v3.56.2)', () => {
    it('encola una acción confirmable vía addReviewAction (no abre ConfirmModal)', async () => {
      vi.mocked(resolveMode).mockReturnValue('action');
      vi.mocked(callAI).mockResolvedValue('{...}');
      const action = { accion: 'Crear README', metodo: 'PUT', repo: 'r', archivo: 'README.md', requiereConfirmacion: true } as any;
      vi.mocked(parseGeminiActions).mockReturnValue([action]);
      const deps = makeDeps();

      await runSend(deps, CONFIG, { ...SEND_PARAMS, modeOverride: 'review', reviewMode: true });

      expect(deps.addReviewAction).toHaveBeenCalledTimes(1);
      // La acción se enriquece (contenidoActual + commitMessage) antes de encolar;
      // verificamos solo lo estable: la acción base y que va a la cola, no al modal.
      expect(deps.addReviewAction).toHaveBeenCalledWith(expect.objectContaining({
        action: expect.objectContaining({ accion: 'Crear README', metodo: 'PUT', archivo: 'README.md' }),
      }));
      expect(deps.setPendingAction).not.toHaveBeenCalled();
    });

    it('encola MÚLTIPLES acciones cuando el modelo propone un lote (v3.56.0 fix)', async () => {
      vi.mocked(resolveMode).mockReturnValue('action');
      vi.mocked(callAI).mockResolvedValue('{...}{...}');
      const a1 = { accion: 'Crear A', metodo: 'PUT', repo: 'r', archivo: 'a.txt', requiereConfirmacion: true } as any;
      const a2 = { accion: 'Actualizar B', metodo: 'PUT', repo: 'r', archivo: 'b.txt', requiereConfirmacion: true } as any;
      vi.mocked(parseGeminiActions).mockReturnValue([a1, a2]);
      const deps = makeDeps();

      await runSend(deps, CONFIG, { ...SEND_PARAMS, modeOverride: 'review', reviewMode: true });

      // Antes de v3.56.0 solo se encolaba la primera (parser singular).
      expect(deps.addReviewAction).toHaveBeenCalledTimes(2);
    });

    it('ejecuta directamente las acciones de solo lectura (no las encola)', async () => {
      vi.mocked(resolveMode).mockReturnValue('action');
      vi.mocked(callAI).mockResolvedValue('{...}');
      const readAction = { accion: 'Listar', metodo: 'GET', repo: 'r', requiereConfirmacion: false } as any;
      vi.mocked(parseGeminiActions).mockReturnValue([readAction]);
      vi.mocked(executeAction).mockResolvedValue({ success: true, message: 'OK', data: [1] } as any);
      const deps = makeDeps();

      await runSend(deps, CONFIG, { ...SEND_PARAMS, modeOverride: 'review', reviewMode: true });

      expect(executeAction).toHaveBeenCalled();
      expect(deps.addReviewAction).not.toHaveBeenCalled();
    });

    it('sin acciones válidas: muestra aviso con reason (no encola nada)', async () => {
      vi.mocked(resolveMode).mockReturnValue('action');
      vi.mocked(callAI).mockResolvedValue('texto sin json');
      vi.mocked(parseGeminiActions).mockReturnValue([]);
      vi.mocked(parseGeminiActionWithReason).mockReturnValue({ action: null, error: 'json ausente' });
      const deps = makeDeps();

      await runSend(deps, CONFIG, { ...SEND_PARAMS, modeOverride: 'review', reviewMode: true });

      expect(deps.addReviewAction).not.toHaveBeenCalled();
      const notice = deps.t('chat.actionParseFailed.reason', { reason: 'json ausente' });
      expect(deps.updateMessage).toHaveBeenCalledWith('msg-2', expect.objectContaining({ content: expect.stringContaining(notice) }));
    });
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

  // v3.66.0 (Frente D): una imagen NO se analiza (sin visión). Se conserva el File
  // para hospedarlo en screenshots/ al publicar, y el contextText es solo un aviso.
  it('una imagen NO se analiza: conserva el File y avisa de documentar (Frente D)', async () => {
    vi.mocked(assertSupportedFile).mockReturnValue(undefined);
    const deps = makeDeps();
    const png = new File([new Uint8Array([1, 2, 3])], 'captura.png', { type: 'image/png' });
    Object.defineProperty(png, 'size', { value: 2048 });

    const ctx = await runAttachFile(deps, png);

    expect(ctx?.name).toBe('captura.png');
    expect(ctx?.file).toBe(png); // conserva el File para subirlo al publicar
    expect(ctx?.contextText).toContain('captura.png');
    // NO se llama al extractor de texto
    expect(readFileContent).not.toHaveBeenCalled();
    expect(deps.updateMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ content: expect.stringContaining('captura.png'), isLoading: false }));
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
      model: 'openai/gpt-oss-20b',
      provider: 'groq',
      lang: 'es',
    });
    expect(sig).toContain('GPT-OSS 20B (fast)');
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
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
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
  it('camino feliz: genera la doc y la devuelve junto al currentContent (#58 b)', async () => {
    vi.mocked(getFileContents).mockResolvedValue({ content: 'b64', sha: 's1' } as any);
    vi.mocked(generateSpecificDoc).mockResolvedValue('# Doc generada');

    const deps = makeDeps();
    const result = await runGenerateSpecificDoc(deps, CONFIG, 'owner/repo', 'src/a.ts');

    expect(result).toEqual({ doc: '# Doc generada', currentContent: 'decoded(b64)' });
    expect(generateSpecificDoc).toHaveBeenCalledWith('src/a.ts', 'decoded(b64)', undefined, CONFIG, 'es');
    expect(deps.updateMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ isLoading: false, content: expect.stringContaining('🔄 Se actualizará') })
    );
    expect(deps.setIsChatLoading).toHaveBeenLastCalledWith(false);
  });

  it('si el archivo no existe (getFileContents 404), genera doc nueva y currentContent=undefined (#58 b)', async () => {
    vi.mocked(getFileContents).mockRejectedValue(new Error('404'));
    vi.mocked(generateSpecificDoc).mockResolvedValue('# Nueva doc');

    const deps = makeDeps();
    const result = await runGenerateSpecificDoc(deps, CONFIG, 'owner/repo', 'nuevo.md');

    expect(result).toEqual({ doc: '# Nueva doc', currentContent: undefined });
    expect(generateSpecificDoc).toHaveBeenCalledWith('nuevo.md', undefined, undefined, CONFIG, 'es');
    expect(deps.updateMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ content: expect.stringContaining('✨ Es un documento nuevo') })
    );
  });

  it('usa existingContent explícito en vez de hacer fetch y lo propaga al resultado (#58 Fase 3 + b)', async () => {
    vi.mocked(generateSpecificDoc).mockResolvedValue('# Actualizada');

    const deps = makeDeps();
    const result = await runGenerateSpecificDoc(deps, CONFIG, 'owner/repo', 'a.ts', 'CONTENIDO_PREVIO');

    expect(getFileContents).not.toHaveBeenCalled();
    expect(generateSpecificDoc).toHaveBeenCalledWith('a.ts', 'CONTENIDO_PREVIO', undefined, CONFIG, 'es');
    expect(result).toEqual({ doc: '# Actualizada', currentContent: 'CONTENIDO_PREVIO' });
  });

  it('incorpora la conversación como contexto cuando se pasa', async () => {
    vi.mocked(generateSpecificDoc).mockResolvedValue('# Doc');

    const deps = makeDeps();
    const result = await runGenerateSpecificDoc(deps, CONFIG, 'owner/repo', 'a.ts', undefined, 'pregunta previa del usuario');

    expect(generateSpecificDoc).toHaveBeenCalledWith(
      'a.ts', undefined, 'Usuario: pregunta previa del usuario', CONFIG, 'es'
    );
    expect(result).toEqual({ doc: '# Doc', currentContent: undefined });
  });

  it('si la IA falla, devuelve null y marca la entrada como error', async () => {
    vi.mocked(getFileContents).mockRejectedValue(new Error('404'));
    vi.mocked(generateSpecificDoc).mockRejectedValue(new Error('IA caída'));

    const deps = makeDeps();
    const result = await runGenerateSpecificDoc(deps, CONFIG, 'owner/repo', 'a.ts');

    expect(result).toBeNull();
    expect(deps.updateMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ content: expect.stringContaining('IA caída'), isLoading: false })
    );
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'error' }));
    expect(deps.setIsChatLoading).toHaveBeenLastCalledWith(false);
  });

  it('pasa extraFiles conteniendo imagenes a generateSpecificDoc', async () => {
    vi.mocked(getFileContents).mockRejectedValue(new Error('404'));
    vi.mocked(generateSpecificDoc).mockResolvedValue('# Doc Con Imagen');

    const deps = makeDeps();
    const imageFile = new File(['dummy'], 'demo.png', { type: 'image/png' });
    const result = await runGenerateSpecificDoc(deps, CONFIG, 'owner/repo', 'README.md', undefined, undefined, [imageFile]);

    expect(generateSpecificDoc).toHaveBeenCalledWith('README.md', undefined, undefined, CONFIG, 'es', ['demo.png']);
    expect(result).toEqual({ doc: '# Doc Con Imagen', currentContent: undefined });
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

// ── fetchExistingFileDoc / docPathFor (#58 b scope file) ────────────────────

describe('docPathFor', () => {
  it('deriva docs/{base}.md quitando solo la última extensión', () => {
    expect(docPathFor('Button.tsx')).toBe('docs/Button.md');
    // El regex solo quita la última extensión; los puntos intermedios se
    // conservan (están en la allowlist [^\w.-]).
    expect(docPathFor('reporte.final.csv')).toBe('docs/reporte.final.md');
  });

  it('sanea caracteres no-word a "-" y solo cae a "archivo" si el base queda vacío', () => {
    // Espacios y '!' → '-', pero el resultado '-' no es vacío, así que no cae
    // al fallback. Solo cae a 'archivo' cuando el base es realmente ''.
    expect(docPathFor('  !!  .xlsx')).toBe('docs/-.md');
    expect(docPathFor('.xlsx')).toBe('docs/archivo.md');
  });
});

describe('fetchExistingFileDoc', () => {
  it('devuelve el contenido decodificado cuando el doc ya existe', async () => {
    vi.mocked(getFileContents).mockResolvedValue({ content: 'b64', sha: 's1' } as any);

    const content = await fetchExistingFileDoc('tok', 'owner', 'repo', 'Button.tsx');

    expect(getFileContents).toHaveBeenCalledWith('tok', 'owner', 'repo', 'docs/Button.md');
    expect(content).toBe('decoded(b64)');
  });

  it('devuelve null (alta nueva) cuando getFileContents falla con 404', async () => {
    vi.mocked(getFileContents).mockRejectedValue(new Error('404'));

    const content = await fetchExistingFileDoc('tok', 'owner', 'repo', 'Button.tsx');

    expect(content).toBeNull();
  });

  it('tolera content vacío devolviendo string vacío (no null)', async () => {
    vi.mocked(getFileContents).mockResolvedValue({ content: '', sha: 's1' } as any);

    const content = await fetchExistingFileDoc('tok', 'owner', 'repo', 'Button.tsx');

    expect(content).toBe('decoded()');
  });
});

// ── #73: distinguir timeout automático del botón Detener (ramas catch) ────────
// runSend y runSecurityAudit capturan el abort y muestran un mensaje distinto
// según la causa: timeout (chat.generationTimeout / _(cancelado por timeout)_) o
// botón Detener (chat.generationStopped / _(detenido)_). Estas suites cubren las
// 4 combinaciones (causa × con/sin texto parcial) en ambos runners.
describe('runSend — timeout vs Detener (#73)', () => {
  it('timeout sin texto parcial → mensaje chat.generationTimeout', async () => {
    vi.mocked(resolveMode).mockReturnValue('action');
    vi.mocked(callAI).mockRejectedValue(new DOMException('signal timed out', 'TimeoutError'));
    const deps = makeDeps();

    await runSend(deps, CONFIG, SEND_PARAMS);

    expect(deps.updateMessage).toHaveBeenLastCalledWith('msg-2', { content: '⏹️ La IA tardó demasiado y se canceló automáticamente. Súbelo el timeout en ⚙️ o reintenta.', isLoading: false });
  });

  it('timeout con texto parcial → conserva el texto + nota (cancelado por timeout)', async () => {
    vi.mocked(resolveMode).mockReturnValue('chat');
    vi.mocked(callAI).mockImplementation((async (...args: any[]) => {
      const onToken = args[6] as ((t: string) => void) | undefined;
      onToken?.('texto parcial del audit');
      throw new DOMException('signal timed out', 'TimeoutError');
    }) as any);
    const deps = makeDeps();

    await runSend(deps, CONFIG, SEND_PARAMS);

    expect(deps.updateMessage).toHaveBeenLastCalledWith('msg-2', { content: 'texto parcial del audit\n\n⏹️ _(cancelado por timeout)_', isLoading: false });
  });

  it('Detener manual sin texto parcial → mensaje chat.generationStopped (#40 regresión)', async () => {
    vi.mocked(resolveMode).mockReturnValue('action');
    vi.mocked(callAI).mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const deps = makeDeps();

    await runSend(deps, CONFIG, SEND_PARAMS);

    expect(deps.updateMessage).toHaveBeenLastCalledWith('msg-2', { content: '⏹️ Generación detenida.', isLoading: false });
  });

  it('Detener manual con texto parcial → conserva el texto + nota (detenido)', async () => {
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

  it('error NO de abort → burbuja de error (no mensaje de detención)', async () => {
    vi.mocked(resolveMode).mockReturnValue('action');
    vi.mocked(callAI).mockRejectedValue(new Error('503 down'));
    const deps = makeDeps();

    await runSend(deps, CONFIG, SEND_PARAMS);

    expect(deps.updateMessage).toHaveBeenLastCalledWith('msg-2', expect.objectContaining({ content: expect.stringContaining('503 down'), isLoading: false }));
  });
});

describe('runSecurityAudit — timeout vs Detener (#73)', () => {
  // Helper: configura los mocks de GitHub para que la auditoría llegue al callAI.
  const setupGitHubOk = () => {
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [], totalScanned: 0, truncated: false, allPaths: [] } as any);
    vi.mocked(getFileContents).mockResolvedValue({ content: btoa('x') } as any);
  };

  it('timeout sin texto parcial → mensaje chat.generationTimeout + historial cancelled', async () => {
    setupGitHubOk();
    vi.mocked(callAI).mockRejectedValue(new DOMException('signal timed out', 'TimeoutError'));

    const deps = makeDeps();
    await runSecurityAudit(deps, CONFIG, 'owner/repo');

    expect(deps.updateMessage).toHaveBeenLastCalledWith(expect.any(String), { content: '⏹️ La IA tardó demasiado y se canceló automáticamente. Súbelo el timeout en ⚙️ o reintenta.', isLoading: false });
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'cancelled' }));
  });

  it('timeout con texto parcial → conserva el texto + nota (cancelado por timeout)', async () => {
    setupGitHubOk();
    vi.mocked(callAI).mockImplementation((async (...args: any[]) => {
      const onToken = args[6] as ((t: string) => void) | undefined;
      onToken?.('auditoría a medias');
      throw new DOMException('signal timed out', 'TimeoutError');
    }) as any);

    const deps = makeDeps();
    await runSecurityAudit(deps, CONFIG, 'owner/repo');

    expect(deps.updateMessage).toHaveBeenLastCalledWith(expect.any(String), { content: 'auditoría a medias\n\n⏹️ _(cancelado por timeout)_', isLoading: false });
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'cancelled' }));
  });

  it('Detener manual sin texto parcial → mensaje chat.generationStopped + historial cancelled', async () => {
    setupGitHubOk();
    vi.mocked(callAI).mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));

    const deps = makeDeps();
    await runSecurityAudit(deps, CONFIG, 'owner/repo');

    expect(deps.updateMessage).toHaveBeenLastCalledWith(expect.any(String), { content: '⏹️ Generación detenida.', isLoading: false });
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'cancelled' }));
  });

  it('Detener manual con texto parcial → conserva el texto + nota (detenido)', async () => {
    setupGitHubOk();
    vi.mocked(callAI).mockImplementation((async (...args: any[]) => {
      const onToken = args[6] as ((t: string) => void) | undefined;
      onToken?.('auditoría a medias');
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    }) as any);

    const deps = makeDeps();
    await runSecurityAudit(deps, CONFIG, 'owner/repo');

    expect(deps.updateMessage).toHaveBeenLastCalledWith(expect.any(String), { content: 'auditoría a medias\n\n⏹️ _(detenido)_', isLoading: false });
  });

  it('error NO de abort → burbuja de error + historial error', async () => {
    setupGitHubOk();
    vi.mocked(callAI).mockRejectedValue(new Error('503 down'));

    const deps = makeDeps();
    await runSecurityAudit(deps, CONFIG, 'owner/repo');

    expect(deps.updateMessage).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ content: expect.stringContaining('503 down'), isLoading: false }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'error' }));
  });
});

describe('runSend — Transición Modo Chat a Modo Acción', () => {
  it('inyecta la directiva RECORDATORIO MODO ACCIÓN cuando hay historial conversacional previo', async () => {
    vi.mocked(resolveMode).mockReturnValue('action');
    vi.mocked(getFileContents).mockResolvedValue({ content: '' } as any);
    const mockAction: any = {
      tipo: 'escritura',
      accion: 'Crear archivo',
      metodo: 'PUT',
      repo: 'owner/repo',
      archivo: 'test.ts',
      contenidoPropuesto: 'code',
      requiereConfirmacion: true,
    };
    vi.mocked(parseGeminiAction).mockReturnValue(mockAction);
    vi.mocked(parseGeminiActionWithReason).mockReturnValue({ action: mockAction } as any);
    vi.mocked(callAI).mockResolvedValue(JSON.stringify(mockAction));

    const deps = makeDeps();
    const sendParams: any = {
      userText: 'Crea un archivo test.ts con el código',
      conversationHistory: [
        { role: 'user', content: 'Hola' },
        { role: 'assistant', content: '¡Hola! ¿En qué te puedo ayudar?' },
      ],
      modeOverride: 'action',
      repoContext: null,
      fileContext: [],
      multiRepoEnabled: false,
      selectedRepos: [],
    };

    await runSend(deps, CONFIG, sendParams);

    expect(callAI).toHaveBeenCalled();
    const systemPromptUsed = vi.mocked(callAI).mock.calls[0][1];
    expect(systemPromptUsed).toContain('RECORDATORIO MODO ACCIÓN');
    expect(deps.setPendingAction).toHaveBeenCalledWith(expect.objectContaining({
      action: expect.objectContaining({ archivo: 'test.ts' }),
    }));
  });

  it('NO inyecta el RECORDATORIO MODO ACCIÓN si es el primer mensaje de la conversación', async () => {
    vi.mocked(resolveMode).mockReturnValue('action');
    vi.mocked(getFileContents).mockResolvedValue({ content: '' } as any);
    const mockAction: any = {
      tipo: 'escritura',
      accion: 'Crear archivo',
      metodo: 'PUT',
      repo: 'owner/repo',
      archivo: 'first.ts',
      contenidoPropuesto: 'code',
      requiereConfirmacion: true,
    };
    vi.mocked(parseGeminiAction).mockReturnValue(mockAction);
    vi.mocked(parseGeminiActionWithReason).mockReturnValue({ action: mockAction } as any);
    vi.mocked(callAI).mockResolvedValue(JSON.stringify(mockAction));

    const deps = makeDeps();
    const sendParams: any = {
      userText: 'Crea un archivo first.ts con el código',
      conversationHistory: [],
      modeOverride: 'action',
      repoContext: null,
      fileContext: [],
      multiRepoEnabled: false,
      selectedRepos: [],
    };

    await runSend(deps, CONFIG, sendParams);

    expect(callAI).toHaveBeenCalled();
    const systemPromptUsed = vi.mocked(callAI).mock.calls[0][1];
    expect(systemPromptUsed).not.toContain('RECORDATORIO MODO ACCIÓN');
  });
});

describe('runCreateFileRelease - Manejo de errores al adjuntar assets', () => {
  it('notifica advertencia en chat si falla la subida de un asset adjunto', async () => {
    vi.mocked(suggestNextVersion).mockResolvedValue('v1.1.0');
    vi.mocked(createGitHubRelease).mockResolvedValue({ url: 'http://rel.url', id: 42 });
    vi.mocked(uploadReleaseAsset).mockRejectedValue(new Error('Fallo de red al subir asset'));

    const deps = makeDeps();
    const mockFile = new File(['content'], 'source.pdf', { type: 'application/pdf' });

    await runCreateFileRelease(deps, 'owner', 'repo', 'source.pdf', 'Doc note', 'v1.1.0', mockFile);

    expect(deps.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('El release se creó, pero no pude adjuntar **source.pdf**: Fallo de red al subir asset'),
      }),
    );
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'completed' }));
  });
});

describe('runPublishBulk - Cobertura completa', () => {
  it('publica un commit bulk exitosamente', async () => {
    vi.mocked(publishBulkCommit).mockResolvedValue({ commitSha: '1234567890abcdef' });
    const deps = makeDeps();
    const targets = [{ path: 'README.md', content: 'hello' }, { path: 'DOC.md', content: 'world' }];

    await runPublishBulk(deps, 'owner', 'repo', targets, 'commit');

    expect(publishBulkCommit).toHaveBeenCalledWith('tok', 'owner', 'repo', targets);
    expect(deps.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('✅ Bulk de 2 archivos commiteado atómicamente en **owner/repo**'),
      }),
    );
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'completed' }));
  });

  it('publica un Draft PR bulk exitosamente', async () => {
    vi.mocked(publishBulkDraftPr).mockResolvedValue({ pr: { number: 99, html_url: 'http://pr.url' } as any, branchName: 'docs/auto-bulk-123' });

    const deps = makeDeps();
    const targets = [{ path: 'README.md', content: 'hello' }];

    await runPublishBulk(deps, 'owner', 'repo', targets, 'draftpr');

    expect(publishBulkDraftPr).toHaveBeenCalledWith('tok', 'owner', 'repo', targets);
    expect(deps.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('✅ Draft PR [#99](http://pr.url) con 1 archivo'),
      }),
    );
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'completed' }));
  });

  it('captura errores al fallar la publicación bulk', async () => {
    vi.mocked(publishBulkCommit).mockRejectedValue(new Error('Conflicto de fusion'));
    const deps = makeDeps();
    const targets = [{ path: 'README.md', content: 'hello' }];

    await runPublishBulk(deps, 'owner', 'repo', targets, 'commit');

    expect(deps.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('❌ Error al publicar el bulk de 1 archivo'),
      }),
    );
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'error' }));
  });
});

describe('assistantActions — Cobertura completa de ramas auxiliares y flujos de publicación', () => {
  it('runConfirmAction: en multi-repo ejecuta onProgress y registra cada repo en el historial', async () => {
    vi.mocked(executeActionMultiRepo).mockImplementation(async (_token, _user, _action, _repos, options) => {
      options?.onProgress?.('owner/repo1', 'completed', 'Listo repo 1');
      options?.onProgress?.('owner/repo2', 'completed', 'Listo repo 2');
      return [{ success: true, message: 'ok', repo: 'owner/repo1' }];
    });

    const deps = makeDeps();
    const pendingAction: any = {
      action: { tipo: 'escritura', accion: 'Crear issue', metodo: 'POST', repo: 'owner/repo1', requiereConfirmacion: true },
      targetRepos: [{ name: 'repo1', full_name: 'owner/repo1', owner: { login: 'owner' } }, { name: 'repo2', full_name: 'owner/repo2', owner: { login: 'owner' } }],
      commitMessage: 'fix: multi',
    };

    await runConfirmAction(deps, pendingAction);

    expect(deps.addEntry).toHaveBeenCalledWith({ status: 'completed', description: 'Listo repo 1', repo: 'owner/repo1' });
    expect(deps.addEntry).toHaveBeenCalledWith({ status: 'completed', description: 'Listo repo 2', repo: 'owner/repo2' });
    expect(deps.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringContaining('Acción aplicada a 2 repositorios'),
      }),
    );
  });

  it('runConfirmAction: en mono-repo registra resultado exitoso con formatResultData', async () => {
    vi.mocked(executeAction).mockResolvedValue({ success: true, message: 'Creado issue #10', data: { number: 10, title: 'Bug' } });
    const deps = makeDeps();
    const pendingAction: any = {
      action: { tipo: 'escritura', accion: 'Crear issue', metodo: 'POST', repo: 'owner/repo1', requiereConfirmacion: true },
      targetRepos: [{ name: 'repo1', full_name: 'owner/repo1', owner: { login: 'owner' } }],
    };

    await runConfirmAction(deps, pendingAction);

    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', { status: 'completed', description: 'Creado issue #10' });
    expect(deps.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('✅ Creado issue #10\n\nFORMATTED'),
      }),
    );
  });

  it('runConfirmAction: en mono-repo registra resultado fallido', async () => {
    vi.mocked(executeAction).mockResolvedValue({ success: false, message: 'Permiso denegado' });
    const deps = makeDeps();
    const pendingAction: any = {
      action: { tipo: 'escritura', accion: 'Crear issue', metodo: 'POST', repo: 'owner/repo1', requiereConfirmacion: true },
      targetRepos: [],
    };

    await runConfirmAction(deps, pendingAction);

    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', { status: 'error', description: 'Permiso denegado' });
    expect(deps.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('❌ Permiso denegado'),
      }),
    );
  });

  it('runCancelAction: añade entrada de cancelación y mensaje en chat', () => {
    const deps = makeDeps();
    const pendingAction: any = {
      action: { tipo: 'escritura', accion: 'Eliminar rama', metodo: 'DELETE', repo: 'owner/repo', requiereConfirmacion: true },
      targetRepos: [],
    };

    runCancelAction(deps, pendingAction);

    expect(deps.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'cancelled',
        description: expect.stringContaining('Cancelado: Eliminar rama'),
      }),
    );
    expect(deps.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringContaining('Acción cancelada'),
      }),
    );
  });

  it('runCreateRepoAndDocument: rechaza si se intenta crear en una cuenta ajena', async () => {
    const deps = makeDeps();
    const res = await runCreateRepoAndDocument(deps, CONFIG, 'otro-usuario/mi-repo');

    expect(res).toBeNull();
    expect(deps.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('No encontré **otro-usuario/mi-repo**'),
      }),
    );
  });

  it('runCreateRepoAndDocument: tolera fallo en subida de archivos opcionales y sigue documentando', async () => {
    vi.mocked(createRepo).mockResolvedValue(undefined as any);
    vi.mocked(uploadFilesToRepo).mockRejectedValue(new Error('Fallo al subir archivos adjuntos'));
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'README.md', content: '', size: 0 }], totalScanned: 1, truncated: false, allPaths: ['README.md'], binaryPaths: [] });
    vi.mocked(generateRepoDocs).mockResolvedValue({ readme: 'README', manualTecnico: 'MANUAL', resumen: 'resumen' });

    const deps = makeDeps();
    const mockExtraFile = new File(['data'], 'data.csv', { type: 'text/csv' });
    const res = await runCreateRepoAndDocument(deps, CONFIG, 'me/mi-repo', [mockExtraFile]);

    expect(res).not.toBeNull();
    expect(deps.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('⚠️ No pude subir los archivos a **me/mi-repo** (Fallo al subir archivos adjuntos)'),
      }),
    );
  });

  it('runCreateRepoAndDocument: si runCreateRepo falla devuelve null', async () => {
    vi.mocked(createRepo).mockRejectedValue(new Error('Name already exists'));
    const deps = makeDeps();
    const res = await runCreateRepoAndDocument(deps, CONFIG, 'me/mi-repo');
    expect(res).toBeNull();
  });

  it('runCreateRepoAndDocument: si runDocumentRepo devuelve context-too-large devuelve null', async () => {
    vi.mocked(createRepo).mockResolvedValue({ name: 'mi-repo' } as any);
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }], totalScanned: 1, truncated: false, allPaths: ['a'] } as any);
    vi.mocked(generateRepoDocs).mockRejectedValue(Object.assign(new Error('tokens per minute limit exceeded'), { contextTooLarge: true }));
    const deps = makeDeps();
    const res = await runCreateRepoAndDocument(deps, CONFIG, 'me/mi-repo');
    expect(res).toBeNull();
  });

  it('fetchExistingFileDoc: devuelve contenido decodificado si existe y null si no', async () => {
    vi.mocked(getFileContents).mockResolvedValueOnce({ content: 'SGVsbG8=' } as any);
    const content = await fetchExistingFileDoc('tok', 'owner', 'repo', 'notas.txt');
    expect(content).toBe('decoded(SGVsbG8=)');

    vi.mocked(getFileContents).mockRejectedValueOnce(new Error('404 Not Found'));
    const notFound = await fetchExistingFileDoc('tok', 'owner', 'repo', 'inexistente.txt');
    expect(notFound).toBeNull();
  });

  it('runPublishFileDoc: maneja Draft PR, extras y errores con 404', async () => {
    vi.mocked(publishFileDoc).mockResolvedValueOnce({ pr: { number: 12, html_url: 'http://pr/12' } as any } as any);
    const deps = makeDeps();
    const srcFile = new File(['orig'], 'notas.txt');
    const extraFile = new File(['extra'], 'extra.png');

    await runPublishFileDoc(deps, 'owner', 'repo', 'notas.txt', '# doc', {
      draft: true,
      sourceFile: srcFile,
      extraFiles: [extraFile],
    });

    expect(deps.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Draft PR [#12](http://pr/12) con `docs/notas.md` + 2 archivo(s) adjunto(s)'),
      }),
    );

    // Error 404
    vi.mocked(publishFileDoc).mockRejectedValueOnce(new Error('Repository not found'));
    await runPublishFileDoc(deps, 'owner', 'repo', 'notas.txt', '# doc', {});
    expect(deps.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('No encontré el repositorio **owner/repo**'),
      }),
    );
  });

  it('runStartPublish: cubre errores de red, repo ajeno inexistente, repo propio inexistente y publicación exitosa', async () => {
    const deps = makeDeps();
    const target = {
      owner: 'owner',
      repo: 'repo',
      fileName: 'notas.txt',
      doc: '# doc',
      kind: 'commit' as const,
    };

    // 1. Error de red al comprobar existencia
    vi.mocked(repoExists).mockRejectedValueOnce(new Error('Network error'));
    const r1 = await runStartPublish(deps, target, false);
    expect(r1).toBe('handled');
    expect(deps.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('No pude comprobar el repositorio'),
      }),
    );

    // 2. Repo ajeno inexistente
    vi.mocked(repoExists).mockResolvedValueOnce(false);
    const r2 = await runStartPublish(deps, target, false);
    expect(r2).toBe('handled');
    expect(deps.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('solo puedo crear repositorios en tu cuenta'),
      }),
    );

    // 3. Repo propio inexistente
    vi.mocked(repoExists).mockResolvedValueOnce(false);
    const r3 = await runStartPublish(deps, target, true);
    expect(r3).toBe('repo-missing');

    // 4. Repo existente
    vi.mocked(repoExists).mockResolvedValueOnce(true);
    vi.mocked(publishFileDoc).mockResolvedValueOnce({ commitSha: '123456' } as any);
    const r4 = await runStartPublish(deps, target, true);
    expect(r4).toBe('published');
  });

  it('runPublishFileDocByKind: despacha release cuando kind es release', async () => {
    vi.mocked(suggestNextVersion).mockResolvedValue('v1.0.0');
    vi.mocked(createGitHubRelease).mockResolvedValue({ url: 'http://rel.url', id: 1 });
    const deps = makeDeps();

    await runPublishFileDocByKind(deps, {
      owner: 'owner',
      repo: 'repo',
      fileName: 'doc.md',
      doc: '# Doc',
      kind: 'release',
      version: 'v1.0.0',
    });

    expect(createGitHubRelease).toHaveBeenCalledWith('tok', 'owner', 'repo', expect.objectContaining({ version: 'v1.0.0' }));
  });

  it('runGenerateSpecificDoc: fetch de contenido existente y soporte de imágenes extra', async () => {
    vi.mocked(getFileContents).mockResolvedValueOnce({ content: 'ZXhpc3Rpbmc=' } as any);
    vi.mocked(generateSpecificDoc).mockResolvedValueOnce('# Doc Generada');

    const deps = makeDeps();
    const imgFile = new File(['img'], 'screenshot.png', { type: 'image/png' });

    const res = await runGenerateSpecificDoc(deps, CONFIG, 'owner/repo', 'docs/manual.md', undefined, 'usuario dijo hola', [imgFile]);

    expect(res).toEqual({ doc: '# Doc Generada', currentContent: 'decoded(ZXhpc3Rpbmc=)' });
    expect(generateSpecificDoc).toHaveBeenCalledWith('docs/manual.md', 'decoded(ZXhpc3Rpbmc=)', expect.any(String), CONFIG, 'es', ['screenshot.png']);
  });

  it('runGenerateSpecificDoc: captura error al fallar generateSpecificDoc', async () => {
    vi.mocked(getFileContents).mockRejectedValueOnce(new Error('404'));
    vi.mocked(generateSpecificDoc).mockRejectedValueOnce(new Error('AI error'));

    const deps = makeDeps();
    const res = await runGenerateSpecificDoc(deps, CONFIG, 'owner/repo', 'docs/manual.md');

    expect(res).toBeNull();
    expect(deps.updateMessage).toHaveBeenCalledWith(
      'msg-1',
      expect.objectContaining({
        content: expect.stringContaining('❌ Error al generar docs/manual.md: AI error'),
      }),
    );
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', { status: 'error', description: 'Error generando docs/manual.md' });
  });

  it('runPublishSpecificDoc: soporta release, draft PR, commit y captura de errores', async () => {
    const deps = makeDeps();

    // Release
    vi.mocked(suggestNextVersion).mockResolvedValue('v2.0.0');
    vi.mocked(createGitHubRelease).mockResolvedValue({ url: 'http://rel/2', id: 2 });
    await runPublishSpecificDoc(deps, 'owner', 'repo', 'docs/a.md', '# doc', 'release');
    expect(deps.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Release [v2.0.0](http://rel/2) creado en **owner/repo**'),
      }),
    );

    // Draft PR
    vi.mocked(publishFileDoc).mockResolvedValueOnce({ pr: { number: 5, html_url: 'http://pr/5' } as any } as any);
    await runPublishSpecificDoc(deps, 'owner', 'repo', 'docs/a.md', '# doc', 'draftpr');
    expect(deps.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Draft PR [#5](http://pr/5) con `docs/a.md`'),
      }),
    );

    // Commit
    vi.mocked(publishFileDoc).mockResolvedValueOnce({ commitSha: 'abcdef' } as any);
    await runPublishSpecificDoc(deps, 'owner', 'repo', 'docs/a.md', '# doc', 'commit');
    expect(deps.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('`docs/a.md` commiteado en **owner/repo**'),
      }),
    );

    // Error
    vi.mocked(publishFileDoc).mockRejectedValueOnce(new Error('Failed write'));
    await runPublishSpecificDoc(deps, 'owner', 'repo', 'docs/a.md', '# doc', 'commit');
    expect(deps.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('❌ Error al publicar docs/a.md: Failed write'),
      }),
    );
  });

  it('runSend en modo chat: si el modelo devuelve acción con endpoint muestra formato de análisis', async () => {
    vi.mocked(resolveMode).mockReturnValue('chat');
    const actionMock = {
      tipo: 'lectura' as const,
      accion: 'Listar issues',
      metodo: 'GET' as const,
      endpoint: '/repos/owner/repo/issues',
      repo: 'owner/repo',
    };
    vi.mocked(parseGeminiAction).mockReturnValue(actionMock as any);
    vi.mocked(callAI).mockResolvedValue(JSON.stringify(actionMock));

    const deps = makeDeps();
    await runSend(deps, CONFIG, SEND_PARAMS);

    expect(deps.updateMessage).toHaveBeenCalledWith(
      'msg-2',
      expect.objectContaining({
        content: expect.stringContaining('💡 **Análisis detectado**: Listar issues'),
      }),
    );
  });

  it('runSend en modo chat: si el modelo devuelve acción sin endpoint y accion corta conserva rawResponse', async () => {
    vi.mocked(resolveMode).mockReturnValue('chat');
    const actionMock = {
      tipo: 'lectura' as const,
      accion: 'Corta',
    };
    vi.mocked(parseGeminiAction).mockReturnValue(actionMock as any);
    vi.mocked(callAI).mockResolvedValue(JSON.stringify(actionMock));

    const deps = makeDeps();
    await runSend(deps, CONFIG, SEND_PARAMS);

    expect(deps.updateMessage).toHaveBeenCalledWith(
      'msg-2',
      expect.objectContaining({
        content: JSON.stringify(actionMock),
      }),
    );
  });

  it('runSend: cuando callAI falla con contextTooLarge sin repoContext muestra mensaje accionable', async () => {
    vi.mocked(resolveMode).mockReturnValue('chat');
    vi.mocked(callAI).mockRejectedValue(new Error('context length exceeded 4096 tokens'));

    const deps = makeDeps();
    await runSend(deps, CONFIG, { ...SEND_PARAMS, repoContext: null });

    expect(deps.updateMessage).toHaveBeenCalledWith(
      'msg-2',
      expect.objectContaining({
        content: expect.stringContaining('⚠️ El contexto del repositorio sigue siendo demasiado grande'),
      }),
    );
  });
});

// ── Ramas restantes de assistantActions (v4.0.52, #26) ────────────────────────
// Últimos lados MISS del módulo: buildSignature sin modelo/provider, mensajes de
// carga con árbol truncado, respaldos cuando allPaths llega undefined, guards
// "repoNeeded" de los botones, salto de commits/patches problemáticos en el sync,
// tolerancia de la auditoría (content vacío, errores no-404, repoContext),
// descubrimiento de entrypoints/compose, acción JSON en modo chat, extras en el
// commit de docs, el camino de modo revisión con multi-repo y acciones raras,
// mismatch hacia chat, contexto sin re-ranking, prompt de acción con archivo,
// adjuntos sin extensión, errores de publicación (404/sin mensaje) y sourceFile
// en draftpr/commit. OJO: no hay restoreMocks global, así que este describe
// re-fija los defaults de los parsers antes de cada test (los mockReturnValue de
// tests previos persisten entre tests del fichero).
describe('assistantActions — ramas restantes (v4.0.52 #26)', () => {
  const CONFIG_EMPTY_MODEL = { provider: 'groq' as const, apiKey: 'k', model: '' };

  beforeEach(() => {
    // Defaults de fábrica (los impl persistentes de tests previos se pisan aquí).
    vi.mocked(parseGeminiAction).mockImplementation(() => undefined as never);
    vi.mocked(parseGeminiActions).mockImplementation(() => []);
    vi.mocked(parseGeminiActionWithReason).mockImplementation((raw: string) => {
      const action = parseGeminiAction(raw);
      return action ? { action } : { action: null, error: 'no se encontró JSON de acción válido' };
    });
    vi.mocked(resolveMode).mockImplementation(() => 'chat' as never);
  });

  it('buildSignature: sin modelo → "IA"; con modelo y sin provider → el modelo tal cual', () => {
    const base = { user: { login: 'me' }, providerName: 'Groq', lang: 'es' as const };
    // model undefined → deps.model ?? 'IA' (lado derecho de ?? y del ternario).
    expect(buildSignature({ ...base, model: undefined as never, provider: undefined as never })).toContain('(IA)');
    // model presente pero provider ausente → el modelo se usa sin modelLabel.
    expect(buildSignature({ ...base, model: 'mi-modelo', provider: undefined as never })).toContain('(mi-modelo)');
  });

  it('runDocumentRepo: árbol truncado muestra "(de N totales)" en el mensaje de carga', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }], totalScanned: 5, truncated: true, allPaths: ['a'] } as any);
    vi.mocked(generateRepoDocs).mockResolvedValue({ readme: 'R', manualTecnico: 'M' } as any);
    const deps = makeDeps();

    await runDocumentRepo(deps, CONFIG, 'owner/repo');

    expect(deps.updateMessage).toHaveBeenCalledWith('msg-1', expect.objectContaining({
      content: expect.stringContaining('(de 5 totales)'),
    }));
  });

  it('runDocumentRepo: allPaths undefined cae a los paths de files; getFileContents falsy → actual undefined', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({
      files: [{ path: 'README.md' }, { path: 'x.ts' }], totalScanned: 2, truncated: false, allPaths: undefined,
    } as any);
    vi.mocked(generateRepoDocs).mockResolvedValue({ readme: 'R', manualTecnico: 'M' } as any);
    // Falsy (no 404): cubre el `if (!existing) return undefined` de fetchActual.
    vi.mocked(getFileContents).mockResolvedValue(undefined as any);
    const deps = makeDeps();

    const result = (await runDocumentRepo(deps, CONFIG, 'owner/repo')) as { readmeActual?: string; manualActual?: string };

    // alreadyDocumented se detectó vía el respaldo de files.map (no allPaths).
    expect(getFileContents).toHaveBeenCalledWith('tok', 'owner', 'repo', 'README.md');
    expect(getFileContents).toHaveBeenCalledWith('tok', 'owner', 'repo', 'MANUAL_TECNICO.md');
    expect(result.readmeActual).toBeUndefined();
    expect(result.manualActual).toBeUndefined();
    // runDocumentRepo deja la entrada en 'pending' (esperando confirmación del modal).
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'pending' }));
  });

  it('runDocumentRepo: fallbackModel con originalModel vacío usa config.model en el aviso', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }], totalScanned: 1, truncated: false, allPaths: ['a'] } as any);
    vi.mocked(generateRepoDocs).mockResolvedValue({
      readme: 'R', manualTecnico: 'M',
      metadatos: { fallbackModel: 'gpt-mini', originalModel: '' },
    } as any);
    const deps = makeDeps();

    await runDocumentRepo(deps, CONFIG, 'owner/repo');

    expect(deps.updateMessage).toHaveBeenCalledWith('msg-1', expect.objectContaining({
      content: expect.stringContaining('usando gpt-mini por sobrecarga temporal de m'),
    }));
  });

  it('runDocumentRepo: errores pedagógicos con config.model vacío → model "IA"', async () => {
    const setupOk = () => {
      vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
      vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }], totalScanned: 1, truncated: false, allPaths: ['a'] } as any);
    };

    // context-too-large
    setupOk();
    vi.mocked(generateRepoDocs).mockRejectedValueOnce(new Error('context length exceeded'));
    const deps1 = makeDeps();
    expect(await runDocumentRepo(deps1, CONFIG_EMPTY_MODEL, 'owner/repo')).toBe('context-too-large');
    expect(deps1.t).toHaveBeenCalledWith('chat.docContextTooLarge', expect.objectContaining({ model: 'IA' }));

    // timeout
    setupOk();
    vi.mocked(generateRepoDocs).mockRejectedValueOnce(new Error('Request timed out after 180s'));
    const deps2 = makeDeps();
    expect(await runDocumentRepo(deps2, CONFIG_EMPTY_MODEL, 'owner/repo')).toBe('timeout');
    expect(deps2.t).toHaveBeenCalledWith('chat.docTimeout', expect.objectContaining({ model: 'IA' }));

    // overloaded
    setupOk();
    vi.mocked(generateRepoDocs).mockRejectedValueOnce(Object.assign(new Error('The model is overloaded'), { status: 503 }));
    const deps3 = makeDeps();
    expect(await runDocumentRepo(deps3, CONFIG_EMPTY_MODEL, 'owner/repo')).toBe('overloaded');
    expect(deps3.t).toHaveBeenCalledWith('chat.docOverloaded', expect.objectContaining({ model: 'IA' }));
  });

  it('runLoadRepoContext: provider param aplica su budget; truncated avisa del recorte', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }], totalScanned: 5, truncated: true, allPaths: ['a'] } as any);
    const deps = makeDeps();

    const ctx = await runLoadRepoContext(deps, 'owner/repo', 'groq');

    expect(ctx).not.toBeNull();
    expect(ctx!.truncated).toBe(true);
    expect(deps.updateMessage).toHaveBeenCalledWith('msg-1', expect.objectContaining({
      content: expect.stringContaining('analizo el contenido de 1'),
    }));
  });

  it('runSummarizeThread: repo sin owner → owner = usuario autenticado', async () => {
    vi.mocked(parseThreadInput).mockReturnValueOnce({ repo: 'solo-repo', number: 3 } as any);
    vi.mocked(summarizeThread).mockResolvedValue('S');
    const deps = makeDeps();

    await runSummarizeThread(deps, CONFIG, 'solo-repo#3', null);

    expect(summarizeThread).toHaveBeenCalledWith('tok', 'me', 'solo-repo', 3, CONFIG);
  });

  it('runGenerateChangelog: input sin repo → chat.repoNeeded y sin llamada', async () => {
    const deps = makeDeps();

    await runGenerateChangelog(deps, CONFIG, '');

    expect(deps.t).toHaveBeenCalledWith('chat.repoNeeded');
    expect(generateChangelog).not.toHaveBeenCalled();
    expect(deps.setIsChatLoading).not.toHaveBeenCalledWith(true);
  });

  it('runCodeHealth: input sin repo avisa; allPaths undefined usa los paths de files', async () => {
    // sin repo
    const deps1 = makeDeps();
    expect(await runCodeHealth(deps1, '')).toBeNull();
    expect(deps1.t).toHaveBeenCalledWith('chat.repoNeeded');
    expect(getRepo).not.toHaveBeenCalled();

    // allPaths undefined → languageDistribution sobre files.map(f => f.path)
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({
      files: [{ path: 'src/a.ts', content: '' }], totalScanned: 1, truncated: false, allPaths: undefined,
    } as any);
    vi.mocked(listCommitDates).mockResolvedValue([]);
    const deps2 = makeDeps();
    const health = await runCodeHealth(deps2, 'owner/repo');
    expect(health).not.toBeNull();
    expect(health!.languages).toContainEqual({ language: 'TypeScript', count: 1 });
  });

  it('runSyncRepoStatus: input sin repo → chat.repoNeeded y sin listar commits', async () => {
    const deps = makeDeps();

    expect(await runSyncRepoStatus(deps, '', CONFIG)).toBeNull();

    expect(deps.t).toHaveBeenCalledWith('chat.repoNeeded');
    expect(listRecentCommits).not.toHaveBeenCalled();
  });

  it('runSyncRepoStatus: commit fallido se salta, file sin patch se omite, patch larga se trunca y lang en → English', async () => {
    vi.mocked(listRecentCommits).mockResolvedValue([{ sha: 'aaa1111', message: 'c1' }, { sha: 'bbb2222', message: 'c2' }] as any);
    vi.mocked(getCommit)
      .mockRejectedValueOnce(new Error('boom')) // 1er commit falla → console.warn y se sigue
      .mockResolvedValueOnce({
        sha: 'bbb2222ccc',
        message: 'feat: algo\n\nbody',
        author: { name: 'J', date: '2024-01-01' },
        files: [
          { filename: 'big.ts', status: 'modified', additions: 1, deletions: 1, changes: 2, patch: '+'.repeat(2500) },
          { filename: 'bin.bin', status: 'added', additions: 0, deletions: 0, changes: 0 }, // sin patch
        ],
      } as any);
    vi.mocked(callAI).mockResolvedValue('RESUMEN');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const deps = { ...makeDeps(), lang: 'en' as const };

    const result = await runSyncRepoStatus(deps, 'owner/repo', CONFIG);

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
    expect(result).not.toBeNull();
    expect(result!.commitsAnalyzed).toBe(1);
    const systemPrompt = String(vi.mocked(callAI).mock.calls[0][1]);
    expect(systemPrompt).toContain('English');
    const contextText = String((vi.mocked(callAI).mock.calls[0][0] as Array<{ content: string }>)[0].content);
    expect(contextText).toContain('... (truncado)');
    expect(contextText).not.toContain('bin.bin');
  });

  it('runSecurityAudit: content vacío y error no-404 se toleran; repoContext construye el contexto general', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [], totalScanned: 0, truncated: false, allPaths: [] } as any);
    vi.mocked(getFileContents).mockImplementation(async (...args: unknown[]) => {
      const path = args[3] as string;
      if (path === 'package.json') return { content: '' } as any; // → decodeBase64('')
      if (path === 'Dockerfile') throw new Error('permiso denegado'); // no-404 → console.warn
      throw new GitHubAPIError('Not Found', 404);
    });
    vi.mocked(callAI).mockResolvedValue('AUDIT');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const deps = makeDeps();

    await runSecurityAudit(deps, CONFIG, 'owner/repo', {
      repoContext: {
        repoName: 'owner/repo', contextText: 'CTX', files: [{ path: 'a.ts' }, { path: 'b.ts' }] as never[],
        allPaths: ['a.ts'], filesAnalyzed: 2, totalFiles: 2, truncated: false,
      } as any,
    });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[#52]'), expect.anything());
    warnSpy.mockRestore();
    const sens = (vi.mocked(buildSecurityAuditContext).mock.calls[0][1] as Array<{ path: string; content?: string }>);
    expect(sens.find(s => s.path === 'package.json')!.content).toBe('decoded()');
    expect(buildRepoContextSummary).toHaveBeenCalledWith('owner/repo', expect.arrayContaining([expect.objectContaining({ path: 'a.ts' })]), expect.objectContaining({ maxFiles: 8, maxLinesPerFile: 60 }));
  });

  it('runSecurityAudit: descubre entrypoints y compose; src/app.ts no se descubre', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({
      files: [], totalScanned: 0, truncated: false,
      allPaths: ['entrypoints/index.js', 'docker-compose.yml', 'src/app.ts'],
    } as any);
    vi.mocked(getFileContents).mockRejectedValue(new GitHubAPIError('Not Found', 404));
    vi.mocked(callAI).mockResolvedValue('OK');
    const deps = makeDeps();

    await runSecurityAudit(deps, CONFIG, 'owner/repo');

    const fetched = vi.mocked(getFileContents).mock.calls.map(c => c[3]);
    expect(fetched).toContain('entrypoints/index.js');
    expect(fetched).toContain('docker-compose.yml');
    expect(fetched).not.toContain('src/app.ts');
  });

  it('runSecurityAudit: allPaths undefined → solo los paths fijos (sin descubiertos)', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [], totalScanned: 0, truncated: false, allPaths: undefined } as any);
    vi.mocked(getFileContents).mockRejectedValue(new GitHubAPIError('Not Found', 404));
    vi.mocked(callAI).mockResolvedValue('OK');
    const deps = makeDeps();

    await runSecurityAudit(deps, CONFIG, 'owner/repo');

    const fetched = vi.mocked(getFileContents).mock.calls.map(c => c[3]) as string[];
    const fixed = ['package.json', 'package-lock.json', 'Dockerfile', '.env.example', 'requirements.txt', 'go.mod', 'Cargo.toml'];
    expect(fetched).toHaveLength(fixed.length);
    expect(fetched.every(p => fixed.includes(p))).toBe(true);
  });

  it('runSecurityAudit: acción JSON con accion larga en modo chat → se extrae el texto', async () => {
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [], totalScanned: 0, truncated: false, allPaths: [] } as any);
    vi.mocked(getFileContents).mockRejectedValue(new GitHubAPIError('Not Found', 404));
    vi.mocked(parseGeminiAction).mockReturnValueOnce({
      accion: 'A'.repeat(80), tipo: 'lectura', metodo: 'GET', endpoint: '/x', repo: 'r',
    } as never);
    vi.mocked(callAI).mockResolvedValue('{"accion":"..."}');
    const deps = makeDeps();

    await runSecurityAudit(deps, CONFIG, 'owner/repo');

    expect(deps.updateMessage).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ content: 'A'.repeat(80) }));
  });

  it('runCommitDocs: extraFiles → " + N archivo(s) adjunto(s)"', async () => {
    vi.mocked(writeDocFiles).mockResolvedValue(undefined as any);
    const deps = makeDeps();

    await runCommitDocs(deps, ANALYSIS, [new File(['x'], 'extra.txt')]);

    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('+ 1 archivo(s) adjunto(s)'),
    }));
  });

  it('modo revisión: actions vacío pero reason.action presente → notice con reason vacía', async () => {
    vi.mocked(resolveMode).mockReturnValueOnce('action' as never);
    vi.mocked(callAI).mockResolvedValue('no-json');
    vi.mocked(parseGeminiActions).mockReturnValueOnce([]);
    vi.mocked(parseGeminiActionWithReason).mockReturnValueOnce({ action: { accion: 'X' } as never, error: '' });
    const deps = makeDeps();

    await runSend(deps, CONFIG, { ...SEND_PARAMS, modeOverride: 'review', reviewMode: true });

    expect(deps.addReviewAction).not.toHaveBeenCalled();
    const notice = deps.t('chat.actionParseFailed.reason', { reason: '' });
    expect(deps.updateMessage).toHaveBeenCalledWith('msg-2', expect.objectContaining({
      content: expect.stringContaining(notice),
    }));
  });

  it('modo revisión: multi-repo con 1 repo seleccionado → targetRepos = selección', async () => {
    vi.mocked(resolveMode).mockReturnValueOnce('action' as never);
    vi.mocked(callAI).mockResolvedValue('{...}');
    vi.mocked(getFileContents).mockResolvedValue(undefined as any); // enriquecer falla → catch → sigue
    const selRepo = { name: 'r1', owner: { login: 'u1' } } as any;
    vi.mocked(parseGeminiActions).mockReturnValueOnce([
      { accion: 'Actualizar README', metodo: 'PUT', repo: 'u1/r1', archivo: 'README.md', requiereConfirmacion: true } as any,
    ]);
    const deps = makeDeps();

    await runSend(deps, CONFIG, { ...SEND_PARAMS, modeOverride: 'review', reviewMode: true, multiRepoEnabled: true, selectedRepos: [selRepo] });

    expect(deps.addReviewAction).toHaveBeenCalledWith(expect.objectContaining({ targetRepos: [selRepo] }));
  });

  it('modo revisión: PUT con content vacío no enriquece, DELETE también se encola; readonly fallido sin ✅', async () => {
    vi.mocked(resolveMode).mockReturnValueOnce('action' as never);
    vi.mocked(callAI).mockResolvedValue('{...}');
    vi.mocked(getFileContents).mockResolvedValue({ content: '' } as any); // if (file.content) → falso
    const putAction = { accion: 'Actualizar', metodo: 'PUT', repo: 'r', archivo: 'a.md', requiereConfirmacion: true } as any;
    const delAction = { accion: 'Borrar', metodo: 'DELETE', repo: 'r', archivo: 'b.md', requiereConfirmacion: true } as any;
    const readAction = { accion: 'Leer', metodo: 'GET', repo: 'r', requiereConfirmacion: false } as any;
    vi.mocked(parseGeminiActions).mockReturnValueOnce([putAction, delAction, readAction]);
    vi.mocked(executeAction).mockResolvedValue({ success: false, message: 'fallo lectura' } as any);
    const deps = makeDeps();

    await runSend(deps, CONFIG, { ...SEND_PARAMS, modeOverride: 'review', reviewMode: true });

    // La PUT se encola SIN contenidoActual (content vacío no cuenta como diff) y la
    // DELETE (lado derecho del ||) también se encola como acción de escritura.
    expect(deps.addReviewAction).toHaveBeenCalledWith(expect.objectContaining({ action: putAction }));
    expect(deps.addReviewAction).toHaveBeenCalledWith(expect.objectContaining({ action: delAction }));
    // La readonly fallida marca la entrada como error y no añade mensaje ✅.
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'error', description: 'fallo lectura' }));
    expect(executeAction).toHaveBeenCalledTimes(1);
    expect(deps.addMessage).not.toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('✅') }));
  });

  it('runSend: mismatch hacia chat sugiere cambiar a chat sin llamar a la IA', async () => {
    vi.mocked(detectModeMismatch).mockReturnValueOnce({ suggestMode: 'chat', retryText: 'reformula como pregunta' } as never);
    const deps = makeDeps();

    await runSend(deps, CONFIG, SEND_PARAMS);

    expect(callAI).not.toHaveBeenCalled();
    const calls = vi.mocked(deps.updateMessage).mock.calls;
    const last = calls[calls.length - 1][1] as { content: string; actionMode?: { mode: string; retryText: string } };
    expect(last.content).toBe(deps.t('chat.modeMismatch.toChat'));
    expect(last.actionMode).toEqual({ mode: 'chat', retryText: 'reformula como pregunta' });
  });

  it('runSend: repoContext sin files pasa el contextText tal cual (sin re-ranking)', async () => {
    vi.mocked(callAI).mockResolvedValue('respuesta');
    const deps = makeDeps();

    await runSend(deps, CONFIG, {
      ...SEND_PARAMS,
      repoContext: { repoName: 'o/r', contextText: 'LEGACY_CTX', files: [], filesAnalyzed: 0, totalFiles: 0, truncated: false } as any,
    });

    expect(chatPromptWithContext).toHaveBeenCalledWith('LEGACY_CTX');
    const calls = vi.mocked(deps.updateMessage).mock.calls;
    const last = calls[calls.length - 1][1] as { consultedFiles?: string[] };
    expect(last.consultedFiles).toBeUndefined();
  });

  it('runSend: modo acción con archivo adjunto inyecta el contexto en el prompt de acción', async () => {
    vi.mocked(resolveMode).mockReturnValueOnce('action' as never);
    vi.mocked(callAI).mockResolvedValue('{...}');
    vi.mocked(parseGeminiAction).mockReturnValueOnce({
      accion: 'Leer issues', tipo: 'lectura', metodo: 'GET', endpoint: '/repos/o/r/issues', repo: 'o/r', requiereConfirmacion: false,
    } as never);
    vi.mocked(executeAction).mockResolvedValue({ success: true, message: 'OK' } as any);
    const deps = makeDeps();

    await runSend(deps, CONFIG, { ...SEND_PARAMS, fileContext: [{ name: 'a.txt', contextText: 'FILE_CTX' }] });

    const systemPrompt = String(vi.mocked(callAI).mock.calls[0][1]);
    expect(systemPrompt).toContain('REPOSITORIO Y ARCHIVOS EN CONTEXTO ACTIVO');
    expect(systemPrompt).toContain('ACTION_PROMPT');
    expect(systemPrompt).toContain('FILE_CTX');
  });

  it('runSend: multi-repo con 1 repo → pendingAction con targetRepos = selección', async () => {
    vi.mocked(resolveMode).mockReturnValueOnce('action' as never);
    vi.mocked(callAI).mockResolvedValue('{...}');
    vi.mocked(getFileContents).mockResolvedValue(undefined as any);
    const selRepo = { name: 'r1', owner: { login: 'u1' } } as any;
    vi.mocked(parseGeminiAction).mockReturnValueOnce({
      accion: 'Actualizar README', tipo: 'escritura', metodo: 'PUT', repo: 'u1/r1', archivo: 'README.md', requiereConfirmacion: true,
    } as never);
    const deps = makeDeps();

    await runSend(deps, CONFIG, { ...SEND_PARAMS, multiRepoEnabled: true, selectedRepos: [selRepo] });

    expect(deps.setPendingAction).toHaveBeenCalledWith(expect.objectContaining({ targetRepos: [selRepo] }));
    expect(deps.setPendingAction).toHaveBeenCalledWith(expect.objectContaining({ action: expect.objectContaining({ accion: 'Actualizar README' }) }));
  });

  it('runSend: solo lectura fallida → entry error y sin mensaje ✅', async () => {
    vi.mocked(resolveMode).mockReturnValueOnce('action' as never);
    vi.mocked(callAI).mockResolvedValue('{...}');
    vi.mocked(parseGeminiAction).mockReturnValueOnce({
      accion: 'Leer', tipo: 'lectura', metodo: 'GET', endpoint: '/repos/o/r', repo: 'o/r', requiereConfirmacion: false,
    } as never);
    vi.mocked(executeAction).mockResolvedValue({ success: false, message: 'meh' } as any);
    const deps = makeDeps();

    await runSend(deps, CONFIG, SEND_PARAMS);

    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'error', description: 'meh' }));
    expect(deps.addMessage).not.toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('✅') }));
  });

  it('runAttachFile: sin extensión y con nombre vacío cae al lector de texto (|| "" del ext)', async () => {
    vi.mocked(readFileContent).mockResolvedValue('CONTENIDO');
    const deps = makeDeps();

    // Sin punto en el nombre: ext = 'readme' (lado izquierdo).
    const ctx1 = await runAttachFile(deps, new File(['CONTENIDO'], 'readme'));
    expect(ctx1).toEqual({ name: 'readme', contextText: 'FMT(readme):CONTENIDO' });

    // Nombre vacío: split().pop() da '' → lado derecho del `|| ''`.
    const ctx2 = await runAttachFile(deps, new File(['CONTENIDO'], ''));
    expect(ctx2).toEqual({ name: '', contextText: 'FMT():CONTENIDO' });
  });

  it('runPublishSpecificDoc: GitHubAPIError 404 → "No encontré el repositorio"', async () => {
    vi.mocked(publishFileDoc).mockRejectedValueOnce(new GitHubAPIError('Not Found', 404));
    const deps = makeDeps();

    await runPublishSpecificDoc(deps, 'owner', 'repo', 'docs/a.md', '# doc', 'commit');

    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('No encontré el repositorio **owner/repo**'),
    }));
  });

  it('runPublishSpecificDoc: error sin mensaje → cae a chat.unknownError', async () => {
    vi.mocked(publishFileDoc).mockRejectedValueOnce(new Error(''));
    const deps = makeDeps();

    await runPublishSpecificDoc(deps, 'owner', 'repo', 'docs/a.md', '# doc', 'commit');

    expect(deps.t).toHaveBeenCalledWith('chat.unknownError');
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Error al publicar docs/a.md'),
    }));
  });

  it('runGenerateSpecificDoc: existing.content vacío → currentContent = decoded("")', async () => {
    vi.mocked(getFileContents).mockResolvedValue({ content: '' } as any);
    vi.mocked(generateSpecificDoc).mockResolvedValue('# DOC');
    const deps = makeDeps();

    const result = await runGenerateSpecificDoc(deps, CONFIG, 'owner/repo', 'docs/a.md');

    expect(result).toEqual({ doc: '# DOC', currentContent: 'decoded()' });
  });

  it('runPublishSpecificDoc: draftpr y commit con sourceFile → "+ archivo fuente"', async () => {
    const deps = makeDeps();
    const sourceFile = new File(['x'], 'src.txt');

    // draftpr con sourceFile
    vi.mocked(publishFileDoc).mockResolvedValueOnce({ pr: { number: 9, html_url: 'http://pr/9' } as any } as any);
    await runPublishSpecificDoc(deps, 'owner', 'repo', 'docs/a.md', '# doc', 'draftpr', undefined, sourceFile);
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Draft PR [#9](http://pr/9) con `docs/a.md` + archivo fuente'),
    }));

    // commit sin pr y con sourceFile
    vi.mocked(publishFileDoc).mockResolvedValueOnce({} as any);
    await runPublishSpecificDoc(deps, 'owner', 'repo', 'docs/a.md', '# doc', 'commit', undefined, sourceFile);
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('`docs/a.md` + archivo fuente commiteado en **owner/repo**'),
    }));
  });
});



