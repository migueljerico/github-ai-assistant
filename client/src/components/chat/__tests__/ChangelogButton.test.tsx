import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChangelogButton from '../ChangelogButton';

describe('ChangelogButton (#34)', () => {
  it('muestra el botón "Generar changelog" cerrado', () => {
    render(<ChangelogButton disabled={false} onGenerateChangelog={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Generar changelog/ })).toBeInTheDocument();
  });

  it('al pulsar abre el input con el placeholder owner/repo', () => {
    render(<ChangelogButton disabled={false} onGenerateChangelog={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Generar changelog/ }));
    expect(screen.getByPlaceholderText(/owner\/repo o repo/)).toBeInTheDocument();
  });

  it('enviar llama a onGenerateChangelog con el valor recortado y cierra', () => {
    const onGen = vi.fn();
    render(<ChangelogButton disabled={false} onGenerateChangelog={onGen} />);
    fireEvent.click(screen.getByRole('button', { name: /Generar changelog/ }));
    fireEvent.change(screen.getByPlaceholderText(/owner\/repo o repo/), { target: { value: '  owner/repo  ' } });
    fireEvent.click(screen.getByRole('button', { name: '✓' }));
    expect(onGen).toHaveBeenCalledWith('owner/repo');
    expect(screen.queryByPlaceholderText(/owner\/repo o repo/)).not.toBeInTheDocument();
  });

  it('no llama si el valor está vacío', () => {
    const onGen = vi.fn();
    render(<ChangelogButton disabled={false} onGenerateChangelog={onGen} />);
    fireEvent.click(screen.getByRole('button', { name: /Generar changelog/ }));
    expect((screen.getByRole('button', { name: '✓' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(screen.getByPlaceholderText(/owner\/repo o repo/));
    expect(onGen).not.toHaveBeenCalled();
  });

  it('cierra el formulario al pulsar el botón de cancelar (✕)', () => {
    render(<ChangelogButton disabled={false} onGenerateChangelog={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Generar changelog/ }));
    expect(screen.getByPlaceholderText(/owner\/repo o repo/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    expect(screen.queryByPlaceholderText(/owner\/repo o repo/)).not.toBeInTheDocument();
  });

  it('está deshabilitado cuando disabled=true', () => {
    render(<ChangelogButton disabled={true} onGenerateChangelog={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Generar changelog/ })).toBeDisabled();
  });
});

