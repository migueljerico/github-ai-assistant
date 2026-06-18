import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChatArea from '../ChatArea';
import type { ChatMessage } from '../../../types';

// Mock de ChatMessageBubble
vi.mock('../ChatMessage', () => ({
  default: ({ message }: any) => (
    <div data-testid={`message-${message.id}`}>
      {message.role}: {message.content}
    </div>
  ),
}));

describe('ChatArea', () => {
  it('debería mostrar mensaje de bienvenida cuando no hay mensajes', () => {
    render(<ChatArea messages={[]} />);
    
    expect(screen.getByText(/asistente de ia para publicar repositorios/i)).toBeInTheDocument();
    expect(screen.getByText(/escribe una instrucción en lenguaje natural/i)).toBeInTheDocument();
  });

  it('debería mostrar ejemplos de uso en el mensaje de bienvenida', () => {
    render(<ChatArea messages={[]} />);
    
    expect(screen.getByText(/"crea un readme.md para mi repo my-project"/i)).toBeInTheDocument();
    expect(screen.getByText(/"añade una licencia mit a all-projects"/i)).toBeInTheDocument();
    expect(screen.getByText(/"lista mis repositorios públicos"/i)).toBeInTheDocument();
  });

  it('debería renderizar mensajes cuando hay mensajes', () => {
    const messages: ChatMessage[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hola',
        timestamp: new Date(),
      },
      {
        id: '2',
        role: 'assistant',
        content: 'Hola, ¿cómo puedo ayudarte?',
        timestamp: new Date(),
      },
    ];

    render(<ChatArea messages={messages} />);
    
    expect(screen.getByTestId('message-1')).toBeInTheDocument();
    expect(screen.getByTestId('message-2')).toBeInTheDocument();
    expect(screen.getByText(/user: Hola/i)).toBeInTheDocument();
    expect(screen.getByText(/assistant: Hola, ¿cómo puedo ayudarte\?/i)).toBeInTheDocument();
  });

  it('NO debería mostrar mensaje de bienvenida cuando hay mensajes', () => {
    const messages: ChatMessage[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hola',
        timestamp: new Date(),
      },
    ];

    render(<ChatArea messages={messages} />);
    
    expect(screen.queryByText(/asistente de ia para publicar repositorios/i)).not.toBeInTheDocument();
  });

  it('debería tener role="log" para accesibilidad', () => {
    const messages: ChatMessage[] = [
      {
        id: '1',
        role: 'user',
        content: 'Test',
        timestamp: new Date(),
      },
    ];

    render(<ChatArea messages={messages} />);
    
    expect(screen.getByRole('log')).toBeInTheDocument();
  });
});
