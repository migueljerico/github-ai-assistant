/**
 * Helpers reutilizables para los tests E2E (#75).
 *
 * La app tiene dos gates antes del chat: AuthGate (token GitHub) y
 * AIProviderGate (proveedor IA conectado). Estos helpers los cruzan mockeando
 * la red con page.route, SIN tocar el código de la app ni el servidor:
 *
 *   - AuthGate       → el token llega por #access_token=... en el hash (main.tsx),
 *                      y AuthContext lo valida contra GET https://api.github.com/user.
 *                      Mockeando esa ruta + navegar con el hash, pasamos el gate
 *                      ejerciendo el código real.
 *   - AIProviderGate → validateProviderKey dispara una llamada de chat real
 *                      (POST /api/gemini con {messages:[{content:'Hi'}]}). Mockeando
 *                      /api/gemini para responder 200, el botón "Conectar" pasa a
 *                      success y, tras ~800ms, isConnected=true muestra <App>.
 *
 * GitHub va DIRECTO del navegador (github.ts BASE = api.github.com), NO vía /api:
 * las acciones confirmadas y la lectura de archivos se mockean sobre api.github.com.
 */
import type { Page, Route } from '@playwright/test';

const GH_USER = {
  login: 'e2e-tester',
  name: 'E2E Tester',
  avatar_url: 'https://avatars.githubusercontent.com/u/0',
  html_url: 'https://github.com/e2e-tester',
};

/**
 * Intercepta la validación del token de GitHub (GET /user) para que AuthGate
 * considere la sesión autenticada. Devuelve 200 con un usuario fake.
 */
export async function mockGitHubAuth(page: Page) {
  await page.route('**/api.github.com/user', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(GH_USER) }),
  );
}

/**
 * Mockea cualquier otra llamada a api.github.com que los gates o App pudieran
 * disparar al montar (p.ej. /user/repos), para que no haya peticiones reales
 * colgadas contra el exterior durante el test. Devuelve payloads vacíos válidos.
 */
export async function mockGitHubBackground(page: Page) {
  await page.route('**/api.github.com/**', async (route: Route) => {
    const url = route.request().url();
    if (url.includes('/user/repos') || url.includes('/search') || url.includes('/repos/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

/**
 * Cruza el AuthGate: mockea /user y navega con un token en el hash (camino real
 * del OAuth callback). Al volver de la red, isAuthenticated=true.
 */
export async function goAuthed(page: Page) {
  await mockGitHubAuth(page);
  await mockGitHubBackground(page);
  await page.goto('/#access_token=e2e-mock-token');
}

/**
 * Mockea el endpoint de chat del proveedor por defecto (Gemini vía proxy /api/gemini).
 * Sirve tanto para la validación del provider (mensaje dummy 'Hi') como para el chat.
 *
 * Streaming: en modo chat la app pide `stream:true` (callGeminiDirect lee SSE,
 * server/index.js devuelve `data: {"text":...}` + `data: [DONE]`). Si el body trae
 * stream, respondemos con SSE; si no, con JSON `{ text }`. Así el mock reproduce
 * fielmente el contrato del proxy para ambos modos.
 *
 * @param page
 * @param responder  - Un string: responde siempre 200 (con el texto, SSE o JSON).
 *                     - Una función (body) => string: idem, calculado por body.
 *                     - Una función (body) => MockResponse: responde con el status/body
 *                       dados (para simular errores del proveedor en el chat).
 */
export interface MockResponse {
  status: number;
  body: object | string;
}
export async function mockGeminiChat(
  page: Page,
  responder: string | ((body: Record<string, unknown>) => string | MockResponse),
) {
  await page.route('**/api/gemini', async (route: Route) => {
    const body = safeJsonBody(route.request().postData());
    const result = typeof responder === 'function' ? responder(body) : responder;
    if (typeof result === 'string') {
      const wantsStream = body.stream === true;
      if (wantsStream) {
        // SSE: el contenido se trocea en un par de eventos y se cierra con [DONE].
        const chunks = chunkText(result);
        const sse = chunks.map(c => `data: ${JSON.stringify({ text: c })}`).join('\n\n') + '\n\ndata: [DONE]\n\n';
        return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: result }),
      });
    }
    // MockResponse (error simulado)
    const respBody = typeof result.body === 'string' ? result.body : JSON.stringify(result.body);
    return route.fulfill({
      status: result.status,
      contentType: 'application/json',
      body: respBody,
    });
  });
}

/** Trocea el texto en 2-3 fragmentos para simular streaming realista. */
function chunkText(text: string): string[] {
  if (text.length <= 2) return [text];
  const mid = Math.ceil(text.length / 2);
  return [text.slice(0, mid), text.slice(mid)];
}

/**
 * Cruza el AIProviderGate: mockea el chat para la validación, selecciona el
 * proveedor Gemini, rellena la API key y pulsa Conectar. Espera a que <App>
 * (selector #chat-textarea) sea visible, señal de isConnected=true.
 */
export async function connectProvider(page: Page) {
  await page.locator('#select-gemini-btn').click();
  await page.locator('#gemini-key-input').fill('e2e-fake-api-key');
  await page.locator('#ai-connect-btn').click();
  // connect() se invoca 800ms tras el success de la validación.
  await page.locator('#chat-textarea').waitFor({ state: 'visible', timeout: 15_000 });
}

/**
 * Escribe una instrucción en el chat y la envía.
 *
 * Usa keyboard.type (eventos de teclado reales) en vez de page.fill: el textarea
 * #chat-textarea está controlado por React (value/onChange en ChatInput.tsx), y
 * Playwright `.fill()` no siempre dispara el onChange que actualiza el estado
 * `inputValue` de App → handleSend leería un valor obsoleto. Typing carácter a
 * carácter genera los keydown/input/keyup que React procesa de forma fiable.
 *
 * Se envía con Enter (no con el botón ➤): es el camino documentado en el propio
 * placeholder ("Enter para enviar") y dispara handleKeyDown → onSend con el valor
 * fresco del evento, evitando un cierre obsoleto de handleSend al clic del botón.
 */
export async function sendInstruction(page: Page, text: string) {
  await page.locator('#chat-textarea').click();
  await page.keyboard.type(text, { delay: 20 });
  await page.keyboard.press('Enter');
}

/**
 * Construye el cuerpo de texto que el parser de acciones espera (parseGeminiActionWithReason).
 * El texto crudo debe contener un objeto JSON válido según isValidAction:
 *   { tipo, accion, endpoint, metodo, repo, archivo, contenidoPropuesto, requiereConfirmacion }
 * Ver client/src/services/gemini.ts:514 y client/src/types/index.ts:109.
 */
export function buildActionResponse(overrides: Partial<Record<string, unknown>> = {}): string {
  const action = {
    tipo: 'escritura',
    accion: 'Actualizar README con una sección de pruebas',
    endpoint: '/repos/e2e-tester/test-repo/contents/README.md',
    metodo: 'PUT',
    repo: 'e2e-tester/test-repo',
    archivo: 'README.md',
    // contenidoActual rellenado: evita el GET a api.github.com para enriquecer
    // y el diff se construye directamente (creación → diff solo con la parte nueva).
    contenidoActual: '# Test Repo\n',
    contenidoPropuesto: '# Test Repo\n\n## Pruebas\n\nSuite de pruebas E2E.\n',
    requiereConfirmacion: true,
    target: 'file',
    ...overrides,
  };
  return JSON.stringify(action);
}

function safeJsonBody(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
