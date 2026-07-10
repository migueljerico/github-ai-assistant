import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DocumentFlowModal from '../DocumentFlowModal';
import type { RepoAnalysis } from '../../../types';

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
    onCancel: vi.fn(),
    ...overrides,
  };
}

function setup(overrides: Partial<Props> = {}) {
  const props = baseProps(overrides);
  render(<DocumentFlowModal {...props} />);
  return props;
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
});
