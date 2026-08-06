import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';
import { es } from '../i18n/es';

// Cast a Record<string, string> para poder indexar con strings dinámicos sin error de TS
const dict = es as Record<string, string>;

export const LANGUAGES = [
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh', name: 'Chinese', nativeName: '中文 (简体)' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
];

// Mock global del LanguageContext para todos los tests
vi.mock('../context/LanguageContext', () => ({
  LANGUAGES: [
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'zh', name: 'Chinese', nativeName: '中文 (简体)' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
    { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
    { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский' },
    { code: 'de', name: 'German', nativeName: 'Deutsch' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  ],
  useLanguage: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      let translation = dict[key] || key;
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

// #71: Mock global del ThemeContext para todos los tests. ThemeProvider es
// passthrough (no toca el DOM real) y useTheme devuelve un estado oscuro fijo,
// estableciendo un matchMedia stub por si la hidratación lo consulta.
vi.mock('../context/ThemeContext', () => ({
  ThemeProvider: ({ children }: any) => children,
  useTheme: () => ({
    theme: 'dark',
    resolvedTheme: 'dark',
    setTheme: vi.fn(),
    toggle: vi.fn(),
  }),
}));

// Limpia localStorage entre tests para evitar contaminación de estado persistido
beforeEach(() => {
  localStorage.clear();
});
