import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config para los tests E2E (#75).
 *
 * Estrategia de servido: arquitectura real de producción. El `webServer` arranca
 * Express (`server/index.js`), que sirve `/api/*`, `/auth/*`, `/health` y el SPA
 * ya construido desde `client/dist`. Los tests apuntan a un único origen
 * (http://localhost:3300), sin proxy de Vite. Esto valida la integración cliente
 * + servidor tal como se despliega en Cloud Run, no solo el bundle de desarrollo.
 *
 * NOTA sobre NODE_ENV: NO se fija en `webServer.env`. `server/index.js` hace
 * `process.exit(1)` si NODE_ENV=production sin SESSION_SECRET (fail-loud #2).
 * Sin NODE_ENV, Express arranca en modo dev con el SESSION_SECRET por defecto,
 * que es justo lo que queremos para E2E.
 *
 * Se corre en SERIE (fullyParallel:false): los 3 specs mockean estado de red
 * global por página y comparten el webServer; ejecutarlos en paralelo podría
 * producir carreras. Como son solo 3 tests, el coste de tiempo es despreciable.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3300',
    trace: 'on-first-retry',
    // La app es una SPA sin URLs profundas; una navegación de más no hace daño
    // y evita flakes por transiciones de providers al montar.
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'node server/index.js',
    url: 'http://localhost:3300/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Puerto dedicado 3300: no choca con dev (3001 Express / 5173 Vite).
    // Placeholder de FRONTEND_URL: el CORS solo aplica a credenciales cross-origin;
    // los tests son same-origin (/api) y lo externo (api.github.com) va por page.route.
    env: {
      PORT: '3300',
      FRONTEND_URL: 'http://localhost:3300',
      GITHUB_CLIENT_ID: 'e2e-placeholder',
      GITHUB_CLIENT_SECRET: 'e2e-placeholder',
    },
  },
});
