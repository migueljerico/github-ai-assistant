/**
 * Tests E2E (#75) — flujo crítico del usuario en el navegador real.
 *
 * Cubren los 3 escenarios propuestos en MEJORAS_FUTURAS.md #75:
 *  1. Camino feliz de chat: carga → auth (mock) → provider → envío → respuesta visible.
 *  2. Acción confirmada con diff: instrucción → ConfirmModal → confirmar → ejecución.
 *  3. Proveedor falla: error accionable en la UI (no un stack trace crudo).
 *
 * El servidor (Express en :3300) lo arranca automáticamente playwright.config.ts.
 * Toda la red externa (api.github.com) y los proxies IA (/api/gemini) se mockean
 * por página con page.route; no hay credenciales reales implicadas.
 */
import { expect, test } from '@playwright/test';
import {
  buildActionResponse,
  connectProvider,
  goAuthed,
  mockGeminiChat,
  sendInstruction,
} from './fixtures';

test.describe('#75 — Flujo E2E crítico', () => {
  test('1) camino feliz: auth → provider → chat con respuesta visible', async ({ page }) => {
    const reply = 'Hola, soy la respuesta mockeada del asistente.';
    await mockGeminiChat(page, reply);
    await goAuthed(page);
    await connectProvider(page);

    // Forzamos modo Opinión (chat) para que la instrucción vaya por el camino de
    // texto conversacional y la respuesta se muestre tal cual (#75.1). En Auto,
    // una instrucción sin verbos de opinión/acción se resolvería a 'action'.
    await page.getByRole('button', { name: /^💬/ }).first().click();
    await sendInstruction(page, 'Hola, ¿qué opinas?');
    // La respuesta se renderiza como un mensaje de rol assistant (.message.assistant)
    // dentro de .message-bubble (ver components/chat/ChatMessage.tsx).
    await expect(
      page.locator('.message.assistant .message-bubble').filter({ hasText: reply }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('2) acción confirmada con diff → confirmar → ejecución', async ({ page }) => {
    // La IA devuelve el JSON de una acción de escritura (PUT) que requiere confirmación.
    // parseGeminiActionWithReason → isValidAction → requiereConfirmacion → abre ConfirmModal.
    await mockGeminiChat(page, buildActionResponse());
    await goAuthed(page);
    await connectProvider(page);

    // GitHub va directo del navegador (github.ts BASE=api.github.com). Interceptamos
    // el PUT sobre contents/ que dispara executeAction al confirmar, para que devuelva
    // 200 con el { content: { sha } } que espera createOrUpdateFile (github.ts:323).
    let actionExecuted = false;
    await page.route('**/api.github.com/repos/**/contents/**', async route => {
      actionExecuted = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: { sha: 'e2e-fake-sha' } }),
      });
    });

    await sendInstruction(page, 'Añade una sección de pruebas al README');

    // El ConfirmModal se abre (requiereConfirmacion:true) mostrando el diff.
    const modal = page.locator('.overlay[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 15_000 });
    // El diff debe contener la parte añadida (contenidoPropuesto nuevo).
    await expect(modal).toContainText('Pruebas');

    // Confirmar dispara executeAction → PUT a api.github.com.
    await page.locator('#confirm-action-btn').click();

    // La acción real contra GitHub se ejecutó (PUT interceptado).
    await expect.poll(() => actionExecuted, { timeout: 15_000 }).toBe(true);
    // El modal se cierra tras la ejecución.
    await expect(modal).toBeHidden({ timeout: 15_000 });
  });

  test('3) proveedor falla → error accionable (sin stack trace crudo)', async ({ page }) => {
    // La validación del provider (validateProviderKey) llama POST /api/gemini con un
    // mensaje dummy 'Hi'; debe responder 200 para que connectProvider abra <App>.
    // El chat real del usuario sí debe fallar: distinguimos por el contenido del body.
    // El mensaje del usuario ("Haz algo") aparece en messages; el de validación no.
    await mockGeminiChat(page, body => {
      const isValidation = JSON.stringify(body).includes('Reply with one word.');
      if (isValidation) return 'ok'; // valida el provider → gate se abre
      // Chat real: el proxy responde 504 { error } (timeout del backend, index.js:273).
      // Es transitorio (5xx) → withTransientRetry lo reintenta; al no haber respuesta
      // válida termina abortado y la UI muestra el mensaje accionable de timeout
      // (chat.generationTimeout), que es justo el caso "tarda demasiado" de #75.
      return { status: 504, body: { error: 'upstream timeout' } };
    });
    await goAuthed(page);
    await connectProvider(page);

    await sendInstruction(page, 'Haz algo');

    // #75 pide "error accionable, no un stack trace crudo". La app tiene DOS mensajes
    // accionables para fallos de proveedor: el de contacto (chat.contactError) y el de
    // timeout (chat.generationTimeout). Aceptamos cualquiera de los dos; lo que sí
    // garantizamos es que NO se filtre un stack trace al usuario.
    const errorBubble = page.locator('.message.assistant .message-bubble');
    await expect(errorBubble).toBeVisible({ timeout: 15_000 });
    await expect(errorBubble).toHaveText(/La IA tardó demasiado|Error al contactar con el asistente/, {
      timeout: 15_000,
    });
    // Garantía anti-regresión: no se filtra un stack trace al usuario.
    await expect(errorBubble).not.toContainText(' at ');
  });
});
