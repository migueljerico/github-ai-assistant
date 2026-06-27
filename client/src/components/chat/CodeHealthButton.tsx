import { useState } from 'react';

interface CodeHealthButtonProps {
  disabled: boolean;
  onCodeHealth: (repoName: string) => void;
}

// #44 — Botón "Salud del código": pide un repo y abre el dashboard visual.
export default function CodeHealthButton({ disabled, onCodeHealth }: CodeHealthButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [repoName, setRepoName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (repoName.trim()) {
      onCodeHealth(repoName.trim());
      setRepoName('');
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        id="code-health-btn"
        className="doc-repo-btn"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        type="button"
      >
        📊 Salud del código
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <input
        id="code-health-input"
        autoFocus
        type="text"
        className="input"
        placeholder="nombre-del-repo o owner/repo"
        value={repoName}
        onChange={e => setRepoName(e.target.value)}
        style={{ fontSize: '0.8rem', padding: '6px 10px', minWidth: '200px' }}
      />
      <button
        id="code-health-submit-btn"
        type="submit"
        className="btn btn-sm"
        style={{ background: 'var(--gradient)', color: 'white', border: 'none' }}
        disabled={!repoName.trim()}
      >
        ✓
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setIsOpen(false)}
      >
        ✕
      </button>
    </form>
  );
}
