import { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function UserBadge() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  if (!user) return null;

  return (
    <div style={{ position: 'relative' }}>
      <button
        id="user-badge-btn"
        className="user-badge"
        onClick={() => setMenuOpen(v => !v)}
        aria-haspopup="true"
        aria-expanded={menuOpen}
      >
        <img src={user.avatar_url} alt={user.login} />
        <span className="user-badge-name">{user.login}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>▾</span>
      </button>

      {menuOpen && (
        <>
          {/* Click-outside backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 98 }}
            onClick={() => setMenuOpen(false)}
          />
          <div
            ref={menuRef}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '8px',
              minWidth: '200px',
              zIndex: 99,
              boxShadow: 'var(--shadow-lg)',
              animation: 'slideUp 0.15s ease',
            }}
          >
            <div style={{ padding: '8px 10px 12px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '6px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user.login}</div>
              {user.name && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{user.name}</div>}
            </div>
            <a
              href={user.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm"
              style={{ width: '100%', textDecoration: 'none' }}
              onClick={() => setMenuOpen(false)}
            >
              🐙 Ver perfil en GitHub
            </a>
            <button
              id="logout-btn"
              className="btn btn-ghost btn-sm"
              style={{ width: '100%', color: 'var(--error)' }}
              onClick={() => { logout(); setMenuOpen(false); }}
            >
              🚪 Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  );
}
