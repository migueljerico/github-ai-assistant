import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PROVIDERS, getProvider, fetchModels, isResponsesModel, pickDefaultModel, modelLabel, resolveEndpoint, NIM_EXCLUDED, GROQ_FALLBACK, GROQ_DEPRECATED, type ModelOption } from '../providers';

describe('providers — registro', () => {
  it('los proveedores tienen su defaultModel dentro de staticModels', () => {
    (['gemini', 'groq', 'openrouter', 'nvidia', 'zenmux', 'openzen', 'cloudflare', 'ollama', 'kilo', 'bazaarlink', 'qwencloud'] as const).forEach(id => {
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
    expect(def.defaultModel).toBe('qwen/qwen3.7-flash:free');
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
    // v4.0.49: retirados qwen-turbo, qwen3-coder-480b-a35b-instruct y deepseek-v4-flash;
    // entran qwen3.8-flash y deepseek-v4.1-flash (verificados en qwencloud.com/models)
    expect(def.staticModels.some(m => m.value === 'qwen3.8-flash')).toBe(true);
    expect(def.staticModels.some(m => m.value === 'deepseek-v4.1-flash')).toBe(true);
    expect(def.staticModels.some(m => m.value === 'qwen-turbo')).toBe(false);
    expect(def.staticModels.every(m => m.free === true)).toBe(true);
    expect(def.staticModels.length).toBe(12);
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
    expect(PROVIDERS.nvidia.modelsEndpoint).toBe('/api/nim/models');
    // OpenCode Zen: proxy /api/openzen (CORS de opencode.ai), catálogo dinámico (v4.0.28)
    expect(PROVIDERS.openzen.transport).toBe('openai-compatible');
    expect(PROVIDERS.openzen.chatEndpoint).toBe('/api/openzen');
    expect(PROVIDERS.openzen.modelsEndpoint).toBe('/api/openzen/models');
    // Cloudflare: proxy /api/cloudflare (CORS de Cloudflare), catálogo dinámico vía proxy
    expect(PROVIDERS.cloudflare.transport).toBe('openai-compatible');
    expect(PROVIDERS.cloudflare.chatEndpoint).toBe('/api/cloudflare');
    expect(PROVIDERS.cloudflare.modelsEndpoint).toBe('/api/cloudflare/models');
    expect(PROVIDERS.cloudflare.modelsNeedKey).toBe(true);
  });

  it('gemini incluye el flagship gemini-4-argon y gemini-3.8-flash; retirados 3.7/3.5 (v4.0.49)', () => {
    expect(PROVIDERS.gemini.staticModels.some(m => m.value === 'gemini-3-flash-preview')).toBe(true);
    const m4 = PROVIDERS.gemini.staticModels.find(m => m.value === 'gemini-4-argon');
    expect(m4).toBeDefined();
    expect(m4?.label).toBe('provider.gemini.model.argon4');
    expect(m4?.description).toBe('provider.gemini.model.argon4Desc');
    const m38 = PROVIDERS.gemini.staticModels.find(m => m.value === 'gemini-3.8-flash');
    expect(m38).toBeDefined();
    expect(m38?.label).toBe('provider.gemini.model.flash38');
    expect(m38?.description).toBe('provider.gemini.model.flash38Desc');
    // Deprecados el 2026-10-08 (redirigen a 3.6/3.8): fuera del catálogo
    expect(PROVIDERS.gemini.staticModels.some(m => m.value === 'gemini-3.7-flash')).toBe(false);
    expect(PROVIDERS.gemini.staticModels.some(m => m.value === 'gemini-3.5-flash')).toBe(false);
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
    // v4.0.49: ling-3.0-flash-fin:free y step-3.7-flash:free retirados de Kilo;
    // el default pasa a Step 5 Preview (free, verificado en vivo 2026-10-14)
    expect(def.defaultModel).toBe('stepfun/step-5-preview-free');
    // La API key de Kilo es un JWT (HS256): empieza por "eyJ"
    expect(def.keyPrefix).toBe('eyJ');
    // Los 6 modelos free del fallback llevan flag free (render 🆓)
    expect(def.staticModels.every(m => m.free === true)).toBe(true);
    expect(def.staticModels.length).toBe(6);
  });

  it('openzen: fallback verificado en vivo 2026-10-14 — deepseek-v4.1/mimo-v2.6/step-5/cat-jam; retirados los 4 ids muertos (v4.0.49)', () => {
    const def = PROVIDERS.openzen;
    // big-pickle es la excepción sin sufijo -free
    expect(def.staticModels.some(m => m.value === 'big-pickle')).toBe(true);
    // Muse Spark (familia /responses): verificados en vivo
    expect(def.staticModels.some(m => m.value === 'muse-spark-1.3-contributor-free')).toBe(true);
    expect(def.staticModels.find(m => m.value === 'muse-spark-1.3-contributor-free')?.free).toBe(true);
    expect(def.staticModels.some(m => m.value === 'muse-spark-1.2-contributor-free')).toBe(true);
    expect(def.staticModels.find(m => m.value === 'muse-spark-1.2-contributor-free')?.free).toBe(true);
    // Sustitutos nuevos en el catálogo en vivo (GET /zen/v1/models, 86 modelos)
    expect(def.staticModels.some(m => m.value === 'deepseek-v4.1-flash-free')).toBe(true);
    expect(def.staticModels.some(m => m.value === 'mimo-v2.6-flash-free')).toBe(true);
    expect(def.staticModels.some(m => m.value === 'step-5-preview-free')).toBe(true);
    expect(def.staticModels.some(m => m.value === 'cat-jam-free')).toBe(true);
    // Retirados: la API ya no los sirve (v4.0.49)
    expect(def.staticModels.some(m => m.value === 'deepseek-v4-flash-free')).toBe(false);
    expect(def.staticModels.some(m => m.value === 'mimo-v2.5-free')).toBe(false);
    expect(def.staticModels.some(m => m.value === 'ling-3.0-flash-fin-free')).toBe(false);
    expect(def.staticModels.some(m => m.value === 'nemotron-3-ultra-free')).toBe(false);
    expect(def.staticModels.some(m => m.value === 'laguna-s-2.1-free')).toBe(false);
    // Total: 8 modelos en el fallback
    expect(def.staticModels.length).toBe(8);
    // Todos marcados como free
    expect(def.staticModels.every(m => m.free === true)).toBe(true);
  });

  it('nvidia NIM: fallback verificado — DeepSeek V4.1 Flash (NGC featured); retirados 9 ids muertos (v4.0.47/v4.0.49)', () => {
    const def = PROVIDERS.nvidia;
    // Nemotron 3 Ultra: default, confirmado en integrate.api.nvidia.com/v1/models
    expect(def.staticModels.some(m => m.value === 'nvidia/nemotron-3-ultra-550b-a55b')).toBe(true);
    // DeepSeek V4: los ids sin fecha fueron retirados; v4.0.49 sustituye la variante
    // flash 0731 por deepseek-v4.1-flash (feed NGC featured-models)
    expect(def.staticModels.some(m => m.value === 'deepseek-ai/deepseek-v4-pro-0813')).toBe(true);
    expect(def.staticModels.some(m => m.value === 'deepseek-ai/deepseek-v4.1-flash')).toBe(true);
    expect(def.staticModels.some(m => m.value === 'deepseek-ai/deepseek-v4-flash-0731')).toBe(false);
    expect(def.staticModels.some(m => m.value === 'deepseek-ai/deepseek-v4-pro')).toBe(false);
    expect(def.staticModels.some(m => m.value === 'deepseek-ai/deepseek-v4-flash')).toBe(false);
    // Nemotron 3.5 Lightning y Muse Glimmer: siguen en la API real
    expect(def.staticModels.some(m => m.value === 'nvidia/nemotron-3.5-lightning-30b-a3b')).toBe(true);
    expect(def.staticModels.some(m => m.value === 'meta/muse-glimmer-30b')).toBe(true);
    // Kimi K3: nuevo en la API real (v4.0.47)
    expect(def.staticModels.some(m => m.value === 'moonshotai/kimi-k3')).toBe(true);
    // Retirados de NIM (v4.0.47): ya no aparecen en integrate.api.nvidia.com/v1/models
    expect(def.staticModels.some(m => m.value === 'nvidia/llama-3.3-nemotron-super-49b-v1')).toBe(false);
    expect(def.staticModels.some(m => m.value === 'nvidia/nemotron-3-nano-30b-a3b')).toBe(false);
    expect(def.staticModels.some(m => m.value === 'z-ai/glm-5.2')).toBe(false);
    expect(def.staticModels.some(m => m.value === 'stepfun-ai/step-3.7-flash')).toBe(false);
    expect(def.staticModels.some(m => m.value === 'openai/gpt-oss-120b')).toBe(false);
    expect(def.staticModels.some(m => m.value === 'meta/llama-3.3-70b-instruct')).toBe(false);
    expect(def.staticModels.some(m => m.value === 'mistralai/mistral-medium-3.5-128b')).toBe(false);
    // qwen3-next-80b-a3b-instruct: ID que no existe en la API real → eliminado del fallback
    expect(def.staticModels.some(m => m.value === 'qwen/qwen3-next-80b-a3b-instruct')).toBe(false);
  });

  it('auditoría de catálogos en vivo (v4.0.49): defaults y fallbacks sin modelos retirados de las APIs', () => {
    // OpenRouter: gpt-oss-20b:free y ling-3.0-flash:free fueron retirados (2026-09-05);
    // en v4.0.49 caen también glm-5.2:free, minimax-m3:free y ling-3.0-flash-fin:free
    // (verificación en vivo 2026-10-14: 14 free, sin variantes :free de esos modelos).
    // El default sigue en Gemma 4 26B, el mismo que elige pickDefaultModel sobre el
    // catálogo dinámico actual (RELIABLE_MODEL_PREFS: no hay gpt-oss free → 'gemma').
    expect(PROVIDERS.openrouter.defaultModel).toBe('google/gemma-4-26b-a4b-it:free');
    const orValues = PROVIDERS.openrouter.staticModels.map(m => m.value);
    expect(orValues).not.toContain('openai/gpt-oss-20b:free');
    expect(orValues).not.toContain('inclusionai/ling-3.0-flash:free');
    expect(orValues).not.toContain('z-ai/glm-5.2:free');
    expect(orValues).not.toContain('minimax/minimax-m3:free');
    expect(orValues).not.toContain('inclusionai/ling-3.0-flash-fin:free');
    expect(orValues).toContain('thinkingmachines/inkling:free');
    expect(orValues).toContain('nvidia/nemotron-3.5-lightning:free');
    expect(orValues).toContain('poolside/laguna-xs-2.1:free');
    // Zenmux: deepseek-v4-flash-free (default anterior) y agnes-2.0-flash retirados;
    // el DeepSeek V4 Flash sigue en Zenmux pero de pago (pricing 0.66 $/M).
    expect(PROVIDERS.zenmux.defaultModel).toBe('sapiens-ai/agnes-2.5-flash');
    const zmValues = PROVIDERS.zenmux.staticModels.map(m => m.value);
    expect(zmValues).not.toContain('deepseek/deepseek-v4-flash-free');
    expect(zmValues).not.toContain('sapiens-ai/agnes-2.0-flash');
    // Ollama (v4.0.49, verificado en vivo 2026-10-14: 18 modelos): glm-5.1, qwen3.5:397b
    // y deepseek-v4-flash:0731 retirados; entran glm-5.3[-flash], mistral-large-4 y
    // deepseek-v4.1-flash.
    const olValues = PROVIDERS.ollama.staticModels.map(m => m.value);
    expect(olValues).not.toContain('minimax-m2.5');
    expect(olValues).not.toContain('kimi-k2.5');
    expect(olValues).not.toContain('glm-5.1');
    expect(olValues).not.toContain('qwen3.5:397b');
    expect(olValues).not.toContain('deepseek-v4-flash:0731');
    expect(olValues).toContain('deepseek-v4-pro:0813');
    expect(olValues).toContain('deepseek-v4.1-flash');
    expect(olValues).toContain('glm-5.3');
    expect(olValues).toContain('mistral-large-4');
    // BazaarLink: deepseek/deepseek-v4-flash:free retirado (el modelo sigue, de pago y sin prefijo).
    const blValues = PROVIDERS.bazaarlink.staticModels.map(m => m.value);
    expect(blValues).not.toContain('deepseek/deepseek-v4-flash:free');
    expect(blValues).toEqual(['qwen/qwen3.7-flash:free', 'auto:free']);
  });

  it('nvidia NIM: catálogo DINÁMICO habilitado — modelsEndpoint apunta al proxy /api/nim/models (v4.0.28)', () => {
    const def = PROVIDERS.nvidia;
    // Catálogo dinámico: modelsEndpoint configurado (antes era estático sin endpoint)
    expect(def.modelsEndpoint).toBe('/api/nim/models');
    // Requiere key para consultar el catálogo (nvapi-...)
    expect(def.modelsNeedKey).toBe(true);
    // chatEndpoint sigue siendo el proxy (CORS)
    expect(def.chatEndpoint).toBe('/api/nim');
  });

  it('openzen: enrutado a /responses para muse-spark/gpt/grok; chat clásico para el resto (v4.0.45)', () => {
    const def = PROVIDERS.openzen;
    expect(def.responsesEndpoint).toBe('/api/openzen/responses');
    // Familias Responses (prefijo, insensible a mayúsculas; cubre -free y versiones)
    expect(isResponsesModel(def, 'muse-spark-1.3-contributor-free')).toBe(true);
    expect(isResponsesModel(def, 'muse-spark-1.2-contributor-free')).toBe(true);
    expect(isResponsesModel(def, 'MUSE-SPARK-1.2')).toBe(true);
    expect(isResponsesModel(def, 'gpt-5.4-mini')).toBe(true);
    expect(isResponsesModel(def, 'gpt-5.5')).toBe(true);
    expect(isResponsesModel(def, 'grok-4.5')).toBe(true);
    expect(isResponsesModel(def, 'grok-build-0.1')).toBe(true);
    // Chat clásico: resto de familias
    expect(isResponsesModel(def, 'deepseek-v4.1-flash-free')).toBe(false);
    expect(isResponsesModel(def, 'big-pickle')).toBe(false);
    expect(isResponsesModel(def, 'mimo-v2.6-flash-free')).toBe(false);
    expect(isResponsesModel(def, 'cat-jam-free')).toBe(false);
    expect(isResponsesModel(def, '')).toBe(false);
    // Sin responsesEndpoint configurado: nunca enruta (p. ej. Groq)
    expect(isResponsesModel(PROVIDERS.groq, 'gpt-oss-20b')).toBe(false);
  });

  it('openzen: reasoningEffort minimal para no agotar el presupuesto con el think interno (v4.0.46)', () => {
    expect(PROVIDERS.openzen.reasoningEffort).toBe('minimal');
    // El resto de proveedores no define effort (no se envía el campo)
    expect(PROVIDERS.groq.reasoningEffort).toBeUndefined();
    expect(PROVIDERS.gemini.reasoningEffort).toBeUndefined();
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

  it('prefiere GPT-OSS sobre Qwen cuando ambos están disponibles (Groq)', () => {
    // GPT-OSS 20B (producción activo) debe tener prioridad sobre modelos bloqueados a nivel de proyecto (Qwen)
    const list = [paid('qwen/qwen3.8-27b'), paid('openai/gpt-oss-20b')];
    expect(pickDefaultModel(list)).toBe('openai/gpt-oss-20b');
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
    // El catálogo fijo tiene los 15 modelos operativos a día de hoy (v4.0.49).
    const values = PROVIDERS.gemini.staticModels.map(m => m.value);
    expect(values).toEqual([
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-4-argon',
      'gemma-4-26b-a4b-it',
      'gemma-4-31b-it',
      'gemini-flash-latest',
      'gemini-flash-lite-latest',
      'gemini-pro-latest',
      'gemini-2.5-flash-lite',
      'gemini-3-flash-preview',
      'gemini-3.1-pro-preview',
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.8-flash',
    ]);
  });

  it('gemini sin key devuelve null (no hay endpoint dinámico)', async () => {
    expect(await fetchModels(PROVIDERS.gemini)).toBeNull();
  });

  it('gemini (def con modelosEndpoint manual): filtra GEMINI_EXCLUDED y ordena alfabético (rama dinámica #58)', async () => {
    sessionStorage.clear();
    const def = { ...PROVIDERS.gemini, modelsEndpoint: 'https://proxy.example/api/gemini/models', modelsNeedKey: false };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
        { id: 'gemini-2.0-flash-vision', name: 'Vision (excluded)' },   // GEMINI_EXCLUDED
        { id: 'text-embedding-004', name: 'Embed (excluded)' },         // GEMINI_EXCLUDED
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      ] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(def, undefined);

    // El backend ya filtra los no-generativos; el cliente repite el filtro
    // en profundidad y ordena por id (v3.23.0).
    const ids = list!.map(m => m.value);
    expect(ids).toEqual(['gemini-2.5-flash', 'gemini-2.5-pro']);
    expect(list![0].label).toBe('Gemini 2.5 Flash');
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

  it('nvidia NIM: catálogo DINÁMICO — fetchModels invoca /api/nim/models con key (v4.0.28)', async () => {
    // v4.0.28: NVIDIA ahora tiene modelsEndpoint habilitado (/api/nim/models).
    // Con key, fetchModels llama al proxy y devuelve el catálogo filtrado con NIM_EXCLUDED.
    const mockModels = [
      { id: 'nvidia/nemotron-3-ultra-550b-a55b', name: 'Nemotron 3 Ultra' },
      { id: 'nvidia/nemotron-3.5-lightning-30b-a3b', name: 'Nemotron 3.5 Lightning' },
      { id: 'meta/muse-glimmer-30b', name: 'Muse Glimmer 30B' },
      { id: 'nvidia/embed-model', name: 'Embed (excluded)' },       // excluido por NIM_EXCLUDED
      { id: 'nvidia/rerank-model', name: 'Rerank (excluded)' },     // excluido por NIM_EXCLUDED
    ];
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockModels }),
    }).mockResolvedValueOnce({
      // Segunda llamada: featured-models.json (best-effort, puede fallar)
      ok: false,
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(PROVIDERS.nvidia, 'nvapi-test');
    expect(list).not.toBeNull();
    // Chat Nemotron filtrado correctamente
    expect(list!.some(m => m.value === 'nvidia/nemotron-3-ultra-550b-a55b')).toBe(true);
    expect(list!.some(m => m.value === 'nvidia/nemotron-3.5-lightning-30b-a3b')).toBe(true);
    expect(list!.some(m => m.value === 'meta/muse-glimmer-30b')).toBe(true);
    // No-chat excluidos por NIM_EXCLUDED
    expect(list!.some(m => m.value === 'nvidia/embed-model')).toBe(false);
    expect(list!.some(m => m.value === 'nvidia/rerank-model')).toBe(false);
    // Sin key: devuelve null (modelsNeedKey: true)
    vi.stubGlobal('fetch', vi.fn());
    expect(await fetchModels(PROVIDERS.nvidia, '')).toBeNull();
    expect(await fetchModels(PROVIDERS.nvidia, undefined)).toBeNull();
  });

  it('nvidia NIM: fallback estático tiene 13 modelos verificados (v4.0.47/v4.0.49)', () => {
    // El NIM_FALLBACK es la red de seguridad cuando el catálogo dinámico no está disponible.
    const values = PROVIDERS.nvidia.staticModels.map(m => m.value);
    expect(values).toContain('nvidia/nemotron-3-ultra-550b-a55b');
    // v4.0.47: DeepSeek V4 con sufijo de fecha y Kimi K3 (ids vivos en la API real);
    // v4.0.49: la variante flash 0731 se sustituye por deepseek-v4.1-flash (NGC featured)
    expect(values).toContain('deepseek-ai/deepseek-v4-pro-0813');
    expect(values).toContain('deepseek-ai/deepseek-v4.1-flash');
    expect(values).not.toContain('deepseek-ai/deepseek-v4-flash-0731');
    expect(values).toContain('moonshotai/kimi-k3');
    // Nuevos (2026-08-12), confirmados también en la verificación de 2026-09-05
    expect(values).toContain('nvidia/nemotron-3.5-lightning-30b-a3b');
    expect(values).toContain('meta/muse-glimmer-30b');
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

  it('openzen: catálogo DINÁMICO vía /api/openzen/models — filtra sufijo -free y big-pickle (v4.0.28)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'big-pickle', object: 'model' },
          { id: 'mimo-v2.6-flash-free', object: 'model' },
          { id: 'muse-spark-1.3-contributor-free', object: 'model' },
          { id: 'muse-spark-1.2-contributor-free', object: 'model' },
          { id: 'step-5-preview-free', object: 'model' },
          { id: 'cat-jam-free', object: 'model' },
          { id: 'nemotron-3.5-lightning-free', object: 'model' },
          { id: 'deepseek-v4.1-flash-free', object: 'model' },
          { id: 'deepseek-v4-pro', object: 'model' },   // pago — excluido
          { id: 'gpt-5.5', object: 'model' },            // pago — excluido
          { id: 'kimi-k3', object: 'model' },            // pago — excluido
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(PROVIDERS.openzen, 'sk-test-key');
    expect(list).not.toBeNull();
    const ids = list!.map(m => m.value);
    // Solo modelos -free o big-pickle
    expect(ids).toContain('big-pickle');
    expect(ids).toContain('muse-spark-1.3-contributor-free');
    expect(ids).toContain('muse-spark-1.2-contributor-free');
    expect(ids).toContain('mimo-v2.6-flash-free');
    expect(ids).toContain('nemotron-3.5-lightning-free');
    expect(ids).toContain('deepseek-v4.1-flash-free');
    expect(ids).toContain('step-5-preview-free');
    // Modelos de pago excluidos
    expect(ids).not.toContain('deepseek-v4-pro');
    expect(ids).not.toContain('gpt-5.5');
    expect(ids).not.toContain('kimi-k3');
    // Todos marcados como free
    expect(list!.every(m => m.free)).toBe(true);
    // OPENZEN_FALLBACK es la red de seguridad (8 modelos desde v4.0.49, sin laguna-s-2.1-free)
    expect(PROVIDERS.openzen.staticModels.length).toBe(8);
    expect(PROVIDERS.openzen.staticModels.every(m => m.free)).toBe(true);
    // Sin key: devuelve null (modelsNeedKey: true)
    expect(await fetchModels(PROVIDERS.openzen, '')).toBeNull();
    expect(await fetchModels(PROVIDERS.openzen, undefined)).toBeNull();
  });

  it('cloudflare: devuelve null sin accountId (exige X-Account-Id aunque el endpoint no lleve {account_id})', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    // Sin accountId, fetchModels devuelve null (no hace fetch); el panel usa staticModels.
    expect(await fetchModels(PROVIDERS.cloudflare, 'token_test', null)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cloudflare: catálogo estático (CLOUDFLARE_FALLBACK) sin modelos no-Free y recommended Qwen3', () => {
    // Catálogo estático = red de seguridad. Los modelos no-Free (kimi-k2.6,
    // kimi-k2.7-code, glm-5.2/glm-5.3, deepseek-v4-*) están excluidos; v4.0.49 añade
    // Qwen 3.8 27B y GLM 4.7 Flash (tarifa 2026-10-09); el recommended es Qwen3 30B.
    const values = PROVIDERS.cloudflare.staticModels.map(m => m.value);
    expect(values).toEqual([
      '@cf/qwen/qwen3-30b-a3b-fp8',
      '@cf/qwen/qwen3.8-27b',
      '@cf/zai-org/glm-4.7-flash',
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
    expect(values).not.toContain('@cf/zai-org/glm-5.3-flash');
    expect(values).not.toContain('@cf/deepseek-ai/deepseek-v4-pro-0813');
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
        { id: 'step-5-preview-free' },
        { id: 'cat-jam-free' },
        { id: 'paid-model' }, // sin -free → excluido
      ] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(def, 'sk-test-key');
    const ids = list!.map(m => m.value);
    expect(ids).toEqual(['cat-jam-free', 'step-5-preview-free']);
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

  it('qwencloud (fetchModels): filtra no-chat (embed, whisper, tts...) y distingue modelos free (Qwen/DeepSeek) de pago (GLM 5.2)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'qwen3.7-flash', name: 'Qwen 3.7 Flash' },
          { id: 'qwen3-embed', name: 'Qwen Embed' }, // excluido
          { id: 'glm-5.2-fast-preview', name: 'GLM 5.2 Fast Preview' }, // comercial de pago -> free: false
          { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' }, // free: true
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(PROVIDERS.qwencloud, 'sk-test');
    expect(list).toBeDefined();
    expect(list!.length).toBe(3);
    // Gratis primero (qwen3.7-flash, deepseek-v4-flash), luego de pago (glm-5.2-fast-preview)
    const qwenModel = list!.find(m => m.value === 'qwen3.7-flash');
    const deepseekModel = list!.find(m => m.value === 'deepseek-v4-flash');
    const glmModel = list!.find(m => m.value === 'glm-5.2-fast-preview');
    expect(qwenModel?.free).toBe(true);
    expect(deepseekModel?.free).toBe(true);
    expect(glmModel?.free).toBe(false);
  });

  it('zenmux (fetchModels): marca free cuando el objeto pricing/pricings tiene valores 0, propiedad price, o sufijo -free', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'model-nopricing' }, // sin objeto pricing -> free = false
          { id: 'model-emptyprices', pricing: {} }, // objeto pricing presente pero vacío -> free = true
          { id: 'sapiens-ai/agnes-2.5-flash', display_name: 'Agnes 2.5', pricings: { completion: [{ value: 0 }], prompt: [{ value: 0 }] } }, // pricings en plural
          { id: 'model-price-property', pricing: { prompt: [{ price: '0' }] } }, // propiedad price
          { id: 'model-paid-free', pricing: { prompt: [{ value: 10 }] } }, // de pago por pricing pero id termina en -free
          { id: 'model-standalone-free' }, // id termina en -free sin pricing
        ],
      }),
    }));
    const list = await fetchModels(PROVIDERS.zenmux, 'sk-test');
    expect(list).toHaveLength(6);
    expect(list!.find(m => m.value === 'model-nopricing')!.free).toBe(false);
    expect(list!.find(m => m.value === 'model-emptyprices')!.free).toBe(true);
    expect(list!.find(m => m.value === 'sapiens-ai/agnes-2.5-flash')!.free).toBe(true);
    expect(list!.find(m => m.value === 'model-price-property')!.free).toBe(true);
    expect(list!.find(m => m.value === 'model-paid-free')!.free).toBe(true);
    expect(list!.find(m => m.value === 'model-standalone-free')!.free).toBe(true);
  });

  it('fetchModels groq ordena alfabéticamente y descarta deprecados', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'llama-3.3-70b-versatile' }, // deprecado -> filtrado
          { id: 'llama-3.3-70b-specdec' },
          { id: 'llama3-70b-8192' },
        ],
      }),
    }));
    const list = await fetchModels(PROVIDERS.groq, 'gsk-key');
    expect(list).toBeDefined();
    expect(list!.map(m => m.value)).toEqual(expect.arrayContaining(['llama-3.3-70b-specdec', 'llama3-70b-8192']));
  });

  it('fetchModels: cae a m.id cuando un modelo en el catálogo dinámico no tiene la propiedad name', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'llama-3.3-70b-specdec' }, // sin name
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(PROVIDERS.groq, 'gsk-test');
    expect(list).toBeDefined();
    expect(list!).toHaveLength(1);
    expect(list![0].label).toBe('llama-3.3-70b-specdec');
  });


  it('nvidia (fetchModels): ordena por tiebreaker alfabético cuando dos modelos comparten la misma prioridad featured', async () => {
    const def = { ...PROVIDERS.nvidia, modelsEndpoint: 'https://nim/models' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [
        { id: 'nvidia/b-model-featured', name: 'B Model' },
        { id: 'nvidia/a-model-featured', name: 'A Model' },
      ] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ 'featured-models': [
        { model: 'nvidia/b-model-featured' },
        { model: 'nvidia/a-model-featured' },
      ] }) });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(def, 'key');
    expect(list!.map(m => m.value)).toEqual(['nvidia/a-model-featured', 'nvidia/b-model-featured']);
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

  it('nvidia: devuelve label legible para modelos en fallback (Nemotron, Kimi, DeepSeek...)', () => {
    expect(modelLabel('nvidia', 'nvidia/nemotron-3-ultra-550b-a55b')).toBe('Nemotron 3 Ultra ⭐');
    expect(modelLabel('nvidia', 'moonshotai/kimi-k3')).toBe('Kimi K3');
    expect(modelLabel('nvidia', 'deepseek-ai/deepseek-v4-pro-0813')).toBe('DeepSeek V4 Pro');
    // Modelo dinámico no en fallback → value tal cual
    expect(modelLabel('nvidia', 'nuevo/modelo-dinamico')).toBe('nuevo/modelo-dinamico');
  });

  it('zenmux: devuelve label legible para modelos free en fallback', () => {
    expect(modelLabel('zenmux', 'sapiens-ai/agnes-2.5-flash')).toBe('Agnes 2.5 Flash');
    expect(modelLabel('zenmux', 'z-ai/glm-4.7-flash-free')).toBe('GLM 4.7 Flash');
    expect(modelLabel('zenmux', 'z-ai/glm-4.6v-flash-free')).toBe('GLM 4.6V Flash');
    // Modelo dinámico no en fallback → value tal cual
    expect(modelLabel('zenmux', 'nuevo/modelo-zenmux')).toBe('nuevo/modelo-zenmux');
  });
});

