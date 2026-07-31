/**
 * Tests E2E del selector de idioma (ES↔EN).
 *
 * El LanguageSelector (<select aria-label="Select language">) está en el Header,
 * tras los gates. Idioma por defecto: 'es'. La preferencia se persiste en
 * sessionStorage('app-lang') (no localStorage; es preferencia de sesión).
 *
 * Verifica que cambiar el idioma actualiza los textos visibles del Header en
 * caliente, sin recarga: las etiquetas de los botones y el título de la app.
 * Aísla el comportamiento del LanguageContext (t() reactiva al estado `lang`).
 */
import { expect, test } from '@playwright/test';
import { connectProvider, goAuthed, mockGeminiChat } from './fixtures';

test.describe('Selector de idioma ES↔EN', () => {
  test.beforeEach(async ({ page }) => {
    await mockGeminiChat(page, 'ok');
    await goAuthed(page);
    await connectProvider(page);
  });

  test('cambiar a EN actualiza los textos visibles del Header', async ({ page }) => {
    // Idioma por defecto: español. El título y subtítulo del header son estables
    // y no dependen del estado (siempre visibles una vez cruzados los gates).
    const headerTitle = page.locator('.header-title');
    await expect(headerTitle).toContainText('Asistente de IA de GitHub');

    // El select no tiene id pero sí aria-label determinista (LanguageSelector.tsx).
    const select = page.getByRole('combobox', { name: 'Select language' });
    await select.selectOption('en');

    // t() es reactiva al estado `lang`; el título cambia en caliente.
    await expect(headerTitle).toContainText('GitHub AI Assistant');
    await expect(headerTitle).toContainText('Multi-provider AI · GitHub API');
  });

  test('volver a ES restaura los textos', async ({ page }) => {
    const headerTitle = page.locator('.header-title');
    const select = page.getByRole('combobox', { name: 'Select language' });

    await select.selectOption('en');
    await expect(headerTitle).toContainText('GitHub AI Assistant');

    await select.selectOption('es');
    await expect(headerTitle).toContainText('Asistente de IA de GitHub');
  });
});
