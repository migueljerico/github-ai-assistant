import { useState } from 'react';
import type { PendingAction } from '../../types';
import DiffViewer from './DiffViewer';
import { useModalDialog } from '../../hooks/useModalDialog';
import { useLanguage } from '../../context/LanguageContext';

interface ConfirmModalProps {
  pendingAction: PendingAction;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting: boolean;
}

export default function ConfirmModal({
  pendingAction,
  onConfirm,
  onCancel,
  isExecuting,
}: ConfirmModalProps) {
  const { t } = useLanguage();
  const { action, targetRepos } = pendingAction;
  const [activeRepoIndex, setActiveRepoIndex] = useState(0);
  const isMulti = targetRepos.length > 1;
  const modalRef = useModalDialog<HTMLDivElement>(onCancel);

  const hasDiff = !!action.contenidoActual && !!action.contenidoPropuesto;
  const isNewFile = !action.contenidoActual && !!action.contenidoPropuesto;

  const typeEmojis: Record<string, string> = {
    lectura: '📖', escritura: '✏️', creacion: '✨', listado: '📋',
  };

  // Etiquetas del resumen de la acción: cada item lleva su clave de traducción
  // directamente (labelKey), en vez de mapear un literal español → t(key).
  const summaryRows = [
    { labelKey: 'modal.confirm.labelType', value: action.tipo, mono: false },
    { labelKey: 'modal.confirm.labelMethod', value: action.metodo, mono: false },
    { labelKey: 'modal.confirm.labelEndpoint', value: action.endpoint, mono: true },
    action.repo ? { labelKey: 'modal.confirm.labelRepo', value: action.repo, mono: false } : null,
    action.archivo ? { labelKey: 'modal.confirm.labelFile', value: action.archivo, mono: false } : null,
  ].filter((r): r is { labelKey: string; value: string; mono: boolean } => r !== null);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t('modal.confirm.ariaLabel')}>
      <div className="modal" ref={modalRef}>
        {/* Header */}
        <div className="modal-header">
          <span className="modal-icon">{typeEmojis[action.tipo] ?? '🤖'}</span>
          <div>
            <div className="modal-title">{t('modal.confirm.title')}</div>
            <div className="modal-subtitle">{action.accion}</div>
          </div>
          <button
            id="modal-close-btn"
            className="btn btn-ghost btn-icon"
            onClick={onCancel}
            style={{ marginLeft: 'auto', flexShrink: 0 }}
            aria-label={t('modal.confirm.ariaClose')}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Action summary */}
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
            marginBottom: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '10px',
          }}>
            {summaryRows.map(row => (
              <div key={row.labelKey}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                  {t(row.labelKey)}
                </div>
                <div style={{ fontSize: '0.85rem', fontFamily: row.mono ? 'var(--font-mono)' : 'inherit', wordBreak: 'break-all' }}>
                  {row.value}
                </div>
              </div>
            ))}
          </div>

          {/* Multi-repo tabs */}
          {isMulti && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                {t(targetRepos.length !== 1 ? 'modal.confirm.multiRepoTextPlural' : 'modal.confirm.multiRepoText', { count: targetRepos.length })}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {targetRepos.map((repo, i) => (
                  <button
                    key={repo.id}
                    id={`repo-preview-tab-${i}`}
                    className={`btn btn-sm ${activeRepoIndex === i ? 'btn-secondary' : 'btn-ghost'}`}
                    onClick={() => setActiveRepoIndex(i)}
                    style={activeRepoIndex === i ? { borderColor: 'var(--accent-cyan)' } : {}}
                  >
                    {repo.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Diff or preview */}
          {hasDiff && (
            <DiffViewer
              filename={action.archivo ?? t('modal.confirm.defaultFile')}
              oldContent={action.contenidoActual ?? ''}
              newContent={action.contenidoPropuesto ?? ''}
            />
          )}

          {isNewFile && (
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                {t('modal.confirm.newFileContent')}
              </div>
              <pre style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderLeft: '3px solid var(--success)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                maxHeight: '350px',
                overflow: 'auto',
                fontSize: '0.78rem',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: 'var(--text-primary)',
              }}>
                {action.contenidoPropuesto}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            id="cancel-action-btn"
            className="btn btn-danger"
            onClick={onCancel}
            disabled={isExecuting}
          >
            {t('modal.confirm.cancel')}
          </button>
          <button
            id="confirm-action-btn"
            className="btn btn-success"
            onClick={onConfirm}
            disabled={isExecuting}
          >
            {isExecuting ? (
              <><span className="spinner spinner-sm" /> {t('modal.confirm.confirmExecute')}...</>
            ) : (
              t(isMulti ? 'modal.confirm.confirmExecuteMulti' : 'modal.confirm.confirmExecute', { count: targetRepos.length })
            )}
          </button>
        </div>
      </div>
    </div>
  );
}