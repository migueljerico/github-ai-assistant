import { useEffect, useRef } from 'react';
import * as Diff from 'diff';
import { html as diff2html } from 'diff2html';
import 'diff2html/bundles/css/diff2html.min.css';
import { useLanguage } from '../../context/LanguageContext';

interface DiffViewerProps {
  filename: string;
  oldContent: string;
  newContent: string;
}

export default function DiffViewer({ filename, oldContent, newContent }: DiffViewerProps) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);

  const currentVersion = t('diff.currentVersion');
  const proposedVersion = t('diff.proposedVersion');

  useEffect(() => {
    if (!containerRef.current) return;

    const patch = Diff.createPatch(filename, oldContent, newContent, currentVersion, proposedVersion);

    const diffHtml = diff2html(patch, {
      drawFileList: false,
      matching: 'lines',
      outputFormat: 'side-by-side',
      renderNothingWhenEmpty: false,
    });

    containerRef.current.innerHTML = diffHtml;
  }, [filename, oldContent, newContent, currentVersion, proposedVersion]);

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
          <span style={{ color: 'var(--error)' }}>{t('diff.removed')}</span>
          <span style={{ color: 'var(--success)' }}>{t('diff.added')}</span>
        </div>
      </div>
      <div className="diff-wrapper" ref={containerRef} />
    </div>
  );
}
