import { useRef, useEffect } from 'react';
import type { GitHubRepo } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import MultiRepoSelector from '../multi-repo/RepoSelector';
import DocumentRepoButton from './DocumentRepoButton';
import RepoContextButton from './RepoContextButton';
import ThreadSummaryButton from './ThreadSummaryButton';
import ChangelogButton from './ChangelogButton';
import CodeHealthButton from './CodeHealthButton';
import ConversationIOButton from './ConversationIOButton';
import FileAttachButton from './FileAttachButton';

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  // #40 - Cancelar la generación en curso (el botón de enviar pasa a "Detener").
  onStop: () => void;
  isLoading: boolean;
  disabled: boolean;
  multiRepoEnabled: boolean;
  onMultiRepoChange: (enabled: boolean) => void;
  selectedRepos: GitHubRepo[];
  onSelectedReposChange: (repos: GitHubRepo[]) => void;
  onDocumentRepo: (repoName: string) => void;
  // #32 - Resumir hilo de comentarios de un issue/PR
  onSummarizeThread: (input: string) => void;
  // #34 - Generar changelog del repo
  onGenerateChangelog: (input: string) => void;
  // #44 - Dashboard "Salud del código"
  onCodeHealth: (input: string) => void;
  // #46 - Exportar/importar la conversación (Zero-Storage)
  onExportConversation: () => void;
  onImportConversation: (file: File) => void;
  hasMessages: boolean;
  // #41 - Contexto de repo para opiniones fundamentadas
  repoContextName: string | null;
  onLoadRepoContext: (repoName: string) => void;
  onClearRepoContext: () => void;
  // #28 - Adjuntar archivo local como contexto
  fileContextName: string | null;
  onAttachFile: (file: File) => void;
  onClearFile: () => void;
  // #28 Fase 2 - Documentar y publicar el archivo adjunto
  onPublishFile: () => void;
  // 🔥 OPCIÓN D - Props para el selector de modo (opcionales para retrocompatibilidad)
  modeOverride?: 'auto' | 'chat' | 'action';
  onModeOverrideChange?: (mode: 'auto' | 'chat' | 'action') => void;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isLoading,
  disabled,
  multiRepoEnabled,
  onMultiRepoChange,
  selectedRepos,
  onSelectedReposChange,
  onDocumentRepo,
  onSummarizeThread,
  onGenerateChangelog,
  onCodeHealth,
  onExportConversation,
  onImportConversation,
  hasMessages,
  repoContextName,
  onLoadRepoContext,
  onClearRepoContext,
  fileContextName,
  onAttachFile,
  onClearFile,
  onPublishFile,
  modeOverride = 'auto',
  onModeOverrideChange,
}: ChatInputProps) {
  const { t } = useLanguage();
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
    if (disabled) return t('chat.placeholder.disabled');
    if (modeOverride === 'chat') return t('chat.placeholder.chat');
    if (modeOverride === 'action') return t('chat.placeholder.action');
    return t('chat.placeholder.auto');
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
              {mode === 'auto' ? `🤖 ${t('chat.mode.auto')}` : mode === 'chat' ? `💬 ${t('chat.mode.chat')}` : `️ ${t('chat.mode.action')}`}
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
            aria-label={t('chat.ariaLabel')}
          />
        </div>
        <button
          id="send-btn"
          className="send-btn"
          onClick={isLoading ? onStop : onSend}
          disabled={disabled || (!isLoading && !value.trim())}
          aria-label={isLoading ? t('chat.ariaStop') : t('chat.ariaSend')}
          title={isLoading ? t('chat.titleStop') : t('chat.titleSend')}
        >
          {isLoading ? '⏹️' : '➤'}
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
          {t('chat.multiRepo')}
        </label>

        <DocumentRepoButton
          disabled={disabled}
          onDocumentRepo={onDocumentRepo}
        />

        <ThreadSummaryButton
          disabled={disabled}
          onSummarizeThread={onSummarizeThread}
        />

        <ChangelogButton
          disabled={disabled}
          onGenerateChangelog={onGenerateChangelog}
        />

        <CodeHealthButton
          disabled={disabled}
          onCodeHealth={onCodeHealth}
        />

        <ConversationIOButton
          disabled={disabled}
          hasMessages={hasMessages}
          onExport={onExportConversation}
          onImport={onImportConversation}
        />

        <RepoContextButton
          disabled={disabled}
          activeContext={repoContextName}
          onLoadContext={onLoadRepoContext}
          onClearContext={onClearRepoContext}
        />

        <FileAttachButton
          disabled={disabled}
          fileName={fileContextName}
          onAttach={onAttachFile}
          onClear={onClearFile}
        />

        {fileContextName && (
          <button
            id="publish-file-btn"
            className="doc-repo-btn"
            type="button"
            disabled={disabled}
            onClick={onPublishFile}
          >
            📤 {t('chat.publishFile')}
          </button>
        )}
      </div>
    </div>
  );
}
