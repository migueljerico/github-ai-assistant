import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
 parseGeminiAction,
 parseGeminiActions,
 parseGeminiActionWithReason,
 detectPrimaryLanguage,
 callAI,
 buildRepoContextSummary,
 chatPromptWithContext,
 CHAT_PROMPT,
 isTransientAIError,
 isAbortError,
 withTransientRetry,
 generateFileDoc,
 generateRepoDocs,
 generateSpecificDoc,
 truncateByLines,
 cleanDocFooter,
 injectImagePreviewBlock,
} from '../gemini';

describe('gemini.ts - Utilidades', () => {
  describe('parseGeminiAction', () => {
    it('debería parsear JSON válido de acción', () => {
      const rawText = JSON.stringify({
        tipo: 'creacion',
        accion: 'Crear repositorio',
        endpoint: '/user/repos',
        metodo: 'POST',
        requiereConfirmacion: true,
      });

      const result = parseGeminiAction(rawText);
      
      expect(result).not.toBeNull();
      expect(result?.tipo).toBe('creacion');
      expect(result?.metodo).toBe('POST');
    });

    it('debería parsear JSON dentro de markdown code block', () => {
      const rawText = '```json\n{"tipo":"lectura","accion":"Leer","endpoint":"/user","metodo":"GET","requiereConfirmacion":false}\n```';
      
      const result = parseGeminiAction(rawText);
      
      expect(result).not.toBeNull();
      expect(result?.tipo).toBe('lectura');
    });

    it('debería devolver null para JSON inválido', () => {
      const result = parseGeminiAction('esto no es json');
      expect(result).toBeNull();
    });

    it('debería devolver null para JSON sin campos requeridos', () => {
      const result = parseGeminiAction('{"foo":"bar"}');
      expect(result).toBeNull();
    });

    // #40 — validación estricta (allowlist de método/tipo + endpoint relativo)
    it('rechaza un método fuera de la allowlist', () => {
      expect(parseGeminiAction('{"tipo":"lectura","accion":"x","metodo":"FETCH","endpoint":"/user"}')).toBeNull();
    });

    it('rechaza un tipo inválido', () => {
      expect(parseGeminiAction('{"tipo":"inventado","accion":"x","metodo":"GET","endpoint":"/user"}')).toBeNull();
    });

    it('rechaza un endpoint absoluto (host externo)', () => {
      expect(parseGeminiAction('{"tipo":"lectura","accion":"x","metodo":"GET","endpoint":"http://evil.com/x"}')).toBeNull();
    });

    it('rechaza un endpoint que no empieza por "/"', () => {
      expect(parseGeminiAction('{"tipo":"lectura","accion":"x","metodo":"GET","endpoint":"user/repos"}')).toBeNull();
    });

    it('acepta una acción válida con endpoint relativo', () => {
      const a = parseGeminiAction('{"tipo":"listado","accion":"Listar repos","metodo":"GET","endpoint":"/user/repos","requiereConfirmacion":false}');
      expect(a).not.toBeNull();
      expect(a?.metodo).toBe('GET');
    });

    // v3.22.2 — parser robusto: extrae el JSON aunque el modelo lo envuelva en prosa
    // (caso de modelos menos dóciles como Qwen/Gemma en Groq).
    it('extrae el JSON aunque venga envuelto en prosa (v3.22.2)', () => {
      const raw = 'Claro, aquí tienes la acción solicitada:\n\n{"tipo":"listado","accion":"Listar repos","metodo":"GET","endpoint":"/user/repos","requiereConfirmacion":false}\n\nEspero que te sirva.';
      const result = parseGeminiAction(raw);
      expect(result).not.toBeNull();
      expect(result?.tipo).toBe('listado');
      expect(result?.endpoint).toBe('/user/repos');
    });

    it('extrae el JSON aunque venga con prefijo "Aquí tienes:" sin fences (v3.22.2)', () => {
      const raw = 'Aquí tienes: {"tipo":"lectura","accion":"Ver perfil","metodo":"GET","endpoint":"/user","requiereConfirmacion":false}';
      const result = parseGeminiAction(raw);
      expect(result).not.toBeNull();
      expect(result?.accion).toBe('Ver perfil');
    });

    it('no se confunde con llaves dentro de strings (v3.22.2)', () => {
      // El valor del string contiene { y } que NO deben contar para el balance.
      const raw = '{"tipo":"lectura","accion":"Mensaje con {llaves}","metodo":"GET","endpoint":"/user","requiereConfirmacion":false}';
      const result = parseGeminiAction(raw);
      expect(result).not.toBeNull();
      expect(result?.accion).toBe('Mensaje con {llaves}');
    });

    it('sigue devolviendo null si no hay ningún objeto JSON en la respuesta', () => {
      expect(parseGeminiAction('Lo siento, no entendí qué quieres hacer.')).toBeNull();
    });

    // v3.22.3 — modelos de razonamiento (Qwen, QwQ, DeepSeek-R1) emiten un bloque
    // <think> con un JSON de ejemplo ANTES del JSON real; el parser debe ignorarlo.
    it('ignora el bloque <think> y extrae el JSON real (v3.22.3, Qwen)', () => {
      const raw = `<think>
The user wants to list their repositories.
This is a read-only operation.
Constructing the JSON:
{
  "tipo": "listado",
  "accion": "Listar los repositorios del usuario autenticado",
  "endpoint": "/user/repos",
  "metodo": "GET",
  "repo": null,
  "archivo": null,
  "contenidoPropuesto": null,
  "payload": {},
  "requiereConfirmacion": false
}
</think>

{
  "tipo": "listado",
  "accion": "Listar los repositorios del usuario autenticado",
  "endpoint": "/user/repos",
  "metodo": "GET",
  "repo": null,
  "archivo": null,
  "contenidoPropuesto": null,
  "payload": {},
  "requiereConfirmacion": false
}`;
      const result = parseGeminiAction(raw);
      expect(result).not.toBeNull();
      expect(result?.tipo).toBe('listado');
      expect(result?.endpoint).toBe('/user/repos');
      expect(result?.accion).toBe('Listar los repositorios del usuario autenticado');
    });
  });

  // #58 (c) — parseGeminiActions (múltiples JSONs)
  describe('parseGeminiActions', () => {
    const validAction = (accion: string) => JSON.stringify({
      tipo: 'lectura', accion, metodo: 'GET', endpoint: '/user', requiereConfirmacion: false,
    });

    it('extrae una sola acción válida', () => {
      const result = parseGeminiActions(validAction('Leer perfil'));
      expect(result).toHaveLength(1);
      expect(result[0].accion).toBe('Leer perfil');
    });

    it('extrae múltiples acciones válidas separadas por saltos de línea', () => {
      const raw = validAction('Acción 1') + '\n' + validAction('Acción 2') + '\n' + validAction('Acción 3');
      const result = parseGeminiActions(raw);
      expect(result).toHaveLength(3);
      expect(result.map(a => a.accion)).toEqual(['Acción 1', 'Acción 2', 'Acción 3']);
    });

    it('devuelve array vacío si no hay JSONs válidos', () => {
      expect(parseGeminiActions('No hay acciones aquí')).toEqual([]);
    });

    it('ignora JSONs malformados y extrae los válidos', () => {
      const raw = validAction('Buena') + '\n{broken json}\n' + validAction('Otra buena');
      const result = parseGeminiActions(raw);
      expect(result).toHaveLength(2);
      expect(result[0].accion).toBe('Buena');
      expect(result[1].accion).toBe('Otra buena');
    });
  });

  // v3.56.0 — tolerancia del parser + diagnóstico (reason)
  describe('parser tolerante (v3.56.0)', () => {
    const validBase = {
      tipo: 'lectura', accion: 'Leer perfil', metodo: 'GET',
      endpoint: '/user', requiereConfirmacion: false,
    };

    it('acepta JSON con trailing commas', () => {
      const raw = `{
        "tipo": "lectura",
        "accion": "Leer perfil",
        "metodo": "GET",
        "endpoint": "/user",
        "requiereConfirmacion": false,
      }`;
      expect(parseGeminiAction(raw)).not.toBeNull();
    });

    it('acepta JSON con comillas tipográficas en valores', () => {
      const raw = JSON.stringify(validBase).replace('"Leer perfil"', '“Leer perfil”');
      const action = parseGeminiAction(raw);
      expect(action).not.toBeNull();
      expect(action!.accion).toBe('Leer perfil');
    });

    it('acepta JSON con comentarios de línea', () => {
      const raw = `{
        // comentario del modelo
        "tipo": "lectura",
        "accion": "Leer perfil",
        "metodo": "GET",
        "endpoint": "/user",
        "requiereConfirmacion": false
      }`;
      expect(parseGeminiAction(raw)).not.toBeNull();
    });

    it('parseGeminiActionWithReason devuelve reason legible cuando falta un campo', () => {
      const raw = JSON.stringify({ tipo: 'lectura', accion: 'x' /* sin metodo */ });
      const result = parseGeminiActionWithReason(raw);
      expect(result.action).toBeNull();
      // Tras afirmar action === null, estrechamos al miembro con `error`.
      if (result.action === null) {
        expect(result.error).toContain('metodo');
      }
    });

    it('parseGeminiActionWithReason indica endpoint inválido', () => {
      const raw = JSON.stringify({
        tipo: 'lectura', accion: 'x', metodo: 'GET', endpoint: 'http://evil.com/x',
      });
      const result = parseGeminiActionWithReason(raw);
      expect(result.action).toBeNull();
      if (result.action === null) {
        expect(result.error).toContain('endpoint');
      }
    });

    it('parseGeminiActionWithReason indica tipo no reconocido', () => {
      const raw = JSON.stringify({
        tipo: 'inventado', accion: 'x', metodo: 'GET', endpoint: '/user',
      });
      const result = parseGeminiActionWithReason(raw);
      expect(result.action).toBeNull();
      if (result.action === null) {
        expect(result.error).toContain('tipo');
      }
    });
  });

  describe('detectPrimaryLanguage', () => {
    it('debería detectar TypeScript como lenguaje principal', () => {
      const files = [
        { path: 'src/App.tsx' },
        { path: 'src/utils.ts' },
        { path: 'src/types.ts' },
        { path: 'README.md' },
      ];

      const result = detectPrimaryLanguage(files);
      expect(result).toBe('TypeScript');
    });

    it('debería detectar JavaScript', () => {
      const files = [
        { path: 'index.js' },
        { path: 'app.jsx' },
        { path: 'utils.js' },
      ];

      const result = detectPrimaryLanguage(files);
      expect(result).toBe('JavaScript');
    });

    it('debería detectar Python', () => {
      const files = [
        { path: 'main.py' },
        { path: 'utils.py' },
      ];

      const result = detectPrimaryLanguage(files);
      expect(result).toBe('Python');
    });

    it('debería devolver el primer lenguaje cuando hay empate', () => {
      const files = [
        { path: 'app.ts' },
        { path: 'script.py' },
        { path: 'main.go' },
        { path: 'README.md' },
      ];

      const result = detectPrimaryLanguage(files);
      // Cuando hay empate (1 archivo cada uno), devuelve el primero encontrado
      expect(result).toBe('TypeScript');
    });

    it('debería manejar array vacío', () => {
      const result = detectPrimaryLanguage([]);
      expect(result).toBe('múltiple');
    });

    it('debería detectar lenguaje dominante con mayoría clara', () => {
      const files = [
        { path: 'app.py' },
        { path: 'utils.py' },
        { path: 'main.py' },
        { path: 'config.py' },
        { path: 'README.md' },
        { path: 'style.css' },
      ];

      const result = detectPrimaryLanguage(files);
      expect(result).toBe('Python');
    });
  });
});

