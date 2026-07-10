// ────────────────────────────────────────────────────────────────────────────
// Action Executor — executes confirmed GeminiAction objects via the GitHub API
//
// ARCHITECTURE NOTE:
// The executor runs ONLY after the user has explicitly confirmed the action in
// the ConfirmModal. It never runs automatically. This two-step flow
// (AI proposes → user confirms → executor runs) is the core safety guarantee.
//
// Placeholder resolution:
// The AI sometimes generates endpoint strings with literal placeholders like
// `/users/{username}/repos`. resolveEndpoint() substitutes these with real
// values before making any API call, so the GitHub API always receives a valid URL.
// ────────────────────────────────────────────────────────────────────────────

import type { GeminiAction, GitHubRepo, HistoryStatus } from '../types';
import {
  createRepo,
  createOrUpdateFile,
  deleteFile,
  getFileContents,
  decodeBase64,
  listAllRepos,
  ghFetch,
  updateIssueState,
  commentOnIssue,
  mergePullRequest,
  triggerWorkflowRun,
} from './github';

/** Result of a single action execution */
export interface ExecutionResult {
  success: boolean;
  message: string;
  /** Optional structured data returned by the API (repos list, file content, etc.) */
  data?: unknown;
}

/** Callbacks for multi-repo execution to report progress per-repo */
export interface ExecutionCallbacks {
  /**
   * Called after each repo is processed.
   * @param repo    - The repo's full_name (owner/repo)
   * @param status  - Current status of this repo's action
   * @param message - Human-readable status message
   */
  onProgress?: (repo: string, status: HistoryStatus, message: string) => void;
}

/**
 * Parse a repo reference into { owner, repo } components.
 *
 * Handles three formats:
 * - `null` or empty → uses the authenticated user's login, repo = ''
 * - `"owner/repo"` → splits on the first slash
 * - `"reponame"` → uses authenticated user as owner
 *
 * @param repoFullName - Repo name from the AI action (may be null, "name", or "owner/name")
 * @param user         - The authenticated GitHub user (provides the default owner)
 */
function parseRepoTarget(
  repoFullName: string | null,
  user: { login: string }
): { owner: string; repo: string } {
  if (!repoFullName) return { owner: user.login, repo: '' };
  if (repoFullName.includes('/')) {
    const [owner, repo] = repoFullName.split('/');
    return { owner, repo };
  }
  return { owner: user.login, repo: repoFullName };
}

/**
 * Replace placeholder tokens in an endpoint string with real values.
 *
 * The AI is instructed to never use placeholders, but may still produce them.
 * This function acts as a safety net by substituting known placeholder patterns:
 *
 *   `{username}` → authenticated user's login
 *   `{owner}`    → the resolved repository owner
 *   `{repo}`     → the resolved repository name
 *   `{path}`     → removed (empty string)
 *   `{branch}`   → `HEAD` (safe fallback for any branch)
 *
 * @param endpoint    - Raw endpoint string from the AI action
 * @param user        - Authenticated GitHub user (provides the username)
 * @param repoTarget  - Resolved owner/repo for the target repository
 * @returns Endpoint string with all placeholders replaced by real values
 */
function resolveEndpoint(
  endpoint: string,
  user: { login: string },
  repoTarget: { owner: string; repo: string }
): string {
  return endpoint
    .replace(/\{username\}/g, user.login)
    .replace(/\{owner\}/g, repoTarget.owner || user.login)
    .replace(/\{repo\}/g, repoTarget.repo)
    .replace(/\{path\}/g, '') // strip literal {path} if present
    .replace(/\{branch\}/g, 'HEAD');
}

/**
 * Execute a single confirmed GeminiAction against the GitHub API.
 *
 * @param token      - GitHub OAuth token or PAT
 * @param user       - Authenticated user (used to resolve owner defaults)
 * @param action     - The confirmed action to execute
 * @param targetRepo - Optional override for the target repo (used in multi-repo mode)
 * @param t          - Translation function (i18n) for localized result messages (#56)
 * @returns ExecutionResult with success flag, message, and optional data
 */
