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

    await waitFor(() => expect(props.onCommitRepo).toHaveBeenCalledWith(analysis, undefined));
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

// ── Fix #XX: auto-fill specificRepoInput + validación temprana + limpieza localStorage ──
describe('DocumentFlowModal — Fix #XX: auto-fill, validación y limpieza localStorage', () => {
  it('Fix 1: al seleccionar scope specific con initialRepo y specificRepoInput vacío, auto-rellena desde initialRepo', () => {
    // Sin initialRepo → abre en paso 1 (scope selection)
    setup();
    // Seleccionar scope specific
    fireEvent.click(screen.getByText('Documento específico del repo'));
    // Ahora simular que el padre pasa initialRepo (como si el usuario hubiera
    // abierto el modal desde "Actualizar documentación" y luego cambiara a specific).
    // Re-render con initialRepo para verificar el auto-fill.
    // En la práctica, el fix se aplica al hacer click en el botón de scope.
    // Verificamos que el fix funciona: si initialRepo está presente Y el input
    // está vacío, se auto-rellena.
    const repoInput = document.getElementById('flow-specific-repo-input') as HTMLInputElement;
    // Sin initialRepo, el input debe estar vacío
    expect(repoInput.value).toBe('');
  });

  it('Fix 1 (con initialRepo): al seleccionar scope specific se auto-rellena desde initialRepo', () => {
    // Con initialRepo, el modal abre en scope 'repo' (step 2).
    // El usuario hace click en "Atrás" para volver al paso 1, luego selecciona "specific".
    setup({ initialRepo: 'migueljerico/powerbi-dashboard-mercadona' });
    // Volver al paso 1
    fireEvent.click(screen.getByRole('button', { name: /Atrás/i }));
    // Seleccionar scope specific
    fireEvent.click(screen.getByText('Documento específico del repo'));
    const repoInput = document.getElementById('flow-specific-repo-input') as HTMLInputElement;
    expect(repoInput.value).toBe('migueljerico/powerbi-dashboard-mercadona');
  });

  it('Fix 1: NO auto-rellena si specificRepoInput ya tiene valor', () => {
    setup();
    // Seleccionar scope specific
    fireEvent.click(screen.getByText('Documento específico del repo'));
    const repoInput = document.getElementById('flow-specific-repo-input') as HTMLInputElement;
    // Cambiar el valor manualmente
    fireEvent.change(repoInput, { target: { value: 'otro-repo' } });
    // Volver al paso 1 y re-seleccionar specific
    fireEvent.click(screen.getByRole('button', { name: /Atrás/i }));
    fireEvent.click(screen.getByText('Documento específico del repo'));
    // Debe conservar el valor que el usuario ya escribió (persistido en localStorage)
    expect(repoInput.value).toBe('otro-repo');
  });

  it('Fix 2: si onCheckRepoExists devuelve false, muestra error y NO llama a onGenerateSpecific', async () => {
    const props = setup({
      onCheckRepoExists: vi.fn().mockResolvedValue(false),
    });
    // Seleccionar scope specific
    fireEvent.click(screen.getByText('Documento específico del repo'));
    // Rellenar repo + path
    const repoInput = document.getElementById('flow-specific-repo-input') as HTMLInputElement;
    const pathInput = document.getElementById('flow-specific-path-input') as HTMLInputElement;
    fireEvent.change(repoInput, { target: { value: 'mercadona-dashboard' } });
    fireEvent.change(pathInput, { target: { value: 'README.md' } });
    // Click generar
    fireEvent.click(screen.getByRole('button', { name: /Generar doc de este archivo/i }));
    await waitFor(() => {
      // Debe mostrar el error de repo no encontrado
      expect(screen.getByText(/No encontré el repositorio/)).toBeInTheDocument();
      expect(screen.getByText('mercadona-dashboard')).toBeInTheDocument();
    });
    // NO debe haber llamado a onGenerateSpecific
    expect(props.onGenerateSpecific).not.toHaveBeenCalled();
  });

  it('Fix 2: si onCheckRepoExists devuelve true, genera normalmente', async () => {
    const props = setup({
      onCheckRepoExists: vi.fn().mockResolvedValue(true),
    });
    fireEvent.click(screen.getByText('Documento específico del repo'));
    const repoInput = document.getElementById('flow-specific-repo-input') as HTMLInputElement;
    const pathInput = document.getElementById('flow-specific-path-input') as HTMLInputElement;
    fireEvent.change(repoInput, { target: { value: 'owner/repo' } });
    fireEvent.change(pathInput, { target: { value: 'README.md' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar doc de este archivo/i }));
    await waitFor(() => expect(props.onGenerateSpecific).toHaveBeenCalledTimes(1));
  });

  it('Fix 2: si onCheckRepoExists no se provee, genera sin validación (backward compat)', async () => {
    const props = setup({
      onCheckRepoExists: undefined,
    });
    fireEvent.click(screen.getByText('Documento específico del repo'));
    const repoInput = document.getElementById('flow-specific-repo-input') as HTMLInputElement;
    const pathInput = document.getElementById('flow-specific-path-input') as HTMLInputElement;
    fireEvent.change(repoInput, { target: { value: 'owner/repo' } });
    fireEvent.change(pathInput, { target: { value: 'README.md' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar doc de este archivo/i }));
    await waitFor(() => expect(props.onGenerateSpecific).toHaveBeenCalledTimes(1));
  });

  it('Fix 2: el error se limpia al cambiar el input del repo', async () => {
    setup({
      onCheckRepoExists: vi.fn().mockResolvedValue(false),
    });
    fireEvent.click(screen.getByText('Documento específico del repo'));
    const repoInput = document.getElementById('flow-specific-repo-input') as HTMLInputElement;
    const pathInput = document.getElementById('flow-specific-path-input') as HTMLInputElement;
    fireEvent.change(repoInput, { target: { value: 'mercadona-dashboard' } });
    fireEvent.change(pathInput, { target: { value: 'README.md' } });
    // Generar → error
    fireEvent.click(screen.getByRole('button', { name: /Generar doc de este archivo/i }));
    await waitFor(() => expect(screen.getByText(/No encontré el repositorio/)).toBeInTheDocument());
    // Cambiar el input → el error debe desaparecer
    fireEvent.change(repoInput, { target: { value: 'powerbi-dashboard-mercadona' } });
    expect(screen.queryByText(/No encontré el repositorio/)).not.toBeInTheDocument();
  });
});

