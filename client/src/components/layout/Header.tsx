import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import UserBadge from '../auth/UserBadge';
import AIProviderBadge from './AIProviderBadge';
import LanguageSelector from './LanguageSelector';

export default function Header({
  onToggleTemplates,
  onToggleHistory,
  templatesOpen,
  historyOpen,
}: {
  onToggleTemplates: () => void;
  onToggleHistory: () => void;
  templatesOpen: boolean;
  historyOpen: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();

  return (
    <header className="header">
      <div className="header-logo">
        <div className="header-logo-icon">🤖</div>
        <div className="header-title">
          {t('header.title')}
          <span>{t('header.subtitle')}</span>
        </div>
      </div>

      <div className="header-right">
        {/* AI provider badge */}
        <AIProviderBadge />

        {/* GitHub connection status badge */}
        <div className={`badge ${isAuthenticated ? 'badge-connected' : 'badge-disconnected'}`}>
          <span className="badge-dot" />
          <span className="btn-label">{isAuthenticated ? t('header.connected') : t('header.disconnected')}</span>
        </div>

        {/* Sidebar toggles (el texto se oculta en móvil, queda el emoji) */}
        <button
          id="toggle-templates-btn"
          className="btn btn-ghost btn-sm"
          onClick={onToggleTemplates}
          title={templatesOpen ? t('header.hideTemplates') : t('header.showTemplates')}
          aria-pressed={templatesOpen}
        >
          📋 <span className="btn-label">{t('header.templates')}</span>
        </button>
        <button
          id="toggle-history-btn"
          className="btn btn-ghost btn-sm"
          onClick={onToggleHistory}
          title={historyOpen ? t('header.hideHistory') : t('header.showHistory')}
          aria-pressed={historyOpen}
        >
          📜 <span className="btn-label">{t('header.history')}</span>
        </button>

        {/* Selector de idioma */}
        <LanguageSelector />

        {/* User badge */}
        {isAuthenticated && <UserBadge />}
      </div>
    </header>
  );
}
