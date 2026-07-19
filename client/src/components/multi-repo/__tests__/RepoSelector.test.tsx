import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { GitHubRepo } from '../../../types';

// ── Mocks ───────────────────────────────────────────────────────────────────
// El componente consume useAuth (token) y listAllRepos (fetch). Los mockeamos
// para aislar la lógica de UI (filtro, toggle, toggleAll, estados de carga).

vi.mock('../../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../services/github', () => ({
  listAllRepos: vi.fn(),
}));

import RepoSelector from '../RepoSelector';
import { useAuth } from '../../../context/AuthContext';
import { listAllRepos } from '../../../services/github';

// ── Fixtures ────────────────────────────────────────────────────────────────
function makeRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    id: Math.floor(Math.random() * 1e9),
    name: 'repo-test',
    full_name: 'user/repo-test',
    private: false,
    description: 'descripción',
    html_url: 'https://github.com/user/repo-test',
    default_branch: 'main',
    owner: { login: 'user', avatar_url: '' },
    updated_at: '2024-01-01',
    language: 'TypeScript',
    ...overrides,
  };
}

const reposFixture: GitHubRepo[] = [
  makeRepo({ id: 1, name: 'alpha', description: 'primero', language: 'TypeScript' }),
  makeRepo({ id: 2, name: 'beta-secret', description: 'oculto', private: true, language: 'Python' }),
  makeRepo({ id: 3, name: 'gamma', description: 'tercero', language: null }),
];

function setToken(token: string | null) {
  vi.mocked(useAuth).mockReturnValue({
    token,
    isAuthenticated: !!token,
    user: null,
    connectedAt: null,
    isLoading: false,
    error: null,
    loginWithPat: vi.fn(),
    logout: vi.fn(),
    initiateOAuth: vi.fn(),
    setTokenFromOAuth: vi.fn(),
  });
}

