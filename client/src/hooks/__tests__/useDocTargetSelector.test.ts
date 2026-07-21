// ────────────────────────────────────────────────────────────────────────────
// Tests for useDocTargetSelector hook
// ────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocTargetSelector } from '../useDocTargetSelector';

const STORAGE_KEY = 'doc_target_selector';

describe('useDocTargetSelector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('inicializa con estado por defecto cuando localStorage está vacío', () => {
    const { result } = renderHook(() => useDocTargetSelector());

    expect(result.current.state).toEqual({
      scope: null,
      specificRepoInput: '',
      specificPath: '',
      extraInstructions: '',
      bulkPaths: [],
      updatedAt: 0,
    });
  });

  it('hidrata el estado desde localStorage al montar', () => {
    const savedState = {
      scope: 'specific' as const,
      specificRepoInput: 'owner/repo',
      specificPath: 'src/components/Button.tsx',
      extraInstructions: 'Solo actualiza la sección de providers',
      updatedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState));

    const { result } = renderHook(() => useDocTargetSelector());

    expect(result.current.state).toMatchObject(savedState);
  });

  it('maneja JSON inválido en localStorage (usa default y limpia storage)', () => {
    localStorage.setItem(STORAGE_KEY, 'no-es-json-valido');

    const { result } = renderHook(() => useDocTargetSelector());

    expect(result.current.state).toEqual({
      scope: null,
      specificRepoInput: '',
      specificPath: '',
      extraInstructions: '',
      bulkPaths: [],
      updatedAt: 0,
    });
    // La clave se elimina al detectar JSON inválido, pero luego se reescribe el default
    // Verificamos que el estado en memoria es correcto
  });

  it('persiste cambios de scope en localStorage', () => {
    const { result } = renderHook(() => useDocTargetSelector());

    act(() => {
      result.current.setScope('specific');
    });

    expect(result.current.state.scope).toBe('specific');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.scope).toBe('specific');
  });

  it('persiste cambios en specificRepoInput', () => {
    const { result } = renderHook(() => useDocTargetSelector());

    act(() => {
      result.current.setSpecificRepoInput('owner/repo');
    });

    expect(result.current.state.specificRepoInput).toBe('owner/repo');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.specificRepoInput).toBe('owner/repo');
  });

  it('persiste cambios en specificPath', () => {
    const { result } = renderHook(() => useDocTargetSelector());

    act(() => {
      result.current.setSpecificPath('src/components/Button.tsx');
    });

    expect(result.current.state.specificPath).toBe('src/components/Button.tsx');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.specificPath).toBe('src/components/Button.tsx');
  });

  it('persiste cambios en extraInstructions', () => {
    const { result } = renderHook(() => useDocTargetSelector());

    act(() => {
      result.current.setExtraInstructions('Enfócate en seguridad');
    });

    expect(result.current.state.extraInstructions).toBe('Enfócate en seguridad');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.extraInstructions).toBe('Enfócate en seguridad');
  });

  it('actualiza updatedAt en cada cambio', () => {
    const { result } = renderHook(() => useDocTargetSelector());

    act(() => {
      result.current.setScope('repo');
    });

    const firstUpdatedAt = result.current.state.updatedAt;

    act(() => {
      vi.advanceTimersByTime(10);
      result.current.setSpecificRepoInput('owner/repo');
    });

    expect(result.current.state.updatedAt).toBeGreaterThan(firstUpdatedAt);
  });

  it('clear limpia localStorage y resetea al estado por defecto', () => {
    const savedState = {
      scope: 'specific' as const,
      specificRepoInput: 'owner/repo',
      specificPath: 'src/file.ts',
      extraInstructions: 'test',
      updatedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState));

    const { result } = renderHook(() => useDocTargetSelector());

    act(() => {
      result.current.clear();
    });

    expect(result.current.state).toEqual({
      scope: null,
      specificRepoInput: '',
      specificPath: '',
      extraInstructions: '',
      bulkPaths: [],
      updatedAt: 0,
    });
    // clear() elimina la clave, pero el useEffect subsiguiente guarda el estado por defecto
    // Verificamos que el contenido sea el estado por defecto
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual({
      scope: null,
      specificRepoInput: '',
      specificPath: '',
      extraInstructions: '',
      bulkPaths: [],
      updatedAt: 0,
    });
  });

  it('merge defensivo: campos faltantes en storage usan defaults', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      scope: 'specific',
      specificRepoInput: 'owner/repo',
    }));

    const { result } = renderHook(() => useDocTargetSelector());

    expect(result.current.state.scope).toBe('specific');
    expect(result.current.state.specificRepoInput).toBe('owner/repo');
    expect(result.current.state.specificPath).toBe('');
    expect(result.current.state.extraInstructions).toBe('');
    expect(typeof result.current.state.updatedAt).toBe('number');
  });

  it('ignora errores de cuota de localStorage (estado sigue en memoria)', () => {
    const { result } = renderHook(() => useDocTargetSelector());

    const originalSetItem = localStorage.setItem;
    localStorage.setItem = vi.fn(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => {
      act(() => {
        result.current.setScope('file');
      });
    }).not.toThrow();

    expect(result.current.state.scope).toBe('file');

    localStorage.setItem = originalSetItem;
  });
});
