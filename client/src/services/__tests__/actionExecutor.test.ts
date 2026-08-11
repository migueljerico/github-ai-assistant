import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeAction,
  executeActionMultiRepo,
  executeIssueAction,
  executePRAction,
  executeWorkflowAction,
  parseRepoTarget,
} from '../actionExecutor';
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
  updateIssueState,
  commentOnIssue,
  mergePullRequest,
  triggerWorkflowRun,
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

    it('propaga el fallo de un repo sin parar y reporta error vía onProgress (#26)', async () => {
      // repo1 falla (createOrUpdateFile rechaza), repo2 OK.
      vi.mocked(getFileContents).mockRejectedValue(new Error('404'));
      vi.mocked(createOrUpdateFile)
        .mockRejectedValueOnce(new Error('403 forbidden'))
        .mockResolvedValueOnce({ commit: { sha: 'c2' }, content: { path: 't.txt' } } as any);

      const repos: GitHubRepo[] = [
        { name: 'repo1', full_name: 'testuser/repo1', owner: { login: 'testuser' } } as any,
        { name: 'repo2', full_name: 'testuser/repo2', owner: { login: 'testuser' } } as any,
      ];
      const action: GeminiAction = {
        tipo: 'escritura', accion: 'Crear', endpoint: '/repos/{owner}/{repo}/contents/t.txt',
        metodo: 'PUT', repo: null, archivo: 't.txt', contenidoPropuesto: 'x',
        payload: {}, requiereConfirmacion: true,
      };

      const onProgress = vi.fn();
      const results = await executeActionMultiRepo(mockToken, mockUser, action, repos, { onProgress });

      expect(results[0].success).toBe(false);
      expect(results[0].message).toBe('403 forbidden');
      expect(results[1].success).toBe(true);
      // Orden serial: repo1.pending(1), repo1.error(2), repo2.pending(3), repo2.completed(4).
      expect(onProgress).toHaveBeenNthCalledWith(2, 'testuser/repo1', 'error', '403 forbidden');
      expect(onProgress).toHaveBeenNthCalledWith(4, 'testuser/repo2', 'completed', expect.any(String));
    });

    it('respeta el commitMessage del usuario (#53) propagándolo a cada repo', async () => {
      vi.mocked(getFileContents).mockResolvedValue({ content: 'x', sha: 's1' } as any);
      vi.mocked(createOrUpdateFile).mockResolvedValue({ commit: { sha: 'c1' }, content: {} } as any);

      const repos: GitHubRepo[] = [
        { name: 'r1', full_name: 'u/r1', owner: { login: 'u' } } as any,
      ];
      const action: GeminiAction = {
        tipo: 'escritura', accion: 'Update', endpoint: '/repos/{owner}/{repo}/contents/f.txt',
        metodo: 'PUT', repo: null, archivo: 'f.txt', contenidoPropuesto: 'new',
        payload: { message: 'fallback msg' }, requiereConfirmacion: true,
      };

      await executeActionMultiRepo(mockToken, mockUser, action, repos, {}, undefined, 'feat: custom');

      expect(createOrUpdateFile).toHaveBeenCalledWith(
        mockToken, 'u', 'r1', 'f.txt', 'new', 'feat: custom', 's1'
      );
    });
  });

  // ── Cobertura de edge cases para #26 (v3.50.6) ──────────────────────────────
  // Ramas no cubiertas: parseRepoTarget, PUT/DELETE sin archivo, método no soportado,
  // PUT con SHA (rama "updated"), y los 3 executores específicos (issue/PR/workflow).

  describe('parseRepoTarget (#26)', () => {
    it('devuelve owner vacío y repo vacío cuando repoFullName es null', () => {
      expect(parseRepoTarget(null, { login: 'me' })).toEqual({ owner: 'me', repo: '' });
    });
    it('parsea "owner/repo" separando por la primera barra', () => {
      expect(parseRepoTarget('org/repo', { login: 'me' })).toEqual({ owner: 'org', repo: 'repo' });
    });
    it('usa el usuario autenticado cuando solo viene el nombre del repo', () => {
      expect(parseRepoTarget('myrepo', { login: 'me' })).toEqual({ owner: 'me', repo: 'myrepo' });
    });
  });

  describe('executeAction — ramas de error y mensajes (#26)', () => {
    it('PUT sin archivo lanza error y lo envuelve como success:false', async () => {
      const action: GeminiAction = {
        tipo: 'escritura', accion: 'PUT sin path', endpoint: '/repos/o/r/contents/',
        metodo: 'PUT', repo: 'r', archivo: null, contenidoPropuesto: 'x',
        payload: {}, requiereConfirmacion: true,
      };
      const result = await executeAction(mockToken, mockUser, action);
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/ruta del archivo/i);
    });

    it('DELETE sin archivo lanza error y lo envuelve como success:false', async () => {
      const action: GeminiAction = {
        tipo: 'borrado', accion: 'DELETE sin path', endpoint: '/repos/o/r/contents/',
        metodo: 'DELETE', repo: 'r', archivo: null, contenidoPropuesto: null,
        payload: {}, requiereConfirmacion: true,
      };
      const result = await executeAction(mockToken, mockUser, action);
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/ruta del archivo/i);
    });

    it('método HTTP no soportado lanza error (rama default)', async () => {
      const action: GeminiAction = {
        tipo: 'escritura', accion: 'OPTIONS', endpoint: '/x',
        metodo: 'OPTIONS' as any, repo: null, archivo: null, contenidoPropuesto: null,
        payload: {}, requiereConfirmacion: true,
      };
      const result = await executeAction(mockToken, mockUser, action);
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/no soportado/i);
    });

    it('PUT con archivo existente usa SHA y devuelve mensaje de "actualizado"', async () => {
      vi.mocked(getFileContents).mockResolvedValue({ content: 'old', sha: 'existing-sha' } as any);
      vi.mocked(createOrUpdateFile).mockResolvedValue({ commit: { sha: 'c2' }, content: {} } as any);

      const action: GeminiAction = {
        tipo: 'escritura', accion: 'Update', endpoint: '/repos/o/r/contents/f.txt',
        metodo: 'PUT', repo: 'r', archivo: 'f.txt', contenidoPropuesto: 'new',
        payload: {}, requiereConfirmacion: true,
      };
      const result = await executeAction(mockToken, mockUser, action);

      expect(result.success).toBe(true);
      expect(result.message).toContain('actualizado');
      // repo='r' sin '/' → owner = mockUser.login = 'testuser'.
      expect(createOrUpdateFile).toHaveBeenCalledWith(
        mockToken, 'testuser', 'r', 'f.txt', 'new', expect.any(String), 'existing-sha'
      );
    });

    it('PUT prioriza el commitMessage del usuario sobre el del payload (#53)', async () => {
      vi.mocked(getFileContents).mockResolvedValue({ content: 'old', sha: 'sha1' } as any);
      vi.mocked(createOrUpdateFile).mockResolvedValue({ commit: { sha: 'c' }, content: {} } as any);

      const action: GeminiAction = {
        tipo: 'escritura', accion: 'Update', endpoint: '/repos/o/r/contents/f.txt',
        metodo: 'PUT', repo: 'r', archivo: 'f.txt', contenidoPropuesto: 'new',
        payload: { message: 'payload msg' }, requiereConfirmacion: true,
      };
      await executeAction(mockToken, mockUser, action, undefined, undefined, 'feat: user msg');

      expect(createOrUpdateFile).toHaveBeenCalledWith(
        mockToken, 'testuser', 'r', 'f.txt', 'new', 'feat: user msg', 'sha1'
      );
    });

    it('GET /contents/ con file.content vacío devuelve string vacío', async () => {
      vi.mocked(getFileContents).mockResolvedValue({ content: '', sha: 'x' } as any);

      const action: GeminiAction = {
        tipo: 'lectura', accion: 'Leer', endpoint: '/repos/o/r/contents/empty.txt',
        metodo: 'GET', repo: 'r', archivo: 'empty.txt', contenidoPropuesto: null,
        payload: {}, requiereConfirmacion: false,
      };
      const result = await executeAction(mockToken, mockUser, action);
      expect(result.success).toBe(true);
      expect(result.data).toBe('');
    });

    it('GET genérico delega a ghFetch', async () => {
      vi.mocked(ghFetch).mockResolvedValue({ whatever: true });

      const action: GeminiAction = {
        tipo: 'lectura', accion: 'GET genérico', endpoint: '/repos/o/r/releases',
        metodo: 'GET', repo: 'r', archivo: null, contenidoPropuesto: null,
        payload: {}, requiereConfirmacion: false,
      };
      const result = await executeAction(mockToken, mockUser, action);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ whatever: true });
    });

    it('POST genérico (no /user/repos) delega a ghFetch con body', async () => {
      vi.mocked(ghFetch).mockResolvedValue({ id: 1 });

      const action: GeminiAction = {
        tipo: 'creacion', accion: 'Crear issue', endpoint: '/repos/o/r/issues',
        metodo: 'POST', repo: 'r', archivo: null, contenidoPropuesto: null,
        payload: { title: 'Bug' }, requiereConfirmacion: true,
      };
      const result = await executeAction(mockToken, mockUser, action);
      expect(result.success).toBe(true);
      expect(ghFetch).toHaveBeenCalledWith(
        mockToken, '/repos/o/r/issues',
        expect.objectContaining({ method: 'POST', body: expect.stringContaining('Bug') })
      );
    });
  });

  describe('executeIssueAction (#26)', () => {
    const targetRepo = { name: 'r', owner: { login: 'o' } } as any;

    it('comenta en un issue (POST /comments)', async () => {
      vi.mocked(commentOnIssue).mockResolvedValue({ id: 1, body: 'hola', created_at: 't' } as any);
      const action: GeminiAction = {
        tipo: 'escritura', accion: 'Comentar', endpoint: '/repos/o/r/issues/5/comments',
        metodo: 'POST', repo: 'r', archivo: null, contenidoPropuesto: null,
        payload: { body: 'hola' }, requiereConfirmacion: true,
      };
      const result = await executeIssueAction(mockToken, mockUser, action, targetRepo);
      expect(result.success).toBe(true);
      expect(commentOnIssue).toHaveBeenCalledWith(mockToken, 'o', 'r', 5, 'hola');
    });

    it('cierra un issue (PATCH con state=closed)', async () => {
      vi.mocked(updateIssueState).mockResolvedValue({ number: 5, state: 'closed' } as any);
      const action: GeminiAction = {
        tipo: 'escritura', accion: 'Cerrar', endpoint: '/repos/o/r/issues/5',
        metodo: 'PATCH', repo: 'r', archivo: null, contenidoPropuesto: null,
        payload: { state: 'closed' }, requiereConfirmacion: true,
      };
      const result = await executeIssueAction(mockToken, mockUser, action, targetRepo);
      expect(result.success).toBe(true);
      expect(updateIssueState).toHaveBeenCalledWith(mockToken, 'o', 'r', 5, 'closed');
    });

    it('reabre un issue cuando state no es "closed" (cae a "reopened")', async () => {
      vi.mocked(updateIssueState).mockResolvedValue({ number: 5, state: 'open' } as any);
      const action: GeminiAction = {
        tipo: 'escritura', accion: 'Reabrir', endpoint: '/repos/o/r/issues/5',
        metodo: 'PATCH', repo: 'r', archivo: null, contenidoPropuesto: null,
        payload: { state: 'open' }, requiereConfirmacion: true,
      };
      const result = await executeIssueAction(mockToken, mockUser, action, targetRepo);
      expect(result.success).toBe(true);
    });

    it('falla si el endpoint no trae número de issue', async () => {
      const action: GeminiAction = {
        tipo: 'escritura', accion: 'Mal', endpoint: '/repos/o/r/issues',
        metodo: 'PATCH', repo: 'r', archivo: null, contenidoPropuesto: null,
        payload: {}, requiereConfirmacion: true,
      };
      const result = await executeIssueAction(mockToken, mockUser, action, targetRepo);
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/número de issue/i);
    });

    it('devuelve unknownIssueAction cuando no reconoce la combinación', async () => {
      const action: GeminiAction = {
        tipo: 'lectura', accion: 'GET issue', endpoint: '/repos/o/r/issues/5',
        metodo: 'GET', repo: 'r', archivo: null, contenidoPropuesto: null,
        payload: {}, requiereConfirmacion: false,
      };
      const result = await executeIssueAction(mockToken, mockUser, action, targetRepo);
      expect(result.success).toBe(false);
    });
  });

  describe('executePRAction (#26)', () => {
    const targetRepo = { name: 'r', owner: { login: 'o' } } as any;

    it('fusiona un PR (PUT /merge)', async () => {
      vi.mocked(mergePullRequest).mockResolvedValue({ sha: 's', merged: true, message: 'ok' } as any);
      const action: GeminiAction = {
        tipo: 'escritura', accion: 'Merge', endpoint: '/repos/o/r/pulls/9/merge',
        metodo: 'PUT', repo: 'r', archivo: null, contenidoPropuesto: null,
        payload: { merge_method: 'squash' }, requiereConfirmacion: true,
      };
      const result = await executePRAction(mockToken, mockUser, action, targetRepo);
      expect(result.success).toBe(true);
      expect(mergePullRequest).toHaveBeenCalledWith(mockToken, 'o', 'r', 9, 'squash', undefined, undefined);
    });

    it('cae a merge_method por defecto "merge" si no viene en el payload', async () => {
      vi.mocked(mergePullRequest).mockResolvedValue({ sha: 's', merged: true, message: 'ok' } as any);
      const action: GeminiAction = {
        tipo: 'escritura', accion: 'Merge', endpoint: '/repos/o/r/pulls/9/merge',
        metodo: 'PUT', repo: 'r', archivo: null, contenidoPropuesto: null,
        payload: {}, requiereConfirmacion: true,
      };
      await executePRAction(mockToken, mockUser, action, targetRepo);
      expect(mergePullRequest).toHaveBeenCalledWith(mockToken, 'o', 'r', 9, 'merge', undefined, undefined);
    });

    it('falla si el endpoint no trae número de PR', async () => {
      const action: GeminiAction = {
        tipo: 'escritura', accion: 'Mal', endpoint: '/repos/o/r/pulls',
        metodo: 'PUT', repo: 'r', archivo: null, contenidoPropuesto: null,
        payload: {}, requiereConfirmacion: true,
      };
      const result = await executePRAction(mockToken, mockUser, action, targetRepo);
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/número de PR/i);
    });

    it('devuelve unknownPRAction cuando el endpoint no es /merge', async () => {
      const action: GeminiAction = {
        tipo: 'lectura', accion: 'Ver PR', endpoint: '/repos/o/r/pulls/9',
        metodo: 'GET', repo: 'r', archivo: null, contenidoPropuesto: null,
        payload: {}, requiereConfirmacion: false,
      };
      const result = await executePRAction(mockToken, mockUser, action, targetRepo);
      expect(result.success).toBe(false);
    });
  });

  describe('executeWorkflowAction (#26)', () => {
    const targetRepo = { name: 'r', owner: { login: 'o' } } as any;

    it('relanza un workflow (POST /rerun)', async () => {
      vi.mocked(triggerWorkflowRun).mockResolvedValue({ status: 202 } as any);
      const action: GeminiAction = {
        tipo: 'escritura', accion: 'Rerun', endpoint: '/repos/o/r/actions/runs/99/rerun',
        metodo: 'POST', repo: 'r', archivo: null, contenidoPropuesto: null,
        payload: {}, requiereConfirmacion: true,
      };
      const result = await executeWorkflowAction(mockToken, mockUser, action, targetRepo);
      expect(result.success).toBe(true);
      expect(triggerWorkflowRun).toHaveBeenCalledWith(mockToken, 'o', 'r', 99);
    });

    it('falla si el endpoint no trae ID de run', async () => {
      const action: GeminiAction = {
        tipo: 'escritura', accion: 'Mal', endpoint: '/repos/o/r/actions/runs',
        metodo: 'POST', repo: 'r', archivo: null, contenidoPropuesto: null,
        payload: {}, requiereConfirmacion: true,
      };
      const result = await executeWorkflowAction(mockToken, mockUser, action, targetRepo);
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/ID del workflow/i);
    });

    it('devuelve unknownWorkflowAction cuando el endpoint no es /rerun', async () => {
      const action: GeminiAction = {
        tipo: 'lectura', accion: 'Ver runs', endpoint: '/repos/o/r/actions/runs/99',
        metodo: 'POST', repo: 'r', archivo: null, contenidoPropuesto: null,
        payload: {}, requiereConfirmacion: false,
      };
      const result = await executeWorkflowAction(mockToken, mockUser, action, targetRepo);
      expect(result.success).toBe(false);
      expect(result.message).toBe('Acción de workflow no reconocida');
    });

    it('ejecuta rerun de workflow usando mensaje fallback cuando t no está definido', async () => {
      vi.mocked(triggerWorkflowRun).mockResolvedValue({ status: 202 } as any);
      const action: GeminiAction = {
        tipo: 'escritura', accion: 'Rerun', endpoint: '/repos/o/r/actions/runs/99/rerun',
        metodo: 'POST', repo: 'r', archivo: null, contenidoPropuesto: null,
        payload: {}, requiereConfirmacion: true,
      };
      const result = await executeWorkflowAction(mockToken, mockUser, action, targetRepo);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Workflow re-ejecutado correctamente');
    });
  });

  describe('executePRAction - Cobertura de mensajes fallback', () => {
    it('mergea PR usando mensaje fallback cuando t no está definido', async () => {
      vi.mocked(mergePullRequest).mockResolvedValue({ merged: true } as any);
      const targetRepo: GitHubRepo = { name: 'r', owner: { login: 'o' } } as any;
      const action: GeminiAction = {
        tipo: 'escritura', accion: 'Merge PR', endpoint: '/repos/o/r/pulls/10/merge',
        metodo: 'PUT', repo: 'r', archivo: null, contenidoPropuesto: null,
        payload: {}, requiereConfirmacion: true,
      };
      const result = await executePRAction(mockToken, mockUser, action, targetRepo);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Pull Request fusionado correctamente');
    });

    it('devuelve mensaje fallback para acción de PR no reconocida', async () => {
      const targetRepo: GitHubRepo = { name: 'r', owner: { login: 'o' } } as any;
      const action: GeminiAction = {
        tipo: 'escritura', accion: 'Desconocida', endpoint: '/repos/o/r/pulls/10/unknown',
        metodo: 'POST', repo: 'r', archivo: null, contenidoPropuesto: null,
        payload: {}, requiereConfirmacion: true,
      };
      const result = await executePRAction(mockToken, mockUser, action, targetRepo);
      expect(result.success).toBe(false);
      expect(result.message).toBe('Acción de PR no reconocida');
    });
  });

  describe('parseRepoTarget', () => {
    it('resuelve owner/repo cuando viene completo', () => {
      expect(parseRepoTarget('owner/repo', mockUser)).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('resuelve repo del usuario autenticado cuando solo viene el nombre', () => {
      expect(parseRepoTarget('mi-repo', mockUser)).toEqual({ owner: 'testuser', repo: 'mi-repo' });
    });

    it('cae a activeRepoName cuando repoFullName es null o igual al usuario login', () => {
      expect(parseRepoTarget(null, mockUser, 'owner/active-repo')).toEqual({ owner: 'owner', repo: 'active-repo' });
      expect(parseRepoTarget('testuser', mockUser, 'testuser/github-ai-assistant')).toEqual({ owner: 'testuser', repo: 'github-ai-assistant' });
    });
  });
});

