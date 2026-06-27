import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseGeminiAction,
  detectPrimaryLanguage,
  callAI,
  buildRepoContextSummary,
  chatPromptWithContext,
  CHAT_PROMPT,
  isTransientAIError,
  withTransientRetry,
  generateFileDoc,
  generateRepoDocs,
  truncateByLines,
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
    ).rejects.toThrow(/Gemini\/Groq|otro modelo|saturación/i);
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
  });

  describe('chatPromptWithContext', () => {
    it('combina el CHAT_PROMPT con el contexto y las reglas', () => {
      const prompt = chatPromptWithContext('CONTEXTO_DE_PRUEBA');
      expect(prompt).toContain(CHAT_PROMPT);
      expect(prompt).toContain('CONTEXTO_DE_PRUEBA');
      expect(prompt).toContain('BASA tu opinión');
    });
  });

  describe('CHAT_PROMPT — límites honestos (#28 v3.6.1)', () => {
    it('declara el límite de un archivo a la vez y sin imágenes/multiarchivo todavía', () => {
      expect(CHAT_PROMPT).toMatch(/LÍMITES/i);
      expect(CHAT_PROMPT).toMatch(/UN archivo/i);
      expect(CHAT_PROMPT).toMatch(/IMÁGENES|VARIOS archivos/i);
      expect(CHAT_PROMPT).toMatch(/NUNCA ignores/i);
    });

    it('para documentar/publicar dirige al botón explícito (#28 v3.7.0)', () => {
      expect(CHAT_PROMPT).toMatch(/Documentar y publicar/i);
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

  it('inyecta el owner real y el año actual en el footer, sin placeholders', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"readme":"R","manualTecnico":"M"}' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await generateRepoDocs(
      'migueljerico/powerbi-gestion-people',
      [{ path: 'README.md', content: '# x' }],
      { provider: 'groq', apiKey: 'k', model: 'llama' },
    );

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const sysMsg = body.messages.find((m: { role: string }) => m.role === 'system');
    expect(sysMsg.content).toContain(`@migueljerico · ${new Date().getFullYear()}`);
    expect(sysMsg.content).not.toContain('[autor]');
    expect(sysMsg.content).not.toContain('[año]');
  });

  it('trunca el contenido de los archivos por LÍNEAS, no por caracteres (#20)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"readme":"R","manualTecnico":"M"}' } }] }),
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
});

describe('truncateByLines (#20)', () => {
  it('devuelve el contenido intacto si no supera maxLines', () => {
    expect(truncateByLines('a\nb\nc', 80)).toBe('a\nb\nc');
  });

  it('trunca a las primeras maxLines líneas y anota cuántas se omitieron', () => {
    const content = Array.from({ length: 100 }, (_, i) => `L${i}`).join('\n');
    const out = truncateByLines(content, 80);
    const lines = out.split('\n');
    expect(lines[0]).toBe('L0');        // preserva el inicio (imports/firmas)
    expect(lines[79]).toBe('L79');      // hasta la línea 80
    expect(out).toContain('[... 20 líneas más ...]');
    expect(out).not.toContain('L80');   // no incluye el resto
  });
});
