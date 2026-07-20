// ────────────────────────────────────────────────────────────────────────────
// Shared TypeScript types for the entire application
// ────────────────────────────────────────────────────────────────────────────

// ── Auth ─────────────────────────────────────────────────────────────────────
export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
  email: string | null;
  html_url: string;
  public_repos: number;
}

// ── GitHub ───────────────────────────────────────────────────────────────────
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  html_url: string;
  default_branch: string;
  owner: { login: string; avatar_url: string };
  updated_at: string;
  language: string | null;
}

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  content?: string; // base64 encoded
  encoding?: string;
  download_url?: string | null;
}

// ── Issues ───────────────────────────────────────────────────────────────────
export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  user: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  html_url: string;
  labels: Array<{ name: string; color: string }>;
  assignees: Array<{ login: string }>;
}

// ── Pull Requests ────────────────────────────────────────────────────────────
export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  merged: boolean;
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
  user: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  html_url: string;
  draft: boolean;
}

// ── Branches ─────────────────────────────────────────────────────────────────
export interface GitHubBranch {
  name: string;
  commit: { sha: string; url: string };
  protected: boolean;
}

// ── Workflows ────────────────────────────────────────────────────────────────
export interface GitHubWorkflow {
  id: number;
  name: string;
  path: string;
  state: 'active' | 'deleted' | 'disabled_fork' | 'disabled_inactivity' | 'disabled_manually';
  created_at: string;
  updated_at: string;
  url: string;
  html_url: string;
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required' | null;
  created_at: string;
  updated_at: string;
  run_number: number;
  event: string;
  html_url: string;
}

// ── Gemini Action ────────────────────────────────────────────────────────────
export type ActionType = 'lectura' | 'escritura' | 'creacion' | 'listado' | 'borrado';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type ActionTarget = 'file' | 'issue' | 'pr' | 'branch' | 'workflow' | 'repo';

export interface GeminiAction {
  tipo: ActionType;
  accion: string;
  endpoint: string;
  metodo: HttpMethod;
  repo: string | null;
  archivo: string | null;
  contenidoPropuesto: string | null;
  contenidoActual?: string | null;
  payload: Record<string, unknown>;
  requiereConfirmacion: boolean;
  target?: ActionTarget; // Tipo de recurso (file, issue, pr, branch, workflow)
}

// ── Chat ─────────────────────────────────────────────────────────────────────
export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  action?: GeminiAction; // parsed action from Gemini
  isLoading?: boolean;
  consultedFiles?: string[]; // #51: archivos del repo enviados al LLM para esta respuesta
}

// ── History ──────────────────────────────────────────────────────────────────
export type HistoryStatus = 'completed' | 'error' | 'cancelled' | 'pending';

export interface HistoryEntry {
  id: string;
  timestamp: Date;
  status: HistoryStatus;
  description: string;
  repo: string | null;
}

// ── Templates ────────────────────────────────────────────────────────────────
export interface Template {
  id: string;
  name: string;
  description: string;
  instruction: string;
}

export interface TemplateCategory {
  id: string;
  name: string;
  emoji: string;
  templates: Template[];
}

// ── Confirmation ─────────────────────────────────────────────────────────────
export interface PendingAction {
  action: GeminiAction;
  targetRepos: GitHubRepo[]; // 1 for single, N for multi-repo
  // #53 (v3.50.0): mensaje de commit sugerido por el LLM (Conventional Commits).
  // El usuario puede editarlo en ConfirmModal antes de confirmar. Solo se usa
  // para acciones de escritura (PUT/DELETE sobre archivos); las de lectura lo
  // ignoran. Opcional: si no llega, executeAction cae a su fallback habitual.
  commitMessage?: string;
}

// ── Document Repo ────────────────────────────────────────────────────────────
export interface RepoAnalysis {
  readme: string;
  manualTecnico: string;
  filesAnalyzed: number;
  totalFiles: number;
  truncated: boolean;
  repoName: string;
  /** True si el repo ya tenía README.md o MANUAL_TECNICO.md (se va a actualizar, no a crear). */
  alreadyDocumented?: boolean;
  /** v3.31.0: resumen corto generado por la IA; se usa como "about" (descripción)
   *  del repo al publicar, junto con la firma de documentación. */
  resumen?: string;
  /** #58 (b): contenido actual del README.md en el repo (para diff old↔new).
   *  `undefined` cuando el README no existe (alta nueva). */
  readmeActual?: string;
  /** #58 (b): contenido actual del MANUAL_TECNICO.md en el repo (para diff old↔new).
   *  `undefined` cuando el MANUAL no existe (alta nueva). */
  manualActual?: string;
}

// ── Re-export types from gemini service for convenience ──────────────────────
// These can be used by components that need to import directly from types/
export type RepoFile = { path: string; content?: string };
export type GeneratedDocs = {
  readme: string;
  manualTecnico: string;
  resumen?: string;
  metadatos?: Record<string, unknown>;
};
