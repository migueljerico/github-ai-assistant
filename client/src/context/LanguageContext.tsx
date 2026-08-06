import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { es } from '../i18n/es';
import { en } from '../i18n/en';
import { zh } from '../i18n/zh';
import { hi } from '../i18n/hi';
import { fr } from '../i18n/fr';
import { ar } from '../i18n/ar';
import { bn } from '../i18n/bn';
import { pt } from '../i18n/pt';
import { id } from '../i18n/id';
import { ur } from '../i18n/ur';
import { ru } from '../i18n/ru';
import { de } from '../i18n/de';
import { ja } from '../i18n/ja';

export type Language =
  | 'es'
  | 'en'
  | 'zh'
  | 'hi'
  | 'fr'
  | 'ar'
  | 'bn'
  | 'pt'
  | 'id'
  | 'ur'
  | 'ru'
  | 'de'
  | 'ja';

export interface LanguageOption {
  code: Language;
  name: string;
  nativeName: string;
}

export const LANGUAGES: LanguageOption[] = [
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

type Dictionary = Record<string, string>;

const dictionaries: Record<Language, Dictionary> = {
  es,
  en,
  zh,
  hi,
  fr,
  ar,
  bn,
  pt,
  id,
  ur,
  ru,
  de,
  ja,
};

const STORAGE_KEY = 'app-lang';

interface LanguageContextValue {
  lang: Language;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLang: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY) as Language | null;
    if (saved && saved in dictionaries) {
      return saved;
    }
    return 'es'; // Por defecto español
  });

  const updateDocumentAttributes = (targetLang: Language) => {
    const isRtl = targetLang === 'ar' || targetLang === 'ur';
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = targetLang;
  };

  useEffect(() => {
    updateDocumentAttributes(lang);
  }, [lang]);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    sessionStorage.setItem(STORAGE_KEY, newLang);
    updateDocumentAttributes(newLang);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const activeDict = dictionaries[lang] || dictionaries['es'];
      let translation = activeDict[key] || dictionaries['es'][key] || key;

      if (params) {
        Object.keys(params).forEach((param) => {
          translation = translation.replace(new RegExp(`\\{${param}\\}`, 'g'), String(params[param]));
        });
      }
      return translation;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, t, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
