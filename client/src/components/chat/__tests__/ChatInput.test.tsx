import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChatInput from '../ChatInput';

// Mock de componentes hijos
vi.mock('../../multi-repo/RepoSelector', () => ({
  default: () => <div data-testid="multi-repo-selector">MultiRepoSelector</div>,
}));

vi.mock('../DocumentRepoButton', () => ({
  default: ({ onDocumentRepo, disabled }: any) => (
    <button
      data-testid="document-repo-btn"
      onClick={() => onDocumentRepo('test-repo')}
      disabled={disabled}
    >
      Document Repo
    </button>
  ),
}));

describe('ChatInput', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    onSend: vi.fn(),
    isLoading: false,
    disabled: false,
    multiRepoEnabled: false,
    onMultiRepoChange: vi.fn(),
    selectedRepos: [],
    onSelectedReposChange: vi.fn(),
    onDocumentRepo: vi.fn(),
  };

  it('debería renderizar el textarea', () => {
    render(<ChatInput {...defaultProps} />);
    expect(screen.getByLabelText(/instrucción para el asistente/i)).toBeInTheDocument();
  });

  it('debería mostrar placeholder correcto cuando está deshabilitado', () => {
    render(<ChatInput {...defaultProps} disabled={true} />);
    expect(screen.getByPlaceholderText(/conecta con github/i)).toBeInTheDocument();
  });

  it('debería mostrar placeholder para modo chat', () => {
    render(<ChatInput {...defaultProps} modeOverride="chat" />);
    expect(screen.getByPlaceholderText(/pide una opinión/i)).toBeInTheDocument();
  });

  it('debería mostrar placeholder para modo action', () => {
    render(<ChatInput {...defaultProps} modeOverride="action" />);
    expect(screen.getByPlaceholderText(/escribe una acción/i)).toBeInTheDocument();
  });

  it('debería llamar onChange al escribir', () => {
    const onChange = vi.fn();
    render(<ChatInput {...defaultProps} onChange={onChange} />);
    
    const textarea = screen.getByLabelText(/instrucción para el asistente/i);
    fireEvent.change(textarea, { target: { value: 'test' } });
    
    expect(onChange).toHaveBeenCalledWith('test');
  });

  it('debería llamar onSend al presionar Enter', () => {
    const onSend = vi.fn();
    render(<ChatInput {...defaultProps} value="test message" onSend={onSend} />);
    
    const textarea = screen.getByLabelText(/instrucción para el asistente/i);
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });
    
    expect(onSend).toHaveBeenCalled();
  });

  it('NO debería llamar onSend al presionar Shift+Enter', () => {
    const onSend = vi.fn();
    render(<ChatInput {...defaultProps} value="test message" onSend={onSend} />);
    
    const textarea = screen.getByLabelText(/instrucción para el asistente/i);
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: true });
    
    expect(onSend).not.toHaveBeenCalled();
  });

  it('NO debería llamar onSend si está disabled', () => {
    const onSend = vi.fn();
    render(<ChatInput {...defaultProps} value="test" onSend={onSend} disabled={true} />);
    
    const textarea = screen.getByLabelText(/instrucción para el asistente/i);
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });
    
    expect(onSend).not.toHaveBeenCalled();
  });

  it('debería deshabilitar el botón de enviar si no hay texto', () => {
    render(<ChatInput {...defaultProps} value="" />);
    expect(screen.getByLabelText(/enviar instrucción/i)).toBeDisabled();
  });

  it('debería habilitar el botón de enviar si hay texto', () => {
    render(<ChatInput {...defaultProps} value="test" />);
    expect(screen.getByLabelText(/enviar instrucción/i)).not.toBeDisabled();
  });

  it('debería mostrar MultiRepoSelector si multiRepoEnabled es true', () => {
    render(<ChatInput {...defaultProps} multiRepoEnabled={true} />);
    expect(screen.getByTestId('multi-repo-selector')).toBeInTheDocument();
  });

  it('NO debería mostrar MultiRepoSelector si multiRepoEnabled es false', () => {
    render(<ChatInput {...defaultProps} multiRepoEnabled={false} />);
    expect(screen.queryByTestId('multi-repo-selector')).not.toBeInTheDocument();
  });

  it('debería llamar onMultiRepoChange al marcar el checkbox', () => {
    const onMultiRepoChange = vi.fn();
    render(<ChatInput {...defaultProps} onMultiRepoChange={onMultiRepoChange} />);
    
    const checkbox = screen.getByLabelText(/aplicar a múltiples repositorios/i);
    fireEvent.click(checkbox);
    
    expect(onMultiRepoChange).toHaveBeenCalledWith(true);
  });

  it('debería mostrar selector de modo si onModeOverrideChange está definido', () => {
    const onModeOverrideChange = vi.fn();
    render(<ChatInput {...defaultProps} onModeOverrideChange={onModeOverrideChange} />);
    
    expect(screen.getByText(/🤖 Auto/i)).toBeInTheDocument();
    expect(screen.getByText(/💬 Opinión/i)).toBeInTheDocument();
    expect(screen.getByText(/️ Acción/i)).toBeInTheDocument();
  });

  it('debería llamar onModeOverrideChange al hacer clic en un modo', () => {
    const onModeOverrideChange = vi.fn();
    render(<ChatInput {...defaultProps} onModeOverrideChange={onModeOverrideChange} />);
    
    const chatButton = screen.getByText(/💬 Opinión/i);
    fireEvent.click(chatButton);
    
    expect(onModeOverrideChange).toHaveBeenCalledWith('chat');
  });
});
