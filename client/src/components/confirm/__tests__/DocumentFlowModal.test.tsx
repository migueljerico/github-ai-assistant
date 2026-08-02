import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DocumentFlowModal from '../DocumentFlowModal';
import type { RepoAnalysis } from '../../../types';
import type { FileContext } from '../../../services/assistantActions';

// #58 (b): mockeamos DiffViewer para aislar la lógica del modal (decisión
// diff vs <pre>) sin depender de diff2html (que inyecta innerHTML en jsdom).
vi.mock('../DiffViewer', () => ({
  default: ({ filename, oldContent, newContent }: { filename: string; oldContent: string; newContent: string }) => (
    <div data-testid="diff-viewer-mock" data-filename={filename} data-old-len={oldContent.length} data-new-len={newContent.length} />
  ),
}));

const analysis: RepoAnalysis = {
  readme: 'README CONTENT',
  manualTecnico: 'MANUAL CONTENT',
  filesAnalyzed: 3,
  totalFiles: 3,
  truncated: false,
  repoName: 'owner/repo',
};

type Props = React.ComponentProps<typeof DocumentFlowModal>;

function baseProps(overrides: Partial<Props> = {}): Props {
 return {
 hasAttachedFile: false,
 currentUserLogin: 'me',
 onGenerateRepo: vi.fn().mockResolvedValue(analysis),
 onCreateRepoAndGenerate: vi.fn().mockResolvedValue(analysis),
 onGenerateFile: vi.fn().mockResolvedValue('# doc'),
 onCommitRepo: vi.fn().mockResolvedValue(undefined),
 onDraftPrRepo: vi.fn().mockResolvedValue(undefined),
 onReleaseRepo: vi.fn().mockResolvedValue(undefined),
 onPublishFile: vi.fn().mockResolvedValue('handled' as const),
 onCreateRepoAndPublish: vi.fn().mockResolvedValue('published' as const),
 // #58 Fase 2: callbacks para "documento específico del repo"
 // #58 (b): onGenerateSpecific devuelve {doc, currentContent} en vez de string.
 onGenerateSpecific: vi.fn().mockResolvedValue({ doc: 'specific doc', currentContent: undefined }),
 onCommitSpecific: vi.fn(),
 onDraftPrSpecific: vi.fn(),
 onReleaseSpecific: vi.fn(),
 // #58 (a): bulk multi-archivo atómico
 onCommitBulk: vi.fn().mockResolvedValue(undefined),
 onDraftPrBulk: vi.fn().mockResolvedValue(undefined),
 repoFileTree: undefined,
 // #58 Fase 3: selectividad
 extraInstructions: '',
 onExtraInstructionsChange: vi.fn(),
 onCancel: vi.fn(),
 ...overrides,
 };
}

function setup(overrides: Partial<Props> = {}) {
  const props = baseProps(overrides);
  render(<DocumentFlowModal {...props} />);
  return props;
}

// Mock File para los tests multi-archivo.
function mockFile(name: string, content = 'contenido'): File {
  return new File([content], name, { type: 'text/plain' });
}

