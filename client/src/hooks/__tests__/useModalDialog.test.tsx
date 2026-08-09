import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useModalDialog } from '../useModalDialog';

function Dialog({ onClose }: { onClose: () => void }) {
  const ref = useModalDialog<HTMLDivElement>(onClose);
  return (
    <div ref={ref} className="modal">
      <button>primero</button>
      <button>segundo</button>
    </div>
  );
}

describe('useModalDialog', () => {
  it('enfoca el primer elemento focusable al montar', () => {
    render(<Dialog onClose={() => {}} />);
    expect(document.activeElement).toBe(screen.getByText('primero'));
  });

  it('invoca onClose al pulsar Escape', () => {
    const onClose = vi.fn();
    render(<Dialog onClose={onClose} />);
    fireEvent.keyDown(screen.getByText('primero'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('atrapa el foco: Tab desde el último vuelve al primero', () => {
    render(<Dialog onClose={() => {}} />);
    const first = screen.getByText('primero');
    const last = screen.getByText('segundo');
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('atrapa el foco: Shift+Tab desde el primero salta al último', () => {
    render(<Dialog onClose={() => {}} />);
    const first = screen.getByText('primero');
    const last = screen.getByText('segundo');
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('soporta modales sin elementos focusables', () => {
    function EmptyDialog({ onClose }: { onClose: () => void }) {
      const ref = useModalDialog<HTMLDivElement>(onClose);
      return <div ref={ref} data-testid="empty-modal">Sin botones</div>;
    }
    render(<EmptyDialog onClose={() => {}} />);
    const modal = screen.getByTestId('empty-modal');
    expect(document.activeElement).toBe(modal);

    // Tab no causa error
    fireEvent.keyDown(modal, { key: 'Tab' });
    expect(document.activeElement).toBe(modal);
  });
});

