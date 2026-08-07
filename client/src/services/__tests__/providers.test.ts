import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PROVIDERS, getProvider, fetchModels, pickDefaultModel, modelLabel, resolveEndpoint, NIM_EXCLUDED, GROQ_FALLBACK, GROQ_DEPRECATED, type ModelOption } from '../providers';

describe('providers — registro', () => {
  it('los proveedores tienen su defaultModel dentro de staticModels', () => {
    (['gemini', 'groq', 'openrouter', 'nvidia', 'zenmux', 'openzen', 'cloudflare', 'ollama', 'aiand', 'kilo', 'bazaarlink', 'qwencloud'] as const).forEach(id => {
      const def = getProvider(id);
      expect(def.id).toBe(id);
      expect(def.staticModels.some(m => m.value === def.defaultModel)).toBe(true);
    });
  });

  it('bazaarlink: openai-compatible vía proxy backend /api/bazaarlink, endpoints relativos, catálogo público, modelos free configurados', () => {
    const def = PROVIDERS.bazaarlink;
    expect(def.transport).toBe('openai-compatible');
    expect(def.chatEndpoint).toBe('/api/bazaarlink');
    expect(def.modelsEndpoint).toBe('/api/bazaarlink/models');
    expect(def.modelsNeedKey).toBe(false);
    expect(def.keyPrefix).toBe('sk-bl-');
    expect(def.staticModels.some(m => m.value === def.defaultModel)).toBe(true);
    expect(def.defaultModel).toBe('deepseek/deepseek-v4-flash:free');
    expect(def.staticModels.some(m => m.free === true)).toBe(true);
  });

  it('qwencloud: openai-compatible vía proxy backend /api/qwencloud, endpoints relativos, modelos free configurados', () => {
    const def = PROVIDERS.qwencloud;
    expect(def.transport).toBe('openai-compatible');
    expect(def.chatEndpoint).toBe('/api/qwencloud');
    expect(def.modelsEndpoint).toBe('/api/qwencloud/models');
    expect(def.modelsNeedKey).toBe(true);
    expect(def.keyPrefix).toBe('sk-');
    expect(def.staticModels.some(m => m.value === def.defaultModel)).toBe(true);
    expect(def.defaultModel).toBe('qwen3.7-flash');
    expect(def.staticModels.some(m => m.value === 'qwen-plus-character')).toBe(true);
    expect(def.staticModels.every(m => m.free === true)).toBe(true);
    expect(def.staticModels.length).toBe(13);
  });

  it('gemini usa proxy; groq, openrouter y zenmux son openai-compatible con endpoint directo; nvidia, openzen y cloudflare usan proxy backend por CORS', () => {
    expect(PROVIDERS.gemini.transport).toBe('gemini-proxy');
    expect(PROVIDERS.groq.transport).toBe('openai-compatible');
    expect(PROVIDERS.groq.chatEndpoint).toContain('groq.com');
    expect(PROVIDERS.openrouter.transport).toBe('openai-compatible');
    expect(PROVIDERS.openrouter.chatEndpoint).toContain('openrouter.ai');
    // El catálogo de OpenRouter es público (no necesita key)
    expect(PROVIDERS.openrouter.modelsNeedKey).toBe(false);
    expect(PROVIDERS.groq.modelsNeedKey).toBe(true);
    expect(PROVIDERS.zenmux.transport).toBe('openai-compatible');
    expect(PROVIDERS.zenmux.chatEndpoint).toBe('/api/zenmux');
    expect(PROVIDERS.zenmux.modelsNeedKey).toBe(true);
    // NVIDIA NIM: proxy backend /api/nim (CORS de NIM)
    expect(PROVIDERS.nvidia.transport).toBe('openai-compatible');
    expect(PROVIDERS.nvidia.chatEndpoint).toBe('/api/nim');
    expect(PROVIDERS.nvidia.modelsEndpoint).toBeUndefined();
    // OpenCode Zen: proxy /api/openzen (CORS de opencode.ai), catálogo estático
    expect(PROVIDERS.openzen.transport).toBe('openai-compatible');
    expect(PROVIDERS.openzen.chatEndpoint).toBe('/api/openzen');
    expect(PROVIDERS.openzen.modelsEndpoint).toBeUndefined();
    // Cloudflare: proxy /api/cloudflare (CORS de Cloudflare), catálogo dinámico vía proxy
    expect(PROVIDERS.cloudflare.transport).toBe('openai-compatible');
    expect(PROVIDERS.cloudflare.chatEndpoint).toBe('/api/cloudflare');
    expect(PROVIDERS.cloudflare.modelsEndpoint).toBe('/api/cloudflare/models');
    expect(PROVIDERS.cloudflare.modelsNeedKey).toBe(true);
  });

  it('gemini incluye gemini-3-flash-preview en staticModels', () => {
    expect(PROVIDERS.gemini.staticModels.some(m => m.value === 'gemini-3-flash-preview')).toBe(true);
  });

  it('aiand: openai-compatible vía proxy backend /api/aiand (sin CORS upstream), endpoints relativos, maxOutputTokens 8192', () => {
    const def = PROVIDERS.aiand;
    expect(def.transport).toBe('openai-compatible');
    // Endpoints relativos (proxy backend — Ai& no envía CORS, igual que NIM/OpenZen/CF/Ollama)
    expect(def.chatEndpoint).toBe('/api/aiand');
    expect(def.modelsEndpoint).toBe('/api/aiand/models');
    // Requiere key del usuario
    expect(def.modelsNeedKey).toBe(true);
    // Default dentro de staticModels
    expect(def.staticModels.some(m => m.value === def.defaultModel)).toBe(true);
    expect(def.defaultModel).toBe('qwen/qwen3.6-27b');
    // Límite de salida preferido (modelos de razonamiento con salidas largas)
    expect(def.maxOutputTokens).toBe(8192);
    expect(def.keyPrefix).toBe('sk-');
  });

  it('kilo: openai-compatible vía proxy backend /api/kilo (sin CORS upstream), catálogo público, modelos free con sufijo :free', () => {
    const def = PROVIDERS.kilo;
    expect(def.transport).toBe('openai-compatible');
    // Endpoints relativos (proxy backend — Kilo no envía CORS, igual que NIM/OpenZen/CF/Ollama/Ai&)
    expect(def.chatEndpoint).toBe('/api/kilo');
    expect(def.modelsEndpoint).toBe('/api/kilo/models');
    // El catálogo de Kilo es PÚBLICO (GET /models no requiere auth)
    expect(def.modelsNeedKey).toBe(false);
    // Default dentro de staticModels
    expect(def.staticModels.some(m => m.value === def.defaultModel)).toBe(true);
    expect(def.defaultModel).toBe('inclusionai/ling-3.0-flash:free');
    // La API key de Kilo es un JWT (HS256): empieza por "eyJ"
    expect(def.keyPrefix).toBe('eyJ');
    // Los 3 modelos free del fallback llevan flag free (render 🆓)
    expect(def.staticModels.every(m => m.free === true)).toBe(true);
    expect(def.staticModels.length).toBe(3);
  });

  it('openzen: fallback incluye los 8 modelos free de 2026-08-05 (incluido longcat-2.0-free, nuevo)', () => {
    const def = PROVIDERS.openzen;
    // big-pickle es la excepción sin sufijo -free
    expect(def.staticModels.some(m => m.value === 'big-pickle')).toBe(true);
    // longcat-2.0-free: nuevo modelo añadido en v3.68.7 (faltaba en el fallback anterior)
    expect(def.staticModels.some(m => m.value === 'longcat-2.0-free')).toBe(true);
    expect(def.staticModels.find(m => m.value === 'longcat-2.0-free')?.free).toBe(true);
    // Total: 8 modelos en el fallback
    expect(def.staticModels.length).toBe(8);
    // Todos marcados como free
    expect(def.staticModels.every(m => m.free === true)).toBe(true);
  });

  it('nvidia NIM: fallback actualizado 2026-08-05 — Nemotron Super 49B presente, qwen3-next-80b retirado (ID inexistente en API real)', () => {
    const def = PROVIDERS.nvidia;
    // Nemotron Super 49B v1: confirmado en integrate.api.nvidia.com/v1/models
    expect(def.staticModels.some(m => m.value === 'nvidia/llama-3.3-nemotron-super-49b-v1')).toBe(true);
    // Step 3.7 Flash: nuevo modelo confirmado en API real
    expect(def.staticModels.some(m => m.value === 'stepfun-ai/step-3.7-flash')).toBe(true);
    // qwen3-next-80b-a3b-instruct: ID que no existe en la API real → eliminado del fallback
    expect(def.staticModels.some(m => m.value === 'qwen/qwen3-next-80b-a3b-instruct')).toBe(false);
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
      json: async () => ({ data: [{ id: 'openai/gpt-oss-20b' }, { id: 'whisper-large-v3' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(PROVIDERS.groq, 'gsk_test');
    const ids = list!.map(m => m.value);
    expect(ids).toContain('openai/gpt-oss-20b');
    expect(ids).not.toContain('whisper-large-v3');
  });

  it('groq: excluye modelos retirados/Deprecated aunque la API aún los devuelva (defensa en profundidad)', async () => {
    // Groq retira llama-3.3-70b-versatile y llama-3.1-8b-instant el 2026-08-16; hasta
    // esa fecha la API puede seguir listándolos. fetchModels no debe ofrecerlos.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [
        { id: 'openai/gpt-oss-20b' },
        { id: 'llama-3.3-70b-versatile' },
        { id: 'llama-3.1-8b-instant' },
      ] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(PROVIDERS.groq, 'gsk_test');
    const ids = list!.map(m => m.value);
    expect(ids).toEqual(['openai/gpt-oss-20b']);
    GROQ_DEPRECATED.forEach(deprecated => expect(ids).not.toContain(deprecated));
  });

  it('groq: el fallback estático NO contiene modelos retirados (regresión v3.65.1)', () => {
    // Evita que vuelvan a meterse modelos que se deprecaban el 2026-08-16.
    const values = GROQ_FALLBACK.map(m => m.value);
    GROQ_DEPRECATED.forEach(deprecated => expect(values).not.toContain(deprecated));
  });

  it('gemini: catálogo fijo (v3.24.0) — fetchModels devuelve null, no hay endpoint dinámico', async () => {
    // El catálogo de Gemini es ahora 100% fijo (staticModels); no hay
    // modelsEndpoint, así que fetchModels devuelve null sin llamar a fetch.
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await fetchModels(PROVIDERS.gemini, 'AIzaSy_test')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    // El catálogo fijo tiene los 18 modelos operativos a día de hoy.
    const values = PROVIDERS.gemini.staticModels.map(m => m.value);
    expect(values).toEqual([
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemma-4-26b-a4b-it',
      'gemma-4-31b-it',
      'gemini-flash-latest',
      'gemini-flash-lite-latest',
      'gemini-pro-latest',
      'gemini-2.5-flash-lite',
      'gemini-3-pro-preview',
      'gemini-3-flash-preview',
      'gemini-3.1-pro-preview',
      'gemini-3.1-flash-lite-preview',
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
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

    const cached = sessionStorage.getItem('openrouter_models_cache_v3');
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
    // El catálogo estático son los 13 modelos curados de NIM_FALLBACK.
    const values = PROVIDERS.nvidia.staticModels.map(m => m.value);
    expect(values).toContain('nvidia/nemotron-3-ultra-550b-a55b');
    expect(values).toContain('z-ai/glm-5.2');
    expect(values.length).toBe(13);
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

  it('aiand: catálogo free-only (filtra paid, embedding y no-chat), free detection por pricing a 0', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'paid/model', display_name: 'Paid', pricing: { input_per_1m: 1, output_per_1m: 2 } },
          { id: 'qwen/qwen-free', display_name: 'Qwen Free', pricing: { input_per_1m: 0, output_per_1m: 0 } },
          { id: 'text-embedding-3', display_name: 'Embedding', pricing: { input_per_1m: 0.1 } },
          { id: 'no-pricing-model', display_name: 'No Pricing' },
          { id: 'partial-pricing', display_name: 'Partial', pricing: { input_per_1m: 0 } },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(PROVIDERS.aiand, 'sk-test');
    expect(list).not.toBeNull();
    const ids = list!.map(m => m.value);
    // Filtra embedding (no-chat)
    expect(ids).not.toContain('text-embedding-3');
    // Ahora devuelve modelos de pago tambien (v4.0.1)
    expect(ids).toContain('paid/model');
    const paidModel = list!.find(m => m.value === 'paid/model');
    expect(paidModel?.free).toBe(false);
    // Ambos precios a 0 → free (presente)
    expect(list!.find(m => m.value === 'qwen/qwen-free')!.free).toBe(true);
    // Sin pricing → free (fallback defensivo, presente)
    expect(list!.find(m => m.value === 'no-pricing-model')!.free).toBe(true);
    // input=0 + output undefined → Number(undefined ?? 0)=0 → free=true (presente)
    expect(list!.find(m => m.value === 'partial-pricing')!.free).toBe(true);
  });

  it('openzen: usa catálogo estático (OPENZEN_FALLBACK) sin fetch dinámico (CORS)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // Sin modelsEndpoint, fetchModels devuelve null (usa staticModels)
    const list = await fetchModels(PROVIDERS.openzen);
    expect(list).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    // El catálogo estático son los 8 modelos de OPENZEN_FALLBACK (2026-08-05)
    const values = PROVIDERS.openzen.staticModels.map(m => m.value);
    expect(values).toEqual([
      'big-pickle',
      'mimo-v2.5-free',
      'laguna-s-2.1-free',
      'ling-3.0-flash-free',
      'longcat-2.0-free',
      'north-mini-code-free',
      'nemotron-3-ultra-free',
      'deepseek-v4-flash-free',
    ]);
    // Todos son free (los 8 de la fuente oficial opencode.ai/docs/es/zen/#pricing)
    expect(PROVIDERS.openzen.staticModels.every(m => m.free)).toBe(true);
    expect(PROVIDERS.openzen.staticModels.length).toBe(8);
  });

  it('cloudflare: devuelve null sin accountId (exige X-Account-Id aunque el endpoint no lleve {account_id})', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    // Sin accountId, fetchModels devuelve null (no hace fetch); el panel usa staticModels.
    expect(await fetchModels(PROVIDERS.cloudflare, 'token_test', null)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cloudflare: catálogo estático (CLOUDFLARE_FALLBACK) sin modelos no-Free y recommended Qwen3', () => {
    // Catálogo estático = red de seguridad. Los 3 modelos no-Free (kimi-k2.6,
    // kimi-k2.7-code, glm-5.2) están excluidos; el recommended es Qwen3 30B.
    const values = PROVIDERS.cloudflare.staticModels.map(m => m.value);
    expect(values).toEqual([
      '@cf/qwen/qwen3-30b-a3b-fp8',
      '@cf/meta/llama-3.2-3b-instruct',
      '@cf/meta/llama-3.2-1b-instruct',
      '@cf/meta/llama-3.1-8b-instruct-fp8',
      '@cf/openai/gpt-oss-20b',
      '@cf/openai/gpt-oss-120b',
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      '@cf/meta/llama-4-scout-17b-16e-instruct',
      '@cf/google/gemma-4-26b-a4b-it',
      '@cf/nvidia/nemotron-3-120b-a12b',
    ]);
    expect(values).not.toContain('@cf/moonshotai/kimi-k2.7-code');
    expect(values).not.toContain('@cf/moonshotai/kimi-k2.6');
    expect(values).not.toContain('@cf/zai-org/glm-5.2');
    expect(PROVIDERS.cloudflare.staticModels.find(m => m.value === '@cf/qwen/qwen3-30b-a3b-fp8')?.recommended).toBe(true);
    expect(PROVIDERS.cloudflare.defaultModel).toBe('@cf/qwen/qwen3-30b-a3b-fp8');
  });

  it('cloudflare: fetch dinámico envía X-Account-Id, excluye no-Free y enriquece etiquetas', async () => {
    // El proxy server-side ya filtra task=Text Generation y los no-Free; el cliente
    // re-aplica la exclusión no-Free por defensa en profundidad y mapea etiquetas.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: [
        { name: '@cf/qwen/qwen3-30b-a3b-fp8' },
        { name: '@cf/meta/llama-3.1-8b-instruct-fp8' },
        { name: '@cf/moonshotai/kimi-k2.7-code' }, // no-Free → excluido
        { description: 'sin name' },               // sin name → filtrado
      ] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(PROVIDERS.cloudflare, 'token', 'ACC');
    // El fetch se llamó con header X-Account-Id (y Bearer).
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/cloudflare/models');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token');
    expect((init.headers as Record<string, string>)['X-Account-Id']).toBe('ACC');
    // Excluye el no-Free (kimi-k2.7-code) y el sin-name; etiquetas amigables.
    expect(list!.map(m => m.value)).toEqual(['@cf/meta/llama-3.1-8b-instruct-fp8', '@cf/qwen/qwen3-30b-a3b-fp8']);
    expect(list!.find(m => m.value === '@cf/qwen/qwen3-30b-a3b-fp8')?.label).toBe('Qwen3 30B A3B');
  });

  it('kilo: catálogo público (no requiere key) parsea {data:[{id}]}, marca free por sufijo :free, ordena free primero', async () => {
    // Kilo declara modelsEndpoint='/api/kilo/models' y modelsNeedKey=false → fetchModels
    // SÍ hace la petición (sin key). Rama propia: marca free por sufijo :free.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [
        { id: 'inclusionai/ling-3.0-flash:free' },
        { id: 'poolside/laguna-s-2.1:free' },
        { id: 'nex-agi/nex-n2-pro:free' },
        { id: 'paid/some-model' }, // paid (sin :free) → debe ir al final
      ] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    // Sin API key (catálogo público): debe devolver la lista, no null
    const list = await fetchModels(PROVIDERS.kilo);
    expect(list).not.toBeNull();
    const ids = list!.map(m => m.value);
    // Free primero (alfabético entre ellos), luego paid
    expect(ids).toEqual([
      'inclusionai/ling-3.0-flash:free',
      'nex-agi/nex-n2-pro:free',
      'poolside/laguna-s-2.1:free',
      'paid/some-model',
    ]);
    // Flags free correctos
    expect(list!.find(m => m.value === 'inclusionai/ling-3.0-flash:free')!.free).toBe(true);
    expect(list!.find(m => m.value === 'paid/some-model')!.free).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('bazaarlink: catálogo dinámico vía /api/bazaarlink/models, marca free en modelos solicitados, filtra no-chat y ordena free primero', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'deepseek/deepseek-v4-flash:free', display_name: 'DeepSeek V4 Flash' },
          { id: 'qwen/qwen3.7-flash:free', display_name: 'Qwen 3.7 Flash' },
          { id: 'custom-model:free', display_name: 'Custom Model Free' },
          { id: 'text-embedding-3', display_name: 'Embedding (no-chat)' }, // excluido
          { id: 'paid-large-model', display_name: 'Paid Large Model', pricing: { prompt: '0.001', completion: '0.002' } },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(PROVIDERS.bazaarlink);
    expect(list).not.toBeNull();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/bazaarlink/models');

    const ids = list!.map(m => m.value);
    // Excluye no-chat
    expect(ids).not.toContain('text-embedding-3');
    // Free primero, luego paid
    expect(ids).toEqual([
      'custom-model:free',
      'deepseek/deepseek-v4-flash:free',
      'qwen/qwen3.7-flash:free',
      'paid-large-model',
    ]);
    expect(list!.find(m => m.value === 'deepseek/deepseek-v4-flash:free')!.free).toBe(true);
    expect(list!.find(m => m.value === 'qwen/qwen3.7-flash:free')!.free).toBe(true);
    expect(list!.find(m => m.value === 'custom-model:free')!.free).toBe(true);
    expect(list!.find(m => m.value === 'paid-large-model')!.free).toBe(false);
  });

  // ── Cobertura de ramas dinámicas no cubiertas (L635-837) ──────────────────
  // Algunos providers (gemini, nvidia, openzen, cloudflare) usan catálogo
  // ESTÁTICO en producción (sin modelsEndpoint), así que sus ramas de parseo
  // dinámico solo se ejercitan con un ProviderDef sintético que sí declare
  // modelsEndpoint. Aquí se cubren esas ramas + los throw por error/catálogo vacío.

  it('openrouter: pricing en formato array (new format) → free solo si todo a 0', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          // Ambos precios a 0 en formato array → free
          { id: 'all/zero', name: 'Zero', pricing: { prompt: [{ value: 0 }], completion: [{ value: 0 }] } },
          // Sin arrays de pricing (prompt/completion ausentes) → free (defensivo)
          { id: 'no/pricing', name: 'NoP', pricing: {} },
          // Algún precio > 0 → paid
          { id: 'paid/one', name: 'Paid', pricing: { prompt: [{ value: 0.5 }], completion: [{ value: 0 }] } },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(PROVIDERS.openrouter);
    expect(list!.find(m => m.value === 'all/zero')!.free).toBe(true);
    expect(list!.find(m => m.value === 'no/pricing')!.free).toBe(true);
    expect(list!.find(m => m.value === 'paid/one')!.free).toBe(false);
  });

  it('gemini (def con endpoint): filtra modelos no-generativos (GEMINI_EXCLUDED)', async () => {
    const def = { ...PROVIDERS.gemini, modelsEndpoint: 'https://gemini/models' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [
        { id: 'gemini-2.5-flash', name: 'Flash' },
        { id: 'text-embedding-004', name: 'Embed' }, // embed → excluido
        { id: 'imagen-4.0-generate', name: 'Imagen' }, // imagen → excluido
      ] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(def, 'AIzaSy_test');
    const ids = list!.map(m => m.value);
    expect(ids).toEqual(['gemini-2.5-flash']);
  });

  it('nvidia (def con endpoint): filtra no-chat, enriquece con featured-models y los prioriza', async () => {
    const def = { ...PROVIDERS.nvidia, modelsEndpoint: 'https://nim/models' };
    // 1ª llamada: catálogo NIM. 2ª llamada: featured-models.json (NGC).
    // 'nemotron' es la familia principal de CHAT de NVIDIA: NO debe colarse en el
    // filtro (regresión v3.60.1: 'nemo' era substring de 'nemotron').
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [
        { id: 'nvidia/nemotron-3-ultra-550b-a55b', name: 'Nemotron' }, // featured + chat
        { id: 'deepseek-ai/deepseek-v4-pro', name: 'DeepSeek' },
        { id: 'nvidia/nv-embed-v1', name: 'Embed' }, // embed → excluido
      ] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ 'featured-models': [{ model: 'nvidia/nemotron-3-ultra-550b-a55b' }] }) });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(def, 'nvapi_test');
    const ids = list!.map(m => m.value);
    expect(ids).not.toContain('nvidia/nv-embed-v1'); // filtrado
    // Nemotron NO se excluye (bug arreglado) y va primero por ser featured.
    expect(ids[0]).toBe('nvidia/nemotron-3-ultra-550b-a55b');
    expect(ids).toContain('deepseek-ai/deepseek-v4-pro');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('regresión NIM_EXCLUDED: NO excluye modelos de chat Nemotron (v3.60.1)', () => {
    // El filtro es por substring: antes 'nemo' excluía 'nemotron' por error.
    // Tras el fix, los Nemotron de chat deben pasar el filtro.
    const isExcluded = (id: string) => NIM_EXCLUDED.some(p => id.toLowerCase().includes(p));
    expect(isExcluded('nvidia/nemotron-3-ultra-550b-a55b')).toBe(false);
    expect(isExcluded('nvidia/nemotron-3-nano-50b-a8b')).toBe(false);
    // Pero los NeMo Retriever (retrieval) sí siguen excluidos por 'nemoretriever'/'retrieval'.
    expect(isExcluded('nvidia/nemoretriever-nemotron')).toBe(true);
    // Y el resto de no-chat (embed, whisper) sigue excluido.
    expect(isExcluded('nvidia/nv-embed-v1')).toBe(true);
    expect(isExcluded('openai/whisper-large')).toBe(true);
  });

  it('nvidia (def con endpoint): si featured-models falla (no-ok), usa orden alfabético', async () => {
    const def = { ...PROVIDERS.nvidia, modelsEndpoint: 'https://nim/models' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'b-model' }, { id: 'a-model' }] }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) }); // featured no-ok
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(def, 'nvapi_test');
    // Sin featured → orden alfabético
    expect(list!.map(m => m.value)).toEqual(['a-model', 'b-model']);
  });

  it('openzen (def con endpoint): filtra solo modelos con sufijo -free', async () => {
    const def = { ...PROVIDERS.openzen, modelsEndpoint: 'https://openzen/models' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [
        { id: 'ling-3.0-flash-free' },
        { id: 'nemotron-3-ultra-free' },
        { id: 'paid-model' }, // sin -free → excluido
      ] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(def);
    const ids = list!.map(m => m.value);
    expect(ids).toEqual(['ling-3.0-flash-free', 'nemotron-3-ultra-free']);
    expect(list!.every(m => m.free === true)).toBe(true);
  });

  it('cloudflare (def con endpoint): parsea el wrapper {result:[...]} y exige accountId', async () => {
    const def = { ...PROVIDERS.cloudflare, modelsEndpoint: 'https://cf/{account_id}/models' };
    // Sin accountId → null (guard de {account_id})
    expect(await fetchModels(def, 'token', null)).toBeNull();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: [
        { name: '@cf/meta/llama-3.3-70b-instruct' },
        { name: '@cf/meta/llama-4-scout' },
        { description: 'sin name' }, // sin name → filtrado
      ] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(def, 'token', 'ACC');
    // Ordenado por name; el sin-name queda fuera
    expect(list!.map(m => m.value)).toEqual(['@cf/meta/llama-3.3-70b-instruct', '@cf/meta/llama-4-scout']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cloudflare (def con endpoint): cae a data.data si no hay wrapper result', async () => {
    const def = { ...PROVIDERS.cloudflare, modelsEndpoint: 'https://cf/{account_id}/models' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ name: '@cf/x/y' }] }), // formato data.data alternativo
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(def, 'token', 'ACC');
    expect(list!.map(m => m.value)).toEqual(['@cf/x/y']);
  });

  it('aiand: input_per_1m y output_per_1m ambos undefined → free', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [
        // pricing presente pero ambas claves undefined → free
        { id: 'both-undef', display_name: 'BothUndef', pricing: {} },
      ] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(PROVIDERS.aiand, 'sk-test');
    expect(list!.find(m => m.value === 'both-undef')!.free).toBe(true);
  });

  it('lanza "models endpoint error" si la respuesta no es ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchModels(PROVIDERS.openrouter, 'sk')).rejects.toThrow('models endpoint error 500');
  });

  it('lanza "empty catalog" si el catálogo dinámico queda vacío tras filtrar', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'whisper-large' }] }), // todos excluidos → vacío
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchModels(PROVIDERS.groq, 'gsk_test')).rejects.toThrow('empty catalog');
  });

  it('qwencloud (fetchModels): filtra no-chat (embed, whisper, tts...) y marca free', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'qwen3.7-flash', name: 'Qwen 3.7 Flash' },
          { id: 'qwen3-embed', name: 'Qwen Embed' }, // excluido
          { id: 'qwen3.7-plus', name: 'Qwen 3.7 Plus' },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(PROVIDERS.qwencloud, 'sk-test');
    expect(list).toBeDefined();
    expect(list!.length).toBe(2);
    expect(list!.map(m => m.value)).toEqual(['qwen3.7-flash', 'qwen3.7-plus']);
    expect(list!.every(m => m.free === true)).toBe(true);
  });
});

