import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CodeHealthModal from '../CodeHealthModal';
import type { CodeHealth } from '../../../services/assistantActions';

// Mock del hijo con Recharts (evita ResponsiveContainer/medición de DOM en jsdom).
vi.mock('../CodeHealthCharts', () => ({
  default: () => <div data-testid="charts">charts</div>,
}));

const data: CodeHealth = {
  repoName: 'owner/repo',
  languages: [{ language: 'TypeScript', count: 5 }, { language: 'Python', count: 2 }],
  debt: { total: 3, byFile: [{ path: 'src/a.ts', count: 3 }] },
  commits: [{ weekStart: '2026-06-01', count: 4 }],
  filesAnalyzed: 7,
  truncated: false,
};

describe('CodeHealthModal (#44)', () => {
  it('muestra el resumen de cabecera (lenguaje principal, archivos, deuda)', () => {
    render(<CodeHealthModal data={data} onClose={vi.fn()} />);
    expect(screen.getByText(/Salud del código — owner\/repo/)).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText(/7 archivos analizados/)).toBeInTheDocument();
    expect(screen.getByText(/3 marcadores de deuda/)).toBeInTheDocument();
  });

  it('carga las gráficas (hijo lazy)', async () => {
    render(<CodeHealthModal data={data} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('charts')).toBeInTheDocument());
  });

  it('invoca onClose al pulsar Escape (a11y)', () => {
    const onClose = vi.fn();
    render(<CodeHealthModal data={data} onClose={onClose} />);
    // El listener del hook vive en `.modal`; disparamos en un elemento interno
    // para que el keydown burbujee hasta él.
    fireEvent.keyDown(screen.getByRole('button', { name: /Cerrar/ }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('invoca onClose con el botón Cerrar', () => {
    const onClose = vi.fn();
    render(<CodeHealthModal data={data} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Cerrar/ }));
    expect(onClose).toHaveBeenCalled();
  });
});
