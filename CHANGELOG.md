### CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.3.0] — 2026-06-25

### Added
- **Adjuntar archivos Power BI `.pbix`/`.pbit` — #28 Fase 3b (MVP)** — Ahora puedes adjuntar un informe de Power BI y trabajar con él en lenguaje natural (preguntar, documentar, publicar). Un `.pbix`/`.pbit` es un **ZIP**; se abre en el navegador con **`fflate`** (Zero-Storage; lazy en su propio chunk) y se extrae **solo la estructura JSON**:
  - **Informe** (`Report/Layout`, en `.pbix` y `.pbit`): páginas y tipos de visual.
  - **Modelo de datos** (`DataModelSchema`, **solo `.pbit`**): tablas, columnas y **medidas DAX**.
  - **Limitación honesta (principio rector):** el modelo de un `.pbix` va en formato **binario VertiPaq** (no legible en navegador) → se avisa y se sugiere exportar como plantilla **`.pbit`** para incluir el DAX. El **Power Query (M)** del `DataMashup` queda para una fase **3b-bis**.
  - **Control de tokens:** muestra acotada (caps de páginas/tablas/medidas + presupuesto de caracteres) con aviso en el chat cuando se trunca.
  - Nuevo `utils/powerbiReader.ts` (`readPowerBI`); `runAttachFile` enruta `.pbix`/`.pbit` y compone el aviso. Cap de tamaño mayor para Power BI (25 MB) porque solo se lee el ZIP, no el dataset binario.

### Testing
- Tests de `readPowerBI` (informe, modelo/DAX de `.pbit`, aviso de modelo binario en `.pbix`, caps/truncado, DAX como array, ZIP corrupto/sin partes), `assertSupportedFile` (`.pbix`/`.pbit` + cap de 25 MB) y `runAttachFile` con Power BI. Cliente: **308 tests**.

## [3.2.0] — 2026-06-24

### Added
- **Adjuntar hojas de cálculo Excel/CSV — #28 Fase 3a** — Ahora puedes adjuntar `.xlsx`, `.xls` y `.csv` (además de PDF y texto/código) y trabajar con ellos en lenguaje natural (preguntar, documentar, publicar). Extracción con **SheetJS** (`xlsx`), en el navegador (Zero-Storage); la librería va en un chunk aparte (lazy).
  - **Control de tokens (clave en datasets grandes):** en vez de volcar todo el archivo —que reventaría el contexto del modelo (error 400)—, se extraen las **cabeceras + una muestra de las primeras 100 filas** por hoja y se **avisa en el chat**: *"…es grande, analizaré una muestra de las primeras 100 filas. Si necesitas cálculos sobre el dataset completo, dime qué calcular."* (principio rector: claro y orientado a la siguiente acción).
  - Nuevo `utils/spreadsheetReader.ts` (`readSpreadsheet`, `SPREADSHEET_SAMPLE_ROWS`); `runAttachFile` enruta las hojas y compone el aviso. "Documentar y publicar" (Fase 2) funciona igual sobre los datos extraídos.

### Testing
- Tests de `readSpreadsheet` (muestra de filas, truncado, múltiples hojas, CSV, vacío), `assertSupportedFile` (xlsx/xls) y `runAttachFile` con hoja (aviso de muestra). Cobertura/cliente: **297 tests**.

## [3.1.1] — 2026-06-24

### Fixed
- **Build de Cloud Run roto desde v3.0.0** — `client/package-lock.json` estaba **desincronizado** con `client/package.json`: el lockfile listaba `pdfjs-dist` en `dependencies` además de en `optionalDependencies`, mientras que el `package.json` solo lo tiene en `optionalDependencies`. El `Dockerfile` (Stage 1) usa `npm ci`, que **aborta** ante esa desincronización antes de construir → las versiones 3.0.0 y 3.1.0 no desplegaban. **Solución:** lockfile regenerado con `npm install` (ahora `pdfjs-dist` queda solo en `optionalDependencies`); `npm ci` vuelve a pasar. Sin cambios de funcionalidad respecto a 3.1.0.

## [3.1.0] — 2026-06-24

