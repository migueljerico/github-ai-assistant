import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('ChatMessageBubble — archivos consultados (#51)', () => {
  it('muestra la lista plegable cuando consultedFiles está presente', () => {
    render(<ChatMessageBubble message={msg({
      isLoading: false,
      content: 'Respuesta',
      consultedFiles: ['src/index.ts', 'README.md'],
    })} />);
    // El summary lleva el texto de la clave i18n (ES por defecto) + el conteo.
    expect(screen.getByText(/Archivos consultados para esta respuesta/)).toBeInTheDocument();
    expect(screen.getByText(/README\.md/)).toBeInTheDocument();
    expect(screen.getByText(/src\/index\.ts/)).toBeInTheDocument();
  });

  it('no muestra la lista cuando consultedFiles está vacío o ausente', () => {
    const { rerender } = render(<ChatMessageBubble message={msg({ content: 'x' })} />);
    expect(screen.queryByText(/Archivos consultados/)).not.toBeInTheDocument();
    rerender(<ChatMessageBubble message={msg({ content: 'x', consultedFiles: [] })} />);
    expect(screen.queryByText(/Archivos consultados/)).not.toBeInTheDocument();
  });
});

describe('ChatMessageBubble — botón 1-clic de cambio de modo (v3.56.0)', () => {
  it('no muestra el botón cuando el mensaje no lleva actionMode', () => {
    render(<ChatMessageBubble message={msg({ content: 'Hola' })} onSwitchMode={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /cambiar a modo/i })).not.toBeInTheDocument();
  });

  it('no muestra el botón aunque haya actionMode si no se pasa onSwitchMode', () => {
    // Retrocompatibilidad: sin callback, no se renderiza el botón accionable.
    render(<ChatMessageBubble message={msg({
      content: 'Necesitas el modo Acción',
      actionMode: { mode: 'action', retryText: 'crea un README' },
    })} />);
    expect(screen.queryByRole('button', { name: /cambiar a modo/i })).not.toBeInTheDocument();
  });

  it('muestra el botón "Cambiar a modo Acción" cuando actionMode.mode = action', () => {
    render(<ChatMessageBubble
      message={msg({
        content: 'Para crear archivos necesito el modo Acción.',
        actionMode: { mode: 'action', retryText: 'crea un archivo README.md' },
      })}
      onSwitchMode={vi.fn()}
    />);
    expect(screen.getByRole('button', { name: /⚡ Cambiar a modo Acción/i })).toBeInTheDocument();
  });

  it('muestra el botón "Cambiar a modo Opinión" cuando actionMode.mode = chat', () => {
    render(<ChatMessageBubble
      message={msg({
        content: 'Eso suena a opinión.',
        actionMode: { mode: 'chat', retryText: '¿qué opinas del repo?' },
      })}
      onSwitchMode={vi.fn()}
    />);
    expect(screen.getByRole('button', { name: /💬 Cambiar a modo Opinión/i })).toBeInTheDocument();
  });

  it('al pulsar el botón llama onSwitchMode con el modo y el retryText', () => {
    const onSwitchMode = vi.fn();
    render(<ChatMessageBubble
      message={msg({
        content: 'Para crear archivos necesito el modo Acción.',
        actionMode: { mode: 'action', retryText: 'crea un archivo README.md' },
      })}
      onSwitchMode={onSwitchMode}
    />);
    fireEvent.click(screen.getByRole('button', { name: /cambiar a modo acción/i }));
    expect(onSwitchMode).toHaveBeenCalledWith('action', 'crea un archivo README.md');
  });
});
