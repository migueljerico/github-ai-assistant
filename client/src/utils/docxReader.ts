// ────────────────────────────────────────────────────────────────────────────
// docxReader — Lectura de documentos Word (.docx) para adjuntar como contexto del
// chat (#28). Un .docx es un ZIP OOXML; el texto vive en `word/document.xml`
// (párrafos `<w:p>` con runs `<w:t>`). Misma forma que powerbiReader: usamos
// `fflate` (import dinámico → chunk propio) para abrir el ZIP y un extractor a
// medida que devuelve texto plano legible. Sin dependencias de React ni nuevas
// librerías (Zero-Storage: todo en memoria).
//
// Limitación honesta (principio rector): se extrae el TEXTO (párrafos, listas y el
// contenido de las tablas, fila a fila). No se preservan estilos, imágenes ni el
// formato exacto de la tabla — basta para opinar/resumir/documentar. El `.doc`
// binario antiguo NO está soportado (no es OOXML).
// ────────────────────────────────────────────────────────────────────────────

/** Presupuesto de caracteres del texto extraído (evita reventar el contexto del LLM). */
export const MAX_DOCX_CHARS = 14000;

export interface DocxResult {
  /** Texto del documento listo para inyectar en el prompt. */
  text: string;
  /** Resumen corto para el mensaje del chat. */
  summary: string;
  /** `true` si se recortó el texto (no cubre todo el documento). */
  truncated: boolean;
}

/** Busca un entry del zip por clave exacta o por su nombre final (case-insensitive). */
function findEntry(zip: Record<string, Uint8Array>, name: string): Uint8Array | undefined {
  if (zip[name]) return zip[name];
  const lower = name.toLowerCase();
  for (const key of Object.keys(zip)) {
    if (key.toLowerCase() === lower || key.toLowerCase().endsWith('/' + lower)) return zip[key];
  }
  return undefined;
}

/** Decodifica un entry UTF-8 (con posible BOM) como texto plano. */
function decodeUtf8(bytes: Uint8Array): string {
  let text = new TextDecoder('utf-8').decode(bytes);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
}

/** Decodifica las entidades XML más comunes (nombradas y numéricas). */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&'); // el & va el último para no re-decodificar
}

/**
 * Convierte el XML de `word/document.xml` en texto plano legible.
 * Inserta saltos/tabs según la estructura (párrafos, saltos, tabs y celdas/filas de
 * tabla) y luego elimina el resto de etiquetas — en `document.xml` el texto solo vive
 * dentro de `<w:t>`, así que tras los reemplazos queda el texto de los párrafos.
 * Función pura (testeable sin descomprimir nada).
 */
export function docxXmlToText(xml: string): string {
  const withBreaks = xml
    .replace(/<w:tab\b[^>]*\/?>/g, '\t')
    .replace(/<w:br\b[^>]*\/?>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/w:tc>/g, '\t')
    .replace(/<\/w:tr>/g, '\n');

  const noTags = withBreaks.replace(/<[^>]+>/g, '');
  const decoded = decodeXmlEntities(noTags);

  return decoded
    .replace(/\n\t/g, '\t')         // celda de tabla: el `</w:p>` interno no debe partir la fila
    .replace(/\t+\n/g, '\n')        // tab sobrante al final de fila de tabla
    .replace(/[ \t]+$/gm, '')       // espacios/tabs al final de línea
    .replace(/\n{3,}/g, '\n\n')     // colapsa líneas en blanco de sobra
    .trim();
}

/**
 * Lee un .docx y extrae su texto. Lanza un error claro si el ZIP no tiene
 * `word/document.xml` (archivo dañado o no es un .docx válido).
 */
export async function readDocx(file: File): Promise<DocxResult> {
  const { unzipSync } = await import('fflate');
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()));

  const docEntry = findEntry(zip, 'word/document.xml');
  if (!docEntry) {
    throw new Error('No pude leer el contenido del .docx (¿está dañado o no es un Word válido?).');
  }

  const full = docxXmlToText(decodeUtf8(docEntry));
  if (!full.trim()) {
    throw new Error('El documento Word no tiene texto legible (¿solo imágenes?).');
  }

  const truncated = full.length > MAX_DOCX_CHARS;
  const text = truncated ? full.slice(0, MAX_DOCX_CHARS) + '\n\n[... documento recortado ...]' : full;

  const words = full.split(/\s+/).filter(Boolean).length;
  const summary = `Documento Word: ~${words} palabra${words === 1 ? '' : 's'}`;

  return { text, summary, truncated };
}
