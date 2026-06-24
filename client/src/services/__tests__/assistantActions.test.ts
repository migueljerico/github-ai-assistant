import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de los servicios de los que dependen las acciones
vi.mock('../gemini', () => ({
  generateRepoDocs: vi.fn(),
  buildRepoContextSummary: vi.fn(),
  callAI: vi.fn(),
  parseGeminiAction: vi.fn(),
  chatPromptWithContext: vi.fn(() => 'CTX_PROMPT'),
  CHAT_PROMPT: 'CHAT_PROMPT',
  ACTION_PROMPT: 'ACTION_PROMPT',
}));
vi.mock('../github', () => ({
  fetchRepoTreeRecursive: vi.fn(),
  getFileContents: vi.fn(),
  decodeBase64: vi.fn((s: string) => `decoded(${s})`),
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
vi.mock('../actionExecutor', () => ({
  executeAction: vi.fn(),
  executeActionMultiRepo: vi.fn(),
}));
vi.mock('../../utils/modeDetection', () => ({ resolveMode: vi.fn() }));
vi.mock('../../utils/formatResult', () => ({ formatResultData: vi.fn(() => 'FORMATTED') }));

import { generateRepoDocs, buildRepoContextSummary, callAI, parseGeminiAction } from '../gemini';
import { fetchRepoTreeRecursive, getFileContents } from '../github';
import { writeDocFiles, createDocsDraftPr } from '../docPublisher';
import { summarizeThread, parseThreadInput, listOpenThreads, formatThreadList } from '../threadSummary';
import { executeAction, executeActionMultiRepo } from '../actionExecutor';
import { resolveMode } from '../../utils/modeDetection';
import {
  runDocumentRepo,
  runLoadRepoContext,
  runSummarizeThread,
  runCommitDocs,
  runCreateDraftPr,
  runSend,
  runConfirmAction,
  runCancelAction,
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
    setConversationHistory: vi.fn(),
    setPendingAction: vi.fn(),
  };
}

const SEND_PARAMS = {
  userText: 'hola',
  conversationHistory: [] as Array<{ role: 'user' | 'assistant'; content: string }>,
  modeOverride: 'auto' as const,
  repoContext: null,
  multiRepoEnabled: false,
  selectedRepos: [] as never[],
};

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

    expect(deps.updateMessage).toHaveBeenCalledWith('msg-1', expect.objectContaining({ content: expect.stringContaining('rate limit'), isLoading: false }));
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

  it('modo acción sin JSON: muestra texto plano', async () => {
    vi.mocked(resolveMode).mockReturnValue('action');
    vi.mocked(callAI).mockResolvedValue('texto');
    vi.mocked(parseGeminiAction).mockReturnValue(null);
    const deps = makeDeps();

    await runSend(deps, CONFIG, SEND_PARAMS);

    expect(deps.updateMessage).toHaveBeenCalledWith('msg-2', { content: 'texto', isLoading: false });
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
