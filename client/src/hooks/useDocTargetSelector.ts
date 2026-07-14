// ────────────────────────────────────────────────────────────────────────────
// useDocTargetSelector — Persistencia avanzada del selector de documento
// Guarda en localStorage el scope, repo, path e instrucciones adicionales
// del último flujo "documento específico del repo" para restaurar el contexto
// al reabrir el DocumentFlowModal.
// ────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'doc_target_selector';

/** Datos que se persisten para el selector de documento específico */
export interface DocTargetSelectorState {
  /** Alcance seleccionado: 'repo' | 'file' | 'specific' */
  scope: 'repo' | 'file' | 'specific' | null;
  /** Input del repo para scope 'specific' (owner/repo) */
  specificRepoInput: string;
  /** Path del archivo dentro del repo para scope 'specific' */
  specificPath: string;
  /** Instrucciones adicionales para el generador (Fase 3 selectividad) */
  extraInstructions: string;
  /** Timestamp de la última actualización (para depuración/expiración futura) */
  updatedAt: number;
}

/** Estado por defecto inicial */
const DEFAULT_STATE: DocTargetSelectorState = {
  scope: null,
  specificRepoInput: '',
  specificPath: '',
  extraInstructions: '',
  updatedAt: 0,
};

/**
 * Hook para persistir y restaurar el estado del selector de documento específico.
 *
 * @returns Objeto con:
 *   - `state`: estado actual (se hidrata desde localStorage en el primer render)
 *   - `setScope`: actualiza el scope y persiste
 *   - `setSpecificRepoInput`: actualiza el repo input y persiste
 *   - `setSpecificPath`: actualiza el path y persiste
 *   - `setExtraInstructions`: actualiza las instrucciones extra y persiste
 *   - `clear`: limpia el almacenamiento y resetea al estado por defecto
 */
export function useDocTargetSelector() {
  // Hidratación perezosa desde localStorage (solo en cliente)
  const [state, setState] = useState<DocTargetSelectorState>(() => {
    if (typeof window === 'undefined') return DEFAULT_STATE;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_STATE;
      const parsed = JSON.parse(raw) as Partial<DocTargetSelectorState>;
      // Merge defensivo: aseguramos que todos los campos existan
      return {
        ...DEFAULT_STATE,
        ...parsed,
        updatedAt: parsed.updatedAt ?? 0,
      };
    } catch {
      // Si hay error de parsing, limpiamos y volvemos al default
      localStorage.removeItem(STORAGE_KEY);
      return DEFAULT_STATE;
    }
  });

  // Persistencia: cada vez que cambia el estado, escribimos en localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignorar errores de cuota/privado; el estado sigue vivo en memoria
    }
  }, [state]);

  // Setters con persistencia automática vía el useEffect de arriba
  const setScope = useCallback((scope: DocTargetSelectorState['scope']) => {
    setState((prev) => ({ ...prev, scope, updatedAt: Date.now() }));
  }, []);

  const setSpecificRepoInput = useCallback((specificRepoInput: string) => {
    setState((prev) => ({ ...prev, specificRepoInput, updatedAt: Date.now() }));
  }, []);

  const setSpecificPath = useCallback((specificPath: string) => {
    setState((prev) => ({ ...prev, specificPath, updatedAt: Date.now() }));
  }, []);

  const setExtraInstructions = useCallback((extraInstructions: string) => {
    setState((prev) => ({ ...prev, extraInstructions, updatedAt: Date.now() }));
  }, []);

  const clear = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    setState(DEFAULT_STATE);
  }, []);

  return {
    state,
    setScope,
    setSpecificRepoInput,
    setSpecificPath,
    setExtraInstructions,
    clear,
  };
}
