import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../github', () => ({
  getRepo: vi.fn(),
  getLatestReleaseTag: vi.fn(),
  compareCommits: vi.fn(),
  listRecentCommits: vi.fn(),
}));
vi.mock('../gemini', () => ({ callAI: vi.fn() }));

import { getRepo, getLatestReleaseTag, compareCommits, listRecentCommits } from '../github';
import { callAI } from '../gemini';
import { classifyCommits, generateChangelog } from '../changelogGenerator';

const CONFIG = { provider: 'groq', apiKey: 'k', model: 'm' } as any;
const mk = (message: string, sha = 's') => ({ sha, message });

describe('classifyCommits (#34)', () => {
  it('agrupa por prefijo Conventional Commits y descarta el cuerpo', () => {
    const out = classifyCommits([
      mk('feat: añade botón Detener\n\ncuerpo largo ignorado'),
      mk('feat(ui): nueva tarjeta'),
      mk('fix: corrige el crash'),
      mk('docs: actualiza README'),
      mk('refactor: limpia gemini.ts'),
      mk('chore: bump deps'),
    ]);
    const byTitle = Object.fromEntries(out.groups.map(g => [g.title, g.items]));
    expect(byTitle['✨ Novedades']).toEqual(['añade botón Detener', 'nueva tarjeta']);
    expect(byTitle['🐛 Correcciones']).toEqual(['corrige el crash']);
    expect(byTitle['📚 Documentación']).toEqual(['actualiza README']);
    expect(byTitle['🛠️ Mantenimiento']).toEqual(['limpia gemini.ts', 'bump deps']);
    expect(out.total).toBe(6);
  });

  it('los commits sin prefijo reconocido van a "otros"', () => {
    const out = classifyCommits([mk('cambios varios'), mk('WIP')]);
    expect(out.groups).toEqual([]);
    expect(out.otros).toEqual(['cambios varios', 'WIP']);
  });
});

describe('generateChangelog (#34)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('con release previo: usa compareCommits entre el tag y la rama por defecto', async () => {
    vi.mocked(getLatestReleaseTag).mockResolvedValue('v1.0.0');
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(compareCommits).mockResolvedValue([mk('feat: algo nuevo')]);
    vi.mocked(callAI).mockResolvedValue('## Novedades\n- Algo nuevo');

    const md = await generateChangelog('tok', 'o', 'r', CONFIG);

    expect(compareCommits).toHaveBeenCalledWith('tok', 'o', 'r', 'v1.0.0', 'main');
    expect(listRecentCommits).not.toHaveBeenCalled();
    // El userMessage incluye la categoría agrupada
    const userMsg = vi.mocked(callAI).mock.calls[0][0][0].content;
    expect(userMsg).toContain('✨ Novedades');
    expect(userMsg).toContain('algo nuevo');
    expect(md).toContain('Algo nuevo');
  });

  it('sin releases: cae a listRecentCommits', async () => {
    vi.mocked(getLatestReleaseTag).mockResolvedValue(null);
    vi.mocked(listRecentCommits).mockResolvedValue([mk('fix: bug')]);
    vi.mocked(callAI).mockResolvedValue('notas');

    await generateChangelog('tok', 'o', 'r', CONFIG);

    expect(listRecentCommits).toHaveBeenCalled();
    expect(compareCommits).not.toHaveBeenCalled();
  });

  it('filtra los commits de merge y lanza si no queda nada', async () => {
    vi.mocked(getLatestReleaseTag).mockResolvedValue('v1.0.0');
    vi.mocked(getRepo).mockResolvedValue({ default_branch: 'main' } as any);
    vi.mocked(compareCommits).mockResolvedValue([mk('Merge pull request #1 from x')]);

    await expect(generateChangelog('tok', 'o', 'r', CONFIG)).rejects.toThrow(/No hay commits nuevos desde el último release \(v1\.0\.0\)/);
    expect(callAI).not.toHaveBeenCalled();
  });

  it('limpia los fences de la respuesta del modelo', async () => {
    vi.mocked(getLatestReleaseTag).mockResolvedValue(null);
    vi.mocked(listRecentCommits).mockResolvedValue([mk('feat: x')]);
    vi.mocked(callAI).mockResolvedValue('```markdown\n## Notas\n- x\n```');

    const md = await generateChangelog('tok', 'o', 'r', CONFIG);
    expect(md).toBe('## Notas\n- x');
  });
});
