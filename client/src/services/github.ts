import type { GitHubUser, GitHubRepo, GitHubFile } from '../types';
import { isRateLimitError, enhanceErrorWithRateLimit, parseRateLimitHeaders } from '../utils/rateLimitHandler';
import { withTransientRetry } from '../utils/retry';

const BASE = 'https://api.github.com';

/**
 * Build the standard GitHub API request headers.
 * @param token - GitHub OAuth token or Personal Access Token
 */
function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/**
 * Custom error class for GitHub API errors with rate limit context
 */
export class GitHubAPIError extends Error {
  public readonly status: number;
  public readonly rateLimitInfo?: { resetTime: number; remainingSeconds: number };

  constructor(message: string, status: number, rateLimitInfo?: { resetTime: number; remainingSeconds: number }) {
    super(message);
    this.name = 'GitHubAPIError';
    this.status = status;
    this.rateLimitInfo = rateLimitInfo;
  }
}

/**
 * Shared fetch helper for the GitHub API.
 * Throws a GitHubAPIError with rate limit context on non-2xx responses.
 *
 * @param token  - GitHub OAuth token or PAT
 * @param path   - API path starting with `/` (e.g. `/user/repos`)
 * @param options - Optional fetch init (method, body, headers)
 * @returns Parsed JSON response as type T
 * @throws GitHubAPIError with rate limit info if applicable
 */
export async function ghFetch<T>(token: string, path: string, options?: RequestInit): Promise<T> {
  // #40: reintenta ante fallos transitorios de GitHub (5xx, red); NUNCA ante 4xx
  // (401/403/404/422) ni cancelaciones — `withTransientRetry` lo decide por status/patrón.
  return withTransientRetry(async () => {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: { ...headers(token), ...(options?.headers as Record<string, string> || {}) },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const errorMessage = body.message || `GitHub API ${res.status}: ${path}`;

      // Check for rate limit error
      if (isRateLimitError(res.status)) {
        const rateLimitInfo = parseRateLimitHeaders(res);
        const enhancedMessage = enhanceErrorWithRateLimit(res, errorMessage);
        throw new GitHubAPIError(enhancedMessage, res.status, {
          resetTime: rateLimitInfo.resetTime,
          remainingSeconds: rateLimitInfo.remainingSeconds,
        });
      }

      throw new GitHubAPIError(errorMessage, res.status);
    }
    return res.json() as Promise<T>;
  });
}

// ── Repos ─────────────────────────────────────────────────────────────────────

/**
 * Get the authenticated user's profile.
 * @param token - GitHub OAuth token or PAT
 */
export async function getUser(token: string): Promise<GitHubUser> {
  return ghFetch<GitHubUser>(token, '/user');
}

/**
 * List repositories for the authenticated user.
 * @param token - GitHub OAuth token or PAT
 */
export async function listUserRepos(token: string): Promise<GitHubRepo[]> {
  return ghFetch<GitHubRepo[]>(token, '/user/repos?per_page=100');
}

/**
 * Get a single repository's metadata (incluye `default_branch`).
 */
export async function getRepo(
  token: string,
  owner: string,
  repo: string
): Promise<GitHubRepo> {
  return ghFetch<GitHubRepo>(token, `/repos/${owner}/${repo}`);
}

// ── Commits & releases (para #34 — changelog automático) ─────────────────────

/** Resumen mínimo de un commit (lo único que necesita el changelog). */
export interface CommitSummary {
  sha: string;
  message: string;
}

/** Tag del último release publicado, o `null` si el repo aún no tiene releases. */
export async function getLatestReleaseTag(token: string, owner: string, repo: string): Promise<string | null> {
  try {
    const rel = await ghFetch<{ tag_name?: string }>(token, `/repos/${owner}/${repo}/releases/latest`);
    return rel.tag_name ?? null;
  } catch (err) {
    if (err instanceof GitHubAPIError && err.status === 404) return null; // sin releases aún
    throw err;
  }
}

