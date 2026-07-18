import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SecurityAuditButton from '../SecurityAuditButton';

describe('SecurityAuditButton (#52, v3.43.0)', () => {
  it('con repo activo → botón directo que llama a onOpen con ese repo', () => {
    const onOpen = vi.fn();
    render(
      <SecurityAuditButton
        disabled={false}
        onOpen={onOpen}
        repoContextName="owner/activo"
      />,
    );
    // Botón directo, sin input inline.
    fireEvent.click(screen.getByRole('button', { name: /Auditar seguridad/ }));
    expect(onOpen).toHaveBeenCalledWith('owner/activo');
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('sin repo activo → el botón abre input inline owner/repo', () => {
    render(
      <SecurityAuditButton
        disabled={false}
        onOpen={vi.fn()}
        repoContextName={null}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Auditar seguridad/ }));
    expect(screen.getByPlaceholderText(/owner\/repo/)).toBeInTheDocument();
  });

  it('confirmar el input llama a onOpen con el valor recortado y cierra', () => {
    const onOpen = vi.fn();
    render(
      <SecurityAuditButton
        disabled={false}
        onOpen={onOpen}
        repoContextName={null}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Auditar seguridad/ }));
    fireEvent.change(screen.getByPlaceholderText(/owner\/repo/), { target: { value: '  owner/repo  ' } });
    fireEvent.click(screen.getByRole('button', { name: '✓' }));
    expect(onOpen).toHaveBeenCalledWith('owner/repo');
    // El input se cierra tras confirmar.
    expect(screen.queryByPlaceholderText(/owner\/repo/)).not.toBeInTheDocument();
  });

  it('cancelar (✕) cierra el formulario sin llamar a onOpen', () => {
    const onOpen = vi.fn();
    render(
      <SecurityAuditButton
        disabled={false}
        onOpen={onOpen}
        repoContextName={null}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Auditar seguridad/ }));
    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    expect(screen.queryByPlaceholderText(/owner\/repo/)).not.toBeInTheDocument();
    expect(onOpen).not.toHaveBeenCalled();
  });
});
