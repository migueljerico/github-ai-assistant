import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SyncRepoStatusButton from '../SyncRepoStatusButton';

describe('SyncRepoStatusButton (#70/#48, v3.59.0)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza el botón con tooltip y aria-label accesibles', () => {
    render(<SyncRepoStatusButton disabled={false} onSyncRepoStatus={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /Sincronizar estado del repo/ });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('click abre prompt y llama a onSyncRepoStatus con el valor recortado', () => {
    const onSyncRepoStatus = vi.fn();
    vi.spyOn(window, 'prompt').mockReturnValue('  owner/repo  ');
    render(<SyncRepoStatusButton disabled={false} onSyncRepoStatus={onSyncRepoStatus} />);
    fireEvent.click(screen.getByRole('button', { name: /Sincronizar estado del repo/ }));
    expect(window.prompt).toHaveBeenCalledTimes(1);
    expect(onSyncRepoStatus).toHaveBeenCalledWith('owner/repo');
    expect(onSyncRepoStatus).toHaveBeenCalledTimes(1);
  });

  it('botón deshabilitado no abre el prompt ni llama al callback', () => {
    const onSyncRepoStatus = vi.fn();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('owner/repo');
    render(<SyncRepoStatusButton disabled={true} onSyncRepoStatus={onSyncRepoStatus} />);
    fireEvent.click(screen.getByRole('button', { name: /Sincronizar estado del repo/ }));
    expect(promptSpy).not.toHaveBeenCalled();
    expect(onSyncRepoStatus).not.toHaveBeenCalled();
  });

  it('prompt cancelado (null) no llama al callback', () => {
    const onSyncRepoStatus = vi.fn();
    vi.spyOn(window, 'prompt').mockReturnValue(null);
    render(<SyncRepoStatusButton disabled={false} onSyncRepoStatus={onSyncRepoStatus} />);
    fireEvent.click(screen.getByRole('button', { name: /Sincronizar estado del repo/ }));
    expect(onSyncRepoStatus).not.toHaveBeenCalled();
  });

  it('prompt vacío o solo espacios no llama al callback', () => {
    const onSyncRepoStatus = vi.fn();
    vi.spyOn(window, 'prompt').mockReturnValue('   ');
    render(<SyncRepoStatusButton disabled={false} onSyncRepoStatus={onSyncRepoStatus} />);
    fireEvent.click(screen.getByRole('button', { name: /Sincronizar estado del repo/ }));
    expect(onSyncRepoStatus).not.toHaveBeenCalled();
  });
});
