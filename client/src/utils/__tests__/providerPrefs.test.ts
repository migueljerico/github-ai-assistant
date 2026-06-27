import { describe, it, expect, beforeEach } from 'vitest';
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
});
