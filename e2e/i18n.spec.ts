/**
 * Tests E2E del selector de idioma.
 *
 * El LanguageSelector (dropdown de React accesible con aria-label="Select language")
 * vive en el Header, tras los gates. Idioma por defecto: 'es'. La preferencia se persiste en
 * sessionStorage('app-lang') (no localStorage; es preferencia de sesión).
 *
 * Verifica que cambiar el idioma actualiza los textos visibles del Header en
 * caliente, sin recarga: las etiquetas de los botones y el título de la app.
 * Aísla el comportamiento del LanguageContext (t() reactiva al estado `lang`).
 */
import { expect, test } from '@playwright/test';
import { connectProvider, goAuthed, mockGeminiChat } from './fixtures';

test.describe('Selector de idioma multilingüe (13 idiomas)', () => {
  test.beforeEach(async ({ page }) => {
    await mockGeminiChat(page, 'ok');
    await goAuthed(page);
    await connectProvider(page);
  });

  test('cambiar a EN actualiza los textos visibles del Header', async ({ page }) => {
    // Idioma por defecto: español. El título y subtítulo del header son estables.
    const headerTitle = page.locator('.header-title');
    await expect(headerTitle).toContainText('Asistente de IA de GitHub');

    // Botón desplegable de idioma
    const langBtn = page.getByRole('button', { name: 'Select language' });
    await langBtn.click();

    // Seleccionar English (EN)
    const enOption = page.getByRole('option', { name: /English/i });
    await enOption.click();

    // t() es reactiva al estado `lang`; el título cambia en caliente.
    await expect(headerTitle).toContainText('GitHub AI Assistant');
    await expect(headerTitle).toContainText('Multi-provider AI · GitHub API');
  });

  test('volver a ES restaura los textos', async ({ page }) => {
    const headerTitle = page.locator('.header-title');
    const langBtn = page.getByRole('button', { name: 'Select language' });

    // Cambiar a EN
    await langBtn.click();
    await page.getByRole('option', { name: /English/i }).click();
    await expect(headerTitle).toContainText('GitHub AI Assistant');

    // Cambiar de nuevo a ES
    await langBtn.click();
    await page.getByRole('option', { name: /Español/i }).click();
    await expect(headerTitle).toContainText('Asistente de IA de GitHub');
  });
});
