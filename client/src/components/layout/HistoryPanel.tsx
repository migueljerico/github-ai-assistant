import { useEffect, useRef } from 'react';
import { useHistory } from '../../context/HistoryContext';
import type { HistoryStatus } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

const STATUS_EMOJI: Record<HistoryStatus, string> = {
  completed: '✅',
  error: '❌',
  cancelled: '⏸️',
  pending: '⏳',
};

export default function HistoryPanel({ isOpen }: { isOpen: boolean }) {
  const { t } = useLanguage();
  const { entries, clearHistory, exportLog } = useHistory();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new entry
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  return (
    <aside className={`history-panel ${isOpen ? '' : 'collapsed'}`} aria-label={t('history.ariaLabel')}>
      <div className="sidebar-header">
        <span className="sidebar-title">📜 {t('history.title')}</span>
        {entries.length > 0 && (
          <button
            id="clear-history-btn"
            className="btn btn-ghost btn-sm"
            onClick={clearHistory}
            title={t('history.clearTitle')}
          >
            🗑️
          </button>
        )}
      </div>

      <div className="history-list">
        {entries.length === 0 ? (
          <div className="history-empty">
            <span className="history-empty-icon">📋</span>
            <span>{t('history.empty')}</span>
          </div>
        ) : (
          entries.map(entry => {
            const hh = entry.timestamp.getHours().toString().padStart(2, '0');
            const mm = entry.timestamp.getMinutes().toString().padStart(2, '0');
            return (
              <div key={entry.id} className={`history-entry ${entry.status}`}>
                <div className="history-entry-time">[{hh}:{mm}]</div>
                <div className="history-entry-desc">
                  {STATUS_EMOJI[entry.status]} {entry.description}
                </div>
                {entry.repo && (
                  <div className="history-entry-repo">📁 {entry.repo}</div>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="history-footer">
        <button
          id="export-log-btn"
          className="btn btn-secondary btn-sm"
          onClick={exportLog}
          disabled={entries.length === 0}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          ⬇️ {t('history.exportLog')}
        </button>
      </div>
    </aside>
  );
}
