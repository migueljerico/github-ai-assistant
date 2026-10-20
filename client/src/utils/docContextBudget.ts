// ── #77 (v4.0.51): presupuesto adaptativo de contexto para la documentación ──
//
// El flujo de documentación completa (README + MANUAL_TECNICO) manda el código
// del repo al modelo en UNA sola llamada por documento. Con repositorios grandes
// y modelos de razonamiento esa llamada se pasa de tiempo (v4.0.44: "Tiempo de
// espera agotado" en `estudio-360-smart-learn-netlify` con Qwen 3.8 Max) o la
// rechaza el proveedor por TPM / longitud de contexto (v4.0.40: 413 de Groq).
//
// Este módulo calcula CUÁNTO contenido se envía, de forma pura y determinista:
//   • un techo de archivos con contenido (el árbol completo siempre viaja, así
//     que el modelo conoce la estructura aunque no lea todo el código);
//   • un reparto de líneas por archivo según el tamaño real del repo;
//   • un recorte extra para los modelos de razonamiento, que van más lentos.
//
// Es el mismo espíritu que el presupuesto adaptativo del chat (#50), pero
// calibrado para documentación: aquí el presupuesto se mide en LÍNEAS DE
// CONTENIDO (no en tokens, que dependen del proveedor) y el modo "ligero"
// explícito del usuario tiene prioridad absoluta.
//
// Módulo puro (sin dependencias ni acceso a red): se testea de forma aislada.

/** Motivos por los que el presupuesto de contexto se ha recortado. */
export type DocBudgetReason =
  | 'light-mode'          // el usuario pidió documentación esencial
  | 'reasoning-model'     // modelo de razonamiento: más lento por token
  | 'file-ceiling'        // el repo tiene más archivos que el techo
  | 'line-budget'         // se han recortado las líneas por archivo
  | 'retry-context-error'; // reintento tras un error de contexto excesivo

export interface DocContextBudget {
  /** Nº máximo de archivos cuyo CONTENIDO se envía al modelo. */
  maxFiles: number;
  /** Nº máximo de líneas por archivo. */
  maxLinesPerFile: number;
  /** Tokens de salida reservados para cada documento. */
  maxTokensOutput: number;
  /** Motivos del recorte (para explicárselo al usuario). */
  reasons: DocBudgetReason[];
  /** true si el contenido enviado se ha recortado respecto al repo completo. */
  reduced: boolean;
}

/** Techo de archivos con contenido (el árbol completo del repo siempre viaja). */
export const DOC_MAX_FILES = 60;
/** Techo de líneas por archivo (sin recorte). */
export const DOC_MAX_LINES_PER_FILE = 80;
/** Suelo de líneas por archivo: por debajo el archivo deja de ser legible. */
export const DOC_MIN_LINES_PER_FILE = 30;
/** Suelo de archivos: nunca se recorta por debajo de este número. */
export const DOC_MIN_FILES = 8;
/**
 * Techo de líneas de contenido para un modelo normal (~80k tokens). Por encima
 * de este volumen la llamada se alarga demasiado y el proveedor suele rejectear
 * o cortar por TPM.
 */
export const DOC_CONTENT_LINES_BUDGET = 6000;
/**
 * Techo para modelos de razonamiento: van más lentos por token (pienzan antes
 * de escribir), así que se les manda la mitad de contenido.
 */
export const DOC_REASONING_CONTENT_LINES_BUDGET = 3000;
/** Modo esencial (elegido explícitamente por el usuario). */
export const DOC_LIGHT_BUDGET = { maxFiles: 6, maxLinesPerFile: 40, maxTokensOutput: 2500 };
/** Tokens de salida del modo completo (v4.0.48: los modelos de razonamiento
 *  consumen parte del presupuesto pensando y con 8192 devolvían content vacío). */
export const DOC_FULL_TOKENS_OUTPUT = 16384;

/**
 * Modelos que "piensan" antes de responder: consumen tokens extra en el think
 * interno y van más lentos por token. Se detectan por el id del modelo (el
 * proveedor no expone una capacidad formal de razonamiento).
 */
const REASONING_MODEL_PATTERNS: RegExp[] = [
  /reasoning/i,
  /thinking/i,
  // OpenAI o1 / o3 / o4 (-mini): el id puede venir con prefijo de proveedor.
  /(^|[^a-z0-9])o[134]([^a-z0-9]|$)/,
  // deepseek-r1, qwen-r1, seed-r1… (familias "r1").
  /(^|[^a-z0-9])r1([^a-z0-9]|$)/,
  /gpt-oss/i,      // OpenAI gpt-oss razona por defecto
  /muse-spark/i,   // OpenCode Zen: ~1100 tokens de think interno (v4.0.46)
  /qwen3/i,        // familia Qwen3 (modo think)
  /magistral/i,    // Mistral reasoning
];

/** ¿El id del modelo corresponde a un modelo de razonamiento? */
export function isReasoningModel(model?: string | null): boolean {
  if (!model) return false;
  const id = model.toLowerCase();
  return REASONING_MODEL_PATTERNS.some((re) => re.test(id));
}

/**
 * Calcula el presupuesto de contexto (archivos / líneas / tokens de salida)
 * para la generación de documentación.
 */