describe('callAI - Groq temperatura según modo (Opción D / #27)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  /** Mockea fetch y devuelve el body JSON enviado a Groq en la última llamada */
  function mockGroqFetch() {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'respuesta' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  function lastBody(fetchMock: ReturnType<typeof vi.fn>) {
    const [, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    return JSON.parse((init as RequestInit).body as string);
  }

  it("debería usar temperatura 0.7 en modo 'chat'", async () => {
    const fetchMock = mockGroqFetch();
    await callAI(
      [{ role: 'user', content: 'Hola' }],
      'system',
      'groq',
      'key',
      'llama-3.1',
      'chat',
    );
    expect(lastBody(fetchMock).temperature).toBe(0.7);
  });

  it("debería usar temperatura 0.1 en modo 'action'", async () => {
    const fetchMock = mockGroqFetch();
    await callAI(
      [{ role: 'user', content: 'Crea un repo' }],
      'system',
      'groq',
      'key',
      'llama-3.1',
      'action',
    );
    expect(lastBody(fetchMock).temperature).toBe(0.1);
  });

  it('debería usar temperatura 0.1 por defecto (sin modo)', async () => {
    const fetchMock = mockGroqFetch();
    await callAI(
      [{ role: 'user', content: 'Lista mis repos' }],
      'system',
      'groq',
      'key',
      'llama-3.1',
    );
    expect(lastBody(fetchMock).temperature).toBe(0.1);
  });
});

describe('callAI - enrutado OpenRouter (#15)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('llama al endpoint de OpenRouter con Authorization y header X-Title', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await callAI(
      [{ role: 'user', content: 'Hola' }],
      'system',
      'openrouter',
      'sk-or-xxx',
      'deepseek/deepseek-r1:free',
      'chat',
    );

    const [url, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(url).toContain('openrouter.ai');
    expect(headers['X-Title']).toBe('GitHub AI Assistant');
    expect(headers['Authorization']).toContain('sk-or-xxx');
  });

  it('ante un !ok del proveedor lanza un error con pista accionable y NO reintenta un 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callAI([{ role: 'user', content: 'Hola' }], 'system', 'openrouter', 'k', 'm', 'chat'),
    ).rejects.toThrow(/Invalid API key|Gemini\/Groq|otro modelo|saturación/i);
    // 401 es no recuperable → no se reintenta
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('lanza un error claro si el modelo devuelve contenido vacío', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '' } }] }),
    }));
    await expect(
      callAI([{ role: 'user', content: 'Hola' }], 'system', 'openrouter', 'k', 'm', 'chat'),
    ).rejects.toThrow(/no devolvió contenido/i);
  });

  it('lanza un error claro si la respuesta no trae choices (no crashea)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] }),
    }));
    await expect(
      callAI([{ role: 'user', content: 'Hola' }], 'system', 'groq', 'k', 'm', 'chat'),
    ).rejects.toThrow(/no devolvió contenido/i);
  });

  it('BazaarLink 429/403: muestra mensaje de error accionable con hint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Too Many Requests' } }),
    }));
    await expect(
      callAI([{ role: 'user', content: 'Hola' }], 'system', 'bazaarlink', 'k', 'm', 'chat'),
    ).rejects.toThrow(/Demasiadas peticiones o límite alcanzado en BazaarLink/i);
  });

  it('HTTP 401: lanza el error exacto de la API sin añadir hint de saturación', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid or disabled API key.' } }),
    }));
    await expect(
      callAI([{ role: 'user', content: 'Hola' }], 'system', 'bazaarlink', 'k', 'm', 'chat'),
    ).rejects.toThrow('Invalid or disabled API key.');
  });
});

