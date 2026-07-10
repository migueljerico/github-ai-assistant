import type { TemplateCategory } from '../../types';

/**
 * Lateral panel template definitions.
 *
 * i18n (#55): the static data (ids, emojis) lives in CATEGORY_DEFS / TEMPLATE_DEFS.
 * The translatable strings (name, description, instruction) are resolved at runtime
 * via buildTemplateCategories(t), mirroring the pattern in instructionSuggestions.ts.
 */

/** Tipo de la función de traducción inyectada (mismo contrato que LanguageContext.t). */
type TFunc = (key: string, params?: Record<string, string | number>) => string;

interface CategoryDef {
  id: string;
  emoji: string;
}

interface TemplateDef {
  id: string;
  category: string;
  emoji: string;
}

const CATEGORY_DEFS: CategoryDef[] = [
  { id: 'readme', emoji: '📖' },
  { id: 'gitignore', emoji: '🚫' },
  { id: 'licenses', emoji: '⚖️' },
];

const TEMPLATE_DEFS: TemplateDef[] = [
  // README
  { id: 'readme-python', category: 'readme', emoji: '📖' },
  { id: 'readme-nodejs', category: 'readme', emoji: '📖' },
  { id: 'readme-datascience', category: 'readme', emoji: '📖' },
  { id: 'readme-react', category: 'readme', emoji: '📖' },
  { id: 'readme-docs', category: 'readme', emoji: '📖' },
  // .gitignore
  { id: 'gitignore-python', category: 'gitignore', emoji: '🚫' },
  { id: 'gitignore-node', category: 'gitignore', emoji: '🚫' },
  { id: 'gitignore-java', category: 'gitignore', emoji: '🚫' },
  { id: 'gitignore-react', category: 'gitignore', emoji: '🚫' },
  // Licenses
  { id: 'license-mit', category: 'licenses', emoji: '⚖️' },
  { id: 'license-apache', category: 'licenses', emoji: '⚖️' },
  { id: 'license-gpl', category: 'licenses', emoji: '⚖️' },
];

/**
 * Construye las categorías de plantillas traducidas al idioma activo.
 * Recibe `t` (función de traducción) — patrón de inyección, no usa el hook directo,
 * para que el módulo siga siendo testeable de forma aislada.
 */
export function buildTemplateCategories(t: TFunc): TemplateCategory[] {
  // Agrupar plantillas por categoría
  const templatesByCategory = new Map<string, TemplateCategory['templates']>();
  for (const catDef of CATEGORY_DEFS) {
    templatesByCategory.set(catDef.id, []);
  }

  for (const tmplDef of TEMPLATE_DEFS) {
    const templates = templatesByCategory.get(tmplDef.category);
    if (templates) {
      templates.push({
        id: tmplDef.id,
        name: t(`tmpl_panel.tmpl_${tmplDef.id}.name`),
        description: t(`tmpl_panel.tmpl_${tmplDef.id}.description`),
        instruction: t(`tmpl_panel.tmpl_${tmplDef.id}.instruction`),
      });
    }
  }

  return CATEGORY_DEFS.map(catDef => ({
    id: catDef.id,
    name: t(`tmpl_panel.cat_${catDef.id}.name`),
    emoji: catDef.emoji,
    templates: templatesByCategory.get(catDef.id) ?? [],
  }));
}
