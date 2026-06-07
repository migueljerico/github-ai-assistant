import { useAuth } from '../../context/AuthContext';
import UserBadge from '../auth/UserBadge';
import AIProviderBadge from './AIProviderBadge';

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

  return (
    <header className="header">
      <div className="header-logo">
        <div className="header-logo-icon">🤖</div>
        <div className="header-title">
          Asistente de IA para Publicar Repositorios
          <span>Powered by Google Gemini + GitHub API</span>
        </div>
      </div>

      <div className="header-right">
        {/* AI provider badge */}
        <AIProviderBadge />

        {/* GitHub connection status badge */}
        <div className={`badge ${isAuthenticated ? 'badge-connected' : 'badge-disconnected'}`}>
          <span className="badge-dot" />
          {isAuthenticated ? 'Conectado' : 'Sin conectar'}
        </div>

        {/* Sidebar toggles */}
        <button
          id="toggle-templates-btn"
          className="btn btn-ghost btn-sm"
          onClick={onToggleTemplates}
          title={templatesOpen ? 'Ocultar plantillas' : 'Mostrar plantillas'}
          aria-pressed={templatesOpen}
        >
          📋 Plantillas
        </button>
        <button
          id="toggle-history-btn"
          className="btn btn-ghost btn-sm"
          onClick={onToggleHistory}
          title={historyOpen ? 'Ocultar historial' : 'Mostrar historial'}
          aria-pressed={historyOpen}
        >
          📜 Historial
        </button>

        {/* User badge */}
        {isAuthenticated && <UserBadge />}
      </div>
    </header>
  );
}
