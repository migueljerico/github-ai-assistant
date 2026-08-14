import { describe, it, expect } from 'vitest';
import { formatResultData } from '../formatResult';

describe('formatResultData', () => {
  it('debería formatear array de repositorios', () => {
    const repos = [
      {
        name: 'repo1',
        full_name: 'user/repo1',
        description: 'Test repo',
        private: false,
        html_url: 'https://github.com/user/repo1',
        stargazers_count: 10,
        language: 'TypeScript',
        updated_at: '2026-01-15T00:00:00Z',
        fork: false,
      },
    ];

    const result = formatResultData(repos);
    expect(result).toContain('**repo1**');
    expect(result).toContain('🌐 Público');
    expect(result).toContain('⭐ 10');
    expect(result).toContain('TypeScript');
  });

  it('debería formatear repositorios privados y forks en array', () => {
    const repos = [
      {
        name: 'forked-repo',
        full_name: 'user/forked-repo',
        description: 'A fork',
        private: true,
        html_url: 'https://github.com/user/forked-repo',
        fork: true,
      },
    ];

    const result = formatResultData(repos);
    expect(result).toContain('Privado');
    expect(result).toContain('🍴 Fork');
  });

  it('debería manejar array vacío', () => {
    const result = formatResultData([]);
    expect(result).toBe('_No se encontraron resultados._');
  });

  it('debería formatear objeto de repositorio único', () => {
    const repo = {
      name: 'myrepo',
      full_name: 'user/myrepo',
      description: 'My project',
      private: true,
      html_url: 'https://github.com/user/myrepo',
      stargazers_count: 5,
      language: 'JavaScript',
    };

    const result = formatResultData(repo);
    expect(result).toContain('**user/myrepo**');
    expect(result).toContain('🔒 Privado');
    expect(result).toContain('⭐ Estrellas: 5');
  });

  it('debería formatear repositorio único público sin campos opcionales', () => {
    const repo = {
      name: 'public-repo',
      full_name: 'user/public-repo',
      private: false,
      html_url: 'https://github.com/user/public-repo',
    };

    const result = formatResultData(repo);
    expect(result).toContain('**user/public-repo**');
    expect(result).toContain('Público');
    expect(result).toContain('🔗 https://github.com/user/public-repo');
    expect(result).not.toContain('Lenguaje:');
    expect(result).not.toContain('⭐ Estrellas:');
  });


  it('debería manejar contenido de archivo', () => {
    const fileContent = {
      content: 'SGVsbG8gV29ybGQ=',
      encoding: 'base64',
    };

    const result = formatResultData(fileContent);
    expect(result).toContain('Contenido del archivo obtenido');
  });

  it('debería manejar string plano', () => {
    const result = formatResultData('Hello World');
    expect(result).toContain('```');
    expect(result).toContain('Hello World');
  });

  it('debería truncar strings planos mayores a 1500 caracteres', () => {
    const longStr = 'a'.repeat(1600);
    const result = formatResultData(longStr);
    expect(result).toContain('...');
  });

  it('debería manejar objeto genérico', () => {
    const obj = { foo: 'bar', baz: 123 };
    const result = formatResultData(obj);
    expect(result).toContain('**foo**: bar');
    expect(result).toContain('**baz**: 123');
  });

  it('debería manejar JSON fallback', () => {
    const complex = { nested: { deep: { value: 42 } } };
    const result = formatResultData(complex);
    expect(result).toContain('```json');
    expect(result).toContain('"nested"');
  });

  it('debería truncar JSON fallback mayores a 1200 caracteres', () => {
    const longObj = { nested: { deep: 'x'.repeat(1300) } };
    const result = formatResultData(longObj);
    expect(result).toContain('...');
  });
});


