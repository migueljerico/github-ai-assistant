/**
 * Instruction Suggestions — Common templates and autocomplete suggestions
 * Used for #22: Autocompletado de instrucciones en el chat
 */

export interface InstructionTemplate {
  id: string;
  category: 'files' | 'issues' | 'prs' | 'branches' | 'workflows' | 'repos' | 'docs' | 'general';
  title: string;
  description: string;
  template: string;
  emoji: string;
}

export const INSTRUCTION_TEMPLATES: InstructionTemplate[] = [
  // Files
  {
    id: 'create-readme',
    category: 'files',
    title: 'Crear README',
    description: 'Generar un README profesional para el repositorio',
    template: 'Crea un README.md profesional que documente el proyecto, incluyendo descripción, instalación, uso y ejemplos.',
    emoji: '📝',
  },
  {
    id: 'create-license',
    category: 'files',
    title: 'Añadir Licencia',
    description: 'Crear un archivo de licencia (MIT, Apache, etc.)',
    template: 'Crea un archivo LICENSE con licencia MIT para el proyecto.',
    emoji: '⚖️',
  },
  {
    id: 'create-gitignore',
    category: 'files',
    title: 'Crear .gitignore',
    description: 'Generar un .gitignore apropiado para el lenguaje del proyecto',
    template: 'Crea un archivo .gitignore apropiado para un proyecto Node.js/TypeScript.',
    emoji: '🚫',
  },
  {
    id: 'update-docs',
    category: 'docs',
    title: 'Actualizar Documentación',
    description: 'Actualizar o mejorar la documentación existente',
    template: 'Revisa la documentación actual y sugiere mejoras. Luego actualiza los archivos necesarios.',
    emoji: '📚',
  },

  // Issues
  {
    id: 'create-issue',
    category: 'issues',
    title: 'Crear Issue',
    description: 'Crear un nuevo issue con descripción detallada',
    template: 'Crea un issue titulado "[Título]" con descripción detallada, pasos para reproducir y resultado esperado.',
    emoji: '🐛',
  },
  {
    id: 'list-issues',
    category: 'issues',
    title: 'Listar Issues',
    description: 'Ver todos los issues abiertos del repositorio',
    template: 'Lista todos los issues abiertos del repositorio y resume su estado.',
    emoji: '📋',
  },

  // Pull Requests
  {
    id: 'create-pr',
    category: 'prs',
    title: 'Crear Pull Request',
    description: 'Crear un PR desde una rama a main',
    template: 'Crea un pull request desde la rama [nombre-rama] a main con descripción clara de los cambios.',
    emoji: '🔀',
  },
  {
    id: 'list-prs',
    category: 'prs',
    title: 'Listar PRs',
    description: 'Ver todos los pull requests abiertos',
    template: 'Lista todos los pull requests abiertos y resume su estado.',
    emoji: '📊',
  },

  // Branches
  {
    id: 'create-branch',
    category: 'branches',
    title: 'Crear Rama',
    description: 'Crear una nueva rama de desarrollo',
    template: 'Crea una nueva rama llamada "feature/[nombre]" desde main.',
    emoji: '🌿',
  },
  {
    id: 'list-branches',
    category: 'branches',
    title: 'Listar Ramas',
    description: 'Ver todas las ramas del repositorio',
    template: 'Lista todas las ramas del repositorio y muestra su estado.',
    emoji: '🎋',
  },

  // Workflows
  {
    id: 'list-workflows',
    category: 'workflows',
    title: 'Ver Workflows',
    description: 'Listar workflows de GitHub Actions',
    template: 'Lista todos los workflows de GitHub Actions del repositorio.',
    emoji: '⚙️',
  },
  {
    id: 'rerun-workflow',
    category: 'workflows',
    title: 'Re-ejecutar Workflow',
    description: 'Re-ejecutar un workflow fallido',
    template: 'Re-ejecuta el último workflow fallido.',
    emoji: '🔄',
  },

  // Repos
  {
    id: 'create-repo',
    category: 'repos',
    title: 'Crear Repositorio',
    description: 'Crear un nuevo repositorio en GitHub',
    template: 'Crea un nuevo repositorio público llamado "[nombre]" con descripción "[descripción]".',
    emoji: '📦',
  },
  {
    id: 'list-repos',
    category: 'repos',
    title: 'Listar Repositorios',
    description: 'Ver todos los repositorios del usuario',
    template: 'Lista todos mis repositorios y muestra información básica de cada uno.',
    emoji: '📚',
  },

  // General
  {
    id: 'analyze-repo',
    category: 'general',
    title: 'Analizar Repositorio',
    description: 'Obtener análisis y recomendaciones del repositorio',
    template: '¿Cuál es tu opinión sobre la estructura y calidad de este repositorio? ¿Qué mejoras sugerirías?',
    emoji: '🔍',
  },
  {
    id: 'generate-docs',
    category: 'docs',
    title: 'Generar Documentación',
    description: 'Generar documentación técnica del repositorio',
    template: 'Genera documentación técnica completa del repositorio, incluyendo arquitectura, módulos principales y guía de contribución.',
    emoji: '📖',
  },
  {
    id: 'create-release',
    category: 'general',
    title: 'Crear Release',
    description: 'Crear un nuevo release con notas',
    template: 'Crea un release v[versión] con notas que resumen los cambios principales.',
    emoji: '🚀',
  },
];

/**
 * Filter instruction templates by search query
 * 
 * @param query - Search query
 * @returns Matching templates
 */
export function filterInstructions(query: string): InstructionTemplate[] {
  if (!query.trim()) return INSTRUCTION_TEMPLATES;
  
  const lowerQuery = query.toLowerCase();
  return INSTRUCTION_TEMPLATES.filter(
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
 * @returns Templates in that category
 */
export function getTemplatesByCategory(
  category: InstructionTemplate['category']
): InstructionTemplate[] {
  return INSTRUCTION_TEMPLATES.filter(t => t.category === category);
}

/**
 * Get all unique categories
 * 
 * @returns Array of categories
 */
export function getAllCategories(): InstructionTemplate['category'][] {
  const categories = new Set<InstructionTemplate['category']>();
  INSTRUCTION_TEMPLATES.forEach(t => categories.add(t.category));
  return Array.from(categories);
}
