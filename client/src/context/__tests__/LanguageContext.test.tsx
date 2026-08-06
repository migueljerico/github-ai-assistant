import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.unmock('../../context/LanguageContext');

import { render, screen, fireEvent, renderHook } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '../LanguageContext';

const TestComponent = () => {
  const { lang, t, setLang } = useLanguage();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="title">{t('header.title')}</span>
      <span data-testid="translated-param">{t('aipanel.connectWith', { provider: 'Gemini' })}</span>
      <button onClick={() => setLang('ar')}>Set Arabic</button>
      <button onClick={() => setLang('ja')}>Set Japanese</button>
    </div>
  );
};

describe('LanguageContext', () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'es';
  });

  it('debería inicializarse en español por defecto', () => {
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    expect(screen.getByTestId('lang')).toHaveTextContent('es');
    expect(screen.getByTestId('title')).toHaveTextContent('Asistente de IA de GitHub');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('debería cambiar el atributo dir="rtl" para idiomas RTL como el Árabe', () => {
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /set arabic/i }));

    expect(screen.getByTestId('lang')).toHaveTextContent('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('debería restaurar dir="ltr" para idiomas LTR como el Japonés', () => {
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /set arabic/i }));
    expect(document.documentElement.dir).toBe('rtl');

    fireEvent.click(screen.getByRole('button', { name: /set japanese/i }));
    expect(screen.getByTestId('lang')).toHaveTextContent('ja');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('ja');
  });

  it('debería interpolar parámetros correctamente en t()', () => {
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    expect(screen.getByTestId('translated-param')).toHaveTextContent('Conectar con Gemini');
  });

  it('debería guardar la preferencia en sessionStorage', () => {
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /set japanese/i }));
    expect(sessionStorage.getItem('app-lang')).toBe('ja');
  });

  it('debería lanzar error si useLanguage se usa fuera del LanguageProvider', () => {
    expect(() => renderHook(() => useLanguage())).toThrow(
      'useLanguage must be used within a LanguageProvider'
    );
  });
});
