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
