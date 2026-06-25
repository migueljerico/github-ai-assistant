// ────────────────────────────────────────────────────────────────────────────
// powerbiReader — Lectura de archivos Power BI (.pbix/.pbit) para adjuntar como
// contexto del chat (#28, Fase 3b — MVP). Un .pbix/.pbit es un ZIP; usamos
// `fflate` (import dinámico → chunk propio, como xlsx/pdfjs) para abrirlo y
// extraer las partes legibles en JSON. Sin dependencias de React.
//
// Qué se extrae:
//   • Informe (`Report/Layout`, en pbix y pbit): páginas + tipos de visual.
//   • Modelo de datos (`DataModelSchema`, SOLO en pbit): tablas, columnas y
//     medidas DAX.
//   • Power Query / M (#28 Fase 3b-bis): nombres de consulta + código M (orígenes y
//     transformaciones), desde dos fuentes — (a) el `DataMashup` (binario [MS-QDEFF]
//     o la variante XML/base64 antigua), presente en .pbix con consultas embebidas; y
//     (b) las particiones del `DataModelSchema` (solo .pbit), la vía fiable cuando el
//     .pbix es moderno.
// Qué NO (limitación honesta, principio rector):
//   • El modelo de un .pbix va en `DataModel` (binario VertiPaq propietario), no
//     legible en navegador. En los .pbix modernos el Power Query (M) también va dentro
//     de ese binario → se avisa y se sugiere exportar como plantilla .pbit (que trae
//     DAX y M en JSON legible).
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
/** Tope de nombres de consulta (Power Query) que se listan. */
export const MAX_QUERIES = 40;
/** Presupuesto propio del bloque de código M (para que no desplace al informe/modelo). */
export const MAX_M_CHARS = 6000;
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