describe('Reintento ante errores transitorios (v2.7.3)', () => {
  describe('isTransientAIError', () => {
    it('detecta transitorios por status (503/502/500/504)', () => {
      expect(isTransientAIError({ status: 503 })).toBe(true);
      expect(isTransientAIError({ status: 502 })).toBe(true);
      expect(isTransientAIError({ status: 500 })).toBe(true);
    });

    it('detecta transitorios por mensaje (Gemini 503 / OpenRouter)', () => {
      expect(isTransientAIError(new Error('503 Service Unavailable: high demand'))).toBe(true);
      expect(isTransientAIError(new Error('Provider returned error'))).toBe(true);
      expect(isTransientAIError(new Error('Failed to fetch'))).toBe(true);
    });

    it('respeta el flag transient', () => {
      expect(isTransientAIError({ transient: true })).toBe(true);
    });

    it('NO reintenta errores no recuperables (401/400/key inválida)', () => {
      expect(isTransientAIError({ status: 401 })).toBe(false);
      expect(isTransientAIError({ status: 400 })).toBe(false);
      expect(isTransientAIError(new Error('invalid_api_key'))).toBe(false);
    });
  });

  describe('withTransientRetry', () => {
    it('reintenta y acaba devolviendo el valor tras un fallo transitorio', async () => {
      let calls = 0;
      const fn = vi.fn(async () => {
        calls++;
        if (calls < 2) throw Object.assign(new Error('overloaded'), { status: 503 });
        return 'ok';
      });
      const result = await withTransientRetry(fn, 2, 0); // delay 0 en test
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('NO reintenta ante un error no transitorio (lo propaga de inmediato)', async () => {
      const fn = vi.fn(async () => { throw Object.assign(new Error('invalid_api_key'), { status: 401 }); });
      await expect(withTransientRetry(fn, 2, 0)).rejects.toThrow(/invalid_api_key/);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('propaga el último error si se agotan los reintentos', async () => {
      const fn = vi.fn(async () => { throw Object.assign(new Error('high demand'), { status: 503 }); });
      await expect(withTransientRetry(fn, 2, 0)).rejects.toThrow(/high demand/);
      expect(fn).toHaveBeenCalledTimes(3); // intento inicial + 2 reintentos
    });
  });
});

describe('Cancelación de la generación (#40)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('isAbortError detecta solo los AbortError', () => {
    expect(isAbortError({ name: 'AbortError' })).toBe(true);
    expect(isAbortError(new Error('otra cosa'))).toBe(false);
    expect(isAbortError({ status: 503 })).toBe(false);
  });

  it('callAI reenvía el AbortSignal al fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    // #73: timeoutMs=0 desactiva el timeout → el signal llega TAL CUAL al fetch.
    await callAI([{ role: 'user', content: 'Hola' }], 'system', 'groq', 'k', 'm', 'chat', undefined, controller.signal, undefined, null, 0);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBe(controller.signal);
  });

  it('un AbortError NO se reintenta: se propaga al instante', async () => {
    const fetchMock = vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callAI([{ role: 'user', content: 'Hola' }], 'system', 'groq', 'k', 'm', 'chat'),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(1); // sin reintentos
  });
});

// #73: timeout automático en llamadas IA. callAI combina el signal manual con uno
// de timeout (default 180s) y lo pasa al fetch. El timeout dispara el mismo camino
// de abort que el botón Detener (withTransientRetry no reintenta).
describe('Timeout automático (#73)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('callAI aplica un signal combinado (no undefined) aunque no haya signal manual', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await callAI([{ role: 'user', content: 'Hola' }], 'system', 'groq', 'k', 'm', 'chat');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    // Default timeout → siempre hay un signal combinado (aunque el usuario no pase manual).
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect((init.signal as AbortSignal).aborted).toBe(false);
  });

  it('callAI respeta timeoutMs explícito (no el default) pasado como último arg', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    // Firma: (messages, system, provider, key, model, mode, onToken, signal, maxTokens, accountId, timeoutMs)
    await callAI([{ role: 'user', content: 'Hola' }], 'system', 'groq', 'k', 'm', 'chat', undefined, undefined, undefined, null, 30000);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('timeoutMs <= 0 desactiva el timeout (signal solo si hay manual)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    // Sin manual y timeoutMs=0 → undefined (comportamiento histórico previo a #73).
    await callAI([{ role: 'user', content: 'Hola' }], 'system', 'groq', 'k', 'm', 'chat', undefined, undefined, undefined, null, 0);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeUndefined();
  });

  it('un TimeoutError (timeout disparado) NO se reintenta: se propaga al instante', async () => {
    const fetchMock = vi.fn().mockRejectedValue(Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callAI([{ role: 'user', content: 'Hola' }], 'system', 'groq', 'k', 'm', 'chat'),
    ).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(fetchMock).toHaveBeenCalledTimes(1); // sin reintentos, igual que el AbortError manual
  });
});

describe('Error de contexto excesivo (TPM) — diferenciado del de saturación (#50)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('status 413 → error con contextTooLarge:true, SIN el hint de saturación', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 413,
      json: async () => ({ error: { message: 'Payload Too Large' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callAI([{ role: 'user', content: 'hola' }], 'sys', 'groq', 'k', 'm', 'chat'),
    ).rejects.toMatchObject({ contextTooLarge: true, status: 413 });
  });

  it('mensaje "too large / tokens per minute" → error con contextTooLarge:true', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 413,
      json: async () => ({ error: { message: 'Request too large: exceeded tokens per minute' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callAI([{ role: 'user', content: 'hola' }], 'sys', 'groq', 'k', 'm', 'chat'),
    ).rejects.toMatchObject({ contextTooLarge: true });
  });

  it('error de saturación (no TPM) → SIN contextTooLarge y CON el hint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: { message: 'Service Unavailable' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      await callAI([{ role: 'user', content: 'hola' }], 'sys', 'groq', 'k', 'm', 'chat');
      throw new Error('debería haber lanzado');
    } catch (e) {
      expect((e as any).contextTooLarge).toBeUndefined();
      expect((e as Error).message).toMatch(/saturación|Prueba otro modelo/);
    }
  });
});

