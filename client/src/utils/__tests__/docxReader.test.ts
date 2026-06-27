import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de fflate: controlamos el contenido del ZIP (dict path → bytes).
vi.mock('fflate', () => ({ unzipSync: vi.fn() }));

import { unzipSync } from 'fflate';
import { readDocx, docxXmlToText, MAX_DOCX_CHARS } from '../docxReader';

function u8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function fakeFile(name = 'doc.docx'): File {
  return { name, arrayBuffer: async () => new ArrayBuffer(8) } as unknown as File;
}

function mockZip(entries: Record<string, Uint8Array>) {
  vi.mocked(unzipSync).mockReturnValue(entries as never);
}

/** Envuelve párrafos en el XML mínimo de word/document.xml. */
function docXml(...paragraphs: string[]): string {
  const body = paragraphs.map(p => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('');
  return `<?xml version="1.0"?><w:document><w:body>${body}</w:body></w:document>`;
}

describe('docxXmlToText (helper puro)', () => {
  it('extrae el texto de los párrafos como líneas', () => {
    const out = docxXmlToText(docXml('Primera línea', 'Segunda línea'));
    expect(out).toBe('Primera línea\nSegunda línea');
  });

  it('decodifica entidades XML', () => {
    const xml = '<w:p><w:r><w:t>Ventas &amp; Costes &lt; 100 &gt; 0</w:t></w:r></w:p>';
    expect(docxXmlToText(xml)).toBe('Ventas & Costes < 100 > 0');
  });

  it('convierte tabs, saltos y celdas/filas de tabla', () => {
    const xml =
      '<w:p><w:r><w:t>A</w:t><w:tab/><w:t>B</w:t><w:br/><w:t>C</w:t></w:r></w:p>' +
      '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>c1</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>c2</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
    const out = docxXmlToText(xml);
    expect(out).toContain('A\tB');
    expect(out).toContain('C');
    expect(out).toContain('c1\tc2');
  });
});

describe('readDocx', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('lee el texto de word/document.xml y arma el resumen', async () => {
    mockZip({ 'word/document.xml': u8(docXml('Hola mundo', 'Tres palabras aquí')) });
    const { text, summary, truncated } = await readDocx(fakeFile());
    expect(text).toContain('Hola mundo');
    expect(text).toContain('Tres palabras aquí');
    expect(summary).toMatch(/Documento Word: ~5 palabras/);
    expect(truncated).toBe(false);
  });

  it('encuentra el entry aunque la clave tenga otra caja/prefijo', async () => {
    mockZip({ 'Word/Document.xml': u8(docXml('contenido')) });
    const { text } = await readDocx(fakeFile());
    expect(text).toContain('contenido');
  });

  it('marca truncated y recorta cuando supera MAX_DOCX_CHARS', async () => {
    const long = 'palabra '.repeat(Math.ceil(MAX_DOCX_CHARS / 4));
    mockZip({ 'word/document.xml': u8(docXml(long)) });
    const { text, truncated } = await readDocx(fakeFile());
    expect(truncated).toBe(true);
    expect(text).toContain('[... documento recortado ...]');
    expect(text.length).toBeLessThan(long.length);
  });

  it('lanza error claro si falta word/document.xml', async () => {
    mockZip({ 'docProps/core.xml': u8('<x/>') });
    await expect(readDocx(fakeFile())).rejects.toThrow(/dañado o no es un Word/);
  });

  it('lanza error si el documento no tiene texto legible', async () => {
    mockZip({ 'word/document.xml': u8('<w:document><w:body></w:body></w:document>') });
    await expect(readDocx(fakeFile())).rejects.toThrow(/no tiene texto legible/);
  });
});