describe('DocumentFlowModal (#57)', () => {
  it('Paso 1: muestra las dos opciones de alcance', () => {
    setup();
    expect(screen.getByText('¿Qué quieres documentar?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Repositorio entero/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Archivo adjunto/ })).toBeInTheDocument();
  });

  it('Paso 1: la opción de archivo está deshabilitada sin archivo adjunto', () => {
    setup();
    expect(screen.getByRole('button', { name: /Archivo adjunto/ })).toBeDisabled();
  });

  it('Paso 1: la opción de archivo se habilita con archivo adjunto', () => {
    setup({ hasAttachedFile: true, attachedFileName: 'notas.txt' });
    expect(screen.getByRole('button', { name: /Archivo adjunto/ })).not.toBeDisabled();
  });

  it('Paso 2 → 1: el botón Atrás vuelve al alcance', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Repositorio entero/ }));
    // Paso 2: aparece el input de repo
    expect(screen.getByPlaceholderText(/nombre-del-repo o owner\/repo/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Atrás/ }));
    expect(screen.getByText('¿Qué quieres documentar?')).toBeInTheDocument();
  });

  it('Flujo repo: repo → generar → revisar → publicar (commit)', async () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /Repositorio entero/ }));
    fireEvent.change(screen.getByPlaceholderText(/nombre-del-repo o owner\/repo/), { target: { value: 'owner/repo' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));

    // Paso 3: preview del README
    await screen.findByText('README CONTENT');
    fireEvent.click(screen.getByRole('button', { name: /MANUAL_TECNICO/ }));
    expect(screen.getByText('MANUAL CONTENT')).toBeInTheDocument();

    // Paso 4: destino fijo + publicar
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(screen.getByText('owner/repo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Commit directo/ }));

    await waitFor(() => expect(props.onCommitRepo).toHaveBeenCalledWith(analysis));
  });

  it('Flujo archivo: archivo → generar → revisar → publicar (commit) con destino', async () => {
    const props = setup({ hasAttachedFile: true, attachedFileName: 'notas.txt' });
    fireEvent.click(screen.getByRole('button', { name: /Archivo adjunto/ }));
    fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));

    await screen.findByText('# doc');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));

    const dest = screen.getByPlaceholderText(/owner\/repo o repo/);
    fireEvent.change(dest, { target: { value: 'owner/repo' } });
    fireEvent.click(screen.getByRole('button', { name: /Commit directo/ }));

    await waitFor(() => expect(props.onPublishFile).toHaveBeenCalled());
    const target = (props.onPublishFile as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(target).toMatchObject({ owner: 'owner', repo: 'repo', kind: 'commit' });
  });

  it('Flujo archivo: Release pasa el repo, la versión y kind=release', async () => {
    const props = setup({ hasAttachedFile: true, attachedFileName: 'notas.txt' });
    fireEvent.click(screen.getByRole('button', { name: /Archivo adjunto/ }));
    fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));
    await screen.findByText('# doc');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    fireEvent.change(screen.getByPlaceholderText(/owner\/repo o repo/), { target: { value: 'owner/repo' } });
    fireEvent.change(screen.getByPlaceholderText(/versión release/), { target: { value: 'v2.0.0' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear Release/ }));

    await waitFor(() => expect(props.onPublishFile).toHaveBeenCalled());
    const target = (props.onPublishFile as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(target).toMatchObject({ owner: 'owner', repo: 'repo', kind: 'release', version: 'v2.0.0' });
  });

  it('Flujo archivo: repo inexistente ofrece crear repo y publicar', async () => {
    const props = setup({
      hasAttachedFile: true,
      attachedFileName: 'notas.txt',
      onPublishFile: vi.fn().mockResolvedValue('repo-missing' as const),
    });
    fireEvent.click(screen.getByRole('button', { name: /Archivo adjunto/ }));
    fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));
    await screen.findByText('# doc');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    fireEvent.change(screen.getByPlaceholderText(/owner\/repo o repo/), { target: { value: 'nuevo/repo' } });
    fireEvent.click(screen.getByRole('button', { name: /Commit directo/ }));

    await waitFor(() => expect(screen.getByText(/no existe en tu cuenta/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Crear repo y publicar/ }));
    await waitFor(() => expect(props.onCreateRepoAndPublish).toHaveBeenCalled());
  });

  it('Cancelar invoca onCancel', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  // ── #57 Tanda B fix: tests multi-archivo ────────────────────────────────────

  it('Paso 2 (archivo, multi-archivo): muestra todos los archivos con rol (primary / extra)', async () => {
    const files: FileContext[] = [
      { name: 'principal.pdf', contextText: '...', file: mockFile('principal.pdf') },
      { name: 'extra1.png', contextText: '...', file: mockFile('extra1.png') },
      { name: 'extra2.csv', contextText: '...', file: mockFile('extra2.csv') },
    ];
    setup({
      hasAttachedFile: true,
      attachedFileName: 'principal.pdf',
      attachedFile: files[0].file,
      allAttachedFiles: files,
    });
    fireEvent.click(screen.getByRole('button', { name: /Archivo adjunto/ }));

    // Primary marcado como "se documentará"
    expect(screen.getByText(/se documentará/)).toBeInTheDocument();
    expect(screen.getByText('principal.pdf')).toBeInTheDocument();
    // Extras marcados como "se subirá al repo"
    expect(screen.getByText(/extra1\.png/)).toBeInTheDocument();
    expect(screen.getByText(/extra2\.csv/)).toBeInTheDocument();
    expect(screen.getAllByText(/se subirá al repo/)).toHaveLength(2);
  });

  it('Paso 2 (archivo, mono-archivo): sigue mostrando el nombre simple', async () => {
    setup({
      hasAttachedFile: true,
      attachedFileName: 'notas.txt',
      attachedFile: mockFile('notas.txt'),
    });
    fireEvent.click(screen.getByRole('button', { name: /Archivo adjunto/ }));
    // Sin multi-archivo → vista simple
    expect(screen.getByText('📎 notas.txt')).toBeInTheDocument();
    expect(screen.queryByText(/se subirá al repo/)).not.toBeInTheDocument();
  });

  it('Paso 4 (archivo, multi-archivo): auto-puebla los extras con los no-principales', async () => {
    const f1 = mockFile('principal.pdf');
    const f2 = mockFile('extra1.png');
    const f3 = mockFile('extra2.csv');
    const files: FileContext[] = [
      { name: 'principal.pdf', contextText: '...', file: f1 },
      { name: 'extra1.png', contextText: '...', file: f2 },
      { name: 'extra2.csv', contextText: '...', file: f3 },
    ];
    const props = setup({
      hasAttachedFile: true,
      attachedFileName: 'principal.pdf',
      attachedFile: f1,
      allAttachedFiles: files,
      onPublishFile: vi.fn().mockResolvedValue('published' as const),
    });
    fireEvent.click(screen.getByRole('button', { name: /Archivo adjunto/ }));
    fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));
    await screen.findByText('# doc');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));

    // Los extras no-principales deben estar pre-cargados en Paso 4
    expect(screen.getByText('extra1.png')).toBeInTheDocument();
    expect(screen.getByText('extra2.csv')).toBeInTheDocument();

    const dest = screen.getByPlaceholderText(/owner\/repo o repo/);
    fireEvent.change(dest, { target: { value: 'owner/repo' } });
    fireEvent.click(screen.getByRole('button', { name: /Commit directo/ }));

    await waitFor(() => expect(props.onPublishFile).toHaveBeenCalled());
    const target = (props.onPublishFile as ReturnType<typeof vi.fn>).mock.calls[0][0] as { extraFiles?: File[] };
    // Los extras deben incluirse como extraFiles (no como sourceFile = principal)
    expect(target.extraFiles?.map((f: File) => f.name)).toEqual(['extra1.png', 'extra2.csv']);
  });

  it('Paso 2 repo (multi-archivo en contexto): doCreateRepoAndGenerate incluye los no-principales', async () => {
    const f1 = mockFile('main.ts');
    const f2 = mockFile('logo.png');
    const f3 = mockFile('data.csv');
    const files: FileContext[] = [
      { name: 'main.ts', contextText: '...', file: f1 },
      { name: 'logo.png', contextText: '...', file: f2 },
      { name: 'data.csv', contextText: '...', file: f3 },
    ];
    const props = setup({
      hasAttachedFile: true,
      attachedFileName: 'main.ts',
      attachedFile: f1,
      allAttachedFiles: files,
      onGenerateRepo: vi.fn().mockResolvedValue('repo-missing' as any),
      onCreateRepoAndGenerate: vi.fn().mockResolvedValue({ ...analysis, repoName: 'me/nuevo-repo' }),
    });
    fireEvent.click(screen.getByRole('button', { name: /Repositorio entero/ }));
    fireEvent.change(screen.getByPlaceholderText(/nombre-del-repo o owner\/repo/), { target: { value: 'me/nuevo-repo' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));

    await waitFor(() => expect(screen.getByText(/no existe en tu cuenta/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Crear repo y documentar/ }));

    await waitFor(() => expect(props.onCreateRepoAndGenerate).toHaveBeenCalledWith(
      'me/nuevo-repo',
      expect.arrayContaining([
        expect.objectContaining({ name: 'logo.png' }),
        expect.objectContaining({ name: 'data.csv' }),
      ]),
    ));
  });

  // ── v3.30.2: regresión TypeError "S.trim is not a function" ─────────────────
  // El botón "Documentar" (DocumentRepoButton) usaba onClick={onOpen}, así que React
  // inyectaba el MouseEvent como argumento de openDocumentFlow(initialRepo). Al ser
  // truthy, se guardaba como `initialRepo` y `repoInput` pasaba a ser el evento →
  // `repoInput.trim()` lanzaba "is not a function" → ErrorBoundary.
  // Este test reproduce el sintoma (un `initialRepo` truthy pero NO string) y verifica
  // que el modal ya no crashea: sanea a '' y abre en el paso 1.
  it('regresión: un initialRepo truthy pero no-string (p. ej. un MouseEvent) no crashea', () => {
    // Simula lo que llegaba antes: React pasa el evento como primer arg.
    const fakeEvent = { type: 'click', target: {} } as unknown as string;
    setup({ initialRepo: fakeEvent });

    // Sin saneado, esto lanzaría TypeError durante el render. Con el saneado,
    // arranca sano en el paso 1 (alcance).
    expect(screen.getByText('¿Qué quieres documentar?')).toBeInTheDocument();
  });

  it('initialRepo con string válido sigue abriendo en paso 2 con el repo pre-rellenado', () => {
    setup({ initialRepo: 'migueljerico/mi-repo' });
    // Paso 2 (repo): el input trae el valor inicial.
    const input = screen.getByPlaceholderText(/nombre-del-repo o owner\/repo/) as HTMLInputElement;
    expect(input.value).toBe('migueljerico/mi-repo');
    // El botón de generar está habilitado (repoInput.trim() no rompe).
    expect(screen.getByRole('button', { name: /Generar documentación/ })).not.toBeDisabled();
  });
});

