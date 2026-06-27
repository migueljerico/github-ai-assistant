// ── contextRanker (#49) ──────────────────────────────────────────────────────
// Selecciona, de entre los archivos del repo cargados en memoria, los MÁS
// RELEVANTES a la pregunta del usuario, para enviar solo esos al LLM (mejores
// respuestas, menos tokens). Ranking léxico ligero (BM25) — sin dependencias, sin
// embeddings, todo en memoria (Zero-Storage). Determinista → fácil de testear.
//
// Dos señales:
//   1) BM25 sobre los términos de la consulta vs. el texto de cada archivo (ruta +
//      contenido), con IDF para premiar términos discriminantes.
//   2) BOOST fuerte si la consulta menciona el NOMBRE/RUTA del archivo (p. ej.
//      "¿qué te parece MEJORAS_FUTURAS.md?" → ese archivo sube arriba aunque su
//      contenido tenga pocos términos en común con la pregunta).

import type { RepoTreeFile } from '../services/github';

// Extensiones poco discriminantes para el boost por nombre (no cuentan como "mención").
const COMMON_EXTENSIONS = new Set([
  'md', 'ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'yml', 'yaml', 'txt', 'py',
]);

/** Tokeniza un texto en términos alfanuméricos en minúscula (longitud ≥ 2). */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/gi) || []).filter(t => t.length >= 2);
}

/** Tokeniza una ruta separando también por `/`, `.`, `_`, `-`. */
function pathTokens(path: string): string[] {
  return tokenize(path.replace(/[/._-]+/g, ' '));
}

/**
 * Devuelve los `topN` archivos más relevantes a `query`. Si la consulta no tiene
 * términos útiles, conserva el orden de entrada (que ya viene por prioridad).
 */
export function rankFilesByQuery(query: string, files: RepoTreeFile[], topN: number): RepoTreeFile[] {
  if (files.length === 0) return [];
  const queryTerms = tokenize(query);

  // Sin términos de consulta → no hay señal: respeta el orden de entrada.
  if (queryTerms.length === 0) return files.slice(0, topN);

  // Documento = ruta (con peso extra repitiéndola) + contenido.
  const docs = files.map(f => tokenize(`${f.path} ${f.path} ${f.content}`));
  const N = docs.length;
  const avgLen = docs.reduce((s, d) => s + d.length, 0) / N || 1;

  // Frecuencia de documento por término (para el IDF).
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const term of new Set(doc)) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const idf = (term: string): number => {
    const n = df.get(term) ?? 0;
    return Math.log(1 + (N - n + 0.5) / (n + 0.5));
  };

  const k1 = 1.5;
  const b = 0.75;

  // Términos "significativos" de la consulta para el boost por nombre (no extensiones).
  const nameTerms = queryTerms.filter(t => !COMMON_EXTENSIONS.has(t) && t.length >= 3);

  const scored = files.map((file, i) => {
    const doc = docs[i];
    const len = doc.length || 1;
    const tf = new Map<string, number>();
    for (const term of doc) tf.set(term, (tf.get(term) ?? 0) + 1);

    let score = 0;
    for (const term of queryTerms) {
      const f = tf.get(term) ?? 0;
      if (f === 0) continue;
      score += idf(term) * (f * (k1 + 1)) / (f + k1 * (1 - b + b * (len / avgLen)));
    }

    // Boost por mención del nombre/ruta del archivo.
    const ptoks = new Set(pathTokens(file.path));
    const nameHits = nameTerms.filter(t => ptoks.has(t)).length;
    if (nameHits > 0) score += 1000 * nameHits;

    return { file, score, i };
  });

  // Orden estable: por score desc, y a igualdad, por el orden de entrada (prioridad).
  scored.sort((a, b2) => (b2.score - a.score) || (a.i - b2.i));
  return scored.slice(0, topN).map(s => s.file);
}
