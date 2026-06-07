import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../../types';
import ChatMessageBubble from './ChatMessage';

interface ChatAreaProps {
  messages: ChatMessage[];
}

export default function ChatArea({ messages }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="chat-messages">
        <div className="chat-welcome">
          <div className="chat-welcome-icon">🤖</div>
          <h2 className="gradient-text">Asistente de IA para Publicar Repositorios</h2>
          <p>
            Escribe una instrucción en lenguaje natural y el asistente gestionará
            tus repositorios de GitHub por ti. Puedes crear archivos, actualizar
            READMEs, añadir licencias, y mucho más.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
            {[
              '"Crea un README.md para mi repo my-project"',
              '"Añade una licencia MIT a all-projects"',
              '"Lista mis repositorios públicos"',
            ].map(example => (
              <div
                key={example}
                style={{
                  padding: '8px 14px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  cursor: 'default',
                }}
              >
                {example}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-messages" role="log" aria-live="polite" aria-label="Conversación">
      {messages.map(msg => (
        <ChatMessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
