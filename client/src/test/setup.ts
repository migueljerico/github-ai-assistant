import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';
import { es } from '../i18n/es';

// Cast a Record<string, string> para poder indexar con strings dinámicos sin error de TS
const dict = es as Record<string, string>;

// Mock global del LanguageContext para todos los tests
vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      let translation = dict[key] || key;
      if (params) {
        Object.keys(params).forEach(param => {
          // eslint-disable-next-line no-useless-escape
          translation = translation.replace(new RegExp(`\{${param}\}`, 'g'), String(params[param]));
        });
      }
      return translation;
    },
    lang: 'es',
    setLang: vi.fn(),
  }),
  LanguageProvider: ({ children }: any) => children,
}));

// Limpia localStorage entre tests para evitar contaminación de estado persistido
beforeEach(() => {
  localStorage.clear();
});
