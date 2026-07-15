### CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.37.0] — 2026-07-15

### Added
- **#48 Sync Repo Status — análisis bajo demanda de commits recientes (pull-based).**
  - `runSyncRepoStatus()` en `assistantActions.ts`: obtiene commits recientes vía `listRecentCommits`, detalle con diffs vía `getCommit`, construye contexto y llama a IA para análisis ejecutivo (tipo de cambios, áreas afectadas, riesgos, sugerencias).
  - Wrappers GitHub API en `github.ts`: `listRecentCommits` (paginado) y `getCommit` (con diffs/files) — pull-based, sin webhooks, compatible Cloud Run scale-to-zero.
  - Botón UI `SyncRepoStatusButton` en `ChatInput` (icono 🔄, prompt simple "owner/repo").
  - i18n ES/EN: `syncRepo.title`, `syncRepo.tooltip`, `syncRepo.prompt`, `syncRepo.noCommits`.

### Tests
- **4 tests nuevos** para `runSyncRepoStatus` (#48): éxito (2 commits + diffs → resumen IA), sin commits recientes, error 404, opciones `maxCommits`/`includeDiffs`.

### Fixed
- Lint: import duplicado limpiado en tests.

### Notes
- Tests: 567/567 (client) + 5/5 (server) = **572 verdes**.
- Build limpio, lint 0 errores (8 warnings preexistentes).
- Cambio de código por Nemotron 3 Ultra (NVIDIA NIM) via ZCode.

---

## [3.36.1] — 2026-07-15

### Added
- **Mitigación vulnerabilidades `xlsx` (SheetJS CE):** límite de 10 MB en `spreadsheetReader.ts` antes de parsear + validación básica de cabecera post-parseo (mitiga Prototype Pollution GHSA-xvch-5gv4-9q4h y ReDoS GHSA-93q8-gq69-qvxp).
- Aviso en UI (`FileAttachButton`, `DocumentFlowModal`): "Solo suba archivos de fuentes confiables. Límite: 10 MB."
- Rate limiting en ruta catch-all SPA (`server/index.js`) para prevenir DoS vía acceso al sistema de archivos.

### Fixed
- `docxReader.ts`: sanitización incompleta de etiquetas (fix multi-character sanitization) — ahora elimina tags iterativamente hasta estabilizar.
- `client/src/test/setup.ts`: escape inútil en regexp corregido (`\{` → `\\{`).
- CI workflow: añadido bloque `permissions: contents: read` para CodeQL compliance.

### Changed
- Tests `spreadsheetReader`: nuevo test de límite de tamaño (10 MB).

### Notes
- Tests: 557/557 (client) + 5/5 (server) = **562 verdes**.
- Build limpio, lint 0 errores.
- NO migrado a `exceljs` (+4 MB bundle, rompe chunks lazy).
- Cambio de código por Nemotron 3 Ultra (NVIDIA NIM).

---

## [3.36.0] — 2026-07-14

### Added
- **Fase 6 (persistencia avanzada):** nuevo hook `useDocTargetSelector.ts` que persiste en `localStorage` (clave `doc_target_selector`) el `scope`, `repoInput`, `targetPath` y `extraInstructions` del último flujo "documento específico del repo". Al reabrir el `DocumentFlowModal`, el usuario recupera su contexto previo sin tener que rellenar el repo y la ruta.
- Integración en `DocumentFlowModal.tsx`: restauración automática al montar (si no hay `initialRepo`), persistencia en cambios de scope/repo/path/instrucciones, y sincronización bidireccional con la prop controlada `extraInstructions`.
- Tests unitarios del hook (11 tests: hidratación, persistencia, clear, merge defensivo, SSR safety, cuota localStorage, JSON inválido).

### Changed
- `DocumentFlowModal`: los botones de Paso 1 (scope repo/file/specific) ahora actualizan tanto el estado local como el almacenamiento persistido.
- `client/src/test/setup.ts`: limpieza de `localStorage` entre tests para evitar contaminación de estado persistido.

### Fixed
- Lint: escape innecesario en regexp de `setup.ts` (`\{` → `{`).

### Notes
- Tests: 556/556 (client) + 5/5 (server) — **11 nuevos tests** para `useDocTargetSelector`.
- Build limpio, lint 0 errores (solo warnings preexistentes).
- **Pendiente conocido (v3.36.1):** `xlsx` (SheetJS) tiene vulnerabilidades conocidas (prototype pollution, ReDoS) sin fix en npm. **Plan B para v3.36.1:** límite de tamaño de archivo + validación antes de parsear + documentar riesgo; migración a `exceljs` descartada por +4 MB de bundle.
- Cambio de código por Nemotron 3 Ultra (NVIDIA NIM).

---

## [3.35.0] — 2026-07-14

### Fixed
- Build de v3.34.x: `runGenerateSpecificDoc` y `runPublishSpecificDoc` no importados en `client/src/App.tsx` (callbacks Fase 4 del flujo de documento específico).
- `RepoContext` sin campo `fileTree`: añadido `fileTree?: { path: string }[]` para que el selector de rutas del modal compile.
- `DocumentFlowModal`: eliminado uso de `scope` como valor fuera del componente (eran líneas de tipo `type Scope` confundidas con variable); movidos `isFile` e `isSpecific` dentro del componente; añadidas las props Fase 2/Fase 3 (`onGenerateSpecific`, `onCommitSpecific`, `onDraftPrSpecific`, `onReleaseSpecific`, `repoFileTree`, `extraInstructions`, `onExtraInstructionsChange`) al destructuring.
- `DocumentFlowModal.test.tsx`: añadidos mocks de las props Fase 2 y Fase 3 para que los tests tipen correctamente.

### Added
- **Fase 3 (selectividad):** el campo de texto opcional "Instrucciones adicionales" del flujo de documento específico se propaga hasta el generador. En `App.tsx`, `flowGenerateSpecific` reenvía `extraInstructions` como `conversation` a `runGenerateSpecificDoc`; `generateSpecificDoc` lo incluye como `CONTEXTO ADICIONAL` en el prompt del LLM.

### Changed
- Ajustada interfaz de callback `onGenerateSpecific` para aceptar `extraInstructions?: string`.
- Eliminado estado local duplicado de `extraInstructions` en el modal; ahora el componente delega a través de `onExtraInstructionsChange`.

### Notes
- Tests: 545/545 (client) + 5/5 (server): se añaden 4 tests de cobertura para `generateSpecificDoc` (#58 Fase 2/3), build limpio.
- Cambio de código por ZCode (step-3.7-flash-free).

---

## [3.34.1] — 2026-07-13

### Changed
- Sincronización documental completa a v3.34.1: badges, versiones en cabeceras,
  listas de proveedores (OpenCode Zen, Cloudflare Workers AI, Ollama Cloud),
  recuento de tests (536) y enlaces a `/docs/*` en README.
- Borrado de `HANDOFF_2026-07-13.md` (nota personal de sesión no pedida; ver regla
  anti-HANDOFF en `CLAUDE.md` §5 y `METODOLOGIA_IA.md` §2).
- Eliminado `## ✅ Resueltos` duplicado en `MEJORAS_FUTURAS.md`; añadido bloque
  "Enfoque actual" y nueva mejora futura #58 (documentación flexible de archivos).

### Notes
- Tests: 536/536 (client) + 5/5 (server), build limpio.
- Cambio de código por ZCode (step-3.7-flash-free).

---

## [3.34.0] — 2026-07-13

### Added
- **Nuevo proveedor: Ollama Cloud (🦙).** 11 modelos verificados en free tier:
  - 6 modelos ilimitados: MiniMax M3 (default, 1M ctx), Nemotron 3 Super, Qwen3 Coder Next, Gemma 4 31B, GPT-OSS 20B, Ministral 3 14B
  - 5 modelos con límite de sesión bajo: Nemotron 3 Ultra, Devstral Small 2 24B, GPT-OSS 120B, Qwen3 Coder 480B, Devstral 2 123B
  - Endpoint OpenAI-compatible en `https://ollama.com/v1` con API key `sk-ollama-...`
  - Catálogo dinámico vía `modelsEndpoint` + fallback estático
- i18n ES/EN para el nuevo proveedor (`provider.ollama.*`)

### Fixed
- **Retry transitorio (retry.ts):** añadido status 429 y patrón `rate limit|429` a `TRANSIENT_PATTERN` para reintentar en saturación de proveedores de IA (Cloudflare, OpenRouter free, etc.). Excluye `GitHubAPIError` (manejo propio con headers de rate-limit).
- **Proxy Cloudflare (`server/index.js`):** `res.removeHeader('content-encoding')` y `removeHeader('transfer-encoding')` antes de `pipeUpstream` para evitar `ERR_CONTENT_DECODING_FAILED` en el navegador.
- **Mensaje accionable Cloudflare 403/429 (`gemini.ts`):** si el proxy `/api/cloudflare` devuelve 403 o 429, el error sugiere: *"Modelo no disponible en tu cuenta Cloudflare (cuota agotada). Prueba con Kimi K2.7 Code o Llama 3.1 8B en el selector."*

### Changed
- `client/src/utils/retry.ts`: `TRANSIENT_PATTERN` ampliado; `isTransientError` ignora `GitHubAPIError` (manejo propio).
- `server/index.js`: proxy `/api/cloudflare` limpia headers `content-encoding` y `transfer-encoding`.
- `client/src/services/gemini.ts`: error accionable para Cloudflare 403/429.
- `client/src/services/__tests__/providers.test.ts`: test de `defaultModel` incluye ahora `ollama`.

### Notes
- Tests: 536/536 (client) + 5/5 (server), build limpio, lint 0 errores.
- Cambio de código por Nemotron 3 Ultra (ZCode).

## [3.33.8] — 2026-07-12

### Fixed
- **Cloud Run: contenedor no arrancaba (SyntaxError en `server/index.js`).** El proxy de Cloudflare usaba sintaxis TypeScript (`Record<string, string>`) en un archivo JavaScript puro. Corregido: eliminado el tipo, ahora usa objeto plain `{}`.
- **Cloud Run: `PORT=8080` hardcodeado en Dockerfile.** Eliminado `ENV PORT=8080`; Cloud Run asigna puerto dinámico. Actualizado `CLAUDE.md` con lección para no repetirlo.

### Changed
- `server/index.js`: eliminado type annotation TypeScript en `safeHeaders`.
- `Dockerfile`: comentario actualizado explicando por qué NO se debe hardcodear el puerto.
- `CLAUDE.md`: añadidas tres trampas documentadas (PORT hardcodeado, JS puro con sintaxis TS, headers ISO-8859-1 en Cloudflare).

### Notes
- Tests: 536/536 (client) + 5/5 (server), build limpio, lint 0 errores.
- Cambio de código por ZCode (nemotron-3-ultra / NVIDIA NIM).

## [3.33.7] — 2026-07-12

### Fixed
- **Cloudflare Workers AI: error del navegador al parsear headers.** Cloudflare devuelve cabeceras con caracteres fuera de ISO-8859-1 (emojis en `Server`, `CF-Ray`, etc.), causando `Failed to read the 'headers' property from 'RequestInit': String contains non ISO-8859-1 code point`. El proxy `/api/cloudflare` ahora sanea los headers del upstream antes de reenviarlos.
- **429 saturación en Cloudflare/OpenCode Zen:** aumentado rate limit de 40 a 100 req/min en los proxies `/api/openzen` y `/api/cloudflare`.

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
- **Cloud Run: servidor no arrancaba (SyntaxError en `server/index.js`).** Corregido: eliminado type assertion TypeScript en lectura de header `x-account-id`.
- **Dockerfile:** sin `ENV PORT=8080`.

### Notes
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
- **Cloudflare: catálogo actualizado con los modelos que usa el usuario en ZCode.**

### Changed
- `server/index.js`: endpoints proxy con rate limiters y `pipeUpstream()`.
- `client/src/services/providers.ts`: endpoints a `/api/openzen` y `/api/cloudflare`.
- `client/src/services/gemini.ts`: `accountId` como header `X-Account-Id`.
- i18n y tests actualizados.

### Notes
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
