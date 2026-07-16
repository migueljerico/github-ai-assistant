import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Header from '../Header';

// Mock de contexts y componentes hijos
vi.mock('../../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../auth/UserBadge', () => ({
  default: () => <div data-testid="user-badge">UserBadge</div>,
}));

vi.mock('../AIProviderBadge', () => ({
  default: () => <div data-testid="ai-provider-badge">AIProviderBadge</div>,
}));

import { useAuth } from '../../../context/AuthContext';

describe('Header', () => {
  const defaultProps = {
    onToggleTemplates: vi.fn(),
    onToggleHistory: vi.fn(),
    templatesOpen: true,
    historyOpen: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debería renderizar el header', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      token: null,
      user: null,
      isLoading: false,
      error: null,
      connectedAt: null,
      loginWithPat: vi.fn(),
      logout: vi.fn(),
      initiateOAuth: vi.fn(),
      setTokenFromOAuth: vi.fn(),
    });

    render(<Header {...defaultProps} />);
    
    expect(screen.getByText(/asistente de ia de github/i)).toBeInTheDocument();
  });

  it('debería mostrar badge "Sin conectar" cuando no está autenticado', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      token: null,
      user: null,
      isLoading: false,
      error: null,
      connectedAt: null,
      loginWithPat: vi.fn(),
      logout: vi.fn(),
      initiateOAuth: vi.fn(),
      setTokenFromOAuth: vi.fn(),
    });

    render(<Header {...defaultProps} />);
    
    expect(screen.getByText(/sin conectar/i)).toBeInTheDocument();
  });

  it('debería mostrar badge "Conectado" cuando está autenticado', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      token: 'test-token',
      user: { login: 'testuser', avatar_url: 'https://example.com/avatar.png' } as any,
      isLoading: false,
      error: null,
      connectedAt: Date.now(),
      loginWithPat: vi.fn(),
      logout: vi.fn(),
      initiateOAuth: vi.fn(),
      setTokenFromOAuth: vi.fn(),
    });

    render(<Header {...defaultProps} />);
    
    expect(screen.getByText(/conectado/i)).toBeInTheDocument();
  });

  it('debería mostrar UserBadge cuando está autenticado', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      token: 'test-token',
      user: { login: 'testuser', avatar_url: 'https://example.com/avatar.png' } as any,
      isLoading: false,
      error: null,
      connectedAt: Date.now(),
      loginWithPat: vi.fn(),
      logout: vi.fn(),
      initiateOAuth: vi.fn(),
      setTokenFromOAuth: vi.fn(),
    });

    render(<Header {...defaultProps} />);
    
    expect(screen.getByTestId('user-badge')).toBeInTheDocument();
  });

  it('NO debería mostrar UserBadge cuando no está autenticado', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      token: null,
      user: null,
      isLoading: false,
      error: null,
      connectedAt: null,
      loginWithPat: vi.fn(),
      logout: vi.fn(),
      initiateOAuth: vi.fn(),
      setTokenFromOAuth: vi.fn(),
    });

    render(<Header {...defaultProps} />);
    
    expect(screen.queryByTestId('user-badge')).not.toBeInTheDocument();
  });

  it('debería mostrar AIProviderBadge', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      token: null,
      user: null,
      isLoading: false,
      error: null,
      connectedAt: null,
      loginWithPat: vi.fn(),
      logout: vi.fn(),
      initiateOAuth: vi.fn(),
      setTokenFromOAuth: vi.fn(),
    });

    render(<Header {...defaultProps} />);
    
    expect(screen.getByTestId('ai-provider-badge')).toBeInTheDocument();
  });

  it('debería llamar onToggleTemplates al hacer clic en el botón de plantillas', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      token: null,
      user: null,
      isLoading: false,
      error: null,
      connectedAt: null,
      loginWithPat: vi.fn(),
      logout: vi.fn(),
      initiateOAuth: vi.fn(),
      setTokenFromOAuth: vi.fn(),
    });

    const onToggleTemplates = vi.fn();
    render(<Header {...defaultProps} onToggleTemplates={onToggleTemplates} />);
    
    fireEvent.click(screen.getByRole('button', { name: /plantillas/i }));
    
    expect(onToggleTemplates).toHaveBeenCalled();
  });

  it('debería llamar onToggleHistory al hacer clic en el botón de historial', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      token: null,
      user: null,
      isLoading: false,
      error: null,
      connectedAt: null,
      loginWithPat: vi.fn(),
      logout: vi.fn(),
      initiateOAuth: vi.fn(),
      setTokenFromOAuth: vi.fn(),
    });

    const onToggleHistory = vi.fn();
    render(<Header {...defaultProps} onToggleHistory={onToggleHistory} />);
    
    fireEvent.click(screen.getByRole('button', { name: /historial/i }));
    
    expect(onToggleHistory).toHaveBeenCalled();
  });

  it('debería mostrar título "Ocultar plantillas" cuando templatesOpen es true', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      token: null,
      user: null,
      isLoading: false,
      error: null,
      connectedAt: null,
      loginWithPat: vi.fn(),
      logout: vi.fn(),
      initiateOAuth: vi.fn(),
      setTokenFromOAuth: vi.fn(),
    });

    render(<Header {...defaultProps} templatesOpen={true} />);
    
    const button = screen.getByRole('button', { name: /plantillas/i });
    expect(button).toHaveAttribute('title', 'Ocultar plantillas');
  });

  it('debería mostrar título "Mostrar plantillas" cuando templatesOpen es false', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      token: null,
      user: null,
      isLoading: false,
      error: null,
      connectedAt: null,
      loginWithPat: vi.fn(),
      logout: vi.fn(),
      initiateOAuth: vi.fn(),
      setTokenFromOAuth: vi.fn(),
    });

    render(<Header {...defaultProps} templatesOpen={false} />);
    
    const button = screen.getByRole('button', { name: /plantillas/i });
    expect(button).toHaveAttribute('title', 'Mostrar plantillas');
  });
});