// ── #58 (b): diff incremental en el scope `specific` ──────────────────────────
// El paso 3 muestra <DiffViewer> cuando hay contenido actual (actualización) y
// un <pre> en crudo cuando es un alta nueva (currentContent === undefined).
describe('DocumentFlowModal — #58 (b) diff incremental en scope specific', () => {
  it('paso 3: renderiza DiffViewer cuando hay currentContent (actualización)', async () => {
    const props = baseProps({
      onGenerateSpecific: vi.fn().mockResolvedValue({ doc: '# Doc nueva', currentContent: '# Doc vieja' }),
    });
    render(<DocumentFlowModal {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Documento específico del repo/ }));
    fireEvent.change(screen.getByPlaceholderText(/nombre-del-repo o owner\/repo/), { target: { value: 'owner/repo' } });
    fireEvent.change(screen.getByPlaceholderText(/Ruta: src\/components\/Button\.tsx/), { target: { value: 'src/a.ts' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar doc de este archivo/ }));

    await waitFor(() => {
      expect(screen.getByTestId('diff-viewer-mock')).toBeInTheDocument();
    });
    const diff = screen.getByTestId('diff-viewer-mock');
    expect(diff.getAttribute('data-filename')).toBe('src/a.ts');
    expect(diff.getAttribute('data-old-len')).toBe(String('# Doc vieja'.length));
    expect(diff.getAttribute('data-new-len')).toBe(String('# Doc nueva'.length));
  });

  it('paso 3: renderiza <pre> (sin DiffViewer) cuando currentContent es undefined (alta nueva)', async () => {
    const props = baseProps({
      onGenerateSpecific: vi.fn().mockResolvedValue({ doc: '# Doc nueva', currentContent: undefined }),
    });
    render(<DocumentFlowModal {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Documento específico del repo/ }));
    fireEvent.change(screen.getByPlaceholderText(/nombre-del-repo o owner\/repo/), { target: { value: 'owner/repo' } });
    fireEvent.change(screen.getByPlaceholderText(/Ruta: src\/components\/Button\.tsx/), { target: { value: 'src/a.ts' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar doc de este archivo/ }));

    await waitFor(() => {
      expect(screen.getByText('# Doc nueva')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('diff-viewer-mock')).not.toBeInTheDocument();
  });
});

