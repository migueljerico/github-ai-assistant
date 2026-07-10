### CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.24.0] — 2026-07-10

### Changed
- **Catálogo de modelos de Gemini reescrito como lista fija.** El catálogo
  dinámico (vía proxy `GET /api/gemini/models`) no era fiable en producción: el
  frontend caía al fallback estático de 2 modelos (uno de ellos, `gemini-2.5-
  flash-lite`, ni siquiera existe), la nota de deprecación estaba desactualizada
  y el desplegable no mostraba los modelos operativos reales. Sustituido por un
  **catálogo 100% fijo** en `providers.ts` con los 6 modelos confirmados:
  `gemini-2.5-flash` (⭐ Recomendado), `gemini-2.5-pro`, `gemini-3.5-flash`,
  `gemini-3.1-flash-lite`, `gemini-2.0-flash` y `gemma-4-31b-it`. Quitado
  `modelsEndpoint` de Gemini → el selector usa directamente `staticModels`, sin
  ningún fetch dinámico.

### Removed
- **Eliminado el aviso obsoleto** «Los modelos gemini-2.0 y gemini-1.5 están
  deprecados y tienen cuota = 0. Solo usa modelos 2.5.» (claves i18n
  `provider.gemini.note` en `es.ts` y `en.ts`).
- **Eliminada la ruta duplicada** `GET /api/gemini/models` en `server/index.js`
  que estaba anidada dentro del handler de chat (código muerto que nunca se
  ejecutaba como ruta real; la ruta vigente se mantiene por
  compatibilidad/observabilidad aunque el frontend ya no la llama).
- Eliminado `gemini-2.5-flash-lite` del catálogo y de `modelLabels.ts` (no
  existe / deprecado). Limpiados también `gemini-1.5-*`.

### Notes
- _Cambio de código por **ZCode** (GLM-5.2)._

## [3.23.3] — 2026-07-10

### Changed
- **El GitHub release pasa a ser automático.** Hasta v3.23.2, el `commit` + `push`
  + `tag` se ejecutaban sin pedir permiso al cerrar una gestión, pero el **GitHub
  release** (la página pública con notas) esperaba confirmación del autor. A petición
  suya, ahora **también se publica automáticamente** como último paso de la rutina de
  cierre (`gh release create vX.Y.Z --notes-file ...`). Lo **único** que sigue
  esperando confirmación es el **deploy a Cloud Run** (vía Cloud Build). Documentado
  en `CLAUDE.md §8` y `METODOLOGIA_IA.md §1/§2` (filosofía, rutina de cierre y puntos
  de parada).
- Publicado el release `v3.23.2` que había quedado pendiente.

### Notes
- _Cambio de documentación de proceso por **ZCode** (GLM-5.2)._

## [3.23.2] — 2026-07-10

