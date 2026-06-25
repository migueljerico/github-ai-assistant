import { describe, it, expect } from 'vitest';
import { detectDocPublishIntent, routeUserMessage, isExploratory } from '../intentDetection';

describe('isExploratory (#28 v3.6.1)', () => {
  it('preguntas → true', () => {
    expect(isExploratory('¿puedo subir varios archivos?')).toBe(true);
    expect(isExploratory('¿lo puedes documentar tú directamente?')).toBe(true);
  });
  it('tono de análisis/ayuda → true', () => {
    expect(isExploratory('ayúdame a documentar analizando el informe')).toBe(true);
    expect(isExploratory('dame tu opinión y revisa el modelo')).toBe(true);
  });
  it('órdenes claras → false', () => {
    expect(isExploratory('documéntalo, por favor')).toBe(false);
    expect(isExploratory('publícalo en el repo mi-repo')).toBe(false);
  });
});

describe('detectDocPublishIntent', () => {
  it('detecta documentar (órdenes claras)', () => {
    expect(detectDocPublishIntent('documéntalo, por favor')).toEqual({ kind: 'document' });
    expect(detectDocPublishIntent('genera el readme del proyecto')).toEqual({ kind: 'document' });
  });

  it('peticiones exploratorias/preguntas → null (conversar primero)', () => {
    expect(detectDocPublishIntent('ayúdame a documentar analizando el informe')).toBeNull();
    expect(detectDocPublishIntent('¿lo puedes documentar tú directamente?')).toBeNull();
    expect(detectDocPublishIntent('¿puedo subir varios archivos para documentar mejor?')).toBeNull();
  });

  it('detecta publicar y extrae el repo', () => {
    expect(detectDocPublishIntent('publícalo en el repo powerbi-gestion-people'))
      .toEqual({ kind: 'publish', repo: 'powerbi-gestion-people' });
    expect(detectDocPublishIntent('súbelo a migueljerico/mi-repo'))
      .toEqual({ kind: 'publish', repo: 'migueljerico/mi-repo' });
  });

  it('publicar sin repo nombrado → repo undefined', () => {
    expect(detectDocPublishIntent('publícalo ya')).toEqual({ kind: 'publish', repo: undefined });
  });

  it('publicar tiene prioridad sobre documentar', () => {
    const r = detectDocPublishIntent('documenta y publícalo en el repo mi-repo');
    expect(r).toEqual({ kind: 'publish', repo: 'mi-repo' });
  });

  it('preguntas de opinión → null', () => {
    expect(detectDocPublishIntent('¿qué opinas del informe?')).toBeNull();
    expect(detectDocPublishIntent('dame una opinión sobre el modelo')).toBeNull();
  });
});

describe('routeUserMessage', () => {
  it('sin intención → chat', () => {
    expect(routeUserMessage(null, { hasFile: true, hasRepo: false })).toBe('chat');
  });

  it('con archivo: documentar/publicar el archivo', () => {
    expect(routeUserMessage({ kind: 'document' }, { hasFile: true, hasRepo: false })).toBe('document-file');
    expect(routeUserMessage({ kind: 'publish', repo: 'r' }, { hasFile: true, hasRepo: false })).toBe('publish-file');
  });

  it('sin archivo pero con repo en contexto → documentar repo', () => {
    expect(routeUserMessage({ kind: 'document' }, { hasFile: false, hasRepo: true })).toBe('document-repo');
  });

  it('sin archivo ni repo pero publish con repo nombrado → documentar repo', () => {
    expect(routeUserMessage({ kind: 'publish', repo: 'mi-repo' }, { hasFile: false, hasRepo: false })).toBe('document-repo');
  });

  it('sin contexto y sin repo nombrado → chat', () => {
    expect(routeUserMessage({ kind: 'document' }, { hasFile: false, hasRepo: false })).toBe('chat');
  });
});
