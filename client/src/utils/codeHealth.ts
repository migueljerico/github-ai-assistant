// ── codeHealth (#44) ─────────────────────────────────────────────────────────────
// Métricas puras para el dashboard "Salud del Código". Sin dependencias ni estado:
// reciben datos ya descargados (árbol/contenidos/fechas de commit) y devuelven series
// listas para graficar. Deterministas → fáciles de testear.

// Mapa extensión → lenguaje (espejo del de detectPrimaryLanguage en gemini.ts; se
// define aquí para no acoplar el módulo de visualización al de IA).
const EXT_LANGUAGE: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript',
  js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  py: 'Python', java: 'Java', go: 'Go', rs: 'Rust', rb: 'Ruby', php: 'PHP',
  cs: 'C#', cpp: 'C++', cc: 'C++', c: 'C', h: 'C/C++', hpp: 'C++',
  swift: 'Swift', kt: 'Kotlin', r: 'R', scala: 'Scala',
  css: 'CSS', scss: 'CSS', sass: 'CSS', html: 'HTML',
  json: 'JSON', md: 'Markdown', yml: 'YAML', yaml: 'YAML', sh: 'Shell',
};

const MAX_LANGUAGE_SLICES = 8; // el resto se agrupa en "Otros"

export interface LanguageSlice { language: string; count: number; }

/**
 * Distribución de archivos por lenguaje a partir de TODOS los paths del repo
 * (árbol completo — barato, no necesita contenido). Ordenado desc; agrupa la cola
 * en "Otros" para que la gráfica no tenga decenas de porciones.
 */
export function languageDistribution(paths: string[]): LanguageSlice[] {
  const counts: Record<string, number> = {};
  for (const path of paths) {
    const ext = (path.split('.').pop() ?? '').toLowerCase();
    const lang = EXT_LANGUAGE[ext];
    if (!lang) continue;
    counts[lang] = (counts[lang] ?? 0) + 1;
  }

  const sorted = Object.entries(counts)
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count);

  if (sorted.length <= MAX_LANGUAGE_SLICES) return sorted;

  const head = sorted.slice(0, MAX_LANGUAGE_SLICES);
  const rest = sorted.slice(MAX_LANGUAGE_SLICES).reduce((acc, s) => acc + s.count, 0);
  return rest > 0 ? [...head, { language: 'Otros', count: rest }] : head;
}

export interface DebtFile { path: string; count: number; }
export interface TechnicalDebt { total: number; byFile: DebtFile[]; }

const DEBT_PATTERN = /\b(TODO|FIXME|HACK|XXX)\b/g;
const MAX_DEBT_FILES = 10; // top ofensores para la gráfica/lista

/**
 * Cuenta marcadores de deuda técnica (TODO/FIXME/HACK/XXX) en el CONTENIDO de los
 * archivos ya descargados. Devuelve el total y los archivos con más marcadores.
 */
export function countTechnicalDebt(files: Array<{ path: string; content?: string }>): TechnicalDebt {
  const byFile: DebtFile[] = [];
  let total = 0;

  for (const file of files) {
    if (!file.content) continue;
    const matches = file.content.match(DEBT_PATTERN);
    const count = matches ? matches.length : 0;
    if (count > 0) {
      byFile.push({ path: file.path, count });
      total += count;
    }
  }

  byFile.sort((a, b) => b.count - a.count);
  return { total, byFile: byFile.slice(0, MAX_DEBT_FILES) };
}

export interface CommitWeek { weekStart: string; count: number; }

/** Lunes (00:00 UTC) de la semana ISO que contiene `date`, en formato YYYY-MM-DD. */
function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = domingo
  const diff = (day === 0 ? -6 : 1) - day; // retroceder al lunes
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Agrupa fechas ISO de commit por semana (lunes) y devuelve las últimas `weeks`
 * semanas en orden cronológico, rellenando con 0 las semanas sin commits.
 */
export function commitsByWeek(dates: string[], weeks = 12, now = new Date()): CommitWeek[] {
  const counts: Record<string, number> = {};
  for (const iso of dates) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) continue;
    const key = mondayOf(d);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  // Construir las últimas `weeks` semanas hasta el lunes de la semana actual.
  const out: CommitWeek[] = [];
  const monday = new Date(`${mondayOf(now)}T00:00:00Z`);
  for (let i = weeks - 1; i >= 0; i--) {
    const wk = new Date(monday);
    wk.setUTCDate(wk.getUTCDate() - i * 7);
    const key = wk.toISOString().slice(0, 10);
    out.push({ weekStart: key, count: counts[key] ?? 0 });
  }
  return out;
}
