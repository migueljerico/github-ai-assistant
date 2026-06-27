import { describe, it, expect } from 'vitest';
import { rankFilesByQuery, tokenize } from '../contextRanker';

const mk = (path: string, content: string) => ({ path, content, size: 0 });

describe('contextRanker (#49)', () => {
  describe('tokenize', () => {
    it('extrae términos alfanuméricos en minúscula (≥2)', () => {
      expect(tokenize('Hola, MUNDO.ts a')).toEqual(['hola', 'mundo', 'ts']);
    });
  });

  describe('rankFilesByQuery', () => {
    const files = [
      mk('client/src/App.tsx', 'export default function App() { return null }'),
      mk('MEJORAS_FUTURAS.md', 'roadmap del proyecto, mejoras pendientes y resueltas'),
      mk('README.md', 'github ai assistant, asistente de la api de github'),
      mk('client/src/services/__tests__/x.test.ts', 'import vitest describe it expect testing'),
    ];

    it('da prioridad al archivo MENCIONADO por nombre en la pregunta (caso del bug)', () => {
      const ranked = rankFilesByQuery('¿qué te parece MEJORAS_FUTURAS.md?', files, 2);
      expect(ranked[0].path).toBe('MEJORAS_FUTURAS.md');
    });

    it('rankea por contenido cuando no se menciona un archivo', () => {
      const ranked = rankFilesByQuery('vitest testing', files, 1);
      expect(ranked[0].path).toBe('client/src/services/__tests__/x.test.ts');
    });

    it('respeta topN', () => {
      expect(rankFilesByQuery('github', files, 2)).toHaveLength(2);
    });

    it('con la consulta sin términos útiles, conserva el orden de entrada', () => {
      const ranked = rankFilesByQuery('   ', files, 2);
      expect(ranked.map(f => f.path)).toEqual(['client/src/App.tsx', 'MEJORAS_FUTURAS.md']);
    });

    it('lista vacía → []', () => {
      expect(rankFilesByQuery('algo', [], 5)).toEqual([]);
    });
  });
});
