import { describe, it, expect } from 'vitest';
import { isConversationRequest, isActionRequest, resolveMode } from '../modeDetection';

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
});
