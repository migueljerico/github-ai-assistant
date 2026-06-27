import type { ChatMessage } from '../types';

// ── conversationIO (#46) ─────────────────────────────────────────────────────────
// Exportar/importar la conversación como JSON, sin romper Zero-Storage: el usuario
// descarga el fichero y lo reimporta en otra sesión; NADA se auto-persiste en el
// navegador. Helpers PUROS (serializar/parsear) — la descarga/lectura del File vive
// en App/componente, para poder testear esto sin DOM.

export const CONVERSATION_FILE_VERSION = 1;

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConversationExport {
  version: number;
  exportedAt: string;
  repoContextName: string | null;
  messages: ChatMessage[];
  conversationHistory: ConversationTurn[];
}

/** Mensaje serializado (sin estado efímero como `isLoading`, `timestamp` en ISO). */
interface SerializedMessage {
  id: string;
  role: ChatMessage['role'];
  content: string;
  timestamp: string;
  action?: ChatMessage['action'];
}

/** Serializa la conversación a un JSON legible y versionado. */
export function serializeConversation(
  messages: ChatMessage[],
  conversationHistory: ConversationTurn[],
  repoContextName: string | null,
): string {
  const serializedMessages: SerializedMessage[] = messages.map(m => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: (m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp)).toISOString(),
    ...(m.action ? { action: m.action } : {}),
  }));

  const payload = {
    version: CONVERSATION_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    repoContextName: repoContextName ?? null,
    messages: serializedMessages,
    conversationHistory,
  };

  return JSON.stringify(payload, null, 2);
}

const INVALID_FILE_MSG =
  'El archivo no parece una conversación exportada por la app. Asegúrate de subir el JSON que descargaste con «Exportar».';

/**
 * Parsea un JSON de conversación, validando su forma. Revive `timestamp` a `Date`
 * y descarta el estado efímero (`isLoading`). Lanza un error claro si no es válido.
 */
export function parseConversation(json: string): {
  messages: ChatMessage[];
  conversationHistory: ConversationTurn[];
  repoContextName: string | null;
} {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error(INVALID_FILE_MSG);
  }

  if (typeof data !== 'object' || data === null) throw new Error(INVALID_FILE_MSG);
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.messages)) throw new Error(INVALID_FILE_MSG);

  const messages: ChatMessage[] = obj.messages.map((raw) => {
    const m = raw as Record<string, unknown>;
    if (typeof m.role !== 'string' || typeof m.content !== 'string') {
      throw new Error(INVALID_FILE_MSG);
    }
    const ts = typeof m.timestamp === 'string' ? new Date(m.timestamp) : new Date();
    return {
      id: typeof m.id === 'string' ? m.id : crypto.randomUUID(),
      role: m.role as ChatMessage['role'],
      content: m.content,
      timestamp: isNaN(ts.getTime()) ? new Date() : ts,
      ...(m.action ? { action: m.action as ChatMessage['action'] } : {}),
    };
  });

  const conversationHistory: ConversationTurn[] = Array.isArray(obj.conversationHistory)
    ? (obj.conversationHistory as unknown[])
        .filter((t): t is ConversationTurn => {
          const turn = t as Record<string, unknown>;
          return (turn?.role === 'user' || turn?.role === 'assistant') && typeof turn?.content === 'string';
        })
    : [];

  const repoContextName = typeof obj.repoContextName === 'string' ? obj.repoContextName : null;

  return { messages, conversationHistory, repoContextName };
}

/** Nombre de fichero sugerido: por repo si lo hay, si no por fecha. */
export function conversationFilename(repoContextName: string | null): string {
  if (repoContextName) {
    const safe = repoContextName.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
    return `conversacion-${safe || 'repo'}.json`;
  }
  return `conversacion-${new Date().toISOString().slice(0, 10)}.json`;
}
