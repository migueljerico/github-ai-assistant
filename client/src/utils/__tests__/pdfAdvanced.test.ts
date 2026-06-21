import { describe, it, expect, vi } from 'vitest';
import { readPDFAdvanced, getPDFMetadata } from '../pdfAdvanced';

// Mock de pdfjs-dist: getDocument siempre rechaza, forzando la ruta de fallback
// (readPDFBasic) en readPDFAdvanced y la rama de error en getPDFMetadata.
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(() => ({ promise: Promise.reject(new Error('pdfjs mock fail')) })),
}));

function fileFrom(text: string, name: string): File {
  return new File([new TextEncoder().encode(text)], name);
}

describe('pdfAdvanced', () => {
  describe('readPDFAdvanced', () => {
    it('cae al extractor básico cuando pdfjs falla y devuelve el texto ASCII', async () => {
      const text = await readPDFAdvanced(fileFrom('Contenido Basico\n/F1 12 Tf\nFin', 'doc.pdf'));
      expect(text).toContain('Contenido Basico');
      expect(text).toContain('Fin');
    });
  });

  describe('getPDFMetadata', () => {
    it('devuelve información básica cuando pdfjs no está disponible', async () => {
      const file = fileFrom('algo', 'informe.pdf');
      const meta = await getPDFMetadata(file);
      expect(meta.fileName).toBe('informe.pdf');
      expect(meta.numPages).toBe(0);
      expect(typeof meta.fileSize).toBe('number');
    });
  });
});
