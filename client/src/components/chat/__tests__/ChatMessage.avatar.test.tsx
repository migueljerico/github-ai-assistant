import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ── #26 (v4.0.52): cubre el avatar de usuario real (con/sin `avatar_url`) y el
// formato de hora en-US (rama `lang === 'en'`). El resto de ficheros del panel
// sigue con el mock global del setup (useLanguage lang='es' fijo); aquí usamos
// el LanguageContext REAL para fijar lang='en' vía sessionStorage (mismo patrón
// que ThemeContext.test.tsx / LanguageContext.test.tsx).
vi.unmock('../../../context/LanguageContext');

const authState = vi.hoisted(() => ({
  user: null as null | { login: string; avatar_url?: string },
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: authState.user, isAuthenticated: authState.user !== null }),
}));

import { LanguageProvider } from '../../../context/LanguageContext';
import ChatMessageBubble from '../ChatMessage';
import type { ChatMessage } from '../../../types';

function userMsg(over: Partial<ChatMessage>): ChatMessage {
  return { id: '1', role: 'user', content: 'hola', timestamp: new Date(), ...over };
}

describe('ChatMessageBubble — avatar de usuario y formato de hora (#26, v4.0.52)', () => {
  beforeEach(() => {
    authState.user = null;
    sessionStorage.removeItem('app-lang');
  });

  it('usuario autenticado con avatar_url: renderiza la imagen del avatar', () => {
    authState.user = { login: 'ana', avatar_url: 'https://github.com/ana.png' };
    const { container } = render(
      <LanguageProvider>
        <ChatMessageBubble message={userMsg({})} />
      </LanguageProvider>,
    );

    const img = container.querySelector('.message-avatar img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', 'https://github.com/ana.png');
    expect(img).toHaveAttribute('alt', 'ana');
  });

  it('usuario autenticado SIN avatar_url: avatar con el emoji 👤 (sin <img>)', () => {
    authState.user = { login: 'leo' };
    const { container } = render(
      <LanguageProvider>
        <ChatMessageBubble message={userMsg({})} />
      </LanguageProvider>,
    );

    expect(container.querySelector('.message-avatar img')).toBeNull();
    expect(container.querySelector('.message-avatar')).toHaveTextContent('👤');
  });

  it('lang en: la hora se formatea en-US (sufijo AM/PM en inglés)', () => {
    sessionStorage.setItem('app-lang', 'en');
    render(
      <LanguageProvider>
        <ChatMessageBubble message={userMsg({ timestamp: new Date('2026-06-27T21:34:00') })} />
      </LanguageProvider>,
    );

    // en-US con hour12 → «9:34 PM»; el formato es-ES sería «9:34 p. m.»
    expect(screen.getByText(/9:34\s*PM/)).toBeInTheDocument();
  });
});
