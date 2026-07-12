import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PROVIDERS, getProvider, fetchModels, pickDefaultModel, modelLabel, type ModelOption } from '../providers';

describe('providers — registro', () => {
  it('los cinco proveedores tienen su defaultModel dentro de staticModels', () => {
    (['gemini', 'groq', 'openrouter', 'nvidia', 'zenmux'] as const).forEach(id => {
      const def = getProvider(id);
      expect(def.id).toBe(id);
      expect(def.staticModels.some(m => m.value === def.defaultModel)).toBe(true);
    });
  });

  it('gemini usa proxy; groq, openrouter, nvidia y zenmux son openai-compatible con endpoint', () => {
    expect(PROVIDERS.gemini.transport).toBe('gemini-proxy');
    expect(PROVIDERS.groq.transport).toBe('openai-compatible');
    expect(PROVIDERS.groq.chatEndpoint).toContain('groq.com');
    expect(PROVIDERS.openrouter.transport).toBe('openai-compatible');
    expect(PROVIDERS.openrouter.chatEndpoint).toContain('openrouter.ai');
    expect(PROVIDERS.nvidia.transport).toBe('openai-compatible');
    // NVIDIA NIM: proxy backend /api/nim porque el upstream no envía CORS.
    expect(PROVIDERS.nvidia.chatEndpoint).toBe('/api/nim');
    // Catálogo ESTÁTICO (NIM_FALLBACK), igual que Gemini: sin catálogo dinámico
    expect(PROVIDERS.nvidia.modelsEndpoint).toBeUndefined();
    expect(PROVIDERS.nvidia.modelsNeedKey).toBeUndefined();
    expect(PROVIDERS.zenmux.transport).toBe('openai-compatible');
    expect(PROVIDERS.zenmux.chatEndpoint).toContain('zenmux.ai');
    // El catálogo de OpenRouter es público (no necesita key)
    expect(PROVIDERS.openrouter.modelsNeedKey).toBe(false);
    expect(PROVIDERS.groq.modelsNeedKey).toBe(true);
    expect(PROVIDERS.zenmux.modelsNeedKey).toBe(true);
  });

  it('gemini incluye gemini-3-flash-preview en staticModels', () => {
    expect(PROVIDERS.gemini.staticModels.some(m => m.value === 'gemini-3-flash-preview')).toBe(true);
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
    // El catálogo fijo tiene los 7 modelos operativos.
    const values = PROVIDERS.gemini.staticModels.map(m => m.value);
    expect(values).toEqual([
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-3.5-flash',
      'gemini-3-flash-preview',
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

  it('nvidia: catálogo estático (NIM_FALLBACK) — fetchModels devuelve null sin endpoint dinámico', async () => {
    // v3.32.1+: NVIDIA usa catálogo estático (NIM_FALLBACK) como Gemini, para
    // evitar el catálogo dinámico ruidoso de NIM. Sin modelsEndpoint, fetchModels
    // devuelve null y NO llama a la API.
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await fetchModels(PROVIDERS.nvidia, 'nvapi_test')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    // El catálogo estático son los 12 modelos curados de NIM_FALLBACK.
    const values = PROVIDERS.nvidia.staticModels.map(m => m.value);
    expect(values).toContain('nvidia/nemotron-3-ultra-550b-a55b');
    expect(values).toContain('z-ai/glm-5.2');
    expect(values.length).toBe(12);
  });

  it('zenmux: marca free por pricing 0, filtra no-chat, ordena free primero', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'paid/model', display_name: 'Paid', pricing: { prompt: [{ value: 1 }], completion: [{ value: 2 }] } },
          { id: 'x-ai/grok-4.5-free', display_name: 'Grok 4.5 Free', pricing: { prompt: [{ value: 0 }], completion: [{ value: 0 }] } },
          { id: 'whisper-large', display_name: 'Whisper', pricing: { prompt: [{ value: 0.5 }] } },
          { id: 'stepfun/step-3.7-flash-free', display_name: 'Step 3.7 Flash', pricing: { prompt: [], completion: [] } },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(PROVIDERS.zenmux, 'sk-ai-v1_test');
    expect(list).not.toBeNull();
    const ids = list!.map(m => m.value);
    // Debe filtrar whisper
    expect(ids).not.toContain('whisper-large');
    // Free primero
    expect(list![0].free).toBe(true);
    expect(list!.find(m => m.value === 'x-ai/grok-4.5-free')!.free).toBe(true);
    expect(list!.find(m => m.value === 'stepfun/step-3.7-flash-free')!.free).toBe(true);
    expect(list!.find(m => m.value === 'paid/model')!.free).toBe(false);
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

  it('nvidia: devuelve label legible para modelos en fallback (Nemotron, GLM, Codestral...)', () => {
    expect(modelLabel('nvidia', 'nvidia/nemotron-3-ultra-550b-a55b')).toBe('Nemotron 3 Ultra ⭐');
    expect(modelLabel('nvidia', 'z-ai/glm-5.2')).toBe('GLM 5.2');
    expect(modelLabel('nvidia', 'mistralai/codestral-22b-instruct-v0.1')).toBe('Codestral 22B (código)');
    // Modelo dinámico no en fallback → value tal cual
    expect(modelLabel('nvidia', 'nuevo/modelo-dinamico')).toBe('nuevo/modelo-dinamico');
  });

  it('zenmux: devuelve label legible para modelos free en fallback', () => {
    expect(modelLabel('zenmux', 'stepfun/step-3.7-flash-free')).toBe('Step 3.7 Flash');
    expect(modelLabel('zenmux', 'x-ai/grok-4.5-free')).toBe('Grok 4.5 (500K ctx)');
    expect(modelLabel('zenmux', 'z-ai/glm-4.7-flash-free')).toBe('GLM 4.7 Flash');
    // Modelo dinámico no en fallback → value tal cual
    expect(modelLabel('zenmux', 'nuevo/modelo-zenmux')).toBe('nuevo/modelo-zenmux');
  });
});
