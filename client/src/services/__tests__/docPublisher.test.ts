import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock del módulo github (igual patrón que actionExecutor.test.ts)
vi.mock('../github', () => ({
  getFileContents: vi.fn(),
  createOrUpdateFile: vi.fn(),
  createOrUpdateBinaryFile: vi.fn(),
  getRepo: vi.fn(),
  getBranchSha: vi.fn(),
  createBranch: vi.fn(),
  createPullRequest: vi.fn(),
  createBlob: vi.fn(),
  createTree: vi.fn(),
  createCommit: vi.fn(),
  updateRef: vi.fn(),
}));

import {
  getFileContents,
  createOrUpdateFile,
  createOrUpdateBinaryFile,
  getRepo,
  getBranchSha,
  createBranch,
  createPullRequest,
  createBlob,
  createTree,
  createCommit,
  updateRef,
} from '../github';
import { writeDocFiles, buildDocsPrBody, createDocsDraftPr, publishFileDoc, uploadPathFor, writeDocTargets, commitMultipleFiles, publishBulkCommit, publishBulkDraftPr, buildBulkPrBody } from '../docPublisher';

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
      vi.mocked(createOrUpdateFile).mockResolvedValue({ commit: { sha: 'c' }, content: { sha: 'c', name: 'x', path: 'x', type: 'file' } as any });

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
      vi.mocked(createOrUpdateFile).mockResolvedValue({ commit: { sha: 'c' }, content: { sha: 'c', name: 'x', path: 'x', type: 'file' } as any });

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

  describe('writeDocTargets (#58)', () => {
    it('escribe un solo target con SHA y rama', async () => {
      vi.mocked(getFileContents).mockResolvedValue({ sha: 's' } as any);
      vi.mocked(createOrUpdateFile).mockResolvedValue({ commit: { sha: 'c' }, content: { sha: 'c', name: 'x', path: 'x', type: 'file' } as any });

      await writeDocTargets(TOKEN, OWNER, REPO, [{ path: 'MEJORAS_FUTURAS.md', content: '# Roadmap' }], 'branch-x');

      expect(createOrUpdateFile).toHaveBeenCalledTimes(1);
      expect(createOrUpdateFile).toHaveBeenCalledWith(
        TOKEN, OWNER, REPO, 'MEJORAS_FUTURAS.md', '# Roadmap', expect.any(String), 's', 'branch-x'
      );
    });

    it('escribe varios targets en un solo publish', async () => {
      vi.mocked(getFileContents).mockResolvedValue({ sha: 's' } as any);
      vi.mocked(createOrUpdateFile).mockResolvedValue({ commit: { sha: 'c' }, content: { sha: 'c', name: 'x', path: 'x', type: 'file' } as any });

      await writeDocTargets(TOKEN, OWNER, REPO, [
        { path: 'README.md', content: '# R' },
        { path: 'CHANGELOG.md', content: '# C' },
        { path: 'docs/ARQUITECTURA.md', content: '# A' },
      ]);

      expect(createOrUpdateFile).toHaveBeenCalledTimes(3);
      expect(vi.mocked(createOrUpdateFile).mock.calls[0][3]).toBe('README.md');
      expect(vi.mocked(createOrUpdateFile).mock.calls[1][3]).toBe('CHANGELOG.md');
      expect(vi.mocked(createOrUpdateFile).mock.calls[2][3]).toBe('docs/ARQUITECTURA.md');
    });

    it('usa message custom si se provee, sino deriva del path', async () => {
      vi.mocked(getFileContents).mockResolvedValue({ sha: 's' } as any);
      vi.mocked(createOrUpdateFile).mockResolvedValue({ commit: { sha: 'c' }, content: { sha: 'c', name: 'x', path: 'x', type: 'file' } as any });
      const SIG = 'Creado por MiniMax M3';

      await writeDocTargets(TOKEN, OWNER, REPO, [
        { path: 'CHANGELOG.md', content: '# C', message: 'docs: changelog custom' },
        { path: 'MEJORAS_FUTURAS.md', content: '# M' },
      ], undefined, SIG);

      const messages = vi.mocked(createOrUpdateFile).mock.calls.map(c => c[5]);
      expect(messages[0]).toBe('docs: changelog custom');
      expect(messages[1]).toContain('MEJORAS_FUTURAS.md');
      expect(messages[1]).toContain(SIG);
    });

    it('update mode: usa SHA existente (no crea de nuevo)', async () => {
      vi.mocked(getFileContents).mockResolvedValue({ sha: 'existing-sha' } as any);
      vi.mocked(createOrUpdateFile).mockResolvedValue({ commit: { sha: 'c' }, content: { sha: 'c', name: 'x', path: 'x', type: 'file' } as any });

      await writeDocTargets(TOKEN, OWNER, REPO, [
        { path: 'README.md', content: '# Actualizado' },
      ]);

      expect(createOrUpdateFile).toHaveBeenCalledWith(
        TOKEN, OWNER, REPO, 'README.md', '# Actualizado', expect.any(String), 'existing-sha', undefined
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

    it('usa paths custom cuando se proveen (#58)', () => {
      const body = buildDocsPrBody('owner/repo', 3, undefined, ['README.md', 'CHANGELOG.md', 'docs/ARQUITECTURA.md']);
      expect(body).toContain('`README.md`');
      expect(body).toContain('`CHANGELOG.md`');
      expect(body).toContain('`docs/ARQUITECTURA.md`');
      expect(body).not.toContain('`MANUAL_TECNICO.md`');
    });
  });

  describe('createDocsDraftPr', () => {
    it('orquesta rama por defecto → branch → ficheros → Draft PR', async () => {
      vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
      vi.mocked(getBranchSha).mockResolvedValue('base-sha');
      vi.mocked(createBranch).mockResolvedValue({} as any);
      vi.mocked(getFileContents).mockResolvedValue({ sha: 's' } as any);
      vi.mocked(createOrUpdateFile).mockResolvedValue({ commit: { sha: 'c' }, content: { sha: 'c', name: 'x', path: 'x', type: 'file' } as any });
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

  describe('publishFileDoc (#28 Fase 2)', () => {
    it('commit directo: escribe UN fichero en la rama por defecto, sin PR', async () => {
      vi.mocked(getFileContents).mockResolvedValue({ sha: 'existing' } as any);
      vi.mocked(createOrUpdateFile).mockResolvedValue({ commit: { sha: 'c' }, content: { sha: 'c', name: 'x', path: 'x', type: 'file' } as any });

      const result = await publishFileDoc(TOKEN, OWNER, REPO, 'docs/notas.md', '# Doc', {});

      expect(createOrUpdateFile).toHaveBeenCalledTimes(1);
      expect(createOrUpdateFile).toHaveBeenCalledWith(
        TOKEN, OWNER, REPO, 'docs/notas.md', '# Doc', expect.any(String), 'existing'
      );
      // commit directo → no toca rama ni PR
      expect(createBranch).not.toHaveBeenCalled();
      expect(createPullRequest).not.toHaveBeenCalled();
      expect(result).toEqual({ pr: null, branchName: null });
    });

    it('Draft PR: bifurca rama, escribe el fichero en ella y abre el PR draft', async () => {
      vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
      vi.mocked(getBranchSha).mockResolvedValue('base-sha');
      vi.mocked(createBranch).mockResolvedValue({} as any);
      vi.mocked(getFileContents).mockRejectedValue(new Error('404')); // fichero nuevo
      vi.mocked(createOrUpdateFile).mockResolvedValue({ commit: { sha: 'c' }, content: { sha: 'c', name: 'x', path: 'x', type: 'file' } as any });
      vi.mocked(createPullRequest).mockResolvedValue({ number: 9, html_url: 'http://pr/9' } as any);

      const result = await publishFileDoc(TOKEN, OWNER, REPO, 'docs/notas.md', '# Doc', { draft: true }, 456);

      expect(createBranch).toHaveBeenCalledWith(TOKEN, OWNER, REPO, 'docs/file-456', 'base-sha');
      // fichero escrito en la rama nueva (8º arg) con sha undefined (no existía)
      expect(createOrUpdateFile).toHaveBeenCalledWith(
        TOKEN, OWNER, REPO, 'docs/notas.md', '# Doc', expect.any(String), undefined, 'docs/file-456'
      );
      // PR draft contra la rama por defecto
      expect(createPullRequest).toHaveBeenCalledWith(
        TOKEN, OWNER, REPO, expect.any(String), 'docs/file-456', 'main', expect.any(String), true
      );
      expect(result).toEqual({ pr: { number: 9, html_url: 'http://pr/9' }, branchName: 'docs/file-456' });
    });

    it('con sourceFile commitea también el binario (doc + archivo fuente) — #28 4a', async () => {
      vi.mocked(getFileContents).mockResolvedValue({ sha: 'existing' } as any);
      vi.mocked(createOrUpdateFile).mockResolvedValue({ commit: { sha: 'c' }, content: { sha: 'c', name: 'x', path: 'x', type: 'file' } as any });
      vi.mocked(createOrUpdateBinaryFile).mockResolvedValue({ commit: { sha: 'b' } } as any);
      const sourceFile = {
        name: 'informe miguel.pbit',
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      } as unknown as File;

      await publishFileDoc(TOKEN, OWNER, REPO, 'docs/notas.md', '# Doc', { sourceFile });

      expect(createOrUpdateFile).toHaveBeenCalledTimes(1); // el doc
      expect(createOrUpdateBinaryFile).toHaveBeenCalledTimes(1); // el binario
      // nombre saneado (sin espacios) en la raíz
      const args = vi.mocked(createOrUpdateBinaryFile).mock.calls[0];
      expect(args[3]).toBe('informe_miguel.pbit');
      expect(args[4]).toBeInstanceOf(Uint8Array);
    });

    it('con extraFiles commitea cada uno a su ruta por tipo — #28 4b', async () => {
      vi.mocked(getFileContents).mockResolvedValue({ sha: 'x' } as any);
      vi.mocked(createOrUpdateFile).mockResolvedValue({ commit: { sha: 'c' }, content: { sha: 'c', name: 'x', path: 'x', type: 'file' } as any });
      vi.mocked(createOrUpdateBinaryFile).mockResolvedValue({ commit: { sha: 'b' } } as any);
      const mk = (name: string) => ({ name, arrayBuffer: async () => new Uint8Array([1]).buffer }) as unknown as File;
      const extraFiles = [mk('captura.png'), mk('datos.xlsx'), mk('notas.txt')];

      await publishFileDoc(TOKEN, OWNER, REPO, 'docs/notas.md', '# Doc', { extraFiles });

      const paths = vi.mocked(createOrUpdateBinaryFile).mock.calls.map(c => c[3]);
      expect(paths).toEqual(['screenshots/captura.png', 'data/datos.xlsx', 'notas.txt']);
    });
  });
});

// ── Firma de documentación (v3.31.0) ─────────────────────────────────────────
describe('docPublisher — signature (v3.31.0)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const SIG = 'Creado por @migueljerico y documentado por Groq (llama) desde la App Asistente de IA';

  describe('writeDocFiles', () => {
    it('con signature, los commit messages la incluyen', async () => {
      vi.mocked(getFileContents).mockResolvedValue({ sha: 's' } as any);
      vi.mocked(createOrUpdateFile).mockResolvedValue({ commit: { sha: 'c' }, content: { sha: 'c', name: 'x', path: 'x', type: 'file' } as any });

      await writeDocFiles(TOKEN, OWNER, REPO, 'R', 'M', undefined, SIG);

      // El 6º arg de createOrUpdateFile es el message.
      const messages = vi.mocked(createOrUpdateFile).mock.calls.map(c => c[5]);
      expect(messages[0]).toContain('Creado por @migueljerico');
      expect(messages[1]).toContain('Creado por @migueljerico');
    });

    it('sin signature, usa el mensaje histórico (retrocompatible)', async () => {
      vi.mocked(getFileContents).mockResolvedValue({ sha: 's' } as any);
      vi.mocked(createOrUpdateFile).mockResolvedValue({ commit: { sha: 'c' }, content: { sha: 'c', name: 'x', path: 'x', type: 'file' } as any });

      await writeDocFiles(TOKEN, OWNER, REPO, 'R', 'M');

      const messages = vi.mocked(createOrUpdateFile).mock.calls.map(c => c[5]);
      expect(messages[0]).toBe('docs: generate README via Asistente de IA');
    });
  });

  describe('buildDocsPrBody', () => {
    it('con signature, cita al proveedor/modelo en el cuerpo', () => {
      const body = buildDocsPrBody('owner/repo', 5, SIG);
      expect(body).toContain('Creado por @migueljerico');
      expect(body).toContain('5 archivos analizados');
    });
  });
});

describe('uploadPathFor (#28 4b)', () => {
  it('imágenes → screenshots/, datos → data/, resto → raíz', () => {
    expect(uploadPathFor('captura.PNG')).toBe('screenshots/captura.PNG');
    expect(uploadPathFor('mi foto.jpg')).toBe('screenshots/mi_foto.jpg');
    expect(uploadPathFor('Empleados.xlsx')).toBe('data/Empleados.xlsx');
    expect(uploadPathFor('datos.csv')).toBe('data/datos.csv');
    expect(uploadPathFor('LICENSE.txt')).toBe('LICENSE.txt');
  });
});

// ── #58 (a) bulk multi-archivo atómico ────────────────────────────────────────
describe('#58 (a) bulk atómico (Git Data API)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('commitMultipleFiles', () => {
    it('ordena correctamente blob(paralelo) → tree → commit → updateRef', async () => {
      vi.mocked(getBranchSha).mockResolvedValueOnce('base-sha');
      vi.mocked(createBlob)
        .mockResolvedValueOnce({ sha: 'blob-a' })
        .mockResolvedValueOnce({ sha: 'blob-b' });
      vi.mocked(createTree).mockResolvedValueOnce({ sha: 'tree-sha' });
      vi.mocked(createCommit).mockResolvedValueOnce({ sha: 'commit-sha' });
      vi.mocked(updateRef).mockResolvedValueOnce(undefined);

      const out = await commitMultipleFiles(TOKEN, OWNER, REPO, 'main', 'msg', [
        { path: 'a.md', content: 'A' },
        { path: 'b.md', content: 'B' },
      ]);
      expect(out).toEqual({ commitSha: 'commit-sha' });
      expect(getBranchSha).toHaveBeenCalledWith(TOKEN, OWNER, REPO, 'main');
      expect(createBlob).toHaveBeenCalledTimes(2);
      expect(createTree).toHaveBeenCalledWith(TOKEN, OWNER, REPO, 'base-sha', [
        { path: 'a.md', sha: 'blob-a' },
        { path: 'b.md', sha: 'blob-b' },
      ]);
      expect(createCommit).toHaveBeenCalledWith(TOKEN, OWNER, REPO, 'msg', 'tree-sha', ['base-sha']);
      expect(updateRef).toHaveBeenCalledWith(TOKEN, OWNER, REPO, 'heads/main', 'commit-sha');
    });
  });

  describe('publishBulkCommit', () => {
    it('commitea atómicamente sobre default_branch', async () => {
      vi.mocked(getRepo).mockResolvedValueOnce({ default_branch: 'main' } as any);
      vi.mocked(getBranchSha).mockResolvedValueOnce('base-sha');
      vi.mocked(createBlob).mockResolvedValue({ sha: 'blob-x' });
      vi.mocked(createTree).mockResolvedValueOnce({ sha: 'tree-sha' });
      vi.mocked(createCommit).mockResolvedValueOnce({ sha: 'commit-sha' });
      vi.mocked(updateRef).mockResolvedValueOnce(undefined);

      const out = await publishBulkCommit(TOKEN, OWNER, REPO, [{ path: 'a.md', content: 'A' }]);
      expect(out.commitSha).toBe('commit-sha');
      // Verifica que el branch final es la default_branch
      expect(updateRef).toHaveBeenCalledWith(TOKEN, OWNER, REPO, 'heads/main', 'commit-sha');
    });
  });

  describe('publishBulkDraftPr', () => {
    it('crea rama docs/bulk-{now}, commitea y abre Draft PR', async () => {
      vi.mocked(getRepo).mockResolvedValueOnce({ default_branch: 'main' } as any);
      vi.mocked(getBranchSha).mockResolvedValueOnce('base-sha');
      vi.mocked(createBranch).mockResolvedValueOnce({} as any);
      vi.mocked(createBlob).mockResolvedValue({ sha: 'blob-y' });
      vi.mocked(createTree).mockResolvedValueOnce({ sha: 'tree-sha' });
      vi.mocked(createCommit).mockResolvedValueOnce({ sha: 'commit-sha' });
      vi.mocked(updateRef).mockResolvedValueOnce(undefined);
      vi.mocked(createPullRequest).mockResolvedValueOnce({ number: 7, html_url: 'https://x' } as any);

      const out = await publishBulkDraftPr(TOKEN, OWNER, REPO, [{ path: 'a.md', content: 'A' }], 12345);
      expect(createBranch).toHaveBeenCalledWith(TOKEN, OWNER, REPO, 'docs/bulk-12345', 'base-sha');
      expect(createPullRequest).toHaveBeenCalledWith(
        TOKEN, OWNER, REPO,
        expect.any(String),
        'docs/bulk-12345', 'main',
        expect.any(String),
        true
      );
      expect(out.pr.number).toBe(7);
      expect(out.branchName).toBe('docs/bulk-12345');
    });
  });

  describe('buildBulkPrBody', () => {
    it('lista los paths y cita N archivos', () => {
      const body = buildBulkPrBody([{ path: 'a.md', content: 'x' }, { path: 'b.md', content: 'y' }]);
      expect(body).toContain('2 archivos');
      expect(body).toContain('`a.md`');
      expect(body).toContain('`b.md`');
    });
    it('con signature, lo cita en el cuerpo', () => {
      const body = buildBulkPrBody([{ path: 'a.md', content: 'x' }], 'Creado por @x y documentado por IA');
      expect(body).toContain('Creado por @x');
    });
  });
});
