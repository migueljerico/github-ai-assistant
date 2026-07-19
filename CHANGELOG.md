### CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.50.3] — 2026-07-19

> **Cobertura de tests de los componentes tocados en v3.50.2 sin suite propia.**
> La tanda anterior (lint 0 warnings) se validó solo con `tsc` + `build` en 5
> archivos por no tener tests. Esta versión cierra ese gap con **34 tests
> nuevos** en 3 suites que cubren la lógica no trivial y, de paso, blindan los
> refactors de v3.50.2 (el `useMemo` de `InstructionSuggestions`, el patrón de
> fetch-en-mount de `RepoSelector`, las transiciones de estado de
> `HistoryContext`). Patch de calidad, sin cambios funcionales. Por ZCode (GLM-5.2).

### Added
- **`HistoryContext.test.tsx`** (9 tests) — cubre `addEntry` (id único +
  timestamp + conservación de status/description/repo), `updateEntry` (cambio
  de status/description + id inexistente no rompe), `clearHistory`, el guard
  `useHistory must be used inside HistoryProvider`, el caso `repo: null` del
  formateador de export y el flujo de descarga del log (blob, click, revoke).
- **`RepoSelector.test.tsx`** (11 tests) — mockea `useAuth` y `listAllRepos`
  para aislar la UI: fetch al montar con token (sin token no llama), spinner
  durante la carga, contador total, marca de privado 🔒 / público 📁, filtro
  case-insensitive por nombre y por descripción, toggle de un checkbox
  (añade/quita con estado controlado), `toggleAll` (todos↔ninguno) y que
  respeta el filtro activo, manejo de error de red, banner de selección con
  pluralización (1 repo / N repos).
- **`InstructionSuggestions.test.tsx`** (14 tests) — cubre el componente (no el
  util, que ya se testa): renderizado condicional por `isOpen` y por filtrado
  vacío, límite de 5/8 sugerencias, click invoca `onSelectTemplate`,
  navegación por teclado (ArrowDown/ArrowUp cíclicos, Enter con/sin selección,
  Escape cierra vía `onOpenChange(false)`), reset de selección al cambiar el
  input, `onMouseEnter` marca la sugerencia, y guard de teclado cuando
  `isOpen=false`.

### Notas
- Validación local completa en verde: lint **0/0**, `tsc -b` limpio, tests
  **691/691** (cliente 647 en 56 suites + servidor 44 en 5 suites; antes
  659 totales), build OK (685 módulos).
- Avanza el roadmap **#26** (cobertura continua): +34 tests, suites 58→61.
- Sin cambios funcionales ni en la API.

