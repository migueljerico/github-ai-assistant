import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock de fetch para simular la API de GitHub
(globalThis as any).fetch = vi.fn();

describe('AuthContext - Zero-Storage Architecture', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock de window.location para el logout
    delete (window as any).location;
    (window as any).location = {
      href: '',
      origin: 'http://localhost:5173',
    };
    
    // Mock de sessionStorage para verificar que NO se usa
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it('debería iniciar desautenticado por defecto', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('NO debería usar sessionStorage en ningún momento', () => {
    renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    // Verificar que sessionStorage NUNCA fue llamado
    expect(window.sessionStorage.setItem).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem).not.toHaveBeenCalled();
    expect(window.sessionStorage.removeItem).not.toHaveBeenCalled();
  });

  it('debería autenticar con un token válido', async () => {
    // Mock de la respuesta de GitHub API
    ((globalThis as any).fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        login: 'testuser',
        id: 123,
        avatar_url: 'https://example.com/avatar.png',
        name: 'Test User',
      }),
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await act(async () => {
      await result.current.loginWithPat('test-token-123');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe('test-token-123');
    expect(result.current.user?.login).toBe('testuser');
  });

  it('debería hacer logout, limpiar estado y redirigir a GitHub logout', async () => {
    // Primero autenticamos
    ((globalThis as any).fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ login: 'testuser', id: 123, avatar_url: '', name: '' }),
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await act(async () => {
      await result.current.loginWithPat('test-token');
    });

    expect(result.current.isAuthenticated).toBe(true);

    // Ahora hacemos logout
    act(() => {
      result.current.logout();
    });

    // Verificar que el estado se limpió
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    
    // Verificar que redirigió a GitHub logout
    expect(window.location.href).toContain('https://github.com/logout');
    expect(window.location.href).toContain('return_to=');
  });

  it('debería iniciar OAuth redirigiendo a /auth/github', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    act(() => {
      result.current.initiateOAuth();
    });

    expect(window.location.href).toBe('/auth/github');
  });

  it('debería manejar token de OAuth correctamente', async () => {
    ((globalThis as any).fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        login: 'oauthuser',
        id: 456,
        avatar_url: 'https://example.com/oauth.png',
        name: 'OAuth User',
      }),
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await act(async () => {
      await result.current.setTokenFromOAuth('oauth-token-xyz');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe('oauth-token-xyz');
    expect(result.current.user?.login).toBe('oauthuser');
  });

  it('debería manejar error de token inválido', async () => {
    ((globalThis as any).fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await act(async () => {
      await result.current.loginWithPat('invalid-token');
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
    expect(result.current.error).toBeTruthy();
  });
});
