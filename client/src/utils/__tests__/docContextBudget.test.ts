import { describe, it, expect } from 'vitest';
import {
  computeDocContextBudget,
  reduceDocBudget,
  canReduceDocBudget,
  selectDocFiles,
  docFilePriority,
  isReasoningModel,
  DOC_MAX_FILES,
  DOC_MAX_LINES_PER_FILE,
  DOC_MIN_LINES_PER_FILE,
  DOC_MIN_FILES,
  DOC_CONTENT_LINES_BUDGET,
  DOC_REASONING_CONTENT_LINES_BUDGET,
  DOC_LIGHT_BUDGET,
  DOC_FULL_TOKENS_OUTPUT,
} from '../docContextBudget';

describe('docContextBudget (#77 v4.0.51 — presupuesto adaptativo de contexto)', () => {
  describe('isReasoningModel', () => {
    it('detecta los modelos que piensan antes de responder', () => {
      expect(isReasoningModel('qwen/qwen3.8-27b')).toBe(true);
      expect(isReasoningModel('deepseek-r1')).toBe(true);
      expect(isReasoningModel('openai/o3-mini')).toBe(true);
      expect(isReasoningModel('o1-preview')).toBe(true);
      expect(isReasoningModel('openai/gpt-oss-20b')).toBe(true);
      expect(isReasoningModel('muse-spark-contributor-free')).toBe(true);
      expect(isReasoningModel('magistral-medium')).toBe(true);
      expect(isReasoningModel('kimi-k2-thinking')).toBe(true);
      expect(isReasoningModel('MY-REASONING-MODEL')).toBe(true);
    });

    it('no marca como modelos de razonamiento los modelos rápidos', () => {
      expect(isReasoningModel('llama-3.3-70b-versatile')).toBe(false);
      expect(isReasoningModel('gemini-2.5-flash')).toBe(false);
      expect(isReasoningModel('nova-lite-v1')).toBe(false);
      expect(isReasoningModel('gpt-4o-mini')).toBe(false);
      expect(isReasoningModel(undefined)).toBe(false);
      expect(isReasoningModel(null)).toBe(false);
      expect(isReasoningModel('')).toBe(false);
    });
  });

  describe('computeDocContextBudget — modo esencial (ligero)', () => {
    it('respeta la decisión explícita del usuario sin recortar más', () => {
      const budget = computeDocContextBudget({ model: 'qwen/qwen3.8-27b', fileCount: 200, lightMode: true });
      expect(budget).toEqual({
        maxFiles: DOC_LIGHT_BUDGET.maxFiles,
        maxLinesPerFile: DOC_LIGHT_BUDGET.maxLinesPerFile,
        maxTokensOutput: DOC_LIGHT_BUDGET.maxTokensOutput,
        reasons: ['light-mode'],
        reduced: true,
      });
    });
  });

  describe('computeDocContextBudget — modo completo', () => {
    it('no recorta un repo pequeño con un modelo rápido', () => {
      const budget = computeDocContextBudget({ model: 'llama-3.3-70b-versatile', fileCount: 12 });
      expect(budget.maxFiles).toBe(12);
      expect(budget.maxLinesPerFile).toBe(DOC_MAX_LINES_PER_FILE);
      expect(budget.maxTokensOutput).toBe(DOC_FULL_TOKENS_OUTPUT);
      expect(budget.reduced).toBe(false);
      expect(budget.reasons).toEqual([]);
    });

    it('aplica el techo de archivos en repos muy grandes', () => {
      const budget = computeDocContextBudget({ model: 'llama-3.3-70b-versatile', fileCount: 400 });
      expect(budget.maxFiles).toBe(DOC_MAX_FILES);
      expect(budget.maxLinesPerFile).toBe(DOC_MAX_LINES_PER_FILE);
      expect(budget.reduced).toBe(true);
      expect(budget.reasons).toContain('file-ceiling');
    });

    it('recorta las líneas solo cuando el presupuesto total lo exige (modelos de razonamiento)', () => {
      // Modelo rápido: el techo de archivos basta y cada archivo conserva sus 80 líneas.
      const normal = computeDocContextBudget({ model: 'llama-3.3-70b-versatile', fileCount: 120 });
      expect(normal.maxFiles).toBe(DOC_MAX_FILES);
      expect(normal.maxLinesPerFile).toBe(DOC_MAX_LINES_PER_FILE);
      expect(normal.reasons).toContain('file-ceiling');
      expect(normal.reasons).not.toContain('line-budget');

      // Modelo de razonamiento: el techo de contenido obliga a recortar líneas.
      const reasoning = computeDocContextBudget({ model: 'qwen/qwen3.8-27b', fileCount: 120 });
      expect(reasoning.maxLinesPerFile).toBeLessThan(DOC_MAX_LINES_PER_FILE);
      expect(reasoning.reasons).toContain('line-budget');
    });

    it('recorta a la mitad el contenido de los modelos de razonamiento', () => {
      const reasoning = computeDocContextBudget({ model: 'qwen/qwen3.8-27b', fileCount: 120 });
      const normal = computeDocContextBudget({ model: 'llama-3.3-70b-versatile', fileCount: 120 });
      expect(reasoning.maxLinesPerFile).toBeLessThan(normal.maxLinesPerFile);
      expect(reasoning.reasons).toContain('reasoning-model');
      // 60 archivos × 50 líneas = 3000 = presupuesto de razonamiento.
      expect(reasoning.maxFiles * reasoning.maxLinesPerFile).toBeLessThanOrEqual(
        DOC_REASONING_CONTENT_LINES_BUDGET,
      );
      expect(normal.maxFiles * normal.maxLinesPerFile).toBeLessThanOrEqual(DOC_CONTENT_LINES_BUDGET);
    });

    it('no recorta un repo pequeño aunque el modelo sea de razonamiento', () => {
      const budget = computeDocContextBudget({ model: 'qwen/qwen3.8-27b', fileCount: 8 });
      expect(budget.maxFiles).toBe(8);
      expect(budget.maxLinesPerFile).toBe(DOC_MAX_LINES_PER_FILE);
      expect(budget.reduced).toBe(false);
      // El motivo se registra aunque no llegue a recortar (trazabilidad).
      expect(budget.reasons).toEqual(['reasoning-model']);
    });

    it('respeta los suelos de líneas y archivos', () => {
      const budget = computeDocContextBudget({ model: 'qwen/qwen3.8-27b', fileCount: 100_000 });
      expect(budget.maxLinesPerFile).toBeGreaterThanOrEqual(DOC_MIN_LINES_PER_FILE);
      expect(budget.maxFiles).toBeGreaterThanOrEqual(DOC_MIN_FILES);
      expect(budget.maxFiles).toBeLessThanOrEqual(DOC_MAX_FILES);
    });

    it('gestiona un repositorio sin archivos sin romperse', () => {
      const budget = computeDocContextBudget({ model: 'llama', fileCount: 0 });
      expect(budget.maxFiles).toBe(0);
      expect(budget.maxLinesPerFile).toBe(DOC_MAX_LINES_PER_FILE);
      expect(budget.reduced).toBe(false);
    });
  });

  describe('reduceDocBudget / canReduceDocBudget', () => {
    it('recorta a la mitad sin bajar de los suelos', () => {
      const budget = computeDocContextBudget({ model: 'qwen/qwen3.8-27b', fileCount: 120 });
      const reduced = reduceDocBudget(budget);
      expect(reduced.maxFiles).toBe(Math.floor(budget.maxFiles / 2));
      expect(reduced.maxLinesPerFile).toBe(Math.max(DOC_MIN_LINES_PER_FILE, Math.floor(budget.maxLinesPerFile / 2)));
      expect(reduced.maxLinesPerFile).toBeLessThanOrEqual(budget.maxLinesPerFile);
      expect(reduced.maxTokensOutput).toBe(budget.maxTokensOutput);
      expect(reduced.reasons).toContain('retry-context-error');
      expect(reduced.reduced).toBe(true);
    });

    it('nunca aumenta el presupuesto (modo esencial)', () => {
      const light = computeDocContextBudget({ model: 'qwen/qwen3.8-27b', fileCount: 120, lightMode: true });
      const reduced = reduceDocBudget(light);
      expect(reduced.maxFiles).toBeLessThanOrEqual(light.maxFiles);
      expect(reduced.maxLinesPerFile).toBeLessThanOrEqual(light.maxLinesPerFile);
    });

    it('indica si queda margen para recortar más', () => {
      const budget = computeDocContextBudget({ model: 'llama', fileCount: 120 });
      expect(canReduceDocBudget(budget)).toBe(true);
      const floor = {
        maxFiles: DOC_MIN_FILES,
        maxLinesPerFile: DOC_MIN_LINES_PER_FILE,
        maxTokensOutput: DOC_FULL_TOKENS_OUTPUT,
        reasons: [] as never[],
        reduced: true,
      };
      expect(canReduceDocBudget(floor)).toBe(false);
    });
  });

  describe('docFilePriority / selectDocFiles', () => {
    it('prioriza README, manifiestos y código fuente por delante de tests', () => {
      expect(docFilePriority('README.md')).toBeLessThan(docFilePriority('package.json'));
      expect(docFilePriority('package.json')).toBeLessThan(docFilePriority('src/index.ts'));
      expect(docFilePriority('src/index.ts')).toBeLessThan(docFilePriority('docs/guide.md'));
      expect(docFilePriority('docs/guide.md')).toBeLessThan(docFilePriority('assets/logo.png'));
      expect(docFilePriority('assets/logo.png')).toBeLessThan(docFilePriority('src/foo.test.ts'));
      expect(docFilePriority('tests/e2e/login.spec.ts')).toBe(docFilePriority('src/foo.test.ts'));
    });

    it('reconoce manifiestos, proyectos .NET y markdown sueltos', () => {
      expect(docFilePriority('src/App.csproj')).toBe(1);
      expect(docFilePriority('Cargo.toml')).toBe(1);
      expect(docFilePriority('NOTES.md')).toBe(3);
      expect(docFilePriority('lib/util.py')).toBe(2);
      expect(docFilePriority('bin/data.bin')).toBe(4);
    });

    it('conserva todos los archivos si caben en el presupuesto', () => {
      const files = [{ path: 'a.ts' }, { path: 'b.ts' }];
      expect(selectDocFiles(files, 5)).toEqual(files);
      expect(selectDocFiles(files, 2)).toEqual(files);
    });

    it('selecciona los archivos esenciales y mantiene el orden del repo', () => {
      const files = [
        { path: 'tests/a.test.ts' },
        { path: 'src/main.ts' },
        { path: 'README.md' },
        { path: 'assets/logo.png' },
      ];
      const selected = selectDocFiles(files, 2);
      // Se quedan README y el código fuente, pero en el ORDEN del repositorio.
      expect(selected.map(f => f.path)).toEqual(['src/main.ts', 'README.md']);
    });

    it('devuelve lista vacía si el presupuesto es cero o negativo', () => {
      expect(selectDocFiles([{ path: 'a.ts' }], 0)).toEqual([]);
      expect(selectDocFiles([{ path: 'a.ts' }], -3)).toEqual([]);
    });

    it('empate de prioridad: la segunda clave del comparador ordena por índice original (#26, v4.0.52)', () => {
      // Los tres ficheros con score empatado fuerzan a evaluar
      // `a.score - b.score || a.index - b.index` hasta la segunda clave.
      const files = [
        { path: 'z/lib/a.ts' },   // 2
        { path: 'm/src/b.ts' },   // 2 (empate)
        { path: 'x/other/c.ts' }, // 2 (empate): el menor índice paramos aquí
      ];
      const selected = selectDocFiles(files, 2);
      expect(selected.map(f => f.path)).toEqual(['z/lib/a.ts', 'm/src/b.ts']);
    });
  });
});
