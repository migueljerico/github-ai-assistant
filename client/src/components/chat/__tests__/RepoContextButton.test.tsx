import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RepoContextButton from '../RepoContextButton';

describe('RepoContextButton (#41)', () => {
  it('muestra el botón "Cargar repo" cuando no hay contexto', () => {
    render(
      <RepoContextButton
        disabled={false}
        activeContext={null}
        onLoadContext={vi.fn()}
        onClearContext={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Cargar repo/ })).toBeInTheDocument();
  });

  it('al pulsar el botón se abre el input de repo', () => {
    render(
      <RepoContextButton
        disabled={false}
        activeContext={null}
        onLoadContext={vi.fn()}
        onClearContext={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Cargar repo/ }));
    expect(screen.getByPlaceholderText(/owner\/repo/)).toBeInTheDocument();
  });

  it('enviar el formulario llama a onLoadContext con el valor recortado', () => {
    const onLoad = vi.fn();
    render(
      <RepoContextButton
        disabled={false}
        activeContext={null}
        onLoadContext={onLoad}
        onClearContext={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Cargar repo/ }));
    const input = screen.getByPlaceholderText(/owner\/repo/);
    fireEvent.change(input, { target: { value: '  mi-repo  ' } });
    fireEvent.click(screen.getByRole('button', { name: '✓' }));
    expect(onLoad).toHaveBeenCalledWith('mi-repo');
  });

  it('cancelar (✕) cierra el formulario sin cargar contexto', () => {
    const onLoad = vi.fn();
    render(
      <RepoContextButton
        disabled={false}
        activeContext={null}
        onLoadContext={onLoad}
        onClearContext={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Cargar repo/ }));
    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    expect(screen.queryByPlaceholderText(/owner\/repo/)).not.toBeInTheDocument();
    expect(onLoad).not.toHaveBeenCalled();
  });

  it('con contexto activo muestra el chip y permite descartarlo', () => {
    const onClear = vi.fn();
    render(
      <RepoContextButton
        disabled={false}
        activeContext="migueljerico/github-ai-assistant"
        onLoadContext={vi.fn()}
        onClearContext={onClear}
      />,
    );
    expect(screen.getByText(/migueljerico\/github-ai-assistant/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Descartar contexto/ }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
