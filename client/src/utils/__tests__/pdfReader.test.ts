import { describe, it, expect } from 'vitest';
import {
  readPDFAsText,
  readTextFile,
  readFileContent,
  formatFileContentForAI,
  assertSupportedFile,
  MAX_FILE_SIZE_BYTES,
  MAX_POWERBI_SIZE_BYTES,
} from '../pdfReader';

/** Crea un File a partir de una cadena UTF-8. */
function fileFrom(text: string, name: string): File {
  return new File([new TextEncoder().encode(text)], name);
}

describe('pdfReader', () => {
  describe('formatFileContentForAI', () => {
    it('envuelve el contenido con la extensión del archivo', () => {
      const out = formatFileContentForAI('notas.md', 'hola mundo');
      expect(out).toContain('notas.md');
      expect(out).toContain('```md');
      expect(out).toContain('hola mundo');
    });

    it('usa el nombre como lenguaje si no hay punto, y "txt" si el nombre está vacío', () => {
      // Sin punto: pop() devuelve el nombre completo en minúsculas
      expect(formatFileContentForAI('LICENSE', 'texto')).toContain('```license');
      // Nombre vacío: cae al valor por defecto "txt"
      expect(formatFileContentForAI('', 'texto')).toContain('```txt');
    });

    it('trunca el contenido que excede el máximo', () => {
      const out = formatFileContentForAI('big.txt', 'a'.repeat(5000));
      expect(out).toContain('[... contenido truncado ...]');
    });

    it('no trunca contenido corto', () => {
      const out = formatFileContentForAI('small.txt', 'corto');
      expect(out).not.toContain('truncado');
    });
  });

  describe('readTextFile', () => {
    it('propaga error cuando FileReader falla en readTextFile', async () => {
      const file = fileFrom('error', 'fail.txt');
      const originalFileReader = globalThis.FileReader;
      class MockFileReader {
        onerror: (() => void) | null = null;
        readAsText() {
          setTimeout(() => this.onerror?.(), 1);
        }
      }
      globalThis.FileReader = MockFileReader as unknown as typeof FileReader;
      try {
        await expect(readTextFile(file)).rejects.toThrow('Error al leer el archivo');
      } finally {
        globalThis.FileReader = originalFileReader;
      }
    });
  });

  describe('readPDFAsText', () => {
    it('propaga error cuando FileReader falla en readPDFAsText', async () => {
      const file = fileFrom('error', 'fail.pdf');
      const originalFileReader = globalThis.FileReader;
      class MockFileReader {
        onerror: (() => void) | null = null;
        readAsArrayBuffer() {
          setTimeout(() => this.onerror?.(), 1);
        }
      }
      globalThis.FileReader = MockFileReader as unknown as typeof FileReader;
      try {
        await expect(readPDFAsText(file)).rejects.toThrow('Error al leer el archivo');
      } finally {
        globalThis.FileReader = originalFileReader;
      }
    });

    it('extrae texto ASCII y limpia artefactos de PDF', async () => {
      const raw = 'Hola Mundo\nBT secreto ET\n/F1 12 Tf\nAdios';
      const text = await readPDFAsText(fileFrom(raw, 'doc.pdf'));
      expect(text).toContain('Hola Mundo');
      expect(text).toContain('Adios');
      expect(text).not.toContain('secreto');
    });

    it('devuelve un mensaje de fallback cuando no hay texto legible', async () => {
      // Bytes no imprimibles → extracción vacía → mensaje de fallback
      const file = new File([new Uint8Array([0, 1, 2, 3])], 'binario.pdf');
      const text = await readPDFAsText(file);
      expect(text).toContain('binario.pdf');
      expect(text).toContain('no legible');
    });
  });

  describe('readFileContent', () => {
    it('enruta los .txt a lectura de texto', async () => {
      const content = await readFileContent(fileFrom('plano', 'notas.txt'));
      expect(content).toBe('plano');
    });

    it('enruta los .pdf a extracción de PDF', async () => {
      const content = await readFileContent(fileFrom('Texto PDF', 'doc.pdf'));
      expect(content).toContain('Texto PDF');
    });
  });
});

describe('assertSupportedFile (#28)', () => {
  it('acepta extensiones soportadas (pdf, md, json…)', () => {
    expect(() => assertSupportedFile(fileFrom('x', 'doc.pdf'))).not.toThrow();
    expect(() => assertSupportedFile(fileFrom('x', 'notas.md'))).not.toThrow();
    expect(() => assertSupportedFile(fileFrom('x', 'data.json'))).not.toThrow();
  });

  it('acepta hojas de cálculo Excel/CSV (#28 Fase 3a)', () => {
    expect(() => assertSupportedFile(fileFrom('x', 'ventas.xlsx'))).not.toThrow();
    expect(() => assertSupportedFile(fileFrom('x', 'datos.xls'))).not.toThrow();
    expect(() => assertSupportedFile(fileFrom('x', 'export.csv'))).not.toThrow();
  });

  it('acepta archivos Power BI .pbix/.pbit (#28 Fase 3b)', () => {
    expect(() => assertSupportedFile(fileFrom('x', 'informe.pbix'))).not.toThrow();
    expect(() => assertSupportedFile(fileFrom('x', 'plantilla.pbit'))).not.toThrow();
  });

  it('acepta documentos Word .docx (#28)', () => {
    expect(() => assertSupportedFile(fileFrom('x', 'memoria.docx'))).not.toThrow();
  });

  it('rechaza extensiones no soportadas con mensaje claro', () => {
    expect(() => assertSupportedFile(fileFrom('x', 'app.exe'))).toThrow(/\.exe/);
    expect(() => assertSupportedFile(fileFrom('x', 'binario.zip'))).toThrow(/no puedo leer/i);
  });

  // v3.66.0 (Frente D): las imágenes ahora SÍ están soportadas (se hospedan en
  // screenshots/ y se enlazan desde los docs, sin visión).
  it('acepta imágenes png/jpg/svg (#28 Frente D)', () => {
    expect(() => assertSupportedFile(fileFrom('x', 'captura.png'))).not.toThrow();
    expect(() => assertSupportedFile(fileFrom('x', 'foto.jpg'))).not.toThrow();
    expect(() => assertSupportedFile(fileFrom('x', 'logo.svg'))).not.toThrow();
  });

  it('rechaza archivos por encima del tamaño máximo', () => {
    const big = fileFrom('x', 'grande.txt');
    Object.defineProperty(big, 'size', { value: MAX_FILE_SIZE_BYTES + 1 });
    expect(() => assertSupportedFile(big)).toThrow(/máximo/i);
  });

  it('Power BI usa un cap de tamaño mayor (25 MB)', () => {
    // Un .pbix por encima del cap genérico (5 MB) pero por debajo del suyo: válido.
    const pbix = fileFrom('x', 'informe.pbix');
    Object.defineProperty(pbix, 'size', { value: MAX_FILE_SIZE_BYTES + 1 });
    expect(() => assertSupportedFile(pbix)).not.toThrow();
    // Por encima de su propio cap: rechazado.
    const huge = fileFrom('x', 'enorme.pbix');
    Object.defineProperty(huge, 'size', { value: MAX_POWERBI_SIZE_BYTES + 1 });
    expect(() => assertSupportedFile(huge)).toThrow(/máximo/i);
  });
});
