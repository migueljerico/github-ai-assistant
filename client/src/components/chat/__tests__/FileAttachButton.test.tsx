import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FileAttachButton from '../FileAttachButton';

describe('FileAttachButton (#28)', () => {
  it('muestra el botón de adjuntar cuando no hay archivo', () => {
    render(<FileAttachButton disabled={false} fileName={null} onAttach={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Adjuntar archivo/ })).toBeInTheDocument();
  });

  it('seleccionar un archivo dispara onAttach con el File', () => {
    const onAttach = vi.fn();
    const { container } = render(<FileAttachButton disabled={false} fileName={null} onAttach={onAttach} onClear={vi.fn()} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [new File(['hola'], 'notas.md')] } });

    expect(onAttach).toHaveBeenCalledTimes(1);
    expect(onAttach.mock.calls[0][0].name).toBe('notas.md');
  });

  it('con archivo adjunto muestra el chip y permite quitarlo', () => {
    const onClear = vi.fn();
    render(<FileAttachButton disabled={false} fileName="notas.md" onAttach={vi.fn()} onClear={onClear} />);

    expect(screen.getByText(/notas\.md/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Quitar archivo/ }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
