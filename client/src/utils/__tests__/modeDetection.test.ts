import { describe, it, expect } from 'vitest';
import { isConversationRequest, isActionRequest, resolveMode, detectModeMismatch } from '../modeDetection';

describe('modeDetection', () => {
  describe('heurísticas', () => {
    it('detecta peticiones de conversación', () => {
      expect(isConversationRequest('dame una opinión constructiva sobre el repo')).toBe(true);
      expect(isConversationRequest('lista mis repos')).toBe(false);
    });

    it('detecta peticiones de acción', () => {
      expect(isActionRequest('crea un repo llamado test')).toBe(true);
      expect(isActionRequest('lista mis repositorios')).toBe(true);
      expect(isActionRequest('¿qué opinas del código?')).toBe(false);
    });
  });

  describe('resolveMode — override manual', () => {
    it('respeta el override explícito', () => {
      expect(resolveMode('lista mis repos', 'chat', false)).toBe('chat');
      expect(resolveMode('dame tu opinión', 'action', false)).toBe('action');
    });
  });

  describe('resolveMode — auto SIN contexto (conservador)', () => {
    it('opinión → chat', () => {
      expect(resolveMode('dame una opinión sobre esto', 'auto', false)).toBe('chat');
    });
    it('acción → action', () => {
      expect(resolveMode('crea un README', 'auto', false)).toBe('action');
    });
    it('ambiguo → action', () => {
      expect(resolveMode('hola', 'auto', false)).toBe('action');
    });
  });

  describe('resolveMode — auto CON contexto de repo (#41, sesgo a chat)', () => {
    it('opinión sin nombrar repo → chat (usa el contexto)', () => {
      expect(resolveMode('dame una opinión constructiva sobre el repositorio que acabamos de seleccionar', 'auto', true)).toBe('chat');
    });
    it('pregunta neutra → chat (antes habría caído a action)', () => {
      expect(resolveMode('¿y la seguridad?', 'auto', true)).toBe('chat');
    });
    it('acción explícita → action aunque haya contexto', () => {
      expect(resolveMode('crea un README en el repo', 'auto', true)).toBe('action');
    });
  });

  describe('resolveMode — auto CON archivo adjunto (#28 fix, siempre chat)', () => {
    it('petición de hablar del archivo → chat aunque la frase contenga "subir"', () => {
      // Bug real: "el PBIX que acabo de subir" caía a action por el verbo "subir".
      expect(resolveMode('háblame del informe, modelo y consultas del PBIX que acabo de subir', 'auto', false, true)).toBe('chat');
    });
    it('verbos de acción incidentales → chat (ningún acción lee un archivo local)', () => {
      expect(resolveMode('crea un resumen y lista las hojas del Excel adjunto', 'auto', false, true)).toBe('chat');
    });
    it('chat aunque además haya contexto de repo', () => {
      expect(resolveMode('actualiza esto', 'auto', true, true)).toBe('chat');
    });
    it('el override manual de acción se respeta aun con archivo adjunto', () => {
      expect(resolveMode('crea un issue', 'action', false, true)).toBe('action');
    });
  });

  // #58 (c) — review mode
  describe('review override', () => {
    it('review se comporta como action (necesita JSON)', () => {
      expect(resolveMode('crea un issue', 'review', false, false)).toBe('action');
    });
    it('review fuerza action incluso con contexto de repo', () => {
      expect(resolveMode('actualiza el readme', 'review', true, false)).toBe('action');
    });
  });

  // v3.56.0 — detección de desajuste de modo (sugerencia de cambio 1-clic)
  describe('detectModeMismatch (v3.56.0)', () => {
    it('en modo auto nunca hay mismatch (auto decide solo)', () => {
      expect(detectModeMismatch('crea un archivo', 'auto')).toBeNull();
      expect(detectModeMismatch('¿qué opinas?', 'auto')).toBeNull();
    });

    it('en chat + petición claramente de acción → sugiere action', () => {
      const r = detectModeMismatch('crea un archivo README.md en el repo', 'chat');
      expect(r).not.toBeNull();
      expect(r!.suggestMode).toBe('action');
      expect(r!.retryText).toContain('README.md');
    });

    it('en action + petición claramente de opinión → sugiere chat', () => {
      const r = detectModeMismatch('¿qué opinas de la arquitectura de este repo?', 'action');
      expect(r).not.toBeNull();
      expect(r!.suggestMode).toBe('chat');
    });

    it('en review + petición de opinión → sugiere chat', () => {
      const r = detectModeMismatch('dame tu opinión sobre el código', 'review');
      expect(r).not.toBeNull();
      expect(r!.suggestMode).toBe('chat');
    });

    it('frase ambigua (acción + opinión a la vez) → no sugiere (evita falsos positivos)', () => {
      // "analiza y crea un resumen" tiene ambos verbos: no debemos forzar el cambio.
      expect(detectModeMismatch('analiza el repo y crea un resumen', 'chat')).toBeNull();
      expect(detectModeMismatch('analiza el repo y crea un resumen', 'action')).toBeNull();
    });

    it('frase neutra sin verbos → no sugiere', () => {
      expect(detectModeMismatch('hola', 'chat')).toBeNull();
      expect(detectModeMismatch('gracias', 'action')).toBeNull();
    });

    it('retryText conserva el texto original del usuario', () => {
      const original = 'Lista todos mis repositorios';
      const r = detectModeMismatch(original, 'chat');
      expect(r).not.toBeNull();
      expect(r!.retryText).toBe(original);
    });
  });
});
