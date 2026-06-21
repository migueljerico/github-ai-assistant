import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseGeminiAction, detectPrimaryLanguage, callAI } from '../gemini';

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
