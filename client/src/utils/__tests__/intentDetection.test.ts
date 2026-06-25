import { describe, it, expect } from 'vitest';
import { detectDocPublishIntent, routeUserMessage } from '../intentDetection';

describe('detectDocPublishIntent', () => {
  it('detecta documentar', () => {
    expect(detectDocPublishIntent('documéntalo, por favor')).toEqual({ kind: 'document' });
    expect(detectDocPublishIntent('¿lo puedes documentar tú directamente?')).toEqual({ kind: 'document' });
    expect(detectDocPublishIntent('genera el readme del proyecto')).toEqual({ kind: 'document' });
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
