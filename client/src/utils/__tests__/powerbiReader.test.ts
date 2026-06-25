import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de fflate: controlamos el contenido del ZIP (dict path → bytes).
vi.mock('fflate', () => ({ unzipSync: vi.fn() }));

import { unzipSync } from 'fflate';
import {
  readPowerBI,
  MAX_PAGES,
  MAX_TABLES,
} from '../powerbiReader';

/** Codifica un string a UTF-16LE (como guarda Power BI), con BOM opcional. */
function u16le(str: string, bom = false): Uint8Array {
  const prefix = bom ? '﻿' : '';
  const s = prefix + str;
  const buf = new Uint8Array(s.length * 2);
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    buf[i * 2] = code & 0xff;
    buf[i * 2 + 1] = (code >> 8) & 0xff;
  }
  return buf;
}

/** Layout de informe con páginas y visuales (config = string JSON). */
function layout(pages: Array<{ name: string; visuals: string[] }>): string {
  return JSON.stringify({
    sections: pages.map(p => ({
      displayName: p.name,
      visualContainers: p.visuals.map(v => ({
        config: JSON.stringify({ singleVisual: { visualType: v } }),
      })),
    })),
  });
}

/** DataModelSchema con tablas, columnas y medidas DAX. */
function schema(tables: Array<{ name: string; columns: string[]; measures: Array<[string, string]> }>): string {
  return JSON.stringify({
    model: {
      tables: tables.map(t => ({
        name: t.name,
        columns: t.columns.map(c => ({ name: c, dataType: 'double' })),
        measures: t.measures.map(([name, expression]) => ({ name, expression })),
      })),
    },
  });
}

function fakeFile(name: string): File {
  return { name, arrayBuffer: async () => new ArrayBuffer(8) } as unknown as File;
}

function mockZip(entries: Record<string, Uint8Array>) {
  vi.mocked(unzipSync).mockReturnValue(entries as never);
}

describe('readPowerBI (#28 Fase 3b)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('.pbit: extrae informe (páginas/visuales) y modelo (tablas/columnas/medidas DAX)', async () => {
    mockZip({
      'Report/Layout': u16le(layout([
        { name: 'Ventas', visuals: ['barChart', 'card', 'barChart'] },
      ]), true),
      'DataModelSchema': u16le(schema([
        { name: 'Sales', columns: ['Amount', 'Date'], measures: [['Total Sales', 'SUM(Sales[Amount])']] },
      ])),
    });

    const res = await readPowerBI(fakeFile('informe.pbit'));

    expect(res.truncated).toBe(false);
    // Informe
    expect(res.text).toContain('Página "Ventas"');
    expect(res.text).toContain('barChart ×2'); // se agrupan tipos repetidos
    expect(res.text).toContain('card');
    // Modelo + DAX
    expect(res.text).toContain('Tabla "Sales"');
    expect(res.text).toContain('Amount (double)');
    expect(res.text).toContain('Total Sales = SUM(Sales[Amount])');
    // Resumen
    expect(res.summary).toContain('Informe:');
    expect(res.summary).toContain('Modelo: 1 tabla');
  });

  it('.pbix sin DataModelSchema: avisa del modelo binario y sugiere .pbit', async () => {
    mockZip({
      'Report/Layout': u16le(layout([{ name: 'Resumen', visuals: ['slicer'] }])),
      'DataModel': new Uint8Array([1, 2, 3]), // binario VertiPaq, no se lee
    });

    const res = await readPowerBI(fakeFile('informe.pbix'));

    expect(res.text).toContain('Página "Resumen"');
    expect(res.text).toContain('formato binario');
    expect(res.text).toMatch(/\.pbit/);
    expect(res.summary).toMatch(/binario|\.pbit/);
  });

  it('muchas páginas: marca truncado', async () => {
    const pages = Array.from({ length: MAX_PAGES + 5 }, (_, i) => ({ name: `P${i}`, visuals: ['card'] }));
    mockZip({ 'Report/Layout': u16le(layout(pages)) });

    const res = await readPowerBI(fakeFile('grande.pbix'));

    expect(res.truncated).toBe(true);
  });

  it('muchas tablas: marca truncado', async () => {
    const tables = Array.from({ length: MAX_TABLES + 3 }, (_, i) => ({
      name: `T${i}`, columns: ['c'], measures: [] as Array<[string, string]>,
    }));
    mockZip({ 'DataModelSchema': u16le(schema(tables)) });

    const res = await readPowerBI(fakeFile('modelo.pbit'));

    expect(res.truncated).toBe(true);
  });

  it('medida con DAX como array de líneas: lo une', async () => {
    mockZip({
      'DataModelSchema': u16le(JSON.stringify({
        model: { tables: [{ name: 'T', columns: [], measures: [{ name: 'M', expression: ['VAR x = 1', 'RETURN x'] }] }] },
      })),
    });

    const res = await readPowerBI(fakeFile('m.pbit'));

    expect(res.text).toContain('M = VAR x = 1\nRETURN x');
  });

  it('sin informe ni modelo: lanza un error claro', async () => {
    mockZip({ '[Content_Types].xml': new Uint8Array([0]) });
    await expect(readPowerBI(fakeFile('vacio.pbix'))).rejects.toThrow(/informe ni el modelo/i);
  });

  it('ZIP corrupto: lanza un error claro', async () => {
    vi.mocked(unzipSync).mockImplementation(() => { throw new Error('bad zip'); });
    await expect(readPowerBI(fakeFile('roto.pbix'))).rejects.toThrow(/corrupto|protegido|abrir/i);
  });
});
