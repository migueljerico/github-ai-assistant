import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import SessionWarningBanner from '../SessionWarningBanner';

// Mock de los contextos
vi.mock('../../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../context/AIProviderContext', () => ({
  useAIProvider: vi.fn(),
}));

import { useAuth } from '../../../context/AuthContext';
import { useAIProvider } from '../../../context/AIProviderContext';

describe('SessionWarningBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('no renderiza nada si la sesión es reciente (< 8h)', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      connectedAt: Date.now() - 1 * 60 * 60 * 1000,
      token: 'ghp_mocktoken',
      user: { login: 'test' } as any,
      isLoading: false,
      error: null,
      loginWithPat: vi.fn(),
      logout: vi.fn(),
      initiateOAuth: vi.fn(),
      setTokenFromOAuth: vi.fn(),
    });

    vi.mocked(useAIProvider).mockReturnValue({
      isConnected: true,
      connectedAt: Date.now() - 1 * 60 * 60 * 1000,
      provider: 'gemini',
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
      accountId: null,
      timeoutMs: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      setTimeoutMs: vi.fn(),
    });

    render(<SessionWarningBanner />);
    expect(screen.queryByText(/Token de GitHub/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Clave de IA/)).not.toBeInTheDocument();
  });

  it('renderiza aviso cuando la sesión GitHub supera 8h', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      connectedAt: Date.now() - 9 * 60 * 60 * 1000,
      token: 'ghp_mocktoken',
      user: { login: 'test' } as any,
      isLoading: false,
      error: null,
      loginWithPat: vi.fn(),
      logout: vi.fn(),
      initiateOAuth: vi.fn(),
      setTokenFromOAuth: vi.fn(),
    });

    vi.mocked(useAIProvider).mockReturnValue({
      isConnected: true,
      connectedAt: Date.now() - 1 * 60 * 60 * 1000,
      provider: 'gemini',
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
      accountId: null,
      timeoutMs: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      setTimeoutMs: vi.fn(),
    });

    render(<SessionWarningBanner />);
    expect(screen.getByText(/Token de GitHub/)).toBeInTheDocument();
    expect(screen.getByText(/lleva activo más de 9h/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reconectar GitHub/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cerrar aviso de Token de GitHub/i })).toBeInTheDocument();
  });

  it('renderiza aviso cuando la sesión IA supera 8h', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      connectedAt: Date.now() - 1 * 60 * 60 * 1000,
      token: 'ghp_mocktoken',
      user: { login: 'test' } as any,
      isLoading: false,
      error: null,
      loginWithPat: vi.fn(),
      logout: vi.fn(),
      initiateOAuth: vi.fn(),
      setTokenFromOAuth: vi.fn(),
    });

    vi.mocked(useAIProvider).mockReturnValue({
      isConnected: true,
      connectedAt: Date.now() - 9 * 60 * 60 * 1000,
      provider: 'gemini',
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
      accountId: null,
      timeoutMs: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      setTimeoutMs: vi.fn(),
    });

    render(<SessionWarningBanner />);
    expect(screen.getByText(/Clave de IA/)).toBeInTheDocument();
    expect(screen.getByText(/lleva activo más de 9h/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cerrar aviso de Clave de IA/i })).toBeInTheDocument();
  });

  it('permite cerrar el aviso individualmente', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      connectedAt: Date.now() - 9 * 60 * 60 * 1000,
      token: 'ghp_mocktoken',
      user: { login: 'test' } as any,
      isLoading: false,
      error: null,
      loginWithPat: vi.fn(),
      logout: vi.fn(),
      initiateOAuth: vi.fn(),
      setTokenFromOAuth: vi.fn(),
    });

    vi.mocked(useAIProvider).mockReturnValue({
      isConnected: true,
      connectedAt: Date.now() - 1 * 60 * 60 * 1000,
      provider: 'gemini',
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
      accountId: null,
      timeoutMs: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      setTimeoutMs: vi.fn(),
    });

    render(<SessionWarningBanner />);
    expect(screen.getByText(/Token de GitHub/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cerrar aviso de Token de GitHub/i }));

    expect(screen.queryByText(/Token de GitHub/)).not.toBeInTheDocument();
  });

  it('verifica cada 60 segundos (timer)', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      connectedAt: Date.now() - 1 * 60 * 60 * 1000,
      token: 'ghp_mocktoken',
      user: { login: 'test' } as any,
      isLoading: false,
      error: null,
      loginWithPat: vi.fn(),
      logout: vi.fn(),
      initiateOAuth: vi.fn(),
      setTokenFromOAuth: vi.fn(),
    });

    vi.mocked(useAIProvider).mockReturnValue({
      isConnected: true,
      connectedAt: Date.now() - 1 * 60 * 60 * 1000,
      provider: 'gemini',
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
      accountId: null,
      timeoutMs: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      setTimeoutMs: vi.fn(),
    });

    render(<SessionWarningBanner />);
    expect(screen.queryByText(/Token de GitHub/)).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(61_000);
    });

    // Actualizar mocks para sesión antigua
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      connectedAt: Date.now() - 9 * 60 * 60 * 1000,
      token: 'ghp_mocktoken',
      user: { login: 'test' } as any,
      isLoading: false,
      error: null,
      loginWithPat: vi.fn(),
      logout: vi.fn(),
      initiateOAuth: vi.fn(),
      setTokenFromOAuth: vi.fn(),
    });

    vi.mocked(useAIProvider).mockReturnValue({
      isConnected: true,
      connectedAt: Date.now() - 1 * 60 * 60 * 1000,
      provider: 'gemini',
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
      accountId: null,
      timeoutMs: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      setTimeoutMs: vi.fn(),
    });

    const { rerender } = render(<SessionWarningBanner />);
    rerender(<SessionWarningBanner />);
    expect(screen.getByText(/Token de GitHub/)).toBeInTheDocument();
  });

  it('muestra ambos avisos si ambas sesiones son antiguas', () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      connectedAt: Date.now() - 9 * 60 * 60 * 1000,
      token: 'ghp_mocktoken',
      user: { login: 'test' } as any,
      isLoading: false,
      error: null,
      loginWithPat: vi.fn(),
      logout: vi.fn(),
      initiateOAuth: vi.fn(),
      setTokenFromOAuth: vi.fn(),
    });

    vi.mocked(useAIProvider).mockReturnValue({
      isConnected: true,
      connectedAt: Date.now() - 10 * 60 * 60 * 1000,
      provider: 'gemini',
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
      accountId: null,
      timeoutMs: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      setTimeoutMs: vi.fn(),
    });

    render(<SessionWarningBanner />);
    expect(screen.getByText(/Token de GitHub/)).toBeInTheDocument();
    expect(screen.getByText(/Clave de IA/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reconectar GitHub/i })).toBeInTheDocument();
  });
});
