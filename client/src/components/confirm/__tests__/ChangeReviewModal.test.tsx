import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChangeReviewModal from '../ChangeReviewModal';
import type { PendingAction, GeminiAction } from '../../../types';

// Mock de DiffViewer
vi.mock('../DiffViewer', () => ({
  default: ({ filename }: any) => (
    <div data-testid="diff-viewer">
      DiffViewer: {filename}
    </div>
  ),
}));

describe('ChangeReviewModal', () => {
  const mockAction1: GeminiAction = {
    tipo: 'escritura',
    accion: 'Actualizar README',
    endpoint: '/repos/testuser/myrepo/contents/README.md',
    metodo: 'PUT',
    repo: 'myrepo',
    archivo: 'README.md',
    contenidoPropuesto: 'Nuevo contenido del README',
    contenidoActual: 'Contenido actual del README',
    payload: {},
    requiereConfirmacion: true,
  };

  const mockAction2: GeminiAction = {
    tipo: 'creacion',
    accion: 'Crear archivo CHANGELOG',
    endpoint: '/repos/testuser/myrepo/contents/CHANGELOG.md',
    metodo: 'PUT',
    repo: 'myrepo',
    archivo: 'CHANGELOG.md',
    contenidoPropuesto: '# Changelog\n\n## v1.0.0',
    payload: {},
    requiereConfirmacion: true,
  };

  const mockActions: PendingAction[] = [
    { action: mockAction1, targetRepos: [] },
    { action: mockAction2, targetRepos: [] },
  ];

  const defaultProps = {
    actions: mockActions,
    onAccept: vi.fn(),
    onReject: vi.fn(),
    onApplyAccepted: vi.fn(),
    onClear: vi.fn(),
    onCancel: vi.fn(),
    isExecuting: false,
  };

  it('renderiza el modal con la lista de acciones', () => {
    render(<ChangeReviewModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/modo revisión/i)).toBeInTheDocument();
    expect(screen.getByText(/actualizar readme/i)).toBeInTheDocument();
    expect(screen.getByText(/crear archivo changelog/i)).toBeInTheDocument();
  });

  it('muestra el conteo de aceptados', () => {
    render(<ChangeReviewModal {...defaultProps} />);
    expect(screen.getByText(/2 de 2 seleccionados/i)).toBeInTheDocument();
  });

  it('llama onAccept al pulsar aceptar en un item', () => {
    render(<ChangeReviewModal {...defaultProps} />);
    const acceptBtn = screen.getByTestId('review-accept-0');
    fireEvent.click(acceptBtn);
    expect(defaultProps.onAccept).toHaveBeenCalledWith(0);
  });

  it('llama onReject al pulsar rechazar en un item', () => {
    render(<ChangeReviewModal {...defaultProps} />);
    const rejectBtn = screen.getByTestId('review-reject-1');
    fireEvent.click(rejectBtn);
    expect(defaultProps.onReject).toHaveBeenCalledWith(1);
  });

  it('muestra DiffViewer al seleccionar un item con diff', () => {
    render(<ChangeReviewModal {...defaultProps} />);
    // Click en el primer item para seleccionarlo
    fireEvent.click(screen.getByTestId('review-item-0'));
    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
  });

  it('deshabilita "Aplicar aceptados" cuando isExecuting es true', () => {
    render(<ChangeReviewModal {...defaultProps} isExecuting={true} />);
    const applyBtn = screen.getByTestId('review-apply-btn');
    expect(applyBtn).toBeDisabled();
  });

  it('llama onApplyAccepted con los índices aceptados al pulsar aplicar (v3.56.0)', () => {
    render(<ChangeReviewModal {...defaultProps} />);
    const applyBtn = screen.getByTestId('review-apply-btn');
    fireEvent.click(applyBtn);
    // Por defecto ambas están aceptadas → pasa [0, 1].
    expect(defaultProps.onApplyAccepted).toHaveBeenCalledWith([0, 1]);
  });

  it('al rechazar una, onApplyAccepted recibe solo los índices aceptados (v3.56.0)', () => {
    render(<ChangeReviewModal {...defaultProps} />);
    // Rechazamos la segunda acción.
    fireEvent.click(screen.getByTestId('review-reject-1'));
    fireEvent.click(screen.getByTestId('review-apply-btn'));
    // Ahora solo el índice 0 está aceptado.
    expect(defaultProps.onApplyAccepted).toHaveBeenCalledWith([0]);
  });

  it('llama onClear al pulsar limpiar', () => {
    render(<ChangeReviewModal {...defaultProps} />);
    const clearBtn = screen.getByTestId('review-clear-btn');
    fireEvent.click(clearBtn);
    expect(defaultProps.onClear).toHaveBeenCalled();
  });

  it('muestra placeholder cuando no hay item seleccionado', () => {
    render(<ChangeReviewModal {...defaultProps} />);
    expect(screen.getByText(/selecciona un cambio/i)).toBeInTheDocument();
  });

  // ── Ramas restantes (#26, v4.0.52) ──────────────────────────────────────────
  it('al ampliar la lista de acciones re-sincroniza accepted[] con valores por defecto (v4.0.52 #26)', () => {
    const { rerender } = render(<ChangeReviewModal {...defaultProps} />);
    expect(screen.getByText(/2 de 2 seleccionados/i)).toBeInTheDocument();

    // (actions.length !== prevActionsLen) pasa a true → setPrevActionsLen +
    // setAccepted(actions.map((_, i) => accepted[i] ?? true)) con la posición
    // pendiente undefined en el índice 2 → rama nullish del ??
    rerender(
      <ChangeReviewModal
        {...defaultProps}
        actions={[...mockActions, { action: mockAction2, targetRepos: [] }]}
      />,
    );

    expect(screen.getByText(/3 de 3 seleccionados/i)).toBeInTheDocument();
  });

  it('archivo nuevo (sin contenido actual): vista previa en <pre>, sin diff (v4.0.52 #26)', () => {
    render(<ChangeReviewModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('review-item-1')); // mockAction2 sin contenidoActual

    expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument();
    expect(screen.getByText(/contenido del nuevo archivo/i)).toBeInTheDocument();
    expect(screen.getByText(/## v1\.0\.0/)).toBeInTheDocument();
  });

  it('acción sin contenido: mensaje "Sin vista previa disponible" (v4.0.52 #26)', () => {
    const vacia: GeminiAction = {
      ...mockAction1, contenidoActual: null, contenidoPropuesto: null,
    };
    render(
      <ChangeReviewModal
        {...defaultProps}
        actions={[{ action: vacia, targetRepos: [] }]}
      />,
    );
    fireEvent.click(screen.getByTestId('review-item-0'));

    expect(screen.getByText(/Sin vista previa disponible/i)).toBeInTheDocument();
    expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument();
  });

  it('diff con archivo null: DiffViewer usa el nombre por defecto (v4.0.52 #26)', () => {
    const sinArchivo: GeminiAction = { ...mockAction1, archivo: null };
    render(
      <ChangeReviewModal
        {...defaultProps}
        actions={[{ action: sinArchivo, targetRepos: [] }]}
      />,
    );
    fireEvent.click(screen.getByTestId('review-item-0'));

    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
    expect(screen.getByTestId('diff-viewer')).toHaveTextContent('DiffViewer: archivo');
  });

  it('isExecuting + executionProgress: muestra el progreso de ejecución (v4.0.52 #26)', () => {
    render(
      <ChangeReviewModal
        {...defaultProps}
        isExecuting={true}
        executionProgress={{ done: 1, total: 3, current: 'Aplicando a repo-b' }}
      />,
    );

    expect(screen.getByText(/1\/3/)).toBeInTheDocument();
    expect(screen.getByText(/repo-b/)).toBeInTheDocument();
  });
});
