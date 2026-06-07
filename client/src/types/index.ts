// ─────────────────────────────────────────────────────────────────────────────
// Shared TypeScript types for the entire application
// ─────────────────────────────────────────────────────────────────────────────

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
  email: string | null;
  html_url: string;
  public_repos: number;
}

// ── GitHub ────────────────────────────────────────────────────────────────────
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

// ── Gemini Action ─────────────────────────────────────────────────────────────
export type ActionType = 'lectura' | 'escritura' | 'creacion' | 'listado';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

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
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  action?: GeminiAction; // parsed action from Gemini
  isLoading?: boolean;
}

// ── History ───────────────────────────────────────────────────────────────────
export type HistoryStatus = 'completed' | 'error' | 'cancelled' | 'pending';

export interface HistoryEntry {
  id: string;
  timestamp: Date;
  status: HistoryStatus;
  description: string;
  repo: string | null;
}

// ── Templates ─────────────────────────────────────────────────────────────────
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

// ── Confirmation ──────────────────────────────────────────────────────────────
export interface PendingAction {
  action: GeminiAction;
  targetRepos: GitHubRepo[]; // 1 for single, N for multi-repo
}

// ── Document Repo ─────────────────────────────────────────────────────────────
export interface RepoAnalysis {
  readme: string;
  manualTecnico: string;
  filesAnalyzed: number;
  totalFiles: number;
  truncated: boolean;
  repoName: string;
}
