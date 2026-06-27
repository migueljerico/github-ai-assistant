import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { AIProviderContextProvider, useAIProvider } from '../AIProviderContext';

describe('AIProviderContext', () => {
  beforeEach(() => {
    // Limpiar sessionStorage antes de cada test
    sessionStorage.clear();
  });

  it('debería iniciar con valores por defecto', () => {
    const { result } = renderHook(() => useAIProvider(), {
      wrapper: AIProviderContextProvider,
    });

    expect(result.current.provider).toBeNull();
    expect(result.current.apiKey).toBeNull();
    expect(result.current.model).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });

  it('debería conectar un proveedor correctamente', () => {
    const { result } = renderHook(() => useAIProvider(), {
      wrapper: AIProviderContextProvider,
    });

    act(() => {
      result.current.connect('groq', 'test-api-key', 'llama-3.3-70b');
    });

    expect(result.current.provider).toBe('groq');
    expect(result.current.apiKey).toBe('test-api-key');
    expect(result.current.model).toBe('llama-3.3-70b');
    expect(result.current.isConnected).toBe(true);
  });

  it('debería desconectar correctamente', () => {
    const { result } = renderHook(() => useAIProvider(), {
      wrapper: AIProviderContextProvider,
    });

    // Primero conectar
    act(() => {
      result.current.connect('gemini', 'gemini-key', 'gemini-2.0-flash');
    });

    expect(result.current.isConnected).toBe(true);

    // Luego desconectar
    act(() => {
      result.current.disconnect();
    });

    expect(result.current.provider).toBeNull();
    expect(result.current.apiKey).toBeNull();
    expect(result.current.model).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });

  it('debería cambiar de proveedor', () => {
    const { result } = renderHook(() => useAIProvider(), {
      wrapper: AIProviderContextProvider,
    });

    // Conectar con Groq
    act(() => {
      result.current.connect('groq', 'groq-key', 'llama-3.3-70b');
    });

    expect(result.current.provider).toBe('groq');

    // Cambiar a Gemini
    act(() => {
      result.current.connect('gemini', 'gemini-key', 'gemini-2.0-flash');
    });

    expect(result.current.provider).toBe('gemini');
    expect(result.current.apiKey).toBe('gemini-key');
    expect(result.current.model).toBe('gemini-2.0-flash');
  });

  it('al conectar recuerda proveedor+modelo en sessionStorage (no la key) — #40', () => {
    const { result } = renderHook(() => useAIProvider(), {
      wrapper: AIProviderContextProvider,
    });

    act(() => {
      result.current.connect('groq', 'secret-key', 'llama-3.3-70b');
    });

    const raw = sessionStorage.getItem('ai_provider_pref') || '';
    expect(JSON.parse(raw)).toEqual({ provider: 'groq', model: 'llama-3.3-70b' });
    expect(raw).not.toContain('secret-key'); // la API key NUNCA se guarda
  });

  it('al desconectar borra la preferencia guardada — #40', () => {
    const { result } = renderHook(() => useAIProvider(), {
      wrapper: AIProviderContextProvider,
    });

    act(() => { result.current.connect('gemini', 'k', 'gemini-2.5-flash'); });
    expect(sessionStorage.getItem('ai_provider_pref')).not.toBeNull();

    act(() => { result.current.disconnect(); });
    expect(sessionStorage.getItem('ai_provider_pref')).toBeNull();
  });

  it('debería mantener el estado entre renders', () => {
    const { result, rerender } = renderHook(() => useAIProvider(), {
      wrapper: AIProviderContextProvider,
    });

    act(() => {
      result.current.connect('groq', 'test-key', 'llama-3.3-70b');
    });

    rerender();

    expect(result.current.provider).toBe('groq');
    expect(result.current.apiKey).toBe('test-key');
    expect(result.current.model).toBe('llama-3.3-70b');
  });
});
