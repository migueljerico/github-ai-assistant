// ── Smart result formatter ────────────────────────────────────────────────────
// Turns GitHub API responses into readable text rather than raw JSON dumps

export interface GitHubRepoItem {
  name: string;
  full_name: string;
  description?: string | null;
  private: boolean;
  html_url: string;
  stargazers_count?: number;
  language?: string | null;
  updated_at?: string;
  fork?: boolean;
}

export function formatResultData(data: unknown): string {
  // ── Array of repos ──────────────────────────────────────────────────────────
  if (Array.isArray(data) && data.length > 0 && (data[0] as GitHubRepoItem)?.full_name) {
    const repos = data as GitHubRepoItem[];
    const lines: string[] = [];
    for (const r of repos) {
      const visibility = r.private ? ' Privado' : '🌐 Público';
      const stars = r.stargazers_count ? ` ⭐ ${r.stargazers_count}` : '';
      const lang = r.language ? ` · ${r.language}` : '';
      const fork = r.fork ? ' · 🍴 Fork' : '';
      const desc = r.description ? `\n   ${r.description}` : '';
      const updated = r.updated_at
        ? ` · actualizado ${new Date(r.updated_at).toLocaleDateString('es-ES')}`
        : '';
      lines.push(`**${r.name}** — ${visibility}${stars}${lang}${fork}${updated}${desc}`);
    }
    return lines.join('\n\n');
  }

  // ─ Empty array ─────────────────────────────────────────────────────────────
  if (Array.isArray(data) && data.length === 0) {
    return '_No se encontraron resultados._';
  }

  // ── Single repo object ──────────────────────────────────────────────────────
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const r = data as Record<string, unknown>;
    if (r.full_name && r.html_url) {
      const repo = r as unknown as GitHubRepoItem;
      const lines = [
        ` **${repo.full_name}** — ${repo.private ? '🔒 Privado' : ' Público'}`,
        repo.description ? `> ${repo.description}` : '',
        `🔗 ${repo.html_url}`,
        repo.language ? ` Lenguaje: ${repo.language}` : '',
        repo.stargazers_count !== undefined ? `⭐ Estrellas: ${repo.stargazers_count}` : '',
      ].filter(Boolean);
      return lines.join('\n');
    }

    // ── File content (GitHub contents API) ───────────────────────────────────
    if (typeof r.content === 'string' && r.encoding === 'base64') {
      return '_Contenido del archivo obtenido. Usa la información en tu siguiente instrucción._';
    }

    // ── Generic object: compact key-value ───────────────────────────────────
    const entries = Object.entries(r)
      .filter(([, v]) => typeof v !== 'object' && v !== null && v !== '')
      .slice(0, 12)
      .map(([k, v]) => `**${k}**: ${String(v)}`);
    if (entries.length > 0) return entries.join('\n');
  }

  // ── Plain string ────────────────────────────────────────────────────────────
  if (typeof data === 'string') {
    const trimmed = data.slice(0, 1500);
    return `\`\`\`\n${trimmed}${data.length > 1500 ? '\n...' : ''}\n\`\`\``;
  }

  // ── Fallback: compact JSON (capped) ─────────────────────────────────────────
  const json = JSON.stringify(data, null, 2);
  const capped = json.slice(0, 1200);
  return `\`\`\`json\n${capped}${json.length > 1200 ? '\n...' : ''}\n\`\`\``;
}
