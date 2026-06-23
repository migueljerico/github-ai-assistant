import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de los módulos de los que depende threadSummary (patrón docPublisher.test.ts)
vi.mock('../github', () => ({
  getIssueOrPr: vi.fn(),
  getIssueComments: vi.fn(),
  getPullReviewComments: vi.fn(),
}));
vi.mock('../gemini', () => ({
  callAI: vi.fn(),
}));

import { getIssueOrPr, getIssueComments, getPullReviewComments } from '../github';
import { callAI } from '../gemini';
import { summarizeThread, parseThreadInput } from '../threadSummary';

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

  it('devuelve null sin número válido', () => {
    expect(parseThreadInput('owner/repo')).toBeNull();
    expect(parseThreadInput('')).toBeNull();
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
});
