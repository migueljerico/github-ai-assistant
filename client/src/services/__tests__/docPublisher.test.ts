import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock del módulo github (igual patrón que actionExecutor.test.ts)
vi.mock('../github', () => ({
  getFileContents: vi.fn(),
  createOrUpdateFile: vi.fn(),
  getRepo: vi.fn(),
  getBranchSha: vi.fn(),
  createBranch: vi.fn(),
  createPullRequest: vi.fn(),
}));

import {
  getFileContents,
  createOrUpdateFile,
  getRepo,
  getBranchSha,
  createBranch,
  createPullRequest,
} from '../github';
import { writeDocFiles, buildDocsPrBody, createDocsDraftPr } from '../docPublisher';

const TOKEN = 'tok';
const OWNER = 'owner';
const REPO = 'repo';

describe('docPublisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('writeDocFiles', () => {
    it('escribe README y MANUAL con el SHA existente y propaga la rama', async () => {
      vi.mocked(getFileContents)
        .mockResolvedValueOnce({ sha: 'readme-sha' } as any)
        .mockResolvedValueOnce({ sha: 'manual-sha' } as any);
      vi.mocked(createOrUpdateFile).mockResolvedValue({ commit: { sha: 'c' } } as any);

      await writeDocFiles(TOKEN, OWNER, REPO, '# Readme', '# Manual', 'docs/auto-1');

      expect(createOrUpdateFile).toHaveBeenCalledTimes(2);
      expect(createOrUpdateFile).toHaveBeenNthCalledWith(
        1, TOKEN, OWNER, REPO, 'README.md', '# Readme', expect.any(String), 'readme-sha', 'docs/auto-1'
      );
      expect(createOrUpdateFile).toHaveBeenNthCalledWith(
        2, TOKEN, OWNER, REPO, 'MANUAL_TECNICO.md', '# Manual', expect.any(String), 'manual-sha', 'docs/auto-1'
      );
    });

    it('usa SHA undefined cuando el fichero no existe (getFileContents lanza 404)', async () => {
      vi.mocked(getFileContents).mockRejectedValue(new Error('404'));
      vi.mocked(createOrUpdateFile).mockResolvedValue({ commit: { sha: 'c' } } as any);

      await writeDocFiles(TOKEN, OWNER, REPO, 'R', 'M');

      // sha undefined y branch undefined (commit directo)
      expect(createOrUpdateFile).toHaveBeenNthCalledWith(
        1, TOKEN, OWNER, REPO, 'README.md', 'R', expect.any(String), undefined, undefined
      );
      expect(createOrUpdateFile).toHaveBeenNthCalledWith(
        2, TOKEN, OWNER, REPO, 'MANUAL_TECNICO.md', 'M', expect.any(String), undefined, undefined
      );
    });
  });

  describe('buildDocsPrBody', () => {
    it('usa singular con 1 archivo', () => {
      const body = buildDocsPrBody('owner/repo', 1);
      expect(body).toContain('1 archivo analizado');
      expect(body).not.toContain('archivos analizados');
      expect(body).toContain('**owner/repo**');
      expect(body).toContain('`README.md`');
      expect(body).toContain('`MANUAL_TECNICO.md`');
    });

    it('usa plural con varios archivos', () => {
      const body = buildDocsPrBody('owner/repo', 42);
      expect(body).toContain('42 archivos analizados');
    });
  });

  describe('createDocsDraftPr', () => {
    it('orquesta rama por defecto → branch → ficheros → Draft PR', async () => {
      vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
      vi.mocked(getBranchSha).mockResolvedValue('base-sha');
      vi.mocked(createBranch).mockResolvedValue({} as any);
      vi.mocked(getFileContents).mockResolvedValue({ sha: 's' } as any);
      vi.mocked(createOrUpdateFile).mockResolvedValue({ commit: { sha: 'c' } } as any);
      vi.mocked(createPullRequest).mockResolvedValue({ number: 7, html_url: 'http://pr/7' } as any);

      const result = await createDocsDraftPr(
        TOKEN, OWNER, REPO,
        { readme: 'R', manualTecnico: 'M', filesAnalyzed: 3, repoName: 'owner/repo' },
        123
      );

      expect(getRepo).toHaveBeenCalledWith(TOKEN, OWNER, REPO);
      expect(getBranchSha).toHaveBeenCalledWith(TOKEN, OWNER, REPO, 'main');
      expect(createBranch).toHaveBeenCalledWith(TOKEN, OWNER, REPO, 'docs/auto-123', 'base-sha');
      // ficheros escritos en la rama nueva
      expect(createOrUpdateFile).toHaveBeenCalledTimes(2);
      expect(vi.mocked(createOrUpdateFile).mock.calls[0][8 - 1]).toBe('docs/auto-123'); // branch (8º arg)
      // Draft PR contra la rama por defecto, draft=true
      expect(createPullRequest).toHaveBeenCalledWith(
        TOKEN, OWNER, REPO, expect.any(String), 'docs/auto-123', 'main', expect.any(String), true
      );
      expect(result).toEqual({ pr: { number: 7, html_url: 'http://pr/7' }, branchName: 'docs/auto-123' });
    });
  });
});
