import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock de fetch para simular la API de GitHub
(globalThis as any).fetch = vi.fn();

describe('AuthContext - Zero-Storage Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock de sessionStorage para verificar que NO se usa
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    });
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

  it('debería hacer logout y limpiar el estado', async () => {
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

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
  });
});