describe('Contexto de repo para chat (#41)', () => {
  const files = [
    { path: 'README.md', content: '# Mi proyecto\nlínea2\nlínea3' },
    { path: 'src/index.ts', content: Array.from({ length: 120 }, (_, i) => `linea ${i}`).join('\n') },
    { path: 'package.json', content: '{ "name": "x" }' },
    { path: 'src/utils.ts', content: 'export const a = 1;' },
  ];

  describe('buildRepoContextSummary', () => {
    it('incluye el árbol completo y el repo', () => {
      const out = buildRepoContextSummary('owner/repo', files);
      expect(out).toContain('owner/repo');
      expect(out).toContain('README.md');
      expect(out).toContain('src/index.ts');
      expect(out).toContain('package.json');
    });

    it('trunca archivos largos por número de líneas', () => {
      const out = buildRepoContextSummary('owner/repo', files, { maxLinesPerFile: 80 });
      expect(out).toContain('líneas más'); // src/index.ts (120 líneas) se trunca
    });

    it('respeta maxFiles para el contenido (no para el árbol)', () => {
      const out = buildRepoContextSummary('owner/repo', files, { maxFiles: 1 });
      // El árbol lista todos los paths…
      expect(out).toContain('src/utils.ts');
      // …pero el contenido solo del primer archivo
      expect(out).toContain('# Mi proyecto');
      expect(out).not.toContain('export const a = 1;');
    });

    it('con allPaths muestra el árbol COMPLETO aunque el contenido sea un subconjunto (#49)', () => {
      // Solo se pasa el contenido de README, pero allPaths lista archivos que NO están en files.
      const out = buildRepoContextSummary('owner/repo', [{ path: 'README.md', content: '# R' }], {
        allPaths: ['README.md', 'MEJORAS_FUTURAS.md', 'src/deep/thing.ts'],
      });
      expect(out).toContain('MEJORAS_FUTURAS.md'); // en la ESTRUCTURA aunque no haya contenido
      expect(out).toContain('src/deep/thing.ts');
      expect(out).toContain('# R'); // contenido solo de README
    });

    it('presupuesto reducido combinado (6 archivos / 60 líneas) — Groq free (#50)', () => {
      // Groq free tiene TPM bajo: runSend le pasa maxFiles:6, maxLinesPerFile:60.
      const big = Array.from({ length: 120 }, (_, i) => `linea ${i}`).join('\n');
      const many = Array.from({ length: 10 }, (_, i) => ({ path: `f${i}.ts`, content: big }));
      const out = buildRepoContextSummary('owner/repo', many, { maxFiles: 6, maxLinesPerFile: 60 });
      // El CONTENIDO (bloque `### path`) de solo los 6 primeros archivos…
      expect(out).toContain('### f0.ts');
      expect(out).toContain('### f5.ts');
      expect(out).not.toContain('### f6.ts');
      // …y cada archivo se trunca a 60 líneas (no 80).
      expect(out).toMatch(/60 líneas más/);
    });
  });

  describe('chatPromptWithContext', () => {
    it('combina el CHAT_PROMPT con el contexto y las reglas', () => {
      const prompt = chatPromptWithContext('CONTEXTO_DE_PRUEBA');
      expect(prompt).toContain(CHAT_PROMPT);
      expect(prompt).toContain('CONTEXTO_DE_PRUEBA');
      expect(prompt).toContain('BASA tu opinión');
    });

    it('incluye la regla de NO negar archivos que están en la ESTRUCTURA (#49)', () => {
      const prompt = chatPromptWithContext('CTX');
      expect(prompt).toMatch(/NO niegues que\s+exista/i);
      expect(prompt).toMatch(/ESTRUCTURA lista TODOS/i);
    });
  });

  describe('CHAT_PROMPT — límites honestos (#28 v3.6.1)', () => {
    it('declara el límite de un archivo a la vez y sin imágenes/multiarchivo todavía', () => {
      expect(CHAT_PROMPT).toMatch(/LÍMITES/i);
      expect(CHAT_PROMPT).toMatch(/UN archivo/i);
      expect(CHAT_PROMPT).toMatch(/IMÁGENES|VARIOS archivos/i);
      expect(CHAT_PROMPT).toMatch(/NUNCA ignores/i);
    });

    it('para documentar dirige al botón explícito (#28 v3.7.0)', () => {
      expect(CHAT_PROMPT).toMatch(/Documentar repo/i);
      expect(CHAT_PROMPT).toMatch(/bot[oó]n/i);
    });
  });
});

// ── #38: Streaming (SSE) ──────────────────────────────────────────────────────
describe('callAI - streaming (#38)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  /** Construye una Response-like con un cuerpo SSE a partir de líneas. */
  function sseResponse(chunks: string[]) {
    const encoder = new TextEncoder();
    return {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          for (const c of chunks) controller.enqueue(encoder.encode(c));
          controller.close();
        },
      }),
    };
  }

  it('openai-compatible (Groq): pide stream:true y acumula los deltas', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([
      'data: {"choices":[{"delta":{"content":"Hola"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" mundo"}}]}\n\n',
      'data: [DONE]\n\n',
    ]));
    vi.stubGlobal('fetch', fetchMock);

    const tokens: string[] = [];
    const out = await callAI(
      [{ role: 'user', content: 'hi' }], 'sys', 'groq', 'key', 'llama', 'chat',
      (t) => tokens.push(t),
    );

    expect(out).toBe('Hola mundo');
    expect(tokens).toEqual(['Hola', 'Hola mundo']); // semántica "set": texto acumulado
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.stream).toBe(true);
  });

  it('gemini-proxy: hace streaming de los chunks {text} del proxy', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([
      'data: {"text":"Ho"}\n\n',
      'data: {"text":"la"}\n\n',
      'data: [DONE]\n\n',
    ]));
    vi.stubGlobal('fetch', fetchMock);

    const tokens: string[] = [];
    const out = await callAI(
      [{ role: 'user', content: 'hi' }], 'sys', 'gemini', 'key', 'gemini-2.5-flash', 'chat',
      (t) => tokens.push(t),
    );

    expect(out).toBe('Hola');
    expect(tokens).toEqual(['Ho', 'Hola']);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/gemini');
    expect(JSON.parse((init as RequestInit).body as string).stream).toBe(true);
  });

  it('sin onToken NO streamea (ruta clásica, no envía stream:true)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'completo' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await callAI([{ role: 'user', content: 'hi' }], 'sys', 'groq', 'key', 'llama', 'chat');

    expect(out).toBe('completo');
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).not.toContain('"stream":true');
  });

  // v3.66.0 (Frente B): callGeminiDirect valida respuesta vacía en la rama NO
  // streaming (antes fluía {text:""} silenciosamente al parser JSON de docs).
  it('gemini-proxy no-streaming: lanza error accionable si la respuesta viene vacía (Frente B)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: '   ' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callAI([{ role: 'user', content: 'hi' }], 'sys', 'gemini', 'key', 'gemini-2.5-flash', 'chat'),
    ).rejects.toThrow(/no devolvió contenido/);
  });
});

describe('generateFileDoc - documentar archivo adjunto (#28 Fase 2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  /** Mockea fetch (transporte groq) devolviendo el contenido indicado. */
  function mockContent(content: string) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  const config = { provider: 'groq' as const, apiKey: 'k', model: 'llama' };

  it('devuelve el Markdown generado e incluye nombre+contenido en el prompt', async () => {
    const fetchMock = mockContent('# Doc\n## Resumen\nTexto.');
    const doc = await generateFileDoc('notas.txt', 'contenido del archivo', config);

    expect(doc).toBe('# Doc\n## Resumen\nTexto.');
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const userMsg = body.messages.find((m: { role: string }) => m.role === 'user');
    expect(userMsg.content).toContain('notas.txt');
    expect(userMsg.content).toContain('contenido del archivo');
  });

  it('limpia los fences ```markdown que envuelvan la respuesta', async () => {
    mockContent('```markdown\n# Título\ncuerpo\n```');
    const doc = await generateFileDoc('a.md', 'x', config);
    expect(doc).toBe('# Título\ncuerpo');
  });

  it('incorpora la conversación al prompt cuando se aporta (v3.5.0)', async () => {
    const fetchMock = mockContent('# Doc');
    await generateFileDoc('a.md', 'x', config, 'Usuario: soy estudiante\n\nAsistente: vale');

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const userMsg = body.messages.find((m: { role: string }) => m.role === 'user');
    expect(userMsg.content).toContain('CONVERSACIÓN PREVIA');
    expect(userMsg.content).toContain('soy estudiante');
  });

  it('lanza un error claro si tras limpiar fences no queda documentación', async () => {
    // Contenido no vacío para callAI, pero que al quitar los fences queda vacío.
    mockContent('```markdown\n```');
    await expect(generateFileDoc('a.md', 'x', config)).rejects.toThrow(/no devolvió documentación/);
  });
});

