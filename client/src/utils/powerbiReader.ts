// ────────────────────────────────────────────────────────────────────────────
// powerbiReader — Lectura de archivos Power BI (.pbix/.pbit) para adjuntar como
// contexto del chat (#28, Fase 3b — MVP). Un .pbix/.pbit es un ZIP; usamos
// `fflate` (import dinámico → chunk propio, como xlsx/pdfjs) para abrirlo y
// extraer las partes legibles en JSON. Sin dependencias de React.
//
// Qué se extrae (MVP):
//   • Informe (`Report/Layout`, en pbix y pbit): páginas + tipos de visual.
//   • Modelo de datos (`DataModelSchema`, SOLO en pbit): tablas, columnas y
//     medidas DAX.
// Qué NO (limitación honesta, principio rector):
//   • El modelo de un .pbix va en `DataModel` (binario VertiPaq propietario), no
//     legible en navegador → se avisa y se sugiere exportar como plantilla .pbit.
//   • Power Query (M) del `DataMashup` (zip anidado) queda para una 3b-bis.
//
// Riesgo de tokens (lección Fase 3a): un modelo puede tener muchas tablas/medidas
// → mismo patrón que spreadsheetReader: muestra acotada (caps + presupuesto de
// caracteres) y `truncated` para avisar al usuario.
// ────────────────────────────────────────────────────────────────────────────

/** Tope de páginas de informe que se listan. */
export const MAX_PAGES = 30;
/** Tope de visuales que se nombran por página. */
export const MAX_VISUALS_PER_PAGE = 25;
/** Tope de tablas del modelo que se incluyen. */
export const MAX_TABLES = 30;
/** Tope de columnas que se listan por tabla. */
export const MAX_COLUMNS_PER_TABLE = 30;
/** Tope de medidas (con DAX) que se listan por tabla. */
export const MAX_MEASURES_PER_TABLE = 40;
/** Presupuesto total de caracteres del texto (evita reventar el contexto del LLM). */
export const MAX_POWERBI_CHARS = 14000;

export interface PowerBIResult {
  /** Contenido legible (informe + modelo) listo para inyectar en el prompt. */
  text: string;
  /** Resumen corto para el mensaje del chat. */
  summary: string;
  /** `true` si se aplicó alguna muestra/cap (no cubre todo el archivo). */
  truncated: boolean;
}

