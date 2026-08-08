import { describe, it, expect } from 'vitest';
import { serializeConversation, parseConversation, conversationFilename, CONVERSATION_FILE_VERSION } from '../conversationIO';
import type { ChatMessage } from '../../types';

const messages: ChatMessage[] = [
  { id: '1', role: 'user', content: 'hola', timestamp: new Date('2026-06-27T10:00:00Z') },
  { id: '2', role: 'assistant', content: 'qué tal', timestamp: new Date('2026-06-27T10:00:05Z'), isLoading: false },
];
const history = [
  { role: 'user' as const, content: 'hola' },
  { role: 'assistant' as const, content: 'qué tal' },
];

describe('serializeConversation / parseConversation', () => {
  it('round-trip: preserva mensajes, historial y repo de contexto', () => {
    const json = serializeConversation(messages, history, 'owner/repo');
    const result = parseConversation(json);

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({ id: '1', role: 'user', content: 'hola' });
    expect(result.conversationHistory).toEqual(history);
    expect(result.repoContextName).toBe('owner/repo');
  });

  it('incluye la versión del formato y exportedAt', () => {
    const parsed = JSON.parse(serializeConversation(messages, history, null));
    expect(parsed.version).toBe(CONVERSATION_FILE_VERSION);
    expect(typeof parsed.exportedAt).toBe('string');
  });

  it('revive timestamp a Date y descarta isLoading', () => {
    const result = parseConversation(serializeConversation(messages, history, null));
    expect(result.messages[0].timestamp).toBeInstanceOf(Date);
    expect(result.messages[1]).not.toHaveProperty('isLoading');
  });

  it('repoContextName es null cuando no había contexto', () => {
    const result = parseConversation(serializeConversation(messages, [], null));
    expect(result.repoContextName).toBeNull();
  });

  it('lanza error claro ante JSON inválido', () => {
    expect(() => parseConversation('no es json')).toThrow(/conversación exportada/i);
  });

  it('lanza error claro ante forma incorrecta (sin messages)', () => {
    expect(() => parseConversation(JSON.stringify({ version: 1 }))).toThrow(/conversación exportada/i);
  });

  it('lanza error si un mensaje no tiene role/content válidos', () => {
    const bad = JSON.stringify({ messages: [{ id: 'x', foo: 'bar' }] });
    expect(() => parseConversation(bad)).toThrow(/conversación exportada/i);
  });

  it('lanza error claro si el JSON parseado no es un objeto o es null', () => {
    expect(() => parseConversation('null')).toThrow(/conversación exportada/i);
    expect(() => parseConversation('123')).toThrow(/conversación exportada/i);
  });


  it('asigna ID por defecto e ignora timestamps o campos malformados en mensajes', () => {
    const raw = JSON.stringify({
      messages: [
        { role: 'user', content: 'test', timestamp: 'invalid-date', action: 'read' },
        { role: 'assistant', content: 'response' }, // sin id ni timestamp
      ],
      conversationHistory: [
        { role: 'user', content: 'test' },
        { role: 'invalid_role', content: 'ignored' },
      ],
      repoContextName: 123, // no string -> null
    });

    const res = parseConversation(raw);
    expect(res.messages[0].id).toBeDefined();
    expect(res.messages[0].action).toBe('read');
    expect(res.messages[0].timestamp).toBeInstanceOf(Date);
    expect(res.messages[1].id).toBeDefined(); // crypto.randomUUID()
    expect(res.messages[1].timestamp).toBeInstanceOf(Date);
    expect(res.conversationHistory).toHaveLength(1);
    expect(res.repoContextName).toBeNull();
  });
});

describe('conversationFilename', () => {
  it('usa el repo saneado cuando lo hay', () => {
    expect(conversationFilename('owner/repo')).toBe('conversacion-owner-repo.json');
  });

  it('sustituye repo por "repo" si solo tiene caracteres especiales', () => {
    expect(conversationFilename('---')).toBe('conversacion-repo.json');
  });

  it('usa la fecha cuando no hay repo', () => {
    expect(conversationFilename(null)).toMatch(/^conversacion-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

