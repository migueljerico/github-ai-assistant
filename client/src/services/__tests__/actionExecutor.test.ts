import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeAction, executeActionMultiRepo } from '../actionExecutor';
import type { GeminiAction, GitHubRepo } from '../../types';

// Mock de todas las funciones de github.ts
vi.mock('../github', () => ({
  createRepo: vi.fn(),
  createOrUpdateFile: vi.fn(),
  deleteFile: vi.fn(),
  getFileContents: vi.fn(),
  decodeBase64: vi.fn((str) => `decoded:${str}`),
  listAllRepos: vi.fn(),
  ghFetch: vi.fn(),
  listIssues: vi.fn(),
  createIssue: vi.fn(),
  updateIssueState: vi.fn(),
  commentOnIssue: vi.fn(),
  listPullRequests: vi.fn(),
  createPullRequest: vi.fn(),
  mergePullRequest: vi.fn(),
  listBranches: vi.fn(),
  createBranch: vi.fn(),
  deleteBranch: vi.fn(),
  listWorkflows: vi.fn(),
  listWorkflowRuns: vi.fn(),
  triggerWorkflowRun: vi.fn(),
}));

import {
  createRepo,
  createOrUpdateFile,
  deleteFile,
  getFileContents,
  listAllRepos,
  ghFetch,
} from '../github';

