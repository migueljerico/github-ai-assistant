import { lazy, Suspense } from 'react';
import type { CodeHealth } from '../../services/assistantActions';
import { useModalDialog } from '../../hooks/useModalDialog';

// Las gráficas (Recharts) se cargan en su propio chunk: el shell del modal no
// arrastra Recharts al bundle inicial.
const CodeHealthCharts = lazy(() => import('./CodeHealthCharts'));

interface CodeHealthModalProps {
  data: CodeHealth;
  onClose: () => void;
}

// #44 — Dashboard "Salud del Código": panel visual (lenguajes, commits, deuda).
export default function CodeHealthModal({ data, onClose }: CodeHealthModalProps) {
  const modalRef = useModalDialog<HTMLDivElement>(onClose);
  const mainLang = data.languages[0]?.language ?? '—';

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="code-health-title">
      <div className="modal doc-repo-modal" ref={modalRef}>
        <div className="modal-header">
          <span className="modal-icon">📊</span>
          <div>
            <div className="modal-title" id="code-health-title">Salud del código — {data.repoName}</div>
            <div className="modal-subtitle">
              Lenguaje principal: <strong>{mainLang}</strong> · {data.filesAnalyzed} archivo{data.filesAnalyzed !== 1 ? 's' : ''} analizado{data.filesAnalyzed !== 1 ? 's' : ''} · {data.debt.total} marcador{data.debt.total !== 1 ? 'es' : ''} de deuda
              {data.truncated && (
                <>
                  <br />
                  <small style={{ opacity: 0.7 }}>⚠️ Repo grande — la deuda técnica se calcula sobre una muestra de los archivos.</small>
                </>
              )}
            </div>
          </div>
          <button id="code-health-close-btn" className="btn btn-ghost btn-icon" onClick={onClose} style={{ marginLeft: 'auto' }}>✕</button>
        </div>

        <div className="modal-body">
          <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><span className="spinner spinner-lg" /></div>}>
            <CodeHealthCharts data={data} />
          </Suspense>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
