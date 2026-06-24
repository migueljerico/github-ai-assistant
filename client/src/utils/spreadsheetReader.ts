// ────────────────────────────────────────────────────────────────────────────
// spreadsheetReader — Lectura de hojas de cálculo (Excel/CSV) para adjuntar como
// contexto del chat (#28, Fase 3a). Usa SheetJS (`xlsx`) con import dinámico para
// que vaya en su propio chunk (como pdfjs). Sin dependencias de React.
//
// Riesgo nº1 (tokens): un Excel/CSV puede tener decenas de miles de filas; volcar
// todo al LLM revienta el contexto. Por eso solo extraemos **cabeceras + una
// muestra de las primeras filas** y marcamos `truncated` para avisar al usuario.
// ────────────────────────────────────────────────────────────────────────────

/** Nº de filas de datos (tras la cabecera) que se incluyen como muestra por hoja. */
export const SPREADSHEET_SAMPLE_ROWS = 100;

/** Tope de hojas que se incluyen (las hojas de más se omiten con aviso). */
const MAX_SHEETS = 5;

/** Presupuesto de caracteres por hoja (recorta filas enteras si se supera).
 *  Holgado para que ~100 filas normales quepan sin recortar (aviso honesto). */
const MAX_CHARS_PER_SHEET = 8000;

export interface SpreadsheetResult {
  /** Contenido legible (cabeceras + muestra) listo para inyectar en el prompt. */
  text: string;
  /** Resumen corto para el mensaje del chat (p. ej. "1 hoja · 50.000 filas × 12 columnas"). */
  summary: string;
  /** `true` si se omitieron filas u hojas (la muestra no cubre todo el dataset). */
  truncated: boolean;
}

/** Recorta un bloque CSV a `maxRows` líneas y a `maxChars`, por líneas enteras. */
function limitCsv(csv: string, maxRows: number, maxChars: number): { text: string; cut: boolean } {
  const lines = csv.split('\n');
  // Quita una posible línea final vacía que deja sheet_to_csv.
  if (lines.length && lines[lines.length - 1] === '') lines.pop();

  let cut = lines.length > maxRows;
  const kept = lines.slice(0, maxRows);

  let text = kept.join('\n');
  if (text.length > maxChars) {
    // Recorta por líneas enteras hasta caber en el presupuesto de caracteres.
    let acc = '';
    for (const line of kept) {
      if (acc.length + line.length + 1 > maxChars) { cut = true; break; }
      acc += (acc ? '\n' : '') + line;
    }
    text = acc;
  }
  return { text, cut };
}

/**
 * Lee un Excel (.xlsx/.xls) o CSV y devuelve cabeceras + una muestra de filas por
 * hoja, junto con un resumen y si se truncó. Lanza un error claro si está vacío.
 */
export async function readSpreadsheet(file: File): Promise<SpreadsheetResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const XLSX = await import('xlsx');

  const workbook = ext === 'csv'
    ? XLSX.read(await file.text(), { type: 'string' })
    : XLSX.read(await file.arrayBuffer(), { type: 'array' });

  const sheetNames = workbook.SheetNames ?? [];
  if (sheetNames.length === 0) {
    throw new Error('La hoja de cálculo está vacía o no se pudo leer. Prueba a re-exportarla.');
  }

  const blocks: string[] = [];
  const summaries: string[] = [];
  let truncated = false;

  const shown = sheetNames.slice(0, MAX_SHEETS);
  for (const name of shown) {
    const ws = workbook.Sheets[name];
    const ref = ws?.['!ref'];
    const range = ref ? XLSX.utils.decode_range(ref) : null;
    const totalRows = range ? range.e.r - range.s.r + 1 : 0;
    const totalCols = range ? range.e.c - range.s.c + 1 : 0;

    const csv = ws ? XLSX.utils.sheet_to_csv(ws) : '';
    // Cabecera (1) + muestra de filas de datos.
    const { text: sampleCsv, cut } = limitCsv(csv, SPREADSHEET_SAMPLE_ROWS + 1, MAX_CHARS_PER_SHEET);
    if (cut) truncated = true;

    const dataRows = Math.max(0, totalRows - 1);
    const header = `### Hoja "${name}" (${totalRows} filas × ${totalCols} columnas)`;
    const note = cut
      ? `Muestra de las primeras ${SPREADSHEET_SAMPLE_ROWS} filas (de ${dataRows.toLocaleString('es-ES')}):`
      : 'Contenido:';
    blocks.push(`${header}\n${note}\n${sampleCsv}`);
    summaries.push(`"${name}" (${totalRows.toLocaleString('es-ES')} filas × ${totalCols} columnas)`);
  }

  if (sheetNames.length > MAX_SHEETS) {
    truncated = true;
    blocks.push(`_(+${sheetNames.length - MAX_SHEETS} hoja(s) más no mostradas)_`);
  }

  const summary = sheetNames.length === 1
    ? summaries[0]
    : `${sheetNames.length} hojas: ${summaries.join(', ')}`;

  return { text: blocks.join('\n\n'), summary, truncated };
}