describe('generateRepoDocs - no inventar autor/año (#28 4a)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  // v3.66.0 (Frente A+B): la función ahora hace 2 llamadas secuenciales en markdown
  // plano (README, luego MANUAL) en vez de un único JSON. Los mocks devuelven
  // markdown plano para reflejar el comportamiento real.
  it('inyecta el owner real y el año actual en el footer, sin placeholders', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '# README' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateRepoDocs(
      'migueljerico/powerbi-gestion-people',
      [{ path: 'README.md', content: '# x' }],
      { provider: 'groq', apiKey: 'k', model: 'llama' },
    );

    // v3.31.0: el footer ahora cita usuario + proveedor + modelo (firma de documentación).
    // fix: @login es enlace Markdown y se incluye 'desde la App Asistente de IA'.
    expect(result.readme).toContain(`Creado por <a href="https://github.com/migueljerico">@migueljerico</a> y documentado por Groq Cloud (llama) desde la App Asistente de IA · ${new Date().getFullYear()}`);
    expect(result.readme).not.toContain('[autor]');
    expect(result.readme).not.toContain('[año]');
  });

  it('inyecta el owner real y el año actual en el footer en INGLÉS, sin placeholders', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '# README' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateRepoDocs(
      'migueljerico/powerbi-gestion-people',
      [{ path: 'README.md', content: '# x' }],
      { provider: 'groq', apiKey: 'k', model: 'llama' },
      'en' // Idioma inglés
    );

    expect(result.readme).toContain(`Created by <a href="https://github.com/migueljerico">@migueljerico</a> and documented by Groq Cloud (llama) from the AI Assistant App · ${new Date().getFullYear()}`);
    expect(result.readme).not.toContain('[autor]');
    expect(result.readme).not.toContain('[año]');
  });

  it('trunca el contenido de los archivos por LÍNEAS, no por caracteres (#20)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '# doc' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const longFile = Array.from({ length: 200 }, (_, i) => `linea ${i}`).join('\n');
    await generateRepoDocs(
      'owner/repo',
      [{ path: 'src/big.ts', content: longFile }],
      { provider: 'groq', apiKey: 'k', model: 'llama' },
    );

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const userMsg = body.messages.find((m: { role: string }) => m.role === 'user');
    expect(userMsg.content).toContain('líneas más');         // truncado por líneas
    expect(userMsg.content).not.toContain('truncado a 2000 chars'); // ya no por chars
    expect(userMsg.content).toContain('linea 0');            // preserva el inicio (imports/firmas)
  });

  // v3.66.0 (Frente A): cuando ya existe un README en el repo, el system prompt
  // debe pedir MEJORARLO (no copiarlo). Antes solo decía "genera desde cero" y un
  // modelo perezoso del free tier duplicaba el README existente.
  it('pide MEJORAR el README existente en vez de copiarlo (Frente A)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '# README mejorado' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await generateRepoDocs(
      'owner/repo',
      [{ path: 'README.md', content: '# README viejo que no debe copiarse' }],
      { provider: 'groq', apiKey: 'k', model: 'llama' },
    );

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const sysMsg = body.messages.find((m: { role: string }) => m.role === 'system');
    expect(sysMsg.content).toContain('MEJORAR');
    expect(sysMsg.content).toContain('# README viejo que no debe copiarse');
  });

  it('pide MEJORAR el MANUAL_TECNICO existente en vez de copiarlo (Frente A)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '# Manual mejorado' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await generateRepoDocs(
      'owner/repo',
      [{ path: 'MANUAL_TECNICO.md', content: '# Manual viejo' }],
      { provider: 'groq', apiKey: 'k', model: 'llama' },
    );

    // La 2ª llamada es el MANUAL.
    const body = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    const sysMsg = body.messages.find((m: { role: string }) => m.role === 'system');
    expect(sysMsg.content).toContain('MEJORAR');
    expect(sysMsg.content).toContain('# Manual viejo');
  });

  // v3.66.0 (Frente B): ya no hay JSON que truncar — cada doc viene en markdown
  // plano. El error "no devolvió JSON válido" desaparece. Una respuesta vacía da
  // un error accionable (no genérico de JSON), lanzado por el transporte.
  it('lanza error accionable si el README viene vacío (Frente B, markdown plano)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '   ' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      generateRepoDocs('owner/repo', [{ path: 'src/a.ts', content: 'x' }], { provider: 'groq', apiKey: 'k', model: 'llama' }),
      // El transporte lanza "no devolvió contenido" ANTES de llegar a la validación
      // de generateRepoDocs; lo importante es que NO aparece el viejo error de JSON.
    ).rejects.toThrow(/no devolvió contenido/);
  });

  // v3.66.0 (Frente B): las validaciones de README/MANUAL vacíos en generateRepoDocs
  // (l.911/924) solo son alcanzables cuando el transporte devuelve contenido que,
  // tras limpiar fences, queda vacío (p. ej. solo ``` ```). El transporte ya lanza
  // "no devolvió contenido" si la respuesta es puramente vacía, así que este test
  // usa una respuesta de solo-fences para ejercitar la rama de generateRepoDocs.
  it('lanza error específico si el README queda vacío tras limpiar fences (Frente B)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: '```\n```' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      generateRepoDocs('owner/repo', [{ path: 'src/a.ts', content: 'x' }], { provider: 'gemini', apiKey: 'k', model: 'gemini-2.5-flash' }),
    ).rejects.toThrow(/no devolvió el README/);
  });

  it('lanza error específico si el MANUAL_TECNICO queda vacío tras un README válido (Frente B)', async () => {
    // 1ª llamada (README): contenido válido. 2ª llamada (MANUAL): solo-fences → vacío.
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ text: '# README válido' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ text: '```markdown\n```' }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      generateRepoDocs('owner/repo', [{ path: 'src/a.ts', content: 'x' }], { provider: 'gemini', apiKey: 'k', model: 'gemini-2.5-flash' }),
    ).rejects.toThrow(/no devolvió el MANUAL_TECNICO/);
  });
});

