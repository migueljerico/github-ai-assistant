// ────────────────────────────────────────────────────────────────────────────
// docPublisher — Publicación de la documentación generada por la IA.
// Encapsula la lógica de escribir README.md / MANUAL_TECNICO.md en un repo, ya
// sea como commit directo o como Draft Pull Request (#45). Sin dependencias de
// React → testeable de forma aislada.
// ────────────────────────────────────────────────────────────────────────────
import {
  getFileContents,
  createOrUpdateFile,
  createOrUpdateBinaryFile,
  getRepo,
  getBranchSha,
  createBranch,
  createPullRequest,
} from './github';
import type { GitHubPullRequest } from '../types';

const README_PATH = 'README.md';
const MANUAL_PATH = 'MANUAL_TECNICO.md';
const README_MESSAGE = 'docs: generate README via Asistente de IA';
const MANUAL_MESSAGE = 'docs: generate MANUAL_TECNICO via Asistente de IA';

/** Datos de la documentación generada necesarios para publicarla. */
export interface DocsPayload {
  readme: string;
  manualTecnico: string;
  filesAnalyzed: number;
  repoName: string;
}

/** Resultado de crear el Draft PR de documentación. */
export interface DocsDraftPrResult {
  pr: GitHubPullRequest;
  branchName: string;
}

/**
 * Devuelve el SHA actual de un fichero, o `undefined` si no existe (fichero nuevo).
 * GitHub responde 404 cuando el fichero no está → se interpreta como "sin SHA".
 */
async function getExistingSha(
  token: string,
  owner: string,
  repo: string,
  path: string
): Promise<string | undefined> {
  try {
    const existing = await getFileContents(token, owner, repo, path);
    return existing.sha;
  } catch {
    return undefined;
  }
}

/**
 * Escribe README.md y MANUAL_TECNICO.md en el repositorio. Si se indica `branch`,
 * los commits van a esa rama; si no, a la rama por defecto.
 */
export async function writeDocFiles(
  token: string,
  owner: string,
  repo: string,
  readme: string,
  manualTecnico: string,
  branch?: string
): Promise<void> {
  const readmeSha = await getExistingSha(token, owner, repo, README_PATH);
  await createOrUpdateFile(token, owner, repo, README_PATH, readme, README_MESSAGE, readmeSha, branch);

  const manualSha = await getExistingSha(token, owner, repo, MANUAL_PATH);
  await createOrUpdateFile(token, owner, repo, MANUAL_PATH, manualTecnico, MANUAL_MESSAGE, manualSha, branch);
}

/** Sanea el nombre de un fichero para usarlo como ruta de repo (sin espacios raros). */
function sanitizeRepoPath(name: string): string {
  return name.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_') || 'archivo';
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']);
const DATA_EXTS = new Set(['xlsx', 'xls', 'csv', 'json', 'parquet']);

/**
 * Ruta destino en el repo para un archivo "extra" (#28 Fase 4b), según su tipo:
 * imágenes/capturas → `screenshots/`, datos (Excel/CSV…) → `data/`, el resto → raíz.
 */
export function uploadPathFor(fileName: string): string {
  const safe = sanitizeRepoPath(fileName);
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (IMAGE_EXTS.has(ext)) return `screenshots/${safe}`;
  if (DATA_EXTS.has(ext)) return `data/${safe}`;
  return safe;
}

/** Commitea un archivo binario en `path` (actualiza por SHA si existe). */
async function commitBinaryAt(
  token: string,
  owner: string,
  repo: string,
  file: File,
  path: string,
  branch?: string
): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha = await getExistingSha(token, owner, repo, path);
  await createOrUpdateBinaryFile(token, owner, repo, path, bytes, `feat: añade ${path}`, sha, branch);
}

/**
 * Commitea el archivo fuente (en la raíz) y los extras (imágenes→`screenshots/`,
 * datos→`data/`, resto→raíz) junto a la documentación (#28 Fase 4a/4b).
 */
async function commitExtras(
  token: string,
  owner: string,
  repo: string,
  opts: { sourceFile?: File; extraFiles?: File[] },
  branch?: string
): Promise<void> {
  if (opts.sourceFile) {
    await commitBinaryAt(token, owner, repo, opts.sourceFile, sanitizeRepoPath(opts.sourceFile.name), branch);
  }
  for (const extra of opts.extraFiles ?? []) {
    await commitBinaryAt(token, owner, repo, extra, uploadPathFor(extra.name), branch);
  }
}

