import { callAI } from './gemini';
import type { AIProviderConfig } from './gemini';
import { getIssueOrPr, getIssueComments, getPullReviewComments, listIssues } from './github';
import type { ThreadComment } from './github';

/**
 * #32 — Resumen de hilos de issues/PRs.
 *
 * Flujo dedicado (espejo de `generateRepoDocs`): se descargan el issue/PR y sus
 * comentarios desde la GitHub API y se pide a la IA un resumen estructurado en
 * Markdown. No pasa por el bucle de acciones (propón→confirma→ejecuta): son
 * solo lecturas + una llamada LLM, sin escrituras. La clave de IA sigue viviendo
 * en memoria (Zero-Storage) y el resumen no se persiste.
 */

export const THREAD_SUMMARY_PROMPT = `Eres un asistente experto en resumir discusiones técnicas de GitHub (issues y pull requests).
Te paso el título, el cuerpo y los comentarios de un hilo. Devuelve un resumen claro y conciso EN ESPAÑOL, en formato Markdown, con EXACTAMENTE estas secciones:

**TL;DR**
Una o dos frases con la esencia del hilo.

**Puntos clave**
- Lista con los argumentos, problemas y propuestas principales (indica quién dijo qué si es relevante).

**Decisiones / pendientes**
- Decisiones tomadas y tareas o preguntas que quedan abiertas. Si no hay, indícalo explícitamente.

**Tono**
Una frase sobre el clima de la conversación (constructivo, tenso, resolutivo…).

Reglas:
- Básate ÚNICAMENTE en el contenido aportado; no inventes datos ni conclusiones.
- Sé conciso; agrupa comentarios repetitivos.
- Responde SOLO con el Markdown del resumen, sin texto introductorio ni bloques de código externos.`;

/** Recorte defensivo por comentario para no agotar el contexto del modelo. */
const MAX_COMMENT_CHARS = 1500;
/** Recorte defensivo del cuerpo del issue/PR. */
const MAX_BODY_CHARS = 4000;

/** Formatea un comentario para el mensaje que se envía a la IA. */
function formatComment(c: ThreadComment): string {
  const login = c.user?.login ?? 'desconocido';
  const date = (c.created_at || '').slice(0, 10);
  const where = c.path ? ` [revisión en ${c.path}]` : '';
  const raw = c.body || '';
  const body = raw.slice(0, MAX_COMMENT_CHARS) +
    (raw.length > MAX_COMMENT_CHARS ? '\n[… truncado …]' : '');
  return `@${login} (${date})${where}:\n${body}`;
}

/** Referencia a un hilo parseada desde la entrada del usuario. */
export interface ParsedThreadRef {
  owner?: string;
  repo?: string;
  /** Nº de issue/PR. Opcional: si falta, el usuario dio solo el repo. */
  number?: number;
}

/**
 * Parsea la entrada del botón. Acepta, en este orden:
 * - URL de GitHub: `https://github.com/owner/repo/(issues|pull|discussions)/N`
 * - Ruta sin host: `owner/repo/issues/N` o `owner/repo/pull/N`
 * - `owner/repo#42`, `owner/repo 42`, `repo#42`, `#42`, `42`
 * - **Solo repo** (`owner/repo` o `repo`, sin número) → `{ owner?, repo }` sin `number`
 * Devuelve `null` solo si no hay ni repo ni número reconocibles.
 */
