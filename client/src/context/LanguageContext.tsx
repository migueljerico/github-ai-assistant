import React, { createContext, useContext, useState, useCallback } from 'react';
import { es } from '../i18n/es';
import { en } from '../i18n/en';

export type Language = 'es' | 'en';
type Dictionary = Record<string, string>;

const dictionaries: Record<Language, Dictionary> = { es, en };
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
    return saved || 'es'; // Por defecto español
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    sessionStorage.setItem(STORAGE_KEY, newLang);
  };

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    let translation = dictionaries[lang][key] || dictionaries['es'][key] || key;
    
    if (params) {
      Object.keys(params).forEach(param => {
        translation = translation.replace(new RegExp(`\\{${param}\\}`, 'g'), String(params[param]));
      });
    }
    return translation;
  }, [lang]);

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
