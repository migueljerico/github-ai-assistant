import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de los servicios de los que dependen las acciones
vi.mock('../gemini', () => ({
  generateRepoDocs: vi.fn(),
  buildRepoContextSummary: vi.fn(),
}));
vi.mock('../github', () => ({
  fetchRepoTreeRecursive: vi.fn(),
}));
vi.mock('../docPublisher', () => ({
  writeDocFiles: vi.fn(),
  createDocsDraftPr: vi.fn(),
}));
vi.mock('../threadSummary', () => ({
  summarizeThread: vi.fn(),
  parseThreadInput: vi.fn(),
  listOpenThreads: vi.fn(),
  formatThreadList: vi.fn(),
}));

import { generateRepoDocs, buildRepoContextSummary } from '../gemini';
import { fetchRepoTreeRecursive } from '../github';
import { writeDocFiles, createDocsDraftPr } from '../docPublisher';
import { summarizeThread, parseThreadInput, listOpenThreads, formatThreadList } from '../threadSummary';
import {
  runDocumentRepo,
  runLoadRepoContext,
  runSummarizeThread,
  runCommitDocs,
  runCreateDraftPr,
} from '../assistantActions';

const CONFIG = { provider: 'groq' as const, apiKey: 'k', model: 'm' };

function makeDeps() {
  let n = 0;
  return {
    token: 'tok',
    user: { login: 'me' },
    providerName: 'Groq',
    addMessage: vi.fn(() => `msg-${++n}`),
    updateMessage: vi.fn(),
    addEntry: vi.fn(() => 'hist-1'),
    updateEntry: vi.fn(),
    setIsChatLoading: vi.fn(),
  };
}

const ANALYSIS = {
  readme: 'R', manualTecnico: 'M', filesAnalyzed: 2, totalFiles: 2, truncated: false, repoName: 'owner/repo',
};

beforeEach(() => { vi.clearAllMocks(); });

describe('runDocumentRepo', () => {
  it('devuelve el análisis en el camino feliz', async () => {
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }, { path: 'b' }], totalScanned: 2, truncated: false } as any);
    vi.mocked(generateRepoDocs).mockResolvedValue({ readme: 'R', manualTecnico: 'M' } as any);
    const deps = makeDeps();

    const result = await runDocumentRepo(deps, CONFIG, 'owner/repo');

    expect(result).toEqual({ readme: 'R', manualTecnico: 'M', filesAnalyzed: 2, totalFiles: 2, truncated: false, repoName: 'owner/repo' });
    expect(generateRepoDocs).toHaveBeenCalledWith('owner/repo', expect.any(Array), CONFIG);
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'pending' }));
    expect(deps.setIsChatLoading).toHaveBeenLastCalledWith(false);
  });

  it('devuelve null y marca error si falla la descarga', async () => {
    vi.mocked(fetchRepoTreeRecursive).mockRejectedValue(new Error('boom'));
    const deps = makeDeps();

    const result = await runDocumentRepo(deps, CONFIG, 'owner/repo');

    expect(result).toBeNull();
    expect(deps.updateMessage).toHaveBeenLastCalledWith('msg-1', expect.objectContaining({ content: expect.stringContaining('boom'), isLoading: false }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'error' }));
  });
});

describe('runLoadRepoContext', () => {
  it('devuelve el contexto en el camino feliz (owner por defecto = usuario)', async () => {
    vi.mocked(fetchRepoTreeRecursive).mockResolvedValue({ files: [{ path: 'a' }], totalScanned: 1, truncated: false } as any);
    vi.mocked(buildRepoContextSummary).mockReturnValue('CTX');
    const deps = makeDeps();

    const ctx = await runLoadRepoContext(deps, 'mi-repo');

    expect(ctx).toEqual({ repoName: 'me/mi-repo', contextText: 'CTX', filesAnalyzed: 1, totalFiles: 1, truncated: false });
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
    expect(deps.updateMessage).toHaveBeenCalledWith('msg-1', { content: 'LISTA', isLoading: false });
    expect(summarizeThread).not.toHaveBeenCalled();
  });

  it('con número, resume el hilo', async () => {
    vi.mocked(parseThreadInput).mockReturnValue({ owner: 'o', repo: 'r', number: 5 } as any);
    vi.mocked(summarizeThread).mockResolvedValue('SUMMARY');
    const deps = makeDeps();

    await runSummarizeThread(deps, CONFIG, 'o/r#5', null);

    expect(summarizeThread).toHaveBeenCalledWith('tok', 'o', 'r', 5, CONFIG);
    expect(deps.updateMessage).toHaveBeenCalledWith('msg-1', expect.objectContaining({ content: expect.stringContaining('SUMMARY') }));
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

describe('runCommitDocs', () => {
  it('commitea y registra éxito', async () => {
    vi.mocked(writeDocFiles).mockResolvedValue(undefined as any);
    const deps = makeDeps();

    await runCommitDocs(deps, ANALYSIS);

    expect(writeDocFiles).toHaveBeenCalledWith('tok', 'owner', 'repo', 'R', 'M');
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

    expect(createDocsDraftPr).toHaveBeenCalledWith('tok', 'owner', 'repo', expect.objectContaining({ repoName: 'owner/repo' }));
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
