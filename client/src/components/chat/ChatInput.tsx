import { useRef, useEffect } from 'react';
import type { GitHubRepo } from '../../types';
import MultiRepoSelector from '../multi-repo/RepoSelector';
import DocumentRepoButton from './DocumentRepoButton';
import RepoContextButton from './RepoContextButton';

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  isLoading: boolean;
  disabled: boolean;
  multiRepoEnabled: boolean;
  onMultiRepoChange: (enabled: boolean) => void;
  selectedRepos: GitHubRepo[];
  onSelectedReposChange: (repos: GitHubRepo[]) => void;
  onDocumentRepo: (repoName: string) => void;
  // #41 - Contexto de repo para opiniones fundamentadas
  repoContextName: string | null;
  onLoadRepoContext: (repoName: string) => void;
  onClearRepoContext: () => void;
  // 🔥 OPCIÓN D - Props para el selector de modo (opcionales para retrocompatibilidad)
  modeOverride?: 'auto' | 'chat' | 'action';
  onModeOverrideChange?: (mode: 'auto' | 'chat' | 'action') => void;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  isLoading,
  disabled,
  multiRepoEnabled,
  onMultiRepoChange,
  selectedRepos,
  onSelectedReposChange,
  onDocumentRepo,
  repoContextName,
  onLoadRepoContext,
  onClearRepoContext,
  modeOverride = 'auto',
  onModeOverrideChange,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !isLoading && value.trim()) onSend();
    }
  };

  const handleModeChange = (newMode: 'auto' | 'chat' | 'action') => {
    if (onModeOverrideChange) {
      onModeOverrideChange(newMode);
    }
  };

  const getPlaceholder = () => {
    if (disabled) return 'Conecta con GitHub para empezar…';
    if (modeOverride === 'chat') return 'Pide una opinión, consejo o análisis...';
    if (modeOverride === 'action') return 'Escribe una acción (ej: crea un archivo, lista mis repos)...';
    return 'Escribe una instrucción… (Enter para enviar, Shift+Enter para nueva línea)';
  };

  return (
    <div className="chat-input-area">
      {multiRepoEnabled && (
        <MultiRepoSelector
          selectedRepos={selectedRepos}
          onChange={onSelectedReposChange}
        />
      )}

      {/* 🔥 OPCIÓN D - Selector visual de modo */}
      {onModeOverrideChange && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', fontSize: '0.85rem' }}>
          {(['auto', 'chat', 'action'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleModeChange(mode)}
              disabled={disabled}
              style={{
                padding: '6px 14px',
                borderRadius: '16px',
                border: '1px solid',
                borderColor: modeOverride === mode ? 'var(--primary-color, #007bff)' : 'var(--border-color, #ccc)',
                backgroundColor: modeOverride === mode ? 'var(--primary-color, #007bff)' : 'transparent',
                color: modeOverride === mode ? 'white' : 'var(--text-color, #333)',
                cursor: 'pointer',
                opacity: disabled ? 0.5 : 1,
                fontWeight: modeOverride === mode ? 'bold' : 'normal',
                transition: 'all 0.2s ease',
              }}
            >
              {mode === 'auto' ? '🤖 Auto' : mode === 'chat' ? '💬 Opinión' : '️ Acción'}
            </button>
          ))}
        </div>
      )}

      <div className="chat-input-row">
        <div className="chat-textarea-wrap">
          <textarea
            id="chat-textarea"
            ref={textareaRef}
            className="chat-textarea"
            placeholder={getPlaceholder()}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={2}
            aria-label="Instrucción para el asistente"
          />
        </div>
        <button
          id="send-btn"
          className="send-btn"
          onClick={onSend}
          disabled={disabled || isLoading || !value.trim()}
          aria-label="Enviar instrucción"
        >
          {isLoading ? <span className="spinner spinner-sm" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} /> : '➤'}
        </button>
      </div>

      <div className="chat-input-extras">
        <label className="multi-repo-toggle" htmlFor="multi-repo-checkbox">
          <input
            id="multi-repo-checkbox"
            type="checkbox"
            checked={multiRepoEnabled}
            onChange={e => onMultiRepoChange(e.target.checked)}
            disabled={disabled}
          />
          Aplicar a múltiples repositorios
        </label>

        <DocumentRepoButton
          disabled={disabled}
          onDocumentRepo={onDocumentRepo}
        />

        <RepoContextButton
          disabled={disabled}
          activeContext={repoContextName}
          onLoadContext={onLoadRepoContext}
          onClearContext={onClearRepoContext}
        />
      </div>
    </div>
  );
}
