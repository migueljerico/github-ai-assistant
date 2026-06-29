import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { es } from '../i18n/es'; // Importamos el diccionario real

// Mock global del LanguageContext para todos los tests
vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      // Si la clave existe en el diccionario, devuelve su traducción. Si no, la clave misma.
      let translation = es[key] || key;
      if (params) {
        Object.keys(params).forEach(param => {
          translation = translation.replace(new RegExp(`\\{${param}\\}`, 'g'), String(params[param]));
        });
      }
      return translation;
    },
    lang: 'es',
    setLang: vi.fn(),
  }),
  LanguageProvider: ({ children }: any) => children,
}));
