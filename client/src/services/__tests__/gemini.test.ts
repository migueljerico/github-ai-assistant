import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseGeminiAction,
  detectPrimaryLanguage,
  callAI,
  buildRepoContextSummary,
  chatPromptWithContext,
  CHAT_PROMPT,
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
});
