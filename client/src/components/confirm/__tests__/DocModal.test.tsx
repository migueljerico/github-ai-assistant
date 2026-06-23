import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DocModal from '../DocModal';
import type { RepoAnalysis } from '../../../types';

const analysis: RepoAnalysis = {
  readme: 'CONTENIDO README',
  manualTecnico: 'CONTENIDO MANUAL',
  filesAnalyzed: 3,
  totalFiles: 3,
  truncated: false,
  repoName: 'owner/repo',
};

function setup(overrides: Partial<React.ComponentProps<typeof DocModal>> = {}) {
  const props = {
    analysis,
    onConfirm: vi.fn(),
    onCreateDraftPr: vi.fn(),
    onCancel: vi.fn(),
    isCommitting: false,
    isCreatingDraftPr: false,
    ...overrides,
  };
  render(<DocModal {...props} />);
  return props;
}

describe('DocModal (#42)', () => {
  it('muestra el repo y el README por defecto', () => {
    setup();
    expect(screen.getByText(/Documentación generada para owner\/repo/)).toBeInTheDocument();
    expect(screen.getByText('CONTENIDO README')).toBeInTheDocument();
  });

  it('cambia a la pestaña del MANUAL', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /MANUAL_TECNICO/ }));
    expect(screen.getByText('CONTENIDO MANUAL')).toBeInTheDocument();
  });

  it('los botones invocan sus callbacks', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /Hacer commit directo/ }));
    fireEvent.click(screen.getByRole('button', { name: /Crear Draft PR/ }));
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onCreateDraftPr).toHaveBeenCalledTimes(1);
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('deshabilita los botones de acción mientras se hace commit', () => {
    setup({ isCommitting: true });
    expect(screen.getByRole('button', { name: /Haciendo commit/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Crear Draft PR/ })).toBeDisabled();
  });

  it('muestra el aviso cuando el repo está truncado', () => {
    setup({ analysis: { ...analysis, truncated: true } });
    expect(screen.getByText(/Repo muy grande/)).toBeInTheDocument();
  });
});
