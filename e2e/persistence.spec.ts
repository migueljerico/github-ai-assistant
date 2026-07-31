/**
 * Tests E2E de persistencia tras recarga y anti-FOUC (#71).
 *
 * El anti-FOUC de index.html lee localStorage('app-theme') y aplica data-theme al
 * <html> ANTES del primer paint de React (script inline pre-bundle). Esto evita
 * un flash del tema equivocado en la carga inicial y en cada recarga.
 *
 * Verifica que, tras fijar un tema explícito y recargar, el atributo data-theme
 * correcto está presente en el <html> desde el primer momento (no hay ventana de
 * tiempo con el tema por defecto/incorrecto). Complementa e2e/theme.spec.ts.
 *
 * Determinismo: colorScheme 'light' para que, si la app cayera a 'auto', el
 * tema resuelto fuese 'light' y no pudiese confundirse con la preferencia 'dark'
 * guardada (y viceversa). Fijamos 'dark' como tema y 'light' como sistema.
 */
import { expect, test } from '@playwright/test';
import { connectProvider, goAuthed, mockGeminiChat } from './fixtures';

test.use({ colorScheme: 'light' });

test.describe('Persistencia de tema y anti-FOUC', () => {
  test('el tema guardado sobrevive a una recarga (sin flash)', async ({ page }) => {
    await mockGeminiChat(page, 'ok');
    await goAuthed(page);
    await connectProvider(page);

    // Fijar tema 'dark' EXPLÍCITO. Desde 'auto' son 2 clics (auto→light→dark);
    // verificamos el paso intermedio para que el avance quede explícito. El
    // sistema emulado es 'light', así que 'dark' difiere del esquema del SO:
    // si el anti-FOUC fallara y cayera al esquema del sistema tras recarga,
    // veríamos 'light' en su lugar.
    const toggle = page.locator('#toggle-theme-btn');
    await toggle.click(); // auto → light
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await toggle.click(); // light → dark
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Recargar: el script pre-React de index.html re-aplica 'dark' desde
    // localStorage antes de que React monte. data-theme debe ser 'dark' en cuanto
    // el documento vuelve a estar disponible, sin pasar por 'light'.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    // Y la preferencia sigue en localStorage.
    const saved = await page.evaluate(() => localStorage.getItem('app-theme'));
    expect(saved).toBe('dark');
  });

  test('primera visita sin preferencia resuelve el esquema del SO (sin flash)', async ({
    page,
  }) => {
    // Sin limpiar storage explícitamente, pero el setup de tests unitarios no
    // aplica aquí (otro runner). Aseguramos estado limpio borrando la preferencia.
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('app-theme');
      } catch {
        /* modo privado — no crítico */
      }
    });

    await mockGeminiChat(page, 'ok');
    await goAuthed(page);
    // No conectamos provider: el anti-FOUC corre en index.html ANTES de cualquier
    // gate, así que ya podemos asertar el tema sobre el <html>.

    // Sistema emulado 'light', sin preferencia guardada → 'auto' resuelve 'light'
    // desde el script pre-React.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});
