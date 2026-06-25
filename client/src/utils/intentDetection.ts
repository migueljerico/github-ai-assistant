// ────────────────────────────────────────────────────────────────────────────
// intentDetection — Detecta órdenes en lenguaje natural de DOCUMENTAR o PUBLICAR
// para enrutarlas a los flujos reales (generar doc / modal de publicar) en vez de
// dejarlas en una respuesta de chat. Principio rector: el usuario habla en lenguaje
// natural; "documéntalo" o "publícalo en X" deben HACERSE, no explicarse.
// Sin dependencias de React → testeable de forma aislada.
// ────────────────────────────────────────────────────────────────────────────

/** Intención de documentar o publicar detectada en el mensaje del usuario. */
export type DocPublishIntent =
  | { kind: 'document' }
  | { kind: 'publish'; repo?: string };

// Verbos que indican PUBLICAR (subir/commit/crear release). Tienen prioridad sobre
// documentar, porque publicar implica documentar y además subirlo.
const PUBLISH_KEYWORDS = [
  'publica', 'publícalo', 'publicalo', 'publícala', 'publicala', 'publiquen',
  'súbelo', 'subelo', 'súbela', 'subela', 'sube la doc', 'sube el', 'subir',
  'haz el commit', 'haz commit', 'comitea', 'commitea', 'commitealo', 'comitealo',
  'crea el release', 'haz el release', 'crea la release',
];

// Verbos que indican DOCUMENTAR (generar la documentación / README).
const DOCUMENT_KEYWORDS = [
  'documenta', 'documéntalo', 'documentalo', 'documéntame', 'documentame',
  'documéntala', 'documentala', 'documentar', 'documentación', 'documentacion',
  'genera la doc', 'genera el readme', 'haz la doc', 'haz el readme',
  'crea el readme', 'redacta la doc', 'redacta el readme', 'escribe la doc',
];

/**
 * Extrae el repo destino de una orden de publicar, p. ej. "publícalo en el repo
 * owner/repo" o "súbelo a mi-repo". Devuelve `owner/repo` o `repo`, o `undefined`.
 */
function extractRepo(message: string): string | undefined {
  // "(en|a|al|sobre) [el] [repo|repositorio] <nombre>" — admite owner/repo o repo.
  const re = /\b(?:en|a|al|sobre)\s+(?:el\s+|mi\s+|tu\s+)?(?:repo(?:sitorio)?\s+)?([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+|[A-Za-z0-9_.-]{2,})/i;
  const m = re.exec(message);
  if (m) return m[1];
  // "repo[sitorio] <nombre>" sin preposición previa.
  const re2 = /\brepo(?:sitorio)?\s+([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+|[A-Za-z0-9_.-]{2,})/i;
  const m2 = re2.exec(message);
  return m2 ? m2[1] : undefined;
}

// Marcadores de petición EXPLORATORIA: el usuario quiere conversar/analizar o está
// PREGUNTANDO, no dando una orden. En esos casos no se enruta a documentar/publicar
// (se atiende en chat), aunque la frase contenga "documentar" (#28 v3.6.1).
const EXPLORATORY_KEYWORDS = [
  'analiza', 'analizar', 'analizando', 'analízalo', 'analizalo',
  'opina', 'opinión', 'opinion', 'opinas', 'qué te parece', 'que te parece',
  'revisa', 'revísalo', 'revisalo', 'evalúa', 'evalua', 'valora', 'valoración',
  'explica', 'explícame', 'explicame', 'comenta', 'echa un vistazo', 'échale un vistazo',
  'ayúdame', 'ayudame', 'ayudarme', 'me gustaría', 'me gustaria',
];

/**
 * `true` si el mensaje es exploratorio: una PREGUNTA (`?`/`¿`) o con tono de
 * análisis/ayuda. Sirve para NO saltar a documentar/publicar y conversar primero.
 */
export function isExploratory(message: string): boolean {
  if (message.includes('?') || message.includes('¿')) return true;
  const lower = message.toLowerCase();
  return EXPLORATORY_KEYWORDS.some(k => lower.includes(k));
}

/**
 * Detecta si el mensaje es una ORDEN de documentar o publicar. Publicar tiene
 * prioridad. Devuelve `null` si es exploratorio (pregunta/análisis) o si no hay tal
 * orden — en ambos casos se trata como chat.
 */
export function detectDocPublishIntent(message: string): DocPublishIntent | null {
  // Conversar primero: las peticiones de análisis/ayuda o preguntas no abren el modal.
  if (isExploratory(message)) return null;

  const lower = message.toLowerCase();

  if (PUBLISH_KEYWORDS.some(k => lower.includes(k))) {
    return { kind: 'publish', repo: extractRepo(message) };
  }
  if (DOCUMENT_KEYWORDS.some(k => lower.includes(k))) {
    return { kind: 'document' };
  }
  return null;
}

/** A qué flujo enrutar el mensaje, según la intención y el contexto disponible. */
export type SendRoute = 'document-file' | 'publish-file' | 'document-repo' | 'chat';

/**
 * Decide el flujo a partir de la intención y de si hay archivo/repo en contexto.
 * Mantiene la lógica fuera de App.tsx (glue) para poder testearla.
 * - Con archivo adjunto: documentar/publicar el archivo.
 * - Sin archivo pero con repo (en contexto o nombrado): documentar el repo.
 * - En cualquier otro caso: chat normal.
 */
export function routeUserMessage(
  intent: DocPublishIntent | null,
  ctx: { hasFile: boolean; hasRepo: boolean },
): SendRoute {
  if (!intent) return 'chat';
  if (ctx.hasFile) return intent.kind === 'publish' ? 'publish-file' : 'document-file';
  if (ctx.hasRepo) return 'document-repo';
  // publish con repo nombrado pero sin archivo: documentar ese repo.
  if (intent.kind === 'publish' && intent.repo) return 'document-repo';
  return 'chat';
}
