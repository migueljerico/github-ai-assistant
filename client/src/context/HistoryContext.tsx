// ─────────────────────────────────────────────────────────────────────────────
// HistoryContext — session action history
//
// PERSISTENCE MODEL: Session-only (intentional)
// The history is stored exclusively in React state (in-memory). It is NOT
// persisted to localStorage, IndexedDB, or any server.
//
// RATIONALE:
// - Privacy: action logs contain repo names and operation details. Persisting
//   them across sessions could expose sensitive information on shared devices.
// - Simplicity: the app is designed as a single-session tool. Each session
//   starts fresh, which is consistent with the sessionStorage model used for
//   the GitHub token and AI key.
// - Export: users who want a permanent record can use the `exportLog()` function
//   to download a timestamped `.txt` file at any point during their session.
//
// ENTRY LIFECYCLE:
//   addEntry()   → creates entry with status 'pending', returns its ID
//   updateEntry() → updates status and/or description once the action completes
//   This two-step pattern allows real-time status updates in the UI as
//   operations execute (e.g. from 'pending' → 'completed' or 'error').
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useLanguage } from './LanguageContext';
import type { HistoryEntry, HistoryStatus } from '../types';

/** HistoryContext value — all history operations */
interface HistoryContextValue {
  /** All history entries for the current session, in chronological order */
  entries: HistoryEntry[];

  /**
   * Add a new entry to the history with an auto-generated ID and current timestamp.
   * The entry starts with whatever status is provided (typically 'pending').
   *
   * @param entry - Entry data without ID or timestamp (both generated automatically)
   * @returns The generated ID — save this to call updateEntry() later
   */
  addEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => string;

  /**
   * Update an existing history entry by ID.
   * Typically used to change `status` from 'pending' to 'completed' or 'error'
   * after an operation finishes.
   *
   * @param id     - The entry ID returned by addEntry()
   * @param update - Partial update to merge into the existing entry
   */
  updateEntry: (id: string, update: Partial<HistoryEntry>) => void;

  /** Remove all entries from the history (resets to empty array) */
  clearHistory: () => void;

  /**
   * Export the current session history as a plain-text `.txt` file and trigger
   * a browser download.
   *
   * Format of the downloaded file:
   * ```
   * === Asistente de IA — Sesión 2026-06-07T... ===
   * [14:32] ✅ Repositorio "mi-repo" creado correctamente · mi-repo
   * [14:33] ❌ Archivo README.md no encontrado · otro-repo
   * ```
   *
   * The download uses `URL.createObjectURL()` on a Blob, which works in all
   * modern browsers without any server interaction.
   */
  exportLog: () => void;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

/**
 * HistoryProvider — provides session-scoped action history to the component tree.
 * History is reset to empty on every page load (intentional — see file header).
 */
export function HistoryProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const { t } = useLanguage();

  const addEntry = useCallback((entry: Omit<HistoryEntry, 'id' | 'timestamp'>): string => {
    const id = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newEntry: HistoryEntry = { ...entry, id, timestamp: new Date() };
    setEntries(prev => [...prev, newEntry]);
    return id;
  }, []);

  const updateEntry = useCallback((id: string, update: Partial<HistoryEntry>) => {
    setEntries(prev => prev.map(e => (e.id === id ? { ...e, ...update } : e)));
  }, []);

  const clearHistory = useCallback(() => setEntries([]), []);

  const exportLog = useCallback(() => {
    const now = new Date();
    const header = t('history.logHeader', { date: now.toISOString() });

    // Map each entry to a formatted log line: [HH:MM] emoji description · repo
    const lines = entries.map(entry => {
      const hh = entry.timestamp.getHours().toString().padStart(2, '0');
      const mm = entry.timestamp.getMinutes().toString().padStart(2, '0');
      const emoji: Record<HistoryStatus, string> = {
        completed: '✅',
        error: '❌',
        cancelled: '⏸️',
        pending: '⏳',
      };
      const repoSuffix = entry.repo ? ` · ${entry.repo}` : '';
      return `[${hh}:${mm}] ${emoji[entry.status]} ${entry.description}${repoSuffix}`;
    });

    const content = [header, ...lines].join('\n');

    // Trigger browser download without any server interaction
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    link.href = url;
    link.download = t('history.logFilename', { date: dateStr });
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // free memory immediately after download is triggered
  }, [entries, t]);

  return (
    <HistoryContext.Provider value={{ entries, addEntry, updateEntry, clearHistory, exportLog }}>
      {children}
    </HistoryContext.Provider>
  );
}

/**
 * Hook to consume the HistoryContext.
 * Must be used inside a `<HistoryProvider>`.
 * @throws Error if called outside of HistoryProvider
 */
export function useHistory(): HistoryContextValue {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistory must be used inside HistoryProvider');
  return ctx;
}
