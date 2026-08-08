import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SPREADSHEET_MAX_FILE_SIZE } from '../spreadsheetReader';

// Mock de xlsx (SheetJS): controlamos el workbook y el CSV que produce cada hoja.
vi.mock('xlsx', () => {
  return {
    read: vi.fn(),
    utils: {
      decode_range: (ref: string) => {
        // "A1:C3" → { s:{r:0,c:0}, e:{r:2,c:2} }
        const [, end] = ref.split(':');
        const col = (s: string) => s.charCodeAt(0) - 65;
        const m = (end ?? ref).match(/([A-Z]+)(\d+)/)!;
        return { s: { r: 0, c: 0 }, e: { r: Number(m[2]) - 1, c: col(m[1]) } };
      },
      sheet_to_csv: (ws: { __csv: string }) => ws.__csv,
    },
  };
});

import * as XLSX from 'xlsx';
import { readSpreadsheet, SPREADSHEET_SAMPLE_ROWS } from '../spreadsheetReader';

/** Construye un File falso de hoja de cálculo (xlsx por defecto). */
function fakeFile(name = 'datos.xlsx', size?: number): File {
  return {
    name,
    size: size ?? 8,
    arrayBuffer: async () => new ArrayBuffer(8),
    text: async () => 'a,b\n1,2',
  } as unknown as File;
}

/** Workbook simulado: una hoja con `ref` y su CSV ya resuelto. */
function workbook(sheets: Record<string, { ref: string; csv: string }>) {
  const Sheets: Record<string, unknown> = {};
  for (const [name, { ref, csv }] of Object.entries(sheets)) {
    Sheets[name] = { '!ref': ref, __csv: csv };
  }
  return { SheetNames: Object.keys(sheets), Sheets };
}

describe('readSpreadsheet (#28 Fase 3a)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('hoja pequeña: incluye el contenido y NO marca truncado', async () => {
    const csv = 'col1,col2\n1,2\n3,4'; // cabecera + 2 filas
    vi.mocked(XLSX.read).mockReturnValue(workbook({ Datos: { ref: 'A1:B3', csv } }) as never);

    const res = await readSpreadsheet(fakeFile());

    expect(res.truncated).toBe(false);
    expect(res.text).toContain('Hoja "Datos"');
    expect(res.text).toContain('3 filas × 2 columnas');
    expect(res.text).toContain('Contenido:');
    expect(res.text).toContain('col1,col2');
    expect(res.summary).toContain('Datos');
  });

  it('hoja grande: marca truncado y limita a la muestra de filas', async () => {
    // cabecera + 500 filas de datos → supera SPREADSHEET_SAMPLE_ROWS (100)
    const rows = ['h1,h2', ...Array.from({ length: 500 }, (_, i) => `${i},x`)];
    const csv = rows.join('\n');
    vi.mocked(XLSX.read).mockReturnValue(workbook({ Big: { ref: 'A1:B501', csv } }) as never);

    const res = await readSpreadsheet(fakeFile());

    expect(res.truncated).toBe(true);
    expect(res.text).toContain(`Muestra de las primeras ${SPREADSHEET_SAMPLE_ROWS} filas`);
    // No debe volcar las 500 filas: como mucho cabecera + 100.
    const dataLines = res.text.split('\n').filter(l => /^\d+,x$/.test(l));
    expect(dataLines.length).toBeLessThanOrEqual(SPREADSHEET_SAMPLE_ROWS);
  });

  it('CSV: usa file.text() y type string', async () => {
    vi.mocked(XLSX.read).mockReturnValue(workbook({ Sheet1: { ref: 'A1:A2', csv: 'a\n1' } }) as never);

    await readSpreadsheet(fakeFile('ventas.csv'));

    expect(XLSX.read).toHaveBeenCalledWith('a,b\n1,2', { type: 'string' });
  });

  it('varias hojas por encima del tope: las omite y marca truncado', async () => {
    const sheets: Record<string, { ref: string; csv: string }> = {};
    for (let i = 1; i <= 7; i++) sheets[`H${i}`] = { ref: 'A1:A2', csv: 'a\n1' };
    vi.mocked(XLSX.read).mockReturnValue(workbook(sheets) as never);

    const res = await readSpreadsheet(fakeFile());

    expect(res.truncated).toBe(true);
    expect(res.text).toContain('hoja(s) más no mostradas');
    expect(res.summary).toContain('7 hojas');
  });

  it('workbook vacío: lanza un error claro', async () => {
    vi.mocked(XLSX.read).mockReturnValue({ SheetNames: [], Sheets: {} } as never);
    await expect(readSpreadsheet(fakeFile())).rejects.toThrow(/vac[ií]a|no se pudo leer/i);
  });

  it('archivo > 10 MB: rechaza antes de parsear (SPREADSHEET_MAX_FILE_SIZE)', async () => {
    const bigFile = fakeFile('grande.xlsx', SPREADSHEET_MAX_FILE_SIZE + 1);
    await expect(readSpreadsheet(bigFile)).rejects.toThrow(/excede el l[ií]mite|tamaño|10 MB/i);
  });

  it('hoja con líneas muy largas: recorta por límite de caracteres (MAX_CHARS_PER_SHEET)', async () => {
    // 5 filas muy largas donde la longitud acumulada excede MAX_CHARS_PER_SHEET
    const longLine = 'x'.repeat(4000);
    const rows = ['header1,header2', ...Array.from({ length: 5 }, () => longLine)];
    const csv = rows.join('\n');
    vi.mocked(XLSX.read).mockReturnValue(workbook({ LongSheet: { ref: 'A1:B6', csv } }) as never);

    const res = await readSpreadsheet(fakeFile());

    expect(res.truncated).toBe(true);
  });

  it('hoja con cabecera sospechosa: emite console.warn', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Cabecera que no contiene ningún carácter alfanumérico (ej: caracteres nulos o símbolos)
    const csv = '!!!,???\n1,2';
    vi.mocked(XLSX.read).mockReturnValue(workbook({ Suspicious: { ref: 'A1:B2', csv } }) as never);

    await readSpreadsheet(fakeFile());

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[spreadsheetReader] Hoja "Suspicious" con cabecera sospechosa'));
    warnSpy.mockRestore();
  });
});

