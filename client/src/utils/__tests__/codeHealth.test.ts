import { describe, it, expect } from 'vitest';
import { languageDistribution, countTechnicalDebt, commitsByWeek } from '../codeHealth';

describe('languageDistribution', () => {
  it('cuenta archivos por lenguaje y ordena desc', () => {
    const result = languageDistribution([
      'src/a.ts', 'src/b.ts', 'src/c.tsx', 'src/d.py', 'README.md',
    ]);
    expect(result[0]).toEqual({ language: 'TypeScript', count: 3 });
    expect(result).toContainEqual({ language: 'Python', count: 1 });
    expect(result).toContainEqual({ language: 'Markdown', count: 1 });
  });

  it('ignora archivos sin extensión reconocida', () => {
    const result = languageDistribution(['LICENSE', 'bin/run', 'data.bin']);
    expect(result).toEqual([]);
  });

  it('agrupa la cola en "Otros" cuando hay más de 8 lenguajes', () => {
    const paths = ['a.ts', 'b.js', 'c.py', 'd.go', 'e.rs', 'f.rb', 'g.php', 'h.cs', 'i.swift', 'j.kt'];
    const result = languageDistribution(paths);
    expect(result.length).toBe(9); // 8 + "Otros"
    expect(result[result.length - 1].language).toBe('Otros');
    expect(result[result.length - 1].count).toBe(2); // swift + kotlin
  });
});

describe('countTechnicalDebt', () => {
  it('cuenta TODO/FIXME/HACK/XXX en el contenido', () => {
    const result = countTechnicalDebt([
      { path: 'a.ts', content: '// TODO: algo\n// FIXME: otra cosa' },
      { path: 'b.ts', content: 'const x = 1; // HACK\n// XXX revisar' },
      { path: 'c.ts', content: 'sin marcadores aquí' },
    ]);
    expect(result.total).toBe(4);
    expect(result.byFile).toEqual([
      { path: 'a.ts', count: 2 },
      { path: 'b.ts', count: 2 },
    ]);
  });

  it('no cuenta coincidencias parciales (usa \\b)', () => {
    const result = countTechnicalDebt([{ path: 'a.ts', content: 'TODOLIST mytodo FIXMEME' }]);
    expect(result.total).toBe(0);
  });

  it('ignora archivos sin contenido', () => {
    const result = countTechnicalDebt([{ path: 'a.ts' }, { path: 'b.ts', content: '' }]);
    expect(result.total).toBe(0);
    expect(result.byFile).toEqual([]);
  });
});

describe('commitsByWeek', () => {
  it('devuelve exactamente `weeks` semanas en orden cronológico', () => {
    const result = commitsByWeek([], 12);
    expect(result.length).toBe(12);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].weekStart > result[i - 1].weekStart).toBe(true);
    }
  });

  it('agrupa commits de la misma semana y rellena ceros', () => {
    const now = new Date();
    const iso = now.toISOString();
    const result = commitsByWeek([iso, iso, iso], 4);
    const total = result.reduce((acc, w) => acc + w.count, 0);
    expect(total).toBe(3);
    // La semana actual (última del array) tiene los 3 commits.
    expect(result[result.length - 1].count).toBe(3);
  });

  it('descarta fechas inválidas', () => {
    const result = commitsByWeek(['no-es-fecha', ''], 4);
    expect(result.reduce((acc, w) => acc + w.count, 0)).toBe(0);
  });
});