// ── Expansión de cobertura (#26) — ramas de fetchModels sin testear ───────────

describe('providers — fetchModels (ramas de deduplicación y detección free)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('openrouter: modelo sin objeto pricing y sin sufijo :free → free: false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'meta/no-pricing-model', name: 'Sin pricing' },   // sin pricing → no free
          { id: 'meta/zero', name: 'Zero', pricing: { prompt: '0', completion: '0' } }, // free por pricing
        ],
      }),
    }));

    const list = await fetchModels(PROVIDERS.openrouter);
    expect(list!.find(m => m.value === 'meta/no-pricing-model')!.free).toBe(false);
    expect(list!.find(m => m.value === 'meta/zero')!.free).toBe(true);
  });

  it('bazaarlink: ids duplicados en el catálogo se deduplican (queda la 1ª aparición)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'dup/model:free', display_name: 'Primera aparición' },
          { id: 'dup/model:free', display_name: 'Segunda aparición' },
          { id: 'otro/model:free', display_name: 'Otro' },
        ],
      }),
    }));

    const list = await fetchModels(PROVIDERS.bazaarlink);
    const dup = list!.filter(m => m.value === 'dup/model:free');
    expect(dup).toHaveLength(1);
    expect(dup[0].label).toBe('Primera aparición');
    expect(list!.find(m => m.value === 'otro/model:free')).toBeDefined();
  });

  it('qwencloud: id con sufijo -free marca free aunque el patrón pago aparezca antes, y deduplica ids', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          // -free gana sobre el patrón de pago (glm-) del mismo id
          { id: 'glm-5.2-flash-free', name: 'GLM Free' },
          { id: 'glm-5.2-flash-free', name: 'Duplicado' },
          { id: 'minimax-m2', name: 'Minimax M2' }, // pago, sin -free
        ],
      }),
    }));

    const list = await fetchModels(PROVIDERS.qwencloud, 'sk-test');
    const glm = list!.filter(m => m.value === 'glm-5.2-flash-free');
    expect(glm).toHaveLength(1);
    expect(glm[0].free).toBe(true);
    expect(list!.find(m => m.value === 'minimax-m2')!.free).toBe(false);
  });
});