describe('resolveEndpoint', () => {
  it('sustituye {account_id} por el valor real (encoded)', () => {
    expect(resolveEndpoint('https://x/{account_id}/y', 'a/b c')).toBe('https://x/a%2Fb%20c/y');
  });
  it('deja la URL igual si no hay accountId o no hay marcador', () => {
    expect(resolveEndpoint('https://x/y', 'acc')).toBe('https://x/y');
    expect(resolveEndpoint('https://x/{account_id}/y')).toBe('https://x/{account_id}/y');
  });
});

describe('modelLabel (v3.31.0)', () => {
  it('devuelve la .label legible si el modelo está en el catálogo y NO es clave i18n', () => {
    // openai/gpt-oss-20b está en GROQ_FALLBACK con label literal "GPT-OSS 20B (fast)".
    expect(modelLabel('groq', 'openai/gpt-oss-20b')).toBe('GPT-OSS 20B (fast)');
  });

  it('cae al value si la label es una clave i18n (contiene un punto)', () => {
    // gemini-2.5-flash tiene label "provider.gemini.model.recommended" → clave i18n.
    expect(modelLabel('gemini', 'gemini-2.5-flash')).toBe('gemini-2.5-flash');
  });

  it('devuelve el value tal cual si el modelo NO está en el catálogo (dinámico/desconocido)', () => {
    expect(modelLabel('groq', 'openai/gpt-oss-120b:free')).toBe('openai/gpt-oss-120b:free');
    expect(modelLabel('openrouter', 'algún/modelo:free')).toBe('algún/modelo:free');
  });

  it('nvidia: devuelve label legible para modelos en fallback (Nemotron, GLM, DeepSeek...)', () => {
    expect(modelLabel('nvidia', 'nvidia/nemotron-3-ultra-550b-a55b')).toBe('Nemotron 3 Ultra ⭐');
    expect(modelLabel('nvidia', 'z-ai/glm-5.2')).toBe('GLM 5.2');
    expect(modelLabel('nvidia', 'deepseek-ai/deepseek-v4-pro')).toBe('DeepSeek V4 Pro');
    // Modelo dinámico no en fallback → value tal cual
    expect(modelLabel('nvidia', 'nuevo/modelo-dinamico')).toBe('nuevo/modelo-dinamico');
  });

  it('zenmux: devuelve label legible para modelos free en fallback', () => {
    expect(modelLabel('zenmux', 'inclusionai/ling-3.0-flash')).toBe('Ling 3.0 Flash');
    expect(modelLabel('zenmux', 'z-ai/glm-4.7-flash-free')).toBe('GLM 4.7 Flash');
    expect(modelLabel('zenmux', 'z-ai/glm-4.6v-flash-free')).toBe('GLM 4.6V Flash');
    // Modelo dinámico no en fallback → value tal cual
    expect(modelLabel('zenmux', 'nuevo/modelo-zenmux')).toBe('nuevo/modelo-zenmux');
  });
});
