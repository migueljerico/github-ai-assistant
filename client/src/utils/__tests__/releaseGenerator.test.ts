import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createGitHubRelease,
  generateReleaseNotesFromDocument,
  suggestNextVersion,
} from '../releaseGenerator';

describe('releaseGenerator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateReleaseNotesFromDocument', () => {
    it('genera notas con el nombre del repo y el contenido', () => {
      const notes = generateReleaseNotesFromDocument('Resumen del proyecto', 'mi-repo');
      expect(notes).toContain('mi-repo');
      expect(notes).toContain('Resumen del proyecto');
    });

    it('añade aviso de truncado para documentos largos', () => {
      const notes = generateReleaseNotesFromDocument('x'.repeat(600), 'repo');
      expect(notes).toContain('Documento completo disponible');
    });

    it('no añade aviso de truncado para documentos cortos', () => {
      const notes = generateReleaseNotesFromDocument('corto', 'repo');
      expect(notes).not.toContain('Documento completo disponible');
    });
  });

  describe('createGitHubRelease', () => {
    it('crea el release y devuelve url e id', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ html_url: 'https://github.com/o/r/releases/tag/v1.0.0', id: 42 }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await createGitHubRelease('token', 'o', 'r', {
        version: 'v1.0.0',
        title: 'v1.0.0',
        body: 'notas',
      });

      expect(result).toEqual({ url: 'https://github.com/o/r/releases/tag/v1.0.0', id: 42 });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/repos/o/r/releases');
      expect(JSON.parse(init.body).tag_name).toBe('v1.0.0');
    });

    it('lanza un error descriptivo cuando la API falla', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Unprocessable Entity',
        json: async () => ({ message: 'tag ya existe' }),
      }));

      await expect(
        createGitHubRelease('token', 'o', 'r', { version: 'v1', title: 't', body: 'b' }),
      ).rejects.toThrow('tag ya existe');
    });
  });

  describe('suggestNextVersion', () => {
    it('sugiere un bump de patch sobre la última release', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tag_name: 'v2.3.0' }),
      }));

      const next = await suggestNextVersion('token', 'o', 'r');
      expect(next).toBe('v2.3.1');
    });

    it('devuelve v1.0.0 por defecto si no hay releases', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
      const next = await suggestNextVersion('token', 'o', 'r');
      expect(next).toBe('v1.0.0');
    });

    it('devuelve v1.0.0 si la petición falla', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
      const next = await suggestNextVersion('token', 'o', 'r');
      expect(next).toBe('v1.0.0');
    });
  });
});
