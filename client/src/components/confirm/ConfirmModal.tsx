import { useState } from 'react';
import type { PendingAction } from '../../types';
import DiffViewer from './DiffViewer';

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
  const { action, targetRepos } = pendingAction;
  const [activeRepoIndex, setActiveRepoIndex] = useState(0);
  const isMulti = targetRepos.length > 1;

  const hasDiff = !!action.contenidoActual && !!action.contenidoPropuesto;
  const isNewFile = !action.contenidoActual && !!action.contenidoPropuesto;

  const typeEmojis: Record<string, string> = {
    lectura: '📖', escritura: '✏️', creacion: '✨', listado: '📋',
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Confirmar acción">
      <div className="modal">
        {/* Header */}
        <div className="modal-header">
          <span className="modal-icon">{typeEmojis[action.tipo] ?? '🤖'}</span>
          <div>
            <div className="modal-title">Esto es lo que voy a hacer</div>
            <div className="modal-subtitle">{action.accion}</div>
          </div>
          <button
            id="modal-close-btn"
            className="btn btn-ghost btn-icon"
            onClick={onCancel}
            style={{ marginLeft: 'auto', flexShrink: 0 }}
            aria-label="Cerrar modal"
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
            {[
              { label: 'Tipo', value: action.tipo },
              { label: 'Método', value: action.metodo },
              { label: 'Endpoint', value: action.endpoint },
              action.repo ? { label: 'Repositorio', value: action.repo } : null,
              action.archivo ? { label: 'Archivo', value: action.archivo } : null,
            ].filter(Boolean).map(item => (
              <div key={item!.label}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                  {item!.label}
                </div>
                <div style={{ fontSize: '0.85rem', fontFamily: item!.label === 'Endpoint' ? 'var(--font-mono)' : 'inherit', wordBreak: 'break-all' }}>
                  {item!.value}
                </div>
              </div>
            ))}
          </div>

          {/* Multi-repo tabs */}
          {isMulti && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Esta acción se aplicará a {targetRepos.length} repositorios:
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
              filename={action.archivo ?? 'archivo'}
              oldContent={action.contenidoActual ?? ''}
              newContent={action.contenidoPropuesto ?? ''}
            />
          )}

          {isNewFile && (
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                📄 Contenido del nuevo archivo:
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
            ❌ Cancelar
          </button>
          <button
            id="confirm-action-btn"
            className="btn btn-success"
            onClick={onConfirm}
            disabled={isExecuting}
          >
            {isExecuting ? (
              <><span className="spinner spinner-sm" /> Ejecutando...</>
            ) : (
              `✅ Confirmar y ejecutar${isMulti ? ` (${targetRepos.length} repos)` : ''}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
