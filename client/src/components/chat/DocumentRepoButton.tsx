import { useState } from 'react';

interface DocumentRepoButtonProps {
  disabled: boolean;
  onDocumentRepo: (repoName: string) => void;
}

export default function DocumentRepoButton({ disabled, onDocumentRepo }: DocumentRepoButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [repoName, setRepoName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (repoName.trim()) {
      onDocumentRepo(repoName.trim());
      setRepoName('');
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        id="doc-repo-btn"
        className="doc-repo-btn"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        type="button"
      >
        📄 Documentar repo
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <input
        id="doc-repo-input"
        autoFocus
        type="text"
        className="input"
        placeholder="nombre-del-repo o owner/repo"
        value={repoName}
        onChange={e => setRepoName(e.target.value)}
        style={{ fontSize: '0.8rem', padding: '6px 10px', minWidth: '200px' }}
      />
      <button
        id="doc-repo-submit-btn"
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
