import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import ErrorBoundary from '../ErrorBoundary';

function Boom(): never {
  throw new Error('explota');
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza el contenido normal cuando no hay error', () => {
    render(
      <ErrorBoundary>
        <p>contenido sano</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('contenido sano')).toBeInTheDocument();
  });

  it('muestra el fallback amable cuando un hijo lanza en render', () => {
    // React loguea el error en consola; lo silenciamos para no ensuciar la salida.
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/algo ha fallado/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recargar/i })).toBeInTheDocument();
  });

  it('al pulsar el botón de recargar ejecuta window.location.reload', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    const btn = screen.getByRole('button', { name: /recargar/i });
    fireEvent.click(btn);
    expect(reloadMock).toHaveBeenCalled();
  });
});

