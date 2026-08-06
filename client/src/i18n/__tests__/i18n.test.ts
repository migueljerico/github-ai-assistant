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
    it(`el diccionario ${code} debería tener entradas válidas sin valores undefined`, () => {
      expect(dict).toBeDefined();
      expect(Object.keys(dict).length).toBeGreaterThan(0);

      Object.entries(dict).forEach(([key, val]) => {
        expect(key).toBeTruthy();
        expect(typeof val).toBe('string');
      });
    });
  });

  it('el diccionario en debería contener las claves principales del máster es', () => {
    const essentialKeys = [
      'header.title',
      'header.subtitle',
      'chat.mode.auto',
      'chat.mode.chat',
      'chat.mode.action',
      'auth.title',
    ];

    essentialKeys.forEach((key) => {
      expect(en).toHaveProperty(key);
      expect(typeof (es as Record<string, string>)[key]).toBe('string');
    });
  });
});
