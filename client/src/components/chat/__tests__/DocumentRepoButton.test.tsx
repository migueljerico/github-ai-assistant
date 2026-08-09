import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DocumentRepoButton from '../DocumentRepoButton';

describe('DocumentRepoButton (#57)', () => {
  it('renderiza el botón "Documentar repo" y ejecuta onOpen al hacer clic', () => {
    const onOpen = vi.fn();
    render(<DocumentRepoButton disabled={false} onOpen={onOpen} />);
    const btn = screen.getByRole('button', { name: /Documentar repo/ });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();

    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('respeta la propiedad disabled', () => {
    const onOpen = vi.fn();
    render(<DocumentRepoButton disabled={true} onOpen={onOpen} />);
    const btn = screen.getByRole('button', { name: /Documentar repo/ });
    expect(btn).toBeDisabled();
  });
});
