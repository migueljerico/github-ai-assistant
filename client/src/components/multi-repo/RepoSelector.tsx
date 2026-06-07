import { useState, useEffect } from 'react';
import type { GitHubRepo } from '../../types';
import { listAllRepos } from '../../services/github';
import { useAuth } from '../../context/AuthContext';

interface RepoSelectorProps {
  selectedRepos: GitHubRepo[];
  onChange: (repos: GitHubRepo[]) => void;
}

export default function RepoSelector({ selectedRepos, onChange }: RepoSelectorProps) {
  const { token } = useAuth();
  const [allRepos, setAllRepos] = useState<GitHubRepo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingCount, setLoadingCount] = useState(0);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    listAllRepos(token, (count) => setLoadingCount(count))
      .then(repos => {
        setAllRepos(repos);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [token]);

  const filtered = allRepos.filter(r =>
    r.name.toLowerCase().includes(filter.toLowerCase()) ||
    (r.description ?? '').toLowerCase().includes(filter.toLowerCase())
  );

  const toggleRepo = (repo: GitHubRepo) => {
    const already = selectedRepos.some(r => r.id === repo.id);
    onChange(already ? selectedRepos.filter(r => r.id !== repo.id) : [...selectedRepos, repo]);
  };

  const toggleAll = () => {
    if (selectedRepos.length === filtered.length) {
      onChange([]);
    } else {
      onChange(filtered);
    }
  };

  return (
    <div className="repo-selector" role="group" aria-label="Seleccionar repositorios">
      <div className="repo-selector-header">
        <input
          id="repo-filter-input"
          type="text"
          className="input"
          placeholder="Filtrar repositorios..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ padding: '5px 10px', fontSize: '0.8rem' }}
        />
        {isLoading ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
            <span className="spinner spinner-sm" />
            {loadingCount} cargados...
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
            {allRepos.length} repositorios
          </span>
        )}
        <button
          id="toggle-all-repos-btn"
          className="btn btn-ghost btn-sm"
          onClick={toggleAll}
          disabled={isLoading}
          style={{ whiteSpace: 'nowrap' }}
        >
          {selectedRepos.length === filtered.length && filtered.length > 0 ? 'Ninguno' : 'Todos'}
        </button>
      </div>

      <div className="repo-selector-list">
        {filtered.map(repo => {
          const isChecked = selectedRepos.some(r => r.id === repo.id);
          return (
            <label key={repo.id} className="repo-item" htmlFor={`repo-${repo.id}`}>
              <input
                id={`repo-${repo.id}`}
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleRepo(repo)}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="repo-item-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {repo.private ? '🔒' : '📁'} {repo.name}
                </div>
                {repo.description && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {repo.description}
                  </div>
                )}
              </div>
              {repo.language && (
                <span className="repo-item-meta">{repo.language}</span>
              )}
            </label>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No se encontraron repositorios
          </div>
        )}
      </div>

      {selectedRepos.length > 0 && (
        <div style={{ padding: '8px 14px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-subtle)', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
          ✓ {selectedRepos.length} repo{selectedRepos.length !== 1 ? 's' : ''} seleccionado{selectedRepos.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