/** Decodifica un entry UTF-8 (con posible BOM) como texto plano (p. ej. el `.m`). */
function decodeUtf8(bytes: Uint8Array): string {
  let text = new TextDecoder('utf-8').decode(bytes);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
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

interface MashupInfo { queries: number; names: string[]; mText: string; truncated: boolean }

/** Decodifica una cadena base64 a bytes (navegador/jsdom: `atob`). */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Decodifica bytes como texto probando UTF-8 y, si parece UTF-16, UTF-16LE. */
function decodeText(bytes: Uint8Array): string {
  // Heurística: muchos bytes nulos en posiciones pares ⇒ UTF-16LE.
  if (bytes.length >= 2 && bytes[1] === 0x00 && bytes[0] !== 0x00) {
    let t = new TextDecoder('utf-16le').decode(bytes);
    if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
    return t;
  }
  return decodeUtf8(bytes);
}

/** Construye el `MashupInfo` a partir del documento `section` de M (nombres + caps). */
function buildMashupFromSection(section: string): MashupInfo | null {
  const text = section.trim();
  if (!text) return null;

  // Cada consulta es una entrada `shared <Nombre> = …;`. El nombre puede venir entre
  // comillas (`#"Mi Consulta"`) o como identificador simple.
  const names: string[] = [];
  const re = /\bshared\s+(#"((?:[^"]|"")*)"|[A-Za-z_][\w.]*)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    names.push(match[2] !== undefined ? match[2].replace(/""/g, '"') : match[1]);
  }

  let truncated = false;
  let shownNames = names;
  if (names.length > MAX_QUERIES) { shownNames = names.slice(0, MAX_QUERIES); truncated = true; }

  let mText = text;
  if (mText.length > MAX_M_CHARS) { mText = mText.slice(0, MAX_M_CHARS); truncated = true; }

  return { queries: names.length, names: shownNames, mText, truncated };
}

/**
 * Núcleo binario del `DataMashup` (formato [MS-QDEFF]): `[versión int32 LE]
 * [longitud int32 LE][ZIP de package parts]…`; ese ZIP contiene `Formulas/Section1.m`.
 */
function parseMashupBinary(
  bytes: Uint8Array,
  unzipSync: (data: Uint8Array) => Record<string, Uint8Array>,
): MashupInfo | null {
  if (bytes.length < 8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const partsLength = view.getUint32(4, true);
  if (partsLength <= 0 || 8 + partsLength > bytes.length) return null;

  const innerZip = unzipSync(bytes.subarray(8, 8 + partsLength));
  const sectionEntry = findEntry(innerZip, 'Formulas/Section1.m');
  if (!sectionEntry) return null;
  return buildMashupFromSection(decodeUtf8(sectionEntry));
}

/**
 * Variante antigua del `DataMashup`: un XML que envuelve el paquete binario como
 * **base64**. Localiza el blob base64 más largo, lo decodifica y lo parsea como binario.
 */
function tryXmlMashup(
  entry: Uint8Array,
  unzipSync: (data: Uint8Array) => Record<string, Uint8Array>,
): MashupInfo | null {
  const text = decodeText(entry);
  if (!text.includes('<')) return null; // no parece XML
  const b64 = text.match(/[A-Za-z0-9+/]{100,}={0,2}/g)?.sort((a, b) => b.length - a.length)[0];
  if (!b64) return null;
  return parseMashupBinary(base64ToBytes(b64), unzipSync);
}

/**
 * Extrae el Power Query (M) del blob `DataMashup` (#28 Fase 3b-bis). Soporta el formato
 * binario [MS-QDEFF] y la variante XML/base64 antigua. Devuelve `null` (sin romper nada)
 * si no hay DataMashup o no es legible (p. ej. en `.pbix` modernos el M va en el modelo
 * binario; ahí se intenta luego `extractModelMashup` sobre el `DataModelSchema` del .pbit).
 */
function extractMashup(
  zip: Record<string, Uint8Array>,
  unzipSync: (data: Uint8Array) => Record<string, Uint8Array>,
): MashupInfo | null {
  const entry = findEntry(zip, 'DataMashup');
  if (!entry) return null;
  try {
    return parseMashupBinary(entry, unzipSync) ?? tryXmlMashup(entry, unzipSync);
  } catch {
    // Variante no soportada o blob ilegible: se ignora sin romper informe/modelo.
    return null;
  }
}

/**
 * Extrae el Power Query (M) del `DataModelSchema` (solo `.pbit`): el M vive en las
 * **particiones** de cada tabla (`partitions[].source` con `type: 'm'` y `expression`).
 * Es la vía fiable para los `.pbix` modernos (basta exportar el informe como `.pbit`).
 */
function extractModelMashup(schema: unknown): MashupInfo | null {
  const tables = (schema as { model?: { tables?: unknown[] } })?.model?.tables;
  if (!Array.isArray(tables)) return null;

  const names: string[] = [];
  const blocks: string[] = [];
  for (const table of tables) {
    const t = table as {
      name?: string;
      partitions?: Array<{ name?: string; source?: { type?: string; expression?: unknown } }>;
    };
    const partitions = Array.isArray(t.partitions) ? t.partitions : [];
    for (const p of partitions) {
      if (p?.source?.type !== 'm') continue;
      const expr = daxToString(p.source.expression);
      if (!expr) continue;
      const name = p.name || t.name || 'Consulta sin nombre';
      names.push(name);
      blocks.push(`// ${name}\n${expr}`);
    }
  }

  if (names.length === 0) return null;

  let truncated = false;
  let shownNames = names;
  if (names.length > MAX_QUERIES) { shownNames = names.slice(0, MAX_QUERIES); truncated = true; }

  let mText = blocks.join('\n\n');
  if (mText.length > MAX_M_CHARS) { mText = mText.slice(0, MAX_M_CHARS); truncated = true; }

  return { queries: names.length, names: shownNames, mText, truncated };
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

  // Decodificar el DataModelSchema (solo .pbit) una vez: lo usan el modelo (DAX) y el
  // Power Query (particiones M).
  let schemaJson: unknown = null;
  if (schemaEntry) {
    try { schemaJson = decodeUtf16Json(schemaEntry); }
    catch { schemaJson = null; }
  }
  const model: ModelInfo | null = schemaJson ? extractModel(schemaJson) : null;

  // Power Query (M) — #28 Fase 3b-bis/3b-bis-2: del DataMashup (binario o XML antiguo)
  // y, si no, de las particiones del DataModelSchema (.pbit).
  const mashup = extractMashup(zip, unzipSync) ?? (schemaJson ? extractModelMashup(schemaJson) : null);

  if (!report && !model && !mashup) {
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
    // .pbix sin DataModelSchema: el modelo va en binario VertiPaq (no legible). Si
    // tampoco pudimos leer el Power Query (.pbix moderno: el M también va en el binario),
    // el aviso lo menciona; si sí hay consultas (p. ej. .pbix antiguo con DataMashup), no.
    const extra = mashup
      ? 'tablas, columnas y medidas DAX'
      : 'tablas, columnas, **medidas DAX** y las **consultas de Power Query (M)** (en los .pbix modernos también van en el modelo binario)';
    sections.push(
      `## Modelo de datos\n\n_El modelo de un .pbix está en formato binario (VertiPaq) no legible ` +
      `en el navegador. Para incluir ${extra}, exporta el informe como plantilla **.pbit** ` +
      `(Power BI Desktop → Archivo → Exportar → Plantilla de Power BI)._`,
    );
    summaryParts.push(mashup
      ? 'Modelo en formato binario (exporta como .pbit para el DAX)'
      : 'Modelo y consultas en formato binario (exporta como .pbit para DAX y Power Query)');
  }

  if (mashup) {
    truncated = truncated || mashup.truncated;
    const nameList = mashup.names.length
      ? mashup.names.map(n => `- ${n}`).join('\n')
      : '_(sin nombres de consulta detectados)_';
    sections.push(
      `## Consultas (Power Query / M)\n\n${mashup.queries} consulta(s):\n${nameList}\n\n` +
      '```m\n' + mashup.mText + '\n```',
    );
    summaryParts.push(`Consultas: ${mashup.queries}`);
  }

  let text = sections.join('\n\n');
  // Presupuesto de caracteres: recorta por bloques enteros si se desborda.
  if (text.length > MAX_POWERBI_CHARS) {
    text = text.slice(0, MAX_POWERBI_CHARS) + '\n\n_(contenido recortado por tamaño)_';
    truncated = true;
  }

  return { text, summary: summaryParts.join(' · '), truncated };
}
