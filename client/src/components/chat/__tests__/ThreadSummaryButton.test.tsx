import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ThreadSummaryButton from '../ThreadSummaryButton';

describe('ThreadSummaryButton (#32)', () => {
  it('muestra el botón "Resumir hilo" en estado cerrado', () => {
    render(<ThreadSummaryButton disabled={false} onSummarizeThread={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Resumir hilo/ })).toBeInTheDocument();
  });

  it('al pulsar el botón se abre el input con el placeholder owner/repo#42', () => {
    render(<ThreadSummaryButton disabled={false} onSummarizeThread={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Resumir hilo/ }));
    expect(screen.getByPlaceholderText(/owner\/repo#42/)).toBeInTheDocument();
  });

  it('enviar el formulario llama a onSummarizeThread con el valor recortado y cierra', () => {
    const onSummarize = vi.fn();
    render(<ThreadSummaryButton disabled={false} onSummarizeThread={onSummarize} />);
    fireEvent.click(screen.getByRole('button', { name: /Resumir hilo/ }));
    const input = screen.getByPlaceholderText(/owner\/repo#42/);
    fireEvent.change(input, { target: { value: '  owner/repo#42  ' } });
    fireEvent.click(screen.getByRole('button', { name: '✓' }));
    expect(onSummarize).toHaveBeenCalledWith('owner/repo#42');
    // tras enviar, vuelve al botón cerrado
    expect(screen.queryByPlaceholderText(/owner\/repo#42/)).not.toBeInTheDocument();
  });

  it('no llama a onSummarizeThread si el valor está vacío', () => {
    const onSummarize = vi.fn();
    render(<ThreadSummaryButton disabled={false} onSummarizeThread={onSummarize} />);
    fireEvent.click(screen.getByRole('button', { name: /Resumir hilo/ }));
    const submit = screen.getByRole('button', { name: '✓' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.submit(screen.getByPlaceholderText(/owner\/repo#42/));
    expect(onSummarize).not.toHaveBeenCalled();
  });

  it('cancelar (✕) cierra el formulario sin resumir', () => {
    const onSummarize = vi.fn();
    render(<ThreadSummaryButton disabled={false} onSummarizeThread={onSummarize} />);
    fireEvent.click(screen.getByRole('button', { name: /Resumir hilo/ }));
    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    expect(screen.queryByPlaceholderText(/owner\/repo#42/)).not.toBeInTheDocument();
    expect(onSummarize).not.toHaveBeenCalled();
  });

  it('el botón está deshabilitado cuando disabled=true', () => {
    render(<ThreadSummaryButton disabled={true} onSummarizeThread={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Resumir hilo/ })).toBeDisabled();
  });
});
