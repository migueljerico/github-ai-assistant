import { callAI } from './gemini';
import type { AIProviderConfig } from './gemini';
import { getIssueOrPr, getIssueComments, getPullReviewComments } from './github';
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
  number: number;
}

/**
 * Parsea la entrada del botón. Acepta: `owner/repo#42`, `owner/repo 42`,
 * `repo#42` (owner = usuario), `#42` o `42` (owner/repo del contexto activo).
 * Devuelve `null` si no encuentra un número de issue/PR válido.
 */
export function parseThreadInput(raw: string): ParsedThreadRef | null {
  const trimmed = raw.trim();
  const numMatch = trimmed.match(/(\d+)\s*$/);
  if (!numMatch) return null;
  const number = parseInt(numMatch[1], 10);
  if (!number) return null;

  let prefix = trimmed.slice(0, numMatch.index).trim();
  prefix = prefix.replace(/#$/, '').trim();
  if (!prefix) return { number };

  const slash = prefix.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (slash) return { owner: slash[1], repo: slash[2], number };

  if (/^[\w.-]+$/.test(prefix)) return { repo: prefix, number };

  return null;
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
