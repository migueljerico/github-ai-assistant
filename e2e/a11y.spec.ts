/**
 * Tests E2E de accesibilidad (#72, v3.64.0): foco visible + movimiento reducido.
 *
 * Cubre dos criterios WCAG que no tenían verificación previa:
 *   - 2.4.7 Foco visible: el anillo :focus-visible tokenizado aparece al navegar
 *     por teclado. Antes de #72 los <div tabIndex> (#ai-provider-badge y las
 *     .provider-card) no tenían indicador de foco, y los inputs usaban un glow
 *     tenue no tokenizado.
 *   - 2.3.3 Animación al moverse: @media (prefers-reduced-motion: reduce)
 *     neutraliza animaciones y transiciones (incluidas las inline de TSX).
 *
 * Reutilizamos goAuthed + connectProvider de fixtures.ts (igual que theme.spec.ts).
 * Determinismo: el badge del proveedor (.ai-badge-dot con animation: pulse)
 * siempre está visible tras conectar, así que es un target estable para el test
 * de reduced-motion.
 *
 * Introduce el patrón toHaveCSS en la base E2E (antes solo se usaba
 * toHaveAttribute sobre data-theme y toContainText).
 */
import { expect, test } from '@playwright/test';
import { connectProvider, goAuthed, mockGeminiChat } from './fixtures';

test.describe('#72 — Accesibilidad: foco visible y movimiento reducido', () => {
  test.beforeEach(async ({ page }) => {
    // El provider solo necesita validar (200) para abrir <App>; no hay chat aquí.
    await mockGeminiChat(page, 'ok');
    await goAuthed(page);
    await connectProvider(page);
  });

  test('el anillo :focus-visible aparece al enfocar el textarea por teclado (WCAG 2.4.7)', async ({
    page,
  }) => {
    const textarea = page.locator('#chat-textarea');
    // Los text controls (<textarea>, <input> textuales) aplican :focus-visible
    // siempre que están enfocados (heurística de Chromium), incluso con foco
    // programático, porque el foco es siempre relevante al escribir.
    await textarea.focus();

    // El outline accesible se define globalmente con var(--focus-ring-color),
    // que resuelve a --accent-cyan = #22d3ee = rgb(34, 211, 238).
    await expect(textarea).toHaveCSS('outline-style', 'solid');
    await expect(textarea).toHaveCSS('outline-color', 'rgb(34, 211, 238)');
    await expect(textarea).toHaveCSS('outline-width', '2px');
  });

  test('el badge del proveedor (div tabIndex) muestra foco visible al recibirlo (WCAG 2.4.7)', async ({
    page,
  }) => {
    // Antes de #72, este <div role="button" tabIndex={0}> no tenía ningún estilo
    // de foco: el foco era invisible al recibirlo por teclado. Ahora lo cubre la
    // regla global :focus-visible.
    const badge = page.locator('#ai-provider-badge');
    await expect(badge).toBeVisible();

    // Enfocar por teclado: el badge está en el header, antes que el textarea.
    await page.keyboard.press('Tab');
    // Si el primer Tab no aterrizó en el badge, seguimos tabulando hasta que
    // el documento lo reporte como activeElement (robuato frente al orden de
    // tabulación concreto del header).
    for (let i = 0; i < 6; i++) {
      if (await badge.evaluate(el => el === document.activeElement)) break;
      await page.keyboard.press('Tab');
    }
    expect(await badge.evaluate(el => el === document.activeElement)).toBeTruthy();

    // :focus-visible aporta el anillo tokenizado también a este div no nativo.
    await expect(badge).toHaveCSS('outline-style', 'solid');
    await expect(badge).toHaveCSS('outline-color', 'rgb(34, 211, 238)');
  });

  test('prefers-reduced-motion neutraliza animaciones y transiciones (WCAG 2.3.3)', async ({
    page,
  }) => {
    // Activar la preferencia del SO en caliente (análogo a emulateMedia de
    // theme.spec.ts para prefers-color-scheme).
    await page.emulateMedia({ reducedMotion: 'reduce' });

    // .ai-badge-dot tiene `animation: pulse 2s infinite` (index.css). Con
    // reduced-motion, el bloque global fuerza animation-duration: 0.01ms, que
    // Chromium computa como "1e-05s" (notación científica) — efectivamente
    // instantáneo, no perceptible. Aceptamos ese valor o "0s".
    const dot = page.locator('.ai-badge-dot').first();
    await expect(dot).toHaveCSS('animation-duration', /^(0s|1e-05s)$/);

    // Un .btn del header tiene `transition: all var(--transition)` (0.2s).
    // Con reduced-motion, transition-duration cae a 0.01ms = "1e-05s".
    const headerBtn = page.locator('.header-right .btn').first();
    await expect(headerBtn).toHaveCSS('transition-duration', /^(0s|1e-05s)$/);
  });
});