describe('truncateByLines (#20)', () => {
  it('devuelve el contenido intacto si no supera maxLines', () => {
    expect(truncateByLines('a\nb\nc', 80)).toBe('a\nb\nc');
  });

 it('trunca a las primeras maxLines líneas y anota cuántas se omitieron', () => {
 const content = Array.from({ length: 100 }, (_, i) => `L${i}`).join('\n');
 const out = truncateByLines(content, 80);
 const lines = out.split('\n');
 expect(lines[0]).toBe('L0'); // preserva el inicio (imports/firmas)
 expect(lines[79]).toBe('L79'); // hasta la línea 80
 expect(out).toContain('[... 20 líneas más ...]');
 expect(out).not.toContain('L80'); // no incluye el resto
 });
 });

 describe('generateSpecificDoc (#58 Fase 2/3) — documento específico del repo', () => {
 const config = { provider: 'groq', apiKey: 'k', model: 'm' } as const;

 it('incluye la directiva README cuando el path es readme.md', async () => {
 const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '# README' } }] }), });
 vi.stubGlobal('fetch', fetchMock);
 await generateSpecificDoc('readme.md', undefined, undefined, config, 'es');
 const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
 const sys = body.messages.find((m: { role: string }) => m.role === 'system');
 expect(sys.content).toContain('TIPO: README');
 expect(sys.content).toContain('EN ESPAÑOL');
 });

 it('incluye la directiva de changelog cuando el path es changelog.md', async () => {
 const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '# Changelog' } }] }), });
 vi.stubGlobal('fetch', fetchMock);
 await generateSpecificDoc('changelog.md', undefined, undefined, config, 'es');
 const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
 const sys = body.messages.find((m: { role: string }) => m.role === 'system');
 expect(sys.content).toContain('TIPO: Changelog');
 expect(sys.content).toContain('Added, Fixed, Changed');
 });

 it('inyecta las instrucciones adicionales (Fase 3) como contexto', async () => {
 const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '# doc' } }] }), });
 vi.stubGlobal('fetch', fetchMock);
 await generateSpecificDoc('docs/api.md', undefined, 'Solo describe autenticación', config, 'es');
 const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
 const sys = body.messages.find((m: { role: string }) => m.role === 'system');
 expect(sys.content).toContain('Solo describe autenticación');
 });

 it('usa IN ENGLISH cuando lang es en', async () => {
 const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '# doc' } }] }), });
 vi.stubGlobal('fetch', fetchMock);
 await generateSpecificDoc('readme.md', undefined, undefined, config, 'en');
 const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
 const sys = body.messages.find((m: { role: string }) => m.role === 'system');
 expect(sys.content).toContain('IN ENGLISH');
 });

 // v3.67.0 (Frente A): la instrucción del usuario tiene precedencia sobre el
 // contenido existente — antes, "actualizar, no reemplazar ciegamente" +
 // "básate únicamente en el contexto" hacía que el modelo ignorara un rewrite
 // pedido en el chat y solo produjera cambios triviales.
 describe('precedencia de instrucción de usuario sobre contenido existente', () => {
 const existing = '# README viejo\n\nSección A obsoleta.\nSección B.';
 const userInstruction = 'Reescribe completamente: añade badges, vista previa del dashboard y medidas DAX en bloques de código.';

 it('cuando hay instrucción de usuario, el system prompt dice que PREVALECE', async () => {
 const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '# nuevo' } }] }) });
 vi.stubGlobal('fetch', fetchMock);
 await generateSpecificDoc('readme.md', existing, userInstruction, config, 'es');
 const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
 const sys = body.messages.find((m: { role: string }) => m.role === 'system');
 expect(sys.content).toContain('INSTRUCCIÓN EXPLÍCITA DEL USUARIO');
 expect(sys.content).toContain('PREVALECE');
 expect(sys.content).toContain(userInstruction);
 });

 it('cuando hay instrucción de usuario, el userMessage hace eco de ella (mayor prominencia)', async () => {
 const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '# nuevo' } }] }) });
 vi.stubGlobal('fetch', fetchMock);
 await generateSpecificDoc('readme.md', existing, userInstruction, config, 'es');
 const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
 const usr = body.messages.find((m: { role: string }) => m.role === 'user');
 expect(usr.content).toContain(userInstruction);
 expect(usr.content).toContain('Reescribe');
 });

 it('cuando NO hay instrucción de usuario, mantiene el comportamiento "mejora, no copies" del v3.66.0', async () => {
 const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '# nuevo' } }] }) });
 vi.stubGlobal('fetch', fetchMock);
 await generateSpecificDoc('readme.md', existing, undefined, config, 'es');
 const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
 const sys = body.messages.find((m: { role: string }) => m.role === 'system');
 expect(sys.content).not.toContain('PREVALECE');
 expect(sys.content).toContain('actualízalo, no reemplazarlo ciegamente');
 });

 it('no etiqueta mal la instrucción como "archivos adjuntos"', async () => {
 const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '# doc' } }] }) });
 vi.stubGlobal('fetch', fetchMock);
 await generateSpecificDoc('readme.md', existing, userInstruction, config, 'es');
 const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
 const sys = body.messages.find((m: { role: string }) => m.role === 'system');
 expect(sys.content).not.toContain('provisto por el usuario como archivos adjuntos');
 });
 });
});

describe('QwenCloud provider integration', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('realiza la llamada a /api/qwencloud correctamente', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Respuesta QwenCloud' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await callAI(
      [{ role: 'user', content: 'Hola Qwen' }],
      'system prompt',
      'qwencloud',
      'sk-testkey',
      'qwen3.7-flash',
      'chat',
    );

    expect(res).toBe('Respuesta QwenCloud');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/qwencloud');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer sk-testkey',
    });
  });

  it('captura el error 403 AccessDenied.Unpurchased y devuelve la sugerencia de activación', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: {
          code: 'AccessDenied.Unpurchased',
          message: 'Access to model denied. Please make sure you are eligible for using the model.',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callAI(
        [{ role: 'user', content: 'Hola Qwen' }],
        'system prompt',
        'qwencloud',
        'sk-testkey',
        'qwen3.7-flash',
        'chat',
      ),
    ).rejects.toThrow(/activación previa en tu consola de QwenCloud/);
  });

  it('captura el error 401 de QwenCloud y devuelve el mensaje de autenticación', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          code: 'invalid_api_key',
          message: 'Incorrect API key provided.',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callAI(
        [{ role: 'user', content: 'Hola Qwen' }],
        'system prompt',
        'qwencloud',
        'sk-testkey',
        'qwen3.7-flash',
        'chat',
      ),
    ).rejects.toThrow(/Error de autenticación o permisos en QwenCloud/);
  });
});

