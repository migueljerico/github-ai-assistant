/**
 * PDF Reader Utility — Extract text from PDF files
 * Uses the browser's built-in capabilities or a lightweight approach
 */

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
    return readPDFAsText(file);
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
