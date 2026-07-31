/**
 * Tests E2E del toggle de tema (#71, v3.62.0).
 *
 * El toggle (#toggle-theme-btn) vive en el Header, tras AuthGate + AIProviderGate.
 * Reutilizamos goAuthed + connectProvider de fixtures.ts para cruzar ambos gates
 * mockeando la red, igual que hace e2e/chat.spec.ts (#75).
 *
 * Cubre lo que NO se pudo verificar visualmente al cerrar #71 (la app autenticada
 * no estaba disponible en ese entorno): ciclo claro→oscuro→auto, persistencia en
 * localStorage y reacción en vivo a prefers-color-scheme.
 *
 * Determinismo: test.use({ colorScheme: 'dark' }) fija el esquema del SO emulado
 * para todo el archivo. Así, en modo 'auto', el tema resuelto es predeciblemente
 * 'dark' y las aserciones no dependen del esquema del host que corre el test.
 */
import { expect, test } from '@playwright/test';
import { connectProvider, goAuthed, mockGeminiChat } from './fixtures';

test.use({ colorScheme: 'dark' });

test.describe('#71 — Toggle de tema claro/oscuro/auto', () => {
  test.beforeEach(async ({ page }) => {
    // El provider solo necesita validar (200) para abrir <App>; no hay chat aquí.
    await mockGeminiChat(page, 'ok');
    await goAuthed(page);
    await connectProvider(page);
  });

  test('ciclo claro → oscuro → auto aplica data-theme al <html>', async ({ page }) => {
    const toggle = page.locator('#toggle-theme-btn');

    // Estado inicial: sin preferencia guardada → 'auto' → resuelve a 'dark' (emulado).
    // El botón muestra el estado ACTUAL: 'auto' en ES = 'Automático'.
    await expect(toggle).toContainText('Automático');

    // Ciclo TOGGLE_ORDER = ['light','dark','auto']: auto → light → dark → auto.
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(toggle).toContainText('Claro');

    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toContainText('Oscuro');

    // De vuelta a 'auto': el tema resuelto vuelve a seguir al sistema ('dark').
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toContainText('Automático');
  });

  test('persiste la preferencia del usuario en localStorage', async ({ page }) => {
    // Fijar 'light' explícitamente (auto → light en un clic).
    await page.locator('#toggle-theme-btn').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // ThemeContext guarda en localStorage bajo la clave 'app-theme' (no es un
    // secreto: es preferencia de UI, no aplica la regla Zero-Storage).
    const saved = await page.evaluate(() => localStorage.getItem('app-theme'));
    expect(saved).toBe('light');
  });

  test('reacciona en vivo a prefers-color-scheme en modo auto', async ({ page }) => {
    // Estado inicial 'auto'; el sistema emulado es 'dark' → data-theme='dark'.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Cambiar el esquema del SO a 'light' en caliente: ThemeContext escucha el
    // evento 'change' de matchMedia y actualiza el tema resuelto SIN recarga.
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Volver a 'dark' → reacciona de nuevo (el listener sigue activo en 'auto').
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
