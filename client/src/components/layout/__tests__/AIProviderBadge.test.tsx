import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Estado mutable del contexto de IA, leído por el mock en cada render.
const mockState: {
  provider: 'groq' | 'gemini' | null;
  model: string | null;
  isConnected: boolean;
  disconnect: () => void;
} = {
  provider: 'groq',
  model: 'openai/gpt-oss-20b',
  isConnected: true,
  disconnect: vi.fn(),
};

vi.mock('../../../context/AIProviderContext', () => ({
  useAIProvider: () => mockState,
}));

import AIProviderBadge from '../AIProviderBadge';

describe('AIProviderBadge', () => {
  it('muestra el proveedor y la etiqueta amigable del modelo cuando está conectado', () => {
    Object.assign(mockState, {
      provider: 'groq',
      model: 'openai/gpt-oss-20b',
      isConnected: true,
    });
    render(<AIProviderBadge />);
    // "⚡ Groq · GPT-OSS 20B (fast)" (etiqueta amigable, no el id crudo)
    expect(screen.getByText(/Groq · GPT-OSS 20B/)).toBeInTheDocument();
  });

  it('invoca disconnect al hacer clic o al pulsar Enter', () => {
    const disconnectMock = vi.fn();
    Object.assign(mockState, {
      provider: 'groq',
      model: 'openai/gpt-oss-20b',
      isConnected: true,
      disconnect: disconnectMock,
    });
    render(<AIProviderBadge />);
    const badge = screen.getByRole('button');
    
    fireEvent.click(badge);
    expect(disconnectMock).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(badge, { key: 'Enter' });
    expect(disconnectMock).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(badge, { key: 'Escape' });
    expect(disconnectMock).toHaveBeenCalledTimes(2);
  });

  it('no renderiza nada si no hay conexión', () => {
    Object.assign(mockState, { isConnected: false });
    const { container } = render(<AIProviderBadge />);
    expect(container).toBeEmptyDOMElement();
  });
});

