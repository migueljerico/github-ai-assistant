import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildSuggestionUserMessage,
  sanitizeCommitMessage,
  fallbackCommitMessage,
  suggestCommitMessage,
  COMMIT_MESSAGE_PROMPT,
} from '../commitSuggester';
import type { GeminiAction } from '../../types';

// ─── #53 (v3.50.0): Sugerencia de commit semántico ──────────────────────────
// Los helpers puros (build/sanitize/fallback) se testean sin red. La función
// async `suggestCommitMessage` mockea listRecentCommits + callAI para cubrir
// happy path, fallo de red y few-shot vacío.

const baseAction: GeminiAction = {
  tipo: 'escritura',
  accion: 'Actualizar README con nueva sección de instalación',
  endpoint: '/repos/owner/repo/contents/README.md',
  metodo: 'PUT',
  repo: 'owner/repo',
  archivo: 'README.md',
  contenidoPropuesto: '# Project\n\nInstall: npm i\n',
  contenidoActual: '# Project\n',
  payload: {},
  requiereConfirmacion: true,
};

describe('buildSuggestionUserMessage', () => {
  it('incluye tipo, método, archivo, repo y descripción de la acción', () => {
    const msg = buildSuggestionUserMessage(baseAction, []);
    expect(msg).toMatch(/Tipo: escritura/);
    expect(msg).toMatch(/Método HTTP: PUT/);
    expect(msg).toMatch(/Archivo: README\.md/);
    expect(msg).toMatch(/Repo: owner\/repo/);
    expect(msg).toMatch(/instalación/i);
  });

  it('incluye un extracto del contenido propuesto (acotado)', () => {
    const msg = buildSuggestionUserMessage(baseAction, []);
    expect(msg).toMatch(/Extracto del contenido propuesto/);
    expect(msg).toMatch(/# Project/);
  });

  it('trunca contenidos largos a las primeras 15 líneas con nota', () => {
    const long = Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\n');
    const msg = buildSuggestionUserMessage(
      { ...baseAction, contenidoPropuesto: long },
      [],
    );
    expect(msg).toMatch(/contenido truncado/);
    expect(msg).toMatch(/line 14/);
    expect(msg).not.toMatch(/line 49/);
  });

  it('lista los commits recientes (solo primera línea) como few-shot', () => {
    const recent = ['feat: add login\n\nbody', 'fix: critical bug'];
    const msg = buildSuggestionUserMessage(baseAction, recent);
    expect(msg).toMatch(/Últimos commits del repo/);
    expect(msg).toMatch(/- feat: add login/);  // sin el cuerpo
    expect(msg).toMatch(/- fix: critical bug/);
    expect(msg).not.toMatch(/body/);
  });

  it('indica repo sin commits cuando el few-shot está vacío', () => {
    const msg = buildSuggestionUserMessage(baseAction, []);
    expect(msg).toMatch(/sin commits previos/i);
  });

  it('omite filas vacías en el few-shot', () => {
    const msg = buildSuggestionUserMessage(baseAction, ['', '   ', 'feat: x']);
    expect(msg).toMatch(/- feat: x/);
    expect(msg).not.toMatch(/- $/m);
  });
});

describe('sanitizeCommitMessage', () => {
  it('devuelve limpio un mensaje simple', () => {
    expect(sanitizeCommitMessage('feat: add login')).toBe('feat: add login');
  });

  it('quita fences de código ```', () => {
    expect(sanitizeCommitMessage('```\nfeat: add login\n```')).toBe('feat: add login');
  });

  it('quita fences con lenguaje ```text', () => {
    expect(sanitizeCommitMessage('```text\nfeat: add login\n```')).toBe('feat: add login');
  });

  it('quita comillas envolventes', () => {
    expect(sanitizeCommitMessage('"feat: add login"')).toBe('feat: add login');
    expect(sanitizeCommitMessage("'feat: add login'")).toBe('feat: add login');
  });

  it('se queda con la primera línea no vacía si hay cuerpo', () => {
    expect(sanitizeCommitMessage('feat: add login\n\nThis adds a login form.')).toBe('feat: add login');
  });

  it('ignora líneas vacías iniciales al buscar la primera', () => {
    expect(sanitizeCommitMessage('\n\n  \nfeat: add login')).toBe('feat: add login');
  });

  it('acota a 200 caracteres como salvaguarda', () => {
    const huge = 'feat: ' + 'a'.repeat(500);
    expect(sanitizeCommitMessage(huge).length).toBe(200);
  });

  it('devuelve string vacío para entrada vacía', () => {
    expect(sanitizeCommitMessage('')).toBe('');
    expect(sanitizeCommitMessage('   ')).toBe('');
  });
});

describe('fallbackCommitMessage', () => {
  it('usa feat: para creación (POST + tipo creacion)', () => {
    const a: GeminiAction = { ...baseAction, metodo: 'POST', tipo: 'creacion', archivo: 'login.ts' };
    expect(fallbackCommitMessage(a)).toMatch(/^feat:/);
    expect(fallbackCommitMessage(a)).toMatch(/login\.ts/);
  });

  it('usa docs: para lectura/listado', () => {
    const a: GeminiAction = { ...baseAction, metodo: 'GET', tipo: 'lectura', archivo: 'docs.md' };
    expect(fallbackCommitMessage(a)).toMatch(/^docs:/);
  });

  it('usa chore: por defecto (escritura/actualización)', () => {
    expect(fallbackCommitMessage(baseAction)).toMatch(/^chore:/);
  });

  it('elimina caracteres no-ASCII del target para shell-safe', () => {
    const a: GeminiAction = { ...baseAction, archivo: 'réadme con espacios.md' };
    const msg = fallbackCommitMessage(a);
    // Sin tildes ni espacios raros en el target saneado.
    expect(msg).not.toMatch(/é/);
  });

  it('cae a "archivo" si el target saneado queda vacío', () => {
    const a: GeminiAction = { ...baseAction, archivo: 'áéíóú' };
    const msg = fallbackCommitMessage(a);
    expect(msg).toMatch(/archivo/);
  });
});

// ─── suggestCommitMessage (async, con mocks) ────────────────────────────────
// Mockeamos callAI y listRecentCommits en sus módulos.
vi.mock('../gemini', () => ({
  callAI: vi.fn(),
}));
vi.mock('../github', () => ({
  listRecentCommits: vi.fn(),
}));

import { callAI } from '../gemini';
import { listRecentCommits } from '../github';

describe('suggestCommitMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve la sugerencia del LLM saneada en happy path', async () => {
    (listRecentCommits as any).mockResolvedValue([
      { sha: 'a', message: 'feat: prev commit' },
    ]);
    (callAI as any).mockResolvedValue('```\nfeat: add install section\n```');

    const result = await suggestCommitMessage({
      action: baseAction,
      token: 'tok',
      repoOwner: 'owner',
      repoName: 'repo',
      provider: 'gemini' as any,
      apiKey: 'key',
      model: 'gemini-2.5-flash',
    });

    expect(result).toBe('feat: add install section');
    // listRecentCommits se llamó con el token y el owner/repo correctos.
    expect(listRecentCommits).toHaveBeenCalledWith('tok', 'owner', 'repo', 10);
    // callAI recibió el prompt dedicado (no el del chat).
    expect(callAI).toHaveBeenCalledWith(
      expect.any(Array),
      COMMIT_MESSAGE_PROMPT,
      'gemini',
      'key',
      'gemini-2.5-flash',
      'action',
    );
  });

  it('funciona sin few-shot si no hay owner/repo', async () => {
    (callAI as any).mockResolvedValue('fix: handle null');
    const result = await suggestCommitMessage({
      action: baseAction,
      token: 'tok',
      provider: 'groq' as any,
      apiKey: 'key',
      model: 'llama-3',
    });
    expect(listRecentCommits).not.toHaveBeenCalled();
    expect(result).toBe('fix: handle null');
  });

  it('cae al fallback si listRecentCommits lanza (no bloquea)', async () => {
    (listRecentCommits as any).mockRejectedValue(new Error('404'));
    (callAI as any).mockResolvedValue('feat: from llm');
    const result = await suggestCommitMessage({
      action: baseAction,
      token: 'tok',
      repoOwner: 'owner',
      repoName: 'repo',
      provider: 'gemini' as any,
      apiKey: 'key',
      model: 'm',
    });
    // El LLM sigue disponible → su sugerencia gana.
    expect(result).toBe('feat: from llm');
  });

  it('cae al fallback si callAI lanza (red/modelo caído)', async () => {
    (listRecentCommits as any).mockResolvedValue([]);
    (callAI as any).mockRejectedValue(new Error('network down'));
    const result = await suggestCommitMessage({
      action: baseAction,
      token: 'tok',
      provider: 'gemini' as any,
      apiKey: 'key',
      model: 'm',
    });
    // fallback determinista para escritura → chore:
    expect(result).toMatch(/^chore:/);
  });

  it('cae al fallback si callAI devuelve cadena vacía', async () => {
    (listRecentCommits as any).mockResolvedValue([]);
    (callAI as any).mockResolvedValue('   ');
    const result = await suggestCommitMessage({
      action: { ...baseAction, metodo: 'POST', tipo: 'creacion' },
      token: 'tok',
      provider: 'gemini' as any,
      apiKey: 'key',
      model: 'm',
    });
    expect(result).toMatch(/^feat:/);
  });
});