/** Decodifica un entry UTF-16LE (con posible BOM) y lo parsea como JSON. */
function decodeUtf16Json(bytes: Uint8Array): unknown {
  let text = new TextDecoder('utf-16le').decode(bytes);
  // Quita el BOM (U+FEFF) si TextDecoder no lo eliminó.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return JSON.parse(text);
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

/** Normaliza una expresión DAX (puede venir como string o como array de líneas). */
function daxToString(expression: unknown): string {
  if (Array.isArray(expression)) return expression.join('\n');
  return typeof expression === 'string' ? expression : '';
}

interface ReportInfo { pages: number; visuals: number; blocks: string[]; truncated: boolean }

/** Extrae páginas y tipos de visual de `Report/Layout`. */
function extractReport(layout: unknown): ReportInfo {
  const sections = (layout as { sections?: unknown[] })?.sections;
  if (!Array.isArray(sections)) return { pages: 0, visuals: 0, blocks: [], truncated: false };

  let truncated = false;
  let totalVisuals = 0;
  const blocks: string[] = [];

  const shownPages = sections.slice(0, MAX_PAGES);
  if (sections.length > MAX_PAGES) truncated = true;

  for (const section of shownPages) {
    const s = section as { displayName?: string; visualContainers?: unknown[] };
    const name = s.displayName || 'Página sin nombre';
    const containers = Array.isArray(s.visualContainers) ? s.visualContainers : [];
    totalVisuals += containers.length;

    const types: string[] = [];
    for (const c of containers.slice(0, MAX_VISUALS_PER_PAGE)) {
      const rawConfig = (c as { config?: string }).config;
      let visualType = 'desconocido';
      if (typeof rawConfig === 'string') {
        try {
          const cfg = JSON.parse(rawConfig) as { singleVisual?: { visualType?: string } };
          visualType = cfg.singleVisual?.visualType || 'desconocido';
        } catch { /* config ilegible: se ignora el tipo */ }
      }
      types.push(visualType);
    }
    if (containers.length > MAX_VISUALS_PER_PAGE) truncated = true;

    // Cuenta de tipos para un listado compacto: "barChart ×3, card, slicer".
    const counts = new Map<string, number>();
    for (const t of types) counts.set(t, (counts.get(t) ?? 0) + 1);
    const visualList = [...counts.entries()]
      .map(([t, n]) => (n > 1 ? `${t} ×${n}` : t))
      .join(', ');

    blocks.push(`### Página "${name}" (${containers.length} visual(es))\n${visualList || '(sin visuales)'}`);
  }

  return { pages: sections.length, visuals: totalVisuals, blocks, truncated };
}

interface ModelInfo { tables: number; measures: number; blocks: string[]; truncated: boolean }

/** Extrae tablas, columnas y medidas DAX de `DataModelSchema` (solo .pbit). */
function extractModel(schema: unknown): ModelInfo {
  const tables = (schema as { model?: { tables?: unknown[] } })?.model?.tables;
  if (!Array.isArray(tables)) return { tables: 0, measures: 0, blocks: [], truncated: false };

  let truncated = false;
  let totalMeasures = 0;
  const blocks: string[] = [];

  const shownTables = tables.slice(0, MAX_TABLES);
  if (tables.length > MAX_TABLES) truncated = true;

  for (const table of shownTables) {
    const t = table as {
      name?: string;
      columns?: Array<{ name?: string; dataType?: string }>;
      measures?: Array<{ name?: string; expression?: unknown }>;
    };
    const name = t.name || 'Tabla sin nombre';
    const columns = Array.isArray(t.columns) ? t.columns : [];
    const measures = Array.isArray(t.measures) ? t.measures : [];
    totalMeasures += measures.length;

    const colList = columns
      .slice(0, MAX_COLUMNS_PER_TABLE)
      .map(c => `${c.name ?? '?'} (${c.dataType ?? 'desconocido'})`)
      .join(', ');
    if (columns.length > MAX_COLUMNS_PER_TABLE) truncated = true;

    const measureLines = measures
      .slice(0, MAX_MEASURES_PER_TABLE)
      .map(m => `- ${m.name ?? '?'} = ${daxToString(m.expression) || '(sin expresión)'}`)
      .join('\n');
    if (measures.length > MAX_MEASURES_PER_TABLE) truncated = true;

    let block = `### Tabla "${name}" (${columns.length} columna(s), ${measures.length} medida(s))`;
    if (colList) block += `\nColumnas: ${colList}`;
    if (measureLines) block += `\nMedidas (DAX):\n${measureLines}`;
    blocks.push(block);
  }

  return { tables: tables.length, measures: totalMeasures, blocks, truncated };
}

/**
 * Lee un archivo Power BI (.pbix/.pbit) y devuelve el informe (páginas/visuales)
 * y, si es .pbit, el modelo de datos (tablas, columnas, medidas DAX), junto con un
 * resumen y si se truncó. Lanza un error claro si no hay partes legibles.
 */
export async function readPowerBI(file: File): Promise<PowerBIResult> {
  const { unzipSync } = await import('fflate');

  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error('No pude abrir el archivo Power BI (¿está corrupto o protegido con contraseña?). Prueba a re-exportarlo desde Power BI Desktop.');
  }

  const layoutEntry = findEntry(zip, 'Report/Layout');
  const schemaEntry = findEntry(zip, 'DataModelSchema');

  let report: ReportInfo | null = null;
  if (layoutEntry) {
    try { report = extractReport(decodeUtf16Json(layoutEntry)); }
    catch { report = null; }
  }

  let model: ModelInfo | null = null;
  if (schemaEntry) {
    try { model = extractModel(decodeUtf16Json(schemaEntry)); }
    catch { model = null; }
  }

  if (!report && !model) {
    throw new Error('No encontré el informe ni el modelo dentro del archivo Power BI. Asegúrate de exportar un .pbix o una plantilla .pbit válidos.');
  }

  let truncated = false;
  const sections: string[] = [];
  const summaryParts: string[] = [];

  if (report) {
    truncated = truncated || report.truncated;
    sections.push(`## Informe (páginas y visuales)\n\n${report.blocks.join('\n\n')}`);
    summaryParts.push(`Informe: ${report.pages} página(s), ${report.visuals} visual(es)`);
  }

  if (model) {
    truncated = truncated || model.truncated;
    sections.push(`## Modelo de datos\n\n${model.blocks.join('\n\n')}`);
    summaryParts.push(`Modelo: ${model.tables} tabla(s), ${model.measures} medida(s)`);
  } else {
    // .pbix sin DataModelSchema: el modelo va en binario VertiPaq (no legible).
    sections.push(
      '## Modelo de datos\n\n_El modelo de un .pbix está en formato binario (VertiPaq) no legible ' +
      'en el navegador. Para incluir tablas, columnas y medidas DAX, exporta el informe como ' +
      'plantilla **.pbit** (Power BI Desktop → Archivo → Exportar → Plantilla de Power BI)._',
    );
    summaryParts.push('Modelo en formato binario (exporta como .pbit para el DAX)');
  }

  let text = sections.join('\n\n');
  // Presupuesto de caracteres: recorta por bloques enteros si se desborda.
  if (text.length > MAX_POWERBI_CHARS) {
    text = text.slice(0, MAX_POWERBI_CHARS) + '\n\n_(contenido recortado por tamaño)_';
    truncated = true;
  }

  return { text, summary: summaryParts.join(' · '), truncated };
}