export async function executeAction(
  token: string,
  user: { login: string },
  action: GeminiAction,
  targetRepo?: GitHubRepo,
  t?: (key: string, params?: Record<string, string | number>) => string,
): Promise<ExecutionResult> {
  const repoTarget = targetRepo
    ? { owner: targetRepo.owner.login, repo: targetRepo.name }
    : parseRepoTarget(action.repo, user);

  // Resolve any placeholder tokens the AI left in the endpoint
  const endpoint = resolveEndpoint(action.endpoint, user, repoTarget);

  try {
    switch (action.metodo) {
      case 'GET': {
        if (endpoint.includes('/contents/')) {
          const path = action.archivo || '';
          const file = await getFileContents(token, repoTarget.owner, repoTarget.repo, path);
          const content = file.content ? decodeBase64(file.content) : '';
          return { success: true, message: t ? t('history.exec.fileRead', { path }) : `Archivo ${path} leído correctamente`, data: content };
        }
        // Match both /user/repos (authenticated) and /users/:username/repos (public endpoint)
        if (
          endpoint.includes('/user/repos') ||
          endpoint.match(/\/users\/[^/]+\/repos/)
        ) {
          const repos = await listAllRepos(token);
          return { success: true, message: t ? t('history.exec.reposFound', { count: repos.length }) : `${repos.length} repositorios encontrados`, data: repos };
        }
        // Generic GET — delegate to ghFetch (auth headers managed centrally)
        const data = await ghFetch<unknown>(token, endpoint);
        return { success: true, message: t ? t('history.exec.completed') : 'Operación completada', data };
      }

      case 'POST': {
        if (endpoint === '/user/repos') {
          const payload = action.payload as { name: string; description?: string; private?: boolean };
          const newRepo = await createRepo(token, payload.name, payload.description, payload.private);
          return { success: true, message: t ? t('history.exec.repoCreated', { name: newRepo.name }) : `Repositorio "${newRepo.name}" creado correctamente`, data: newRepo };
        }
        // Generic POST — delegate to ghFetch (auth headers managed centrally)
        const data = await ghFetch<unknown>(token, endpoint, {
          method: 'POST',
          body: JSON.stringify(action.payload),
          headers: { 'Content-Type': 'application/json' },
        });
        return { success: true, message: t ? t('history.exec.completed') : 'Operación completada', data };
      }

      case 'PATCH': {
        // Generic PATCH — delegate to ghFetch (auth headers managed centrally)
        const data = await ghFetch<unknown>(token, endpoint, {
          method: 'PATCH',
          body: JSON.stringify(action.payload),
          headers: { 'Content-Type': 'application/json' },
        });
        return { success: true, message: t ? t('history.exec.completed') : 'Operación completada', data };
      }

      case 'PUT': {
        if (!action.archivo) throw new Error('Se requiere la ruta del archivo para esta operación');
        const path = action.archivo;
        const content = action.contenidoPropuesto || '';
        const message = (action.payload as { message?: string }).message || `chore: update ${path} via Asistente de IA`;

        // Attempt to get the current SHA — needed for updating existing files.
        // If the file doesn't exist yet, the catch block suppresses the 404 error
        // and we proceed with creation (no SHA required).
        let sha: string | undefined;
        try {
          const existing = await getFileContents(token, repoTarget.owner, repoTarget.repo, path);
          sha = existing.sha;
        } catch {
          // File doesn't exist — create it (sha stays undefined)
        }

        const result = await createOrUpdateFile(
          token,
          repoTarget.owner,
          repoTarget.repo,
          path,
          content,
          message,
          sha
        );
        const verb = sha ? 'updated' : 'created';
        const msgKey = sha ? 'history.exec.fileUpdated' : 'history.exec.fileCreated';
        return {
          success: true,
          message: t ? t(msgKey, { path, owner: repoTarget.owner, repo: repoTarget.repo }) : (verb === 'updated' ? `Archivo ${path} actualizado correctamente en ${repoTarget.owner}/${repoTarget.repo}` : `Archivo ${path} creado correctamente en ${repoTarget.owner}/${repoTarget.repo}`),
          data: result,
        };
      }

      case 'DELETE': {
        if (!action.archivo) throw new Error('Se requiere la ruta del archivo para eliminar');
        const path = action.archivo;
        const existing = await getFileContents(token, repoTarget.owner, repoTarget.repo, path);
        const message = (action.payload as { message?: string }).message || `chore: delete ${path} via Asistente de IA`;
        await deleteFile(token, repoTarget.owner, repoTarget.repo, path, existing.sha, message);
        return { success: true, message: t ? t('history.exec.fileDeleted', { path }) : `Archivo ${path} eliminado correctamente` };
      }

      default:
        throw new Error(`Método HTTP no soportado: ${action.metodo}`);
    }
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

/**
 * Execute a single action across multiple repositories, one at a time.
 *
 * WHY SERIAL (not parallel): GitHub's API has rate limits (5000 req/h with OAuth).
 * Running requests in parallel across many repos could easily hit limits and cause
 * partial failures that are hard to diagnose. Serial execution with progress callbacks
 * is slower but predictable and easier to retry if something fails.
 *
 * Each repo reports its status via `callbacks.onProgress()` before and after execution,
 * allowing the HistoryPanel to show live progress for each repo.
 *
 * @param token     - GitHub OAuth token or PAT
 * @param user      - Authenticated GitHub user
 * @param action    - The confirmed action to apply to all repos
 * @param repos     - Array of target repositories
 * @param callbacks - Progress callback object (see ExecutionCallbacks)
 * @returns Array of ExecutionResult, one per repo, in the same order as `repos`
 */
export async function executeActionMultiRepo(
  token: string,
  user: { login: string },
  action: GeminiAction,
  repos: GitHubRepo[],
  callbacks: ExecutionCallbacks,
  t?: (key: string, params?: Record<string, string | number>) => string,
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];
  for (const repo of repos) {
    const processingMsg = t ? t('history.exec.processing', { repo: repo.full_name }) : `Procesando ${repo.full_name}...`;
    callbacks.onProgress?.(repo.full_name, 'pending', processingMsg);
    const result = await executeAction(token, user, action, repo, t);
    callbacks.onProgress?.(
      repo.full_name,
      result.success ? 'completed' : 'error',
      result.message
    );
    results.push(result);
  }
  return results;
}

/**
 * Execute issue-specific actions (comment, close, reopen).
 * 
 * @param token - GitHub OAuth token or PAT
 * @param user - Authenticated GitHub user
 * @param action - The confirmed action
 * @param targetRepo - Target repository
 * @param t - Translation function (i18n) for localized result messages (#56)
 * @returns ExecutionResult
 */
export async function executeIssueAction(
  token: string,
  user: { login: string },
  action: GeminiAction,
  targetRepo: GitHubRepo,
  t?: (key: string, params?: Record<string, string | number>) => string,
): Promise<ExecutionResult> {
  const repoTarget = { owner: targetRepo.owner.login, repo: targetRepo.name };
  const endpoint = resolveEndpoint(action.endpoint, user, repoTarget);
  
  try {
    // Extract issue number from endpoint
    const issueMatch = endpoint.match(/\/issues\/(\d+)/);
    if (!issueMatch) throw new Error('No se pudo extraer el número de issue');
    const issueNumber = parseInt(issueMatch[1], 10);
    
    // Comment on issue
    if (endpoint.includes('/comments')) {
      const body = (action.payload as { body?: string }).body || '';
      const comment = await commentOnIssue(token, repoTarget.owner, repoTarget.repo, issueNumber, body);
      return { success: true, message: t ? t('history.exec.commentAdded') : 'Comentario añadido correctamente', data: comment };
    }
    
    // Close/reopen issue
    if (action.metodo === 'PATCH') {
      const state = (action.payload as { state?: string }).state || 'open';
      const issue = await updateIssueState(token, repoTarget.owner, repoTarget.repo, issueNumber, state as 'open' | 'closed');
      const stateLabel = state === 'closed' ? 'closed' : 'reopened';
      return { success: true, message: t ? t('history.exec.issueStateChanged', { state: stateLabel }) : `Issue ${state === 'closed' ? 'cerrado' : 'reabierto'} correctamente`, data: issue };
    }
    
    return { success: false, message: t ? t('history.exec.unknownIssueAction') : 'Acción de issue no reconocida' };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

/**
 * Execute PR-specific actions (merge, reopen, etc.).
 * 
 * @param token - GitHub OAuth token or PAT
 * @param user - Authenticated GitHub user
 * @param action - The confirmed action
 * @param targetRepo - Target repository
 * @param t - Translation function (i18n) for localized result messages (#56)
 * @returns ExecutionResult
 */
export async function executePRAction(
  token: string,
  user: { login: string },
  action: GeminiAction,
  targetRepo: GitHubRepo,
  t?: (key: string, params?: Record<string, string | number>) => string,
): Promise<ExecutionResult> {
  const repoTarget = { owner: targetRepo.owner.login, repo: targetRepo.name };
  const endpoint = resolveEndpoint(action.endpoint, user, repoTarget);
  
  try {
    // Extract PR number from endpoint
    const prMatch = endpoint.match(/\/pulls\/(\d+)/);
    if (!prMatch) throw new Error('No se pudo extraer el número de PR');
    const prNumber = parseInt(prMatch[1], 10);
    
    // Merge PR
    if (endpoint.includes('/merge')) {
      const payload = action.payload as { merge_method?: string; commit_title?: string; commit_message?: string };
      const result = await mergePullRequest(
        token,
        repoTarget.owner,
        repoTarget.repo,
        prNumber,
        (payload.merge_method as 'merge' | 'squash' | 'rebase') || 'merge',
        payload.commit_title,
        payload.commit_message
      );
      return { success: true, message: t ? t('history.exec.prMerged') : 'Pull Request fusionado correctamente', data: result };
    }
    
    return { success: false, message: t ? t('history.exec.unknownPRAction') : 'Acción de PR no reconocida' };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

/**
 * Execute workflow-specific actions (trigger/re-run).
 * 
 * @param token - GitHub OAuth token or PAT
 * @param user - Authenticated GitHub user
 * @param action - The confirmed action
 * @param targetRepo - Target repository
 * @param t - Translation function (i18n) for localized result messages (#56)
 * @returns ExecutionResult
 */
export async function executeWorkflowAction(
  token: string,
  user: { login: string },
  action: GeminiAction,
  targetRepo: GitHubRepo,
  t?: (key: string, params?: Record<string, string | number>) => string,
): Promise<ExecutionResult> {
  const repoTarget = { owner: targetRepo.owner.login, repo: targetRepo.name };
  const endpoint = resolveEndpoint(action.endpoint, user, repoTarget);
  
  try {
    // Extract run ID from endpoint
    const runMatch = endpoint.match(/\/runs\/(\d+)/);
    if (!runMatch) throw new Error('No se pudo extraer el ID del workflow run');
    const runId = parseInt(runMatch[1], 10);
    
    // Re-run workflow
    if (endpoint.includes('/rerun')) {
      const result = await triggerWorkflowRun(token, repoTarget.owner, repoTarget.repo, runId);
      return { success: true, message: t ? t('history.exec.workflowRerun') : 'Workflow re-ejecutado correctamente', data: result };
    }
    
    return { success: false, message: t ? t('history.exec.unknownWorkflowAction') : 'Acción de workflow no reconocida' };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}