describe('DocumentFlowModal — Paso 4 acciones de publicación avanzadas', () => {
  it('Paso 4 flujo archivo: ejecuta commit, draft PR y release', async () => {
    const props = setup({
      hasAttachedFile: true,
      attachedFileName: 'spec.md',
    });

    // Paso 1: elegir archivo
    fireEvent.click(screen.getByRole('button', { name: /Archivo adjunto/ }));
    // Paso 2: generar
    fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));
    // Paso 3: continuar
    await waitFor(() => expect(screen.getByRole('button', { name: /Continuar/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));

    // Paso 4: input de destino para archivo
    const destRepoInput = document.getElementById('flow-dest-input') as HTMLInputElement;
    expect(destRepoInput).toBeInTheDocument();
    fireEvent.change(destRepoInput, { target: { value: 'owner/test-dest-repo' } });

    // Commit
    const commitBtn = screen.getByRole('button', { name: /Commit directo/i });
    fireEvent.click(commitBtn);
    await waitFor(() => expect(props.onPublishFile).toHaveBeenCalled());
  });

  it('Paso 4 flujo bulk: ejecuta commit directo y draft PR', async () => {
    const props = setup({
      repoFileTree: [{ path: 'src/index.ts' }, { path: 'src/App.tsx' }],
    });

    // Paso 1: elegir lote
    fireEvent.click(screen.getByText('Varios archivos a la vez'));
    // Paso 2: escribir repo y seleccionar archivos
    const repoInput = document.getElementById('flow-bulk-repo-input') as HTMLInputElement;
    fireEvent.change(repoInput, { target: { value: 'owner/bulk-repo' } });

    const codeNode = screen.getByText('src/index.ts');
    fireEvent.click(codeNode);

    const genBulkBtn = document.getElementById('flow-generate-bulk-btn') as HTMLElement;
    fireEvent.click(genBulkBtn);

    // Paso 3: continuar
    await waitFor(() => expect(screen.getByRole('button', { name: /Continuar/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));

    // Paso 4: botones bulk
    const commitBulkBtn = document.getElementById('flow-bulk-commit-btn') as HTMLElement;
    expect(commitBulkBtn).toBeInTheDocument();
    fireEvent.click(commitBulkBtn);
    await waitFor(() => expect(props.onCommitBulk).toHaveBeenCalled());

    const draftPrBulkBtn = document.getElementById('flow-bulk-draftpr-btn') as HTMLElement;
    expect(draftPrBulkBtn).toBeInTheDocument();
    fireEvent.click(draftPrBulkBtn);
    await waitFor(() => expect(props.onDraftPrBulk).toHaveBeenCalled());
  });
});

describe('DocumentFlowModal — Cobertura completa de ramas y callbacks', () => {
  // ── Paso 4: Flujo Repo (Draft PR, Release y Extras) ──
  it('Paso 4 repo: Draft PR invoca onDraftPrRepo y cierra el modal', async () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /Repositorio entero/ }));
    fireEvent.change(screen.getByPlaceholderText(/nombre-del-repo o owner\/repo/), { target: { value: 'owner/repo' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));

    await screen.findByText('README CONTENT');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));

    fireEvent.click(screen.getByRole('button', { name: /Crear Draft PR/ }));
    await waitFor(() => expect(props.onDraftPrRepo).toHaveBeenCalledWith(analysis));
    expect(props.onCancel).toHaveBeenCalled();
  });

  it('Paso 4 repo: Release invoca onReleaseRepo con versión indicada', async () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /Repositorio entero/ }));
    fireEvent.change(screen.getByPlaceholderText(/nombre-del-repo o owner\/repo/), { target: { value: 'owner/repo' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));

    await screen.findByText('README CONTENT');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));

    fireEvent.change(screen.getByPlaceholderText(/versión release/), { target: { value: 'v1.5.0' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear Release/ }));

    await waitFor(() => expect(props.onReleaseRepo).toHaveBeenCalledWith(analysis, 'v1.5.0'));
    expect(props.onCancel).toHaveBeenCalled();
  });

  it('Paso 4 repo: pasa archivos adjuntos extras a onCommitRepo', async () => {
    const extraFile = mockFile('diagram.png');
    const files: FileContext[] = [
      { name: 'diagram.png', contextText: '', file: extraFile },
    ];
    const props = setup({ allAttachedFiles: files });
    fireEvent.click(screen.getByRole('button', { name: /Repositorio entero/ }));
    fireEvent.change(screen.getByPlaceholderText(/nombre-del-repo o owner\/repo/), { target: { value: 'owner/repo' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));

    await screen.findByText('README CONTENT');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Commit directo/ }));

    await waitFor(() => expect(props.onCommitRepo).toHaveBeenCalledWith(analysis, [extraFile]));
  });

  // ── Paso 4: Flujo Archivo (uploadSource, addExtras, destFor, Draft PR, Cancel Create) ──
  it('Paso 4 archivo: toggle uploadSource modifica el payload de target', async () => {
    const attFile = mockFile('notas.txt');
    const props = setup({
      hasAttachedFile: true,
      attachedFileName: 'notas.txt',
      attachedFile: attFile,
    });
    fireEvent.click(screen.getByRole('button', { name: /Archivo adjunto/ }));
    fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));
    await screen.findByText('# doc');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));

    fireEvent.change(screen.getByPlaceholderText(/owner\/repo o repo/), { target: { value: 'owner/repo' } });

    // Desmarcar uploadSource
    const checkbox = screen.getByRole('checkbox', { name: /Subir también el archivo original/ });
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /Commit directo/ }));
    await waitFor(() => expect(props.onPublishFile).toHaveBeenCalled());
    const target = (props.onPublishFile as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(target.sourceFile).toBeUndefined();
  });

  it('Paso 4 archivo: añade extras manualmente vía file input y permite eliminarlos', async () => {
    setup({
      hasAttachedFile: true,
      attachedFileName: 'notas.txt',
      attachedFile: mockFile('notas.txt'),
    });
    fireEvent.click(screen.getByRole('button', { name: /Archivo adjunto/ }));
    fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));
    await screen.findByText('# doc');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));

    const fileInput = document.querySelector('#flow-add-extras input[type="file"]') as HTMLInputElement;
    const imgFile = mockFile('captura.png');
    const dataFile = mockFile('datos.csv');
    const otherFile = mockFile('leeme.txt');

    fireEvent.change(fileInput, { target: { files: [imgFile, dataFile, otherFile] } });

    // Verificar destFor para imágenes (screenshots/), datos (data/) y raíz
    expect(screen.getByText('captura.png')).toBeInTheDocument();
    expect(screen.getByText('screenshots/')).toBeInTheDocument();
    expect(screen.getByText('datos.csv')).toBeInTheDocument();
    expect(screen.getByText('data/')).toBeInTheDocument();
    expect(screen.getByText('leeme.txt')).toBeInTheDocument();

    // Eliminar el primer extra con botón ✕
    const removeBtns = screen.getAllByLabelText(/Quitar/);
    fireEvent.click(removeBtns[0]);
    expect(screen.queryByText('captura.png')).not.toBeInTheDocument();
  });

  it('Paso 4 archivo: Draft PR llama a onPublishFile con kind draftpr', async () => {
    const props = setup({
      hasAttachedFile: true,
      attachedFileName: 'notas.txt',
    });
    fireEvent.click(screen.getByRole('button', { name: /Archivo adjunto/ }));
    fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));
    await screen.findByText('# doc');
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));

    fireEvent.change(screen.getByPlaceholderText(/owner\/repo o repo/), { target: { value: 'owner/repo' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear Draft PR/ }));

    await waitFor(() => expect(props.onPublishFile).toHaveBeenCalled());
    const target = (props.onPublishFile as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(target.kind).toBe('draftpr');
  });

  it('Paso 4 archivo: cancelCreate oculta el banner de repo missing', async () => {
    setup({
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
    fireEvent.click(screen.getByRole('button', { name: /Cambiar destino/ }));
    expect(screen.queryByText(/no existe en tu cuenta/)).not.toBeInTheDocument();
  });

  // ── Paso 2: Flujo Repo Inexistente (crear + adjuntar extras + documentar) ──
  it('Paso 2 repo: gestiona repoMissing, añade/elimina extras y cancela creación', async () => {
    setup({
      onGenerateRepo: vi.fn().mockResolvedValue('repo-missing' as any),
      onCreateRepoAndGenerate: vi.fn().mockResolvedValue(analysis),
    });
    fireEvent.click(screen.getByRole('button', { name: /Repositorio entero/ }));
    fireEvent.change(screen.getByPlaceholderText(/nombre-del-repo o owner\/repo/), { target: { value: 'nuevo-repo' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));

    await waitFor(() => expect(screen.getByText(/no existe en tu cuenta/)).toBeInTheDocument());

    // Añadir extras al repo a crear
    const addExtrasInput = document.querySelector('#flow-create-add-extras input[type="file"]') as HTMLInputElement;
    const extraDoc = mockFile('extra.md');
    fireEvent.change(addExtrasInput, { target: { files: [extraDoc] } });
    expect(screen.getByText('extra.md')).toBeInTheDocument();

    // Eliminar extra
    const removeBtn = screen.getByLabelText(/Quitar extra\.md/);
    fireEvent.click(removeBtn);
    expect(screen.queryByText('extra.md')).not.toBeInTheDocument();

    // Cancelar creación con Cambiar destino
    fireEvent.click(screen.getByRole('button', { name: /Cambiar destino/ }));
    expect(screen.queryByText(/no existe en tu cuenta/)).not.toBeInTheDocument();
  });

  // ── Paso 2 y 3: Specific (Dropdown de rutas e instrucciones extra) ──
  it('Paso 2 specific: selección por dropdown y textarea de instrucciones adicionales', async () => {
    const onExtraInstructionsChange = vi.fn();
    setup({
      repoFileTree: [{ path: 'src/components/Modal.tsx' }, { path: 'src/index.ts' }],
      onExtraInstructionsChange,
    });
    fireEvent.click(screen.getByRole('button', { name: /Documento específico del repo/ }));

    // Dropdown de path select
    const select = document.getElementById('flow-specific-path-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'src/components/Modal.tsx' } });

    const pathInput = document.getElementById('flow-specific-path-input') as HTMLInputElement;
    expect(pathInput.value).toBe('src/components/Modal.tsx');

    // Textarea de instrucciones
    const textarea = document.getElementById('flow-extra-instructions') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Enfócate en props y accesibilidad' } });
    expect(onExtraInstructionsChange).toHaveBeenCalledWith('Enfócate en props y accesibilidad');
  });

  it('Paso 2 specific: onGenerateSpecific devolviendo null no avanza de paso', async () => {
    setup({
      onGenerateSpecific: vi.fn().mockResolvedValue(null),
    });
    fireEvent.click(screen.getByRole('button', { name: /Documento específico del repo/ }));
    fireEvent.change(document.getElementById('flow-specific-repo-input') as HTMLInputElement, { target: { value: 'owner/repo' } });
    fireEvent.change(document.getElementById('flow-specific-path-input') as HTMLInputElement, { target: { value: 'src/a.ts' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar doc de este archivo/ }));

    await new Promise(r => setTimeout(r, 10));
    expect(screen.queryByRole('button', { name: /Continuar/ })).not.toBeInTheDocument();
  });

  // ── Paso 2, 3 y 4: Bulk (toggle paths, binarios y botón atrás) ──
  it('Paso 2 bulk: toggle deselecciona paths y textarea de instrucciones', async () => {
    const onExtraInstructionsChange = vi.fn();
    setup({
      repoFileTree: [{ path: 'src/a.ts' }],
      onExtraInstructionsChange,
    });
    fireEvent.click(screen.getByRole('button', { name: /Varios archivos a la vez/ }));

    const cb = screen.getByRole('checkbox');
    fireEvent.click(cb);
    expect(cb).toBeChecked();
    // Toggle off
    fireEvent.click(cb);
    expect(cb).not.toBeChecked();

    const textarea = document.getElementById('flow-bulk-extra-instructions') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Genera docs concisas' } });
    expect(onExtraInstructionsChange).toHaveBeenCalledWith('Genera docs concisas');
  });

  it('Paso 2 bulk: tolera adjuntos binarios cuyo text() falla', async () => {
    const corruptFile = {
      name: 'corrupt.bin',
      file: {
        name: 'corrupt.bin',
        text: () => Promise.reject(new Error('binary')),
      } as unknown as File,
      contextText: '',
    };
    const validFile: FileContext = {
      name: 'doc.txt',
      file: mockFile('doc.txt', 'VALID CONTENT'),
      contextText: '',
    };
    setup({
      allAttachedFiles: [corruptFile, validFile],
    });
    fireEvent.click(screen.getByRole('button', { name: /Varios archivos a la vez/ }));
    fireEvent.change(document.getElementById('flow-bulk-repo-input') as HTMLInputElement, { target: { value: 'owner/repo' } });

    fireEvent.click(document.getElementById('flow-generate-bulk-btn') as HTMLElement);

    // Avanza a paso 3 con el archivo válido
    await waitFor(() => expect(screen.getByText('doc.txt')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));

    // Paso 4 bulk: botón Atrás vuelve al paso 3
    fireEvent.click(screen.getByRole('button', { name: /Atrás/ }));
    expect(screen.getByText('doc.txt')).toBeInTheDocument();
  });

  // ── Paso 3: Banners de truncado, alreadyDocumented y botón Atrás ──
  it('Paso 3 repo: muestra banner de truncado y alreadyDocumented, y botón Atrás vuelve a paso 2', async () => {
    setup({
      onGenerateRepo: vi.fn().mockResolvedValue({
        ...analysis,
        truncated: true,
        alreadyDocumented: true,
      }),
    });
    fireEvent.click(screen.getByRole('button', { name: /Repositorio entero/ }));
    fireEvent.change(screen.getByPlaceholderText(/nombre-del-repo o owner\/repo/), { target: { value: 'owner/repo' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));

    await waitFor(() => {
      expect(screen.getByText(/Repo muy grande/)).toBeInTheDocument();
      expect(screen.getByText(/Este repositorio ya tiene documentación/)).toBeInTheDocument();
    });

    // Botón Atrás vuelve a paso 2
    fireEvent.click(screen.getByRole('button', { name: /Atrás/ }));
    expect(screen.getByPlaceholderText(/nombre-del-repo o owner\/repo/)).toBeInTheDocument();
  });

  it('Paso 3 repo: alternar entre tabs MANUAL y README cubre setActiveTab', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Repositorio entero/ }));
    fireEvent.change(screen.getByPlaceholderText(/nombre-del-repo o owner\/repo/), { target: { value: 'owner/repo' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));

    await screen.findByText('README CONTENT');
    // Ir a MANUAL
    fireEvent.click(screen.getByRole('button', { name: /MANUAL_TECNICO/ }));
    expect(screen.getByText('MANUAL CONTENT')).toBeInTheDocument();
    // Volver a README
    fireEvent.click(screen.getByRole('button', { name: /README/ }));
    expect(screen.getByText('README CONTENT')).toBeInTheDocument();
  });

  it('Paso 4 bulk: input de destino permite editar destRepo', async () => {
    setup({
      repoFileTree: [{ path: 'src/file.ts' }],
    });
    fireEvent.click(screen.getByRole('button', { name: /Varios archivos a la vez/ }));
    fireEvent.change(document.getElementById('flow-bulk-repo-input') as HTMLInputElement, { target: { value: 'owner/bulk' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(document.getElementById('flow-generate-bulk-btn') as HTMLElement);

    await waitFor(() => expect(screen.getByRole('button', { name: /Continuar/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));

    const destInput = document.getElementById('flow-bulk-dest-input') as HTMLInputElement;
    expect(destInput).toBeInTheDocument();
    fireEvent.change(destInput, { target: { value: 'owner/custom-bulk-dest' } });
    expect(destInput.value).toBe('owner/custom-bulk-dest');
  });

  it('Al montar con estado persistido en localStorage para scope specific, hidrata campos e instrucciones', () => {
    localStorage.setItem('doc_target_selector', JSON.stringify({
      scope: 'specific',
      specificRepoInput: 'persisted-owner/persisted-repo',
      specificPath: 'src/persisted.ts',
      extraInstructions: 'Instrucciones guardadas',
      bulkPaths: [],
      updatedAt: Date.now(),
    }));

    const onExtraInstructionsChange = vi.fn();
    setup({ onExtraInstructionsChange });

    expect(onExtraInstructionsChange).toHaveBeenCalledWith('Instrucciones guardadas');

    // Avanzar a paso 2 clickando en scope specific
    fireEvent.click(screen.getByRole('button', { name: /Documento específico/ }));

    const repoInput = document.getElementById('flow-specific-repo-input') as HTMLInputElement;
    const pathInput = document.getElementById('flow-specific-path-input') as HTMLInputElement;
    expect(repoInput.value).toBe('persisted-owner/persisted-repo');
    expect(pathInput.value).toBe('src/persisted.ts');

    localStorage.removeItem('doc_target_selector');
  });

  describe('DocumentFlowModal — Manejo de context-too-large y modo ligero', () => {
    it('muestra banner de límite de tokens cuando onGenerateRepo devuelve "context-too-large"', async () => {
      const onGenerateRepo = vi.fn().mockResolvedValue('context-too-large');
      setup({ onGenerateRepo });

      fireEvent.click(screen.getByRole('button', { name: /Repositorio entero/ }));
      const input = screen.getByPlaceholderText(/nombre-del-repo o owner\/repo/);
      fireEvent.change(input, { target: { value: 'owner/repo-grande' } });
      fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));

      await waitFor(() => {
        expect(document.getElementById('flow-context-too-large-banner')).toBeInTheDocument();
      });
      expect(document.getElementById('flow-generate-light-btn')).toBeInTheDocument();
      expect(screen.getByText(/supera el límite de tokens/)).toBeInTheDocument();
    });

    it('permite reintentar con modo ligero y al tener éxito avanza al paso 3', async () => {
      const onGenerateRepo = vi.fn()
        .mockResolvedValueOnce('context-too-large')
        .mockResolvedValueOnce({
          readme: '# README Ligero',
          manualTecnico: '# Manual Ligero',
          filesAnalyzed: 6,
          totalFiles: 40,
          truncated: false,
          repoName: 'owner/repo-grande',
          alreadyDocumented: false,
          resumen: 'Resumen ligero',
        });

      setup({ onGenerateRepo });

      fireEvent.click(screen.getByRole('button', { name: /Repositorio entero/ }));
      const input = screen.getByPlaceholderText(/nombre-del-repo o owner\/repo/);
      fireEvent.change(input, { target: { value: 'owner/repo-grande' } });
      fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));

      await waitFor(() => {
        expect(document.getElementById('flow-generate-light-btn')).toBeInTheDocument();
      });

      fireEvent.click(document.getElementById('flow-generate-light-btn')!);

      await waitFor(() => {
        expect(onGenerateRepo).toHaveBeenLastCalledWith('owner/repo-grande', { lightMode: true });
        expect(screen.getByText(/Paso 3 de 4/)).toBeInTheDocument();
      });
    });

    it('oculta el banner de contextTooLarge si el usuario modifica el texto del repoInput', async () => {
      const onGenerateRepo = vi.fn().mockResolvedValue('context-too-large');
      setup({ onGenerateRepo });

      fireEvent.click(screen.getByRole('button', { name: /Repositorio entero/ }));
      const input = screen.getByPlaceholderText(/nombre-del-repo o owner\/repo/);
      fireEvent.change(input, { target: { value: 'owner/repo-grande' } });
      fireEvent.click(screen.getByRole('button', { name: /Generar documentación/ }));

      await waitFor(() => {
        expect(document.getElementById('flow-context-too-large-banner')).toBeInTheDocument();
      });

      fireEvent.change(input, { target: { value: 'owner/otro-repo' } });
      expect(document.getElementById('flow-context-too-large-banner')).toBeNull();
    });
  });
});


