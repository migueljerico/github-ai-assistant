/**
 * Instruction Suggestions — Common templates and autocomplete suggestions
 * Used for #22: Autocompletado de instrucciones en el chat
 *
 * i18n (#24 Fase 3, v3.22.0): las plantillas se construyen vía `buildTemplates(t)`,
 * que traduce title/description/template al idioma activo. Los ids, categorías y
 * emojis son fijos (no se traducen).
 */

export interface InstructionTemplate {
  id: string;
  category: 'files' | 'issues' | 'prs' | 'branches' | 'workflows' | 'repos' | 'docs' | 'general';
  title: string;
  description: string;
  template: string;
  emoji: string;
}

/** Tipo de la función de traducción inyectada (mismo contrato que LanguageContext.t). */
type TFunc = (key: string, params?: Record<string, string | number>) => string;

/** Definición estática (id/categoría/emoji fijos) — el texto traducible va vía t(). */
interface TemplateDef {
  id: string;
  category: InstructionTemplate['category'];
  emoji: string;
}

const TEMPLATE_DEFS: TemplateDef[] = [
  // Files
  { id: 'create-readme', category: 'files', emoji: '📝' },
  { id: 'create-license', category: 'files', emoji: '⚖️' },
  { id: 'create-gitignore', category: 'files', emoji: '🚫' },
  { id: 'update-docs', category: 'docs', emoji: '📚' },
  // Issues
  { id: 'create-issue', category: 'issues', emoji: '🐛' },
  { id: 'list-issues', category: 'issues', emoji: '📋' },
  // Pull Requests
  { id: 'create-pr', category: 'prs', emoji: '🔀' },
  { id: 'list-prs', category: 'prs', emoji: '📊' },
  // Branches
  { id: 'create-branch', category: 'branches', emoji: '🌿' },
  { id: 'list-branches', category: 'branches', emoji: '🎋' },
  // Workflows
  { id: 'list-workflows', category: 'workflows', emoji: '⚙️' },
  { id: 'rerun-workflow', category: 'workflows', emoji: '🔄' },
  // Repos
  { id: 'create-repo', category: 'repos', emoji: '📦' },
  { id: 'list-repos', category: 'repos', emoji: '📚' },
  // General
  { id: 'analyze-repo', category: 'general', emoji: '🔍' },
  { id: 'generate-docs', category: 'docs', emoji: '📖' },
  { id: 'create-release', category: 'general', emoji: '🚀' },
  // #52: Modo Auditoría de Seguridad (vía chat normal con contexto del repo).
  { id: 'security-audit', category: 'general', emoji: '🛡️' },
];

/**
 * Construye las plantillas traducidas al idioma activo.
 * Recibe `t` (función de traducción) — patrón de inyección, no usa el hook directo,
 * para que el módulo siga siendo testeable de forma aislada.
 */
export function buildTemplates(t: TFunc): InstructionTemplate[] {
  return TEMPLATE_DEFS.map(def => ({
    id: def.id,
    category: def.category,
    emoji: def.emoji,
    title: t(`tmpl.${def.id}.title`),
    description: t(`tmpl.${def.id}.description`),
    template: t(`tmpl.${def.id}.template`),
  }));
}

/**
 * Filter instruction templates by search query.
 * Recibe `templates` (los ya traducidos) para poder filtrar en el idioma activo.
 *
 * @param query - Search query
 * @param templates - Templates (traducidos) sobre los que filtrar
 * @returns Matching templates
 */
export function filterInstructions(query: string, templates: InstructionTemplate[]): InstructionTemplate[] {
  if (!query.trim()) return templates;

  const lowerQuery = query.toLowerCase();
  return templates.filter(
    template =>
      template.title.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery) ||
      template.template.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get templates by category
 *
 * @param category - Category filter
 * @param templates - Templates (traducidos) sobre los que filtrar
 * @returns Templates in that category
 */
export function getTemplatesByCategory(
  category: InstructionTemplate['category'],
  templates: InstructionTemplate[]
): InstructionTemplate[] {
  return templates.filter(t => t.category === category);
}

/**
 * Get all unique categories present in the given templates.
 *
 * @param templates - Templates (traducidos) de los que extraer categorías
 * @returns Array of categories
 */
export function getAllCategories(templates: InstructionTemplate[]): InstructionTemplate['category'][] {
  const categories = new Set<InstructionTemplate['category']>();
  templates.forEach(t => categories.add(t.category));
  return Array.from(categories);
}
