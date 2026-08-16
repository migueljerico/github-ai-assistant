import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de los módulos de los que depende threadSummary (patrón docPublisher.test.ts)
vi.mock('../github', () => ({
  getIssueOrPr: vi.fn(),
  getIssueComments: vi.fn(),
  getPullReviewComments: vi.fn(),
  listIssues: vi.fn(),
}));
vi.mock('../gemini', () => ({
  callAI: vi.fn(),
}));

import { getIssueOrPr, getIssueComments, getPullReviewComments, listIssues } from '../github';
import { callAI } from '../gemini';
import { summarizeThread, parseThreadInput, listOpenThreads, formatThreadList } from '../threadSummary';

const TOKEN = 'tok';
const OWNER = 'owner';
const REPO = 'repo';
const CONFIG = { provider: 'groq' as const, apiKey: 'key', model: 'llama' };

describe('parseThreadInput', () => {
  it('parsea owner/repo#42', () => {
    expect(parseThreadInput('owner/repo#42')).toEqual({ owner: 'owner', repo: 'repo', number: 42 });
  });

  it('parsea owner/repo 42 (sin almohadilla)', () => {
    expect(parseThreadInput('owner/repo 42')).toEqual({ owner: 'owner', repo: 'repo', number: 42 });
  });

  it('parsea repo#42 (solo repo, sin owner)', () => {
    expect(parseThreadInput('repo#42')).toEqual({ repo: 'repo', number: 42 });
  });

  it('parsea #42 y 42 (solo número, para resolver con contexto)', () => {
    expect(parseThreadInput('#42')).toEqual({ number: 42 });
    expect(parseThreadInput('42')).toEqual({ number: 42 });
  });

  it('parsea una URL de GitHub de issue y de PR', () => {
    expect(parseThreadInput('https://github.com/owner/repo/issues/42'))
      .toEqual({ owner: 'owner', repo: 'repo', number: 42 });
    expect(parseThreadInput('https://github.com/owner/repo/pull/7'))
      .toEqual({ owner: 'owner', repo: 'repo', number: 7 });
  });

  it('parsea la ruta sin host owner/repo/issues/N', () => {
    expect(parseThreadInput('owner/repo/pull/12'))
      .toEqual({ owner: 'owner', repo: 'repo', number: 12 });
  });

  it('parsea SOLO el repo (sin número) → sin number, para listar', () => {
    expect(parseThreadInput('owner/repo')).toEqual({ owner: 'owner', repo: 'repo' });
    expect(parseThreadInput('mi-repo')).toEqual({ repo: 'mi-repo' });
  });

  it('devuelve null si no hay repo ni número reconocibles', () => {
    expect(parseThreadInput('')).toBeNull();
    expect(parseThreadInput('???')).toBeNull();
  });

  it('devuelve null con número pero prefijo que no es owner/repo ni repo simple (#26)', () => {
    // 'a/b/c#42': el prefijo tiene 3 segmentos → ni owner/repo ni palabra única.
    expect(parseThreadInput('a/b/c#42')).toBeNull();
  });
});

describe('listOpenThreads / formatThreadList', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('listOpenThreads marca como PR los items con pull_request', async () => {
    vi.mocked(listIssues).mockResolvedValue([
      { number: 12, title: 'Un PR', pull_request: { url: 'x' } },
      { number: 8, title: 'Un issue' },
    ] as any);

    const out = await listOpenThreads(TOKEN, OWNER, REPO);

    expect(listIssues).toHaveBeenCalledWith(TOKEN, OWNER, REPO, 'open');
    expect(out).toEqual([
      { number: 12, title: 'Un PR', isPr: true },
      { number: 8, title: 'Un issue', isPr: false },
    ]);
  });

  it('listOpenThreads respeta el límite', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ number: i + 1, title: `t${i}` }));
    vi.mocked(listIssues).mockResolvedValue(many as any);
    const out = await listOpenThreads(TOKEN, OWNER, REPO, 5);
    expect(out).toHaveLength(5);
  });

  it('formatThreadList muestra los hilos marcando PR vs issue', () => {
    const md = formatThreadList(OWNER, REPO, [
      { number: 12, title: 'Un PR', isPr: true },
      { number: 8, title: 'Un issue', isPr: false },
    ]);
    expect(md).toContain('#12');
    expect(md).toContain('(PR)');
    expect(md).toContain('#8');
    expect(md).toContain('(issue)');
  });

  it('formatThreadList informa cuando no hay hilos abiertos', () => {
    const md = formatThreadList(OWNER, REPO, []);
    expect(md).toMatch(/No hay issues ni PRs/i);
  });
});

