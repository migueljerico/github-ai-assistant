import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  decodeBase64,
  encodeBase64,
  getUser,
  createRepo,
  getFileContents,
  createOrUpdateFile,
  deleteFile,
  ghFetch,
  GitHubAPIError,
} from './github';

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
});
