import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de fflate: controlamos el contenido del ZIP (dict path → bytes).
vi.mock('fflate', () => ({ unzipSync: vi.fn() }));

import { unzipSync } from 'fflate';
import {
  readPowerBI,
  MAX_PAGES,
  MAX_TABLES,
  MAX_QUERIES,
  MAX_M_CHARS,
  MAX_VISUALS_PER_PAGE,
  MAX_COLUMNS_PER_TABLE,
  MAX_MEASURES_PER_TABLE,
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

describe('readPowerBI — Power Query / M (#28 Fase 3b-bis)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  /** Documento `section` de M con una entrada `shared` por consulta. */
  function sectionDoc(queries: Array<{ name: string; body?: string }>): string {
    return 'section Section1;\n\n' + queries
      .map(q => `shared ${q.name} = let\n    Source = ${q.body ?? '"x"'}\nin\n    Source;`)
      .join('\n\n');
  }

  /** DataMashup binario válido: [versión 4B][longitud 4B LE][ZIP anidado marcado con 'PK']. */
  function buildDataMashup(): Uint8Array {
    const inner = new Uint8Array(16);
    inner[0] = 0x50; inner[1] = 0x4b; // 'PK' — marca para que el mock devuelva el zip interno
    const entry = new Uint8Array(8 + inner.length);
    new DataView(entry.buffer).setUint32(4, inner.length, true);
    entry.set(inner, 8);
    return entry;
  }

  /**
   * Mock de `unzipSync` que distingue la llamada externa (bytes del archivo) de la
   * interna (subarray del DataMashup, que empieza por 'PK' = 0x50): la externa
   * devuelve `outer`; la interna, `Formulas/Section1.m` con el M dado.
   */
  function mockMashup(outer: Record<string, Uint8Array>, section: string) {
    const inner = { 'Formulas/Section1.m': new TextEncoder().encode(section) };
    vi.mocked(unzipSync).mockImplementation((data: Uint8Array) =>
      (data[0] === 0x50 ? inner : outer) as never);
  }

  it('.pbix con DataMashup: extrae nombres de consulta y el código M', async () => {
    const m = sectionDoc([{ name: 'Ventas', body: 'Sql.Database("srv", "db")' }, { name: 'Clientes' }]);
    mockMashup({
      'Report/Layout': u16le(layout([{ name: 'P', visuals: ['card'] }])),
      'DataMashup': buildDataMashup(),
    }, m);

    const res = await readPowerBI(fakeFile('informe.pbix'));

    expect(res.text).toContain('Consultas (Power Query / M)');
    expect(res.text).toContain('- Ventas');
    expect(res.text).toContain('- Clientes');
    expect(res.text).toContain('```m');
    expect(res.text).toContain('Sql.Database("srv", "db")');
    expect(res.summary).toContain('Consultas: 2');
  });

  it('nombres entre comillas (#"…"): se normalizan sin las comillas', async () => {
    mockMashup({ 'DataMashup': buildDataMashup() }, sectionDoc([{ name: '#"Mi Consulta"' }]));

    const res = await readPowerBI(fakeFile('q.pbix'));

    expect(res.text).toContain('- Mi Consulta');
  });

  it('código M enorme: respeta MAX_M_CHARS y marca truncado', async () => {
    const big = sectionDoc([{ name: 'Grande', body: '"' + 'A'.repeat(MAX_M_CHARS + 500) + '"' }]);
    mockMashup({ 'DataMashup': buildDataMashup() }, big);

    const res = await readPowerBI(fakeFile('grande.pbix'));

    expect(res.truncated).toBe(true);
    expect(res.text).toContain('Consultas (Power Query / M)');
  });

  it('muchas consultas: cuenta todas pero lista hasta MAX_QUERIES y marca truncado', async () => {
    const queries = Array.from({ length: MAX_QUERIES + 5 }, (_, i) => ({ name: `Q${i}` }));
    mockMashup({ 'DataMashup': buildDataMashup() }, sectionDoc(queries));

    const res = await readPowerBI(fakeFile('muchas.pbix'));

    expect(res.truncated).toBe(true);
    expect(res.summary).toContain(`Consultas: ${MAX_QUERIES + 5}`);
  });

  it('DataMashup con ZIP interno corrupto: el catch defensivo devuelve null sin romper el informe', async () => {
    // Cabecera binaria válida (versión + longitud) pero el paquete ZIP interior
    // está dañado (unzipSync lanza — deflate corrupto, caso real de archivo
    // incompleto): el catch de extractMashup debe abortar solo el M.
    vi.mocked(unzipSync).mockImplementation(((data: Uint8Array) => {
      if (data[0] === 0x50) throw new Error('tar interno corrupto'); // subarray interior marcado 'PK'
      return {
        'Report/Layout': u16le(layout([{ name: 'P', visuals: ['card'] }])),
        'DataMashup': buildDataMashup(),
      } as never;
    }) as never);

    const res = await readPowerBI(fakeFile('corrupto.pbix'));

    expect(res.text).toContain('Página "P"');          // informe intacto
    expect(res.text).not.toContain('Consultas (Power Query / M)');
    expect(res.summary).not.toContain('Consultas:');
  });

  it('DataMashup con cabecera inválida: se ignora sin romper el informe', async () => {
    const bad = new Uint8Array(12);
    new DataView(bad.buffer).setUint32(4, 9999, true); // longitud > tamaño → se descarta
    mockZip({ 'Report/Layout': u16le(layout([{ name: 'P', visuals: ['card'] }])), 'DataMashup': bad });

    const res = await readPowerBI(fakeFile('raro.pbix'));

    expect(res.text).toContain('Página "P"');
    expect(res.text).not.toContain('Consultas (Power Query / M)'); // no se extrajo sección de consultas
    expect(res.summary).not.toContain('Consultas:');
  });

  it('archivo solo con DataMashup (sin informe ni modelo): no lanza y devuelve el M', async () => {
    mockMashup({ 'DataMashup': buildDataMashup() }, sectionDoc([{ name: 'Solo' }]));

    const res = await readPowerBI(fakeFile('solo.pbix'));

    expect(res.text).toContain('- Solo');
    expect(res.summary).toContain('Consultas: 1');
  });

  // ── Robustez (#3b-bis-2): .pbit (particiones) + DataMashup XML legacy + aviso ──

  /** DataModelSchema con particiones M (cada consulta = partición `source.type:'m'`). */
  function schemaWithQueries(queries: Array<{ name: string; expr: string }>): string {
    return JSON.stringify({
      model: { tables: queries.map(q => ({
        name: q.name,
        partitions: [{ name: q.name, source: { type: 'm', expression: q.expr } }],
      })) },
    });
  }

  /** DataMashup en la variante XML/base64 antigua (envuelve el binario en <PackageOPC>). */
  function buildXmlDataMashup(): Uint8Array {
    const inner = new Uint8Array(120); inner[0] = 0x50; inner[1] = 0x4b; // 'PK'
    const bin = new Uint8Array(8 + inner.length);
    new DataView(bin.buffer).setUint32(4, inner.length, true);
    bin.set(inner, 8);
    const b64 = btoa(String.fromCharCode(...bin));
    return new TextEncoder().encode(`<DataMashup><PackageOPC>${b64}</PackageOPC></DataMashup>`);
  }

  it('.pbit: extrae Power Query de las particiones del DataModelSchema', async () => {
    mockZip({ 'DataModelSchema': u16le(schemaWithQueries([
      { name: 'Empleados', expr: 'let Source = Sql.Database("srv","hr") in Source' },
      { name: 'Calendario', expr: 'let Source = #date(2020,1,1) in Source' },
    ])) });

    const res = await readPowerBI(fakeFile('informe.pbit'));

    expect(res.text).toContain('Consultas (Power Query / M)');
    expect(res.text).toContain('- Empleados');
    expect(res.text).toContain('Sql.Database("srv","hr")');
    expect(res.summary).toContain('Consultas: 2');
  });

  it('.pbix con DataMashup XML/base64 antiguo: lo decodifica y extrae el M', async () => {
    mockMashup({ 'DataMashup': buildXmlDataMashup() }, sectionDoc([{ name: 'Origen' }]));

    const res = await readPowerBI(fakeFile('viejo.pbix'));

    expect(res.text).toContain('Consultas (Power Query / M)');
    expect(res.text).toContain('- Origen');
  });

  it('.pbix moderno (sin schema ni DataMashup): el aviso menciona DAX y Power Query', async () => {
    mockZip({ 'Report/Layout': u16le(layout([{ name: 'P', visuals: ['card'] }])), 'DataModel': new Uint8Array([1, 2, 3]) });

    const res = await readPowerBI(fakeFile('moderno.pbix'));

    expect(res.text).toContain('consultas de Power Query');
    expect(res.summary).toContain('Power Query');
  });

  it('precedencia: con DataMashup legible se usa ese, no las particiones del schema', async () => {
    mockMashup({
      'DataMashup': buildDataMashup(),
      'DataModelSchema': u16le(schemaWithQueries([{ name: 'DesdeSchema', expr: 'let x=1 in x' }])),
    }, sectionDoc([{ name: 'DesdeMashup' }]));

    const res = await readPowerBI(fakeFile('ambos.pbit'));

    expect(res.text).toContain('- DesdeMashup');
    expect(res.text).not.toContain('- DesdeSchema');
  });

  it('Report/Layout corrupto (JSON inválido): ignora el informe y no se rompe', async () => {
    mockZip({
      'Report/Layout': u16le('{ json-invalido ', true),
      'DataModelSchema': u16le(schema([
        { name: 'T', columns: ['c'], measures: [] },
      ])),
    });

    const res = await readPowerBI(fakeFile('corrupto.pbit'));

    expect(res.text).toContain('Tabla "T"');
    expect(res.text).not.toContain('Página');
  });

  it('DataModelSchema corrupto (JSON inválido): ignora el modelo y procesa solo el informe', async () => {
    mockZip({
      'Report/Layout': u16le(layout([{ name: 'SoloReport', visuals: ['card'] }])),
      'DataModelSchema': u16le('no es json valido'),
    });

    const res = await readPowerBI(fakeFile('schema_corrupto.pbit'));

    expect(res.text).toContain('Página "SoloReport"');
    expect(res.text).not.toContain('Tabla "');
  });

  it('DataMashup corrupto o con excepción en descompresión: se ignora sin romper el informe', async () => {
    let calls = 0;
    vi.mocked(unzipSync).mockImplementation(() => {
      calls++;
      if (calls === 1) {
        return {
          'Report/Layout': u16le(layout([{ name: 'ReportOk', visuals: ['card'] }])),
          'DataMashup': new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0xFF, 0xFF]),
        } as never;
      }
      throw new Error('Zip interno corrupto');
    });

    const res = await readPowerBI(fakeFile('mashup_err.pbix'));
    expect(res.text).toContain('Página "ReportOk"');
  });

  it('recorta el contenido si supera MAX_POWERBI_CHARS y marca truncated = true', async () => {
    const hugeTables = Array.from({ length: 25 }, (_, i) => ({
      name: `TablaMuyLarga_${i}`,
      columns: Array.from({ length: 25 }, (_, j) => `ColumnaLargaDetalladaConNombreExcesivo_${j}`),
      measures: Array.from({ length: 25 }, (_, k) => [`MedidaLarga_${k}`, `CALCULATE(SUM(Tabla[Col]), FILTER(ALL(Tabla), Tabla[Val] > ${k}))`]) as Array<[string, string]>,
    }));

    mockZip({
      'Report/Layout': u16le(layout([{ name: 'P1', visuals: ['card'] }])),
      'DataModelSchema': u16le(schema(hugeTables)),
    });

    const res = await readPowerBI(fakeFile('enorme.pbit'));
    expect(res.truncated).toBe(true);
    expect(res.text).toContain('_(contenido recortado por tamaño)_');
  });
});


