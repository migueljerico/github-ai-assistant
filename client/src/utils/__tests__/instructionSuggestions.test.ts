import { describe, it, expect } from 'vitest';
import { buildTemplates, filterInstructions, getTemplatesByCategory, getAllCategories } from '../instructionSuggestions';

// t() de prueba: devuelve la clave tal cual ( patrón id-driven del módulo).
const t = (key: string) => key;

describe('instructionSuggestions (#22, #52)', () => {
  describe('buildTemplates', () => {
    it('incluye la plantilla security-audit con sus 3 campos (#52)', () => {
      const templates = buildTemplates(t);
      const audit = templates.find(t => t.id === 'security-audit');
      expect(audit).toBeDefined();
      expect(audit!.category).toBe('general');
      expect(audit!.emoji).toBe('🛡️');
      expect(audit!.title).toBe('tmpl.security-audit.title');
      expect(audit!.description).toBe('tmpl.security-audit.description');
      expect(audit!.template).toBe('tmpl.security-audit.template');
    });

    it('mapea cada TEMPLATE_DEF a title/description/template vía t() (id-driven)', () => {
      const templates = buildTemplates(t);
      for (const tmpl of templates) {
        expect(tmpl.title).toBe(`tmpl.${tmpl.id}.title`);
        expect(tmpl.description).toBe(`tmpl.${tmpl.id}.description`);
        expect(tmpl.template).toBe(`tmpl.${tmpl.id}.template`);
      }
    });

    it('devuelve al menos las 17 plantillas históricas + la nueva (#52)', () => {
      // 17 históricas (create-readme … create-release) + security-audit = 18.
      expect(buildTemplates(t).length).toBeGreaterThanOrEqual(18);
    });
  });

  describe('filterInstructions', () => {
    const templates = buildTemplates(t);

    it('query vacía → devuelve todas', () => {
      expect(filterInstructions('   ', templates)).toHaveLength(templates.length);
    });

    it('filtra por coincidencia en title/description/template (case-insensitive)', () => {
      const res = filterInstructions('security', templates);
      expect(res.some(t => t.id === 'security-audit')).toBe(true);
    });
  });

  describe('getTemplatesByCategory / getAllCategories', () => {
    const templates = buildTemplates(t);

    it('security-audit cae en "general"', () => {
      const general = getTemplatesByCategory('general', templates);
      expect(general.some(t => t.id === 'security-audit')).toBe(true);
    });

    it('getAllCategories no repite categorías', () => {
      const cats = getAllCategories(templates);
      expect(new Set(cats).size).toBe(cats.length);
    });
  });
});
