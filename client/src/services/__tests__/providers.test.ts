import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PROVIDERS, getProvider, fetchModels, pickDefaultModel, modelLabel, type ModelOption } from '../providers';

describe('providers — registro', () => {
  it('los tres proveedores tienen su defaultModel dentro de staticModels', () => {
    (['gemini', 'groq', 'openrouter'] as const).forEach(id => {
      const def = getProvider(id);
      expect(def.id).toBe(id);
      expect(def.staticModels.some(m => m.value === def.defaultModel)).toBe(true);
    });
  });

  it('gemini usa proxy; groq y openrouter son openai-compatible con endpoint', () => {
    expect(PROVIDERS.gemini.transport).toBe('gemini-proxy');
    expect(PROVIDERS.groq.transport).toBe('openai-compatible');
    expect(PROVIDERS.groq.chatEndpoint).toContain('groq.com');
    expect(PROVIDERS.openrouter.transport).toBe('openai-compatible');
    expect(PROVIDERS.openrouter.chatEndpoint).toContain('openrouter.ai');
    // El catálogo de OpenRouter es público (no necesita key)
    expect(PROVIDERS.openrouter.modelsNeedKey).toBe(false);
    expect(PROVIDERS.groq.modelsNeedKey).toBe(true);
  });
});

describe('providers — pickDefaultModel', () => {
  const free = (value: string): ModelOption => ({ value, label: value, free: true });
  const paid = (value: string): ModelOption => ({ value, label: value });

  it('prefiere un modelo free fiable (Gemma) sobre otros gratuitos', () => {
    const list = [free('a/aardvark:free'), free('google/gemma-4-31b-it:free'), free('z/zzz:free')];
    expect(pickDefaultModel(list)).toBe('google/gemma-4-31b-it:free');
  });

  it('respeta el orden de preferencia (Llama 3.3 70B antes que DeepSeek)', () => {
    const list = [free('deepseek/deepseek-r1:free'), free('meta-llama/llama-3.3-70b-instruct:free')];
    expect(pickDefaultModel(list)).toBe('meta-llama/llama-3.3-70b-instruct:free');
  });

  it('si ningún free coincide con la preferencia, devuelve el primer free', () => {
    const list = [paid('openai/gpt-4o'), free('some/exotic-model:free')];
    expect(pickDefaultModel(list)).toBe('some/exotic-model:free');
  });

  it('sin modelos free, aplica la preferencia sobre todos (Groq → un modelo Llama)', () => {
    // El prefijo 'llama' (genérico, v3.22.0) matchea cualquier modelo Llama del catálogo;
    // devuelve el primero que aparece.
    const list = [paid('llama-3.1-8b-instant'), paid('llama-3.3-70b-versatile')];
    expect(pickDefaultModel(list)).toBe('llama-3.1-8b-instant');
  });

  it('lista vacía devuelve el fallback', () => {
    expect(pickDefaultModel([], 'fallback/model')).toBe('fallback/model');
    expect(pickDefaultModel([])).toBe('');
  });
});

describe('providers — fetchModels', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('openrouter: marca free por sufijo :free y por pricing 0, y ordena free primero', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'paid/model', name: 'Paid', pricing: { prompt: '0.5', completion: '1' } },
          { id: 'x/llama:free', name: 'Llama Free' },
          { id: 'y/zero', name: 'Zero', pricing: { prompt: '0', completion: '0' } },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(PROVIDERS.openrouter);
    expect(list).not.toBeNull();
    // Free primero
    expect(list![0].free).toBe(true);
    expect(list!.find(m => m.value === 'x/llama:free')!.free).toBe(true);
    expect(list!.find(m => m.value === 'y/zero')!.free).toBe(true);
    expect(list!.find(m => m.value === 'paid/model')!.free).toBe(false);
  });

  it('groq: excluye modelos no-chat (whisper, etc.)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'llama-3.3-70b-versatile' }, { id: 'whisper-large-v3' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(PROVIDERS.groq, 'gsk_test');
    const ids = list!.map(m => m.value);
    expect(ids).toContain('llama-3.3-70b-versatile');
    expect(ids).not.toContain('whisper-large-v3');
  });

  it('gemini: catálogo fijo (v3.24.0) — fetchModels devuelve null, no hay endpoint dinámico', async () => {
    // El catálogo de Gemini es ahora 100% fijo (staticModels); no hay
    // modelsEndpoint, así que fetchModels devuelve null sin llamar a fetch.
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await fetchModels(PROVIDERS.gemini, 'AIzaSy_test')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    // El catálogo fijo tiene los 6 modelos operativos.
    const values = PROVIDERS.gemini.staticModels.map(m => m.value);
    expect(values).toEqual([
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.0-flash',
      'gemma-4-31b-it',
    ]);
  });

  it('gemini sin key devuelve null (no hay endpoint dinámico)', async () => {
    expect(await fetchModels(PROVIDERS.gemini)).toBeNull();
  });

  it('groq sin key devuelve null (su catálogo requiere Authorization)', async () => {
    expect(await fetchModels(PROVIDERS.groq)).toBeNull();
  });

  it('cachea la lista en sessionStorage (no la key)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'a/b:free', name: 'AB' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchModels(PROVIDERS.openrouter);
    await fetchModels(PROVIDERS.openrouter); // segunda llamada → cache
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const cached = sessionStorage.getItem('openrouter_models_cache');
    expect(cached).toBeTruthy();
    expect(cached).not.toContain('sk-or'); // nunca la key
  });
});

describe('modelLabel (v3.31.0)', () => {
  it('devuelve la .label legible si el modelo está en el catálogo y NO es clave i18n', () => {
    // llama-3.1-8b-instant está en GROQ_FALLBACK con label literal "Llama 3.1 8B (fast)".
    expect(modelLabel('groq', 'llama-3.1-8b-instant')).toBe('Llama 3.1 8B (fast)');
  });

  it('cae al value si la label es una clave i18n (contiene un punto)', () => {
    // gemini-2.5-flash tiene label "provider.gemini.model.recommended" → clave i18n.
    expect(modelLabel('gemini', 'gemini-2.5-flash')).toBe('gemini-2.5-flash');
  });

  it('devuelve el value tal cual si el modelo NO está en el catálogo (dinámico/desconocido)', () => {
    expect(modelLabel('groq', 'openai/gpt-oss-120b:free')).toBe('openai/gpt-oss-120b:free');
    expect(modelLabel('openrouter', 'algún/modelo:free')).toBe('algún/modelo:free');
  });
});
