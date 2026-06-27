import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CodeHealthButton from '../CodeHealthButton';

describe('CodeHealthButton (#44)', () => {
  it('muestra el botón "Salud del código" cerrado', () => {
    render(<CodeHealthButton disabled={false} onCodeHealth={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Salud del código/ })).toBeInTheDocument();
  });

  it('al pulsar abre el input para el repo', () => {
    render(<CodeHealthButton disabled={false} onCodeHealth={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Salud del código/ }));
    expect(screen.getByPlaceholderText(/owner\/repo/)).toBeInTheDocument();
  });

  it('enviar llama a onCodeHealth con el valor recortado y cierra', () => {
    const onCH = vi.fn();
    render(<CodeHealthButton disabled={false} onCodeHealth={onCH} />);
    fireEvent.click(screen.getByRole('button', { name: /Salud del código/ }));
    fireEvent.change(screen.getByPlaceholderText(/owner\/repo/), { target: { value: '  owner/repo  ' } });
    fireEvent.click(screen.getByRole('button', { name: '✓' }));
    expect(onCH).toHaveBeenCalledWith('owner/repo');
    expect(screen.queryByPlaceholderText(/owner\/repo/)).not.toBeInTheDocument();
  });

  it('está deshabilitado cuando disabled=true', () => {
    render(<CodeHealthButton disabled={true} onCodeHealth={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Salud del código/ })).toBeDisabled();
  });
});