describe('summarizeThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(callAI).mockResolvedValue('**TL;DR**\nResumen.');
  });

  it('para un ISSUE no pide comentarios de revisión', async () => {
    vi.mocked(getIssueOrPr).mockResolvedValue({
      number: 5, title: 'Bug', body: 'Hay un bug', state: 'open', html_url: 'u', user: { login: 'ana' },
    } as any);
    vi.mocked(getIssueComments).mockResolvedValue([
      { id: 1, body: 'Confirmado', user: { login: 'leo' }, created_at: '2026-06-01T00:00:00Z' },
    ] as any);

    const out = await summarizeThread(TOKEN, OWNER, REPO, 5, CONFIG);

    expect(getPullReviewComments).not.toHaveBeenCalled();
    expect(callAI).toHaveBeenCalledTimes(1);
    expect(out).toContain('TL;DR');
  });

  it('para un PR pide también los comentarios de revisión y los incluye', async () => {
    vi.mocked(getIssueOrPr).mockResolvedValue({
      number: 12, title: 'Feature', body: 'Añade X', state: 'open', html_url: 'u',
      user: { login: 'ana' }, pull_request: { url: 'x' },
    } as any);
    vi.mocked(getIssueComments).mockResolvedValue([
      { id: 1, body: 'LGTM', user: { login: 'leo' }, created_at: '2026-06-01T00:00:00Z' },
    ] as any);
    vi.mocked(getPullReviewComments).mockResolvedValue([
      { id: 2, body: 'Renombra esto', user: { login: 'max' }, created_at: '2026-06-02T00:00:00Z', path: 'src/a.ts' },
    ] as any);

    await summarizeThread(TOKEN, OWNER, REPO, 12, CONFIG);

    expect(getPullReviewComments).toHaveBeenCalledWith(TOKEN, OWNER, REPO, 12);
    // El mensaje a la IA incluye título, cuerpo y ambos comentarios
    const userMessage = vi.mocked(callAI).mock.calls[0][0][0].content;
    expect(userMessage).toContain('Feature');
    expect(userMessage).toContain('Añade X');
    expect(userMessage).toContain('LGTM');
    expect(userMessage).toContain('Renombra esto');
    expect(userMessage).toContain('src/a.ts');
  });

  it('lanza error si el hilo no tiene ni cuerpo ni comentarios', async () => {
    vi.mocked(getIssueOrPr).mockResolvedValue({
      number: 7, title: 'Vacío', body: '', state: 'open', html_url: 'u', user: { login: 'ana' },
    } as any);
    vi.mocked(getIssueComments).mockResolvedValue([] as any);

    await expect(summarizeThread(TOKEN, OWNER, REPO, 7, CONFIG)).rejects.toThrow(/no tiene contenido/);
    expect(callAI).not.toHaveBeenCalled();
  });

  it('limpia los fences de código del resumen devuelto', async () => {
    vi.mocked(getIssueOrPr).mockResolvedValue({
      number: 5, title: 'Bug', body: 'b', state: 'open', html_url: 'u', user: { login: 'ana' },
    } as any);
    vi.mocked(getIssueComments).mockResolvedValue([] as any);
    vi.mocked(callAI).mockResolvedValue('```markdown\n**TL;DR**\nHola\n```');

    const out = await summarizeThread(TOKEN, OWNER, REPO, 5, CONFIG);

    expect(out.startsWith('```')).toBe(false);
    expect(out).toContain('Hola');
  });

  it('trunca los comentarios muy largos en el mensaje enviado a la IA', async () => {
    vi.mocked(getIssueOrPr).mockResolvedValue({
      number: 5, title: 'Bug', body: 'b', state: 'open', html_url: 'u', user: { login: 'ana' },
    } as any);
    vi.mocked(getIssueComments).mockResolvedValue([
      { id: 1, body: 'x'.repeat(2000), user: { login: 'leo' }, created_at: '2026-06-01' },
    ] as any);

    await summarizeThread(TOKEN, OWNER, REPO, 5, CONFIG);

    const userMessage = vi.mocked(callAI).mock.calls[0][0][0].content;
    expect(userMessage).toContain('[… truncado …]');
  });
});
