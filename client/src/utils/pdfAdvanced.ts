/**
 * Advanced PDF Reader — Using pdfjs-dist for better PDF parsing
 * 
 * This module provides advanced PDF text extraction capabilities
 * Install with: npm install pdfjs-dist
 */

/**
 * Extract text from PDF using pdfjs-dist (if available)
 * Falls back to basic extraction if library not available
 * 
 * @param file - PDF file to read
 * @returns Promise<string> - Extracted text
 */
export async function readPDFAdvanced(file: File): Promise<string> {
  try {
    // pdfjs-dist ahora es dependencia (#28). El import dinámico mantiene la
    // librería en un chunk aparte (no engorda el bundle inicial).
    const pdfjsLib = await import('pdfjs-dist');
    // Worker resuelto por Vite a una URL del bundle. Si algo falla aquí o en el
    // parseo, el catch cae a la extracción básica (degradación elegante).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
      new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    return await extractWithPDFJS(file, pdfjsLib);
  } catch {
    // Fallback to basic extraction
    console.warn('pdfjs-dist no disponible o fallo de parseo, usando extracción básica');
    return readPDFBasic(file);
  }
}

/**
 * Extract text using pdfjs-dist library
 * 
 * @param file - PDF file
 * @param pdfjsLib - pdfjs-dist module
 * @returns Extracted text
 */
// pdfjs-dist no expone tipos estables aquí; interop deliberada con `any`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractWithPDFJS(file: File, pdfjsLib: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const pdf = await pdfjsLib.getDocument({
          data: arrayBuffer,
          enableScripting: false,
          isEvalSupported: false,
        }).promise;
        
        let fullText = '';
        for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
          // Limit to first 20 pages to avoid excessive processing
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((item: any) => item.str)
            .join(' ');
          fullText += pageText + '\n';
        }

        resolve(fullText.trim());
      } catch (err) {
        reject(new Error(`Error al procesar PDF con pdfjs: ${(err as Error).message}`));
      }
    };

    reader.onerror = () => reject(new Error('Error al leer el archivo PDF'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Basic PDF text extraction (fallback)
 * 
 * @param file - PDF file
 * @returns Extracted text
 */
function readPDFBasic(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);
        let text = '';

        for (let i = 0; i < uint8Array.length; i++) {
          const byte = uint8Array[i];
          if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13) {
            text += String.fromCharCode(byte);
          }
        }

        text = text
          // eslint-disable-next-line no-control-regex -- elimina bytes nulos del texto PDF
          .replace(/\x00/g, '')
          .replace(/BT\s+.*?\s+ET/gs, '')
          .replace(/\/F\d+\s+[\d.]+\s+Tf/g, '')
          .split('\n')
          .filter(line => line.trim().length > 0)
          .join('\n');

        resolve(text.trim());
      } catch (err) {
        reject(new Error(`Error al extraer texto del PDF: ${(err as Error).message}`));
      }
    };

    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Get PDF metadata (page count, title, etc.)
 * Requires pdfjs-dist
 * 
 * @param file - PDF file
 * @returns Metadata object
 */
export async function getPDFMetadata(file: File): Promise<{
  numPages: number;
  title?: string;
  author?: string;
  fileName: string;
  fileSize: number;
}> {
  try {
    const pdfjsLib = await import('pdfjs-dist' as string);
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      enableScripting: false,
      isEvalSupported: false,
    }).promise;
    const metadata = await pdf.getMetadata();

    return {
      numPages: pdf.numPages,
      title: metadata.info?.Title,
      author: metadata.info?.Author,
      fileName: file.name,
      fileSize: file.size,
    };
  } catch {
    // Return basic info if pdfjs not available
    return {
      numPages: 0,
      fileName: file.name,
      fileSize: file.size,
    };
  }
}
