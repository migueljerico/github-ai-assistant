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
  createBlob,
  createTree,
  createCommit,
  updateRef,
} from './github';
import type { GitHubPullRequest } from '../types';

export const README_PATH = 'README.md';
export const MANUAL_PATH = 'MANUAL_TECNICO.md';
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
 *
 * @param signature - v3.31.0: firma de documentación ("Creado por @x y documentado
 *   por {IA}..."). Si se pasa, los commit messages la incluyen; si no, usan el
 *   mensaje histórico (retrocompatible con tests).
 */
export async function writeDocFiles(
  token: string,
  owner: string,
  repo: string,
  readme: string,
  manualTecnico: string,
  branch?: string,
  signature?: string,
  extraFiles?: File[]
): Promise<void> {
  const readmeMessage = signature ? `docs: generate README — ${signature}` : README_MESSAGE;
  const manualMessage = signature ? `docs: generate MANUAL_TECNICO — ${signature}` : MANUAL_MESSAGE;
  const readmeSha = await getExistingSha(token, owner, repo, README_PATH);
  await createOrUpdateFile(token, owner, repo, README_PATH, readme, readmeMessage, readmeSha, branch);

  const manualSha = await getExistingSha(token, owner, repo, MANUAL_PATH);
  await createOrUpdateFile(token, owner, repo, MANUAL_PATH, manualTecnico, manualMessage, manualSha, branch);

  // v3.67.3: sube archivos adjuntos (imágenes→screenshots/, datos→data/) al actualizar repo
  if (extraFiles && extraFiles.length > 0) {
    await commitExtras(token, owner, repo, { extraFiles }, branch);
  }
}

/** #58: escribe N documentos en el repo (array genérico de targets). */
export async function writeDocTargets(
  token: string,
  owner: string,
  repo: string,
  targets: DocTarget[],
  branch?: string,
  signature?: string
): Promise<void> {
  for (const target of targets) {
    const sha = await getExistingSha(token, owner, repo, target.path);
    const message = target.message
      || (signature ? `docs: ${target.path} — ${signature}` : `docs: ${target.path} generado por el Asistente de IA`);
    await createOrUpdateFile(token, owner, repo, target.path, target.content, message, sha, branch);
  }
}

/** Sanea el nombre de un fichero para usarlo como ruta de repo (normalizando acentos y sin espacios raros). */
function sanitizeRepoPath(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_') || 'archivo';
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']);
const DATA_EXTS = new Set(['xlsx', 'xls', 'csv', 'json', 'parquet']);

/** v3.66.0 (Frente D1): ¿es un archivo de imagen (por extensión)? */
export function isImageFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTS.has(ext);
}

/**
 * v3.66.0 (Frente D1): construye una sección Markdown "## Capturas" que ENLAZA
 * (sin visión — el modelo nunca ve los píxeles) las imágenes que se van a hospedar
 * en `screenshots/`. La ruta destino se calcula con `uploadPathFor` para que
 * coincida exactamente con donde `commitExtras` las sube.
 *
 * Sin imágenes → cadena vacía (no añade nada al documento).
 */
export function buildImageMarkdown(fileNames: string[], heading = '## 📸 Capturas'): string {
  const images = fileNames.filter(isImageFile);
  if (images.length === 0) return '';
  const lines = images.map(name => {
    const dest = uploadPathFor(name);
    const alt = name.replace(/\.[^.]+$/, '').replace(/[^\w\s-]+/g, ' ').trim() || 'captura';
    return `![${alt}](./${dest})`;
  });
  return `\n\n${heading}\n\n${lines.join('\n\n')}\n`;
}

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

/** #58: target individual de documentación para `writeDocTargets`. */
export interface DocTarget {
  path: string;       // ruta destino en el repo (p. ej. "MEJORAS_FUTURAS.md")
  content: string;    // markdown generado
  message?: string;   // commit message custom (opcional; si falta, se deriva del path)
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
  options: { draft?: boolean; sourceFile?: File; extraFiles?: File[]; signature?: string } = {},
  now: number = Date.now()
): Promise<PublishFileResult> {
  const signature = options.signature;
  const message = signature
    ? `docs: ${path} generado por ${signature}`
    : `docs: ${path} generado por el Asistente de IA`;

  // v3.66.0 (Frente D1): si entre los extras hay imágenes, se inserta una sección
  // "Capturas" al final del documento que las ENLAZA desde screenshots/ (donde
  // commitExtras las hospeda). Sin visión: el modelo nunca ve los píxeles; aquí
  // solo componemos el Markdown con la ruta de hospedaje coherente.
  const imageNames = (options.extraFiles ?? []).map(f => f.name);
  const finalContent = content + buildImageMarkdown(imageNames);

  if (!options.draft) {
    // Commit directo a la rama por defecto.
    const sha = await getExistingSha(token, owner, repo, path);
    await createOrUpdateFile(token, owner, repo, path, finalContent, message, sha);
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
  await createOrUpdateFile(token, owner, repo, path, finalContent, message, sha, branchName);
  await commitExtras(token, owner, repo, options, branchName);

  const prTitle = signature ? `docs: ${path} (generado por ${signature})` : `docs: ${path} (generado por IA)`;
  const prBody = signature
    ? `## 📄 Documentación generada\n\nEste Draft PR añade \`${path}\`, generado por ${signature} a partir de un archivo adjunto.\n\n> Revisa el contenido antes de mergear.`
    : `## 📄 Documentación generada\n\nEste Draft PR añade \`${path}\`, generado por el Asistente de IA a partir de un archivo adjunto.\n\n> Revisa el contenido antes de mergear.`;
  const pr = await createPullRequest(
    token,
    owner,
    repo,
    prTitle,
    branchName,
    baseBranch,
    prBody,
    true
  );
  return { pr, branchName };
}

/**
 * Construye el cuerpo (Markdown) del Draft PR de documentación.
 * @param signature - v3.31.0: firma de documentación para citar al proveedor/modelo.
 */
export function buildDocsPrBody(repoName: string, filesAnalyzed: number, signature?: string, paths?: string[]): string {
  const plural = filesAnalyzed !== 1;
  const byLine = signature
    ? `, generada por ${signature}`
    : ', generada por el Asistente de IA';
  const docs = paths && paths.length > 0
    ? paths.map(p => `- \`${p}\``).join('\n')
    : '- `README.md`\n- `MANUAL_TECNICO.md`';
  return [
    '## 📄 Documentación generada automáticamente',
    '',
    `Este Draft PR añade/actualiza la documentación de **${repoName}**${byLine} a partir de ${filesAnalyzed} archivo${plural ? 's' : ''} analizado${plural ? 's' : ''}.`,
    '',
    '### Archivos',
    docs,
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
  now: number = Date.now(),
  signature?: string
): Promise<DocsDraftPrResult> {
  const repoInfo = await getRepo(token, owner, repo);
  const baseBranch = repoInfo.default_branch;
  const baseSha = await getBranchSha(token, owner, repo, baseBranch);

  const branchName = `docs/auto-${now}`;
  await createBranch(token, owner, repo, branchName, baseSha);

  // El SHA existente viene de la base; coincide porque la rama se acaba de bifurcar.
  await writeDocFiles(token, owner, repo, docs.readme, docs.manualTecnico, branchName, signature);

  const pr = await createPullRequest(
    token,
    owner,
    repo,
    signature ? `docs: documentación generada por ${signature}` : 'docs: documentación generada por IA',
    branchName,
    baseBranch,
    buildDocsPrBody(docs.repoName, docs.filesAnalyzed, signature, ['README.md', 'MANUAL_TECNICO.md']),
    true
  );

  return { pr, branchName };
}

// ── #58 (a) Bulk multi-archivo atómico (Git Data API) ─────────────────────────
// A diferencia de writeDocTargets (1 commit PUT por archivo, en serie), estas
// funciones escriben N archivos en 1 único commit atómico vía Git Data API:
// createBlob (1 por archivo, en paralelo) → createTree → createCommit → updateRef.
// Si cualquier paso falla, el repo queda intacto (no se actualiza el ref).

/** Resultado de un bulk commit: SHA del commit creado. */
export interface BulkCommitResult {
  commitSha: string;
}

/**
 * Commit atómico de N `{path, content}` en 1 solo commit sobre `branch`.
 * #58 (a): orquesta los 4 pasos de Git Data API. Los blobs se crean en paralelo
 * (Promise.all); tree, commit y ref son secuenciales (dependen del anterior).
 *
 * @param branch - Rama destino (debe existir previamente).
 * @param message - Mensaje del commit.
 * @param files - Lista de `{path, content}` a escribir.
 * @returns SHA del commit creado.
 */
export async function commitMultipleFiles(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  message: string,
  files: { path: string; content: string }[]
): Promise<BulkCommitResult> {
  const baseSha = await getBranchSha(token, owner, repo, branch);
  // 1. Crear un blob por archivo (en paralelo para reducir latencia total).
  const blobs = await Promise.all(
    files.map((f) => createBlob(token, owner, repo, f.content))
  );
  // 2. Construir el tree apuntando a los blobs, sobre el árbol base actual.
  const items = files.map((f, i) => ({ path: f.path, sha: blobs[i].sha }));
  const tree = await createTree(token, owner, repo, baseSha, items);
  // 3. Crear el commit sobre el tree, con la rama base como parent.
  const commit = await createCommit(token, owner, repo, message, tree.sha, [baseSha]);
  // 4. Mover el ref al nuevo commit (force:false → falla si avanzó, sin sobrescribir).
  await updateRef(token, owner, repo, `heads/${branch}`, commit.sha);
  return { commitSha: commit.sha };
}

/** Construye el cuerpo del Draft PR de bulk listando los paths afectados. */
export function buildBulkPrBody(targets: DocTarget[], signature?: string): string {
  const byLine = signature ? `, generada por ${signature}` : ', generada por el Asistente de IA';
  const docs = targets.map((t) => `- \`${t.path}\``).join('\n');
  const plural = targets.length !== 1;
  return [
    '## 📄 Documentación bulk generada automáticamente',
    '',
    `Este Draft PR añade/actualiza **${targets.length} archivo${plural ? 's' : ''}**${byLine} en un único commit atómico.`,
    '',
    '### Archivos',
    docs,
    '',
    '> Revisa el contenido antes de marcar el PR como *Ready for review* y mergear.',
  ].join('\n');
}

/** Mensaje estándar para un commit bulk de N archivos. */
function bulkCommitMessage(targets: DocTarget[], signature?: string): string {
  const plural = targets.length !== 1;
  const tail = signature ? ` — ${signature}` : '';
  return `docs: bulk de ${targets.length} archivo${plural ? 's' : ''}${tail}`;
}

/**
 * Bulk commit directo a la rama por defecto del repo.
 * #58 (a): escribe N archivos en 1 commit atómico sobre `default_branch`.
 */
export async function publishBulkCommit(
  token: string,
  owner: string,
  repo: string,
  targets: DocTarget[],
  signature?: string
): Promise<BulkCommitResult> {
  const repoInfo = await getRepo(token, owner, repo);
  return commitMultipleFiles(
    token, owner, repo, repoInfo.default_branch,
    bulkCommitMessage(targets, signature), targets
  );
}

/**
 * Bulk como Draft PR: crea rama `docs/bulk-{now}`, commitea atómicamente N
 * archivos y abre el PR contra la rama por defecto.
 * #58 (a): paralelo a `createDocsDraftPr` pero para N archivos en 1 commit.
 *
 * @param now - Timestamp para el nombre de la rama (inyectable para tests).
 */
export async function publishBulkDraftPr(
  token: string,
  owner: string,
  repo: string,
  targets: DocTarget[],
  now: number = Date.now(),
  signature?: string
): Promise<DocsDraftPrResult> {
  const repoInfo = await getRepo(token, owner, repo);
  const baseBranch = repoInfo.default_branch;
  const baseSha = await getBranchSha(token, owner, repo, baseBranch);
  const branchName = `docs/bulk-${now}`;
  await createBranch(token, owner, repo, branchName, baseSha);
  await commitMultipleFiles(
    token, owner, repo, branchName,
    bulkCommitMessage(targets, signature), targets
  );
  const plural = targets.length !== 1;
  const pr = await createPullRequest(
    token, owner, repo,
    `docs: bulk de ${targets.length} archivo${plural ? 's' : ''}`,
    branchName, baseBranch,
    buildBulkPrBody(targets, signature),
    true
  );
  return { pr, branchName };
}
