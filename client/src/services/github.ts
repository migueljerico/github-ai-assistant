// ─────────────────────────────────────────────────────────────────────────────
// GitHub REST API v3 — client wrapper
//
// All calls go directly from the browser using the authenticated user's token.
// No server proxy is involved for GitHub operations.
// API version: 2022-11-28 (pinned for stability)
// ─────────────────────────────────────────────────────────────────────────────

import type { GitHubUser, GitHubRepo, GitHubFile } from '../types';

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
 * Shared fetch helper for the GitHub API.
 * Throws an Error with GitHub's error message on non-2xx responses.
 *
 * @param token  - GitHub OAuth token or PAT
 * @param path   - API path starting with `/` (e.g. `/user/repos`)
 * @param options - Optional fetch init (method, body, headers)
 * @returns Parsed JSON response as type T
 * @throws Error with GitHub's `message` field or a generic HTTP status error
 */
export async function ghFetch<T>(token: string, path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers(token), ...(options?.headers as Record<string, string> || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `GitHub API ${res.status}: ${path}`);
  }
  return res.json();
}

// ── User ──────────────────────────────────────────────────────────────────────

/**
 * Fetch the authenticated user's GitHub profile.
 * Uses `GET /user` — requires at minimum the `user` scope.
 *
 * @param token - GitHub OAuth token or PAT
 * @returns The authenticated user's profile
 */
export async function getUser(token: string): Promise<GitHubUser> {
  return ghFetch<GitHubUser>(token, '/user');
}

// ── Repos ─────────────────────────────────────────────────────────────────────

/**
 * Fetch ALL repositories for the authenticated user, paginating automatically.
 *
 * Uses `GET /user/repos?per_page=100&sort=updated` and iterates pages
 * until a page returns fewer than 100 results (indicating the last page).
 *
 * @param token      - GitHub OAuth token or PAT
 * @param onProgress - Optional callback invoked after each page with the
 *                     running total of repos fetched so far
 * @returns Complete flat list of all repos, sorted by last-updated
 */
export async function listAllRepos(
  token: string,
  onProgress?: (count: number) => void
): Promise<GitHubRepo[]> {
  const allRepos: GitHubRepo[] = [];
  let page = 1;
  while (true) {
    const page_data = await ghFetch<GitHubRepo[]>(
      token,
      `/user/repos?per_page=100&page=${page}&sort=updated`
    );
    allRepos.push(...page_data);
    onProgress?.(allRepos.length);
    if (page_data.length < 100) break; // last page reached
    page++;
  }
  return allRepos;
}

/**
 * Create a new repository for the authenticated user.
 * Initializes the repo automatically (creates a default branch and README stub).
 *
 * @param token       - GitHub OAuth token or PAT (requires `repo` scope)
 * @param name        - Repository name (no spaces; use hyphens)
 * @param description - Optional description shown on the repo page
 * @param isPrivate   - Whether the repository should be private (default: false)
 * @returns The newly created repository object
 * @throws Error if the name is already taken or contains invalid characters
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
  sha?: string // required for updates, omit for creation
): Promise<{ commit: { sha: string }; content: GitHubFile }> {
  const body: Record<string, unknown> = {
    message,
    content: encodeBase64(content),
  };
  if (sha) body.sha = sha;

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

/**
 * File extensions that are treated as binary and excluded from analysis.
 * These files are not useful for AI documentation and can be very large.
 */
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
const MAX_FILES = 80;

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
}

/**
 * Fetch the complete file tree of a repository and download text file contents.
 *
 * Strategy:
 * 1. Uses the Git Trees API (`/git/trees/{branch}?recursive=1`) for efficient listing
 *    without downloading content upfront.
 * 2. Filters out binary files and files larger than MAX_FILE_SIZE.
 * 3. Sorts remaining files by priority score (README first, src/ second, etc.).
 * 4. Downloads content for the top MAX_FILES files in parallel batches of 5
 *    to avoid GitHub rate limit bursts.
 *
 * @param token         - GitHub OAuth token or PAT
 * @param owner         - Repository owner
 * @param repo          - Repository name
 * @param defaultBranch - Branch to read from (default: `'main'`)
 * @returns Object with `files` array, `totalScanned` count, and `truncated` flag
 * @throws Error if the repository or branch does not exist
 */
