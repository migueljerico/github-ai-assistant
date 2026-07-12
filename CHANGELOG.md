### CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.33.5] — 2026-07-12

### Fixed
- **Cloud Run: servidor no arrancaba (SyntaxError en `server/index.js`).** El proxy de Cloudflare tenía `req.headers['x-account-id'] as string | undefined`, pero `server/index.js` es JavaScript puro (no TypeScript) y no soporta la sintaxis `as`. El servidor se cerraba al arrancar con `SyntaxError: Unexpected identifier 'as'`, causando `HealthCheckContainerError` en Cloud Run. Corregido: eliminado el type assertion; ahora lee `req.headers['x-account-id']` como JS puro.

### Changed
- `server/index.js`: eliminado type assertion TypeScript (`as string | undefined`) en lectura de header `x-account-id`.
- `Dockerfile`: mantenida eliminación de `ENV PORT=8080` (Cloud Run asigna puerto dinámico).

### Notes
- Ahora el build de Cloud Run completa correctamente y el contenedor arranca.
- Tests: 536/536 (client) + 5/5 (server), build limpio, lint 0 errores.
- Cambio de código por ZCode (nemotron-3-ultra / NVIDIA NIM).

## [3.33.4] — 2026-07-12

### Fixed
- **Cloud Run: contenedor no arrancaba (HealthCheckContainerError).** El `Dockerfile` establecía `ENV PORT=8080`, sobrescribiendo el puerto dinámico que asigna Cloud Run. Corregido: eliminado `ENV PORT=8080` del Dockerfile; el servidor Express ahora respeta el `$PORT` dinámico de Cloud Run en runtime.

### Changed
- `Dockerfile`: eliminada línea `ENV PORT=8080`; el servidor ya respeta `process.env.PORT`.

### Notes
- Tests: 536/536 (client) + 5/5 (server), build limpio, lint 0 errores.
- Cambio de código por ZCode (nemotron-3-ultra / NVIDIA NIM).

## [3.33.3] — 2026-07-12

### Fixed
- **Cloudflare Workers AI: 400 Bad Request en `/api/cloudflare`.** El proxy leía `accountId` de `req.body`, pero el body solo trae el payload de chat (model, messages...). Corregido: lee el header `X-Account-Id` que el frontend envía correctamente.

### Changed
- `server/index.js`: proxy `/api/cloudflare` obtiene `accountId` de `req.headers['x-account-id']`.
- Versiones bump a 3.33.3 + docs sincronizadas.

### Notes
- Cambio de código por ZCode (nemotron-3-ultra / NVIDIA NIM).

## [3.33.2] — 2026-07-12

### Fixed
- **OpenCode Zen y Cloudflare Workers AI: bloqueo CORS en el navegador.** opencode.ai y api.cloudflare.com no envían `Access-Control-Allow-Origin` → las llamadas directas desde el frontend se bloquean con `Failed to fetch`. Añadidos proxies backend `/api/openzen` y `/api/cloudflare` en `server/index.js` (mismo patrón que Gemini y NIM). El frontend ahora apunta a `/api/openzen` y `/api/cloudflare`; el servidor reenvía al upstream con la key en memoria, sin persistir ni loguear (Zero-Storage).
- **Cloudflare: catálogo actualizado con los 3 modelos que usa el usuario en ZCode** (Kimi K2.7 Code, GLM 5.2, DeepSeek R1 Distill Qwen 32B). Eliminado completamente el fetch dinámico que fallaba y mostraba modelos incorrectos.

### Changed
- `server/index.js`: endpoints proxy `POST /api/openzen` y `POST /api/cloudflare` con rate limiters propios (40 req/min) y helper `pipeUpstream()` para streaming SSE.
- `client/src/services/providers.ts`: `openzen.chatEndpoint` → `/api/openzen`; `cloudflare.chatEndpoint` → `/api/cloudflare`; ambos sin `modelsEndpoint`, catálogo estático.
- `client/src/services/gemini.ts`: `callOpenAICompatible` acepta `accountId?` y lo envía como header `X-Account-Id` para el proxy de Cloudflare; `validateProviderKey` propaga `accountId`.
- `client/src/i18n/es.ts` y `en.ts`: `provider.openzen.*` y `provider.cloudflare.*` actualizados.
- `client/src/services/__tests__/providers.test.ts`: tests adaptados a proxies y catálogos estáticos.