/**
 * Sube una lista de archivos a un repositorio (commit directo por archivo, con
 * routing por tipo: imágenes→`screenshots/`, datos→`data/`, resto→raíz). Si un
 * fichero ya existe, se actualiza por SHA. Usado por el flujo "crear repo +
 * documentar" (#57 Tanda B) para poblar el repo recién creado antes de generar la
 * documentación, y reutilizable para "subir más archivos a un repo ya documentado".
 */
export async function uploadFilesToRepo(
  token: string,
  owner: string,
  repo: string,
  files: File[],
  branch?: string
): Promise<void> {
  await commitExtras(token, owner, repo, { extraFiles: files }, branch);
}

/** Resultado de publicar un fichero suelto (#28 Fase 2). */
export interface PublishFileResult {
  /** El PR creado (solo en modo Draft PR); `null` en commit directo. */
  pr: GitHubPullRequest | null;
  branchName: string | null;
}

/**
 * #28 Fase 2: publica UN fichero arbitrario (p. ej. `docs/notas.md`) en un repo,
 * como commit directo (rama por defecto) o como Draft PR. Reutiliza los wrappers
 * de github.ts. Devuelve el PR + rama cuando es Draft PR.
 *
 * @param now - Timestamp para el nombre de la rama (inyectable para tests).
 */
export async function publishFileDoc(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  options: { draft?: boolean; sourceFile?: File; extraFiles?: File[] } = {},
  now: number = Date.now()
): Promise<PublishFileResult> {
  const message = `docs: ${path} generado por el Asistente de IA`;

  if (!options.draft) {
    // Commit directo a la rama por defecto.
    const sha = await getExistingSha(token, owner, repo, path);
    await createOrUpdateFile(token, owner, repo, path, content, message, sha);
    await commitExtras(token, owner, repo, options);
    return { pr: null, branchName: null };
  }

  // Draft PR: bifurca la rama por defecto, escribe el fichero y abre el PR.
  const repoInfo = await getRepo(token, owner, repo);
  const baseBranch = repoInfo.default_branch;
  const baseSha = await getBranchSha(token, owner, repo, baseBranch);
  const branchName = `docs/file-${now}`;
  await createBranch(token, owner, repo, branchName, baseSha);

  const sha = await getExistingSha(token, owner, repo, path);
  await createOrUpdateFile(token, owner, repo, path, content, message, sha, branchName);
  await commitExtras(token, owner, repo, options, branchName);

  const pr = await createPullRequest(
    token,
    owner,
    repo,
    `docs: ${path} (generado por IA)`,
    branchName,
    baseBranch,
    `## 📄 Documentación generada\n\nEste Draft PR añade \`${path}\`, generado por el Asistente de IA a partir de un archivo adjunto.\n\n> Revisa el contenido antes de mergear.`,
    true
  );
  return { pr, branchName };
}

/** Construye el cuerpo (Markdown) del Draft PR de documentación. */
export function buildDocsPrBody(repoName: string, filesAnalyzed: number): string {
  const plural = filesAnalyzed !== 1;
  return [
    '## 📄 Documentación generada automáticamente',
    '',
    `Este Draft PR añade/actualiza la documentación de **${repoName}**, generada por el Asistente de IA a partir de ${filesAnalyzed} archivo${plural ? 's' : ''} analizado${plural ? 's' : ''}.`,
    '',
    '### Archivos',
    '- `README.md`',
    '- `MANUAL_TECNICO.md`',
    '',
    '> Revisa el contenido antes de marcar el PR como *Ready for review* y mergear.',
  ].join('\n');
}

/**
 * Orquesta la creación de un Draft PR con la documentación generada:
 * rama por defecto → rama `docs/auto-{now}` → escribe ambos ficheros → abre el
 * Draft PR contra la rama por defecto.
 *
 * @param now - Timestamp para el nombre de la rama (inyectable para tests).
 */
export async function createDocsDraftPr(
  token: string,
  owner: string,
  repo: string,
  docs: DocsPayload,
  now: number = Date.now()
): Promise<DocsDraftPrResult> {
  const repoInfo = await getRepo(token, owner, repo);
  const baseBranch = repoInfo.default_branch;
  const baseSha = await getBranchSha(token, owner, repo, baseBranch);

  const branchName = `docs/auto-${now}`;
  await createBranch(token, owner, repo, branchName, baseSha);

  // El SHA existente viene de la base; coincide porque la rama se acaba de bifurcar.
  await writeDocFiles(token, owner, repo, docs.readme, docs.manualTecnico, branchName);

  const pr = await createPullRequest(
    token,
    owner,
    repo,
    'docs: documentación generada por IA',
    branchName,
    baseBranch,
    buildDocsPrBody(docs.repoName, docs.filesAnalyzed),
    true
  );

  return { pr, branchName };
}
