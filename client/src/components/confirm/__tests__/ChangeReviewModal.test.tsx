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

  it('llama onApplyAccepted al pulsar aplicar', () => {
    render(<ChangeReviewModal {...defaultProps} />);
    const applyBtn = screen.getByTestId('review-apply-btn');
    fireEvent.click(applyBtn);
    expect(defaultProps.onApplyAccepted).toHaveBeenCalled();
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
});
