import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChatMessageBubble from '../ChatMessage';
import type { ChatMessage } from '../../../types';

// ChatMessage usa useAuth para el avatar; lo mockeamos.
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));

function msg(over: Partial<ChatMessage>): ChatMessage {
  return { id: '1', role: 'assistant', content: '', timestamp: new Date(), ...over };
}

describe('ChatMessageBubble — streaming (#38)', () => {
  it('isLoading sin contenido → muestra "Pensando..." (antes del primer token)', () => {
    render(<ChatMessageBubble message={msg({ isLoading: true, content: '' })} />);
    expect(screen.getByText(/Pensando/)).toBeInTheDocument();
  });

  it('isLoading CON contenido → muestra el texto en streaming, no el spinner', () => {
    render(<ChatMessageBubble message={msg({ isLoading: true, content: 'Respuesta parcial' })} />);
    expect(screen.getByText(/Respuesta parcial/)).toBeInTheDocument();
    expect(screen.queryByText(/Pensando/)).not.toBeInTheDocument();
  });

  it('sin isLoading → muestra el contenido final', () => {
    render(<ChatMessageBubble message={msg({ isLoading: false, content: 'Final' })} />);
    expect(screen.getByText(/Final/)).toBeInTheDocument();
  });
});