export function computeDocContextBudget(params: {
  /** Id del modelo que va a generar los documentos. */
  model?: string | null;
  /** Nº de archivos del repositorio. */
  fileCount: number;
  /** El usuario ha pedido el modo esencial (ligero). */
  lightMode?: boolean;
}): DocContextBudget {
  // El modo esencial es una decisión explícita del usuario: no se recorta más.
  if (params.lightMode) {
    return {
      maxFiles: DOC_LIGHT_BUDGET.maxFiles,
      maxLinesPerFile: DOC_LIGHT_BUDGET.maxLinesPerFile,
      maxTokensOutput: DOC_LIGHT_BUDGET.maxTokensOutput,
      reasons: ['light-mode'],
      reduced: true,
    };
  }

  const fileCount = Math.max(0, params.fileCount);
  const reasoning = isReasoningModel(params.model);
  const totalLines = reasoning
    ? DOC_REASONING_CONTENT_LINES_BUDGET
    : DOC_CONTENT_LINES_BUDGET;

  // Archivos candidatos: como mucho DOC_MAX_FILES (el árbol completo siempre
  // se envía, así que el modelo conoce la estructura del repo completa).
  const candidateFiles = Math.min(fileCount, DOC_MAX_FILES);
  // Líneas por archivo: las que caben en el presupuesto si queremos incluir a
  // TODOS los candidatos, entre el suelo de legibilidad (30) y el techo (80).
  const affordableLines = candidateFiles > 0
    ? Math.floor(totalLines / candidateFiles)
    : DOC_MAX_LINES_PER_FILE;
  const maxLinesPerFile = Math.min(
    DOC_MAX_LINES_PER_FILE,
    Math.max(DOC_MIN_LINES_PER_FILE, affordableLines),
  );
  // Archivos: los que caben en el presupuesto con esas líneas (con suelo).
  const affordableFiles = Math.max(DOC_MIN_FILES, Math.floor(totalLines / maxLinesPerFile));
  const maxFiles = Math.min(candidateFiles, affordableFiles);

  const reasons: DocBudgetReason[] = [];
  if (reasoning) reasons.push('reasoning-model');
  if (maxFiles < fileCount) reasons.push('file-ceiling');
  if (maxLinesPerFile < DOC_MAX_LINES_PER_FILE) reasons.push('line-budget');

  return {
    maxFiles,
    maxLinesPerFile,
    maxTokensOutput: DOC_FULL_TOKENS_OUTPUT,
    reasons,
    reduced: maxFiles < fileCount || maxLinesPerFile < DOC_MAX_LINES_PER_FILE,
  };
}

/** ¿Se puede recortar más el presupuesto (reintento tras contexto excesivo)? */
export function canReduceDocBudget(budget: DocContextBudget): boolean {
  return budget.maxFiles > DOC_MIN_FILES || budget.maxLinesPerFile > DOC_MIN_LINES_PER_FILE;
}

/**
 * Recorta el presupuesto a la mitad (archivos y líneas) para reintentar tras
 * un error de contexto excesivo (TPM / longitud máxima). NUNCA aumenta nada:
 * el presupuesto resultante es siempre ≤ el actual.
 */
export function reduceDocBudget(budget: DocContextBudget): DocContextBudget {
  const maxFiles = Math.min(budget.maxFiles, Math.max(DOC_MIN_FILES, Math.floor(budget.maxFiles / 2)));
  const maxLinesPerFile = Math.min(
    budget.maxLinesPerFile,
    Math.max(DOC_MIN_LINES_PER_FILE, Math.floor(budget.maxLinesPerFile / 2)),
  );
  return {
    maxFiles,
    maxLinesPerFile,
    // El presupuesto de salida NO se toca: está calibrado para que los modelos
    // de razonamiento no devuelvan content vacío (v4.0.48).
    maxTokensOutput: budget.maxTokensOutput,
    reasons: [...budget.reasons, 'retry-context-error'],
    reduced: true,
  };
}

/** Ficheros de configuración/manifiesto: definen el stack del proyecto. */
const MANIFEST_FILES = new Set([
  'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
  'pyproject.toml', 'requirements.txt', 'setup.py', 'setup.cfg', 'pipfile',
  'cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'build.gradle.kts',
  'composer.json', 'gemfile', 'dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
  'makefile', 'tsconfig.json', 'vite.config.ts', 'next.config.js', 'nuxt.config.ts',
]);

/**
 * Prioridad de un archivo para la documentación: cuanto más bajo, más esencial.
 * Se usa para decidir a quién se le recorta el contenido cuando el repo tiene
 * más archivos de los que caben en el presupuesto.
 */
export function docFilePriority(path: string): number {
  const p = path.toLowerCase();
  const base = p.slice(p.lastIndexOf('/') + 1);
  if (/^readme(\.|$)/.test(base)) return 0;
  if (MANIFEST_FILES.has(base) || /\.(csproj|sln)$/.test(base)) return 1;
  // Pruebas y ejemplos: útiles pero no documentan la arquitectura.
  if (/(^|\/)(tests?|__tests__|spec|specs|e2e|examples?|fixtures)(\/|$)/.test(p)) return 5;
  if (/\.(test|spec)\.[a-z0-9]+$/.test(base)) return 5;
  // Código fuente: el corazón del manual técnico.
  if (/(^|\/)(src|lib|app|apps|server|client|api|core|internal|pkg|cmd|packages)(\/|$)/.test(p)) return 2;
  if (/(^|\/)(docs?|documentation)(\/|$)/.test(p)) return 3;
  if (/\.(md|mdx|rst|txt)$/.test(base)) return 3;
  return 4;
}

/**
 * Selecciona los archivos cuyo contenido se enviarán al modelo respetando el
 * presupuesto: si caben todos, se conservan; si no, se priorizan los más
 * esenciales (README, manifiestos, código fuente) y se mantiene el orden
 * original del repositorio.
 */
export function selectDocFiles<T extends { path: string }>(files: T[], maxFiles: number): T[] {
  if (maxFiles <= 0) return [];
  if (files.length <= maxFiles) return files;
  const ranked = files
    .map((file, index) => ({ file, index, score: docFilePriority(file.path) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, maxFiles)
    .sort((a, b) => a.index - b.index)
    .map(entry => entry.file);
  return ranked;
}