// ── Ramas restantes de fetchModels (v4.0.52, #26) ─────────────────────────────
describe('providers — fetchModels ramas restantes (v4.0.52 #26)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('isFreeOpenRouterModel (formato strings): todas las combinaciones 0 / 0.0 → free', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          // prompt '0' + completion '0.0' (lado 0.0 del completion)
          { id: 'str/completion-0dot0', pricing: { prompt: '0', completion: '0.0' } },
          // prompt '0.0' (lado 0.0 del prompt) + completion '0'
          { id: 'str/prompt-0dot0', pricing: { prompt: '0.0', completion: '0' } },
          // ambos 0.0
          { id: 'str/both-0dot0', pricing: { prompt: '0.0', completion: '0.0' } },
        ],
      }),
    }));

    const list = await fetchModels(PROVIDERS.openrouter);
    expect(list).toHaveLength(3);
    // Además: los tres items sin `name` → label m.id (rama del || en el mapa).
    expect(list!.every(m => m.free)).toBe(true);
    expect(list!.map(m => m.label)).toEqual(['str/both-0dot0', 'str/completion-0dot0', 'str/prompt-0dot0']);
  });

  it('isFreeOpenRouterModel (formato array): prompt o completion ausentes usan [] en el spread', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          // solo prompt (completion undefined → ~[] en el spread) → free
          { id: 'arr/prompt-only', pricing: { prompt: [{ value: 0 }] } },
          // solo completion (prompt undefined → ~[]) con precio > 0 → paid
          { id: 'arr/completion-only', pricing: { completion: [{ value: 0.5 }] } },
        ],
      }),
    }));

    const list = await fetchModels(PROVIDERS.openrouter);
    expect(list!.find(m => m.value === 'arr/prompt-only')!.free).toBe(true);
    expect(list!.find(m => m.value === 'arr/completion-only')!.free).toBe(false);
  });

  it('cache FRESCA (< TTL): devuelve los modelos cacheados sin llamar a fetch', async () => {
    sessionStorage.setItem('openrouter_models_cache_v3', JSON.stringify({
      models: [{ value: 'cache/fresco', label: 'Vieja', free: false }],
      ts: Date.now(),
    }));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(PROVIDERS.openrouter);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(list).toEqual([{ value: 'cache/fresco', label: 'Vieja', free: false }]);
  });

  it('cache CADUCADA (>= TTL): refetch y sobrescribe la caché', async () => {
    // ts de hace 2 h — MODELS_CACHE_TTL es 1 h → rama falsa del if de frescura.
    sessionStorage.setItem('openrouter_models_cache_v3', JSON.stringify({
      models: [{ value: 'cache/viejo', label: 'Viejo', free: false }],
      ts: Date.now() - 2 * 60 * 60 * 1000,
    }));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'fresco/uno', name: 'Fresco Uno' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(PROVIDERS.openrouter);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(list!.find(m => m.value === 'fresco/uno')!.label).toBe('Fresco Uno');
    // La caché ahora contiene el catálogo nuevo (el viejo queda fuera)
    const reCached = JSON.parse(sessionStorage.getItem('openrouter_models_cache_v3')!);
    expect(reCached.models.some((m: { value: string }) => m.value === 'fresco/uno')).toBe(true);
  });

  it('gemini (def con endpoint): modelos sin name → label m.id (rama del ||)', async () => {
    const def = { ...PROVIDERS.gemini, modelsEndpoint: 'https://proxy.example/api/gemini/models', modelsNeedKey: false };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [
        { id: 'gemini-x-sin-name' }, // sin name → label = id
        { id: 'gemini-2.5-flash', name: 'Flash' },
      ] }),
    }));

    const list = await fetchModels(def, 'AIzaSy_test');
    const target = list!.find(m => m.value === 'gemini-x-sin-name');
    expect(target).toBeDefined();
    expect(target!.label).toBe('gemini-x-sin-name');
  });

  it('nvidia (def con endpoint): featured y no-featured mezclados en el mismo sort (ambos lados del ternario)', async () => {
    const def = { ...PROVIDERS.nvidia, modelsEndpoint: 'https://nim/models' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [
        { id: 'z-nofeat', name: 'Z NoFeat' },
        { id: 'nvidia/feat', name: 'Featured' },
        { id: 'a-nofeat', name: 'A NoFeat' },
      ] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ 'featured-models': [
        { model: 'nvidia/feat' },
      ] }) });
    vi.stubGlobal('fetch', fetchMock);

    const list = await fetchModels(def, 'nvapi_test');
    // `nvidia/feat` (0) primero; el resto (1) alfabético detrás
    expect(list!.map(m => m.value)).toEqual(['nvidia/feat', 'a-nofeat', 'z-nofeat']);
  });

  it('zenmux: entradas sin value ni price dentro de pricing → Number(...) === 0 → free', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          // entrada {} — value y price undefined → cae al 0 del ?? → free
          { id: 'z/empty-entry', pricing: { prompt: [{}], completion: [{}] } },
          // entradas solo con `price` (value undefined → p.price) → free
          { id: 'z/price-only', pricing: { prompt: [{ price: 0 }], completion: [{ price: '0' }] } },
          // pricing con arrays vacíos → length 0 → free
          { id: 'z/empty-arrays', pricing: { prompt: [], completion: [] } },
        ],
      }),
    }));

    const list = await fetchModels(PROVIDERS.zenmux, 'sk-test');
    expect(list).toHaveLength(3);
    expect(list!.every(m => m.free)).toBe(true);
  });

  it('bazaarlink: priceIsZero con completions mixtas (prompt 0 + completion != 0 / indefinida), label por los tres niveles', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          // prompt 0 pero completion indefinida → priceIsZero false (3er operando false)
          { id: 'bal/without-completion', pricing: { prompt: '0' } },
          // prompt 0 pero completion > 0 → priceIsZero false (3er operando false)
          { id: 'bal/half-free', pricing: { prompt: '0', completion: '0.001' } },
          // prompt > 0 → 2º operando false
          { id: 'bal/prompt-paid', pricing: { prompt: '0.9', completion: '0' } },
          // prompt 0 y completion 0 (strings) → priceIsZero TRUE → free
          { id: 'bal/zero-free', pricing: { prompt: '0', completion: '0' } },
          // label: name truthy
          { id: 'bal/label-name', name: 'Nombre Bazaar' },
          // label: display_name (name ausente)
          { id: 'bal/label-display', display_name: 'Display Bazaar' },
          // label: id (ambos ausentes)
          { id: 'bal/label-id' },
        ],
      }),
    }));

    const list = await fetchModels(PROVIDERS.bazaarlink);
    expect(list!.find(m => m.value === 'bal/without-completion')!.free).toBe(false);
    expect(list!.find(m => m.value === 'bal/half-free')!.free).toBe(false);
    expect(list!.find(m => m.value === 'bal/prompt-paid')!.free).toBe(false);
    expect(list!.find(m => m.value === 'bal/zero-free')!.free).toBe(true);
    expect(list!.find(m => m.value === 'bal/label-name')!.label).toBe('Nombre Bazaar');
    expect(list!.find(m => m.value === 'bal/label-display')!.label).toBe('Display Bazaar');
    expect(list!.find(m => m.value === 'bal/label-id')!.label).toBe('bal/label-id');
  });

  it('qwencloud: label por los tres niveles (name / display_name / id)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'qc/label-name', name: 'Nombre Qwen' },
          { id: 'qc/label-display', display_name: 'Display Qwen' },
          { id: 'qc/label-id' },
        ],
      }),
    }));

    const list = await fetchModels(PROVIDERS.qwencloud, 'sk-test');
    expect(list!.find(m => m.value === 'qc/label-name')!.label).toBe('Nombre Qwen');
    expect(list!.find(m => m.value === 'qc/label-display')!.label).toBe('Display Qwen');
    expect(list!.find(m => m.value === 'qc/label-id')!.label).toBe('qc/label-id');
  });
});
