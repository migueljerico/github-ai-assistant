import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HistoryPanel from '../HistoryPanel';
import { LanguageProvider } from '../../../context/LanguageContext';
import * as HistoryModule from '../../../context/HistoryContext';
import type { HistoryEntry } from '../../../types';

const mockEntries: HistoryEntry[] = [
  {
    id: '1',
    description: 'Crear issue en repo',
    status: 'completed',
    timestamp: new Date('2026-08-10T12:30:00Z'),
    repo: 'user/repo',
  },
  {
    id: '2',
    description: 'Falló la conexión',
    status: 'error',
    timestamp: new Date('2026-08-10T12:35:00Z'),
    repo: null,
  },
  {
    id: '3',
    description: 'Acción cancelada por el usuario',
    status: 'cancelled',
    timestamp: new Date('2026-08-10T12:40:00Z'),
    repo: null,
  },
  {
    id: '4',
    description: 'Operación en progreso',
    status: 'pending',
    timestamp: new Date('2026-08-10T12:45:00Z'),
    repo: null,
  },
];

function renderHistoryPanel(
  isOpen = true,
  entries: HistoryEntry[] = [],
  clearHistory = vi.fn(),
  exportLog = vi.fn()
) {
  vi.spyOn(HistoryModule, 'useHistory').mockReturnValue({
    entries,
    addEntry: vi.fn(),
    updateEntry: vi.fn(),
    clearHistory,
    exportLog,
  });

  return render(
    <LanguageProvider>
      <HistoryPanel isOpen={isOpen} />
    </LanguageProvider>
  );
}

describe('HistoryPanel', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('renderiza la lista de historial vacía correctamente', () => {
    renderHistoryPanel(true, []);
    expect(screen.getByText(/Las acciones de esta sesión aparecerán aquí|aparecerán aquí/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '🗑️' })).toBeNull();
    const exportBtn = screen.getByRole('button', { name: /Exportar log/i });
    expect(exportBtn).toBeDisabled();
  });

  it('aplica la clase collapsed cuando isOpen es false', () => {
    const { container } = renderHistoryPanel(false, []);
    const aside = container.querySelector('aside');
    expect(aside).toHaveClass('collapsed');
  });

  it('renderiza las entradas de historial con iconos y horas', () => {
    renderHistoryPanel(true, mockEntries);
    expect(screen.getByText(/Crear issue en repo/i)).toBeInTheDocument();
    expect(screen.getByText(/Falló la conexión/i)).toBeInTheDocument();
    expect(screen.getByText(/Acción cancelada por el usuario/i)).toBeInTheDocument();
    expect(screen.getByText(/Operación en progreso/i)).toBeInTheDocument();
    expect(screen.getByText(/user\/repo/i)).toBeInTheDocument();
  });

  it('llama a clearHistory al hacer clic en el botón de borrar', () => {
    const clearHistory = vi.fn();
    renderHistoryPanel(true, mockEntries, clearHistory);
    const clearBtn = screen.getByTitle(/Limpiar historial/i);
    fireEvent.click(clearBtn);
    expect(clearHistory).toHaveBeenCalledTimes(1);
  });

  it('llama a exportLog al hacer clic en el botón de exportar', () => {
    const exportLog = vi.fn();
    renderHistoryPanel(true, mockEntries, vi.fn(), exportLog);
    const exportBtn = screen.getByRole('button', { name: /Exportar log/i });
    expect(exportBtn).not.toBeDisabled();
    fireEvent.click(exportBtn);
    expect(exportLog).toHaveBeenCalledTimes(1);
  });
});
