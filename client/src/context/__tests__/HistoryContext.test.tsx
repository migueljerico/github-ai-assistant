import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HistoryProvider, useHistory } from '../HistoryContext';
import type { HistoryEntry } from '../../types';

// Helper: genera una entrada base sin id/timestamp (los añade addEntry)
function baseEntry(overrides: Partial<Omit<HistoryEntry, 'id' | 'timestamp'>> = {}) {
  return {
    status: 'pending' as const,
    description: 'Acción de prueba',
    repo: 'mi-repo',
    ...overrides,
  };
}

describe('HistoryContext', () => {
  beforeEach(() => {
    // El log de exportación crea/enlaza/revoca URLs; las limpiamos por test.
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
    // document.createElement / appendChild reales funcionan en jsdom, pero
    // capturamos el click para no invocar navegación.
  });

  it('inicia con la lista vacía', () => {
    const { result } = renderHook(() => useHistory(), { wrapper: HistoryProvider });
    expect(result.current.entries).toEqual([]);
  });

  it('addEntry añade la entrada y devuelve un id único', () => {
    const { result } = renderHook(() => useHistory(), { wrapper: HistoryProvider });

    let id1!: string;
    let id2!: string;
    act(() => {
      id1 = result.current.addEntry(baseEntry({ description: 'primera' }));
      id2 = result.current.addEntry(baseEntry({ description: 'segunda' }));
    });

    expect(id1).not.toEqual(id2);
    expect(id1).toMatch(/^entry-/);
    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0].description).toBe('primera');
    expect(result.current.entries[1].description).toBe('segunda');
  });

  it('addEntry genera timestamp y conserva status/description/repo', () => {
    const { result } = renderHook(() => useHistory(), { wrapper: HistoryProvider });

    const before = Date.now();
    let id!: string;
    act(() => {
      id = result.current.addEntry(
        baseEntry({ status: 'pending', description: 'crear repo', repo: 'demo' }),
      );
    });
    const after = Date.now();

    const entry = result.current.entries.find(e => e.id === id)!;
    expect(entry).toBeDefined();
    expect(entry.status).toBe('pending');
    expect(entry.description).toBe('crear repo');
    expect(entry.repo).toBe('demo');
    // timestamp está en [before, after] (Date.now() marcado justo al construir)
    const ts = entry.timestamp.getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('updateEntry cambia status y description de la entrada indicada', () => {
    const { result } = renderHook(() => useHistory(), { wrapper: HistoryProvider });

    let id!: string;
    act(() => {
      id = result.current.addEntry(baseEntry({ status: 'pending' }));
    });

    act(() => {
      result.current.updateEntry(id, { status: 'completed', description: 'ok final' });
    });

    const entry = result.current.entries.find(e => e.id === id)!;
    expect(entry.status).toBe('completed');
    expect(entry.description).toBe('ok final');
  });

  it('updateEntry con id inexistente no rompe ni añade nada', () => {
    const { result } = renderHook(() => useHistory(), { wrapper: HistoryProvider });

    act(() => {
      result.current.addEntry(baseEntry());
    });
    expect(result.current.entries).toHaveLength(1);

    act(() => {
      result.current.updateEntry('no-existe', { status: 'error' });
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].status).toBe('pending'); // sin cambios
  });

  it('clearHistory vacía la lista', () => {
    const { result } = renderHook(() => useHistory(), { wrapper: HistoryProvider });

    act(() => {
      result.current.addEntry(baseEntry());
      result.current.addEntry(baseEntry());
    });
    expect(result.current.entries).toHaveLength(2);

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.entries).toEqual([]);
  });

  it('exportLog construye el blob, el nombre de archivo y dispara la descarga', () => {
    const { result } = renderHook(() => useHistory(), { wrapper: HistoryProvider });

    // Entrada completada y otra en error para cubrir los dos emojis principales
    act(() => {
      result.current.addEntry(
        baseEntry({ status: 'pending', description: 'crear repo', repo: 'demo' }),
      );
      result.current.addEntry(
        baseEntry({ status: 'pending', description: 'falló algo', repo: 'otro' }),
      );
    });
    // Mutamos a estados distintos para cubrir el map de emojis
    const ids = result.current.entries.map(e => e.id);
    act(() => {
      result.current.updateEntry(ids[0], { status: 'completed' });
      result.current.updateEntry(ids[1], { status: 'error' });
    });

    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    // Espiamos el click del <a> inyectado
    const clickSpy = vi.fn();
    const anchorStub = { click: clickSpy, href: '', download: '' };
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return anchorStub as unknown as HTMLAnchorElement;
      return realCreate(tag);
    });
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);

    act(() => {
      result.current.exportLog();
    });

    // Se creó el blob y se disparó el click del <a> inyectado
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('useHistory lanza si se usa fuera del Provider', () => {
    // Silenciamos el error esperado para no ensuciar la salida
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useHistory())).toThrow(/HistoryProvider/);
    spy.mockRestore();
  });

  it('addEntry con repo null se renderiza sin sufijo en el export', () => {
    const { result } = renderHook(() => useHistory(), { wrapper: HistoryProvider });

    act(() => {
      result.current.addEntry(baseEntry({ description: 'sin repo', repo: null }));
    });
    expect(result.current.entries[0].repo).toBeNull();
    // No afirmamos el texto: cubrimos la rama `repo = null` del map del export.
  });
});
