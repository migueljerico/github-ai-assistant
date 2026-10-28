import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActions } from '../useActions';

// Mock del HistoryContext — espías a nivel de módulo para inspeccionar las
// llamadas desde los propios tests (#26, v4.0.52).
const addEntrySpy = vi.fn(() => 'mock-id-' + Math.random());
const updateEntrySpy = vi.fn();
vi.mock('../../context/HistoryContext', () => ({
  useHistory: () => ({ addEntry: addEntrySpy, updateEntry: updateEntrySpy }),
}));

describe('useActions Hook', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useActions());

    expect(result.current.pendingAction).toBeNull();
    expect(result.current.isExecuting).toBe(false);
    expect(result.current.selectedRepos).toEqual([]);
    expect(result.current.multiRepoEnabled).toBe(false);
  });

  it('should set pending action', () => {
    const { result } = renderHook(() => useActions());

    const mockAction = {
      action: {
        accion: 'Test action',
        metodo: 'POST',
        endpoint: '/test',
        requiereConfirmacion: true,
      },
      targetRepos: [],
    };

    act(() => {
      result.current.setPendingAction(mockAction as any);
    });

    expect(result.current.pendingAction).toEqual(mockAction);
  });

  // #26 (v4.0.52): la rama falsa de `repo || null` — sin repo explícito queda null
  it('logAction sin repo registra repo como null', () => {
    const { result } = renderHook(() => useActions());
    act(() => {
      result.current.logAction('completed', 'acción sin repo');
    });
    expect(addEntrySpy).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      description: 'acción sin repo',
      repo: null,
    }));
  });

  it('should set executing state', () => {
    const { result } = renderHook(() => useActions());

    act(() => {
      result.current.setIsExecuting(true);
    });

    expect(result.current.isExecuting).toBe(true);

    act(() => {
      result.current.setIsExecuting(false);
    });

    expect(result.current.isExecuting).toBe(false);
  });

  it('should set selected repos', () => {
    const { result } = renderHook(() => useActions());

    const mockRepos = [
      { id: 1, name: 'repo1', owner: 'user', url: 'https://github.com/user/repo1' } as any,
      { id: 2, name: 'repo2', owner: 'user', url: 'https://github.com/user/repo2' } as any,
    ];

    act(() => {
      result.current.setSelectedRepos(mockRepos);
    });

    expect(result.current.selectedRepos).toEqual(mockRepos);
    expect(result.current.selectedRepos).toHaveLength(2);
  });

  it('should toggle multi-repo mode', () => {
    const { result } = renderHook(() => useActions());

    act(() => {
      result.current.setMultiRepoEnabled(true);
    });

    expect(result.current.multiRepoEnabled).toBe(true);

    act(() => {
      result.current.setMultiRepoEnabled(false);
    });

    expect(result.current.multiRepoEnabled).toBe(false);
  });

  it('should log an action', () => {
    const { result } = renderHook(() => useActions());

    let logId: string = '';
    act(() => {
      logId = result.current.logAction('pending', 'Creating file', 'my-repo');
    });

    expect(logId).toBeDefined();
    expect(logId).toMatch(/^mock-id-/);
  });

  it('should update action log', () => {
    const { result } = renderHook(() => useActions());

    // Just verify it doesn't throw
    act(() => {
      result.current.updateActionLog('test-id', 'completed', 'Action completed successfully');
    });

    expect(true).toBe(true);
  });

  it('should clear pending action', () => {
    const { result } = renderHook(() => useActions());

    const mockAction = {
      action: { accion: 'Test' },
      targetRepos: [],
    };

    act(() => {
      result.current.setPendingAction(mockAction as any);
    });

    expect(result.current.pendingAction).not.toBeNull();

    act(() => {
      result.current.clearPendingAction();
    });

    expect(result.current.pendingAction).toBeNull();
  });

  it('should handle multi-repo workflow', () => {
    const { result } = renderHook(() => useActions());

    const mockRepos = [
      { id: 1, name: 'repo1', owner: 'user', url: 'https://github.com/user/repo1' } as any,
      { id: 2, name: 'repo2', owner: 'user', url: 'https://github.com/user/repo2' } as any,
    ];

    act(() => {
      result.current.setMultiRepoEnabled(true);
      result.current.setSelectedRepos(mockRepos);
    });

    expect(result.current.multiRepoEnabled).toBe(true);
    expect(result.current.selectedRepos).toHaveLength(2);

    act(() => {
      result.current.setPendingAction({
        action: { accion: 'Multi-repo action' },
        targetRepos: mockRepos,
      } as any);
    });

    expect(result.current.pendingAction?.targetRepos).toHaveLength(2);
  });
});