/** Commits entre `base` y `head` (los que están en head y no en base), vía la Compare API. */
export async function compareCommits(token: string, owner: string, repo: string, base: string, head: string): Promise<CommitSummary[]> {
  const data = await ghFetch<{ commits?: Array<{ sha: string; commit: { message: string } }> }>(
    token, `/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
  );
  return (data.commits ?? []).map(c => ({ sha: c.sha, message: c.commit.message }));
}

/** Commits recientes de la rama por defecto (fallback cuando el repo no tiene releases). */
export async function listRecentCommits(token: string, owner: string, repo: string, perPage = 50): Promise<CommitSummary[]> {
  const data = await ghFetch<Array<{ sha: string; commit: { message: string } }>>(
    token, `/repos/${owner}/${repo}/commits?per_page=${perPage}`,
  );
  return data.map(c => ({ sha: c.sha, message: c.commit.message }));
}

/** Fechas (ISO) de los commits recientes — para el dashboard de salud (#44). */
export async function listCommitDates(token: string, owner: string, repo: string, perPage = 100): Promise<string[]> {
  const data = await ghFetch<Array<{ commit: { author?: { date?: string }; committer?: { date?: string } } }>>(
    token, `/repos/${owner}/${repo}/commits?per_page=${perPage}`,
  );
  return data
    .map(c => c.commit.author?.date ?? c.commit.committer?.date)
    .filter((d): d is string => !!d);
}

/**
 * Create a new repository for the authenticated user.
 * @param token - GitHub OAuth token or PAT (requires `repo` scope)
 * @param name - Repository name
 * @param description - Optional description
 * @param isPrivate - Whether the repo should be private
 */
export async function createRepo(
  token: string,
  name: string,
  description = '',
  isPrivate = false
): Promise<GitHubRepo> {
  return ghFetch<GitHubRepo>(token, '/user/repos', {
    method: 'POST',
    body: JSON.stringify({ name, description, private: isPrivate, auto_init: true }),
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * v3.31.0: actualiza metadatos de un repositorio existente (p. ej. el "about" /
 * descripción). Requiere permiso de admin sobre el repo. Usado por el flujo de
 * documentación para fijar la descripción del repo con el resumen + la firma.
 */
export async function updateRepo(
  token: string,
  owner: string,
  repo: string,
  fields: { description?: string }
): Promise<GitHubRepo> {
  return ghFetch<GitHubRepo>(token, `/repos/${owner}/${repo}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Comprueba si un repositorio existe y es accesible con el token. Devuelve `false`
 * solo ante un 404 (no existe o sin acceso); cualquier otro error se propaga.
 */
export async function repoExists(
  token: string,
  owner: string,
  repo: string
): Promise<boolean> {
  try {
    await getRepo(token, owner, repo);
    return true;
  } catch (err) {
    if (err instanceof GitHubAPIError && err.status === 404) return false;
    throw err;
  }
}

// ── Files ─────────────────────────────────────────────────────────────────────

/**
 * Read the contents of a single file from a repository.
 * The `content` field in the response is Base64-encoded — use `decodeBase64()` to decode it.
 *
 * @param token - GitHub OAuth token or PAT
 * @param owner - Repository owner (username or org)
 * @param repo  - Repository name
 * @param path  - File path within the repository (e.g. `src/index.ts`)
 * @returns The file metadata and Base64-encoded content
 * @throws Error if the file does not exist (404) or path is a directory
 */
export async function getFileContents(
  token: string,
  owner: string,
  repo: string,
  path: string
): Promise<GitHubFile> {
  return ghFetch<GitHubFile>(token, `/repos/${owner}/${repo}/contents/${path}`);
}

/**
 * Decode a Base64-encoded string returned by the GitHub contents API.
 * Handles the UTF-8 encoding correctly by going through `%xx` escape sequences
 * before calling `decodeURIComponent`, avoiding mojibake on non-ASCII characters.
 *
 * @param encoded - Base64 string (may contain whitespace/newlines as returned by GitHub)
 * @returns Decoded UTF-8 string
 */
export function decodeBase64(encoded: string): string {
  return decodeURIComponent(
    atob(encoded.replace(/\s/g, ''))
      .split('')
      .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Encode a UTF-8 string to Base64 as required by the GitHub contents API.
 * Uses `encodeURIComponent` + `unescape` to correctly handle non-ASCII characters
 * before passing to `btoa`.
 *
 * @param text - Plain UTF-8 text to encode
 * @returns Base64-encoded string ready for the GitHub API `content` field
 */
export function encodeBase64(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

/**
 * Codifica BYTES crudos a Base64 (para subir binarios: .pbit, .xlsx, imágenes…).
 * Procesa por chunks para no desbordar la pila con `String.fromCharCode(...bytes)`.
 */
export function encodeBase64Bytes(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000; // 32 KB por pasada
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Crea o actualiza un fichero BINARIO en el repo (a diferencia de
 * `createOrUpdateFile`, que codifica un string de texto). Sube los bytes tal cual.
 */
export async function createOrUpdateBinaryFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  bytes: Uint8Array,
  message: string,
  sha?: string,
  branch?: string
): Promise<{ commit: { sha: string }; content: GitHubFile }> {
  const body: Record<string, unknown> = {
    message,
    content: encodeBase64Bytes(bytes),
  };
  if (sha) body.sha = sha;
  if (branch) body.branch = branch;

  return ghFetch(token, `/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Create or update a file in a repository.
 *
 * - If `sha` is provided, this is an **update** (the SHA must match the current file).
 * - If `sha` is omitted, this is a **creation** (fails if the file already exists).
 *
 * @param token   - GitHub OAuth token or PAT (requires `repo` scope)
 * @param owner   - Repository owner
 * @param repo    - Repository name
 * @param path    - File path within the repository
 * @param content - New file content as a plain UTF-8 string (encoded internally)
 * @param message - Commit message
 * @param sha     - Current file SHA — required for updates, omit for new files
 * @returns Object containing the commit SHA and updated file metadata
 * @throws Error if SHA is wrong (409 Conflict) or permissions are insufficient
 */
export async function createOrUpdateFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha?: string,
  branch?: string
): Promise<{ commit: { sha: string }; content: GitHubFile }> {
  const body: Record<string, unknown> = {
    message,
    content: encodeBase64(content),
  };
  if (sha) body.sha = sha;
  if (branch) body.branch = branch;

  return ghFetch(token, `/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Delete a file from a repository.
 * Requires the current SHA of the file (obtain via `getFileContents()`).
 *
 * @param token   - GitHub OAuth token or PAT (requires `repo` scope)
 * @param owner   - Repository owner
 * @param repo    - Repository name
 * @param path    - File path within the repository
 * @param sha     - Current SHA of the file (from `getFileContents().sha`)
 * @param message - Commit message for the deletion
 * @throws Error if SHA doesn't match or file not found
 */
export async function deleteFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  sha: string,
  message: string
): Promise<void> {
  await ghFetch(token, `/repos/${owner}/${repo}/contents/${path}`, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha }),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Recursive repo tree ───────────────────────────────────────────────────────

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp', '.tiff',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.exe', '.bin', '.zip', '.tar', '.gz', '.rar', '.7z',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.mp3', '.mp4', '.avi', '.mov', '.mkv',
  '.pyc', '.pyo', '.class', '.so', '.dll', '.dylib',
  '.lock', // package-lock.json is text but often very large — handled by size check
]);

/** Maximum number of files to fetch content for in one "document repo" call */
const MAX_FILES = 120;

/** Maximum file size to include (in bytes). Files larger than this are skipped. */
const MAX_FILE_SIZE = 50 * 1024; // 50 KB

/**
 * Returns true if the file's extension is in the binary exclusion list.
 * @param filename - The bare filename (not a full path)
 */
function isBinary(filename: string): boolean {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * Priority score for sorting files before the 80-file limit is applied.
 * Lower numbers = higher priority = fetched first.
 *
 * Priority order:
 *   0 — README (most useful for context)
 *   1 — package.json (dependency context)
 *   2 — src/ directory (core implementation)
 *   3 — Config files (.json, .yaml, .toml, .env.example)
 *   4 — Source code files (.ts, .js, .py, etc.)
 *   5 — Everything else
 *
 * @param path - File path within the repository
 */
function priorityScore(path: string): number {
  const lower = path.toLowerCase();
  if (lower.match(/^readme/i)) return 0;
  if (lower === 'package.json') return 1;
  // #49: los docs de raíz (roadmap, manual, changelog, contributing) son contexto
  // valioso y antes caían fuera del cap por su baja prioridad; súbelos junto a package.json.
  if (/^(mejoras_futuras|manual_tecnico|changelog|contributing|claude)\.md$/i.test(lower)) return 1;
  if (lower.startsWith('src/')) return 2;
  if (lower.match(/\.(json|yaml|yml|toml|env\.example)$/)) return 3;
  if (lower.match(/\.(js|ts|jsx|tsx|py|go|rs|java|rb|php|cs)$/)) return 4;
  return 5;
}

/** A single file entry with decoded content, as returned by `fetchRepoTreeRecursive` */
export interface RepoTreeFile {
  path: string;
  content: string;
  size: number;
}

/** Result of `fetchRepoTreeRecursive`, including metadata about the scan */
export interface FetchTreeResult {
  /** Files with their decoded content (up to MAX_FILES entries) */
  files: RepoTreeFile[];
  /** Total number of eligible text files found (before the MAX_FILES cap) */
  totalScanned: number;
  /** True if the repo was too large and some files were not included */
  truncated: boolean;
  /** #49: rutas de TODOS los archivos de texto elegibles (árbol completo, sin contenido). */
  allPaths: string[];
}

/**
 * Fetch the complete file tree of a repository and download text file contents.
 *
 * @param token         - GitHub OAuth token or PAT
 * @param owner         - Repository owner
 * @param repo          - Repository name
 * @param defaultBranch - Branch to read from (default: 'main')
 * @returns Object with `files` array, `totalScanned` count, and `truncated` flag
 */
export async function fetchRepoTreeRecursive(
  token: string,
  owner: string,
  repo: string,
  defaultBranch = 'main'
): Promise<FetchTreeResult> {
  const treeRes = await ghFetch<{
    tree: Array<{ path: string; type: string; size?: number; sha: string }>;
    truncated: boolean;
  }>(token, `/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`);

  const allFiles = treeRes.tree
    .filter(item => item.type === 'blob')
    .filter(item => !isBinary(item.path.split('/').pop() || ''))
    .filter(item => (item.size ?? 0) <= MAX_FILE_SIZE);

  allFiles.sort((a, b) => priorityScore(a.path) - priorityScore(b.path));

  const truncated = allFiles.length > MAX_FILES || treeRes.truncated;
  const filesToFetch = allFiles.slice(0, MAX_FILES);

  const results: RepoTreeFile[] = [];
  for (let i = 0; i < filesToFetch.length; i += 5) {
    const batch = filesToFetch.slice(i, i + 5);
    const batchResults = await Promise.allSettled(
      batch.map(async (item) => {
        const file = await getFileContents(token, owner, repo, item.path);
        const content = file.content ? decodeBase64(file.content) : '';
        return { path: item.path, content, size: item.size ?? 0 };
      })
    );
    for (const result of batchResults) {
      if (result.status === 'fulfilled') results.push(result.value);
    }
  }

  // #49: el árbol COMPLETO de paths (todos los blobs de texto elegibles, sin el cap de
  // contenido) para que el modelo conozca TODOS los archivos del repo, no solo los 120.
  const allPaths = allFiles.map(f => f.path);

  return { files: results, totalScanned: allFiles.length, truncated, allPaths };
}


// ── Issues ────────────────────────────────────────────────────────────────────

import type { GitHubIssue, GitHubPullRequest, GitHubBranch, GitHubWorkflow, GitHubWorkflowRun } from '../types';

/**
 * List all issues in a repository.
 */
export async function listIssues(
  token: string,
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open'
): Promise<GitHubIssue[]> {
  return ghFetch<GitHubIssue[]>(token, `/repos/${owner}/${repo}/issues?state=${state}&per_page=100`);
}

/**
 * Create a new issue in a repository.
 */
export async function createIssue(
  token: string,
  owner: string,
  repo: string,
  title: string,
  body = '',
  labels: string[] = [],
  assignees: string[] = []
): Promise<GitHubIssue> {
  return ghFetch<GitHubIssue>(token, `/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    body: JSON.stringify({ title, body, labels, assignees }),
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Close or reopen an issue.
 */
export async function updateIssueState(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
  state: 'open' | 'closed'
): Promise<GitHubIssue> {
  return ghFetch<GitHubIssue>(token, `/repos/${owner}/${repo}/issues/${issueNumber}`, {
    method: 'PATCH',
    body: JSON.stringify({ state }),
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Add a comment to an issue.
 */
export async function commentOnIssue(
  token: string,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<{ id: number; body: string; created_at: string }> {
  return ghFetch(token, `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Comentarios / hilos (#32 — resumir hilos) ──────────────────────────────────

/** Tipo mínimo de un comentario de issue o PR (lo que necesita el resumen de hilos). */
export interface ThreadComment {
  id: number;
  body: string;
  user: { login: string } | null;
  created_at: string;
  path?: string;          // solo en comentarios de revisión de PR (sobre código)
  line?: number | null;   // idem
}

/**
 * Tipo mínimo de un issue o PR. GitHub trata los PRs como issues en el endpoint
 * `/issues/{n}`; la presencia de la clave `pull_request` indica que es un PR.
 */
export interface IssueOrPr {
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  user: { login: string } | null;
  pull_request?: unknown;
}

/**
 * Obtiene un issue o PR (título, cuerpo, estado). Si el resultado trae
 * `pull_request`, el "issue" es en realidad un Pull Request.
 */
export async function getIssueOrPr(
  token: string,
  owner: string,
  repo: string,
  number: number
): Promise<IssueOrPr> {
  return ghFetch<IssueOrPr>(token, `/repos/${owner}/${repo}/issues/${number}`);
}

/**
 * Obtiene TODOS los comentarios de conversación de un issue o PR (paginado).
 * Sirve tanto para issues como para PRs (la pestaña de conversación).
 */
export async function getIssueComments(
  token: string,
  owner: string,
  repo: string,
  number: number
): Promise<ThreadComment[]> {
  const all: ThreadComment[] = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    const batch = await ghFetch<ThreadComment[]>(
      token,
      `/repos/${owner}/${repo}/issues/${number}/comments?per_page=${perPage}&page=${page}`
    );
    all.push(...batch);
    if (batch.length < perPage) break;
    page++;
  }
  return all;
}

/**
 * Obtiene TODOS los comentarios de REVISIÓN (sobre código) de un PR (paginado).
 * Son distintos de los de conversación (getIssueComments): cuelgan de líneas
 * concretas del diff.
 */
export async function getPullReviewComments(
  token: string,
  owner: string,
  repo: string,
  number: number
): Promise<ThreadComment[]> {
  const all: ThreadComment[] = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    const batch = await ghFetch<ThreadComment[]>(
      token,
      `/repos/${owner}/${repo}/pulls/${number}/comments?per_page=${perPage}&page=${page}`
    );
    all.push(...batch);
    if (batch.length < perPage) break;
    page++;
  }
  return all;
}

// ── Pull Requests ─────────────────────────────────────────────────────────────

/**
 * List all pull requests in a repository.
 */
export async function listPullRequests(
  token: string,
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open'
): Promise<GitHubPullRequest[]> {
  return ghFetch<GitHubPullRequest[]>(token, `/repos/${owner}/${repo}/pulls?state=${state}&per_page=100`);
}

/**
 * Create a new pull request.
 */
export async function createPullRequest(
  token: string,
  owner: string,
  repo: string,
  title: string,
  head: string,
  base: string,
  body = '',
  draft = false
): Promise<GitHubPullRequest> {
  return ghFetch<GitHubPullRequest>(token, `/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    body: JSON.stringify({ title, head, base, body, draft }),
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Merge a pull request.
 */
export async function mergePullRequest(
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
  mergeMethod: 'merge' | 'squash' | 'rebase' = 'merge',
  commitTitle?: string,
  commitMessage?: string
): Promise<{ sha: string; merged: boolean; message: string }> {
  return ghFetch(token, `/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
    method: 'PUT',
    body: JSON.stringify({ merge_method: mergeMethod, commit_title: commitTitle, commit_message: commitMessage }),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Branches ──────────────────────────────────────────────────────────────────

/**
 * List all branches in a repository.
 */
export async function listBranches(
  token: string,
  owner: string,
  repo: string
): Promise<GitHubBranch[]> {
  return ghFetch<GitHubBranch[]>(token, `/repos/${owner}/${repo}/branches?per_page=100`);
}

/**
 * Get the HEAD commit SHA of a branch (vía git refs).
 * Útil para crear una rama nueva a partir de otra.
 */
export async function getBranchSha(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<string> {
  const res = await ghFetch<{ object: { sha: string } }>(
    token,
    `/repos/${owner}/${repo}/git/ref/heads/${branch}`
  );
  return res.object.sha;
}

/**
 * Create a new branch.
 */
export async function createBranch(
  token: string,
  owner: string,
  repo: string,
  branchName: string,
  sha: string
): Promise<GitHubBranch> {
  return ghFetch<GitHubBranch>(token, `/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Delete a branch.
 */
export async function deleteBranch(
  token: string,
  owner: string,
  repo: string,
  branchName: string
): Promise<void> {
  await ghFetch(token, `/repos/${owner}/${repo}/git/refs/heads/${branchName}`, {
    method: 'DELETE',
  });
}

// ── Workflows ─────────────────────────────────────────────────────────────────

/**
 * List all workflows in a repository.
 */
export async function listWorkflows(
  token: string,
  owner: string,
  repo: string
): Promise<GitHubWorkflow[]> {
  const result = await ghFetch<{ workflows: GitHubWorkflow[] }>(token, `/repos/${owner}/${repo}/actions/workflows`);
  return result.workflows;
}

/**
 * List workflow runs for a specific workflow.
 */
export async function listWorkflowRuns(
  token: string,
  owner: string,
  repo: string,
  workflowId: number | string,
  status?: string
): Promise<GitHubWorkflowRun[]> {
  let path = `/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs`;
  if (status) path += `?status=${status}`;
  const result = await ghFetch<{ workflow_runs: GitHubWorkflowRun[] }>(token, path);
  return result.workflow_runs;
}

/**
 * Trigger a workflow run (re-run a failed workflow).
 */
export async function triggerWorkflowRun(
  token: string,
  owner: string,
  repo: string,
  runId: number
): Promise<{ status: number }> {
  return ghFetch(token, `/repos/${owner}/${repo}/actions/runs/${runId}/rerun`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * List all repositories for the authenticated user with full pagination.
 * Makes multiple requests until all repos are retrieved.
 */
export async function listAllRepos(token: string): Promise<GitHubRepo[]> {
  const allRepos: GitHubRepo[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const repos = await ghFetch<GitHubRepo[]>(
      token,
      `/user/repos?per_page=${perPage}&page=${page}&sort=updated`
    );
    allRepos.push(...repos);
    if (repos.length < perPage) break;
    page++;
  }

  return allRepos;
}