### Added
- **Documentar y publicar archivos — Fase 2 (#28)** — Con un archivo adjunto, nuevo botón **"📤 Documentar y publicar"**: la IA genera documentación en **Markdown** a partir del contenido y se abre un modal para **publicarla** donde elijas.
  - **Tres formas de publicar** (cada una *propón→confirma→ejecuta*): **📥 Commit directo** del fichero (`docs/{nombre}.md`) a la rama por defecto, **🔀 Draft PR** revisable, o **🏷️ GitHub Release** (usando la doc como notas, con versión sugerida automáticamente si no la indicas).
  - **Repo destino en lenguaje natural:** acepta `owner/repo` o solo el nombre (el owner es tu usuario). Vista previa de la documentación antes de publicar.
  - Reutiliza maquinaria existente: nueva `generateFileDoc` (`gemini.ts`), `publishFileDoc` (`docPublisher.ts`) y `releaseGenerator.ts`; orquestación en `services/assistantActions.ts` (`runGenerateFileDoc`/`runPublishFileDoc`/`runCreateFileRelease`) + nuevo `FilePublishModal.tsx`.
  - **Cierra el norte de #28:** adjuntar cualquier archivo → documentar → publicar (fichero o release). Más formatos (Excel/CSV, imágenes) quedan para la Fase 3.

### Testing
- Tests de `generateFileDoc`, `publishFileDoc` (commit + Draft PR), `runGenerateFileDoc`/`runPublishFileDoc`/`runCreateFileRelease` y `FilePublishModal`. Cobertura/cliente: **289 tests**.

## [3.0.0] — 2026-06-24

### Added
- **Subida de archivos locales — Fase 1 (#28)** — Nuevo botón **"📎 Adjuntar archivo"** en la barra del chat: adjuntas un archivo local y se carga como **contexto** del chat (chip "📎 nombre ✕"), igual que "Opinar sobre repo" pero con tu documento. A partir de ahí puedes preguntarle o pedir *"documéntame este archivo"* en lenguaje natural.
  - **Formatos:** PDF (extracción real con **`pdfjs-dist`**, con fallback básico) + texto/código (`txt, md, json, csv, yaml, código fuente…`). Validación de extensión y tamaño (máx. 5 MB) con mensajes claros.
  - **Cliente / Zero-Storage:** el archivo se lee **solo en memoria**; nada se sube a ningún servidor (el proxy no interviene). `pdfjs-dist` se carga en un chunk aparte (lazy).
  - Reutiliza `utils/pdfReader.ts`/`pdfAdvanced.ts` (ya existentes) + el patrón de contexto (#41); lógica en `services/assistantActions.ts` (`runAttachFile`) + nuevo `FileAttachButton.tsx`.
  - **Base del objetivo de #28** (documentar y publicar a partir de cualquier archivo): la Fase 1 ya habilita *documentar en lenguaje natural*; publicar/release y más formatos (Excel/CSV, imágenes) llegarán en fases siguientes.

### Testing
- Tests de `assertSupportedFile` (extensiones/tamaño), `runAttachFile` (lectura, archivo inválido, sin texto), `runSend` con archivo de contexto y `FileAttachButton`. Cobertura/cliente: **269 tests**.

## [2.9.0] — 2026-06-24

### Added
- **Streaming de respuestas token a token (#38)** — En modo chat (opiniones/consultas), la respuesta de la IA aparece **incrementalmente** (tipo ChatGPT) en vez de de golpe, con un cursor parpadeante mientras llega. Funciona en los **tres proveedores**:
  - `services/gemini.ts`: `callAI` acepta un callback opcional `onToken(textoAcumulado)`; `callOpenAICompatible` (Groq/OpenRouter) pide `stream: true` y parsea el SSE de deltas; `callGeminiDirect` consume el SSE del proxy. Helper compartido `readSSEStream`. Semántica "set" (texto acumulado) → segura ante el reintento transitorio.
  - `server/index.js`: el proxy `POST /api/gemini` admite `stream: true` y responde con **Server-Sent Events** usando `chat.sendMessageStream` (errores previos al stream siguen saliendo como JSON).
  - `services/assistantActions.ts`: `runSend` pasa `onToken` solo en modo chat (las acciones, que devuelven JSON, no se streamean). `ChatMessage.tsx` renderiza el texto a medida que llega.

### Testing
- Tests de streaming: `callAI` SSE (Groq y proxy Gemini), `runSend` (pasa/omite `onToken` según modo) y render incremental en `ChatMessage`. Cobertura/cliente: **259 tests**.

## [2.8.2] — 2026-06-24

### Changed
- **Refactor de `App.tsx` (#42, en 3 fases) — sin cambio de comportamiento.** Toda la lógica del chat sale del componente a módulos testeables:
  - **Fase 1:** `DocModal` extraído a `components/confirm/DocModal.tsx` (con botón Draft PR) + nuevo helper puro `utils/repoRef.ts` (`resolveRepoRef`, dedup del patrón `owner/repo`).
  - **Fase 2:** flujos "de botón" a `services/assistantActions.ts` con **dependencias inyectadas** (`runDocumentRepo`, `runLoadRepoContext`, `runSummarizeThread`, `runCommitDocs`, `runCreateDraftPr`).
  - **Fase 3:** el **núcleo** `runSend` (loop chat/acción), `runConfirmAction` y `runCancelAction` (*propón→confirma→ejecuta*).
  - `App.tsx` queda como JSX + estado + wrappers finos: **614 → 264 líneas**.

### Docs
- Nuevo **principio rector de producto** en `CLAUDE.md`: toda función debe entender lenguaje natural y guiar al usuario sin presuponer conocimientos de GitHub (números de issue, URLs, Base64…), manteniendo *propón→confirma→ejecuta* y Zero-Storage.

### Testing
- Tests de `assistantActions.ts` (~98%, todos los flujos + ramas de error), `DocModal` (100%) y `resolveRepoRef` (100%). Cobertura global **~50% → ~62%**. Cobertura/cliente: **251 tests**.

## [2.8.1] — 2026-06-23

### Fixed
- **Pantalla cortada en móvil y en "modo escritorio" de Chrome** — `body`/`#root` usaban `height: 100vh`, que en navegadores móviles incluye la franja de la barra del navegador, dejando la barra de entrada (y a veces la cabecera) fuera del área visible. Ahora usan **`100dvh`** (dynamic viewport height) con `100vh` de fallback. La pantalla de login (`.auth-screen`) también.
- **Cabecera desbordada a la derecha** — el badge de usuario quedaba cortado cuando el ancho apretaba (p. ej. en "modo escritorio" sobre el móvil). Ahora el bloque de logo/título encoge y se trunca (`min-width:0` + elipsis) y `.header-right` no se sale (`flex-shrink:0`).

### Changed
- **"Resumir hilo" más tolerante y guiado (#32)** — `parseThreadInput` acepta ahora **URLs de GitHub** (`.../issues/N`, `.../pull/N`), rutas `owner/repo/issues/N`, `owner/repo#N`, `#N` y `N`. Si introduces **solo el repositorio** (sin número), en vez de un error sin salida, el asistente **lista los issues/PRs abiertos** para que elijas cuál resumir (`listOpenThreads`/`formatThreadList`, reutilizando `listIssues`). Mensajes de ayuda más claros.

### Testing
- Nuevos tests de `parseThreadInput` (URL, ruta, repo-only), `listOpenThreads` (detección de PR) y `formatThreadList`. Cobertura/cliente: **215 tests**.

## [2.8.0] — 2026-06-23

### Added
- **Resumen de hilos de issues/PRs (#32)** — Nuevo botón **"📝 Resumir hilo"** en la barra del chat: se introduce `owner/repo#42` (o `#42` con un repo de contexto cargado) y la IA devuelve un resumen estructurado en Markdown (**TL;DR · Puntos clave · Decisiones/pendientes · Tono**) del hilo. Para issues incluye el cuerpo + comentarios de conversación; para PRs añade además los comentarios de **revisión** sobre código. Cubre un hueco real frente a Copilot al revisar discusiones largas.
  - `github.ts`: nuevos wrappers de **solo lectura** `getIssueOrPr()` (detecta PR vs issue por la clave `pull_request`), `getIssueComments()` y `getPullReviewComments()` (ambos con paginación completa).
  - Nuevo servicio `services/threadSummary.ts` (`summarizeThread()` + `parseThreadInput()`), espejo del flujo dedicado de `generateRepoDocs`: descarga → llamada LLM con prompt propio → render en burbuja de chat. No toca el flujo *propón→confirma→ejecuta* ni Zero-Storage (la clave sigue en memoria; el resumen no se persiste).
  - Nuevo componente `ThreadSummaryButton.tsx`.

### Testing
- Tests para los wrappers de comentarios (`github.test.ts`: paginación + paths) y para `threadSummary` (`parseThreadInput`, issue vs PR, hilo vacío, limpieza de fences). Cobertura/cliente: **202 tests**.

## [2.7.4] — 2026-06-23

### Fixed
- **Tarjetas de plantilla en blanco que se desbordaban (escritorio)** — `.template-item` era un `<button>` sin `background` ni `width`, por lo que el navegador le aplicaba el estilo nativo (fondo blanco, texto negro, ancho según contenido) y se salía del panel. Ahora resetea el estilo nativo (`background:transparent`, `width:100%`, `color`, `text-align`, `font-family`).
- **Toggles 📋/📜 fuera de pantalla en móvil** — Los 5 elementos de `.header-right` se desbordaban y empujaban los botones de Plantillas/Historial fuera del viewport, impidiendo abrir los paneles en móvil. Ahora en móvil la cabecera es compacta: toggles solo-icono, badge de conexión solo-punto (`.btn-label` oculto) y el badge de proveedor se trunca con elipsis.
- **Barra inferior cortada en móvil** — `.chat-input-extras` no envolvía; ahora usa `flex-wrap: wrap` para que el checkbox + botones pasen a varias líneas sin cortarse.

## [2.7.3] — 2026-06-23

### Fixed
- **Layout móvil inutilizable** — Los paneles laterales (Plantillas e Historial) arrancaban **abiertos** y en pantallas ≤900px (donde son overlays `position:fixed`) tapaban el chat. Ahora en móvil arrancan **cerrados**, se abre solo uno a la vez y un **fondo oscuro** (`.mobile-backdrop`) permite cerrarlos tocando fuera; ancho de panel adaptado (`min(82vw, …)`).

### Changed
- **Robustez ante caídas transitorias de los proveedores de IA** — Las peticiones (`callAI`) ahora **reintentan con backoff** (hasta 2 veces) SOLO ante errores **transitorios** del servidor (Gemini `503 "high demand, try again later"`, OpenRouter `"Provider returned error"`, fallos de red), nunca ante 4xx no recuperables (key inválida, 400). Helpers `isTransientAIError`/`withTransientRetry` en `gemini.ts`.
- **Default de modelo más fiable** — Al cargar el catálogo, se elige por defecto un modelo gratuito **fiable** (`pickDefaultModel`: Gemma → Llama 3.3 70B → DeepSeek…) en vez de un `:free` arbitrario, ya que muchos endpoints gratuitos de OpenRouter están saturados. Se respeta la elección explícita del usuario.
- **Mensajes de error más claros** — Ante un fallo de proveedor OpenAI-compatible, el mensaje explica que el modelo gratuito está saturado y sugiere probar otro (Gemma) o cambiar a Gemini/Groq.

### Docs
- Sincronización completa a v2.7.3 (README, MANUAL_TECNICO, MEJORAS_FUTURAS, CLAUDE.md, `package.json`/lockfiles).
- Nuevo ítem de roadmap **#49** (gestión de la ventana de contexto / RAG ligero), surgido de una revisión de arquitectura de **Gemma 4 31B** (vía OpenRouter) **obtenida usando la propia app** (dogfooding) y reformulado a un índice en memoria para respetar el modelo "sin BD". Gemma añadida a la tabla de validación cruzada del README. #40 actualizado: el reintento transitorio de IA queda como sub-tarea ✅ parcial.
- Más cobertura de tests: `pickDefaultModel` (selección de default fiable en el panel) y la ruta de error de proveedor en `callOpenAICompatible`.

## [2.7.2] — 2026-06-22

### Fixed
- **El desplegable de modelos seguía sin abrir** (los 3 proveedores) — La causa real no era el anidamiento `button`/`select` (corregido en 2.7.1) sino el pseudo-elemento decorativo `.provider-card::before` (`position:absolute; inset:0`), que se pintaba por encima de los inputs y, al no ser un objetivo de eventos independiente, **enrutaba los clics a la tarjeta** en vez de abrir el `<select>`. Solución: `pointer-events:none` en el overlay + `z-index` en `.provider-card-inputs`.
- **Opinión con contexto de repo devolvía burbuja vacía o "Provider returned error"** — `callOpenAICompatible` devolvía el contenido sin validar. Ahora, si el modelo no devuelve contenido (o no trae `choices`), se lanza un error **claro y accionable** ("prueba con otro modelo del desplegable o un repo más pequeño") en lugar de una burbuja vacía o un crash; los errores de proveedor incluyen una pista sobre límites/contexto de los modelos gratuitos.

## [2.7.1] — 2026-06-22

### Fixed
- **El desplegable de modelos no abría** — La tarjeta de proveedor era un `<button>` que envolvía el `<select>` (HTML inválido), impidiendo que el desplegable nativo se abriera (afectaba a Groq y OpenRouter, que mostraban el contador correcto pero solo una opción). Ahora la tarjeta es un `<div role="button">` accesible por teclado; el selector lista todos los modelos. Elimina además el aviso `validateDOMNesting`.
- **Botón "Conectar" inaccesible** — Con la tarjeta de OpenRouter expandida, el botón quedaba fuera del viewport (la pantalla de conexión no scrolleaba porque `#root`/`body` están en `overflow:hidden`). `.auth-screen` ahora hace scroll (`overflow-y:auto` + `justify-content: safe center`).
- **Contexto de repo (#41) no reconocido sin nombrar `user/repo`** — La detección de modo enviaba algunas preguntas de opinión a modo acción, por lo que el contexto del repo no se inyectaba. Lógica extraída a `utils/modeDetection.ts` (testeable) que, con un repo cargado como contexto, sesga a chat salvo acción explícita.

### Changed
- **Strings de UI a multi-proveedor** — Cabecera ("Powered by Google Gemini" → "Multi-proveedor de IA · GitHub API") y pantalla de login.
- **Documentación sincronizada a v2.7.1** — README, MANUAL_TECNICO, MEJORAS_FUTURAS, CLAUDE.md y versiones de `package.json`/lockfiles (varias cabeceras se habían quedado en v2.5.0).

## [2.7.0] — 2026-06-22

### Added
- **Multi-proveedor de IA con OpenRouter (#15)** — Nuevo proveedor seleccionable **OpenRouter**, pasarela OpenAI-compatible que con una sola key da acceso a modelos **gratuitos** (🆓) y de pago (OpenAI, Claude, Llama… 300+). El usuario elige proveedor y modelo; coherente con Zero-Storage (una key activa, solo en memoria).
  - El catálogo de OpenRouter se carga en tiempo real desde su `/models` (público), etiqueta los modelos gratuitos y preselecciona uno gratis.

### Changed
- **Registro de proveedores (`services/providers.ts`)** — Nueva fuente única de verdad config-driven que describe cada proveedor (transporte, endpoints, modelos, etc.). Elimina el hardcoding de `gemini`/`groq` repartido por `gemini.ts`, `AIProviderPanel`, `AIProviderBadge` y `App.tsx`. Añadir un proveedor nuevo es ahora rellenar una entrada.
- **`callGroq` generalizado a `callOpenAICompatible`** — un único cliente para cualquier API compatible con OpenAI (Groq, OpenRouter); `callAI`/`validateProviderKey` enrutan por `transport`.

### Fixed
- Nota de pie del panel de conexión: decía erróneamente que la clave se guarda en `sessionStorage`; ahora refleja el modelo Zero-Storage real (la clave vive solo en memoria).

## [2.6.0] — 2026-06-22

### Added
- **Generación de documentación vía Draft PR (#45)** — El modal de documentación ofrece ahora un botón **"🔀 Crear Draft PR"** junto al commit directo: crea una rama `docs/auto-{timestamp}`, sube `README.md` y `MANUAL_TECNICO.md` y abre un **Draft Pull Request** contra la rama por defecto, con enlace al PR en el chat. Entregable revisable en vez de copiar/pegar.
  - `github.ts`: nuevos `getRepo()` y `getBranchSha()`; `createOrUpdateFile()` acepta un parámetro `branch` opcional para commitear en una rama concreta.
  - Reutiliza `createBranch()` y `createPullRequest()` (que ya soportaba `draft`).
  - Se preserva el commit directo existente: el usuario elige.

### Testing
- Tests para `getRepo`, `getBranchSha` y `createOrUpdateFile` con/sin `branch`. Cobertura/cliente: 150 tests.

## [2.5.0] — 2026-06-21

### Added
- **Opiniones de chat fundamentadas en el repo (#41)** — Se puede cargar un repositorio como *contexto activo* del chat (botón "💬 Opinar sobre repo" + chip "Contexto: owner/repo"). Las opiniones del modo chat se basan entonces en el código real (árbol + archivos clave vía `fetchRepoTreeRecursive`), en lugar de respuestas genéricas.
  - `gemini.ts`: `buildRepoContextSummary()` (contexto compacto, truncado por líneas) y `chatPromptWithContext()` (CHAT_PROMPT reforzado).
  - Zero-Storage: el contexto vive solo en estado React.

### Testing
- Tests para `buildRepoContextSummary` y `chatPromptWithContext`. Cobertura/cliente: 141 tests.

## [2.4.0] — 2026-06-21

### Fixed
- **Calidad de respuestas Groq (#27)** — `callGroq()` ahora recibe el `mode` y ajusta la temperatura (`0.7` en chat, `0.1` en acción), igualando la calidad conversacional de Gemini

### Changed
- **`callAI()`** propaga el parámetro `mode` también al proveedor Groq (antes solo a Gemini)
- **`actionExecutor.ts`** — Eliminados imports muertos de `github.ts` (limpieza, sin cambio funcional)

### Infrastructure
- **CI ejecuta los tests del servidor (#37)** — Nuevo job `server-test` en `.github/workflows/ci.yml`; añadidas devDependencies `vitest` y `supertest` y script `test:server` en la raíz
- **ESLint operativo (flat config)** — Añadido `client/eslint.config.js` para ESLint v9 (faltaba el fichero de configuración); el lint vuelve a ejecutarse y se integra como paso del CI. Limpieza de código muerto detectado por el linter (imports/variables sin usar)
- **Tests reorganizados** — Todos los `*.test.ts(x)` movidos a carpetas `__tests__/` para una estructura uniforme (`services/` y `example.test.ts`)

### Testing
- Tests añadidos para la temperatura por modo en `callGroq` (chat/action/por defecto)
- Nueva cobertura para `pdfReader`, `pdfAdvanced`, `releaseGenerator` y `TemplatePanel` — cobertura total **32% → 42%** (resuelve el aviso de patch coverage de Codecov sobre los ficheros modificados)

### Docs
- **MEJORAS_FUTURAS.md** — #27 y #37 marcados como resueltos; nuevos ítems #38 (Streaming SSE), #39 (ErrorBoundary + a11y) y #40 (Robustez IA/UX); tabla Resumen recalculada (31 ítems)

## [2.3.0] — 2026-06-19

### Added
- **Rate limiting en proxy Gemini (#14)** — 40 peticiones/minuto por IP con `express-rate-limit`
- **Utilidad `formatResultData` extraída (#17)** — Movida a `client/src/utils/formatResult.ts` con tests unitarios
- **`crypto.randomUUID()` (#18)** — Reemplazado `Math.random()` para generación de IDs seguros

### Changed
- `App.tsx` — Importa `formatResultData` desde utils (reducción de ~60 líneas)
- `server/index.js` — Rate limiter aplicado al endpoint `/api/gemini`

### Security
- IDs de mensajes ahora usan CSPRNG (UUID v4) en lugar de `Math.random()`
- Proxy Gemini protegido contra abuso con rate limiting

### Testing
- Tests añadidos para `formatResultData` (7 casos)
- Cobertura Codecov: 30% → 32%

## [2.2.0] — 2026-06-18

### Added
- **Testing completo con Vitest + Codecov** — Infraestructura de testing unitario e integración
  - Tests para `AuthContext.tsx` (Zero-Storage, login, logout, OAuth)
  - Tests para `AIProviderContext.tsx` (conexión/desconexión de proveedores IA)
  - Tests para `actionExecutor.ts` (ejecutor de acciones GitHub, métodos HTTP)
  - Tests para `github.ts` (wrapper API, utilidades Base64)
  - Tests para `gemini.ts` (parsing de acciones, detección de lenguaje)
  - Tests de componentes React: `ChatArea`, `ChatInput`, `ConfirmModal`, `Header`
- **CI/CD con cobertura** — GitHub Actions ejecuta tests y sube cobertura a Codecov automáticamente
- **Badge de Codecov** en README mostrando cobertura actual (30%)

### Changed
- **Cobertura de tests:** 0% → 30% (infraestructura base completada)
- **Documentación actualizada** — README.md, MEJORAS_FUTURAS.md reflejan estado de testing

### Infrastructure
- Vitest configurado con jsdom y React Testing Library
- Reporte de cobertura en formato lcov para Codecov
- Tests ejecutados en cada push/PR a main

## [2.1.0] — 2026-06-08

### Added
- **Gemini API proxy** — Solución al bloqueo europeo (EEA). Las llamadas a Gemini ahora se enrutan a través del servidor Express desplegado en us-central1 (Cloud Run), donde la API es plenamente accesible.
- **POST /api/gemini** en `server/index.js` — Proxy que recibe `{ apiKey, model, messages, systemPrompt }` del frontend, reconstruye el historial de conversación multi-turno con el SDK de Gemini, y devuelve `{ text }`. La API key viaja en el body HTTPS y no se almacena.
- **@google/generative-ai** añadido a las dependencias del servidor (`package.json` raíz).

### Changed
- **callGeminiDirect()** en `gemini.ts` — Ahora llama a `POST /api/gemini` en lugar de usar el SDK directamente desde el navegador. La estructura de mensajes multi-turno y el system prompt se preservan íntegramente.
- **@google/generative-ai** eliminado de las dependencias del cliente (`client/package.json`) — el SDK ahora reside solo en el servidor.
- **Región de despliegue** migrada de `europe-southwest1` a `us-central1` para eludir las restricciones de la API de Gemini en la UE/EEA.

### Architecture note
Groq no se ve afectado — sus llamadas siguen siendo directas desde el navegador sin restricción geográfica. El proxy solo aplica a Gemini.

---

## [2.0.1] — 2026-06-07

### Fixed
- **OAuth state verification** (`server/index.js`) — El parámetro `state` ahora se genera, almacena en sesión y verifica en el callback para prevenir ataques CSRF en el flujo OAuth.
- **SESSION_SECRET obligatorio en producción** — El servidor llama a `process.exit(1)` si `SESSION_SECRET` no está definido en entorno de producción, previniendo despliegues con secret débil por omisión.

---

## [2.0.0] — 2026-06-07

### Added
- **GitHub OAuth** — Autenticación completa con flujo OAuth 2.0 (+ fallback con PAT)
- **Panel de confirmación** — Toda operación de escritura muestra el plan en lenguaje natural y requiere confirmación explícita del usuario
- **Historial de sesión** — Sidebar con todas las acciones de la sesión, estados (✅/❌/⏸️/⏳) y exportación a .txt
- **Biblioteca de plantillas** — Plantillas predefinidas de README, .gitignore, licencias y CI/CD
- **Modo multi-repo** — Selección y aplicación simultánea de acciones a varios repositorios
- **Modo "Documenta mi repositorio"** — Análisis automático de hasta 80 archivos y generación de README + MANUAL_TECNICO.md
- **Soporte dual de proveedor de IA** — Google Gemini y Groq Cloud, con el usuario aportando su propia clave
- **Panel de conexión de IA** — Onboarding guiado para conectar Gemini o Groq con validación de clave en tiempo real
- **Badge del proveedor de IA** — Indicador visual en el header con proveedor y modelo activos
- **Health check /health** — Requerido por Google Cloud Run
- **Dockerfile multi-stage** — Build optimizado para Cloud Run (Node 20 Alpine)
- **Límite de 80 archivos** y exclusión de binarios en el modo de documentación de repos
- **Resolución de placeholders en endpoints** — El executor sustituye `{username}`, `{owner}`, `{repo}` automáticamente
- **Formateador inteligente de resultados** — Muestra repos, archivos y datos de la API en formato legible (no JSON crudo)

### Changed
- **Migración completa** desde Google AI Studio a aplicación full-stack React + Express
- **Arquitectura backend thin** — El servidor Express solo gestiona OAuth y proxy Gemini; todas las llamadas a GitHub y Groq son directas desde el navegador

---

## [1.0.0] — 2026-05-15

### Added
- **Prototipo en Google AI Studio** — Primera versión construida directamente en Google AI Studio, configurando un agente de Gemini mediante ingeniería de prompts.
- **Ejecución directa** — El agente ejecuta instrucciones sobre la GitHub API sin confirmación previa.
- **Autenticación PAT** — Solo soporte para Personal Access Tokens.
- **Despliegue en Cloud Run** — Primera versión desplegada en Google Cloud Run.
