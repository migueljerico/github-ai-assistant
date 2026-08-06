import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.unmock('../../../context/LanguageContext');

import { render, screen, fireEvent } from '@testing-library/react';
import LanguageSelector from '../LanguageSelector';
import { LanguageProvider, useLanguage } from '../../../context/LanguageContext';

const TestConsumer = () => {
  const { lang, t } = useLanguage();
  return (
    <div>
      <span data-testid="current-lang">{lang}</span>
      <span data-testid="translated-title">{t('header.title')}</span>
      <LanguageSelector />
    </div>
  );
};

describe('LanguageSelector', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('debería renderizar el botón selector de idioma', () => {
    render(
      <LanguageProvider>
        <LanguageSelector />
      </LanguageProvider>
    );

    const button = screen.getByRole('button', { name: /select language/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('ES');
  });

  it('debería abrir el desplegable con las 13 opciones de idioma al pulsar', () => {
    render(
      <LanguageProvider>
        <LanguageSelector />
      </LanguageProvider>
    );

    const button = screen.getByRole('button', { name: /select language/i });
    fireEvent.click(button);

    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(13);
  });

  it('debería cambiar de idioma al hacer clic en una opción (ej: Francés FR)', () => {
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('current-lang')).toHaveTextContent('es');

    const button = screen.getByRole('button', { name: /select language/i });
    fireEvent.click(button);

    const options = screen.getAllByRole('option');
    const frOption = options.find((opt) => opt.textContent?.includes('Français'));
    expect(frOption).toBeDefined();

    fireEvent.click(frOption!);

    expect(screen.getByTestId('current-lang')).toHaveTextContent('fr');
    expect(screen.getByTestId('translated-title')).toHaveTextContent('Assistant IA GitHub');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('debería cerrar el desplegable con la tecla Escape', () => {
    render(
      <LanguageProvider>
        <LanguageSelector />
      </LanguageProvider>
    );

    const button = screen.getByRole('button', { name: /select language/i });
    fireEvent.click(button);

    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
