import { useState, useEffect } from 'react';
import type { PendingAction } from '../../types';
import DiffViewer from './DiffViewer';
import { useModalDialog } from '../../hooks/useModalDialog';
import { useLanguage } from '../../context/LanguageContext';

export interface ChangeReviewModalProps {
  actions: PendingAction[];
  onAccept: (index: number) => void;
  onReject: (index: number) => void;
  /**
   * Se invoca al pulsar "Aplicar aceptados". Recibe los ÍNDICES (en `actions`) que el
   * usuario marcó como aceptados, para que App.tsx ejecute solo esos y deje los
   * rechazados sin tocar. Antes de v3.56.0 era un stub que no hacía nada.
   */
  onApplyAccepted: (acceptedIndices: number[]) => void;
  onClear: () => void;
  onCancel: () => void;
  isExecuting: boolean;
  executionProgress?: { done: number; total: number; current: string };
}

export default function ChangeReviewModal({
  actions,
  onAccept,
  onReject,
  onApplyAccepted,
  onClear,
  onCancel,
  isExecuting,
  executionProgress,
}: ChangeReviewModalProps) {
  const { t } = useLanguage();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [accepted, setAccepted] = useState<boolean[]>(() => actions.map(() => true));
  const modalRef = useModalDialog<HTMLDivElement>(onCancel);

  const selected = selectedIndex !== null ? actions[selectedIndex] : null;
  const acceptedCount = accepted.filter(Boolean).length;

  // Sincronizar accepted[] cuando cambia el número de acciones
  useEffect(() => {
    setAccepted(prev => {
      if (prev.length === actions.length) return prev;
      return actions.map((_, i) => prev[i] ?? true);
    });
  }, [actions.length, actions]);

  const handleAccept = (index: number) => {
    setAccepted(prev => { const n = [...prev]; n[index] = true; return n; });
    onAccept(index);
  };

  const handleReject = (index: number) => {
    setAccepted(prev => { const n = [...prev]; n[index] = false; return n; });
    onReject(index);
  };

  const typeEmojis: Record<string, string> = {
    lectura: '📖', escritura: '✏️', creacion: '✨', listado: '📋', borrado: '🗑️',
  };

  const selectedAction = selected?.action;
  const hasDiff = !!selectedAction?.contenidoActual && !!selectedAction?.contenidoPropuesto;
  const isNewFile = !selectedAction?.contenidoActual && !!selectedAction?.contenidoPropuesto;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t('modal.review.ariaLabel')}>
      <div className="modal" ref={modalRef} style={{ maxWidth: '900px', width: '95vw' }}>
        {/* Header */}
        <div className="modal-header">
          <span className="modal-icon">📋</span>
          <div>
            <div className="modal-title">{t('modal.review.title')}</div>
            <div className="modal-subtitle">
              {acceptedCount} {t('modal.review.of')} {actions.length} {t('modal.review.selected')}
            </div>
          </div>
          <button
            id="review-close-btn"
            className="btn btn-ghost btn-icon"
            onClick={onCancel}
            style={{ marginLeft: 'auto', flexShrink: 0 }}
            aria-label={t('modal.confirm.ariaClose')}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ display: 'flex', gap: '16px', minHeight: '400px' }}>
          {/* Left: lista de acciones */}
          <div style={{ flex: '0 0 35%', overflowY: 'auto', borderRight: '1px solid var(--border)', paddingRight: '16px' }}>
            {actions.map((pa, i) => {
              const isSelected = selectedIndex === i;
              const isAccepted = accepted[i];
              return (
                <div
                  key={i}
                  data-testid={`review-item-${i}`}
                  onClick={() => setSelectedIndex(i)}
                  style={{
                    padding: '10px 12px',
                    marginBottom: '6px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--bg-elevated)' : 'transparent',
                    border: `1px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border)'}`,
                    opacity: isAccepted ? 1 : 0.5,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span>{isAccepted ? '✓' : '✗'}</span>
                    <span>{typeEmojis[pa.action.tipo] ?? '🤖'}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pa.action.accion}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {pa.action.metodo} {pa.action.endpoint}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <button
                      data-testid={`review-accept-${i}`}
                      className="btn btn-sm btn-ghost"
                      onClick={(e) => { e.stopPropagation(); handleAccept(i); }}
                      style={{ color: isAccepted ? 'var(--success)' : 'var(--text-muted)', fontSize: '0.75rem' }}
                    >
                      ✓ {t('modal.review.accepted')}
                    </button>
                    <button
                      data-testid={`review-reject-${i}`}
                      className="btn btn-sm btn-ghost"
                      onClick={(e) => { e.stopPropagation(); handleReject(i); }}
                      style={{ color: !isAccepted ? 'var(--danger)' : 'var(--text-muted)', fontSize: '0.75rem' }}
                    >
                      ✗ {t('modal.review.rejected')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: diff/preview del seleccionado */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {selected ? (
              <>
                {/* Resumen de la acción seleccionada */}
                <div style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  marginBottom: '12px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '8px',
                }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('modal.confirm.labelType')}</div>
                    <div style={{ fontSize: '0.85rem' }}>{selected.action.tipo}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('modal.confirm.labelMethod')}</div>
                    <div style={{ fontSize: '0.85rem' }}>{selected.action.metodo}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('modal.confirm.labelEndpoint')}</div>
                    <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{selected.action.endpoint}</div>
                  </div>
                  {selected.action.archivo && (
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('modal.confirm.labelFile')}</div>
                      <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>{selected.action.archivo}</div>
                    </div>
                  )}
                </div>

                {/* Diff o preview */}
                {hasDiff && (
                  <DiffViewer
                    filename={selected.action.archivo ?? t('modal.confirm.defaultFile')}
                    oldContent={selected.action.contenidoActual ?? ''}
                    newContent={selected.action.contenidoPropuesto ?? ''}
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
                    }}>
                      {selected.action.contenidoPropuesto}
                    </pre>
                  </div>
                )}
                {!hasDiff && !isNewFile && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '40px 0' }}>
                    {t('modal.review.noPreview')}
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '40px 0' }}>
                {t('modal.review.selectItem')}
              </div>
            )}
          </div>
        </div>

        {/* Execution progress */}
        {isExecuting && executionProgress && (
          <div style={{ padding: '0 20px 8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {t('modal.review.applying')} {executionProgress.done}/{executionProgress.total} — {executionProgress.current}
          </div>
        )}

        {/* Footer */}
        <div className="modal-footer">
          <button
            data-testid="review-clear-btn"
            className="btn btn-ghost"
            onClick={onClear}
            disabled={isExecuting}
          >
            {t('modal.review.clearAll')}
          </button>
          <button
            data-testid="review-cancel-btn"
            className="btn btn-danger"
            onClick={onCancel}
            disabled={isExecuting}
          >
            {t('modal.confirm.cancel')}
          </button>
          <button
            data-testid="review-apply-btn"
            className="btn btn-success"
            onClick={() => onApplyAccepted(accepted.map((a, i) => a ? i : -1).filter(i => i >= 0))}
            disabled={isExecuting || acceptedCount === 0}
          >
            {isExecuting ? (
              <><span className="spinner spinner-sm" /> {t('modal.review.applying')}...</>
            ) : (
              `${t('modal.review.applyAccepted')} (${acceptedCount})`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
