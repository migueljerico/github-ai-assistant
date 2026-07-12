### CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.33.7] — 2026-07-12

### Fixed
- **Cloudflare Workers AI: error del navegador al parsear headers.** Cloudflare devuelve cabeceras con caracteres fuera de ISO-8859-1 (emojis en `Server`, `CF-Ray`, etc.), causando `Failed to read the 'headers' property from 'RequestInit': String contains non ISO-8859-1 code point`. El proxy `/api/cloudflare` ahora sanea los headers del upstream antes de reenviarlos al cliente.
- **429 saturación en Cloudflare/OpenCode Zen:** aumentado rate limit de 40 a 100 req/min en los proxies `/api/openzen` y `/api/cloudflare`.
- **Descripción Cloudflare en frontend:** nota simplificada y amigable en i18n (sin detalles técnicos de catálogo/proxy).

### Changed
- `server/index.js`: proxy `/api/cloudflare` filtra headers del upstream (solo ASCII puro) para evitar errores en el navegador.
- `server/index.js`: rate limiters de `/api/openzen` y `/api/cloudflare` aumentados a 100 req/min.
- `client/src/services/providers.ts`: `CLOUDFLARE_FALLBACK` ampliado a 8 modelos estables (Kimi K2.7 Code, GLM 5.2, DeepSeek R1 Distill Qwen 32B, Llama 3.1 8B, Llama 3.3 70B, Mistral 7B, Qwen 2.5 7B, Gemma 2 9B).
- `client/src/i18n/es.ts` y `en.ts`: `provider.cloudflare.note` simplificada.

### Notes
- Ahora Cloudflare Workers AI funciona sin errores de headers y con mayor throughput.
- Tests: 536/536 (client) + 5/5 (server), build limpio, lint 0 errores.
- Cambio de código por ZCode (nemotron-3-ultra / NVIDIA NIM).

## [3.33.5] — 2026-07-12

### Fixed
- **Cloud Run: servidor no arrancaba (SyntaxError en `server/index.js`).** El proxy de Cloudflare usaba sintaxis TypeScript (`as string | undefined`) en un archivo JavaScript puro. Corregido: eliminado el type assertion.

### Changed
- `server/index.js`: eliminado type assertion TypeScript en lectura de header `x-account-id`.
- `Dockerfile`: sin `ENV PORT=8080`.

### Notes
- Ahora el build de Cloud Run completa correctamente y el contenedor arranca.
- Tests: 536/536 (client) + 5/5 (server), build limpio, lint 0 errores.

## [3.33.4] — 2026-07-12

### Fixed
- **Cloud Run: contenedor no arrancaba (HealthCheckContainerError).** El `Dockerfile` establecía `ENV PORT=8080`. Corregido: eliminado; el servidor respeta el `$PORT` dinámico de Cloud Run.

### Changed
- `Dockerfile`: eliminada línea `ENV PORT=8080`.

### Notes
- Tests: 536/536 (client) + 5/5 (server), build limpio, lint 0 errores.

## [3.33.3] — 2026-07-12

### Fixed
- **Cloudflare Workers AI: 400 Bad Request en `/api/cloudflare`.** El proxy leía `accountId` de `req.body`. Corregido: lee el header `X-Account-Id`.

### Changed
- `server/index.js`: proxy `/api/cloudflare` obtiene `accountId` de `req.headers['x-account-id']`.

### Notes
- Cambio de código por ZCode (nemotron-3-ultra / NVIDIA NIM).

## [3.33.2] — 2026-07-12

### Fixed
- **OpenCode Zen y Cloudflare Workers AI: bloqueo CORS en el navegador.** Añadidos proxies backend `/api/openzen` y `/api/cloudflare`.
- **Cloudflare: catálogo actualizado con los 3 modelos que usa el usuario en ZCode** (Kimi K2.7 Code, GLM 5.2, DeepSeek R1 Distill Qwen 32B).

### Changed
- `server/index.js`: endpoints proxy con rate limiters y `pipeUpstream()`.
- `client/src/services/providers.ts`: endpoints a `/api/openzen` y `/api/cloudflare`.
- `client/src/services/gemini.ts`: `accountId` como header `X-Account-Id`.
- i18n y tests actualizados.

### Notes
- Ahora OpenCode Zen y Cloudflare funcionan desde el navegador sin CORS.
- Tests: 536/536 (client) + 5/5 (server), build limpio, lint 0 errores.

## [3.33.1] — 2026-07-12

### Fixed
- **OpenCode Zen:** eliminada referencia al token keyless `"public"`.
- **Cloudflare Workers AI:** cambiado a catálogo estático.

### Changed
- `client/src/services/providers.ts`: `openzen.keyPlaceholder` → `'API key de opencode.ai'`.
- `client/src/i18n/es.ts` y `en.ts`: claves actualizadas.

### Notes
- Tests: 536/536 (client) + 5/5 (server), build limpio, lint 0 errores.

## [3.33.0] — 2026-07-12

### Added
- **Nuevos proveedores de IA: OpenCode Zen y Cloudflare Workers AI.**

### Notes
- Endpoints verificados vía investigación. No se modificó el servidor.
