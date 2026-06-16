import { useRef, useEffect, useState } from 'react';
import type { GitHubRepo } from '../../types';
import MultiRepoSelector from '../multi-repo/RepoSelector';
import DocumentRepoButton from './DocumentRepoButton';

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
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="chat-input-area">
      {multiRepoEnabled && (
        <MultiRepoSelector
          selectedRepos={selectedRepos}
          onChange={onSelectedReposChange}
        />
      )}

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
          <textarea
            id="chat-textarea"
            ref={textareaRef}
            className="chat-textarea"
            placeholder={disabled ? 'Conecta con GitHub para empezar…' : 'Escribe una instrucción… (Enter para enviar, Shift+Enter para nueva línea)'}
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
