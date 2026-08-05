import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FileAttachButton from '../FileAttachButton';

describe('FileAttachButton (#28, #57 Tanda B multi-archivo)', () => {
  it('muestra el botón de adjuntar cuando no hay archivo', () => {
    render(<FileAttachButton disabled={false} fileNames={[]} onAttach={vi.fn()} onClearAt={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Adjuntar archivo/ })).toBeInTheDocument();
  });

  it('seleccionar un archivo dispara onAttach con un array de Files', () => {
    const onAttach = vi.fn();
    const { container } = render(<FileAttachButton disabled={false} fileNames={[]} onAttach={onAttach} onClearAt={vi.fn()} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [new File(['hola'], 'notas.md')] } });

    expect(onAttach).toHaveBeenCalledTimes(1);
    expect(onAttach.mock.calls[0][0]).toHaveLength(1);
    expect(onAttach.mock.calls[0][0][0].name).toBe('notas.md');
  });

  it('seleccionar varios archivos a la vez dispara onAttach con todos', () => {
    const onAttach = vi.fn();
    const { container } = render(<FileAttachButton disabled={false} fileNames={[]} onAttach={onAttach} onClearAt={vi.fn()} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [new File(['a'], 'a.md'), new File(['b'], 'b.md')] } });

    expect(onAttach).toHaveBeenCalledTimes(1);
    expect(onAttach.mock.calls[0][0]).toHaveLength(2);
  });

  it('con un archivo adjunto muestra el chip y permite quitarlo (onClearAt(0))', () => {
    const onClearAt = vi.fn();
    render(<FileAttachButton disabled={false} fileNames={['notas.md']} onAttach={vi.fn()} onClearAt={onClearAt} />);

    expect(screen.getByText(/notas\.md/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Quitar archivo/ }));
    expect(onClearAt).toHaveBeenCalledTimes(1);
    expect(onClearAt).toHaveBeenCalledWith(0);
  });

  it('con varios archivos muestra un chip por archivo y un contador', () => {
    const onClearAt = vi.fn();
    render(<FileAttachButton disabled={false} fileNames={['a.md', 'b.md']} onAttach={vi.fn()} onClearAt={onClearAt} />);

    expect(screen.getByText(/2 archivos adjuntos/)).toBeInTheDocument();
    expect(screen.getByText('a.md')).toBeInTheDocument();
    expect(screen.getByText('b.md')).toBeInTheDocument();
  });

  it('quitar el segundo archivo llama a onClearAt(1)', () => {
    const onClearAt = vi.fn();
    render(<FileAttachButton disabled={false} fileNames={['a.md', 'b.md']} onAttach={vi.fn()} onClearAt={onClearAt} />);

    // Hay dos botones de quitar (uno por archivo); el segundo corresponde a b.md (índice 1).
    const clearBtns = screen.getAllByRole('button', { name: /Quitar archivo/ });
    fireEvent.click(clearBtns[1]);
    expect(onClearAt).toHaveBeenCalledWith(1);
  });

  it('con archivos ya adjuntados muestra el botón "+ 📎 Adjuntar más" para añadir más archivos secuencialmente', () => {
    render(<FileAttachButton disabled={false} fileNames={['captura1.png']} onAttach={vi.fn()} onClearAt={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Adjuntar más/ })).toBeInTheDocument();
  });
});
