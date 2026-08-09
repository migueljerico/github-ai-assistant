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


