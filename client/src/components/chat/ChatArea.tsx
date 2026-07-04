import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../../types';
import ChatMessageBubble from './ChatMessage';
import { useLanguage } from '../../context/LanguageContext';

interface ChatAreaProps {
  messages: ChatMessage[];
}

export default function ChatArea({ messages }: ChatAreaProps) {
  const { t } = useLanguage();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="chat-messages">
        <div className="chat-welcome">
          <div className="chat-welcome-icon">🤖</div>
          <h2 className="gradient-text">{t('chat.area.title')}</h2>
          <p>{t('chat.area.intro')}</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
            {[
              t('chat.area.example1'),
              t('chat.area.example2'),
              t('chat.area.example3'),
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
    <div className="chat-messages" role="log" aria-live="polite" aria-label={t('chat.area.ariaLabel')}>
      {messages.map(msg => (
        <ChatMessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