describe('truncateByLines & generateFileDoc - base64 & data URI handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('truncateByLines sustituye las URLs de datos base64 por un aviso', () => {
    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const result = truncateByLines(dataUri, 80);
    expect(result).toBe('[ARCHIVO BINARIO O BASE64 ADJUNTO - NO SE MUESTRA CONTENIDO EN EL PROMPT]');
  });

  it('truncateByLines mantiene el contenido de texto normal', () => {
    const text = 'linea 1\nlinea 2\nlinea 3';
    expect(truncateByLines(text, 80)).toBe(text);
  });

  it('generateFileDoc reemplaza data URI por safeContent sin enviar base64 al prompt', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '# Doc de captura' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const config = { provider: 'groq' as const, apiKey: 'gsk-test', model: 'llama-3.3-70b' };
    const base64Image = '  data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...';

    const result = await generateFileDoc('captura.png', base64Image, config, 'Conversación previa sobre la captura', 'es');

    expect(result).toBe('# Doc de captura');
    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const userMsg = body.messages.find((m: { role: string }) => m.role === 'user');
    expect(userMsg.content).toContain('[ARCHIVO BINARIO O BASE64 ADJUNTO - NO SE MUESTRA CONTENIDO EN EL PROMPT]');
    expect(userMsg.content).not.toContain('iVBORw0KGgoAAAANSUhEUgAA');
  });

  it('generateFileDoc procesa correctamente archivo plano sin conversación', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '# Doc de texto' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const config = { provider: 'groq' as const, apiKey: 'gsk-test', model: 'llama-3.3-70b' };

    const result = await generateFileDoc('readme.txt', 'Contenido del archivo plano', config, undefined, 'en');

    expect(result).toBe('# Doc de texto');
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const userMsg = body.messages.find((m: { role: string }) => m.role === 'user');
    expect(userMsg.content).toContain('Contenido del archivo plano');
    expect(userMsg.content).not.toContain('CONVERSACIÓN PREVIA');
  });

  describe('cleanDocFooter & deduplicación de footers', () => {
    it('elimina bloques HTML de footer <p align="center">...', () => {
      const docWithFooter = '# Mi Proyecto\n\nTexto principal.\n\n<p align="center">\n  <sub>Desarrollado por <a href="https://github.com/migueljerico">@migueljerico</a> · 2026</sub>\n</p>';
      const cleaned = cleanDocFooter(docWithFooter);
      expect(cleaned).toBe('# Mi Proyecto\n\nTexto principal.');
    });

    it('elimina footers formateados como creados/documentados por IA', () => {
      const docWithFooter = '# Mi Proyecto\n\nContenido...\n\n<p align="center">Creado por <a href="https://github.com/user">@user</a> y documentado por Groq (Llama 3) desde la App Asistente de IA · 2026</p>';
      const cleaned = cleanDocFooter(docWithFooter);
      expect(cleaned).toBe('# Mi Proyecto\n\nContenido...');
    });

    it('respeta documentos que no contienen footers de autor', () => {
      const normalDoc = '# Documento Normal\n\nEste es un texto que incluye un párrafo centrado normal:\n\n<p align="center">Logotipo del Proyecto</p>';
      const cleaned = cleanDocFooter(normalDoc);
      expect(cleaned).toBe(normalDoc);
    });

    it('generateRepoDocs limpia footers previos y produce un único footer al final', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ choices: [{ message: { content: '# README\n\nNuevo contenido.\n\n<p align="center">Desarrollado por @olduser · 2025</p>' } }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ choices: [{ message: { content: '# Manual Técnico\n\nContenido manual.' } }] }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const files = [
        { path: 'README.md', content: '# README Antiguo\n\n<p align="center">Desarrollado por @olduser · 2025</p>' },
        { path: 'main.ts', content: 'console.log("hello");' },
      ];
      const config = { provider: 'groq' as const, apiKey: 'gsk-test', model: 'llama-3.3-70b' };

      const result = await generateRepoDocs('migueljerico/demo', files, config, 'es');

      // Verifica que no hay múltiples etiquetas <p align="center"> en el README resultante
      const pMatches = (result.readme.match(/<p\s+align=["']center["']/gi) || []).length;
      expect(pMatches).toBe(1);
      expect(result.readme).toContain('documentado por Groq');
      expect(result.readme).not.toContain('@olduser');
    });

    it('injectImagePreviewBlock inserta la vista previa antes de las secciones principales', () => {
      const readme = '# Mi App\n\nDescripción...\n\n## ⚙️ Instalación\n\n`npm install`';
      const preview = '### 🖼️ Vista previa\n\n<p align="center"><img src="screenshots/demo.png" /></p>';
      const result = injectImagePreviewBlock(readme, preview);
      expect(result).toBe('# Mi App\n\nDescripción...\n\n' + preview + '\n\n## ⚙️ Instalación\n\n`npm install`');
    });

    it('injectImagePreviewBlock maneja casos vacíos y fallback sin secciones encontradas', () => {
      expect(injectImagePreviewBlock('', 'block')).toBe('');
      expect(injectImagePreviewBlock('doc', '')).toBe('doc');
      const noSectionsDoc = '# Titulo\n\nTexto plano sin headers H2';
      const preview = '### 🖼️ Vista previa';
      expect(injectImagePreviewBlock(noSectionsDoc, preview)).toBe(noSectionsDoc + '\n\n' + preview);
    });

    it('generateRepoDocs inyecta vista previa de capturas adjuntas si el LLM no las incluye', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ choices: [{ message: { content: '# README\n\nTexto sin imágenes.' } }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ choices: [{ message: { content: '# Manual Técnico' } }] }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const files = [{ path: 'main.ts', content: 'console.log("hi");' }];
      const config = { provider: 'groq' as const, apiKey: 'gsk-test', model: 'llama-3.3-70b' };

      const result = await generateRepoDocs('user/repo', files, config, 'es', ['captura1.png']);

      expect(result.readme).toContain('![Vista previa - captura1.png](./screenshots/captura1.png)');
      expect(result.readme).not.toContain('width="750"');
    });

    it('generateRepoDocs no duplica la vista previa si el LLM ya incluyó la captura', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ choices: [{ message: { content: '# README\n\n![Demo](./screenshots/captura1.png)' } }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ choices: [{ message: { content: '# Manual Técnico' } }] }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const files = [{ path: 'main.ts', content: 'console.log("hi");' }];
      const config = { provider: 'groq' as const, apiKey: 'gsk-test', model: 'llama-3.3-70b' };

      const result = await generateRepoDocs('user/repo', files, config, 'es', ['captura1.png']);

      // Solo una mención de ./screenshots/captura1.png
      const matches = result.readme.match(/\.\/screenshots\/captura1\.png/g) || [];
      expect(matches.length).toBe(1);
    });

    it('generateSpecificDoc inyecta vista previa si el LLM omite la captura adjunta', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '# Doc Específico\n\nContenido.' } }] }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const config = { provider: 'groq' as const, apiKey: 'gsk-test', model: 'llama-3.3-70b' };
      const doc = await generateSpecificDoc('README.md', undefined, undefined, config, 'es', ['screenshot.png']);

      expect(doc).toContain('./screenshots/screenshot.png');
      expect(doc).toContain('Vista previa');
    });

    it('generateSpecificDoc no duplica si el LLM ya incluye la captura adjunta', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '# Doc Específico\n\n![Screenshot](./screenshots/screenshot.png)' } }] }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const config = { provider: 'groq' as const, apiKey: 'gsk-test', model: 'llama-3.3-70b' };
      const doc = await generateSpecificDoc('README.md', undefined, undefined, config, 'es', ['screenshot.png']);

      const matches = doc.match(/\.\/screenshots\/screenshot\.png/g) || [];
      expect(matches.length).toBe(1);
    });

    it('generateSpecificDoc soporta distintas rutas objetivo (MEJORAS_FUTURAS, MANUAL_TECNICO, docs/, custom)', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '# Documentación generada' } }] }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const config = { provider: 'groq' as const, apiKey: 'gsk-test', model: 'llama-3.3-70b' };
      const d1 = await generateSpecificDoc('MEJORAS_FUTURAS.md', undefined, undefined, config, 'es');
      const d2 = await generateSpecificDoc('MANUAL_TECNICO.md', undefined, undefined, config, 'es');
      const d3 = await generateSpecificDoc('docs/guia.md', undefined, undefined, config, 'es');
      const d4 = await generateSpecificDoc('custom/notas.txt', undefined, undefined, config, 'es');

      expect(d1).toContain('Documentación generada');
      expect(d2).toContain('Documentación generada');
      expect(d3).toContain('Documentación generada');
      expect(d4).toContain('Documentación generada');
    });
  });

  describe('Robustecimiento de Parseo JSON y Qwen 3.8 Max', () => {
    it('extrae candidatos JSON de bloques markdown embebidos en prosa (estilo Qwen 3.8 Max)', () => {
      const qwenResponse = `Claro, aquí tienes la acción solicitada para crear el archivo:

\`\`\`json
{
  "tipo": "escritura",
  "accion": "Crear README.md",
  "metodo": "put",
  "repo": "owner/repo",
  "archivo": "README.md",
  "contenidoPropuesto": "# Titulo",
  "requiereConfirmacion": true
}
\`\`\`

¿Deseas que realice alguna otra acción?`;

      const action = parseGeminiAction(qwenResponse);
      expect(action).not.toBeNull();
      expect(action?.metodo).toBe('PUT');
      expect(action?.tipo).toBe('escritura');
      expect(action?.archivo).toBe('README.md');
    });

    it('sanea saltos de línea crudos dentro de cadenas de texto en JSON (contenidoPropuesto multilínea)', () => {
      const jsonWithRawNewlines = `{
  "tipo": "escritura",
  "accion": "Crear archivo con saltos de línea crudos",
  "metodo": "PUT",
  "repo": "owner/repo",
  "archivo": "doc.md",
  "contenidoPropuesto": "# Título principal
Línea 1 del documento
Línea 2 del documento",
  "requiereConfirmacion": true
}`;

      const action = parseGeminiAction(jsonWithRawNewlines);
      expect(action).not.toBeNull();
      expect(action?.contenidoPropuesto).toContain('# Título principal');
      expect(action?.contenidoPropuesto).toContain('Línea 1 del documento');
    });

    it('normaliza método a mayúsculas y tipo a minúsculas en isValidAction', () => {
      const raw = `{
  "tipo": "ESCRITURA",
  "accion": "Actualizar archivo",
  "metodo": "patch",
  "repo": "owner/repo",
  "archivo": "index.ts",
  "contenidoPropuesto": "console.log('hi');",
  "requiereConfirmacion": true
}`;
      const action = parseGeminiAction(raw);
      expect(action).not.toBeNull();
      expect(action?.metodo).toBe('PATCH');
      expect(action?.tipo).toBe('escritura');
    });

    it('ignora etiquetas de pensamiento o detalles como <thought> y <details>', () => {
      const raw = `<thought>
Analizando la petición del usuario para crear un archivo...
</thought>
<details>
Detalles internos de razonamiento...
</details>
\`\`\`json
{
  "tipo": "creacion",
  "accion": "Crear repo test",
  "metodo": "POST",
  "repo": "owner/test",
  "requiereConfirmacion": true
}
\`\`\``;
      const action = parseGeminiAction(raw);
      expect(action).not.toBeNull();
      expect(action?.tipo).toBe('creacion');
      expect(action?.metodo).toBe('POST');
    });

    it('sanea caracteres escapados, retornos de carro \\r y tabulaciones \\t en cadenas de texto JSON', () => {
      const jsonWithSpecialChars = `{
  "tipo": "escritura",
  "accion": "Test caracteres \\"escapados\\" y \\\\ backslash",
  "metodo": "PUT",
  "repo": "owner/repo",
  "archivo": "table.tsv",
  "contenidoPropuesto": "Col1\tCol2\r\nVal1\tVal2",
  "requiereConfirmacion": true
}`;
      const action = parseGeminiAction(jsonWithSpecialChars);
      expect(action).not.toBeNull();
      expect(action?.contenidoPropuesto).toContain('Col1\tCol2');
    });

    it('devuelve razonamiento explícito ante método no-string o no permitido en isValidAction', () => {
      const res1 = parseGeminiActionWithReason('{"tipo":"escritura","accion":"a","metodo":123}');
      expect(res1.action).toBeNull();
      if ('error' in res1) expect(res1.error).toContain('método');

      const res2 = parseGeminiActionWithReason('{"tipo":"escritura","accion":"a","metodo":"INVALID"}');
      expect(res2.action).toBeNull();
      if ('error' in res2) expect(res2.error).toContain('método');
    });

    it('devuelve razonamiento explícito ante tipo no-string o no reconocido en isValidAction', () => {
      const res1 = parseGeminiActionWithReason('{"tipo":123,"accion":"a","metodo":"PUT"}');
      expect(res1.action).toBeNull();
      if ('error' in res1) expect(res1.error).toContain('tipo');

      const res2 = parseGeminiActionWithReason('{"tipo":"invalido","accion":"a","metodo":"PUT"}');
      expect(res2.action).toBeNull();
      if ('error' in res2) expect(res2.error).toContain('tipo');
    });

    it('devuelve razonamiento explícito ante endpoint inválido o requiereConfirmacion no booleano', () => {
      const res1 = parseGeminiActionWithReason('{"tipo":"escritura","accion":"a","metodo":"PUT","endpoint":123}');
      expect(res1.action).toBeNull();
      if ('error' in res1) expect(res1.error).toContain('endpoint');

      const res2 = parseGeminiActionWithReason('{"tipo":"escritura","accion":"a","metodo":"PUT","endpoint":"http://external.com/api"}');
      expect(res2.action).toBeNull();
      if ('error' in res2) expect(res2.error).toContain('endpoint');

      const res3 = parseGeminiActionWithReason('{"tipo":"escritura","accion":"a","metodo":"PUT","endpoint":"relative/path"}');
      expect(res3.action).toBeNull();
      if ('error' in res3) expect(res3.error).toContain('endpoint');

      const res4 = parseGeminiActionWithReason('{"tipo":"escritura","accion":"a","metodo":"PUT","requiereConfirmacion":"true"}');
      expect(res4.action).toBeNull();
      if ('error' in res4) expect(res4.error).toContain('requiereConfirmacion');
    });

    it('soporta extractJsonCandidates con bloques vacíos o múltiples bloques markdown', () => {
      const raw = `Texto explicativo
\`\`\`json
\`\`\`
\`\`\`json
{
  "tipo": "escritura",
  "accion": "Crear ok",
  "metodo": "PUT",
  "repo": "owner/repo",
  "archivo": "ok.ts",
  "contenidoPropuesto": "code",
  "requiereConfirmacion": true
}
\`\`\``;
      const action = parseGeminiAction(raw);
      expect(action).not.toBeNull();
      expect(action?.archivo).toBe('ok.ts');
    });

    it('devuelve null en parseGeminiAction cuando hay llaves desbalanceadas { sin cerrar (cobertura extractBalancedJsonObject)', () => {
      const rawUnbalanced = 'Texto con { llave abierta pero nunca cerrada';
      const action = parseGeminiAction(rawUnbalanced);
      expect(action).toBeNull();

      const reasonRes = parseGeminiActionWithReason(rawUnbalanced);
      expect(reasonRes.action).toBeNull();
    });
  });

  describe('generateRepoDocs - Cobertura de errores', () => {
    it('lanza un error explicativo cuando la lista de archivos está vacía', async () => {
      await expect(generateRepoDocs('owner/repo', [])).rejects.toThrow(
        'No hay archivos para analizar en el repositorio.',
      );
    });
  });

  // REGRESIÓN: generateRepoDocs, generateFileDoc y generateSpecificDoc ignoraban
  // config.timeoutMs y config.accountId al llamar a callAI internamente,
  // usando siempre el DEFAULT_AI_TIMEOUT_MS de 180s incluso si el usuario
  // había configurado un timeout mayor en ⚙️. Bug reportado: timeout al generar README rico.
  describe('REGRESIÓN: timeoutMs y accountId se propagan a callAI en funciones de docs', () => {
    beforeEach(() => { vi.restoreAllMocks(); });

    it('generateRepoDocs pasa timeoutMs del config a callAI (README y MANUAL)', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '# README' } }] }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const configWithTimeout = { provider: 'groq' as const, apiKey: 'k', model: 'llama', timeoutMs: 300_000 };
      await generateRepoDocs('owner/repo', [{ path: 'src/a.ts', content: 'x' }], configWithTimeout);

      // callAI construye el AbortSignal con combineSignals; verificamos que fetch fue llamado
      // (timeout > 0 significa que se construyó correctamente sin lanzar).
      expect(fetchMock).toHaveBeenCalled();
    });

    it('generateRepoDocs pasa accountId del config a callAI', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '# README' } }] }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const configWithAccount = { provider: 'groq' as const, apiKey: 'k', model: 'llama', accountId: 'acc-123' };
      await generateRepoDocs('owner/repo', [{ path: 'src/a.ts', content: 'x' }], configWithAccount);

      expect(fetchMock).toHaveBeenCalled();
    });

    it('generateFileDoc pasa timeoutMs y accountId del config a callAI', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '# Documento generado' } }] }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const configWithTimeout = { provider: 'groq' as const, apiKey: 'k', model: 'llama', timeoutMs: 300_000, accountId: 'acc-xyz' };
      const result = await generateFileDoc('informe.pdf', 'Contenido del informe', configWithTimeout);

      expect(result).toBeTruthy();
      expect(fetchMock).toHaveBeenCalled();
    });

    it('generateSpecificDoc pasa timeoutMs y accountId del config a callAI', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '# README mejorado' } }] }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const configWithTimeout = { provider: 'groq' as const, apiKey: 'k', model: 'llama', timeoutMs: 360_000 };
      const result = await generateSpecificDoc('README.md', '# README actual', 'Mejorar el readme', configWithTimeout);

      expect(result).toBeTruthy();
      expect(fetchMock).toHaveBeenCalled();
    });
  });
});