### Fixed
- **El catálogo dinámico de Gemini seguía sin cargar (#58 hotfix 2)** — v3.23.0/3.23.1 corrigieron el método del endpoint (GET + header), pero el catálogo seguía fallando por **tres causas encadenadas**, todas arregladas ahora:
  1. **`listModels()` no existe en el SDK.** El backend llamaba `new GoogleGenerativeAI(apiKey).listModels()`, pero `@google/generative-ai` (v0.21–0.24) **no expone ese método** → `TypeError` → 500. Reemplazado por una llamada directa a la **REST API de Google AI** (`GET /v1beta/models?key=…`), que sí devuelve `{ models: [{ name, displayName, supportedGenerationMethods }] }`. El filtrado ahora exige `generateContent` (además del denylist de subcadenas) y recorta el prefijo `models/` para que los IDs encajen con `getGenerativeModel({ model })`.
  2. **La UI nunca disparaba la petición.** El `useEffect` de `AIProviderPanel` exigía `def.keyPrefix` para lanzar `fetchModels`, y Gemini no lo tenía definido → el catálogo se quedaba siempre en el array estático. El gate se relajó (si no hay `keyPrefix`, basta con longitud ≥20) y se añadió `keyPrefix: 'AIza'` al registro de Gemini.
  3. **Sin proxy `/api` en desarrollo.** Vite solo proxyaba `/auth`, así que en local `fetch('/api/gemini/models')` caía en el dev server de Vite (404/HTML). Añadido el proxy `/api → http://localhost:3001`. En producción no hace falta (Express sirve SPA + `/api` del mismo origen).

### Tests
- Reescrito `server/__tests__/geminiModelsProxy.test.js`: el mock anterior inventaba un método `listModels()` en el SDK (que no existe), por lo que el test pasaba aunque el código real rompía. Ahora mockea `fetch` global y simula la respuesta REST real de Google (incluye `supportedGenerationMethods` y el prefijo `models/`), validando el shaping, el filtrado y la propagación de status.
- Añadidos 2 tests en `AIProviderPanel.test.tsx` que cubren el gate corregido: dispara `fetchModels` con una key `AIzaSy…` válida y no lo dispara con una key demasiado corta.
- Suite completa en verde: **485/485 tests cliente** + **3/3 tests servidor** + `tsc -b` limpio.

### Notes
- _Investigación de causas raíz iniciada por **Grok 4.5** (x.ai); fix, tests y verificación completados por **ZCode** (GLM-5.2)._

## [3.23.1] — 2026-07-08

### Fixed
- **El catálogo dinámico de Gemini no cargaba (#58 hotfix)** — el backend tenía el endpoint como `POST` que leía la `apiKey` del body, pero `fetchModels` (cliente) envía `GET` con la key en el header `Authorization` (mismo patrón que Groq/OpenRouter). Cambiado el endpoint a `GET` + lectura del header `Authorization: Bearer ...`. Ahora el selector de modelos de Gemini sí pobla dinámicamente con los modelos reales disponibles para la key del usuario.

### Notes
- Creado skill personal `context-saver` (`~/.agents/skills/context-saver/`) con técnicas de economía de contexto para sesiones largas.
- _Fix asistido por **ZCode** (GLM-5.2)._

## [3.23.0] — 2026-07-07

### Added
- **Catálogo dinámico de modelos de Gemini (#58)** — Gemini ahora obtiene su lista de modelos **en tiempo real** desde la API (como ya hacían Groq y OpenRouter), en vez de un array estático que se desfasaba. Como la API de listado de Gemini también está bloqueada en UE desde el navegador, se añadió un nuevo endpoint `POST /api/gemini/models` al proxy del backend (patrón idéntico al proxy de chat existente): el usuario pega su key, el backend lista los modelos disponibles con el SDK de Google, filtra los no generativos (embeddings, visión, etc.) y los devuelve al selector. Si un modelo se depreca mañana, desaparece solo del selector — adiós al array desfasado.

### Notes
- **`supertest` declarado pero no instalado en la raíz:** los tests del servidor (`server/__tests__/`) no corren localmente ni en CI (el CI solo ejecuta `client/`). El nuevo test `geminiModelsProxy.test.js` es correcto en su lógica y pasará cuando se haga `npm install` en la raíz; lo dejo escrito para futura cobertura del servidor.
- _Investigación, fix y tests asistidos por **ZCode** (GLM-5.2)._

## [3.22.3] — 2026-07-06

### Fixed
- **Modelos de razonamiento (Qwen 3.6, QwQ, DeepSeek-R1) fallaban en modo acción** — estos modelos emiten un bloque `<think>...</think>` con un JSON de ejemplo *antes* del JSON real; el parser se quedaba con el del `<think>` (se cierra antes) y descartaba el correcto. Ahora `extractJsonCandidates` quita los bloques `<think>`/`<reasoning>`/`<reflection>` antes de extraer candidatos. Mismo fix aplicado a `generateRepoDocs`, que usaba un parser simple distinto.
- **"❌ Error al documentar: Not Found"** al documentar un repo inexistente o sin acceso — `runDocumentRepo` ahora pre-chequea con `getRepo` y muestra un mensaje claro en el idioma activo ("No encontré owner/repo. ¿Existe y tu token tiene acceso?") en vez del 404 crudo de GitHub.
- **"❌ La IA no devolvió JSON válido"** al documentar un repo (especialmente ya documentado) — `generateRepoDocs` ahora usa el mismo parser robusto que el modo acción (extrae JSON aunque el modelo lo envuelva en prosa o emita `<think>` antes).
- **404 en repos cuya rama por defecto no es `main`** — `runDocumentRepo` ahora obtiene la rama por defecto real vía `getRepo` (patrón de `runCodeHealth`), en vez de asumir `main`.

### Notes
- **La confusión de la UI de documentación (dos botones/modales divergentes) persiste** y se documenta como **#57** en `MEJORAS_FUTURAS.md`: unificar en un solo flujo (un botón "📝 Documentar" → modal con selector de origen: repo / archivo adjunto / contexto-opinión). Los fixes de v3.22.3 quitan los errores concretos, pero la unificación de UX queda para otra sesión.
- _Investigación, fix y tests asistidos por **ZCode** (GLM-5.2)._

## [3.22.2] — 2026-07-05

### Fixed
- **Rotura con modelos no-Llama en Groq (Qwen, Gemma…)** — desde v3.22.0, la directiva de idioma `withLangDirective` se aplicaba **también al prompt de acción** (que exige JSON puro), lo que confundía a modelos menos dóciles: priorizaban "Responde al usuario en español" sobre "Responde SOLO con JSON" y devolvían prosa → el parser no encontraba JSON → la acción no se ejecutaba **y además en silencio**. Tres arreglos:
  1. La directiva de idioma ahora **solo se aplica al modo chat** (texto Markdown); el modo acción (JSON) queda sin directiva, como antes de v3.22.0.
  2. `parseGeminiAction` es ahora **tolerante**: extrae el primer bloque `{...}` balanceado aunque el modelo lo envuelva en prosa ("Aquí tienes: {...}") o incluya llaves dentro de strings. Antes exigía que toda la cadena fuera JSON.
  3. Cuando una acción no produce JSON válido, el usuario recibe un **aviso claro** ("⚠️ El modelo no devolvió una acción válida…") seguido del texto recibido, en vez del texto crudo sin explicar.

### Notes
- **Bug 2 (no resuelto, documentado como #55 y #56):** con la interfaz en inglés, las plantillas del panel lateral (#55) y las descripciones del historial de acciones de solo lectura (#56) siguen en español. Causa raíz ya diagnosticada en `MEJORAS_FUTURAS.md`; se dejan para la próxima sesión por la regla de "no quedarse a medias".
- _Investigación, fix y tests asistidos por **ZCode** (GLM-5.2)._

## [3.22.1] — 2026-07-04

### Changed
- **Cobertura de tests (docs):** el README citaba "436 tests" (cifra de v3.16.0); actualizado a **476 tests** (v3.19.0+) y se remite a Codecov para el porcentaje exacto. Unificado el mismatch interno `~60%` vs `~64%` de MEJORAS_FUTURAS (#26).

### Notes
- **NVIDIA Build (NIM) documentado como #54** en el roadmap (baja prioridad): análisis del enfoque correcto — cliente OpenAI-compatible (entrada en el registro `PROVIDERS`, key `nvapi-` en memoria, Zero-Storage), **no** backend con `process.env` ni SDK oficial de OpenAI (contradice la arquitectura; el proxy de Gemini existe solo por el bloqueo UE). Añadida convención rectora en `CLAUDE.md §5` para blindar este patrón frente a propuestas externas.
- _Corrección documental asistida por **ZCode** (GLM-5.2)._

## [3.22.0] — 2026-07-03

### Added
- **Internacionalización (i18n) — Fase 3 (#24, Sprint 4)** — Completa la traducción ES/EN de las partes que faltaban desde la Fase 2 (v3.21.0):
  - **Chat central:** `ChatArea` (bienvenida, ejemplos), `ChatMessage` ("Pensando...", tarjetas de acción) y el locale del timestamp (`es-ES`/`en-US`) sigue al idioma activo.
  - **Historial de sesión:** las ~32 descripciones que genera la orquestación (`runDocumentRepo`, `runSummarizeThread`, `runCommitDocs`, etc.) y el log exportado (cabecera y nombre de fichero) ahora se traducen.
  - **Plantillas de autocompletado:** `instructionSuggestions` se reestructuró como factoría `buildTemplates(t)`; los 17 títulos, descripciones y plantillas se traducen (al pulsar una en EN, el texto insertado va en EN).
  - **Respuestas de la IA en el idioma activo:** el idioma (`lang`) se cablea por `ChatDeps` hasta los system prompts; una directiva dinámica (`withLangDirective`) fuerza que el modelo responda en español o inglés. Aplica al chat, a las acciones y a la generación de documentación (la directiva "EN ESPAÑOL" de `generateFileDoc` ahora es condicional).
- **Bilingüe real de extremo a extremo:** la interfaz, las descripciones del historial y las respuestas del modelo respetan el idioma seleccionado.

### Fixed
- **Fallback de Groq tras la deprecación de Llama 3.3 70B Versatile** (agosto): el `defaultModel`/fallback ahora apunta a `llama-3.1-8b-instant` (vigente) en vez del modelo retirado; `RELIABLE_MODEL_PREFS` pasa de `'llama-3.3-70b'` a `'llama'` (genérico) para ser robusto a futuras deprecaciones. El catálogo del selector es dinámico, así que el modelo retirado desaparece solo en agosto.
- **Fechas documentales:** se eliminan las referencias inexactas a "2025"/"2025–2026" en README y `METODOLOGIA_IA.md` (el curso y la app empezaron en 2026; Antigravity 2.0 se publicó el 18 may 2026 y no pudo usarse antes).

### Notes
- _Implementación, corrección documental y cierre de versión asistidos por **ZCode** (GLM-5.2)._

## [3.21.0] — 2026-07-02

### Added
- **Internacionalización (i18n) — Fase 2 (#24, Sprint 4)** — Completa la traducción ES/EN de la capa de interacción que faltaba desde la Fase 1 (v3.20.0):
  - **Modales de confirmación y documentación** (`ConfirmModal`, `DocModal`, `FilePublishModal`, `PublishActions`) y el **visor de diferencias** (`DiffViewer`): ahora todas sus etiquetas, aria-labels, leyendas (`Eliminado`/`Añadido`) y cabeceras del patch se traducen según el idioma activo.
  - **Mensajes visibles del chat** en `assistantActions.ts`: los errores de hilo/repo, los avisos "⏹️ Generación detenida" / "⏸️ Acción cancelada", el hint de adjuntar archivo y el error de extracción de texto. La función `t()` se **inyecta** en la capa de orquestación a través de `ChatDeps` (siguiendo el patrón de inyección de dependencias existente), sin tocar la arquitectura.
  - **Refactor del `labelMap`** de `ConfirmModal`: el doble mapeo *literal español → `t(key)`* se sustituye por un patrón `labelKey` directo con type guard, eliminando un fallback frágil.
  - **Descartado** el trabajo previo de la rama `feature/i18n-phase2-complete` (divergida y con bugs) en favor de una rama limpia `feature/i18n-fase2` nacida de `main`.

### Fixed
- **`modal.filepub.rootDest`** — la clave de diccionario no existía y la UI mostraba el literal `modal.filepub.rootDest` como destino de carpeta para archivos extra; ahora existe (`raíz` / `root`) y el `?? 'root'` muerto se eliminó.
- **3 tests de `ConfirmModal`** que fallaban tras la migración a `t()` (buscaban `/ejecutando/` y dos puntos finales que ya no existen).

### Notes
- **No traducidos (deliberado, fuera de alcance):** los mensajes de commit / cuerpos de Draft PR de `docPublisher.ts` y `github.ts` (van a GitHub como texto técnico, no a la UI), las descripciones del historial de sesión (log interno) y las etiquetas `Usuario`/`Asistente` del historial formateado (van al LLM como contexto, no al chat). Para traducir los servicios haría falta refactorizar el i18n a una función `t(lang, key)` pura (no hook) — se deja para una futura profundización si surge demanda.
- _Cierre de versión y documentación asistidos por **ZCode** (GLM-5.2)._

## [3.20.0] — 2026-06-28

### Added
- **Internacionalización (i18n) ligera — Fase 1 (#24, Sprint 4)** — Infraestructura propia **sin dependencias externas** para soportar Español e Inglés en la interfaz estática: nuevo `LanguageContext` + función `t()` con interpolación de variables (ej. `{provider}`). Selector de idioma 🌐 en la cabecera y en la pantalla de login; idioma recordado en `sessionStorage` (no es secreto, cumple con Zero-Storage). **UI traducida:** pantalla de login (`AuthGate`), cabecera (`Header`), panel de configuración de IA (`AIProviderPanel`), barra de chat (`ChatInput`) y sus 7 botones de acciones rápidas (Documentar, Resumir, Changelog, Salud, Exportar, Opinar, Adjuntar). `providers.ts` adaptado para soportar claves de traducción.
- _Cierre de versión y documentación asistidos por **ZCode** (GLM-5.2)._

### Notes
- **Fase 2 (entregada en v3.21.0):** traducción de los modales, el visor de diferencias y los mensajes visibles del chat.

## [3.19.0] — 2026-06-27

### Added
- **Exportar/importar la conversación (#46, Sprint 4)** — Nuevos botones **💾 Exportar** y **📂 Importar**: descarga la conversación actual como un **JSON** y recupérala en otra sesión (p. ej. tras recargar con F5). Útil para no perder el contexto de lo que estabas haciendo con un repo. **Respeta Zero-Storage**: nada se auto-persiste en el navegador (ni `localStorage` ni IndexedDB) — el fichero lo controlas tú. Si la conversación tenía un repo de contexto activo, al importar se **recarga** su contexto. Nuevos `utils/conversationIO.ts` (`serializeConversation`/`parseConversation`/`conversationFilename`, puros) y `components/chat/ConversationIOButton.tsx`.

### Testing
- `conversationIO` (round-trip, revive `timestamp`, descarta `isLoading`, errores claros ante JSON inválido, nombre de fichero) y `ConversationIOButton`. Cliente: **476 tests**.

## [3.18.0] — 2026-06-27

### Added
- **Panel "📊 Salud del código" (#44, cierra Sprint 3)** — Nuevo botón que, dado un repo (`owner/repo` o solo el nombre), abre un **dashboard visual** con tres métricas: **distribución de lenguajes** (a partir del árbol completo del repo), **frecuencia de commits** por semana (últimas 12) y **deuda técnica** (recuento de `TODO`/`FIXME`/`HACK`/`XXX` y archivos con más marcadores). Gráficas con **Recharts**, cargadas en su **propio chunk** (import dinámico, como xlsx/pdfjs) para no engordar el bundle inicial; todo en cliente (Zero-Storage). Nuevos `utils/codeHealth.ts` (helpers puros), `github.ts` (`listCommitDates`), `runCodeHealth` y `components/dashboard/{CodeHealthModal,CodeHealthCharts}` + `CodeHealthButton`. El modal reutiliza el `useModalDialog` (a11y) de v3.17.0.

### Testing
- `codeHealth` (distribución de lenguajes, deuda técnica, commits por semana), `listCommitDates`, `runCodeHealth` (happy/error), `CodeHealthButton` y `CodeHealthModal` (resumen + a11y). Cliente: **462 tests**.

## [3.17.0] — 2026-06-27

### Added
- **Pantalla de error amable + diálogos más accesibles (#39, Sprint 3)** — (1) **Red de seguridad de UI:** si un componente falla durante el render, en vez de quedarse la pantalla en blanco la app muestra una pantalla de error clara ("Algo ha fallado") con un botón **🔄 Recargar**; tus datos no se envían a ningún sitio. Nuevo `components/ErrorBoundary.tsx` envolviendo toda la app. (2) **Accesibilidad de los modales** (confirmar acción, Documentar repo, Documentar y publicar): se cierran con **`Esc`**, **atrapan el foco** con `Tab`/`Shift+Tab` (no se escapa del diálogo), gestionan el **foco inicial** y lo **restauran** al cerrarse, y exponen `aria-labelledby` para lectores de pantalla. Nuevo hook compartido `hooks/useModalDialog.ts`.

### Testing
- `ErrorBoundary` (fallback ante hijo que lanza; render normal), `useModalDialog` (foco inicial, cierre con Esc, focus-trap con Tab/Shift+Tab). Cliente: **442 tests**.

## [3.16.0] — 2026-06-27

### Changed
- **Más robustez de red y de la acción propuesta (#40, cierra Sprint 2)** — (1) Las **llamadas a GitHub** (`ghFetch`) ahora **reintentan** automáticamente ante fallos puntuales de red o errores 5xx del servidor (con backoff corto); **nunca** reintentan errores 4xx (401/403/404/422) ni cancelaciones. (2) **Validación más estricta del JSON de acción** antes de *proponer→confirmar→ejecutar*: el método debe estar en una allowlist (`GET/POST/PUT/PATCH/DELETE`), el tipo en otra, y el endpoint —si viene— debe ser un **path relativo** (empieza por `/`, sin `://`) para que nunca apunte a un host externo; si no cumple, se trata como respuesta conversacional. El mecanismo de reintento se extrajo a `utils/retry.ts` (compartido por IA y GitHub).

### Testing
- `ghFetch` reintenta un 503 y no reintenta un 404; `parseGeminiAction` rechaza método/tipo fuera de la allowlist y endpoints absolutos o no relativos. Cliente: **436 tests**.

## [3.15.0] — 2026-06-27

### Changed
- **El asistente elige los archivos relevantes a tu pregunta (#49)** — Antes, al cargar un repo como contexto, solo "veía" los ~80 archivos de mayor prioridad y los `.md` de raíz (MEJORAS_FUTURAS, MANUAL_TECNICO, CHANGELOG…) se quedaban fuera, hasta el punto de **negar que un archivo existiera**. Ahora: (1) el modelo recibe el **árbol COMPLETO** de archivos del repo; (2) en cada pregunta se **seleccionan los archivos más relevantes** (ranking léxico BM25, en memoria — Zero-Storage) para enviar su contenido, así que preguntar por un archivo concreto lo trae al contexto; (3) sube la prioridad de los docs de raíz y el cap de contenido (80→120); (4) regla anti-alucinación: si un archivo está en la estructura pero sin contenido cargado, **no niega que exista**. Nuevo `utils/contextRanker.ts` (`rankFilesByQuery`); `fetchRepoTreeRecursive` expone `allPaths`; `RepoContext` guarda los archivos en memoria; `runSend` re-selecciona por turno.

### Testing
- `contextRanker` (boost por nombre de archivo, ranking por contenido, topN, query vacía), `buildRepoContextSummary` con árbol completo, `fetchRepoTreeRecursive` (`allPaths` + prioridad de docs), `chatPromptWithContext` (regla anti-negación), `runSend` (re-selección por pregunta). Cliente: **429 tests**.

## [3.14.0] — 2026-06-27

### Added
- **Changelog automático de un repositorio (#34)** — Nuevo botón **📋 Generar changelog**: indicas un repo (`owner/repo` o solo el nombre) y la app reúne los commits **desde el último release** (o los recientes si no hay ninguno), los **agrupa por tipo** (Novedades, Correcciones, Documentación, Mantenimiento…) de forma determinista por el prefijo del commit, y la **IA los redacta en lenguaje de usuario**. El resultado aparece como una burbuja de chat lista para copiar — ideal para preparar las notas de tu próxima publicación. Nuevos wrappers `getLatestReleaseTag`/`compareCommits`/`listRecentCommits` (github.ts), `changelogGenerator.ts` (`classifyCommits` + `generateChangelog`), `runGenerateChangelog` y `ChangelogButton`.

### Testing
- `classifyCommits` (agrupación por prefijo), `generateChangelog` (con/sin release, filtra merges, limpia fences), wrappers de commits/releases, `runGenerateChangelog` y `ChangelogButton`. Cliente: **419 tests**.

## [3.13.0] — 2026-06-27

### Added
- **Botón Detener — cancela la generación en curso (#40)** — Mientras la IA responde (sobre todo una opinión larga en streaming), el botón de enviar pasa a **⏹️ Detener**: al pulsarlo se **cancela la petición al instante** (vía `AbortController`), se conserva lo ya escrito con una nota *(detenido)* y puedes volver a escribir. Ahorra cuota y tiempo cuando la respuesta no es la que buscabas. Se propaga un `AbortSignal` por `callAI` → transportes → `fetch`; `withTransientRetry` nunca reintenta una cancelación; `runSend` distingue la cancelación de un error real (no muestra burbuja roja).

### Testing
- `isAbortError`, `callAI` reenvía el `signal` y no reintenta un `AbortError`; `runSend` muestra "detenido" (conservando el parcial) y no abre el modal; `ChatInput` alterna Enviar/Detener. Cliente: **401 tests**.

## [3.12.0] — 2026-06-27

### Added
- **Recuerda el proveedor y el modelo al recargar (#40)** — Tras un F5 ya no hay que volver a elegir proveedor (Gemini/Groq/OpenRouter) ni modelo: la app los **pre-selecciona** automáticamente. Solo hay que **volver a pegar la API key** (que sigue sin guardarse en ningún sitio). Se persiste **únicamente** `{ provider, model }` —datos no secretos— en `sessionStorage`; la clave **NUNCA** se almacena, así que el modelo **Zero-Storage se mantiene intacto**. Nuevo `utils/providerPrefs.ts` (save/load/clear); cableado en `AIProviderContext` (guarda al conectar, borra al desconectar) y `AIProviderPanel` (pre-selecciona al cargar).

### Testing
- `providerPrefs` (roundtrip, proveedor inválido, JSON corrupto, no guarda la key), `AIProviderContext` (conectar persiste / desconectar borra; la key nunca se guarda) y `AIProviderPanel` (arranca en el proveedor recordado). Cliente: **392 tests**.

## [3.11.2] — 2026-06-27

### Changed
- **System prompts en archivos externos (#23)** — Los prompts del modo acción y del modo chat se
  movieron de literales dentro de `services/gemini.ts` a archivos `client/src/prompts/*.md`,
  cargados como texto crudo (`import … from '…?raw'` de Vite). Adelgaza el módulo más grande, hace
  los prompts mucho más fáciles de leer/editar y **sienta la base para i18n** (#24). Sin cambio de
  comportamiento (contenido idéntico). Los prompts con interpolación dentro de funciones
  (`generateRepoDocs`/`generateFileDoc`) quedan inline por ahora (posible continuación).

## [3.11.1] — 2026-06-27

### Changed
- **Documentación de repos más coherente (#20)** — Al generar la documentación de un repositorio, el contenido de cada archivo se recorta ahora por **líneas completas** (las primeras ~80, preservando imports y firmas de funciones) en vez de cortar a 2000 **caracteres**, que partía funciones a la mitad y dejaba código sin sentido para el modelo. Nuevo helper puro `truncateByLines` reutilizado también por el contexto de chat (`buildRepoContextSummary`).

### Testing
- `truncateByLines` (intacto si cabe; trunca por líneas + nota de omitidas) y `generateRepoDocs` (trunca por líneas, no por caracteres). Cliente: **383 tests**.

## [3.11.0] — 2026-06-27

### Added
- **Adjuntar documentos Word (`.docx`)** — Ahora puedes subir un documento de Word y trabajar con él en lenguaje natural (preguntar, opinar, resumir, documentar), igual que con PDF/Excel/Power BI. Un `.docx` es un ZIP OOXML: se extrae el **texto** de `word/document.xml` (párrafos, listas y el contenido de las tablas) **solo en tu navegador** (Zero-Storage), reutilizando `fflate` (sin nuevas dependencias). Documentos muy largos se analizan por una **parte acotada** con aviso. El `.doc` binario antiguo no está soportado (exporta a `.docx`). Nuevo `utils/docxReader.ts` (`readDocx` + helper puro `docxXmlToText`); `runAttachFile` enruta `.docx`.

### Testing
- `docxReader` (extracción de párrafos/tablas, entidades XML, truncado, errores) + `runAttachFile` con `.docx` + `assertSupportedFile` acepta `.docx`. Cliente: **380 tests**.

## [3.10.0] — 2026-06-26

### Changed
- **Flujos de documentación unificados** — Los dos modales de documentación —*"🤖 Documentar repo"* (`DocModal`) y *"📤 Documentar y publicar archivo"* (`FilePublishModal`)— compartían los mismos botones de publicación (commit / Draft PR / Release + versión) pero con código duplicado que había ido divergiendo. Ahora ambos usan un **componente compartido `PublishActions`**, garantizando **las mismas capacidades, etiquetas y estados** en los dos sitios (commit directo, Draft PR, Crear Release con versión sugerida, y la oferta de crear un repo inexistente). Cada modal mantiene su cuerpo propio (pestañas README/MANUAL vs. preview + repo + fuente/extras), porque las entradas son distintas (un repo entero vs. un archivo adjunto).
- **Subtítulos que aclaran qué flujo usar** — Cada modal recuerda dónde está el otro flujo (en *"Documentar repo"*: para un archivo suelto usa 📤; en *"Documentar y publicar"*: para un repo entero usa 🤖), para evitar confusiones.

### Testing
- Nuevo `PublishActions.test.tsx` (acciones, versión, `busy`, `publishDisabled`, spinners, oferta de crear repo) y ajuste de los tests de `DocModal`/`FilePublishModal` a las etiquetas unificadas. Cliente: **369 tests**.

## [3.9.0] — 2026-06-26

### Added
- **Subir imágenes y datos extra al publicar (#28 Fase 4b)** — En *"📤 Documentar y publicar"*, además del archivo original, ahora puedes **añadir archivos extra** (capturas, dataset…) que se publican junto a la documentación. Se colocan **por tipo**: imágenes (`png/jpg/gif/webp/svg…`) → `screenshots/`, datos (`xlsx/xls/csv/json…`) → `data/`, el resto → raíz. En **commit/Draft PR** se commitean (binario); en **Release** se adjuntan como **assets**. El modal muestra cada extra con su destino. Así se publica el **proyecto completo** (doc + fuente + capturas + dataset). Nuevo `uploadPathFor` (ruta por tipo); `publishFileDoc`/`runPublishFileDoc`/`runCreateFileRelease` aceptan `extraFiles`.

### Testing
- `uploadPathFor`, `publishFileDoc` con extras (cada uno a su ruta), release subiendo extras como assets, y el modal mostrando/!pasando los extras. Cliente: **361 tests**.

## [3.8.0] — 2026-06-26

### Added
- **Crear Release al documentar un repositorio** — El flujo de *"Documentar repo"* (que genera README + MANUAL_TECNICO) ahora ofrece también **🏷️ Crear Release**, además de commit directo y Draft PR. Se crea un GitHub Release con la documentación generada como notas (versión indicada o **sugerida** automáticamente). Así el flujo de repo iguala al del archivo adjunto. Nueva `runCreateRepoRelease` (reutiliza `createGitHubRelease`/`suggestNextVersion`); `DocModal` con botón de Release + campo de versión.

### Testing
- `runCreateRepoRelease` (versión sugerida/indicada, error) + `DocModal` (botón Release). Cliente: **357 tests**.

## [3.7.1] — 2026-06-26

### Security
- **`state` de OAuth con generador criptográficamente seguro** — El parámetro `state` anti-CSRF del flujo de login (`server/index.js`) se generaba con `Math.random()` (no criptográfico, predecible). Ahora se usa `crypto.randomUUID()` (CSPRNG, 122 bits). El mecanismo ya era correcto (state en sesión, validado *single-use* en el callback); solo se endurece la fuente de aleatoriedad. **Requiere redeploy del servidor.**

## [3.7.0] — 2026-06-25

### Changed
- **Documentar/publicar es ahora EXPLÍCITO, no se adivina (refactor)** — Se elimina la detección de intención por palabras clave (`utils/intentDetection.ts`), que era frágil y causaba bugs recurrentes (el chat saltaba a "acción"/modal sin querer). Ahora, con un archivo adjunto, **el chat siempre conversa/analiza**; para documentar y publicar se usa el botón **📤 Documentar y publicar** (commit, Draft PR o Release, e incluso subir el archivo original), que ya **incorpora la conversación** mantenida como contexto del documento.
- **La UI explica el flujo** — Al adjuntar un archivo, el mensaje de confirmación deja claro el camino: *conversar/analizar primero → pulsar 📤 para documentar y publicar*. El `CHAT_PROMPT`, si le pides documentar por texto, te dirige al botón en lugar de adivinar.

### Notes
- *Si "documentar" no te ofrecía Release ni subía el `.pbit`:* era porque se usaba **"Documentar repo"** (genera README + MANUAL_TECNICO) en vez de **"📤 Documentar y publicar"** del archivo adjunto, que sí tiene Release y subida del archivo. La guía de la UI ahora lo deja claro.

### Testing / CI
- Eliminado `intentDetection.test.ts`; `CHAT_PROMPT`, el mensaje guía de `runAttachFile` y `formatConversation` cubiertos. Cliente: **354 tests**.
- **`codecov.yml`**: se excluyen de cobertura `App.tsx` y `main.tsx` (glue/entry sin lógica; la lógica vive en módulos testeados). Evita que PRs de solo-cableado fallen el `patch` por líneas de App intrínsecamente a 0% — venía repitiéndose.

## [3.6.1] — 2026-06-25

### Fixed
- **El chat ya no salta a "documentar" cuando pides análisis o preguntas** — Frases como *"ayúdame a documentar **analizando** el informe"* o preguntas (*"¿lo puedes documentar?"*) abrían directamente el modal de Documentar/Publicar, saltándose la conversación. Ahora `detectDocPublishIntent` ignora las peticiones **exploratorias** (preguntas `¿…?` o con tono de análisis/ayuda: *analiza, opinión, ayúdame, revisa…*) y solo abre el modal ante **órdenes claras** (*"documéntalo"*, *"publícalo en X"*). Nuevo helper `isExploratory` en `utils/intentDetection.ts`.
- **El chat responde con honestidad cuando pides algo no soportado** — Al preguntar por subir **varios archivos** o **imágenes** (aún no disponible), la app pasaba a acción e ignoraba la pregunta. Ahora el `CHAT_PROMPT` conoce sus **límites** (un archivo a la vez; sin imágenes/multiarchivo todavía) y lo **dice con claridad**, proponiendo la alternativa, en vez de ignorarlo.

## [3.6.0] — 2026-06-25

### Added
- **Subir el archivo fuente al publicar (#28 Fase 4a)** — Al documentar y publicar un archivo adjunto, ahora puedes **subir también el archivo original** (`.pbit`/`.pbix`/`.xlsx`/…) al repositorio, no solo el Markdown. Checkbox en el modal (*"📎 Subir también el archivo original"*, activado por defecto). En **commit/Draft PR** el binario se commitea en la raíz (junto a la doc); en **Release** se adjunta como **asset** descargable. Así el README deja de referenciar un `.pbit` que no existía. Nuevos `encodeBase64Bytes` + `createOrUpdateBinaryFile` (`services/github.ts`) y reutilización de `utils/releaseAssets.ts`.

### Fixed
- **La documentación ya no inventa autor/año** — El prompt de `generateRepoDocs` forzaba un footer `Desarrollado por @[autor] · [año]` que el modelo rellenaba inventando (p. ej. *"· 2024"*). Ahora se **inyectan el `owner` real y el año actual**, así que el footer es correcto.

### Notes
- **Reescribir/actualizar documentación existente ya funcionaba**: al re-documentar y publicar sobre un repo, los ficheros se **actualizan por SHA** (`getExistingSha` + `createOrUpdateFile`), no hace falta editar a mano.

### Testing
- `encodeBase64Bytes`/`createOrUpdateBinaryFile`, `publishFileDoc` con `sourceFile` (doc + binario), `runCreateFileRelease` subiendo el asset, `generateRepoDocs` con autor/año reales, y el checkbox del modal. Cliente: **360 tests**.

## [3.5.0] — 2026-06-25

### Added
- **Documentar y publicar desde lenguaje natural** — Ahora, con un archivo o repo en contexto, pedir en el chat *"documéntalo"* o *"publícalo en el repo X"* **dispara el flujo real** (generar la documentación y abrir el modal de publicar), en vez de quedarse en una respuesta de chat. *"Publícalo en X"* abre el modal con el **repo precargado** (eliges Commit / Draft PR / Release; si el repo no existe, se ofrece crearlo). Nuevo `utils/intentDetection.ts` (`detectDocPublishIntent` + `routeUserMessage`), enrutado fino en `handleSend`.
- **El documento incorpora la conversación** — `generateFileDoc` admite la conversación previa para que la documentación refleje lo charlado (opinión, matices), sin contradecir el contenido del archivo.

### Changed
- **Tono del chat más natural y accesible (principio rector)** — El asistente deja de dirigirse al usuario como *"desarrollador senior/arquitecto"*: ahora habla en **lenguaje claro y cercano**, adaptado al nivel del usuario (si dice que es estudiante/principiante, explica con sencillez). El registro **profesional/senior se reserva para el documento generado**, no para el chat. Además, el `CHAT_PROMPT` ya sabe que la app puede documentar y publicar con confirmación, así que **no vuelve a decir "no tengo acceso de escritura"** ni a dar comandos `git` manuales.

### Testing
- `intentDetection` (document/publish/null + extracción de repo + `routeUserMessage`), `generateFileDoc` con conversación, `runGenerateFileDoc` reenviando la conversación, `FilePublishModal` con `initialRepo`. Cliente: **351 tests**.

## [3.4.2] — 2026-06-25

### Fixed / Improved
- **Power Query (M) robusto en Power BI — completa #28 Fase 3b-bis** — La extracción de consultas solo funcionaba con el `DataMashup` binario, así que en los `.pbix` **modernos** (formato *enhanced metadata*, donde el M va dentro del modelo binario) no aparecía nada y la IA decía no tener visibilidad del Power Query. Ahora se extrae el M de dos fuentes:
  - **`.pbit` → `DataModelSchema`** (particiones `source.type:'m'`): el `.pbit` que ya hay que exportar para el DAX trae el Power Query en JSON legible. Vía fiable y completa.
  - **`DataMashup` XML/base64 antiguo** (además del binario [MS-QDEFF]): cubre los `.pbix` viejos.
  - **Aviso honesto en `.pbix` moderno**: cuando el modelo va en binario y no se pudo leer el M, el mensaje indica que **DAX y consultas** están en el modelo binario → exporta `.pbit` para ambos (antes solo mencionaba el DAX).
  - `powerbiReader.ts`: `extractModelMashup` (particiones), `parseMashupBinary`/`tryXmlMashup` (refactor + variante XML); precedencia DataMashup → particiones del schema.

### Testing
- Tests de Power Query desde particiones de `.pbit`, `DataMashup` XML/base64, aviso honesto en `.pbix` moderno y precedencia. Cliente: **338 tests**.

## [3.4.1] — 2026-06-25

### Fixed
- **Archivo adjunto + lenguaje natural ya responde en chat** — Con un archivo adjunto (PDF, Excel/CSV, Power BI, texto/código…), pedir *"háblame del informe/modelo/consultas…"* caía a **modo acción** y proponía un `GET /repos/OWNER/REPO/…` con placeholders inútil (porque la frase contenía verbos incidentales como "subir"). Ahora, con un archivo adjunto el modo automático **siempre responde en chat** usando el contexto del archivo; las acciones de GitHub siguen disponibles con el toggle manual de Acción. El arreglo es **transversal a todos los formatos** (depende de que haya archivo, no del tipo).
- **Publicar/crear release en un repo inexistente ya no muestra "Not Found"** — Al documentar y publicar, si el repositorio destino no existe en tu cuenta, en vez del crudo *"Not Found"* se **ofrece crearlo y publicar** (confirmación en el modal; usa `auto_init` para que quede listo). Si el destino es de otra cuenta/organización, se explica en lenguaje claro que solo se pueden crear repos en tu cuenta. Mensajes de error 404 traducidos a lenguaje llano (principio rector).

### Testing
- `resolveMode` con archivo adjunto → chat (incl. caso "subir"); `runSend` pasa `hasFileContext`; `runCreateRepo`, `runStartPublish` y `runPublishFileDocByKind` (lógica de publicación extraída de App.tsx, patrón #42); `repoExists`; oferta de crear repo en `FilePublishModal`. Cliente: **334 tests**.

## [3.4.0] — 2026-06-25

### Added
- **Power Query (M) de archivos Power BI — #28 Fase 3b-bis** — Al adjuntar un `.pbix`/`.pbit` ahora también se extraen las **consultas de Power Query** (orígenes y transformaciones): nombres de consulta + código **M**. Esto **rescata el `.pbix`**: aunque su modelo siga en binario VertiPaq (no legible), ya se puede explicar **de dónde salen los datos y cómo se transforman**, en lenguaje natural.
  - El **M** vive en el blob binario `DataMashup` (cabecera de longitud + un **ZIP anidado** cuyo `Formulas/Section1.m` contiene las consultas). Se lee en el navegador con `fflate` (Zero-Storage), reutilizando el mismo chunk lazy de la Fase 3b.
  - **Control de tokens:** se listan hasta `MAX_QUERIES` nombres y el código M se acota a un presupuesto propio (`MAX_M_CHARS`) para que no desplace al informe/modelo; se marca `truncated` cuando se recorta.
  - **Limitación honesta (principio rector):** la variante **XML/base64 antigua** del `DataMashup` no se parsea (se ignora sin romper el resto de la extracción).
  - `powerbiReader.ts` gana `extractMashup`; `runAttachFile` invita a preguntar también por los orígenes/consultas.

### Testing
- Tests de `extractMashup` vía `readPowerBI` (extracción de nombres + M, normalización de nombres `#"…"`, caps `MAX_M_CHARS`/`MAX_QUERIES` con truncado, `DataMashup` corrupto ignorado sin romper el informe, archivo solo con consultas). Cliente: **314 tests**.

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
