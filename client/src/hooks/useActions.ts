/**
 * useActions — Custom Hook for Action Management
 * 
 * Encapsulates all action-related state and logic:
 * - Pending action management (confirmation modal)
 * - Action execution state
 * - Multi-repo handling
 * - Session history logging
 */

import { useState, useCallback } from 'react';
import type { GeminiAction, GitHubRepo, PendingAction } from '../types';
import { useHistory } from '../context/HistoryContext';

export interface UseActionsState {
  pendingAction: PendingAction | null;
  isExecuting: boolean;
  selectedRepos: GitHubRepo[];
  multiRepoEnabled: boolean;
}

export interface UseActionsActions {
  setPendingAction: (action: PendingAction | null) => void;
  setIsExecuting: (executing: boolean) => void;
  setSelectedRepos: (repos: GitHubRepo[]) => void;
  setMultiRepoEnabled: (enabled: boolean) => void;
  logAction: (status: 'pending' | 'completed' | 'error', description: string, repo?: string) => string;
  updateActionLog: (id: string, status: 'pending' | 'completed' | 'error', description: string) => void;
  clearPendingAction: () => void;
}

export function useActions(): UseActionsState & UseActionsActions {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState<GitHubRepo[]>([]);
  const [multiRepoEnabled, setMultiRepoEnabled] = useState(false);
  
  const { addEntry, updateEntry } = useHistory();

  const logAction = useCallback((
    status: 'pending' | 'completed' | 'error',
    description: string,
    repo?: string
  ): string => {
    return addEntry({ status, description, repo: repo || null });
  }, [addEntry]);

  const updateActionLog = useCallback((
    id: string,
    status: 'pending' | 'completed' | 'error',
    description: string
  ) => {
    updateEntry(id, { status, description });
  }, [updateEntry]);

  const clearPendingAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  return {
    // State
    pendingAction,
    isExecuting,
    selectedRepos,
    multiRepoEnabled,
    // Actions
    setPendingAction,
    setIsExecuting,
    setSelectedRepos,
    setMultiRepoEnabled,
    logAction,
    updateActionLog,
    clearPendingAction,
  };
}
