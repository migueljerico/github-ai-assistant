import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Artefactos y cobertura: no se lintean
  { ignores: ['dist', 'coverage'] },

  // Código de la aplicación (TypeScript + React)
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Reglas nuevas de eslint-plugin-react-hooks v7 y typescript-eslint 8.64
      // (introducidas al subir ESLint 9→10 en #77). Las degradamos a 'warn'
      // porque señalan patrones legítimos y muy extendidos en este codebase
      // (setState en effects de inicialización, refs que guardan la última
      // prop sin re-suscribir, asignaciones dentro de closures de .map() que
      // el linter no puede seguir). Visible en CI para revisión gradual,
      // sin bloquear el hotfix de main. Revisar caso a caso fuera de este fix.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },

  // Tests: añaden los globals de Vitest/Testing Library y relajan `any`,
  // habitual en mocks (vi.fn(), `as any`, stubs de fetch global).
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Ficheros de configuración del entorno Node (Vite/Vitest)
  {
    files: ['vite.config.ts', 'vitest.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
);
