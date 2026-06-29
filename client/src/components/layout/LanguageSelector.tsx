import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

export const LanguageSelector: React.FC = () => {
  const { lang, setLang } = useLanguage();
  
  return (
    <select 
      value={lang} 
      onChange={(e) => setLang(e.target.value as 'es' | 'en')}
      aria-label="Select language"
      style={{ marginLeft: '8px', cursor: 'pointer' }}
    >
      <option value="es">🇪🇸 ES</option>
      <option value="en">🇬🇧 EN</option>
    </select>
  );
};
