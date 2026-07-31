import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// El setup global mockea '../context/ThemeContext'. Para testear el provider
// REAL, lo des-mockeamos en este archivo con la implementación auténtica.
vi.unmock('../ThemeContext');

import { ThemeProvider, useTheme } from '../ThemeContext';
import type { Theme } from '../ThemeContext';

const STORAGE_KEY = 'app-theme';

// matchMedia stub estable: los listeners persisten entre renders (el effect del
// provider se suscribe tras el primer render y debe poder ser disparado después).
let systemDark = false;
const matchMediaListeners: ((e: { matches: boolean }) => void)[] = [];

beforeEach(() => {
  systemDark = false;
  matchMediaListeners.length = 0;
  vi.stubGlobal('matchMedia', (_query: string) => ({
    get matches() { return systemDark; },
    media: _query,
    onchange: null,
    addEventListener: (_ev: string, cb: (e: { matches: boolean }) => void) => matchMediaListeners.push(cb),
    removeEventListener: (_ev: string, cb: (e: { matches: boolean }) => void) => {
      const i = matchMediaListeners.indexOf(cb);
      if (i >= 0) matchMediaListeners.splice(i, 1);
    },
    dispatchEvent: () => true,
  }));
});

// Dispara a todos los listeners como si el SO cambiara de preferencia.
function emitSystemPrefersDark(matches: boolean) {
  systemDark = matches;
  matchMediaListeners.forEach(cb => cb({ matches }));
}

describe('ThemeContext (#71)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.removeItem(STORAGE_KEY);
    document.documentElement.removeAttribute('data-theme');
    systemDark = false; // SO = claro por defecto
  });

  function renderTheme() {
    return renderHook(() => useTheme(), { wrapper: ThemeProvider });
  }

  // ── Estado inicial / defaults ───────────────────────────────────────────────
  it('default = "auto" cuando no hay preferencia guardada', () => {
    const { result } = renderTheme();
    expect(result.current.theme).toBe<Theme>('auto');
  });

  it('respeta la preferencia guardada en localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    const { result } = renderTheme();
    expect(result.current.theme).toBe<Theme>('light');
  });

  it('ignora valores inválidos en storage y cae a "auto"', () => {
    localStorage.setItem(STORAGE_KEY, 'pink');
    const { result } = renderTheme();
    expect(result.current.theme).toBe<Theme>('auto');
  });

  // ── Resolución del tema ────────────────────────────────────────────────────
  it('resolvedTheme = tema fijo cuando no es "auto" (light)', () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    const { result } = renderTheme();
    expect(result.current.resolvedTheme).toBe('light');
  });

  it('resolvedTheme sigue al SO cuando theme = "auto" (SO dark)', () => {
    systemDark = true;
    const { result } = renderTheme();
    expect(result.current.theme).toBe('auto');
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('resolvedTheme sigue al SO cuando theme = "auto" (SO light)', () => {
    systemDark = false;
    const { result } = renderTheme();
    expect(result.current.resolvedTheme).toBe('light');
  });

  // ── setTheme / persistencia ────────────────────────────────────────────────
  it('setTheme cambia el estado y lo persiste en localStorage', () => {
    const { result } = renderTheme();
    act(() => result.current.setTheme('dark'));
    expect(result.current.theme).toBe<Theme>('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('setTheme con "auto" persiste "auto"', () => {
    const { result } = renderTheme();
    act(() => result.current.setTheme('light'));
    act(() => result.current.setTheme('auto'));
    expect(result.current.theme).toBe<Theme>('auto');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('auto');
  });

  // ── toggle (ciclo light → dark → auto → light) ────────────────────────────
  it('toggle recorre el ciclo light → dark → auto → light', () => {
    const { result } = renderTheme();
    act(() => result.current.setTheme('light'));

    act(() => result.current.toggle());
    expect(result.current.theme).toBe<Theme>('dark');

    act(() => result.current.toggle());
    expect(result.current.theme).toBe<Theme>('auto');

    act(() => result.current.toggle());
    expect(result.current.theme).toBe<Theme>('light');
  });

  // ── Aplicación al DOM ──────────────────────────────────────────────────────
  it('aplica data-theme al <html> con el tema resuelto', () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    renderTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('actualiza data-theme al cambiar con setTheme', () => {
    const { result } = renderTheme();
    act(() => result.current.setTheme('dark'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('resuelve "auto" contra el SO al aplicar al DOM', () => {
    systemDark = true;
    renderTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  // ── Reacción en vivo al SO en modo "auto" ─────────────────────────────────
  it('reacciona en vivo a cambios de prefers-color-scheme cuando theme = "auto"', () => {
    systemDark = false;
    const { result } = renderTheme();
    expect(result.current.resolvedTheme).toBe('light');

    // El SO cambia a oscuro.
    act(() => emitSystemPrefersDark(true));
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('NO escucha al SO cuando el tema es fijo (light)', () => {
    systemDark = false;
    localStorage.setItem(STORAGE_KEY, 'light');
    const { result } = renderTheme();
    expect(result.current.resolvedTheme).toBe('light');

    act(() => emitSystemPrefersDark(true));
    // Sigue en light: el tema es fijo, el SO es irrelevante.
    expect(result.current.resolvedTheme).toBe('light');
  });

  // ── Guardia del hook ───────────────────────────────────────────────────────
  it('useTheme lanza si se consume fuera del Provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useTheme())).toThrow(/must be used within a ThemeProvider/);
    spy.mockRestore();
  });
});
