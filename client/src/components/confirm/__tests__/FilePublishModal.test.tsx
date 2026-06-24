import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilePublishModal from '../FilePublishModal';

function setup(overrides: Partial<React.ComponentProps<typeof FilePublishModal>> = {}) {
  const props = {
    fileName: 'notas.txt',
    doc: '# Documentación generada',
    busy: false,
    onCommit: vi.fn(),
    onDraftPr: vi.fn(),
    onRelease: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<FilePublishModal {...props} />);
  return props;
}

describe('FilePublishModal (#28 Fase 2)', () => {
  it('muestra el nombre del archivo y el preview del doc', () => {
    setup();
    expect(screen.getByText(/notas\.txt/)).toBeInTheDocument();
    expect(screen.getByText('# Documentación generada')).toBeInTheDocument();
  });

  it('las acciones de publicar quedan deshabilitadas hasta indicar un repo', () => {
    setup();
    expect(screen.getByRole('button', { name: /Commit directo/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Draft PR/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Crear Release/ })).toBeDisabled();
  });

  it('Commit directo invoca onCommit con el repo introducido', () => {
    const props = setup();
    fireEvent.change(screen.getByPlaceholderText(/repo destino/), { target: { value: 'owner/repo' } });
    fireEvent.click(screen.getByRole('button', { name: /Commit directo/ }));
    expect(props.onCommit).toHaveBeenCalledWith('owner/repo');
  });

  it('Draft PR invoca onDraftPr con el repo introducido', () => {
    const props = setup();
    fireEvent.change(screen.getByPlaceholderText(/repo destino/), { target: { value: 'mi-repo' } });
    fireEvent.click(screen.getByRole('button', { name: /Draft PR/ }));
    expect(props.onDraftPr).toHaveBeenCalledWith('mi-repo');
  });

  it('Crear Release invoca onRelease con repo y versión', () => {
    const props = setup();
    fireEvent.change(screen.getByPlaceholderText(/repo destino/), { target: { value: 'owner/repo' } });
    fireEvent.change(screen.getByPlaceholderText(/versión/), { target: { value: 'v2.0.0' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear Release/ }));
    expect(props.onRelease).toHaveBeenCalledWith('owner/repo', 'v2.0.0');
  });

  it('Cancelar invoca onCancel', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('con busy=true las acciones quedan deshabilitadas aunque haya repo', () => {
    setup({ busy: true });
    fireEvent.change(screen.getByPlaceholderText(/repo destino/), { target: { value: 'owner/repo' } });
    expect(screen.getByRole('button', { name: /Commit directo/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Publicando/ })).toBeDisabled();
  });
});
