import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FlagIcon from '../FlagIcon';
import type { Language } from '../../../context/LanguageContext';

describe('FlagIcon', () => {
  const languages: Language[] = [
    'es',
    'en',
    'zh',
    'hi',
    'fr',
    'ar',
    'bn',
    'pt',
    'id',
    'ur',
    'ru',
    'de',
    'ja',
  ];

  languages.forEach((code) => {
    it(`debería renderizar la bandera SVG correctamente para el idioma ${code}`, () => {
      const { container } = render(<FlagIcon code={code} size={20} />);
      const svgElement = container.querySelector('svg');
      expect(svgElement).toBeInTheDocument();
    });
  });

  it('debería renderizar icono fallback para código de idioma desconocido', () => {
    const { getByText } = render(<FlagIcon code="unknown" size={20} />);
    expect(getByText('🌐')).toBeInTheDocument();
  });
});
