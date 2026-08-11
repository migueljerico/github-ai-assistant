/**
 * PDF Reader Utility — Extract text from PDF files
 * Uses the browser's built-in capabilities or a lightweight approach
 */

import { readPDFAdvanced } from './pdfAdvanced';

/** Extensiones admitidas al adjuntar archivos (#28): PDF + texto/código + hojas de cálculo + Power BI + Word + imágenes.
 *  v3.66.0 (Frente D): imágenes para hospedarlas en screenshots/ y enlazarlas desde
 *  los docs (sin visión — el modelo nunca analiza los píxeles). */
export const SUPPORTED_FILE_EXTENSIONS = [
  'pdf', 'txt', 'md', 'markdown', 'json', 'csv', 'yaml', 'yml',
  'js', 'jsx', 'ts', 'tsx', 'py', 'html', 'css', 'xml', 'log', 'env',
  'xlsx', 'xlsm', 'xls', // #28 Fase 3a — hojas de cálculo (Excel con/sin macros) vía SheetJS
  'pbix', 'pbit', // #28 Fase 3b — Power BI (ZIP); solo se lee la estructura JSON
  'docx', // #28 — documentos Word (ZIP OOXML); se lee el texto de word/document.xml
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', // v3.66.0 (Frente D) — capturas para docs
];

/** Tamaño máximo de archivo adjunto (5 MB). */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** Tamaño máximo para Power BI (25 MB): los .pbix reales pesan más por los datos
 *  embebidos, pero solo leemos el ZIP (partes JSON), no el dataset binario. */
export const MAX_POWERBI_SIZE_BYTES = 25 * 1024 * 1024;

/** Extensiones de Power BI (cap de tamaño mayor). */
const POWERBI_EXTENSIONS = ['pbix', 'pbit'];

/**
 * Valida que el archivo se pueda procesar. Lanza un error en lenguaje claro
 * (principio rector) si la extensión no está soportada o supera el tamaño máx.
 */
export function assertSupportedFile(file: File): void {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!SUPPORTED_FILE_EXTENSIONS.includes(ext)) {
    throw new Error(
      `No puedo leer archivos «.${ext || '?'}» todavía. Por ahora acepto PDF, documentos Word (.docx), ` +
      `hojas de cálculo (Excel .xlsx/.xlsm/.xls, CSV), archivos Power BI (.pbix, .pbit) y archivos de texto/código.`,
    );
  }

  const maxBytes = POWERBI_EXTENSIONS.includes(ext) ? MAX_POWERBI_SIZE_BYTES : MAX_FILE_SIZE_BYTES;
  if (file.size > maxBytes) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new Error(`El archivo pesa ${mb} MB y el máximo es ${maxBytes / 1024 / 1024} MB. Prueba con uno más pequeño.`);
  }
}

/**
 * Read a PDF file and extract text content.
 * This is a simplified approach that works with text-based PDFs.
 * For complex PDFs, consider using pdfjs-dist library.
 * 
 * @param file - The PDF file to read
 * @returns Promise<string> - Extracted text content
 */
export async function readPDFAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        // Basic PDF text extraction (works for simple PDFs)
        const text = extractTextFromPDF(arrayBuffer);
        resolve(text || `[PDF: ${file.name}] - Contenido no legible directamente. Por favor, describe el contenido.`);
      } catch (err) {
        reject(new Error(`Error al leer PDF: ${(err as Error).message}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Error al leer el archivo'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Extract text from PDF ArrayBuffer (basic implementation)
 * Note: This is a simplified version. For production, use pdfjs-dist
 */
function extractTextFromPDF(arrayBuffer: ArrayBuffer): string {
  try {
    // Convert ArrayBuffer to string
    const uint8Array = new Uint8Array(arrayBuffer);
    let text = '';
    
    // Simple text extraction: look for text streams in PDF
    for (let i = 0; i < uint8Array.length; i++) {
      const byte = uint8Array[i];
      // ASCII printable characters
      if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13) {
        text += String.fromCharCode(byte);
      }
    }
    
    // Clean up common PDF artifacts
    text = text
      // eslint-disable-next-line no-control-regex -- elimina bytes nulos del texto PDF
      .replace(/\x00/g, '') // Remove null bytes
      .replace(/BT\s+.*?\s+ET/gs, '') // Remove PDF text operators
      .replace(/\/F\d+\s+[\d.]+\s+Tf/g, '') // Remove font commands
      .replace(/\(\s*\)/g, '') // Remove empty parentheses
      .split('\n')
      .filter(line => line.trim().length > 0)
      .join('\n');
    
    return text.trim();
  } catch {
    return '';
  }
}

/**
 * Read any text-based file (TXT, MD, JSON, YAML, etc.)
 * 
 * @param file - The file to read
 * @returns Promise<string> - File content
 */
export async function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        resolve(content);
      } catch (err) {
        reject(new Error(`Error al leer archivo: ${(err as Error).message}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Error al leer el archivo'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Determine file type and read accordingly
 * 
 * @param file - The file to read
 * @returns Promise<string> - File content
 */
export async function readFileContent(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  if (extension === 'pdf') {
    // #28: extracción real con pdfjs-dist (cae a la básica si el worker falla).
    return readPDFAdvanced(file);
  } else {
    return readTextFile(file);
  }
}

/**
 * Format file content for inclusion in AI prompt
 * 
 * @param fileName - Name of the file
 * @param content - File content
 * @returns Formatted string for AI context
 */
export function formatFileContentForAI(fileName: string, content: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() || 'txt';
  const maxLength = 4000; // Limit content to avoid token overflow
  
  const truncatedContent = content.length > maxLength 
    ? content.substring(0, maxLength) + '\n\n[... contenido truncado ...]'
    : content;
  
  return `\n\n--- Contenido del archivo adjunto: ${fileName} ---\n\`\`\`${extension}\n${truncatedContent}\n\`\`\`\n--- Fin del archivo ---\n`;
}
