import { useRef, useEffect, useState } from 'react';
import type { GitHubRepo } from '../../types';
import type { InstructionTemplate } from '../../utils/instructionSuggestions';
import MultiRepoSelector from '../multi-repo/RepoSelector';
import DocumentRepoButton from './DocumentRepoButton';
import InstructionSuggestions from './InstructionSuggestions';

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
  attachedFile?: File | null;
  onFileAttach?: (file: File | null) => void;
  modeOverride: 'auto' | 'chat' | 'action';
  onModeOverrideChange: (mode: 'auto' | 'chat' | 'action') => void;
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
  attachedFile,
  onFileAttach,
  modeOverride,
  onModeOverrideChange,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

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

  const handleSelectTemplate = (template: InstructionTemplate) => {
    onChange(template.template);
    setSuggestionsOpen(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="chat-input-area">
      {multiRepoEnabled && (
        <MultiRepoSelector
          selectedRepos={selectedRepos}
          onChange={onSelectedReposChange}
        />
      )}

      {/* 🔥 Mode Selector Toggle */}
      <div className="mode-selector" style={{ 
        display: 'flex', 
        gap: '12px', 
        padding: '8px 12px', 
        marginBottom: '8px',
        backgroundColor: 'var(--bg-secondary, #f5f5f5)',
        borderRadius: '6px',
        border: '1px solid var(--border-color, #e0e0e0)',
        fontSize: '13px'
      }}>
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px', 
          cursor: 'pointer',
          fontWeight: modeOverride === 'auto' ? '600' : '400',
          opacity: modeOverride === 'auto' ? '1' : '0.7'
        }}>
          <input
            type="radio"
            name="mode-selector"
            checked={modeOverride === 'auto'}
            onChange={() => onModeOverrideChange('auto')}
            disabled={disabled}
            style={{ margin: 0 }}
          />
          🤖 Auto
        </label>
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px', 
          cursor: 'pointer',
          fontWeight: modeOverride === 'chat' ? '600' : '400',
          opacity: modeOverride === 'chat' ? '1' : '0.7'
        }}>
          <input
            type="radio"
            name="mode-selector"
            checked={modeOverride === 'chat'}
            onChange={() => onModeOverrideChange('chat')}
            disabled={disabled}
            style={{ margin: 0 }}
          />
          💬 Opinión
        </label>
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px', 
          cursor: 'pointer',
          fontWeight: modeOverride === 'action' ? '600' : '400',
          opacity: modeOverride === 'action' ? '1' : '0.7'
        }}>
          <input
            type="radio"
            name="mode-selector"
            checked={modeOverride === 'action'}
            onChange={() => onModeOverrideChange('action')}
            disabled={disabled}
            style={{ margin: 0 }}
          />
          ⚙️ Acción
        </label>
      </div>

      {/* File Attached Indicator */}
      {attachedFile && (
        <div className="file-attached-indicator">
          <span>📎 Archivo adjunto: <strong>{attachedFile.name}</strong> ({(attachedFile.size / 1024).toFixed(2)} KB)</span>
          <button
            onClick={() => onFileAttach?.(null)}
            disabled={disabled}
            className="remove-file-btn"
            title="Eliminar archivo"
          >
            ✕
          </button>
        </div>
      )}

      <div className="chat-input-row">
        <div className="chat-textarea-wrap">
          {/* Instruction Suggestions Dropdown */}
          <InstructionSuggestions
            inputValue={value}
            onSelectTemplate={handleSelectTemplate}
            isOpen={suggestionsOpen}
            onOpenChange={setSuggestionsOpen}
          />

          <textarea
            id="chat-textarea"
            ref={textareaRef}
            className="chat-textarea"
            placeholder={disabled ? 'Conecta con GitHub para empezar…' : 'Escribe una instrucción… (Enter para enviar, Shift+Enter para nueva línea)'}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setSuggestionsOpen(true)}
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

        {/* File Upload Input */}
        <div className="file-upload-section">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.pbix,.doc,.docx,.txt,.md,.json,.yaml,.yml"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              onFileAttach?.(file);
            }}
            disabled={disabled}
            style={{ display: 'none' }}
            aria-label="Adjuntar archivo"
          />
          <button
            className="file-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isLoading}
            title="Adjuntar PDF, PBIX o documento"
            aria-label="Adjuntar archivo"
          >
            📎 Adjuntar
          </button>
        </div>

        <DocumentRepoButton
          disabled={disabled}
          onDocumentRepo={onDocumentRepo}
        />
      </div>
    </div>
  );
}
