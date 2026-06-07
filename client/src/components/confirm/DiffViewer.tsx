import { useEffect, useRef } from 'react';
import * as Diff from 'diff';
import { html as diff2html } from 'diff2html';
import 'diff2html/bundles/css/diff2html.min.css';

interface DiffViewerProps {
  filename: string;
  oldContent: string;
  newContent: string;
}

export default function DiffViewer({ filename, oldContent, newContent }: DiffViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const patch = Diff.createPatch(filename, oldContent, newContent, 'Versión actual', 'Versión propuesta');

    const diffHtml = diff2html(patch, {
      drawFileList: false,
      matching: 'lines',
      outputFormat: 'side-by-side',
      renderNothingWhenEmpty: false,
    });

    containerRef.current.innerHTML = diffHtml;
  }, [filename, oldContent, newContent]);

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '8px',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
      }}>
        <span>📄 {filename}</span>
        <div style={{ display: 'flex', gap: '16px' }}>
          <span style={{ color: 'var(--error)' }}>● Eliminado</span>
          <span style={{ color: 'var(--success)' }}>● Añadido</span>
        </div>
      </div>
      <div className="diff-wrapper" ref={containerRef} />
    </div>
  );
}
