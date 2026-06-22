// ────────────────────────────────────────────────────────────────────────────
// docPublisher — Publicación de la documentación generada por la IA.
// Encapsula la lógica de escribir README.md / MANUAL_TECNICO.md en un repo, ya
// sea como commit directo o como Draft Pull Request (#45). Sin dependencias de
// React → testeable de forma aislada.
// ────────────────────────────────────────────────────────────────────────────
import {
  getFileContents,
  createOrUpdateFile,
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