export async function fetchRepoTreeRecursive(
  token: string,
  owner: string,
  repo: string,
  defaultBranch = 'main'
): Promise<FetchTreeResult> {
  // Use Git Trees API for efficient recursive listing
  const treeRes = await ghFetch<{
    tree: Array<{ path: string; type: string; size?: number; sha: string }>;
    truncated: boolean;
  }>(token, `/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`);

  const allFiles = treeRes.tree
    .filter(item => item.type === 'blob')
    .filter(item => !isBinary(item.path.split('/').pop() || ''))
    .filter(item => (item.size ?? 0) <= MAX_FILE_SIZE);

  // Sort by priority so the most informative files are fetched first
  allFiles.sort((a, b) => priorityScore(a.path) - priorityScore(b.path));

  const truncated = allFiles.length > MAX_FILES || treeRes.truncated;
  const filesToFetch = allFiles.slice(0, MAX_FILES);

  // Fetch content in batches of 5 to respect GitHub's rate limits
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

  return { files: results, totalScanned: allFiles.length, truncated };
}


// ── Issues ────────────────────────────────────────────────────────────────────

import type { GitHubIssue, GitHubPullRequest, GitHubBranch, GitHubWorkflow, GitHubWorkflowRun } from '../types';

/**
 * List all issues in a repository.
 * 
 * @param token - GitHub OAuth token or PAT
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param state - Filter by state: 'open', 'closed', or 'all' (default: 'open')
 * @returns Array of issues
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
 * 
 * @param token - GitHub OAuth token or PAT (requires `repo` scope)
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param title - Issue title
 * @param body - Issue description (markdown)
 * @param labels - Optional array of label names
 * @param assignees - Optional array of assignee usernames
 * @returns The created issue
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
 * 
 * @param token - GitHub OAuth token or PAT
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param issueNumber - Issue number
 * @param state - 'open' to reopen, 'closed' to close
 * @returns The updated issue
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
 * 
 * @param token - GitHub OAuth token or PAT
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param issueNumber - Issue number
 * @param body - Comment text (markdown)
 * @returns The created comment
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

// ── Pull Requests ─────────────────────────────────────────────────────────────

/**
 * List all pull requests in a repository.
 * 
 * @param token - GitHub OAuth token or PAT
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param state - Filter by state: 'open', 'closed', or 'all' (default: 'open')
 * @returns Array of pull requests
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
 * 
 * @param token - GitHub OAuth token or PAT (requires `repo` scope)
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param title - PR title
 * @param head - Source branch name
 * @param base - Target branch name (usually 'main' or 'master')
 * @param body - PR description (markdown)
 * @param draft - Whether the PR should be marked as draft
 * @returns The created pull request
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
 * 
 * @param token - GitHub OAuth token or PAT
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @param mergeMethod - 'merge', 'squash', or 'rebase' (default: 'merge')
 * @param commitTitle - Optional custom commit title
 * @param commitMessage - Optional custom commit message
 * @returns Merge result
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
 * 
 * @param token - GitHub OAuth token or PAT
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Array of branches
 */
export async function listBranches(
  token: string,
  owner: string,
  repo: string
): Promise<GitHubBranch[]> {
  return ghFetch<GitHubBranch[]>(token, `/repos/${owner}/${repo}/branches?per_page=100`);
}

/**
 * Create a new branch.
 * 
 * @param token - GitHub OAuth token or PAT (requires `repo` scope)
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branchName - Name for the new branch
 * @param sha - SHA of the commit to branch from (usually the default branch)
 * @returns The created branch
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
 * 
 * @param token - GitHub OAuth token or PAT (requires `repo` scope)
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branchName - Name of the branch to delete
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
 * 
 * @param token - GitHub OAuth token or PAT
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Array of workflows
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
 * 
 * @param token - GitHub OAuth token or PAT
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param workflowId - Workflow ID or filename
 * @param status - Filter by status: 'queued', 'in_progress', 'completed', etc.
 * @returns Array of workflow runs
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
 * 
 * @param token - GitHub OAuth token or PAT (requires `repo` scope)
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param runId - Workflow run ID
 * @returns Result of the re-run request
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
