import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de los servicios de los que dependen las acciones
vi.mock('../gemini', () => ({
  generateRepoDocs: vi.fn(),
  generateFileDoc: vi.fn(),
  buildRepoContextSummary: vi.fn(),
  callAI: vi.fn(),
  parseGeminiAction: vi.fn(),
  chatPromptWithContext: vi.fn(() => 'CTX_PROMPT'),
  CHAT_PROMPT: 'CHAT_PROMPT',
  ACTION_PROMPT: 'ACTION_PROMPT',
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
    GitHubAPIError,
  };
});
vi.mock('../docPublisher', () => ({
  writeDocFiles: vi.fn(),
  createDocsDraftPr: vi.fn(),
  publishFileDoc: vi.fn(),
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

import { generateRepoDocs, generateFileDoc, buildRepoContextSummary, callAI, parseGeminiAction, chatPromptWithContext } from '../gemini';
import { assertSupportedFile, readFileContent } from '../../utils/pdfReader';
import { readSpreadsheet } from '../../utils/spreadsheetReader';
import { readPowerBI } from '../../utils/powerbiReader';
import { fetchRepoTreeRecursive, getFileContents, createRepo, repoExists } from '../github';
import { writeDocFiles, createDocsDraftPr, publishFileDoc } from '../docPublisher';
import { summarizeThread, parseThreadInput, listOpenThreads, formatThreadList } from '../threadSummary';
import { executeAction, executeActionMultiRepo } from '../actionExecutor';
import { createGitHubRelease, suggestNextVersion } from '../../utils/releaseGenerator';
import { uploadReleaseAsset } from '../../utils/releaseAssets';
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
  runAttachFile,
  runGenerateFileDoc,
  runPublishFileDoc,
  runCreateFileRelease,
  runCreateRepo,
  runStartPublish,
  runPublishFileDocByKind,
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
  fileContext: null,
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
      fileContext: { name: 'x.pbix', contextText: 'CTX' },
    });

    expect(resolveMode).toHaveBeenCalledWith('háblame del PBIX que acabo de subir', 'auto', false, true);
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
    expect(deps.updateMessage).toHaveBeenCalledWith('msg-1', expect.objectContaining({ content: expect.stringContaining('Adjuntado'), isLoading: false }));
  });

  it('devuelve null y avisa si el archivo no es válido', async () => {
    vi.mocked(assertSupportedFile).mockImplementation(() => { throw new Error('No puedo leer archivos «.exe»'); });
    const deps = makeDeps();

    const ctx = await runAttachFile(deps, new File(['x'], 'app.exe'));

    expect(ctx).toBeNull();
    expect(deps.updateMessage).toHaveBeenCalledWith('msg-1', expect.objectContaining({ content: expect.stringContaining('.exe') }));
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
    expect(deps.updateMessage).toHaveBeenCalledWith('msg-1', expect.objectContaining({
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
    expect(deps.updateMessage).toHaveBeenCalledWith('msg-1', expect.objectContaining({
      content: expect.stringContaining('Adjuntado'),
    }));
    const msg = vi.mocked(deps.updateMessage).mock.calls[0][1] as { content: string };
    expect(msg.content).not.toContain('muestra de las primeras');
    // #28 v3.7.0: el mensaje guía explica el botón explícito de documentar/publicar.
    expect(msg.content).toContain('Documentar y publicar');
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
    expect(deps.updateMessage).toHaveBeenCalledWith('msg-1', expect.objectContaining({
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

    expect(deps.updateMessage).toHaveBeenCalledWith('msg-1', expect.objectContaining({
      content: expect.stringContaining('muestra acotada'),
    }));
  });
});

describe('runSend — contexto de archivo (#28)', () => {
  it('inyecta el archivo adjunto en el prompt de chat', async () => {
    vi.mocked(resolveMode).mockReturnValue('chat');
    vi.mocked(callAI).mockResolvedValue('ok');
    vi.mocked(parseGeminiAction).mockReturnValue(null);
    const deps = makeDeps();

    await runSend(deps, CONFIG, { ...SEND_PARAMS, fileContext: { name: 'a.md', contextText: 'FILE_CTX' } });

    expect(chatPromptWithContext).toHaveBeenCalledWith(expect.stringContaining('FILE_CTX'));
  });
});

describe('runGenerateFileDoc (#28 Fase 2)', () => {
  const FILE_CTX = { name: 'notas.txt', contextText: 'contenido' };

  it('genera el doc, muestra progreso y lo devuelve', async () => {
    vi.mocked(generateFileDoc).mockResolvedValue('# Doc generada');
    const deps = makeDeps();

    const doc = await runGenerateFileDoc(deps, CONFIG, FILE_CTX);

    expect(generateFileDoc).toHaveBeenCalledWith('notas.txt', 'contenido', CONFIG, undefined);
    expect(doc).toBe('# Doc generada');
    expect(deps.addMessage).toHaveBeenCalled();
    expect(deps.updateMessage).toHaveBeenCalledWith('msg-1', expect.objectContaining({ isLoading: false }));
    expect(deps.setIsChatLoading).toHaveBeenLastCalledWith(false);
  });

  it('reenvía la conversación a generateFileDoc (v3.5.0)', async () => {
    vi.mocked(generateFileDoc).mockResolvedValue('# Doc');
    const deps = makeDeps();

    await runGenerateFileDoc(deps, CONFIG, FILE_CTX, 'Usuario: hola');

    expect(generateFileDoc).toHaveBeenCalledWith('notas.txt', 'contenido', CONFIG, 'Usuario: hola');
  });

  it('ante un error muestra el mensaje y devuelve null', async () => {
    vi.mocked(generateFileDoc).mockRejectedValue(new Error('boom'));
    const deps = makeDeps();

    const doc = await runGenerateFileDoc(deps, CONFIG, FILE_CTX);

    expect(doc).toBeNull();
    expect(deps.updateMessage).toHaveBeenCalledWith('msg-1', expect.objectContaining({
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

  it('reenvía el sourceFile a publishFileDoc y lo menciona (#28 4a)', async () => {
    vi.mocked(publishFileDoc).mockResolvedValue({ pr: null, branchName: null });
    const deps = makeDeps();
    const sourceFile = { name: 'informe.pbit' } as unknown as File;

    await runPublishFileDoc(deps, 'owner', 'repo', 'informe.pbit', '# Doc', { draft: false, sourceFile });

    expect(publishFileDoc).toHaveBeenCalledWith('tok', 'owner', 'repo', 'docs/informe.md', '# Doc', { draft: false, sourceFile });
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('informe.pbit'),
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

  it('ante un error marca la entrada como error', async () => {
    vi.mocked(suggestNextVersion).mockResolvedValue('v1.0.0');
    vi.mocked(createGitHubRelease).mockRejectedValue(new Error('rel-err'));
    const deps = makeDeps();

    await runCreateFileRelease(deps, 'owner', 'repo', 'a.md', '# D');

    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'error' }));
  });
});

describe('runCreateRepo (#28 fix)', () => {
  it('crea el repo y devuelve true', async () => {
    vi.mocked(createRepo).mockResolvedValue({ full_name: 'me/nuevo' } as any);
    const deps = makeDeps();

    const ok = await runCreateRepo(deps, 'nuevo');

    expect(ok).toBe(true);
    expect(createRepo).toHaveBeenCalledWith('tok', 'nuevo', expect.any(String));
    expect(deps.addMessage).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('creado'),
    }));
    expect(deps.updateEntry).toHaveBeenCalledWith('hist-1', expect.objectContaining({ status: 'completed' }));
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