export function parseThreadInput(raw: string): ParsedThreadRef | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1) URL de GitHub (con o sin protocolo): .../owner/repo/(issues|pull|discussions)/N
  const url = trimmed.match(/github\.com\/([\w.-]+)\/([\w.-]+)\/(?:issues|pull|discussions)\/(\d+)/i);
  if (url) return { owner: url[1], repo: url[2], number: parseInt(url[3], 10) };

  // 2) Ruta sin host: owner/repo/issues/N | owner/repo/pull/N
  const path = trimmed.match(/^([\w.-]+)\/([\w.-]+)\/(?:issues|pull)\/(\d+)$/i);
  if (path) return { owner: path[1], repo: path[2], number: parseInt(path[3], 10) };

  // 3) Formas con número al final (#N, N) precedidas opcionalmente de owner/repo o repo
  const numMatch = trimmed.match(/(\d+)\s*$/);
  if (numMatch) {
    const number = parseInt(numMatch[1], 10);
    if (number) {
      const prefix = trimmed.slice(0, numMatch.index).trim().replace(/#$/, '').trim();
      if (!prefix) return { number };
      const slash = prefix.match(/^([\w.-]+)\/([\w.-]+)$/);
      if (slash) return { owner: slash[1], repo: slash[2], number };
      if (/^[\w.-]+$/.test(prefix)) return { repo: prefix, number };
      return null;
    }
  }

  // 4) Solo repo, sin número → el handler listará los issues/PRs para elegir
  const repoOnly = trimmed.replace(/#$/, '').trim();
  const slashOnly = repoOnly.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (slashOnly) return { owner: slashOnly[1], repo: slashOnly[2] };
  if (/^[\w.-]+$/.test(repoOnly)) return { repo: repoOnly };

  return null;
}

/** Un issue o PR abierto, para el selector cuando el usuario solo da el repo. */
export interface OpenThread {
  number: number;
  title: string;
  isPr: boolean;
}

/**
 * Lista los issues/PRs **abiertos** de un repo (el endpoint de issues de GitHub
 * incluye PRs; se marcan por la presencia de la clave `pull_request`). Se usa
 * cuando el usuario da solo el repo, para que elija qué hilo resumir.
 */
export async function listOpenThreads(
  token: string,
  owner: string,
  repo: string,
  limit = 15,
): Promise<OpenThread[]> {
  const items = await listIssues(token, owner, repo, 'open');
  return items.slice(0, limit).map(it => ({
    number: it.number,
    title: it.title,
    isPr: Boolean((it as { pull_request?: unknown }).pull_request),
  }));
}

/** Construye el mensaje (Markdown) con la lista de hilos abiertos para elegir. */
export function formatThreadList(owner: string, repo: string, items: OpenThread[]): string {
  if (items.length === 0) {
    return `No hay issues ni PRs **abiertos** en **${owner}/${repo}** que resumir.`;
  }
  const lines = items.map(it => `- \`#${it.number}\` ${it.isPr ? '🔀 (PR)' : '🐞 (issue)'} — ${it.title}`);
  return (
    `Un *hilo* es un issue o PR concreto. ¿Cuál de **${owner}/${repo}** quieres que resuma? ` +
    `Vuelve a pulsar **Resumir hilo** e indica el número (p. ej. \`#${items[0].number}\`) ` +
    `o pega la URL del issue/PR:\n\n${lines.join('\n')}`
  );
}

/**
 * Descarga un issue/PR + sus comentarios y devuelve un resumen en Markdown.
 * Para PRs incluye además los comentarios de revisión sobre código.
 */
export async function summarizeThread(
  token: string,
  owner: string,
  repo: string,
  number: number,
  config: AIProviderConfig,
): Promise<string> {
  const item = await getIssueOrPr(token, owner, repo, number);
  const isPr = Boolean(item.pull_request);

  const conversation = await getIssueComments(token, owner, repo, number);
  const reviewComments = isPr
    ? await getPullReviewComments(token, owner, repo, number)
    : [];
  const comments = [...conversation, ...reviewComments];

  const hasBody = Boolean((item.body || '').trim());
  if (!hasBody && comments.length === 0) {
    throw new Error('El hilo no tiene contenido que resumir (sin descripción ni comentarios).');
  }

  const kind = isPr ? 'Pull Request' : 'Issue';
  const author = item.user?.login ?? 'desconocido';
  const userMessage =
    `${kind} #${item.number}: ${item.title}\n` +
    `Autor: @${author} · Estado: ${item.state}\n\n` +
    `DESCRIPCIÓN:\n${(item.body || '(sin descripción)').slice(0, MAX_BODY_CHARS)}\n\n` +
    `COMENTARIOS (${comments.length}):\n\n` +
    (comments.length > 0
      ? comments.map(formatComment).join('\n\n---\n\n')
      : '(sin comentarios)');

  const raw = await callAI(
    [{ role: 'user', content: userMessage }],
    THREAD_SUMMARY_PROMPT,
    config.provider,
    config.apiKey,
    config.model,
  );

  return raw
    .replace(/^```(?:markdown)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}
