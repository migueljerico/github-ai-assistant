import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // #26 (v3.51.0): umbral mínimo de cobertura que frena regresiones en CI.
      // El job `test` de `.github/workflows/ci.yml` corre `npm run test:coverage`
      // y ahora rompe si alguna métrica baja del 70%.
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
      // Réplicas de `codecov.yml` (glue/presentación con ~0% por diseño).
      // Si no se excluyen aquí, el threshold tira el % global por debajo del 70%.
      exclude: [
        'src/App.tsx',
        'src/main.tsx',
        'src/components/dashboard/CodeHealthCharts.tsx',
      ],
    },
  },
});
