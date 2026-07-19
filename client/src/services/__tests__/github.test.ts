import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  decodeBase64,
  encodeBase64,
  encodeBase64Bytes,
  createOrUpdateBinaryFile,
  getUser,
  createRepo,
  getRepo,
  repoExists,
  updateRepo,
  getBranchSha,
  getFileContents,
  createOrUpdateFile,
  deleteFile,
  ghFetch,
  GitHubAPIError,
  getIssueOrPr,
  getIssueComments,
  getPullReviewComments,
  getLatestReleaseTag,
  compareCommits,
  listRecentCommits,
  listCommitDates,
  listIssues,
  createIssue,
  updateIssueState,
  commentOnIssue,
  listPullRequests,
  createPullRequest,
  mergePullRequest,
  listBranches,
  createBranch,
  deleteBranch,
  listWorkflows,
  listWorkflowRuns,
  triggerWorkflowRun,
  listAllRepos,
  listUserRepos,
  getCommit,
} from '../github';

// Mock de fetch global
(globalThis as any).fetch = vi.fn();

describe('github.ts', () => {
  beforeEach(() => {
    // mockReset (en vez de clearAllMocks) para vaciar también la cola de
    // mockResolvedValueOnce entre tests; evita que un test consuma un mock residual del anterior.
    vi.clearAllMocks();
    vi.mocked(fetch).mockReset();
  });

  describe('decodeBase64', () => {
    it('debería decodificar Base64 correctamente', () => {
      const encoded = btoa('Hello World');
      const decoded = decodeBase64(encoded);
      expect(decoded).toBe('Hello World');
    });

    it('debería manejar caracteres UTF-8', () => {
      const text = 'Hola ñandú';
      const encoded = btoa(unescape(encodeURIComponent(text)));
      const decoded = decodeBase64(encoded);
      expect(decoded).toBe(text);
    });

    it('debería ignorar espacios en blanco', () => {
      const encoded = 'SGVs\nbG8g\nV29ybGQ=';
      const decoded = decodeBase64(encoded);
      expect(decoded).toBe('Hello World');
    });
  });

  describe('encodeBase64', () => {
    it('debería codificar texto a Base64', () => {
      const text = 'Hello World';
      const encoded = encodeBase64(text);
      expect(encoded).toBe(btoa(text));
    });

    it('debería manejar caracteres UTF-8', () => {
      const text = 'Hola ñandú';
      const encoded = encodeBase64(text);
      const decoded = decodeBase64(encoded);
      expect(decoded).toBe(text);
    });
  });

  describe('encodeBase64Bytes (binario, #28 4a)', () => {
    it('codifica bytes crudos a Base64', () => {
      const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0x00]);
      const encoded = encodeBase64Bytes(bytes);
      // Verificación independiente.
      expect(encoded).toBe(btoa('PK\x03\x04\xff\x00'));
    });

    it('maneja arrays grandes sin desbordar la pila', () => {
      const bytes = new Uint8Array(100_000).fill(65); // 'A'
      expect(() => encodeBase64Bytes(bytes)).not.toThrow();
      expect(encodeBase64Bytes(bytes).length).toBeGreaterThan(0);
    });
  });

  describe('createOrUpdateBinaryFile (#28 4a)', () => {
    it('hace PUT con el base64 de los bytes y la rama indicada', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ commit: { sha: 'c1' }, content: {} }) } as any);
      const bytes = new Uint8Array([1, 2, 3]);

      await createOrUpdateBinaryFile('tok', 'me', 'r', 'informe.pbit', bytes, 'msg', 'sha1', 'rama');

      const [, init] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.content).toBe(encodeBase64Bytes(bytes));
      expect(body.sha).toBe('sha1');
      expect(body.branch).toBe('rama');
    });
  });

  describe('ghFetch', () => {
    it('debería hacer petición GET exitosa', async () => {
      const mockData = { login: 'testuser', id: 123 };
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as any);

      const result = await ghFetch('test-token', '/user');

      expect(result).toEqual(mockData);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('debería lanzar GitHubAPIError en respuesta no-ok', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Not Found' }),
      } as any);

      await expect(ghFetch('test-token', '/user/unknown')).rejects.toThrow(GitHubAPIError);
    });

    it('debería incluir información de rate limit en error 429', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (key: string) => {
            if (key === 'x-ratelimit-reset') return '1234567890';
            if (key === 'x-ratelimit-remaining') return '0';
            return null;
          },
        },
        json: async () => ({ message: 'Rate limit exceeded' }),
      } as any);

      try {
        await ghFetch('test-token', '/user');
        expect.fail('Debería haber lanzado error');
      } catch (err) {
        expect(err).toBeInstanceOf(GitHubAPIError);
        expect((err as GitHubAPIError).status).toBe(429);
      }
    });

    it('reintenta ante un 503 transitorio y acaba devolviendo OK (#40)', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ message: 'unavailable' }) } as any)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: 1 }) } as any);

      const result = await ghFetch('tok', '/user');

      expect(result).toEqual({ ok: 1 });
      expect(fetch).toHaveBeenCalledTimes(2); // 1 fallo transitorio + 1 reintento OK
    });

    it('NO reintenta un 404 (una sola llamada) (#40)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ message: 'Not Found' }) } as any);
      await expect(ghFetch('tok', '/x')).rejects.toThrow(GitHubAPIError);
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUser', () => {
    it('debería obtener el usuario autenticado', async () => {
      const mockUser = { login: 'testuser', id: 123 };
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      } as any);

      const result = await getUser('test-token');

      expect(result).toEqual(mockUser);
    });
  });

  describe('createRepo', () => {
    it('debería crear un repositorio', async () => {
      const mockRepo = { name: 'new-repo', full_name: 'testuser/new-repo' };
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepo,
      } as any);

      const result = await createRepo('test-token', 'new-repo', 'Description', false);

      expect(result).toEqual(mockRepo);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/user/repos',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('new-repo'),
        })
      );
    });
  });

  describe('updateRepo (v3.31.0)', () => {
    it('debería hacer PATCH /repos/:owner/:repo con la descripción', async () => {
      const mockRepo = { name: 'repo', full_name: 'owner/repo', description: 'nuevo about' };
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepo,
      } as any);

      const result = await updateRepo('test-token', 'owner', 'repo', { description: 'nuevo about' });

      expect(result).toEqual(mockRepo);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('nuevo about'),
        })
      );
    });
  });

  describe('getFileContents', () => {
    it('debería obtener el contenido de un archivo', async () => {
      const mockFile = { content: 'SGVsbG8=', sha: 'abc123' };
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockFile,
      } as any);

      const result = await getFileContents('test-token', 'testuser', 'myrepo', 'README.md');

      expect(result).toEqual(mockFile);
    });
  });

  describe('createOrUpdateFile', () => {
    it('debería crear un archivo nuevo', async () => {
      const mockResult = { commit: { sha: 'commit123' }, content: { path: 'test.txt' } };
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      } as any);

      const result = await createOrUpdateFile(
        'test-token',
        'testuser',
        'myrepo',
        'test.txt',
        'contenido',
        'chore: add test.txt'
      );

      expect(result).toEqual(mockResult);
    });

    it('debería actualizar un archivo existente con SHA', async () => {
      const mockResult = { commit: { sha: 'commit456' }, content: { path: 'test.txt' } };
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      } as any);

      const result = await createOrUpdateFile(
        'test-token',
        'testuser',
        'myrepo',
        'test.txt',
        'contenido actualizado',
        'chore: update test.txt',
        'old-sha-123'
      );

      expect(result).toEqual(mockResult);
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('old-sha-123'),
        })
      );
    });

    it('debería incluir branch en el body cuando se especifica (#45)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commit: { sha: 'c1' }, content: { path: 'README.md' } }),
      } as any);

      await createOrUpdateFile(
        'test-token',
        'testuser',
        'myrepo',
        'README.md',
        'contenido',
        'docs: update',
        'sha-1',
        'docs/auto-123'
      );

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
      expect(body.branch).toBe('docs/auto-123');
    });

    it('NO debería incluir branch en el body cuando no se especifica', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commit: { sha: 'c1' }, content: { path: 'test.txt' } }),
      } as any);

      await createOrUpdateFile('test-token', 'testuser', 'myrepo', 'test.txt', 'x', 'chore: x');

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
      expect(body.branch).toBeUndefined();
    });
  });

  describe('getRepo', () => {
    it('debería pedir el repo y devolver su metadata', async () => {
      const mockRepo = { name: 'myrepo', default_branch: 'main' };
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRepo,
      } as any);

      const result = await getRepo('test-token', 'testuser', 'myrepo');

      expect(result).toEqual(mockRepo);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/testuser/myrepo',
        expect.any(Object)
      );
    });
  });

  describe('getLatestReleaseTag (#34)', () => {
    it('devuelve el tag del último release', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ tag_name: 'v1.2.3' }) } as any);
      await expect(getLatestReleaseTag('tok', 'o', 'r')).resolves.toBe('v1.2.3');
      expect(fetch).toHaveBeenCalledWith('https://api.github.com/repos/o/r/releases/latest', expect.any(Object));
    });

    it('devuelve null si el repo no tiene releases (404)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ message: 'Not Found' }) } as any);
      await expect(getLatestReleaseTag('tok', 'o', 'r')).resolves.toBeNull();
    });

    it('propaga otros errores no recuperables (422)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ message: 'boom' }) } as any);
      await expect(getLatestReleaseTag('tok', 'o', 'r')).rejects.toThrow();
    });
  });

  describe('compareCommits / listRecentCommits (#34)', () => {
    it('compareCommits mapea los commits entre base y head', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commits: [{ sha: 'a', commit: { message: 'feat: x' } }, { sha: 'b', commit: { message: 'fix: y' } }] }),
      } as any);

      const out = await compareCommits('tok', 'o', 'r', 'v1.0.0', 'main');

      expect(out).toEqual([{ sha: 'a', message: 'feat: x' }, { sha: 'b', message: 'fix: y' }]);
      expect(fetch).toHaveBeenCalledWith('https://api.github.com/repos/o/r/compare/v1.0.0...main', expect.any(Object));
    });

    it('listRecentCommits mapea la lista de commits', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [{ sha: 'c', commit: { message: 'docs: z' } }],
      } as any);

      const out = await listRecentCommits('tok', 'o', 'r', 10);

      expect(out).toEqual([{ sha: 'c', message: 'docs: z' }]);
      expect(fetch).toHaveBeenCalledWith('https://api.github.com/repos/o/r/commits?per_page=10', expect.any(Object));
    });

    it('listCommitDates mapea las fechas de autor de los commits (#44)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { commit: { author: { date: '2026-06-01T10:00:00Z' } } },
          { commit: { committer: { date: '2026-06-02T10:00:00Z' } } }, // sin author → cae a committer
          { commit: {} }, // sin fecha → se descarta
        ],
      } as any);

      const out = await listCommitDates('tok', 'o', 'r');

      expect(out).toEqual(['2026-06-01T10:00:00Z', '2026-06-02T10:00:00Z']);
      expect(fetch).toHaveBeenCalledWith('https://api.github.com/repos/o/r/commits?per_page=100', expect.any(Object));
    });
  });

  describe('fetchRepoTreeRecursive (#49)', () => {
    it('expone allPaths (todos los blobs) y descarga los docs de raíz por su prioridad', async () => {
      vi.mocked(fetch).mockImplementation(((url: any) => {
        const u = String(url);
        if (u.includes('/git/trees/')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              truncated: false,
              tree: [
                { path: 'README.md', type: 'blob', size: 10, sha: '1' },
                { path: 'MEJORAS_FUTURAS.md', type: 'blob', size: 10, sha: '2' },
                { path: 'src/a.ts', type: 'blob', size: 10, sha: '3' },
                { path: 'src', type: 'tree', size: 0, sha: '4' },
              ],
            }),
          });
        }
        // getFileContents
        return Promise.resolve({ ok: true, json: async () => ({ content: btoa('x'), encoding: 'base64' }) });
      }) as any);

      const { fetchRepoTreeRecursive } = await import('../github');
      const res = await fetchRepoTreeRecursive('tok', 'o', 'r', 'main');

      expect(res.allPaths).toEqual(expect.arrayContaining(['README.md', 'MEJORAS_FUTURAS.md', 'src/a.ts']));
      expect(res.allPaths).not.toContain('src'); // las entradas 'tree' no cuentan
      // MEJORAS_FUTURAS.md (prioridad subida en #49) entra entre los archivos con contenido
      expect(res.files.map(f => f.path)).toContain('MEJORAS_FUTURAS.md');
    });
  });

  describe('repoExists', () => {
    it('devuelve true si el repo existe (200)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'r' }) } as any);
      await expect(repoExists('tok', 'me', 'r')).resolves.toBe(true);
    });

    it('devuelve false ante un 404', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ message: 'Not Found' }) } as any);
      await expect(repoExists('tok', 'me', 'r')).resolves.toBe(false);
    });

    it('propaga otros errores no recuperables (422)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ message: 'boom' }) } as any);
      await expect(repoExists('tok', 'me', 'r')).rejects.toThrow();
    });
  });

  describe('getBranchSha', () => {
    it('debería devolver el SHA HEAD de la rama', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ref: 'refs/heads/main', object: { sha: 'base-sha-123' } }),
      } as any);

      const sha = await getBranchSha('test-token', 'testuser', 'myrepo', 'main');

      expect(sha).toBe('base-sha-123');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/testuser/myrepo/git/ref/heads/main',
        expect.any(Object)
      );
    });
  });

  describe('deleteFile', () => {
    it('debería eliminar un archivo', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as any);

      await deleteFile('test-token', 'testuser', 'myrepo', 'old.txt', 'sha123', 'chore: delete');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/testuser/myrepo/contents/old.txt',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('getIssueOrPr', () => {
    it('debería usar el endpoint de issues y exponer pull_request', async () => {
      const mockPr = { number: 12, title: 'PR', body: 'x', state: 'open', html_url: 'u', user: { login: 'a' }, pull_request: { url: 'y' } };
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => mockPr } as any);

      const result = await getIssueOrPr('test-token', 'owner', 'repo', 12);

      expect(result.pull_request).toBeTruthy();
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/issues/12',
        expect.any(Object)
      );
    });
  });

  describe('getIssueComments', () => {
    it('debería concatenar varias páginas hasta una página incompleta', async () => {
      const fullPage = Array.from({ length: 100 }, (_, i) => ({ id: i, body: 'c', user: { login: 'a' }, created_at: '2026-01-01' }));
      const lastPage = [{ id: 999, body: 'fin', user: { login: 'b' }, created_at: '2026-01-02' }];
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: async () => fullPage } as any)
        .mockResolvedValueOnce({ ok: true, json: async () => lastPage } as any);

      const result = await getIssueComments('test-token', 'owner', 'repo', 5);

      expect(result).toHaveLength(101);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenNthCalledWith(
        1, 'https://api.github.com/repos/owner/repo/issues/5/comments?per_page=100&page=1', expect.any(Object)
      );
      expect(fetch).toHaveBeenNthCalledWith(
        2, 'https://api.github.com/repos/owner/repo/issues/5/comments?per_page=100&page=2', expect.any(Object)
      );
    });

    it('debería parar tras una única página incompleta', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => [{ id: 1, body: 'c', user: { login: 'a' }, created_at: 'x' }] } as any);

      const result = await getIssueComments('test-token', 'owner', 'repo', 5);

      expect(result).toHaveLength(1);
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPullReviewComments', () => {
    it('debería usar el endpoint de pulls/comments', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => [] } as any);

      await getPullReviewComments('test-token', 'owner', 'repo', 12);

      expect(fetch).toHaveBeenNthCalledWith(
        1, 'https://api.github.com/repos/owner/repo/pulls/12/comments?per_page=100&page=1', expect.any(Object)
      );
    });
  });

  // ── Cobertura de edge cases para #26 (v3.50.6) ──────────────────────────────
  // Ramas de error/transitorias y wrappers sin test directo. El objetivo es subir
  // `branches` por encima del umbral de cobertura de CI con margen.

  describe('ghFetch — edge cases (#26)', () => {
    it('lanza GitHubAPIError ante un 401 (token expirado/no válido)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false, status: 401, json: async () => ({ message: 'Bad credentials' }),
      } as any);

      await expect(ghFetch('tok', '/user')).rejects.toMatchObject({
        name: 'GitHubAPIError', status: 401, message: 'Bad credentials',
      });
      // 401 NO es transitorio → una sola llamada
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('trata un 403 como rate limit: el mensaje enriquecido dispara reintento (#40 interacción)', async () => {
      // GitHub devuelve 403 para el "secondary rate limit"; isRateLimitError() cubre 429 y 403.
      // El mensaje enriquecido ("Rate limit...") matchea el patrón transitorio de retry.ts,
      // así que ghFetch reintenta 2 veces antes de propagar. Empujamos 3 respuestas idénticas.
      const rateLimitResp = {
        ok: false, status: 403,
        headers: {
          // parseRateLimitHeaders lee las keys en Pascal-Case exactas.
          get: (key: string) => {
            if (key === 'X-RateLimit-Reset') return '9999999999';
            if (key === 'X-RateLimit-Remaining') return '0';
            return null;
          },
        },
        json: async () => ({ message: 'Forbidden — secondary rate limit' }),
      };
      vi.mocked(fetch)
        .mockResolvedValueOnce(rateLimitResp as any)
        .mockResolvedValueOnce(rateLimitResp as any)
        .mockResolvedValueOnce(rateLimitResp as any);

      await expect(ghFetch('tok', '/user')).rejects.toMatchObject({
        name: 'GitHubAPIError', status: 403,
      });
      // 1 intento + 2 reintentos = 3 llamadas (el mensaje "Rate limit" es transient por patrón).
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('un 403 puro (sin mensaje de rate limit) NO se reintenta (4xx no transitorio)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false, status: 403,
        headers: { get: () => null },
        json: async () => ({ message: 'Forbidden: permisos insuficientes' }),
      } as any);

      await expect(ghFetch('tok', '/user')).rejects.toMatchObject({
        name: 'GitHubAPIError', status: 403,
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('propaga el 5xx tras agotar los 2 reintentos (#40)', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ message: 'Bad Gateway' }) } as any)
        .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ message: 'Bad Gateway' }) } as any)
        .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ message: 'Bad Gateway' }) } as any);

      await expect(ghFetch('tok', '/x')).rejects.toMatchObject({ name: 'GitHubAPIError', status: 502 });
      // 1 intento + 2 reintentos = 3 llamadas
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('reintenta ante un fallo de red (fetch rejection) y propaga si persiste', async () => {
      vi.mocked(fetch)
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(ghFetch('tok', '/x')).rejects.toThrow('Failed to fetch');
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('reintenta ante un fallo de red y luego recupera (#40)', async () => {
      vi.mocked(fetch)
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({ recovered: true }) } as any);

      await expect(ghFetch('tok', '/x')).resolves.toEqual({ recovered: true });
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('usa mensaje fallback cuando el body no trae `message`', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false, status: 418, json: async () => ({ /* sin message */ }),
      } as any);

      await expect(ghFetch('tok', '/x')).rejects.toMatchObject({
        message: expect.stringContaining('GitHub API 418'),
      });
    });

    it('cae a {} cuando res.json() lanza (payload malformado) y usa mensaje fallback', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false, status: 502,
        json: async () => { throw new SyntaxError('Unexpected token'); },
      } as any);
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false, status: 502,
        json: async () => { throw new SyntaxError('Unexpected token'); },
      } as any);
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false, status: 502,
        json: async () => { throw new SyntaxError('Unexpected token'); },
      } as any);

      await expect(ghFetch('tok', '/x')).rejects.toMatchObject({
        name: 'GitHubAPIError', status: 502,
        message: expect.stringContaining('GitHub API 502'),
      });
    });
  });

  describe('getLatestReleaseTag — tag ausente (#26)', () => {
    it('devuelve null si la respuesta no trae tag_name', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ /* sin tag_name */ }) } as any);
      await expect(getLatestReleaseTag('tok', 'o', 'r')).resolves.toBeNull();
    });
  });

  describe('encodeBase64Bytes — chunking (#28 4a, #26)', () => {
    it('procesa por chunks cuando el array supera 0x8000 bytes', () => {
      // 0x8000 + 1 fuerza dos pasadas del bucle interno.
      const bytes = new Uint8Array(0x8001).fill(0x41);
      const encoded = encodeBase64Bytes(bytes);
      const expected = btoa('A'.repeat(0x8001));
      expect(encoded).toBe(expected);
    });

    it('codifica un array vacío', () => {
      expect(encodeBase64Bytes(new Uint8Array(0))).toBe('');
    });
  });

  describe('createOrUpdateBinaryFile — sin sha / sin branch (#26)', () => {
    it('omite sha y branch cuando no se pasan', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true, json: async () => ({ commit: { sha: 'c1' }, content: {} }),
      } as any);

      await createOrUpdateBinaryFile('tok', 'me', 'r', 'f.bin', new Uint8Array([1]), 'msg');

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
      expect(body.sha).toBeUndefined();
      expect(body.branch).toBeUndefined();
    });
  });

  describe('fetchRepoTreeRecursive — truncated y filtros (#49, #26)', () => {
    it('marca truncated:true cuando el árbol del API viene truncado', async () => {
      const { fetchRepoTreeRecursive } = await import('../github');
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          truncated: true,
          tree: [{ path: 'README.md', type: 'blob', size: 10, sha: '1' }],
        }),
      } as any);
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true, json: async () => ({ content: btoa('x') }),
      } as any);

      const res = await fetchRepoTreeRecursive('tok', 'o', 'r', 'main');

      expect(res.truncated).toBe(true);
    });

    it('excluye archivos binarios y archivos > 50 KB de allPaths', async () => {
      const { fetchRepoTreeRecursive } = await import('../github');
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          truncated: false,
          tree: [
            { path: 'README.md', type: 'blob', size: 100, sha: '1' },
            { path: 'imagen.png', type: 'blob', size: 100, sha: '2' },           // binario
            { path: 'big.log', type: 'blob', size: 60 * 1024, sha: '3' },         // > 50 KB
            { path: 'src', type: 'tree', size: 0, sha: '4' },                     // dir
          ],
        }),
      } as any);
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true, json: async () => ({ content: btoa('x') }),
      } as any);

      const res = await fetchRepoTreeRecursive('tok', 'o', 'r', 'main');

      expect(res.allPaths).toEqual(['README.md']);
      expect(res.totalScanned).toBe(1);
    });

    it('tolera que getFileContents falle en algunos archivos (Promise.allSettled)', async () => {
      const { fetchRepoTreeRecursive } = await import('../github');
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          truncated: false,
          tree: [
            { path: 'a.ts', type: 'blob', size: 10, sha: '1' },
            { path: 'b.ts', type: 'blob', size: 10, sha: '2' },
          ],
        }),
      } as any);
      // a.ts OK, b.ts 404 → se descarta sin romper el batch
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ content: btoa('A') }) } as any)
        .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ message: 'Not Found' }) } as any);

      const res = await fetchRepoTreeRecursive('tok', 'o', 'r', 'main');

      expect(res.files.map(f => f.path)).toEqual(['a.ts']);
    });

    it('marca truncated:true cuando hay más de 120 archivos elegibles', async () => {
      const { fetchRepoTreeRecursive } = await import('../github');
      const tree = Array.from({ length: 130 }, (_, i) => ({
        path: `f${i}.ts`, type: 'blob', size: 10, sha: String(i),
      }));
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ truncated: false, tree }) } as any);
      // getFileContents para los 120 primeros (en batches de 5 = 24 lotes).
      for (let i = 0; i < 120; i++) {
        vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ content: btoa('x') }) } as any);
      }

      const res = await fetchRepoTreeRecursive('tok', 'o', 'r', 'main');

      expect(res.truncated).toBe(true);
      expect(res.files).toHaveLength(120);
    });
  });

  describe('listUserRepos / listAllRepos — paginación (#26)', () => {
    it('listUserRepos pide /user/repos con per_page=100', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => [] } as any);
      await listUserRepos('tok');
      expect(fetch).toHaveBeenCalledWith('https://api.github.com/user/repos?per_page=100', expect.any(Object));
    });

    it('listAllRepos pagina hasta una página incompleta', async () => {
      const fullPage = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `r${i}` }));
      const lastPage = [{ id: 999, name: 'last' }];
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: async () => fullPage } as any)
        .mockResolvedValueOnce({ ok: true, json: async () => lastPage } as any);

      const out = await listAllRepos('tok');

      expect(out).toHaveLength(101);
      expect(fetch).toHaveBeenNthCalledWith(
        1, 'https://api.github.com/user/repos?per_page=100&page=1&sort=updated', expect.any(Object)
      );
      expect(fetch).toHaveBeenNthCalledWith(
        2, 'https://api.github.com/user/repos?per_page=100&page=2&sort=updated', expect.any(Object)
      );
    });
  });

  describe('Issues & PRs wrappers (#26)', () => {
    it('listIssues pasa el state al query param', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => [] } as any);
      await listIssues('tok', 'o', 'r', 'closed');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/o/r/issues?state=closed&per_page=100', expect.any(Object)
      );
    });

    it('createIssue hace POST con title/body/labels/assignees', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ number: 7 }) } as any);
      await createIssue('tok', 'o', 'r', 'Bug', 'body', ['bug'], ['alice']);
      const [, init] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body).toEqual({ title: 'Bug', body: 'body', labels: ['bug'], assignees: ['alice'] });
      expect(init).toMatchObject({ method: 'POST' });
    });

    it('updateIssueState hace PATCH con el nuevo estado', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ number: 7, state: 'closed' }) } as any);
      await updateIssueState('tok', 'o', 'r', 7, 'closed');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/o/r/issues/7',
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('commentOnIssue hace POST al endpoint de comentarios', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1 }) } as any);
      await commentOnIssue('tok', 'o', 'r', 7, 'comentario');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/o/r/issues/7/comments',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('listPullRequests pasa el state al query param', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => [] } as any);
      await listPullRequests('tok', 'o', 'r', 'all');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/o/r/pulls?state=all&per_page=100', expect.any(Object)
      );
    });

    it('createPullRequest hace POST con head/base/draft', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ number: 9 }) } as any);
      await createPullRequest('tok', 'o', 'r', 'T', 'feature', 'main', 'body', true);
      const [, init] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body).toEqual({ title: 'T', head: 'feature', base: 'main', body: 'body', draft: true });
    });

    it('mergePullRequest hace PUT al endpoint de merge con merge_method', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ sha: 's', merged: true, message: 'ok' }) } as any);
      await mergePullRequest('tok', 'o', 'r', 9, 'squash', 'title', 'msg');
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(url).toBe('https://api.github.com/repos/o/r/pulls/9/merge');
      expect(init).toMatchObject({ method: 'PUT' });
      expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ merge_method: 'squash', commit_title: 'title' });
    });
  });

  describe('Branches & workflows wrappers (#26)', () => {
    it('listBranches pide el endpoint de branches', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => [] } as any);
      await listBranches('tok', 'o', 'r');
      expect(fetch).toHaveBeenCalledWith('https://api.github.com/repos/o/r/branches?per_page=100', expect.any(Object));
    });

    it('createBranch hace POST a git/refs con ref + sha', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ ref: 'refs/heads/x' }) } as any);
      await createBranch('tok', 'o', 'r', 'feature', 'sha1');
      const [, init] = vi.mocked(fetch).mock.calls[0];
      expect(init).toMatchObject({ method: 'POST' });
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({ ref: 'refs/heads/feature', sha: 'sha1' });
    });

    it('deleteBranch hace DELETE al ref', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({}) } as any);
      await deleteBranch('tok', 'o', 'r', 'feature');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/o/r/git/refs/heads/feature',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('listWorkflows desenvuelve workflows[]', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ workflows: [{ id: 1, name: 'CI' }] }) } as any);
      const out = await listWorkflows('tok', 'o', 'r');
      expect(out).toEqual([{ id: 1, name: 'CI' }]);
    });

    it('listWorkflowRuns sin status construye la URL sin query', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ workflow_runs: [{ id: 1 }] }) } as any);
      await listWorkflowRuns('tok', 'o', 'r', 42);
      expect(fetch).toHaveBeenCalledWith('https://api.github.com/repos/o/r/actions/workflows/42/runs', expect.any(Object));
    });

    it('listWorkflowRuns con status añade ?status=', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ workflow_runs: [] }) } as any);
      await listWorkflowRuns('tok', 'o', 'r', 42, 'failed');
      expect(fetch).toHaveBeenCalledWith('https://api.github.com/repos/o/r/actions/workflows/42/runs?status=failed', expect.any(Object));
    });

    it('triggerWorkflowRun hace POST al rerun', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ status: 202 }) } as any);
      await triggerWorkflowRun('tok', 'o', 'r', 99);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/o/r/actions/runs/99/rerun',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('getCommit — mapeo (#48, #26)', () => {
    it('desenvuelve sha/message/author y aplica files ?? []', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sha: 'abc',
          commit: { message: 'feat: x', author: { name: 'A', email: 'a@b.c', date: '2026-01-01' } },
          files: [{ filename: 'f.ts', status: 'modified', additions: 1, deletions: 1, changes: 2 }],
        }),
      } as any);

      const out = await getCommit('tok', 'o', 'r', 'abc');

      expect(out).toMatchObject({ sha: 'abc', message: 'feat: x' });
      expect(out.author).toEqual({ name: 'A', email: 'a@b.c', date: '2026-01-01' });
      expect(out.files).toHaveLength(1);
    });

    it('cae a [] cuando la respuesta no trae files', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sha: 'abc',
          commit: { message: 'x', author: { name: 'A', email: 'a@b.c', date: '2026-01-01' } },
        }),
      } as any);

      const out = await getCommit('tok', 'o', 'r', 'abc');
      expect(out.files).toEqual([]);
    });
  });
});
