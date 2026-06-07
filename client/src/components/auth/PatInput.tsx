import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function PatInput() {
  const { loginWithPat, isLoading, error } = useAuth();
  const [pat, setPat] = useState('');
  const [showPat, setShowPat] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pat.trim()) {
      await loginWithPat(pat.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ position: 'relative' }}>
        <input
          id="pat-input"
          type={showPat ? 'text' : 'password'}
          className="input"
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          value={pat}
          onChange={e => setPat(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          style={{ paddingRight: '44px', fontFamily: 'var(--font-mono)' }}
        />
        <button
          type="button"
          onClick={() => setShowPat(v => !v)}
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: '1rem',
            padding: '2px',
          }}
          aria-label={showPat ? 'Ocultar token' : 'Mostrar token'}
        >
          {showPat ? '🙈' : '👁️'}
        </button>
      </div>
      {error && (
        <p style={{ color: 'var(--error)', fontSize: '0.8rem' }}>
          ❌ {error}
        </p>
      )}
      <button
        id="pat-submit-btn"
        type="submit"
        className="btn btn-secondary"
        disabled={!pat.trim() || isLoading}
        style={{ justifyContent: 'center' }}
      >
        {isLoading ? <><span className="spinner spinner-sm" /> Verificando...</> : 'Usar token manual'}
      </button>
    </form>
  );
}
