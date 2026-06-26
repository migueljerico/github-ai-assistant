import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PublishActions from '../PublishActions';

function setup(overrides: Partial<React.ComponentProps<typeof PublishActions>> = {}) {
  const props = {
    version: '',
    onVersionChange: vi.fn(),
    onCommit: vi.fn(),
    onDraftPr: vi.fn(),
    onRelease: vi.fn(),
    onCancel: vi.fn(),
    busy: false,
    ...overrides,
  };
  render(<PublishActions {...props} />);
  return props;
}

describe('PublishActions (v3.10.0 — barra compartida de publicación)', () => {
  it('muestra el input de versión y las 4 acciones', () => {
    setup();
    expect(screen.getByPlaceholderText(/versión release/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancelar/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Commit directo/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Crear Draft PR/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Crear Release/ })).toBeInTheDocument();
  });

  it('cada botón invoca su callback', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /Commit directo/ }));
    fireEvent.click(screen.getByRole('button', { name: /Crear Draft PR/ }));
    fireEvent.click(screen.getByRole('button', { name: /Crear Release/ }));
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }));
    expect(props.onCommit).toHaveBeenCalledTimes(1);
    expect(props.onDraftPr).toHaveBeenCalledTimes(1);
    expect(props.onRelease).toHaveBeenCalledTimes(1);
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('el input de versión propaga el cambio', () => {
    const props = setup();
    fireEvent.change(screen.getByPlaceholderText(/versión release/), { target: { value: 'v9.9.9' } });
    expect(props.onVersionChange).toHaveBeenCalledWith('v9.9.9');
  });

  it('busy deshabilita todas las acciones', () => {
    setup({ busy: true });
    expect(screen.getByRole('button', { name: /Cancelar/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Commit directo/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Crear Draft PR/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Crear Release/ })).toBeDisabled();
  });

  it('publishDisabled deshabilita las 3 acciones de publicar pero NO Cancelar', () => {
    setup({ publishDisabled: true });
    expect(screen.getByRole('button', { name: /Cancelar/ })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Commit directo/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Crear Draft PR/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Crear Release/ })).toBeDisabled();
  });

  it('muestra los spinners por acción', () => {
    setup({ busy: true, isCommitting: true });
    expect(screen.getByRole('button', { name: /Haciendo commit/ })).toBeInTheDocument();
  });

  describe('repoMissing (oferta de crear repo)', () => {
    it('oculta las acciones de publicar y muestra crear/cambiar', () => {
      setup({ repoMissing: { owner: 'me', repo: 'nuevo' } });
      expect(screen.queryByRole('button', { name: /Commit directo/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Crear repo y publicar/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cambiar destino/ })).toBeInTheDocument();
    });

    it('los botones invocan onCreateRepoAndPublish / onCancelCreate', () => {
      const onCreateRepoAndPublish = vi.fn();
      const onCancelCreate = vi.fn();
      setup({ repoMissing: { owner: 'me', repo: 'nuevo' }, onCreateRepoAndPublish, onCancelCreate });
      fireEvent.click(screen.getByRole('button', { name: /Crear repo y publicar/ }));
      fireEvent.click(screen.getByRole('button', { name: /Cambiar destino/ }));
      expect(onCreateRepoAndPublish).toHaveBeenCalledTimes(1);
      expect(onCancelCreate).toHaveBeenCalledTimes(1);
    });
  });
});
