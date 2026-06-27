// ── changelogGenerator (#34) ─────────────────────────────────────────────────
// Genera las notas de un release a partir de los commits desde el último release
// (o de los commits recientes si aún no hay ninguno). Enfoque HÍBRIDO:
//   1) agrupación DETERMINISTA por prefijo Conventional Commits (feat/fix/docs…),
//      pura y testeable (`classifyCommits`);
//   2) la IA PULE esa lista a notas en lenguaje de usuario (no técnico).
// Mismo patrón que `threadSummary.ts`: una llamada LLM dedicada → Markdown que se
// muestra como burbuja de chat. No persiste nada (Zero-Storage).

import { callAI } from './gemini';
import type { AIProviderConfig } from './gemini';
import { getRepo, getLatestReleaseTag, compareCommits, listRecentCommits, type CommitSummary } from './github';

/** Categorías de usuario y los prefijos Conventional Commits que las alimentan. */
const CATEGORIES: Array<{ title: string; prefixes: string[] }> = [
  { title: '✨ Novedades', prefixes: ['feat'] },
  { title: '🐛 Correcciones', prefixes: ['fix'] },
  { title: '⚡ Rendimiento', prefixes: ['perf'] },
  { title: '📚 Documentación', prefixes: ['docs'] },
  { title: '🛠️ Mantenimiento', prefixes: ['refactor', 'chore', 'build', 'ci', 'style', 'test'] },
];

export interface ClassifiedCommits {
  groups: Array<{ title: string; items: string[] }>;
  /** Commits sin prefijo Conventional Commits reconocible. */
  otros: string[];
  total: number;
}

/**
 * Agrupa los mensajes de commit por prefijo Conventional Commits (determinista).
 * Toma solo la primera línea (`subject`) de cada commit. Función pura/testeable.
 */
export function classifyCommits(commits: CommitSummary[]): ClassifiedCommits {
  const groups = CATEGORIES.map(c => ({ title: c.title, items: [] as string[] }));
  const otros: string[] = [];

  for (const c of commits) {
    const subject = c.message.split('\n')[0].trim();
    const m = subject.match(/^([a-zA-Z]+)(?:\([^)]*\))?!?:\s*(.+)$/);
    if (m) {
      const type = m[1].toLowerCase();
      const desc = m[2].trim();
      const idx = CATEGORIES.findIndex(cat => cat.prefixes.includes(type));
      if (idx >= 0) { groups[idx].items.push(desc); continue; }
    }
    otros.push(subject);
  }

  return { groups: groups.filter(g => g.items.length > 0), otros, total: commits.length };
}

export const CHANGELOG_PROMPT = `Eres un asistente que redacta NOTAS DE RELEASE en ESPAÑOL y en LENGUAJE DE USUARIO (no técnico) a partir de una lista de cambios YA agrupada por categoría. Reglas:
- Devuelve SOLO Markdown (sin JSON; no envuelvas toda la respuesta en un bloque de código).
- Respeta las categorías dadas (Novedades, Correcciones, etc.); dentro de cada una, redacta viñetas claras y concisas que entienda alguien NO técnico (qué cambia para él, no el detalle interno).
- Agrupa cambios parecidos y resume; NO inventes nada que no esté en la lista; NO incluyas SHAs ni nombres de archivo.
- Empieza con un título corto y, si ayuda, una frase introductoria breve.`;

/** ¿Es un commit de merge (ruido que no aporta a las notas)? */
function isMergeCommit(message: string): boolean {
  return /^Merge (pull request|branch|remote)/i.test(message);
}

/**
 * Genera las notas de release (Markdown) de un repo. Toma los commits desde el
 * último release (Compare API) o, si no hay releases, los commits recientes.
 * Lanza un error claro si no hay cambios nuevos.
 */
export async function generateChangelog(
  token: string,
  owner: string,
  repo: string,
  config: AIProviderConfig,
): Promise<string> {
  const sinceTag = await getLatestReleaseTag(token, owner, repo);

  let commits: CommitSummary[];
  if (sinceTag) {
    const info = await getRepo(token, owner, repo);
    commits = await compareCommits(token, owner, repo, sinceTag, info.default_branch);
  } else {
    commits = await listRecentCommits(token, owner, repo);
  }

  commits = commits.filter(c => !isMergeCommit(c.message));
  if (commits.length === 0) {
    throw new Error(
      sinceTag
        ? `No hay commits nuevos desde el último release (${sinceTag}).`
        : 'No encontré commits recientes en el repositorio.',
    );
  }

  const classified = classifyCommits(commits);
  const rangeNote = sinceTag ? `desde el último release ${sinceTag}` : 'de los últimos commits';
  const userMessage =
    `Genera las notas de release (${rangeNote}) para ${owner}/${repo} a partir de estos cambios agrupados:\n\n` +
    classified.groups.map(g => `## ${g.title}\n${g.items.map(i => `- ${i}`).join('\n')}`).join('\n\n') +
    (classified.otros.length ? `\n\n## Otros\n${classified.otros.map(i => `- ${i}`).join('\n')}` : '');

  const raw = await callAI(
    [{ role: 'user', content: userMessage }],
    CHANGELOG_PROMPT,
    config.provider,
    config.apiKey,
    config.model,
    'chat',
  );
  return raw.replace(/^```(?:markdown)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}
