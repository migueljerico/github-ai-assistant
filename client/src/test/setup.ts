import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock global del LanguageContext para todos los tests
vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      let translation = key;
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
  LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
}));
