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
  getBranchSha,
  getFileContents,
  createOrUpdateFile,
  deleteFile,
  ghFetch,
  GitHubAPIError,
  getIssueOrPr,
  getIssueComments,
  getPullReviewComments,
} from '../github';

// Mock de fetch global
(globalThis as any).fetch = vi.fn();

describe('github.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  describe('repoExists', () => {
    it('devuelve true si el repo existe (200)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'r' }) } as any);
      await expect(repoExists('tok', 'me', 'r')).resolves.toBe(true);
    });

    it('devuelve false ante un 404', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ message: 'Not Found' }) } as any);
      await expect(repoExists('tok', 'me', 'r')).resolves.toBe(false);
    });

    it('propaga otros errores (p. ej. 500)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ message: 'boom' }) } as any);
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
});