describe('actionExecutor.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUser = { login: 'testuser' };
  const mockToken = 'test-token';

  describe('executeAction', () => {
    it('debería ejecutar GET para listar repositorios', async () => {
      const mockRepos = [
        { name: 'repo1', full_name: 'testuser/repo1' },
        { name: 'repo2', full_name: 'testuser/repo2' },
      ];
      vi.mocked(listAllRepos).mockResolvedValue(mockRepos as any);

      const action: GeminiAction = {
        tipo: 'listado',
        accion: 'Listar repos',
        endpoint: '/user/repos',
        metodo: 'GET',
        repo: null,
        archivo: null,
        contenidoPropuesto: null,
        payload: {},
        requiereConfirmacion: false,
      };

      const result = await executeAction(mockToken, mockUser, action);

      expect(result.success).toBe(true);
      expect(result.message).toContain('2 repositorios encontrados');
      expect(result.data).toEqual(mockRepos);
      expect(listAllRepos).toHaveBeenCalledWith(mockToken);
    });

    it('debería ejecutar GET para leer archivo', async () => {
      vi.mocked(getFileContents).mockResolvedValue({
        content: 'base64content',
        sha: 'abc123',
      } as any);

      const action: GeminiAction = {
        tipo: 'lectura',
        accion: 'Leer archivo',
        endpoint: '/repos/testuser/myrepo/contents/README.md',
        metodo: 'GET',
        repo: 'myrepo',
        archivo: 'README.md',
        contenidoPropuesto: null,
        payload: {},
        requiereConfirmacion: false,
      };

      const result = await executeAction(mockToken, mockUser, action);

      expect(result.success).toBe(true);
      expect(result.message).toContain('README.md leído correctamente');
      expect(getFileContents).toHaveBeenCalledWith(mockToken, 'testuser', 'myrepo', 'README.md');
    });

    it('debería ejecutar POST para crear repositorio', async () => {
      const newRepo = { name: 'new-repo', full_name: 'testuser/new-repo' };
      vi.mocked(createRepo).mockResolvedValue(newRepo as any);

      const action: GeminiAction = {
        tipo: 'creacion',
        accion: 'Crear repo',
        endpoint: '/user/repos',
        metodo: 'POST',
        repo: null,
        archivo: null,
        contenidoPropuesto: null,
        payload: { name: 'new-repo', description: 'Test', private: false },
        requiereConfirmacion: true,
      };

      const result = await executeAction(mockToken, mockUser, action);

      expect(result.success).toBe(true);
      expect(result.message).toContain('new-repo');
      expect(createRepo).toHaveBeenCalledWith(mockToken, 'new-repo', 'Test', false);
    });

    it('debería ejecutar PUT para crear/actualizar archivo', async () => {
      vi.mocked(getFileContents).mockRejectedValue(new Error('404'));
      vi.mocked(createOrUpdateFile).mockResolvedValue({
        commit: { sha: 'commit123' },
        content: { path: 'test.txt' },
      } as any);

      const action: GeminiAction = {
        tipo: 'escritura',
        accion: 'Crear archivo',
        endpoint: '/repos/testuser/myrepo/contents/test.txt',
        metodo: 'PUT',
        repo: 'myrepo',
        archivo: 'test.txt',
        contenidoPropuesto: 'contenido del archivo',
        payload: { message: 'chore: add test.txt' },
        requiereConfirmacion: true,
      };

      const result = await executeAction(mockToken, mockUser, action);

      expect(result.success).toBe(true);
      expect(result.message).toContain('creado correctamente');
      expect(createOrUpdateFile).toHaveBeenCalled();
    });

    it('debería ejecutar DELETE para eliminar archivo', async () => {
      vi.mocked(getFileContents).mockResolvedValue({
        sha: 'file-sha-123',
      } as any);
      vi.mocked(deleteFile).mockResolvedValue(undefined);

      const action: GeminiAction = {
        tipo: 'borrado',
        accion: 'Eliminar archivo',
        endpoint: '/repos/testuser/myrepo/contents/old.txt',
        metodo: 'DELETE',
        repo: 'myrepo',
        archivo: 'old.txt',
        contenidoPropuesto: null,
        payload: { message: 'chore: delete old.txt' },
        requiereConfirmacion: true,
      };

      const result = await executeAction(mockToken, mockUser, action);

      expect(result.success).toBe(true);
      expect(result.message).toContain('eliminado correctamente');
      expect(deleteFile).toHaveBeenCalledWith(
        mockToken,
        'testuser',
        'myrepo',
        'old.txt',
        'file-sha-123',
        'chore: delete old.txt'
      );
    });

    it('debería ejecutar PATCH genérico', async () => {
      vi.mocked(ghFetch).mockResolvedValue({ updated: true });

      const action: GeminiAction = {
        tipo: 'escritura',
        accion: 'Actualizar repo',
        endpoint: '/repos/testuser/myrepo',
        metodo: 'PATCH',
        repo: 'myrepo',
        archivo: null,
        contenidoPropuesto: null,
        payload: { description: 'Nueva descripción' },
        requiereConfirmacion: true,
      };

      const result = await executeAction(mockToken, mockUser, action);

      expect(result.success).toBe(true);
      expect(ghFetch).toHaveBeenCalledWith(
        mockToken,
        '/repos/testuser/myrepo',
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('debería manejar errores correctamente', async () => {
      vi.mocked(listAllRepos).mockRejectedValue(new Error('API Error'));

      const action: GeminiAction = {
        tipo: 'listado',
        accion: 'Listar repos',
        endpoint: '/user/repos',
        metodo: 'GET',
        repo: null,
        archivo: null,
        contenidoPropuesto: null,
        payload: {},
        requiereConfirmacion: false,
      };

      const result = await executeAction(mockToken, mockUser, action);

      expect(result.success).toBe(false);
      expect(result.message).toBe('API Error');
    });

    it('debería resolver placeholders en el endpoint', async () => {
      vi.mocked(listAllRepos).mockResolvedValue([]);

      const action: GeminiAction = {
        tipo: 'listado',
        accion: 'Listar repos',
        endpoint: '/users/{username}/repos',
        metodo: 'GET',
        repo: null,
        archivo: null,
        contenidoPropuesto: null,
        payload: {},
        requiereConfirmacion: false,
      };

      const result = await executeAction(mockToken, mockUser, action);

      expect(result.success).toBe(true);
      expect(listAllRepos).toHaveBeenCalledWith(mockToken);
    });
  });

  describe('executeActionMultiRepo', () => {
    it('debería ejecutar acción en múltiples repositorios', async () => {
      vi.mocked(createOrUpdateFile).mockResolvedValue({
        commit: { sha: 'commit123' },
        content: { path: 'test.txt' },
      } as any);
      vi.mocked(getFileContents).mockRejectedValue(new Error('404'));

      const repos: GitHubRepo[] = [
        { name: 'repo1', full_name: 'testuser/repo1', owner: { login: 'testuser' } } as any,
        { name: 'repo2', full_name: 'testuser/repo2', owner: { login: 'testuser' } } as any,
      ];

      const action: GeminiAction = {
        tipo: 'escritura',
        accion: 'Crear archivo',
        endpoint: '/repos/{owner}/{repo}/contents/test.txt',
        metodo: 'PUT',
        repo: null,
        archivo: 'test.txt',
        contenidoPropuesto: 'contenido',
        payload: {},
        requiereConfirmacion: true,
      };

      const onProgress = vi.fn();
      const results = await executeActionMultiRepo(mockToken, mockUser, action, repos, { onProgress });

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(onProgress).toHaveBeenCalledTimes(4); // 2 repos × 2 calls (pending + completed)
    });
  });
});
