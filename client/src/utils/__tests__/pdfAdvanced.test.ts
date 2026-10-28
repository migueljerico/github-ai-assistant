import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readPDFAdvanced, getPDFMetadata } from '../pdfAdvanced';

const mockGetDocument = vi.fn();

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
}));


function fileFrom(text: string, name: string): File {
  return new File([new TextEncoder().encode(text)], name);
}

describe('pdfAdvanced', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('readPDFAdvanced', () => {
    it('extrae texto exitosamente usando pdfjs cuando getDocument resuelve', async () => {
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve({
          numPages: 2,
          getPage: (pageNum: number) =>
            Promise.resolve({
              getTextContent: () =>
                Promise.resolve({
                  items:
                    pageNum === 1
                      ? [{ str: 'Hola' }, { str: 'Mundo' }]
                      : [{ str: 'Segunda' }, { str: 'Pagina' }],
                }),
            }),
        }),
      });

      const text = await readPDFAdvanced(fileFrom('Contenido Dummy', 'doc.pdf'));
      expect(text).toBe('Hola Mundo\nSegunda Pagina');
      expect(mockGetDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          enableScripting: false,
          isEvalSupported: false,
        })
      );
    });

    it('cae al extractor básico cuando pdfjs falla y devuelve el texto ASCII', async () => {
      const p = Promise.reject(new Error('pdfjs mock fail'));
      p.catch(() => {});
      mockGetDocument.mockReturnValue({ promise: p });

      const text = await readPDFAdvanced(fileFrom('Contenido Basico\n/F1 12 Tf\nFin', 'doc.pdf'));
      expect(text).toContain('Contenido Basico');
      expect(text).toContain('Fin');
    });
  });

  describe('getPDFMetadata', () => {
    it('extrae metadatos completos cuando pdfjs está disponible', async () => {
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve({
          numPages: 5,
          getMetadata: () =>
            Promise.resolve({
              info: { Title: 'Documento de Prueba', Author: 'Autor Test' },
            }),
        }),
      });

      const file = fileFrom('contenido pdf', 'informe.pdf');
      const meta = await getPDFMetadata(file);
      expect(meta.fileName).toBe('informe.pdf');
      expect(meta.numPages).toBe(5);
      expect(meta.title).toBe('Documento de Prueba');
      expect(meta.author).toBe('Autor Test');
    });

    it('devuelve información básica cuando pdfjs falla o no está disponible', async () => {
      const p = Promise.reject(new Error('error de lectura'));
      p.catch(() => {});
      mockGetDocument.mockReturnValue({ promise: p });

      const file = fileFrom('algo', 'informe.pdf');
      const meta = await getPDFMetadata(file);
      expect(meta.fileName).toBe('informe.pdf');
      expect(meta.numPages).toBe(0);
      expect(typeof meta.fileSize).toBe('number');
    });
  });

  describe('readPDFAdvanced fallback error handling', () => {
    it('rechaza con error cuando FileReader falla en el fallback', async () => {
      const p = Promise.reject(new Error('pdfjs fail'));
      p.catch(() => {});
      mockGetDocument.mockReturnValue({ promise: p });

      const mockFile = fileFrom('dummy', 'bad.pdf');
      const realFileReader = globalThis.FileReader;
      
      class MockFileReader {
        onerror: (() => void) | null = null;
        onload: (() => void) | null = null;
        readAsArrayBuffer() {
          setTimeout(() => {
            if (this.onerror) this.onerror();
          }, 10);
        }
      }

      globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

      try {
        await expect(readPDFAdvanced(mockFile)).rejects.toThrow('Error al leer el archivo');
      } finally {
        globalThis.FileReader = realFileReader;
      }
    });
  });
});



describe('readPDFBasic — catch defensivo ante ArrayBuffer corrupto (v4.0.52 #26)', () => {
  it('rechaza con error claro cuando el reader entrega un resultado no convertible', async () => {
    const p = Promise.reject(new Error('pdfjs fail'));
    p.catch(() => {});
    mockGetDocument.mockReturnValue({ promise: p });

    const file = fileFrom('x', 'corrupto.pdf');
    const realFileReader = globalThis.FileReader;
    class MockFileReader {
      onerror: (() => void) | null = null;
      onload: ((e: { target: { result: unknown } }) => void) | null = null;
      readAsArrayBuffer() {
        setTimeout(() => this.onload?.({ target: { result: BigInt(1) } }), 1);
      }
    }
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;
    try {
      // `new Uint8Array(1n)` lanza TypeError → el catch interno rechaza con
      // el mensaje claro y el fallback de readPDFAdvanced lo propaga.
      await expect(readPDFAdvanced(file)).rejects.toThrow('Error al extraer texto del PDF');
    } finally {
      globalThis.FileReader = realFileReader;
    }
  });
});

describe('readPDFBasic — filtro de bytes al caer a la extracción básica (#26, v4.0.52)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('conserva \r, \n e imprimibles; descarta el resto', async () => {
    // pdfjs roto → catch de readPDFAdvanced → readPDFBasic con el FileReader
    // real de jsdom. Bytes: OK(2) \r(13) \n(10) nto(3) \u0000 \u007f — cubre
    // todas las sub-ramas del filtro `(byte >= 32 && byte <= 126) || === 10 || === 13`.
    mockGetDocument.mockImplementation(() => { throw new Error('pdfjs roto'); });
    const res = await readPDFAdvanced(fileFrom('OK\r\nnto\u0000\u007f', 'bytes.pdf'));
    expect(res).toContain('OK');
    expect(res).toContain('nto');
    expect(res).not.toContain('\u0000');
    expect(res).not.toContain('\u007f');
  });
});