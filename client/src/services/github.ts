import type { GitHubUser, GitHubRepo, GitHubFile } from '../types';
import { isRateLimitError, enhanceErrorWithRateLimit, parseRateLimitHeaders } from '../utils/rateLimitHandler';

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
  return res.json();
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
  sha?: string
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

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp', '.tiff',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.exe', '.bin', '.zip', '.tar', '.gz', '.rar', '.7z',
  '.pdf', '.
