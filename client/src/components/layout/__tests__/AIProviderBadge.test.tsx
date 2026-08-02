import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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

  it('no renderiza nada si no hay conexión', () => {
    Object.assign(mockState, { isConnected: false });
    const { container } = render(<AIProviderBadge />);
    expect(container).toBeEmptyDOMElement();
  });
});