describe('RepoSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setToken('ghp_token');
  });

  it('sin token no llama a listAllRepos', () => {
    setToken(null);
    render(<RepoSelector selectedRepos={[]} onChange={vi.fn()} />);

    expect(listAllRepos).not.toHaveBeenCalled();
  });

  it('con token carga los repos al montar y muestra el contador', async () => {
    vi.mocked(listAllRepos).mockResolvedValue(reposFixture);

    render(<RepoSelector selectedRepos={[]} onChange={vi.fn()} />);

    // Mientras carga, spinner + "Cargando..."
    expect(screen.getByText('Cargando...')).toBeInTheDocument();

    // Al resolver, aparecen los nombres y el contador total
    await waitFor(() => {
      expect(screen.getByText('3 repositorios')).toBeInTheDocument();
    });
    expect(listAllRepos).toHaveBeenCalledWith('ghp_token');
    expect(screen.getByText(/alpha/)).toBeInTheDocument();
    expect(screen.getByText(/beta-secret/)).toBeInTheDocument();
    expect(screen.getByText(/gamma/)).toBeInTheDocument();
  });

  it('marca los repos privados con 🔒 y los públicos con 📁', async () => {
    vi.mocked(listAllRepos).mockResolvedValue(reposFixture);

    render(<RepoSelector selectedRepos={[]} onChange={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('3 repositorios')).toBeInTheDocument());

    expect(screen.getByText(/🔒/)).toBeInTheDocument();
    // Al menos un público con 📁
    const folders = screen.getAllByText(/📁/);
    expect(folders.length).toBeGreaterThanOrEqual(1);
  });

  it('filtra por nombre (case-insensitive) en tiempo real', async () => {
    vi.mocked(listAllRepos).mockResolvedValue(reposFixture);

    render(<RepoSelector selectedRepos={[]} onChange={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('3 repositorios')).toBeInTheDocument());

    const input = screen.getByPlaceholderText(/Filtrar repositorios/);
    fireEvent.change(input, { target: { value: 'BETA' } });

    expect(screen.getByText(/beta-secret/)).toBeInTheDocument();
    expect(screen.queryByText(/alpha/)).not.toBeInTheDocument();
    expect(screen.queryByText(/gamma/)).not.toBeInTheDocument();
  });

  it('filtra también por descripción', async () => {
    vi.mocked(listAllRepos).mockResolvedValue(reposFixture);

    render(<RepoSelector selectedRepos={[]} onChange={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('3 repositorios')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Filtrar repositorios/), {
      target: { value: 'oculto' },
    });

    expect(screen.getByText(/beta-secret/)).toBeInTheDocument();
    expect(screen.queryByText(/alpha/)).not.toBeInTheDocument();
  });

  it('pulsar un checkbox añade el repo y vuelve a pulsar lo quita (toggle)', async () => {
    vi.mocked(listAllRepos).mockResolvedValue(reposFixture);

    // Componente controlado: mantenemos el estado en el test para reflejar
    // el uso real (el padre guarda selectedRepos y lo pasa de vuelta).
    let selected: GitHubRepo[] = [];
    const onChange = vi.fn((next: GitHubRepo[]) => {
      selected = next;
    });

    const { rerender } = render(<RepoSelector selectedRepos={selected} onChange={onChange} />);

    await waitFor(() => expect(screen.getByText('3 repositorios')).toBeInTheDocument());

    // 1er click: añade alpha
    fireEvent.click(screen.getByLabelText(/alpha/));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBe(1);

    // Re-renderizamos con el nuevo estado para que el 2º click lo quite
    rerender(<RepoSelector selectedRepos={selected} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/alpha/));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(selected).toHaveLength(0);
  });

  it('toggleAll selecciona todos los filtrados y luego los vacía', async () => {
    vi.mocked(listAllRepos).mockResolvedValue(reposFixture);

    const { rerender } = render(<RepoSelector selectedRepos={[]} onChange={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('3 repositorios')).toBeInTheDocument());

    // Primera pulsación: pasa a "Ninguno" (todos seleccionados)
    const onChange1 = vi.fn();
    rerender(<RepoSelector selectedRepos={[]} onChange={onChange1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    expect((onChange1.mock.calls[0][0] as GitHubRepo[])).toHaveLength(3);

    // Ahora selectedRepos == filtrados (3). El botón dice "Ninguno" y vacía.
    const onChange2 = vi.fn();
    rerender(<RepoSelector selectedRepos={reposFixture} onChange={onChange2} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ninguno' }));
    expect((onChange2.mock.calls[0][0] as GitHubRepo[])).toHaveLength(0);
  });

  it('toggleAll respeta el filtro activo (solo actúa sobre los visibles)', async () => {
    vi.mocked(listAllRepos).mockResolvedValue(reposFixture);

    let selected: GitHubRepo[] = [];
    const onChange = vi.fn((next: GitHubRepo[]) => {
      selected = next;
    });

    const { rerender } = render(<RepoSelector selectedRepos={selected} onChange={onChange} />);

    await waitFor(() => expect(screen.getByText('3 repositorios')).toBeInTheDocument());

    // Filtramos para que solo quede visible alpha
    fireEvent.change(screen.getByPlaceholderText(/Filtrar repositorios/), {
      target: { value: 'alpha' },
    });
    rerender(<RepoSelector selectedRepos={selected} onChange={onChange} />);

    // "Todos" debe seleccionar SOLO el visible (alpha), no los 3 del backend
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBe(1);
  });

  it('si el fetch falla, deja de cargar y no muestra lista rota', async () => {
    vi.mocked(listAllRepos).mockRejectedValue(new Error('network'));

    render(<RepoSelector selectedRepos={[]} onChange={vi.fn()} />);

    await waitFor(() => {
      // El spinner desaparece y mostramos el contador a 0
      expect(screen.getByText('0 repositorios')).toBeInTheDocument();
    });
    expect(screen.queryByText('Cargando...')).not.toBeInTheDocument();
    expect(screen.getByText(/No se encontraron repositorios/)).toBeInTheDocument();
  });

  it('muestra el banner de selección con conteo cuando hay seleccionados', async () => {
    vi.mocked(listAllRepos).mockResolvedValue(reposFixture);

    render(<RepoSelector selectedRepos={[reposFixture[0]]} onChange={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('3 repositorios')).toBeInTheDocument());

    expect(screen.getByText(/1 repo seleccionado/)).toBeInTheDocument();
  });

  it('pluraliza correctamente cuando hay >1 seleccionados', async () => {
    vi.mocked(listAllRepos).mockResolvedValue(reposFixture);

    render(
      <RepoSelector selectedRepos={[reposFixture[0], reposFixture[1]]} onChange={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByText('3 repositorios')).toBeInTheDocument());

    expect(screen.getByText(/2 repos seleccionados/)).toBeInTheDocument();
  });
});
