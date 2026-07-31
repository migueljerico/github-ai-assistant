import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

/**
 * #71 — Tema claro/oscuro/auto.
 *
 * Modelo de persistencia: `localStorage` (clave `app-theme`), para que la
 * preferencia sobreviva a recargas y sesiones (a diferencia de sessionStorage).
 * El tema NO es un secreto, así que no aplica la regla Zero-Storage de
 * AuthContext/AIProviderContext; encaja con el patrón de preferencia de
 * useDocTargetSelector/LanguageContext.
 *
 * Estados:
 *  - 'light' / 'dark': tema fijo explícito.
 *  - 'auto': sigue `prefers-color-scheme` del SO y reacciona en vivo a sus
 *    cambios. Es el valor por defecto (para la mayoría = oscuro = estado previo
 *    de la app, sin forzar una preferencia al usuario).
 *
 * El tema resuelto se aplica seteando `data-theme` en <html>; el bloque
 * :root[data-theme='light'] de index.css redefine los tokens. Un script inline
 * en index.html hace lo propio pre-React para evitar FOUC.
 */

export type Theme = 'light' | 'dark' | 'auto';
type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'app-theme';
const VALID_THEMES: Theme[] = ['light', 'dark', 'auto'];
/** Ciclo del toggle: claro → oscuro → auto → claro… */
const TOGGLE_ORDER: Theme[] = ['light', 'dark', 'auto'];

interface ThemeContextValue {
  /** Preferencia del usuario (puede ser 'auto'). */
  theme: Theme;
  /** Tema efectivamente aplicado ('light' | 'dark'). */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  /** Avanza cíclicamente por claro → oscuro → auto. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'auto';
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return saved && VALID_THEMES.includes(saved) ? saved : 'auto';
  } catch {
    /* localStorage no disponible (modo privado, etc.) — no es crítico */
    return 'auto';
  }
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  // systemTheme solo es relevante cuando theme === 'auto'; se actualiza vía
  // listener de matchMedia (event handler, no setState síncrono en effect).
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  // Estado derivado durante el render (sin setState en effect): el tema efectivo.
  const resolvedTheme: ResolvedTheme = theme === 'auto' ? systemTheme : theme;

  // Side-effect puro al DOM: aplica el tema resuelto. Sin setState aquí.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', resolvedTheme === 'dark' ? '#0d1117' : '#f6f8fa');
    }
  }, [resolvedTheme]);

  // En modo 'auto', reacciona en vivo a los cambios de prefers-color-scheme.
  // El setState va dentro del event handler, no en el cuerpo del effect.
  useEffect(() => {
    if (theme !== 'auto' || typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setSystemTheme(mql.matches ? 'dark' : 'light');
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      /* modo privado / cuota — no es crítico */
    }
  }, []);

  const toggle = useCallback(() => {
    const idx = TOGGLE_ORDER.indexOf(theme);
    setTheme(TOGGLE_ORDER[(idx + 1) % TOGGLE_ORDER.length]);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
