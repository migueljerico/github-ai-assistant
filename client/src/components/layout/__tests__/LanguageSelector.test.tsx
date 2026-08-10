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

  it('debería cerrar el desplegable al hacer clic fuera', () => {
    render(
      <LanguageProvider>
        <div>
          <button data-testid="outside">Outside</button>
          <LanguageSelector />
        </div>
      </LanguageProvider>
    );

    const button = screen.getByRole('button', { name: /select language/i });
    fireEvent.click(button);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('debería seleccionar idioma con la tecla Enter o Espacio', () => {
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>
    );

    const button = screen.getByRole('button', { name: /select language/i });
    fireEvent.click(button);

    const options = screen.getAllByRole('option');
    const enOption = options.find((opt) => opt.textContent?.includes('English'));
    expect(enOption).toBeDefined();

    fireEvent.keyDown(enOption!, { key: 'Enter' });
    expect(screen.getByTestId('current-lang')).toHaveTextContent('en');

    // Reopen and try Space
    fireEvent.click(button);
    const ptOption = screen.getAllByRole('option').find((opt) => opt.textContent?.includes('Português'));
    expect(ptOption).toBeDefined();
    fireEvent.keyDown(ptOption!, { key: ' ' });
    expect(screen.getByTestId('current-lang')).toHaveTextContent('pt');
  });

  it('cae al idioma por defecto (ES) si el valor del contexto es desconocido', () => {
    sessionStorage.setItem('app_language', 'xx_invalid');
    render(
      <LanguageProvider>
        <LanguageSelector />
      </LanguageProvider>
    );

    const button = screen.getByRole('button', { name: /select language/i });
    expect(button).toHaveTextContent('ES');
  });
});

