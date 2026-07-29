import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveProviderPref, loadProviderPref, clearProviderPref } from '../providerPrefs';

describe('providerPrefs (#40)', () => {
  beforeEach(() => sessionStorage.clear());

  it('guarda y recupera proveedor + modelo', () => {
    saveProviderPref('groq', 'llama-3.3-70b');
    expect(loadProviderPref()).toEqual({ provider: 'groq', model: 'llama-3.3-70b' });
  });

  it('devuelve null si no hay nada guardado', () => {
    expect(loadProviderPref()).toBeNull();
  });

  it('clear borra la preferencia', () => {
    saveProviderPref('gemini', 'gemini-2.5-flash');
    clearProviderPref();
    expect(loadProviderPref()).toBeNull();
  });

  it('ignora un proveedor desconocido (validación contra el registro)', () => {
    sessionStorage.setItem('ai_provider_pref', JSON.stringify({ provider: 'inventado', model: 'x' }));
    expect(loadProviderPref()).toBeNull();
  });

  it('ignora JSON corrupto sin lanzar', () => {
    sessionStorage.setItem('ai_provider_pref', '{no es json');
    expect(loadProviderPref()).toBeNull();
  });

  it('NO guarda ninguna API key (solo proveedor y modelo)', () => {
    saveProviderPref('openrouter', 'deepseek/deepseek-r1:free');
    const raw = sessionStorage.getItem('ai_provider_pref') || '';
    expect(raw).toContain('openrouter');
    expect(raw).toContain('deepseek/deepseek-r1:free');
    // El objeto guardado solo tiene esas dos claves
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(['model', 'provider']);
  });

  it('degrada en silencio si sessionStorage no está disponible (modo privado, etc.)', () => {
    const boom = () => { throw new Error('storage no disponible'); };
    const spies = [
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom),
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom),
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(boom),
    ];
    // Ninguna de las tres operaciones debe lanzar; load devuelve null.
    expect(() => saveProviderPref('groq', 'llama-3.3-70b')).not.toThrow();
    expect(loadProviderPref()).toBeNull();
    expect(() => clearProviderPref()).not.toThrow();
    spies.forEach(s => s.mockRestore());
  });

  // #73: timeout configurable persistido junto a proveedor+modelo.
  describe('timeoutMs (#73)', () => {
    it('guarda y recupera timeoutMs cuando se pasa', () => {
      saveProviderPref('groq', 'llama-3.3-70b', 60000);
      expect(loadProviderPref()).toEqual({ provider: 'groq', model: 'llama-3.3-70b', timeoutMs: 60000 });
    });

    it('NO incluye timeoutMs si no se pasa (backward-compatible)', () => {
      saveProviderPref('groq', 'llama-3.3-70b');
      const pref = loadProviderPref();
      expect(pref).toEqual({ provider: 'groq', model: 'llama-3.3-70b' });
      expect(pref!.timeoutMs).toBeUndefined();
    });

    it('ignora timeoutMs inválido (<=0 o no numérico) al leer', () => {
      sessionStorage.setItem('ai_provider_pref', JSON.stringify({ provider: 'groq', model: 'x', timeoutMs: 0 }));
      expect(loadProviderPref()?.timeoutMs).toBeUndefined();
      sessionStorage.setItem('ai_provider_pref', JSON.stringify({ provider: 'groq', model: 'x', timeoutMs: 'lento' }));
      expect(loadProviderPref()?.timeoutMs).toBeUndefined();
    });

    it('acepta timeoutMs undefined explícito sin romper', () => {
      saveProviderPref('groq', 'llama-3.3-70b', undefined);
      const pref = loadProviderPref();
      expect(pref?.provider).toBe('groq');
      expect(pref?.timeoutMs).toBeUndefined();
    });
  });
});
