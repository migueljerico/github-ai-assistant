import { useRef, useEffect, useState } from 'react';
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
import SecurityAuditButton from './SecurityAuditButton';

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
  // #57 - Abrir el flujo único de documentación (stepper). Admite un repo inicial
  // opcional (#57 Tanda B: botón "Actualizar documentación" sobre repoContext).
  onOpenDocumentFlow: (initialRepo?: string) => void;
  // #32 - Resumir hilo de comentarios de un issue/PR
  onSummarizeThread: (input: string) => void;
  // #34 - Generar changelog del repo
  onGenerateChangelog: (input: string) => void;
  // #44 - Dashboard "Salud del código"
  onCodeHealth: (input: string) => void;
  // #52 - Modo Auditoría de Seguridad (lectura-only, lanza runSecurityAudit).
  // Opcional para retrocompatibilidad con tests que renderizan ChatInput parcialmente.
  onOpenSecurityAudit?: (initialRepo?: string) => void;
  // #46 - Exportar/importar la conversación (Zero-Storage)
  onExportConversation: () => void;
  onImportConversation: (file: File) => void;
  hasMessages: boolean;
  // #41 - Contexto de repo para opiniones fundamentadas
  repoContextName: string | null;
  onLoadRepoContext: (repoName: string) => void;
  onClearRepoContext: () => void;
  // #28 - Adjuntar archivos locales como contexto (#57 Tanda B: multi-archivo)
  fileContextNames: string[];
  onAttachFiles: (files: File[]) => void;
  onClearFileAt: (index: number) => void;
  onClearAllFiles: () => void;
  // 🔥 OPCIÓN D - Props para el selector de modo (opcionales para retrocompatibilidad)
  modeOverride?: 'auto' | 'chat' | 'action' | 'review';
  onModeOverrideChange?: (mode: 'auto' | 'chat' | 'action' | 'review') => void;
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
  onOpenDocumentFlow,
  onSummarizeThread,
  onGenerateChangelog,
  onCodeHealth,
  onOpenSecurityAudit,
  onExportConversation,
  onImportConversation,
  hasMessages,
  repoContextName,
  onLoadRepoContext,
  onClearRepoContext,
  fileContextNames,
  onAttachFiles,
  onClearFileAt,
  onClearAllFiles, // eslint-disable-line @typescript-eslint/no-unused-vars
  modeOverride = 'auto',
  onModeOverrideChange,
}: ChatInputProps) {
  const { t } = useLanguage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // v3.56.0: toggle de la guía completa de modos (botón [?] del selector).
  const [showModesGuide, setShowModesGuide] = useState(false);

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

  const handleModeChange = (newMode: 'auto' | 'chat' | 'action' | 'review') => {
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
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', fontSize: '0.85rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {(['auto', 'chat', 'action', 'review'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleModeChange(mode)}
                disabled={disabled}
                title={t(`chat.modeTip.${mode}`)}
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
                {mode === 'auto' ? `🤖 ${t('chat.mode.auto')}` : mode === 'chat' ? `💬 ${t('chat.mode.chat')}` : mode === 'review' ? `📋 ${t('modal.review.title')}` : `⚡ ${t('chat.mode.action')}`}
              </button>
            ))}
            {/* v3.56.0: botón [?] que despliega la guía completa de los 4 modos. */}
            <button
              type="button"
              onClick={() => setShowModesGuide(v => !v)}
              disabled={disabled}
              title={t('chat.modesGuide.toggle')}
              aria-label={t('chat.modesGuide.toggle')}
              aria-expanded={showModesGuide}
              style={{
                padding: '6px 10px',
                borderRadius: '16px',
                border: '1px solid var(--border-color, #ccc)',
                background: 'transparent',
                color: 'var(--text-color, #333)',
                cursor: 'pointer',
                opacity: disabled ? 0.5 : 1,
                fontWeight: 'bold',
                transition: 'all 0.2s ease',
              }}
            >
              {showModesGuide ? '✕' : '?'}
            </button>
          </div>
          {/* Línea de ayuda dinámica: explica el modo ACTIVO en una sola línea. */}
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #666)', marginBottom: showModesGuide ? '8px' : '0' }}>
            {t(`chat.modeHelp.${modeOverride}`)}
          </div>
          {/* Guía completa (colapsable): qué hace cada modo y cuándo usarlo. */}
          {showModesGuide && (
            <div style={{
              background: 'var(--bg-elevated, #f6f8fa)',
              border: '1px solid var(--border-color, #ccc)',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '8px',
              fontSize: '0.8rem',
              lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 700, marginBottom: '6px' }}>{t('chat.modesGuide.title')}</div>
              <ul style={{ margin: 0, paddingLeft: '18px' }}>
                <li style={{ marginBottom: '4px' }}>{t('chat.modesGuide.auto')}</li>
                <li style={{ marginBottom: '4px' }}>{t('chat.modesGuide.chat')}</li>
                <li style={{ marginBottom: '4px' }}>{t('chat.modesGuide.action')}</li>
                <li>{t('chat.modesGuide.review')}</li>
              </ul>
            </div>
          )}
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
          onOpen={onOpenDocumentFlow}
        />

        {/* v3.31.0: botón "Actualizar documentación" siempre visible. Si hay un repo
            cargado en contexto, abre el stepper con ese repo pre-rellenado; si no,
            abre en el paso 2 para que el usuario introduzca el repo a actualizar. */}
        <button
          id="update-docs-btn"
          className="doc-repo-btn"
          disabled={disabled}
          type="button"
          title={repoContextName ?? t('chat.updateDocs')}
          onClick={() => onOpenDocumentFlow(repoContextName ?? undefined)}
        >
          🔄 {t('chat.updateDocs')}
        </button>

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

        {/* #52: Modo Auditoría de Seguridad — revisión orientativa de secrets,
            dependencias y validación de inputs. Sobre el repo activo si lo hay.
            onOpen es opcional en la interfaz; si no se pasa (tests), no se renderiza. */}
        {onOpenSecurityAudit && (
          <SecurityAuditButton
            disabled={disabled}
            onOpen={onOpenSecurityAudit}
            repoContextName={repoContextName}
          />
        )}

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
          fileNames={fileContextNames}
          onAttach={onAttachFiles}
          onClearAt={onClearFileAt}
        />
      </div>
    </div>
  );
}