// ── Ramas límite y defensivas restantes (#26, v4.0.52) ──────────────────────
describe('readPowerBI — ramas límite y defensivas (#26, v4.0.52)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  /** DataMashup binario válido [8B cabecera] + paquete interno 'PK' de N bytes. */
  function mashupEntry(innerLen: number): Uint8Array {
    const inner = new Uint8Array(innerLen);
    inner[0] = 0x50; inner[1] = 0x4b; // 'PK' — marca que distingue la llamada interna
    const entry = new Uint8Array(8 + innerLen);
    new DataView(entry.buffer).setUint32(4, innerLen, true);
    entry.set(inner, 8);
    return entry;
  }

  it('findEntry: localiza entries con otra caja y con prefijo de carpeta', async () => {
    mockZip({
      'report/layout': u16le(layout([{ name: 'Caja', visuals: ['card'] }])),
      'Visuals/DataModelSchema': u16le(schema([{ name: 'T', columns: [], measures: [] }])),
    });
    const res = await readPowerBI(fakeFile('caja.pbit'));
    expect(res.text).toContain('Página "Caja"');
    expect(res.summary).toContain('Modelo: 1 tabla');
  });

  it('Layout sin array sections: informe vacío (0 páginas) sin romper el flujo', async () => {
    mockZip({ 'Report/Layout': u16le('{"name": "layout"}') });
    const res = await readPowerBI(fakeFile('sin_sections.pbix'));
    expect(res.summary).toContain('Informe: 0 página(s), 0 visual(es)');
  });

  it('sección sin displayName ni visualContainers: fallbacks legibles', async () => {
    const sec = JSON.stringify({ sections: [{}, { visualContainers: [{}] }] });
    mockZip({ 'Report/Layout': u16le(sec) });
    const res = await readPowerBI(fakeFile('fallback.pbix'));
    expect(res.text).toContain('Página "Página sin nombre"');
    expect(res.text).toContain('(sin visuales)');
    expect(res.text).toContain('desconocido');
  });

  it('config no-JSON y visualType ausente: visual "desconocido" (catch defensivo)', async () => {
    const sec = JSON.stringify({
      sections: [{
        displayName: 'Rota',
        visualContainers: [
          { config: '{no-es-json' },
          { config: JSON.stringify({ singleVisual: { other: 1 } }) },
        ],
      }],
    });
    mockZip({ 'Report/Layout': u16le(sec) });
    const res = await readPowerBI(fakeFile('rota.pbix'));
    expect(res.text).toContain('desconocido ×2');
  });

  it('más de MAX_VISUALS_PER_PAGE visuales en una página: marca truncado', async () => {
    const vis = Array.from({ length: MAX_VISUALS_PER_PAGE + 2 }, () => ({
      config: JSON.stringify({ singleVisual: { visualType: 'card' } }),
    }));
    mockZip({
      'Report/Layout': u16le(JSON.stringify({ sections: [{ displayName: 'Muchos', visualContainers: vis }] })),
    });
    const res = await readPowerBI(fakeFile('muchos.pbix'));
    expect(res.truncated).toBe(true);
  });

  it('DataModelSchema sin model.tables: modelo vacío y sin particiones M', async () => {
    mockZip({ 'DataModelSchema': u16le('{"model": {}}') });
    const res = await readPowerBI(fakeFile('sin_tablas.pbit'));
    expect(res.summary).toContain('Modelo: 0 tabla(s), 0 medida(s)');
    expect(res.summary).not.toContain('Consultas:');
  });

  it('tabla sin nombre, columnas sin name/dataType y medida sin expresión', async () => {
    const sch = JSON.stringify({
      model: {
        tables: [{
          columns: [{ dataType: 'string' }, {}],
          measures: [{ name: 'SinExpr' }, {}],
        }],
      },
    });
    mockZip({ 'DataModelSchema': u16le(sch) });
    const res = await readPowerBI(fakeFile('huecos.pbit'));
    expect(res.text).toContain('Tabla "Tabla sin nombre"');
    expect(res.text).toContain('? (string)');
    expect(res.text).toContain('? (desconocido)');
    expect(res.text).toContain('SinExpr = (sin expresión)');
    expect(res.text).toContain('? = (sin expresión)');
  });

  it('más de MAX_COLUMNS_PER_TABLE y MAX_MEASURES_PER_TABLE: marca truncado', async () => {
    const sch = JSON.stringify({
      model: {
        tables: [{
          name: 'Fat',
          columns: Array.from({ length: MAX_COLUMNS_PER_TABLE + 1 }, (_, i) => ({ name: `C${i}` })),
          measures: Array.from({ length: MAX_MEASURES_PER_TABLE + 1 }, (_, i) => ({ name: `M${i}`, expression: '1' })),
        }],
      },
    });
    mockZip({ 'DataModelSchema': u16le(sch) });
    const res = await readPowerBI(fakeFile('fat.pbit'));
    expect(res.truncated).toBe(true);
  });

  it('DataMashup demasiado corto (<8 bytes): ignorado sin romper el informe', async () => {
    mockZip({
      'Report/Layout': u16le(layout([{ name: 'Corto', visuals: ['card'] }])),
      'DataMashup': new Uint8Array([1, 2, 3]),
    });
    const res = await readPowerBI(fakeFile('corto.pbix'));
    expect(res.text).toContain('Página "Corto"');
    expect(res.summary).not.toContain('Consultas:');
  });

  it('DataMashup con paquete interno sin Formulas/Section1.m: ignorado', async () => {
    const entry = mashupEntry(4);
    vi.mocked(unzipSync).mockImplementation(((data: Uint8Array) => {
      if (data[0] === 0x50) return { '[Content_Types].xml': new Uint8Array([1]) } as never;
      return {
        'Report/Layout': u16le(layout([{ name: 'SinM', visuals: ['card'] }])),
        'DataMashup': entry,
      } as never;
    }) as never);
    const res = await readPowerBI(fakeFile('sin_seccion.pbix'));
    expect(res.text).toContain('Página "SinM"');
    expect(res.summary).not.toContain('Consultas:');
  });

  it('DataMashup XML sin blob base64 largo: ignorado', async () => {
    mockZip({
      'Report/Layout': u16le(layout([{ name: 'Xml', visuals: ['card'] }])),
      'DataMashup': new TextEncoder().encode('<DataMashup><Nada>sin base64 larga</Nada></DataMashup>'),
    });
    const res = await readPowerBI(fakeFile('xml.pbix'));
    expect(res.text).toContain('Página "Xml"');
    expect(res.summary).not.toContain('Consultas:');
  });

  it('Formulas/Section1.m vacío: sin consultas legibles → error claro (solo DataMashup)', async () => {
    const entry = mashupEntry(16);
    vi.mocked(unzipSync).mockImplementation(((data: Uint8Array) =>
      (data[0] === 0x50
        ? { 'Formulas/Section1.m': new Uint8Array(0) } as never
        : { 'DataMashup': entry } as never)) as never);
    await expect(readPowerBI(fakeFile('vacio_m.pbix'))).rejects.toThrow(/informe ni el modelo/i);
  });

  it('Section1.m sin `shared`: bloque de consultas con aviso de nombres', async () => {
    const entry = mashupEntry(8);
    vi.mocked(unzipSync).mockImplementation(((data: Uint8Array) =>
      (data[0] === 0x50
        ? { 'Formulas/Section1.m': new TextEncoder().encode('section Section1;\n\n// nada compartido') } as never
        : { 'DataMashup': entry } as never)) as never);
    const res = await readPowerBI(fakeFile('sin_shared.pbix'));
    expect(res.text).toContain('_(sin nombres de consulta detectados)_');
    expect(res.summary).toContain('Consultas: 0');
  });

  it('particiones no-M y sin expresión: se saltan; nombre heredado o genérico', async () => {
    const sch = JSON.stringify({
      model: {
        tables: [
          {
            name: 'Origen',
            partitions: [
              { name: 'P1', source: { type: 'other', expression: 'x' } },
              { source: { type: 'm', expression: '' } },
              { source: { type: 'm', expression: 'let x = 1 in x' } },
            ],
          },
          { partitions: [{ source: { type: 'm', expression: 'let y = 2 in y' } }] },
        ],
      },
    });
    mockZip({ 'DataModelSchema': u16le(sch) });
    const res = await readPowerBI(fakeFile('particiones.pbit'));
    expect(res.text).toContain('- Origen');
    expect(res.text).toContain('- Consulta sin nombre');
    expect(res.summary).toContain('Consultas: 2');
  });

  it('muchas particiones M y M enorme: truncado (nombres y presupuesto de caracteres)', async () => {
    const tables = Array.from({ length: MAX_QUERIES + 2 }, (_, i) => ({
      name: `Q${i}`,
      partitions: [{ name: `Q${i}`, source: { type: 'm', expression: 'let x = "' + 'A'.repeat(200) + '" in x' } }],
    }));
    mockZip({ 'DataModelSchema': u16le(JSON.stringify({ model: { tables } })) });
    const res = await readPowerBI(fakeFile('muchas_particiones.pbit'));
    expect(res.truncated).toBe(true);
    expect(res.summary).toContain(`Consultas: ${MAX_QUERIES + 2}`);
  });

  it('XML legacy con dos blobs base64: sort elige el más largo y parsea el binario', async () => {
    // Paquete binario [MS-QDEFF] válido (paquete interno 'PK' de 120 bytes) con
    // Section1.m, codificado en base64 — y un segundo blob base64 más corto de
    // relleno. tryXmlMashup ordena los blobs (comparador de sort) y se queda
    // con el primero por longitud → el binario válido.
    const section = 'section Section1;\n\nshared Corta = 1;';
    const innerBytes = new Uint8Array(120);
    innerBytes[0] = 0x50; innerBytes[1] = 0x4b;
    const bin = new Uint8Array(8 + innerBytes.length);
    new DataView(bin.buffer).setUint32(4, innerBytes.length, true);
    bin.set(innerBytes, 8);
    const longB64 = btoa(String.fromCharCode(...bin));
    const shortB64 = 'A'.repeat(longB64.length - 10);
    const xml = new TextEncoder().encode(
      `<DataMashup><PackageOPC>${longB64}</PackageOPC><Otro>${shortB64}</Otro></DataMashup>`,
    );
    vi.mocked(unzipSync).mockImplementation(((data: Uint8Array) =>
      (data[0] === 0x50
        ? { 'Formulas/Section1.m': new TextEncoder().encode(section) } as never
        : { 'DataMashup': xml } as never)) as never);

    const res = await readPowerBI(fakeFile('dos_blobs.pbix'));

    expect(res.text).toContain('- Corta');
    expect(res.summary).toContain('Consultas: 1');
  });
});