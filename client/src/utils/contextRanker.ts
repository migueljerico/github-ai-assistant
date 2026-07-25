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

// Glosario ES→EN agnóstico de repo (#68). Las claves van SIN acento/ñ porque ya
// pasan por tokenize() (que normaliza vía NFD, #67) antes de la consulta. Solo
// se usa para expandir el QUERY (ver expandQuery), nunca el corpus de archivos,
// para no contaminar el IDF/avgLen del BM25. Manual, no exhaustivo por diseño.
//
// Cada FAMILIA agrupa las formas flexivas (plurales + conjugaciones) que mapean
// a los mismos sinónimos EN, para cubrir el caso real de uso (preguntas
// coloquiales en español). Se aplana a un Map<string,string[]> al cargar el
// módulo — explícito y predecible, sin stemming automático.
const GLOSSARY_FAMILIES: Array<[string[], string[]]> = [
  // Acciones (infinitivo + conjugaciones comunes)
  [['enviar', 'envio', 'envia', 'envian'], ['send']],
  [['guardar', 'guardo', 'guarda'], ['save', 'store']],
  [['borrar', 'borro', 'borra'], ['delete', 'remove']],
  [['eliminar', 'elimino', 'elimina'], ['delete', 'remove']],
  [['crear', 'creo', 'crea'], ['create']],
  [['editar', 'edito', 'edita'], ['update', 'edit']],
  [['modificar', 'modifico', 'modifica'], ['update', 'edit']],
  [['buscar', 'busco', 'busca'], ['search', 'find']],
  [['mostrar', 'muestro', 'muestra'], ['show', 'list']],
  [['iniciar', 'inicio', 'inicia'], ['login', 'signin', 'init']],
  [['entrar', 'entro', 'entra'], ['login', 'signin']],
  [['cerrar', 'cierro', 'cierra'], ['close', 'logout', 'signout']],
  [['limitar', 'limito', 'limita', 'limitamos'], ['limit', 'rate', 'ratelimit']],
  // Sustantivos de dominios (singular + plural)
  [['mensaje', 'mensajes'], ['message']],
  [['usuario', 'usuarios'], ['user']],
  [['contrasena', 'contrasenas'], ['password', 'secret']],
  [['sesion', 'sesiones'], ['session']],
  [['seguridad', 'seguridades'], ['security', 'auth', 'token']],
  [['pantalla', 'pantallas'], ['screen', 'view', 'ui']],
  [['limite', 'limites'], ['limit', 'rate', 'ratelimit']],
  [['error', 'errores'], ['retry', 'catch', 'error']],
  [['fallo', 'fallos'], ['retry', 'catch', 'error']],
  [['configuracion', 'configuraciones'], ['config', 'settings']],
  [['dato', 'datos'], ['data', 'database', 'db']],
  [['archivo', 'archivos'], ['file']],
  [['carpeta', 'carpetas'], ['folder', 'directory']],
  [['pagina', 'paginas'], ['page']],
  [['boton', 'botones'], ['button']],
  [['formulario', 'formularios'], ['form']],
  [['enlace', 'enlaces'], ['link']],
  [['imagen', 'imagenes'], ['image', 'img']],
  [['prueba', 'pruebas'], ['test', 'spec']],
  [['red', 'redes'], ['network', 'http']],
];
const GLOSSARY = new Map<string, string[]>(
  GLOSSARY_FAMILIES.flatMap(([forms, syns]) => forms.map(f => [f, syns] as [string, string[]])),
);

/** Tokeniza un texto en términos alfanuméricos en minúscula (longitud ≥ 2). */
export function tokenize(text: string): string[] {
  // NFD descompone los diacríticos (á→a+◌́, ñ→n+◌̃); el replace los elimina y queda
  // la letra base sin acento. Así el léxico técnico en español ('autenticación')
  // coincide con los identificadores del código, que van sin acento. #67
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return (normalized.match(/[a-z0-9]+/gi) || []).filter(t => t.length >= 2);
}

/** Tokeniza una ruta separando también por `/`, `.`, `_`, `-`. */
function pathTokens(path: string): string[] {
  return tokenize(path.replace(/[/._-]+/g, ' '));
}

/**
 * Expande el query con sinónimos EN del GLOSSARY (#68). Función pura: devuelve
 * el texto original seguido de los sinónimos EN de cada término ES que se
 * encuentre en el glosario (sin duplicar los ya presentes). Las claves del
 * glosario se comparan ya normalizadas porque aquí tokenizamos antes de mirar.
 *
 * Solo enriquece el QUERY; el corpus de archivos no se toca, así el IDF/avgLen
 * del BM25 se mantienen limpios. Pensado para envolver el query en
 * rankFilesByQuery.
 */
export function expandQuery(query: string): string {
  const terms = tokenize(query);
  if (terms.length === 0) return query;
  const present = new Set(terms);
  const added: string[] = [];
  for (const term of terms) {
    const synonyms = GLOSSARY.get(term);
    if (!synonyms) continue;
    for (const syn of synonyms) {
      if (!present.has(syn)) {
        added.push(syn);
        present.add(syn);
      }
    }
  }
  return added.length === 0 ? query : `${query} ${added.join(' ')}`;
}

/**
 * Devuelve los `topN` archivos más relevantes a `query`. Si la consulta no tiene
 * términos útiles, conserva el orden de entrada (que ya viene por prioridad).
 */
export function rankFilesByQuery(query: string, files: RepoTreeFile[], topN: number): RepoTreeFile[] {
  if (files.length === 0) return [];
  // expandQuery (#68) añade sinónimos EN al query antes de tokenizar; los
  // acentos/ñ ya se normalizan dentro de tokenize (#67).
  const queryTerms = tokenize(expandQuery(query));

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
