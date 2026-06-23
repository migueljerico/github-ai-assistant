### CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
