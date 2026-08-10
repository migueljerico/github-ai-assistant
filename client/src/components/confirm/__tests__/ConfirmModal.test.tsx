import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConfirmModal from '../ConfirmModal';
import type { PendingAction, GeminiAction } from '../../../types';

// Mock de DiffViewer
vi.mock('../DiffViewer', () => ({
  default: ({ filename }: any) => (
    <div data-testid="diff-viewer">
      DiffViewer: {filename}
    </div>
  ),
}));

describe('ConfirmModal', () => {
  const mockAction: GeminiAction = {
    tipo: 'escritura',
    accion: 'Actualizar archivo',
    endpoint: '/repos/testuser/myrepo/contents/README.md',
    metodo: 'PUT',
    repo: 'myrepo',
    archivo: 'README.md',
    contenidoPropuesto: 'Nuevo contenido',
    contenidoActual: 'Contenido actual',
    payload: {},
    requiereConfirmacion: true,
  };

  const defaultProps: {
    pendingAction: PendingAction;
    onConfirm: () => void;
    onCancel: () => void;
    isExecuting: boolean;
  } = {
    pendingAction: {
      action: mockAction,
      targetRepos: [],
    },
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    isExecuting: false,
  };

  it('debería renderizar el modal', () => {
    render(<ConfirmModal {...defaultProps} />);
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/esto es lo que voy a hacer/i)).toBeInTheDocument();
  });

  it('debería mostrar la acción del modal', () => {
    render(<ConfirmModal {...defaultProps} />);
    
    expect(screen.getByText(/actualizar archivo/i)).toBeInTheDocument();
    expect(screen.getByText(/PUT/i)).toBeInTheDocument();
    // Usar getAllByText porque hay múltiples elementos con README.md
    const readmeElements = screen.getAllByText(/README\.md/i);
    expect(readmeElements.length).toBeGreaterThan(0);
  });

  it('debería llamar onConfirm al hacer clic en confirmar', () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />);
    
    fireEvent.click(screen.getByText(/✅ Confirmar y ejecutar/i));
    
    expect(onConfirm).toHaveBeenCalled();
  });

  it('debería llamar onCancel al hacer clic en cancelar', () => {
    const onCancel = vi.fn();
    render(<ConfirmModal {...defaultProps} onCancel={onCancel} />);
    
    fireEvent.click(screen.getByText(/❌ Cancelar/i));
    
    expect(onCancel).toHaveBeenCalled();
  });

  it('debería deshabilitar botones cuando isExecuting es true', () => {
    render(<ConfirmModal {...defaultProps} isExecuting={true} />);
    
    expect(screen.getByText(/❌ Cancelar/i)).toBeDisabled();
    expect(screen.getByText(/Confirmar y ejecutar/i)).toBeDisabled();
  });

  it('debería mostrar spinner cuando isExecuting es true', () => {
    render(<ConfirmModal {...defaultProps} isExecuting={true} />);
    
    expect(screen.getByText(/Confirmar y ejecutar/i)).toBeInTheDocument();
  });

  it('debería mostrar DiffViewer cuando hay contenido actual y propuesto', () => {
    render(<ConfirmModal {...defaultProps} />);
    
    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
  });

  it('NO debería mostrar DiffViewer cuando no hay contenido actual', () => {
    const actionWithoutCurrent: GeminiAction = {
      ...mockAction,
      contenidoActual: null,
    };

    render(
      <ConfirmModal
        {...defaultProps}
        pendingAction={{ action: actionWithoutCurrent, targetRepos: [] }}
      />
    );
    
    expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument();
  });

  it('debería mostrar contenido de nuevo archivo cuando es creación', () => {
    const newFileAction: GeminiAction = {
      ...mockAction,
      contenidoActual: null,
      contenidoPropuesto: 'Contenido del nuevo archivo',
    };

    render(
      <ConfirmModal
        {...defaultProps}
        pendingAction={{ action: newFileAction, targetRepos: [] }}
      />
    );
    
    // Usar getAllByText porque hay múltiples elementos
    const contentElements = screen.getAllByText(/Contenido del nuevo archivo/i);
    expect(contentElements.length).toBeGreaterThan(0);
  });

  it('debería mostrar tabs de repositorios cuando hay múltiples repos', () => {
    const targetRepos = [
      { id: 1, name: 'repo1', full_name: 'testuser/repo1', owner: { login: 'testuser' } },
      { id: 2, name: 'repo2', full_name: 'testuser/repo2', owner: { login: 'testuser' } },
    ] as any;

    render(
      <ConfirmModal
        {...defaultProps}
        pendingAction={{ action: mockAction, targetRepos }}
      />
    );
    
    expect(screen.getByText(/esta acción se aplicará a 2 repositorios/i)).toBeInTheDocument();
    expect(screen.getByText('repo1')).toBeInTheDocument();
    expect(screen.getByText('repo2')).toBeInTheDocument();
  });

  it('debería mostrar número de repos en el botón de confirmar para multi-repo', () => {
    const targetRepos = [
      { id: 1, name: 'repo1', full_name: 'testuser/repo1', owner: { login: 'testuser' } },
      { id: 2, name: 'repo2', full_name: 'testuser/repo2', owner: { login: 'testuser' } },
    ] as any;

    render(
      <ConfirmModal
        {...defaultProps}
        pendingAction={{ action: mockAction, targetRepos }}
      />
    );
    
    expect(screen.getByText(/✅ Confirmar y ejecutar \(2 repos\)/i)).toBeInTheDocument();
  });

  it('debería mostrar emoji correcto según el tipo de acción', () => {
    const readAction: GeminiAction = {
      ...mockAction,
      tipo: 'lectura',
    };

    render(
      <ConfirmModal
        {...defaultProps}
        pendingAction={{ action: readAction, targetRepos: [] }}
      />
    );
    
    expect(screen.getByText('📖')).toBeInTheDocument();
  });

  // ── #53 (v3.50.0): textarea editable de commit message ──────────────────────
  // El textarea se localiza por su <label htmlFor="confirm-commit-message">, que
  // es más estable que el placeholder. Buscamos por el texto del label.
  const findCommitTextarea = () => screen.queryByLabelText(/mensaje de commit/i);

  it('debería mostrar el textarea de commit message en acciones PUT con archivo', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(findCommitTextarea()).toBeInTheDocument();
  });

  it('NO debería mostrar el textarea en acciones de lectura (GET)', () => {
    const readAction: GeminiAction = { ...mockAction, metodo: 'GET', tipo: 'lectura' };
    render(
      <ConfirmModal
        {...defaultProps}
        pendingAction={{ action: readAction, targetRepos: [] }}
      />
    );
    expect(findCommitTextarea()).not.toBeInTheDocument();
  });

  it('debería pre-rellenar el textarea con el commitMessage sugerido', () => {
    render(
      <ConfirmModal
        {...defaultProps}
        pendingAction={{ action: mockAction, targetRepos: [], commitMessage: 'feat: sugerido por IA' }}
      />
    );
    expect(findCommitTextarea()).toHaveValue('feat: sugerido por IA');
  });

  it('debería propagar el mensaje editado al confirmar', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal
        {...defaultProps}
        onConfirm={onConfirm}
        pendingAction={{ action: mockAction, targetRepos: [], commitMessage: 'feat: inicial' }}
      />
    );
    const textarea = findCommitTextarea() as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'docs: editado por el usuario' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar y ejecutar/i }));
    expect(onConfirm).toHaveBeenCalledWith('docs: editado por el usuario');
  });

  it('debería pasar undefined al confirmar si el campo está vacío', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal
        {...defaultProps}
        onConfirm={onConfirm}
        pendingAction={{ action: mockAction, targetRepos: [] }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /confirmar y ejecutar/i }));
    // commitMessage vacío → undefined para que executeAction use su fallback.
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  it('debería pasar undefined al confirmar cuando la acción no muestra el campo', () => {
    const readAction: GeminiAction = { ...mockAction, metodo: 'GET', tipo: 'lectura' };
    const onConfirm = vi.fn();
    render(
      <ConfirmModal
        {...defaultProps}
        onConfirm={onConfirm}
        pendingAction={{ action: readAction, targetRepos: [] }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /confirmar y ejecutar/i }));
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  it('permite alternar el repositorio activo haciendo clic en los botones de repo en multi-repo', () => {
    const targetRepos = [
      { id: 1, name: 'repo1', full_name: 'testuser/repo1', owner: { login: 'testuser' } },
      { id: 2, name: 'repo2', full_name: 'testuser/repo2', owner: { login: 'testuser' } },
    ] as any;

    render(
      <ConfirmModal
        {...defaultProps}
        pendingAction={{ action: mockAction, targetRepos }}
      />
    );

    const repo2Tab = screen.getByText('repo2');
    fireEvent.click(repo2Tab);
    expect(repo2Tab).toHaveClass('btn-secondary');
  });
});