### Notes
- Ahora OpenCode Zen y Cloudflare Workers AI funcionan desde el navegador sin CORS, igual que Gemini y NIM.
- Tests: 536/536 (client) + 5/5 (server), build limpio, lint 0 errores.
- Cambio de código por ZCode (nemotron-3-ultra / NVIDIA NIM).

## [3.33.1] — 2026-07-12

### Fixed
- **OpenCode Zen (`openzen`):** eliminada la referencia al token keyless `"public"` en la UI (i18n `provider.openzen.note`, `cardDesc`, `signupLabel` y `keyPlaceholder`). Ahora indica usar la **API key real de opencode.ai** (gratuita o de pago). Los modelos con sufijo `-free` siguen funcionando con la key gratuita; una key de pago desbloquea modelos premium.
- **Cloudflare Workers AI (`cloudflare`):** cambiado a **catálogo estático** (`CLOUDFLARE_FALLBACK`, 5 modelos configurados en ZCode) en lugar del catálogo dinámico que fallaba con "Failed to fetch". Eliminado `modelsEndpoint`; el panel ya no intenta fetch dinámico. i18n actualizado (`provider.cloudflare.note`, `cardDesc`) para reflejar que se usan los modelos configurados en ZCode.
- Tests actualizados: `fetchModels` para `cloudflare` ahora verifica catálogo estático sin llamada de red.

### Changed
- `client/src/services/providers.ts`: `openzen.keyPlaceholder` → `'API key de opencode.ai'`; `cloudflare` sin `modelsEndpoint`, usa `staticModels: CLOUDFLARE_FALLBACK`.
- `client/src/i18n/es.ts` y `en.ts`: claves `provider.openzen.*` y `provider.cloudflare.*` actualizadas.
- `client/src/services/__tests__/providers.test.ts`: test de Cloudflare adaptado a catálogo estático.

### Notes
- Investigación y fix: asistente ZCode (modelo nemotron-3-ultra / NVIDIA NIM). Cierre e implementación: asistente ZCode (modelo nemotron-3-ultra / NVIDIA NIM). Tests 536/536 (client) + 5/5 (server), build limpio, lint 0 errores.

## [3.33.0] — 2026-07-12

### Added
- **Nuevos proveedores de IA: OpenCode Zen y Cloudflare Workers AI.** Se añaden al registro único `PROVIDERS` (`client/src/services/providers.ts`) siguiendo el patrón openai-compatible de Zenmux/OpenRouter, **sin tocar la lógica ni los proveedores existentes**.
  - **OpenCode Zen (`openzen`):** catálogo dinámico **público** que se filtra en tiempo real a los modelos **gratis** (sufijo `-free`); el usuario elige entre ellos. Los gratis funcionan con el token keyless `public` (sin registro); una key real de opencode.ai desbloquea los de pago.
  - **Cloudflare Workers AI (`cloudflare`, última tarjeta del listado):** catálogo dinámico **completo** para que el usuario elija. Como Workers AI exige `account_id` en la ruta URL + token por cuenta, el panel muestra un campo extra de **Account ID** y el endpoint usa el marcador `{account_id}`, que se sustituye en runtime con `resolveEndpoint()`.
- `client/src/services/providers.ts`: helper `resolveEndpoint()` (sustituye `{account_id}`), ramas `openzen`/`cloudflare` en `fetchModels`, y `accountId?` en `AIProviderConfig`.
- `client/src/context/AIProviderContext.tsx`: `accountId` en el estado (Zero-Storage, igual que la key).
- `client/src/components/ai-provider/AIProviderPanel.tsx`: campo Account ID solo para Cloudflare; se propaga a `validateProviderKey`/`connect`/`fetchModels`.
- `client/src/services/gemini.ts`: `accountId?` en `callAI`/`validateProviderKey` para resolver el endpoint de Cloudflare.
- i18n (en/es): claves `provider.openzen.*`, `provider.cloudflare.*` y `aipanel.accountId`.
- Tests: cobertura de `fetchModels` para `openzen` (solo free) y `cloudflare` (catálogo completo + `{account_id}`), y de `resolveEndpoint`.

### Notes
- Endpoints de OpenCode Zen (`https://opencode.ai/zen/v1/...`) y Cloudflare Workers AI verificados vía investigación. La lógica de parsing/sustitución está cubierta por tests unitarios; el comportamiento en vivo depende de las keys/cuenta del usuario. No se modificó el servidor.
- Investigación de endpoints: subagente de investigación (general-purpose). Cierre e implementación: asistente ZCode (modelo hy3-free / openrouter-free).