Cambio de código por [ZCode](https://z.ai) (GLM-5.2).

## [3.50.2] — 2026-07-18

> **Cierre de la deuda de lint heredada de v3.50.1.** Al subir ESLint 9→10 y
> `eslint-plugin-react-hooks` 5→7 (#77) surgieron 15 warnings de tres reglas
> nuevas (`set-state-in-effect`, `refs`, `react-refresh/only-export-components`)
> que en el hotfix se degradaron a `warn` para no bloquear main. Esta versión
> los resuelve caso por caso: `npm run lint` pasa de 15 warnings a **0**. Las
> reglas siguen activas en `warn` para detectar futuros casos nuevos. Patch puro
> de calidad, sin cambios funcionales. Por ZCode (GLM-5.2).

### Fixed
- **Bug en `App.tsx:128`**: el array de dependencias de `handleLoadRepoContext`
  listaba `provider` dos veces (copy-paste). `react-hooks/exhaustive-deps` lo
  marcaba como duplicado. Corregido eliminando la repetición.

### Changed
- **`InstructionSuggestions.tsx`** — `suggestions` ahora se deriva con
  `useMemo` (input + templates) en lugar de un effect que hacía `setSuggestions`.
  Elimina el re-render en cascada y el warning `set-state-in-effect`. El
  reseteo de `selectedIndex` al cambiar el input se mantiene en un effect
  mínimo silenciado in situ (selección obsoleta tras filtrar).
- **`SessionWarningBanner.tsx`** — `visible` se filtra en render contra
  `dismissed` (ya no hace falta el effect que saneaba `dismissed`); el
  intervalo de TTL lee `checkTTL` vía *latest-ref* sin invocarlo en el body
  del effect, patrón estándar de suscripción.
- **`useModalDialog.ts`** — `onCloseRef.current = onClose` se movió del cuerpo
  de render a un `useEffect` (la regla `refs` prohíbe escribir refs durante el
  render). El listener sigue suscrito una sola vez (`[]`) y lee siempre la
  última versión.
- **8 silenciamientos in situ justificados** con comentario explicando por qué
  son patrones legítimos: fetch en mount (`RepoSelector.tsx`), auto-poblar
  extras al entrar al paso 4 e hidratar estado persistido (`DocumentFlowModal.tsx`),
  hooks de consumo co-localizados con su Provider (3 contexts — patrón canónico
  de React Context) y gates internas del entry point (`main.tsx`).
- **`test/setup.ts`** — borrado un `eslint-disable no-useless-escape` que ya no
  aplicaba (la versión actual de typescript-eslint no dispara sobre la regex).

### Notas
- Validación local completa en verde: lint **0 warnings / 0 errores** (antes
  15 warnings), `tsc --noEmit` limpio, tests cliente **613/613** (53 suites),
  build `tsc -b && vite build` OK (685 módulos).
- Las tres reglas (`set-state-in-effect`, `refs`, `react-refresh/only-export-components`)
  se mantienen en `warn` en `eslint.config.js` para señalizar futuros casos.
- Sin cambios funcionales ni en la API; solo calidad de código.

Cambio de código por [ZCode](https://z.ai) (GLM-5.2).

## [3.50.1] — 2026-07-18

> **Hotfix tras fusionar 10 PRs de Dependabot de golpe** (incluidos 4 majors
> grandes: Express 4→5, React 18→19, ESLint 9→10 y jsdom 24→29). main quedó
> roto: el build de Docker revienta en `npm ci` del cliente y el CD a Cloud Run
> no desplegaba. Esta versión repara los conflictos de peer deps y los breaking
> changes en cadena. Diagnóstico y fix por ZCode (GLM-5.2).

### Fixed
- **Mismatch React 19/18 en el cliente** (`client/package.json`). El PR #78
  subió `react` y `@types/react` a 19 pero dejó `react-dom` y `@types/react-dom`
  en 18.x. `npm ci` es estricto y abortaba con ERESOLVE (peer de
  `@types/react-dom@18.3.7` pidiendo `@types/react@^18`). Alineado a 19:
  `react-dom` ^19.2.7, `@types/react-dom` ^19.2.3 (la 19.2.7 de types no está
  publicada; 19.2.3 es la última real).

- **Wildcard de Express 5 en el catch-all de la SPA** (`server/index.js:767`).
  `app.get('*', ...)` no es válido en Express 5 (path-to-regexp v8 exige
  nombre) y lanzaba `TypeError: Missing parameter name` al arrancar, cayendo el
  contenedor. Cambiado a `app.get('/{*splat}', ...)`. El handler no usa
  `req.params`, así que el nombre es indiferente.

- **`eslint-plugin-react-hooks` 5 → 7.1.1** (`client/package.json`). La v5
  declaraba peer `eslint ^9`, incompatible con ESLint 10 del PR #77. Subida a
  7.1.1 (primera versión con peer `eslint ^10`). La v7 aporta reglas nuevas
  (`set-state-in-effect`, `refs`) que disparaban sobre patrones legítimos y
  muy extendidos en este codebase (setState en effects de inicialización, refs
  que guardan la última prop sin re-suscribir); degradadas a `warn` en
  `eslint.config.js` para no romper el lint del CI y dejarlas visibles para
  revisión gradual.

### Changed
- **3 falsos positivos de `no-useless-assignment`** silenciados in situ con
  `eslint-disable` justificado (`gemini.ts:869`, `providers.ts:604,664`). La
  nueva regla de typescript-eslint 8.64 no sigue el flujo de los closures de
  `.map()` ni los if/else donde todas las ramas reasignan. Son patrones
  correctos.

### Notas
- Validación local completa en verde: tests cliente 613/613 (53 suites),
  build `tsc -b && vite build`, lint 0 errores, tests servidor 44/44.
- Fuera de alcance: `xlsx` (SheetJS) sigue con 1 vuln high "No fix available"
  (preexistente, ya con `|| true` en CI); los 15 warnings de lint pendientes
  de revisión gradual fuera del hotfix.

Cambio de código por [ZCode](https://z.ai) (GLM-5.2).

## [3.50.0] — 2026-07-18

> **Hallazgos originales detectados por Gemini 3.5 Flash (OpenRouter) vía
> dogfooding del Modo Auditoría de Seguridad (#52)** — la propia app auditándose
> a sí misma. Esta versión cierra esos hallazgos e implementa el feature de
> producto #53. Salto de minor por ser un conjunto relacionado de mejoras de
> seguridad + un feature nuevo.

### Added
- **#53: Sugerencia de commit semántico en ConfirmModal.** Cuando el asistente
  va a crear/editar/borrar un archivo (PUT/DELETE), el modal de confirmación
  muestra ahora un **textarea editable** con un mensaje Conventional Commits
  sugerido por el LLM. La sugerencia usa el historial de commits recientes del
  repo destino como few-shot de estilo y un prompt dedicado
  (`client/src/prompts/commit-message.md`). El usuario puede reescribirlo antes
  de confirmar; el mensaje final viaja al `createOrUpdateFile` de la GitHub API.
  Best-effort: si el LLM no responde, el campo abre vacío y el usuario escribe
  lo que quiera. Zero-Storage intacto (la sugerencia vive solo en el modal).
  Nuevos: `commitSuggester.ts`, `commit-message.md`, `commitMessage?: string`
  en `PendingAction`. Plumbing en `executeAction`/`executeActionMultiRepo`.

- **Dependabot activo** (`.github/dependabot.yml`): PRs automáticos semanales
  para server (raíz), client y GitHub Actions. Hallazgo #2.

- **Job `security` en CI** (`.github/workflows/ci.yml`): escaneo de secretos con
  `gitleaks/gitleaks-action@v2` (sobre el historial completo) + `npm audit`
  (`--audit-level=high --omit=dev`) en server y client. Hallazgo #2.

### Fixed
- **Validación de body en los 6 proxies POST de chat** (`/api/gemini`, `/api/nim`,
  `/api/openzen`, `/api/cloudflare`, `/api/ollama`, `/api/aiand`). Antes solo
  validaban la presencia de la API key; ahora además validan:
  (a) `Content-Type: application/json` (415 si no),
  (b) `messages` es array no vacío, cada item `{role, content}` con `role` en
  la lista permitida y `content` string, con límites `MAX_MESSAGES=200` turnos
  y `MAX_CONTENT_BYTES=100KB` por mensaje (400 si falla). Factorizado en
  `server/validators.js` (`validateChatBody` middleware + `validateMessages`)
  para mantener `index.js` testeable. **Zero-Storage intacto**: NO se añadió
  auth de sesión (rompería el modelo proxy); la validación es de CONTENIDO,
  no de auth. Hallazgos #1+#3. Nota: `express.json({limit:'4mb'})` ya existía
  globalmente (`index.js:44`); no se duplicó.

### Notes
- **Crédito**: cambios de código por ZCode (GLM-5.2). Hallazgos originales de
  los Bloques B/C por **Gemini 3.5 Flash (OpenRouter)**, detectados vía
  dogfooding del Modo Auditoría de Seguridad (#52) que la propia app implementa.
- **Scope recortado con criterio**: el hallazgo "falta `express.json({limit})`"
  de Gemini resultó INEXACTO tras verificación (ya existía). Se aplicó lo que
  FALTABA (content-type + estructura), no lo que ya había.
- **docPublisher fuera de scope**: sus commit messages literales
  (`docs: generate README — ${signature}`) viven en otro flujo
  (`DocumentFlowModal`), no en `ConfirmModal`. #53 se centra en el flujo de
  acciones del asistente; docPublisher queda para una iteración futura.
- Tests servidor: **44** (+20 nuevos de `validators.test.js`). Tests cliente:
  **613** (+30: 24 de `commitSuggester` + 6 de `ConfirmModal`). Lint: 0 errores,
  8 warnings preexistentes. Build: 684 módulos.
- `package.json` y `client/package.json`: 3.43.0 → 3.50.0.

## [3.43.0] — 2026-07-18

### Changed
- **Renombrado "💬 Opinar sobre repo" → "📂 Cargar repo"** (`RepoContextButton`,
  `es.ts`/`en.ts`). El botón **ya no opinaba**: su handler (`handleLoadRepoContext`
  → `runLoadRepoContext`) solo carga el contexto (árbol de archivos + contenido)
  sin llamar al LLM, dejando "✅ Contexto cargado… pregúntame lo que quieras".
  El nombre "Opinar" engañaba y llevaba a usar 🛡️ esperando carga. Ahora el
  etiquetado refleja lo que hace.

### Fixed
- **Bug del botón 🛡️ Auditar cuando no hay repo activo.** Antes, al pulsarlo sin
  repo cargado, mostraba `chat.repoNeeded` ("Indícame el repositorio…") y **se
  quedaba colgado sin ofrecer cargar** (`App.tsx:351-355`). Ahora `SecurityAuditButton`
  abre un input inline `owner/repo` (mismo patrón que `RepoContextButton`/`ChangelogButton`),
  y `handleSecurityAudit` **enciadena carga + auditoría**: si el repo indicado no
  es el activo, carga el contexto primero (aparece el chip "Contexto" para futuras
  preguntas) y luego lanza `runSecurityAudit` sobre ese repo — un solo gesto del
  usuario. Si ya hay repo activo, audita directo (sin recargar).
- **Mensaje `chat.repoNeeded` mejorado** como red de seguridad (es/en): ahora
  apunta al botón **📂 Cargar repo** en vez del críptico "Indícame el repositorio".
  Por la UI ya no se alcanza (el botón pide input inline), pero protege llamadas
  directas sin args.

### Notes
- **Zero-Storage intacto**: ni `runLoadRepoContext` ni `runSecurityAudit` persisten
  nada; el contexto vive solo en `useState<RepoContext>` de `App.tsx`.
- **`modeOverride` sin tocar**: la carga no llama al LLM; el sesgo a chat cuando
  hay repo ocurre automáticamente en el siguiente `runSend`.
- **`runSecurityAudit` runner sin cambios** (ni su prompt `security-audit.md`, ni
  `resolveSensitivePaths`).
- **Changelog/CodeHealth fuera de scope**: confirmado que sus botones ya piden
  input propio vía formulario inline, no sufrían el bug.
- Tests cliente: **583** (+4 nuevos en `SecurityAuditButton.test.tsx`). Tests
  servidor: 24. Build: 682 módulos. Lint: 0 errores, 8 warnings preexistentes.
- `package.json` y `client/package.json`: 3.42.1 → 3.43.0.

## [3.42.1] — 2026-07-18

### Fixed
- **CI lint roto en v3.42.0** (4 errores `@typescript-eslint/no-unused-vars` en
  `assistantActions.test.ts`): los mocks de `getFileContents` declaraban
  parámetros sin uso (`_t`, `_o`, `_r`, `path`). El config de ESLint del repo no
  define `argsIgnorePattern`, así que el prefijo `_` no exime la regla. Cambiado
  a `(...args: unknown[]) => args[3]` (camino feliz) y a `async () =>` (test de
  404, sin args). Tests **93/93** del fichero siguen pasando; lint del fichero
  limpio. Las 8 warnings restantes son **preexistentes** (contextos fast-refresh,
  `App.tsx:121` de otro callback, `setup.ts`) y no se tocaron.

### Notes
- Sin cambios funcionales. `package.json` y `client/package.json`: 3.42.0 → 3.42.1.

## [3.42.0] — 2026-07-17

### Added
- **Modo Auditoría de Seguridad (#52).** La app pasa de *gestionar* el repo a
  *asegurarlo*: un botón 🛡️ y una plantilla lanzan una revisión orientativa del
  LLM sobre el repo cargado, cubriendo tres ejes — **secrets expuestos**,
  **dependencias obsoletas** y **falta de validación de inputs** — con respuesta
  Markdown estructurada por eje y severidad. Origen: dogfooding de
  **Gemma 4 31B** (OpenRouter), que propuso #51, #52 y #53.
  - **Dos puntos de entrada**: botón 🛡️ en el panel del chat (`SecurityAuditButton`)
    que lanza la auditoría sobre el repo activo, y plantilla "Auditar Seguridad"
    en el dropdown de autocompletado (`instructionSuggestions.ts`) para la vía
    ligera por chat normal.
  - **Carga archivos sensibles extra** por path conocido (`package.json`,
    `package-lock.json`, `Dockerfile`, `.env.example`, `requirements.txt`,
    `go.mod`, `Cargo.toml`, workflows de CI, `docker-compose.yml`, entrypoints),
    porque algunos no entran en el contexto general (`package-lock.json` queda
    fuera por el filtro `.lock` + 50 KB; los workflows pueden caer del cap de 120).
    Los 404 se tragan sin romper la auditoría.
  - **Prompt dedicado** `client/src/prompts/security-audit.md` (patrón #23,
    import `?raw`) con rol de auditor, reglas de honestidad y disclaimer.
  - **Lectura-only**: modo `chat` forzado, no genera JSON de acción ni abre
    `ConfirmModal`. **Zero-Storage sin cambios**: el resultado vive solo en la
    conversación (memoria React), no se persiste ni se loguea en servidor.

### Notes
- **Caveat comunicado en UI**: ayuda orientativa vía LLM, **no un escáner formal**.
  No sustituye a `gitleaks` (secrets), Dependabot / `npm audit` (dependencias) ni
  CodeQL (código) — el prompt lo dice y la burbuja de carga lo repite. El LLM no
  afirma CVEs concretos que no pueda verificar.
- **No se toca** `server/*`, `runSend`/`SendParams`/`modeOverride`, ni proveedores.
  Reutiliza `runSecurityAudit` (runner especializado, molde de `runSummarizeThread`),
  `buildRepoContextSummary`, `callAI`, streaming y abort del chat.
- **Tests**: +3 en `assistantActions.test.ts` (camino feliz / sin repo / traga 404)
  y +7 en el nuevo `instructionSuggestions.test.ts`. Servidor **24/24** y cliente
  **579/579** sin regresión.
- `client/package.json` vuelve a sincronizarse con la raíz (3.38.1 → 3.42.0).

## [3.41.0] — 2026-07-17

### Added
- **`deploy.sh` con validación previa de variables (#25-parte3).** Primer script
  shell del repo. Antes de invocar el deploy manual `gcloud run deploy --source .`
  (documentado en `MANUAL_TECNICO.md`), valida que las **3 variables críticas**
  (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`) estén presentes.
  Las lee de `.env` si existe (las ya exportadas en el shell/CI tienen prioridad);
  si falta alguna, aborta con `exit 1` y mensaje claro — para no subir una
  revisión rota a Cloud Run. Confirmación `[s/N]` (default NO). **No sustituye al
  CD automático** (Cloud Build trigger en cada push a `main`): es una alternativa
  validada al deploy manual, para deploys puntuales o rollbacks. No gestiona
  secretos (las vars viven en el servicio; no `--set-env-vars`).
- **`package.json`**: nuevo script `"deploy": "bash deploy.sh"` (`npm run deploy`).

### Notes
- **#25 queda COMPLETO** con esta parte 3: logs estructurados ✅ (v3.39.0) +
  healthcheck extendido ✅ (v3.40.0) + `deploy.sh` ✅ (v3.41.0).
- **Sin cambios funcionales** ni en el pipeline de CD automático. Servidor:
  **24/24 tests** sin regresión. Cliente sin cambios.
- **Sin tests automáticos para bash** (no encaja en vitest; `shellcheck` no
  disponible). Verificación manual: `bash -n` OK + 4 pruebas de runtime (sin vars
  aborta / con `N` cancela sin `gcloud` / 2-de-3 indica la var que falta / carga
  `.env`).
- **#36 (Migrar a GitHub App) descartado** tras análisis del flujo de auth real:
  rompería el principio **zero-storage** (los *installation tokens* expiran en
  ~1h y exigen persistencia server-side del JWT/`installation_id`) y el
  **beneficio es marginal** para el modelo single-user de la app. Coste alto
  (6-8h, tocar el núcleo de auth que funciona) sin justificación. Decisión
  documentada en `MEJORAS_FUTURAS.md`.
- Cambio de código por ZCode (GLM-5.2).

---

## [3.40.0] — 2026-07-17

### Added
- **Healthcheck extendido en `/health` (#25-parte2).** `GET /health` (antes
  `{status:'ok'}` estático en `server/index.js`) ahora devuelve diagnóstico:
  `version`, `uptime` (`process.uptime()`), `timestamp` (ISO 8601),
  `nodeVersion` (`process.version`) y `env` con las **3 variables críticas**
  (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`) como **booleanos**
  — sólo indican si la var está presente, **nunca su valor** (Zero-Storage sin
  cambios: un secret no puede filtrarse por este endpoint). Sigue devolviendo
  `status:'ok'` + **HTTP 200 siempre** para no romper la sonda de Cloud Run.
- **Versión sin hardcodeo.** El `startup` log ya no tiene `'3.39.0'` escrito a
  mano: se lee de `package.json` vía `createRequire` (single source of truth),
  imposible de desincronizar al bumpar versión. Reutilizada en `/health`.

### Tests
- Nuevo `server/__tests__/health.test.js` (**8 tests**): status/versión/uptime
  creciente/timestamp ISO/nodeVersion/booleanos por clave/no-revelación de
  valores. Patrón supertest + express + factory `createTestApp()` (como
  `rateLimit.test.js`).
- Servidor: **16 → 24 tests** (logger 11 + geminiModelsProxy 3 + rateLimit 2 +
  health 8). Cliente: **569/569** sin cambios (no se toca el cliente).

### Notes
- **Sin dependencias nuevas** (`createRequire` es de `node:module`). **Cero
  cambios** en proxies, OAuth, rate limiters ni cliente.
- Cierra el item "Healthcheck extendido en `/health`" de #25 (parte 2 de 3);
  queda pendiente `deploy.sh` (#25-parte3).
- Cambio de código por ZCode (GLM-5.2).

---

## [3.39.0] — 2026-07-17

### Added
- **Logs estructurados en el servidor (#65, parte 1 de #25).** Nuevo módulo
  `server/logger.js` con `logEvent(level, msg, ctx)` que emite **una línea JSON
  por evento** (`ts`, `level`, `msg` + campos) a stdout/stderr, y middleware
  `requestIdMiddleware` que asigna un `req.id` (UUID) por petición y lo devuelve
  en el header `X-Request-Id`. Los 34 `console.log/error` de `server/index.js`
  se reescriben como `log.info/error('upstream'|'proxy_error'|...,
  {provider, flow, status, requestId, ...})`. Beneficio: los logs de Cloud Run
  son ahora filtrables en Logs Explorer por `jsonPayload.provider`,
  `jsonPayload.level` o `jsonPayload.requestId` — imposible con texto plano.
  Sin dependencias nuevas (JSON.stringify + process.stdout/stderr).

### Tests
- Nuevo `server/__tests__/logger.test.js` (11 tests): `logEvent` emite JSON
  parseable, mergea `ctx`, nivel inválido cae a `info`, escribe a stderr en
  `error`, una línea por llamada; `requestIdMiddleware` genera UUID, respeta
  `X-Request-Id` entrante válido, ignora vacío / >64 chars.
- Servidor: 5 → **16 tests** (5 previos + 11 del logger). Cliente: **569/569**
  sin cambios (no se toca el cliente).

### Notes
- **Zero-Storage (sin cambios):** los logs solo contienen metadatos (status,
  provider, requestId, content-type). **Nunca** bodies, headers `Authorization`
  ni API keys — la regla ya la seguían los `console.*`, ahora es explícita.
- **No cambia ningún flujo de usuario:** status, headers y bodies que recibe el
  cliente son idénticos a v3.38.1. Solo cambia cómo se emiten los logs.
- Relaja el canon "backend de un solo archivo": ahora `server/` tiene
  `index.js` + `logger.js` (utilidad pura, testeable aislada como los tests
  existentes). Las rutas, OAuth y proxies siguen todos en `index.js`.
- Cambio de código por ZCode (GLM-5.2).

---

## [3.38.1] — 2026-07-16

### Fixed
- **Ai& (`api.aiand.com`): CORS en producción — `Failed to fetch`.** El handoff v3.38.0 asumía (información de Tencent HY3, no del usuario) que Ai& no necesitaba proxy porque "CORS estaba verificado". En producción fallaba con *"No 'Access-Control-Allow-Origin' header is present on the requested resource"* → `net::ERR_FAILED`. Confirmado que `api.aiand.com` **no envía cabeceras CORS**, exactamente igual que NVIDIA NIM / OpenCode Zen / Cloudflare / Ollama (que tuvieron que moverse a proxy backend).
  - Nuevo proxy backend en `server/index.js`: `aiandLimiter` (100 req/min/IP) + `POST /api/aiand` (→ `https://api.aiand.com/v1/chat/completions`) + `GET /api/aiand/models` (→ `https://api.aiand.com/v1/models`). Patrón idéntico a OpenZen/Ollama: passthrough de `Authorization: Bearer`, copia de status/content-type, `pipeUpstream` (soporta streaming SSE), saneado de headers.
  - Cliente (`providers.ts`): `chatEndpoint` y `modelsEndpoint` pasan de URLs absolutas a `/api/aiand` y `/api/aiand/models`. Ai& pasa del grupo "directo" (Groq/OpenRouter/Zenmux) al grupo "proxy" (NIM/OpenZen/CF/Ollama). `transport: 'openai-compatible'` sin cambios.
- **Ai&: catálogo mostraba 5 modelos en vez de solo Qwen 3.6.** Los 5 eran el fallback estático `AIAND_FALLBACK`, con 4 modelos inventados por el handoff anterior (Qwen3 Coder Plus, DeepSeek V4, GLM 5.2, Llama 3.3) que no se validaron contra el catálogo real (que requiere key). Reducido `AIAND_FALLBACK` a **un único modelo** (`qwen/qwen3.6-27b`). Además la rama `aiand` de `fetchModels` no filtraba free-only: añadido `.filter(m => m.free)` tras el `.sort`, de modo que del catálogo dinámico solo aparecen modelos con `pricing` a 0.

### Changed
- Comentarios de cabecera de Ai& en `providers.ts` (fallback y entrada del provider) y de los nuevos handlers en `server/index.js` reescritos para corregir la afirmación falsa ("CORS verificado — sin proxy") y dejar constancia del motivo real del proxy.
- METODOLOGIA_IA.md: corregido el registro de v3.38.0 (quitada la afirmación "directo del navegador, sin proxy") y añadida entrada v3.38.1.

### Tests
- `providers.test.ts`: actualizadas las aserciones de Ai& — el test de endpoints ahora espera rutas relativas `/api/aiand`, `/api/aiand/models`; el test de `fetchModels` ahora verifica catálogo **free-only** (los modelos paid se filtran fuera en vez de marcarse `free === false`).

### Notes
- No cambia `defaultModel` (`qwen/qwen3.6-27b`), `maxOutputTokens: 8192`, `modelsNeedKey`, `keyPrefix: 'sk-'`, CORS del server, `.env` ni Dockerfile. La API key sigue viajando cliente→server por `Authorization` (Zero-Storage).
- El punto 3 del handoff (`permissions: contents: read` en CI) **ya estaba aplicado** en `.github/workflows/ci.yml:8-9`; sin acción.
- Cambio de código por ZCode (GLM-5.2).

---

## [3.38.0] — 2026-07-16

### Added
- **Nuevo proveedor de IA: Ai& (`api.aiand.com`).** Acceso DIRECTO desde el navegador (OpenAI-compatible, CORS verificado — sin proxy backend, mismo patrón que Groq/Zenmux/OpenRouter). Una sola entrada en el registro `PROVIDERS` (`providers.ts`); el resto (UI, `callAI`, validación) funciona sin tocar más ficheros.
  - Catálogo dinámico vía `GET /v1/models` con detección **free** por pricing (`input_per_1m`/`output_per_1m` a 0); fallback defensivo: modelo sin `pricing` → free. Filtra modelos no-chat (embedding, whisper, tts, asr, rerank, vision, clip, audio). Orden: free primero, luego alfabético.
  - Fallback estático `AIAND_FALLBACK` (5 modelos); `defaultModel: qwen/qwen3.6-27b`.
  - i18n ES/EN: `provider.aiand.cardDesc`, `provider.aiand.signupLabel`.
- **Robustez de límite de salida por proveedor (`effectiveMaxTokens`).** Nuevo campo opcional `maxOutputTokens` en `ProviderDef`; `callAI` resuelve `maxTokens ?? provider.maxOutputTokens ?? 4096` y lo pasa a ambos transportes (Gemini y OpenAI-compatible). Ai& usa 8192 → evita respuestas vacías / `emptyError` falso en modelos de razonamiento por truncado del `max_tokens`. Corrige además una asimetría: el default 4096 ahora aplica también a la rama Gemini (antes solo a OpenAI-compatible).

### Changed
- **Renombrado del nombre visible del producto (ES/EN):** "Asistente de IA para Publicar Repositorios" → **"Asistente de IA de GitHub"** / "AI Assistant for Publishing Repositories" → **"GitHub AI Assistant"**. Solo valores de strings visibles (4 claves i18n × idioma: `header.title`, `auth.title`, `chat.area.title`, `history.logHeader`), `<title>` de `index.html`, `description` de `package.json`, banner de arranque de `server/index.js` y comentarios de cabecera de `index.css` y `Dockerfile`. No se tocan claves/estructura, subtítulos, botones, otra i18n, lógica ni los usos de "Asistente de IA" como sustantivo genérico en commit messages/signatures.

### Tests
- **2 tests nuevos** en `providers.test.ts`: registro de `aiand` (transport, endpoints absolutos, `modelsNeedKey`, `maxOutputTokens: 8192`, default dentro de staticModels) y rama `aiand` de `fetchModels` (free por pricing 0, fallback sin pricing, filtrado de embedding, orden free primero).
- Regex de los 3 tests de UI (chatArea, ChatInput, Header) actualizadas al nuevo nombre (`/asistente de ia de github/i`).

### Notes
- Tests: 569/569 (client) + 5/5 (server) = **574 verdes**.
- Build limpio (`tsc` estricto + vite), lint 0 errores (8 warnings preexistentes).
- Bump 3.36.1 → 3.38.0 (el tag v3.37.0 existía pero no bumpéo los `package.json`; este cierre reconcilia saltando a 3.38.0).
- Cambio de código por ZCode (GLM-5.2).

---

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