// ── #58 (b) scope file: diff en paso 4 al conocer el repo destino ─────────────
// El diff aparece en el paso 4 (destino) tras meter un repo válido. Estados:
// loading → (found: DiffViewer | notfound: banner "alta nueva") | error.
describe('DocumentFlowModal — #58 (b) diff en paso 4 scope file', () => {
  // Helper: navega archivo → generar → continuar → meter repo destino.
  async function irAPaso4FileConDestino(props: Partial<Props> = {}) {
    render(<DocumentFlowModal {...baseProps(props)} />);
    fireEvent.click(screen.getByRole('button', { name: /Archivo adjunto/ }));
    fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));
    await screen.findByText('# doc');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    fireEvent.change(screen.getByPlaceholderText(/owner\/repo o repo/), { target: { value: 'owner/repo' } });
  }

  it('muestra DiffViewer cuando onFetchExistingDoc devuelve contenido (actualización)', async () => {
    await irAPaso4FileConDestino({
      hasAttachedFile: true,
      attachedFileName: 'notas.txt',
      onFetchExistingDoc: vi.fn().mockResolvedValue('# doc vieja'),
    });

    await waitFor(() => {
      expect(screen.getByTestId('diff-viewer-mock')).toBeInTheDocument();
    });
    const diff = screen.getByTestId('diff-viewer-mock');
    expect(diff.getAttribute('data-filename')).toBe('docs/notas.md');
    expect(diff.getAttribute('data-old-len')).toBe(String('# doc vieja'.length));
  });

  it('muestra banner "alta nueva" cuando onFetchExistingDoc devuelve null', async () => {
    await irAPaso4FileConDestino({
      hasAttachedFile: true,
      attachedFileName: 'notas.txt',
      onFetchExistingDoc: vi.fn().mockResolvedValue(null),
    });

    await waitFor(() => {
      expect(screen.getByText(/se creará como archivo nuevo/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('diff-viewer-mock')).not.toBeInTheDocument();
  });

  it('muestra mensaje de error cuando onFetchExistingDoc rechaza', async () => {
    await irAPaso4FileConDestino({
      hasAttachedFile: true,
      attachedFileName: 'notas.txt',
      onFetchExistingDoc: vi.fn().mockRejectedValue(new Error('red')),
    });

    await waitFor(() => {
      expect(screen.getByText(/No se pudo comprobar/i)).toBeInTheDocument();
    });
  });

  it('sin onFetchExistingDoc no renderiza diff ni banners (queda idle)', async () => {
    await irAPaso4FileConDestino({
      hasAttachedFile: true,
      attachedFileName: 'notas.txt',
      // onFetchExistingDoc ausente deliberadamente.
    });

    // Dar tiempo a que un useEffect equivocado pudiera dispararse.
    await new Promise(r => setTimeout(r, 0));
    expect(screen.queryByTestId('diff-viewer-mock')).not.toBeInTheDocument();
    expect(screen.queryByText(/se creará como archivo nuevo/i)).not.toBeInTheDocument();
  });
});

// ── #58 (b) scope repo: diff en paso 3 (tabs README/MANUAL) ───────────────────
describe('DocumentFlowModal — #58 (b) diff en paso 3 scope repo', () => {
  function analysisConActual(over: Partial<RepoAnalysis> = {}): RepoAnalysis {
    return {
      readme: 'README CONTENT', manualTecnico: 'MANUAL CONTENT',
      filesAnalyzed: 3, totalFiles: 3, truncated: false, repoName: 'owner/repo',
      ...over,
    };
  }

  // Helper: navega repo → generar → entrar en paso 3.
  async function irAPaso3Repo(over: Partial<RepoAnalysis> = {}) {
    render(<DocumentFlowModal {...baseProps({ onGenerateRepo: vi.fn().mockResolvedValue(analysisConActual(over)) })} />);
    fireEvent.click(screen.getByRole('button', { name: /Repositorio entero/ }));
    fireEvent.change(screen.getByPlaceholderText(/nombre-del-repo o owner\/repo/), { target: { value: 'owner/repo' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));
  }

  it('tab README: renderiza DiffViewer cuando analysis.readmeActual viene', async () => {
    await irAPaso3Repo({ readmeActual: 'README viejo' });

    await waitFor(() => expect(screen.getByTestId('diff-viewer-mock')).toBeInTheDocument());
    const diff = screen.getByTestId('diff-viewer-mock');
    expect(diff.getAttribute('data-filename')).toBe('README.md');
    expect(diff.getAttribute('data-old-len')).toBe(String('README viejo'.length));
  });

  it('tab MANUAL: renderiza DiffViewer cuando analysis.manualActual viene', async () => {
    await irAPaso3Repo({ readmeActual: 'README viejo', manualActual: 'MANUAL viejo' });

    await screen.findByTestId('diff-viewer-mock'); // tab README inicial
    fireEvent.click(screen.getByRole('button', { name: /MANUAL_TECNICO/ }));

    await waitFor(() => {
      const diff = screen.getByTestId('diff-viewer-mock');
      expect(diff.getAttribute('data-filename')).toBe('MANUAL_TECNICO.md');
      expect(diff.getAttribute('data-old-len')).toBe(String('MANUAL viejo'.length));
    });
  });

  it('tab README: muestra <pre> (sin DiffViewer) cuando readmeActual no viene', async () => {
    await irAPaso3Repo(); // sin readmeActual

    await screen.findByText('README CONTENT');
    expect(screen.queryByTestId('diff-viewer-mock')).not.toBeInTheDocument();
  });
});

// ── #58 (a): scope bulk multi-archivo atómico ────────────────────────────────
describe('#58 (a) bulk multi-archivo', () => {
  it('Paso 1: muestra el botón de alcance bulk', () => {
    setup();
    expect(screen.getByRole('button', { name: /Varios archivos a la vez/ })).toBeInTheDocument();
  });

  it('Paso 2 bulk: multi-select de paths + botón Generar deshabilitado sin selección', async () => {
    setup({
      repoFileTree: [{ path: 'src/a.ts' }, { path: 'src/b.ts' }],
    });
    fireEvent.click(screen.getByRole('button', { name: /Varios archivos a la vez/ }));
    // Hay un input para el repo
    fireEvent.change(screen.getByPlaceholderText(/owner\/repo o repo/), { target: { value: 'owner/repo' } });
    // El árbol muestra los dos paths como checkboxes
    expect(screen.getByText('src/a.ts')).toBeInTheDocument();
    expect(screen.getByText('src/b.ts')).toBeInTheDocument();
    // Botón de generar está deshabilitado mientras no se seleccione nada ni haya adjuntos
    expect(screen.getByRole('button', { name: /Generar documentación/ })).toBeDisabled();
  });

  it('Flujo bulk con paths IA: selecciona → genera → commit directo llama onCommitBulk', async () => {
    const props = setup({
      repoFileTree: [{ path: 'src/a.ts' }, { path: 'src/b.ts' }],
    });
    fireEvent.click(screen.getByRole('button', { name: /Varios archivos a la vez/ }));
    fireEvent.change(screen.getByPlaceholderText(/owner\/repo o repo/), { target: { value: 'owner/repo' } });

    // Marca los 2 paths
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => fireEvent.click(cb));

    const genBtn = screen.getByRole('button', { name: /Generar documentación/ });
    fireEvent.click(genBtn);

    // Tras generar, va al paso 3 (resumen). Esperamos ver el resumen.
    await waitFor(() => {
      expect(props.onGenerateSpecific).toHaveBeenCalledTimes(2);
    });

    // Continúa al paso 4
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    // Rellena destino (pre-llenado con el repo del paso 2, pero forzamos valor)
    const dest = screen.getByPlaceholderText(/owner\/repo o repo/);
    fireEvent.change(dest, { target: { value: 'owner/repo' } });

    // Click en Commit directo
    fireEvent.click(screen.getByRole('button', { name: /Commit directo/ }));
    await waitFor(() => expect(props.onCommitBulk).toHaveBeenCalled());
    const [ownerArg, repoArg, targetsArg] = (props.onCommitBulk as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(ownerArg).toBe('owner');
    expect(repoArg).toBe('repo');
    expect(targetsArg).toHaveLength(2);
    expect(targetsArg[0]).toMatchObject({ path: 'src/a.ts', content: 'specific doc' });
  });

  it('Flujo bulk con Draft PR llama onDraftPrBulk', async () => {
    const props = setup({
      repoFileTree: [{ path: 'src/x.ts' }],
    });
    fireEvent.click(screen.getByRole('button', { name: /Varios archivos a la vez/ }));
    fireEvent.change(screen.getByPlaceholderText(/owner\/repo o repo/), { target: { value: 'owner/repo' } });
    fireEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));
    await waitFor(() => expect(props.onGenerateSpecific).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    fireEvent.change(screen.getByPlaceholderText(/owner\/repo o repo/), { target: { value: 'owner/repo' } });
    fireEvent.click(screen.getByRole('button', { name: /Draft PR/ }));
    await waitFor(() => expect(props.onDraftPrBulk).toHaveBeenCalled());
  });

  it('Mezcla: paths IA + adjuntos → targets combina ambos', async () => {
    const fc: FileContext = { name: 'notas.txt', contextText: 'NOTAS RAW', file: mockFile('notas.txt', 'NOTAS RAW') };
    const props = setup({
      repoFileTree: [{ path: 'src/y.ts' }],
      hasAttachedFile: true,
      allAttachedFiles: [fc],
    });
    fireEvent.click(screen.getByRole('button', { name: /Varios archivos a la vez/ }));
    fireEvent.change(screen.getByPlaceholderText(/owner\/repo o repo/), { target: { value: 'owner/repo' } });
    fireEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));
    await waitFor(() => expect(props.onGenerateSpecific).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    fireEvent.change(screen.getByPlaceholderText(/owner\/repo o repo/), { target: { value: 'owner/repo' } });
    fireEvent.click(screen.getByRole('button', { name: /Commit directo/ }));

    await waitFor(() => expect(props.onCommitBulk).toHaveBeenCalled());
    const targetsArg = (props.onCommitBulk as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(targetsArg).toHaveLength(2);
    const paths = targetsArg.map((t: { path: string }) => t.path);
    expect(paths).toContain('src/y.ts');
    expect(paths).toContain('notas.txt');
    // El contenido del adjunto es el texto del File
    const notasTarget = targetsArg.find((t: { path: string }) => t.path === 'notas.txt');
    expect(notasTarget.content).toBe('NOTAS RAW');
  });
});

// v3.66.0 (Frente C): los doCommit*Specific deben propagar specificRepoInput al
// callback para que el destino sea el repo tecleado (no user.login hardcodeado).
describe('DocumentFlowModal — scope specific propaga specificRepoInput (v3.66.0 Frente C)', () => {
  // Helper: navega hasta el paso 4 del scope specific con un repo/path rellenos y
  // un doc generado (mock). Devuelve las props para inspeccionar los callbacks.
  async function gotoSpecificStep4() {
    const props = setup();
    // Paso 1 → seleccionar scope "specific".
    fireEvent.click(screen.getByText('Documento específico del repo'));
    // Paso 2 → rellenar repo + path y generar.
    const repoInput = document.getElementById('flow-specific-repo-input') as HTMLInputElement;
    const pathInput = document.getElementById('flow-specific-path-input') as HTMLInputElement;
    fireEvent.change(repoInput, { target: { value: 'powerbi-dashboard-mercadona' } });
    fireEvent.change(pathInput, { target: { value: 'docs/api.md' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar doc de este archivo/i }));
    // Esperar a que onGenerateSpecific resuelva y avance al paso 3.
    await waitFor(() => expect(screen.getByText('docs/api.md')).toBeInTheDocument());
    // Paso 3 → continuar al paso 4 (publicación).
    fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
    return props;
  }

  it('Commit directo: onCommitSpecific recibe el repo tecleado como 3er argumento', async () => {
    const props = await gotoSpecificStep4();
    fireEvent.click(screen.getByRole('button', { name: /Commit directo/i }));
    await waitFor(() => expect(props.onCommitSpecific).toHaveBeenCalled());
    expect(props.onCommitSpecific).toHaveBeenCalledWith('specific doc', 'docs/api.md', 'powerbi-dashboard-mercadona');
  });

  it('Draft PR: onDraftPrSpecific recibe el repo tecleado como 3er argumento', async () => {
    const props = await gotoSpecificStep4();
    fireEvent.click(screen.getByRole('button', { name: /Crear Draft PR/i }));
    await waitFor(() => expect(props.onDraftPrSpecific).toHaveBeenCalled());
    expect(props.onDraftPrSpecific).toHaveBeenCalledWith('specific doc', 'docs/api.md', 'powerbi-dashboard-mercadona');
  });

  it('Release: onReleaseSpecific recibe el repo tecleado como 3er argumento', async () => {
    const props = await gotoSpecificStep4();
    fireEvent.click(screen.getByRole('button', { name: /Crear Release/i }));
    await waitFor(() => expect(props.onReleaseSpecific).toHaveBeenCalled());
    expect(props.onReleaseSpecific).toHaveBeenCalledWith('specific doc', 'docs/api.md', 'powerbi-dashboard-mercadona');
  });
});
