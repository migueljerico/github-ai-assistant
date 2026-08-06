import { describe, it, expect } from 'vitest';
import { es } from '../es';
import { en } from '../en';
import { zh } from '../zh';
import { hi } from '../hi';
import { fr } from '../fr';
import { ar } from '../ar';
import { bn } from '../bn';
import { pt } from '../pt';
import { id } from '../id';
import { ur } from '../ur';
import { ru } from '../ru';
import { de } from '../de';
import { ja } from '../ja';

describe('i18n dictionaries', () => {
  const dictionaries = {
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

  Object.entries(dictionaries).forEach(([code, dict]) => {
    it(`el diccionario ${code} debería contener el 100% de las claves del máster es (${Object.keys(es).length} claves)`, () => {
      expect(dict).toBeDefined();
      const masterKeys = Object.keys(es) as Array<keyof typeof es>;
      expect(Object.keys(dict).length).toBeGreaterThanOrEqual(masterKeys.length);

      masterKeys.forEach((key) => {
        expect(dict).toHaveProperty(key);
        expect(typeof (dict as Record<string, string>)[key]).toBe('string');
        expect((dict as Record<string, string>)[key].trim()).not.toBe('');
      });
    });
  });
});

