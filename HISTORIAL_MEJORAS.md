# 📜 Historial de Mejoras Implementadas

Registro histórico de todas las características, optimizaciones y correcciones resueltas en el proyecto **Asistente de IA de GitHub**, ordenadas cronológicamente desde la versión v1.0.0 hasta la v4.0.9.

> ℹ️ Para consultar las tareas y mejoras pendientes activas, consulta el [Roadmap de Mejoras Pendientes (`MEJORAS_FUTURAS.md`)](file:///d:/ZCodeProject/github-ai-assistant/MEJORAS_FUTURAS.md).

---

## 📖 Convenciones del documento

- Los IDs (`#1`–`#58`) corresponden a **issues reales del repositorio GitHub** y se conservan para trazabilidad.
- Los ítems que no tuvieron issue propio se numeran desde **`#59`** en adelante.
- Cada ítem detalla la versión en la que fue resuelto, los archivos modificados y una descripción técnica del cambio.

---

## ✅ Resumen de Mejoras Resueltas (v1.0.0 – v4.0.0)

| # | Punto | Archivo(s) | Versión |
|---|-------|------------|---------|
| 1 | Verificación OAuth state (CSRF) | server/index.js | v2.0.1 |
| 2 | SESSION_SECRET obligatorio en producción | server/index.js | v2.0.1 |
| 12 | Nombre del proveedor IA dinámico en mensajes | App.tsx | v2.1.0 |
| 13 | Zero-Storage real para claves de IA | AIProviderContext.tsx, App.tsx, gemini.ts | v2.2.0 |
| 14 | Rate limiting en proxy Gemini | server/index.js | v2.3.0 |
| 17 | Extraer formatResultData a utilidad pura | client/src/utils/formatResult.ts | v2.3.0 |
| 18 | crypto.randomUUID() en lugar de Math.random() | client/src/App.tsx | v2.3.0 |
| 19 | Soporte método HTTP PATCH en executeAction() | client/src/services/actionExecutor.ts | v2.1.0 |
| 21 | Unificar cliente fetch — ghFetch() en actionExecutor.ts | client/src/services/actionExecutor.ts | v2.1.0 |
| 27 | Calidad de respuestas Groq (temperatura por modo) | client/src/services/gemini.ts | v2.4.0 |
| 37 | CI ejecuta también los tests del servidor | .github/workflows/ci.yml, package.json | v2.4.0 |
| 41 | Opiniones de chat fundamentadas en el contexto del repo | gemini.ts, App.tsx, RepoContextButton.tsx | v2.5.0 |
| 45 | Generación de documentación vía Draft PR | App.tsx, github.ts | v2.6.0 |
| 15 | Multi-proveedor (OpenRouter) vía registro de proveedores | services/providers.ts, gemini.ts, AIProviderPanel.tsx | v2.7.0 |
| 32 | Resumir hilos de comentarios de issues/PRs | github.ts, services/threadSummary.ts, ThreadSummaryButton.tsx | v2.8.0 |
| 42 | Refactor de App.tsx (DocModal + lógica del chat a módulos testeables) | services/assistantActions.ts, components/confirm/DocModal.tsx, utils/repoRef.ts | v2.8.2 |
| 38 | Streaming de respuestas (SSE) token a token en modo chat | server/index.js, services/gemini.ts, services/assistantActions.ts, ChatMessage.tsx | v2.9.0 |
| 28 | **Fase 1** Subida de archivos locales: adjuntar PDF/texto/código como contexto del chat | utils/pdfReader.ts, utils/pdfAdvanced.ts (pdfjs-dist), services/assistantActions.ts (runAttachFile), FileAttachButton.tsx | v3.0.0 |
| 28 | **Fase 2** Archivos locales: documentar el archivo y publicarlo (commit / Draft PR / GitHub Release) | services/gemini.ts (generateFileDoc), services/docPublisher.ts (publishFileDoc), services/assistantActions.ts, components/confirm/FilePublishModal.tsx | v3.1.0 |
| 28 | **Fase 3a** Archivos locales: hojas de cálculo Excel/CSV (muestra de filas + aviso de tokens) | utils/spreadsheetReader.ts (SheetJS/xlsx), utils/pdfReader.ts, services/assistantActions.ts (runAttachFile) | v3.2.0 |
| 28 | **Fase 3b (MVP)** Power BI .pbix/.pbit (informe = páginas/visuales; modelo/DAX de .pbit) | utils/powerbiReader.ts (fflate), utils/pdfReader.ts, services/assistantActions.ts (runAttachFile) | v3.3.0 |
| 28 | **Fase 3b-bis** Power Query (M) del `DataMashup` (nombres de consulta + código M; orígenes/transformaciones, rescata el .pbix) | utils/powerbiReader.ts (extractMashup, fflate) | v3.4.0 |
| 28 | **Fase 4a** Al publicar se sube también el archivo fuente (binario en commit/Draft PR o asset de Release) + doc sin inventar autor/año | services/github.ts (createOrUpdateBinaryFile), docPublisher.ts, releaseAssets.ts, gemini.ts | v3.6.0 |
| 28 | **Fase 4b** Al publicar se pueden añadir archivos extra (imágenes→screenshots/, datos→data/, resto→raíz; commit/Draft PR o assets de Release) | docPublisher.ts (uploadPathFor), assistantActions.ts, FilePublishModal.tsx | v3.9.0 |
| 28 | **Fase 4c** Documentos Word (.docx): ZIP OOXML; se extrae el texto de `word/document.xml` (párrafos, listas y tablas) vía fflate, con muestra acotada | utils/docxReader.ts (readDocx, docxXmlToText), utils/pdfReader.ts, services/assistantActions.ts (runAttachFile) | v3.11.0 |
| 20 | Documentación de repos truncada por líneas (no por caracteres) | services/gemini.ts (truncateByLines) | v3.11.1 |
| 23 | System prompts en archivos `.md` externos (?raw) | services/gemini.ts, prompts/*.md | v3.11.2 |
| 34 | Changelog automático de un repo (agrupar por prefijo + pulir con IA; burbuja de chat) | services/changelogGenerator.ts, github.ts (compareCommits/getLatestReleaseTag), ChangelogButton.tsx | v3.14.0 |
| 49 | Selección de archivos relevantes a la pregunta (ranking léxico BM25 + árbol completo; deja de "no ver" archivos) | utils/contextRanker.ts, github.ts (allPaths), gemini.ts (buildRepoContextSummary), assistantActions.ts (runSend) | v3.15.0 |
| 40 | Robustez de red e IA/UX: reintentos transitorios (IA + GitHub), botón Detener, recordar proveedor/modelo, validación estricta del JSON de acción | utils/retry.ts, gemini.ts, github.ts (ghFetch), AIProviderContext.tsx, providerPrefs.ts, App.tsx, ChatInput.tsx | v2.7.3–v3.16.0 |
| 39 | ErrorBoundary (red de seguridad de UI ante errores de render) + accesibilidad de los modales (Esc, focus-trap, foco restaurado, aria-labelledby) | components/ErrorBoundary.tsx, hooks/useModalDialog.ts, main.tsx, components/confirm/{ConfirmModal,DocModal,FilePublishModal}.tsx | v3.17.0 |
| 44 | Dashboard "Salud del Código" (distribución de lenguajes, commits/semana, deuda técnica TODO/FIXME) con gráficas Recharts (chunk propio, lazy) | utils/codeHealth.ts, github.ts (listCommitDates), assistantActions.ts (runCodeHealth), components/dashboard/{CodeHealthModal,CodeHealthCharts}.tsx, CodeHealthButton.tsx | v3.18.0 |
| 46 | Exportar/importar la conversación a JSON (recuperar contexto entre sesiones sin romper Zero-Storage; recarga el repo de contexto al importar) | utils/conversationIO.ts, components/chat/ConversationIOButton.tsx, App.tsx, ChatInput.tsx | v3.19.0 |
| — | Crear Release desde "Documentar repo" (además de commit/Draft PR) | assistantActions.ts (runCreateRepoRelease), DocModal.tsx | v3.8.0 |
| — | Unificar los controles de los dos flujos de documentación (barra compartida commit/Draft PR/Release) | components/confirm/PublishActions.tsx, DocModal.tsx, FilePublishModal.tsx | v3.10.0 |
| — | Seguridad: `state` de OAuth con CSPRNG (crypto.randomUUID) | server/index.js | v3.7.1 |
| 24 | **i18n Fase 1** Internacionalización ligera sin dependencias — `LanguageContext` + `t()` + ES/EN; selector 🌐; login, cabecera, `AIProviderPanel`, `ChatInput`, botones y paneles laterales | context/LanguageContext.tsx, i18n/{es,en}.ts, components/layout/LanguageSelector.tsx, Header.tsx, AIProviderPanel.tsx, ChatInput.tsx | v3.20.0 |
| 24 | **i18n Fase 2** Modales + `DiffViewer` + mensajes visibles del chat (`t()` inyectada en `ChatDeps`); refactor del `labelMap` por `labelKey`; fix de clave inexistente y 3 tests rotos | components/confirm/{ConfirmModal,DocModal,FilePublishModal,PublishActions,DiffViewer}.tsx, services/assistantActions.ts (ChatDeps.t), App.tsx, i18n/{es,en}.ts | v3.21.0 |
| 24 | **i18n Fase 3** Chat central + historial + plantillas de autocompletado + **respuestas de la IA en el idioma activo** vía `lang` cableado a los system prompts | components/chat/{ChatArea,ChatMessage} + locale del timestamp, historial (~32 claves), 17 plantillas reestructuradas como factoría `buildTemplates(t)` | v3.22.0 |
| 55 | Plantillas del panel lateral hardcodeadas en español — i18n con `buildTemplateCategories(t)` + ~36 claves `tmpl_panel.*` | components/templates/templateData.ts (factoría), i18n/{es,en}.ts, components/templates/TemplatePanel.tsx | v3.25.0 |
| 56 | Descripciones del historial de acciones de solo lectura emitidas en español — i18n con `history.exec.*` + `t` opcional en el executor | client/src/services/actionExecutor.ts, client/src/services/assistantActions.ts, i18n/{es,en}.ts | v3.26.0 |
| 50 | Presupuesto de contexto adaptativo (TPM bajo) + reintento con menos contexto + fix del mensaje duplicado | services/providers.ts (contextBudget), services/assistantActions.ts (getActiveContextBudget, reintento TPM), services/gemini.ts (error diferenciado), utils/retry.ts (isContextTooLargeError) | v3.28.0 |
| 51 | "Archivos consultados para esta respuesta" (transparencia del contextRanker) | types/index.ts (consultedFiles), services/assistantActions.ts (propagación), components/chat/ChatMessage.tsx (bloque plegable), i18n/{es,en}.ts | v3.28.0 |
| 22 | SessionWarningBanner — banner amber si las credenciales (GitHub/IA) llevan >8h activas, revisión cada 60s. Depende de Zero-Storage (#13, ✅) | components/SessionWarningBanner.tsx, App.tsx, i18n/{es,en}.ts | v3.37.0 |
| 57 fix | Crash al documentar con multi-archivo: DocumentFlowModal recibía solo fileContext[0] y perdía el resto, causando pantalla de ErrorBoundary. Ahora recibe allAttachedFiles, muestra primary/extras en Paso 2, auto-puebla extras en Paso 4 y fusiona no-principales en crear+documentar | components/confirm/DocumentFlowModal.tsx, App.tsx, ChatInput.tsx (lint), tests | v3.30.0 |
| 57 fix bis | Crash `TypeError: S.trim is not a function` al pulsar "Documentar": DocumentRepoButton pasaba el MouseEvent como `initialRepo` (regresión de la Tanda B). Fix: wrapper `onClick={() => onOpen()}` + saneado `initialRepo` a string en DocumentFlowModal | components/chat/DocumentRepoButton.tsx, components/confirm/DocumentFlowModal.tsx, tests | v3.30.2 |
| 57 fix tris | Error "La IA no devolvió JSON válido" al documentar (repos creados vacíos): el límite de salida de 4096 tokens truncaba el README+MANUAL a medias. Fix: `maxTokens` param en `callAI` + `generateRepoDocs(8192)` + proxy lee `maxOutputTokens`. Además: firma de documentación con IA real (about del repo + commit messages + PR bodies + footer del README), about automático vía `updateRepo` (PATCH `/repos/`), botón "Actualizar documentación" siempre visible, banner verde afirmativo para repos ya documentados | services/gemini.ts, server/index.js, services/assistantActions.ts, services/docPublisher.ts, services/github.ts, services/providers.ts, components/chat/ChatInput.tsx, components/confirm/DocumentFlowModal.tsx, i18n/{es,en}.ts | v3.31.0 |
| 48 | Sync Repo Status — revisión bajo demanda de cambios recientes. Botón 🔄 en la UI (modelo pull, no webhooks). `listRecentCommits`/`getCommit` en github.ts, `runSyncRepoStatus` en assistantActions.ts, `SyncRepoStatusButton`. 4 tests | services/assistantActions.ts (runSyncRepoStatus), services/github.ts (listRecentCommits, getCommit), components/chat/SyncRepoStatusButton.tsx, ChatInput.tsx, i18n/{es,en}.ts | v3.37.0 |
| 59 | OpenCode Zen y Cloudflare Workers AI: fix CORS + catálogo estático (proxies `/api/openzen` y `/api/cloudflare`) | providers.ts, server/index.js (proxies + rate limiters), gemini.ts (accountId header), i18n, providers.test.ts | v3.33.2–v3.33.7 |
| 59 | Cloudflare 400 fix: proxy lee `X-Account-Id` del header (no del body); Cloud Run startup fix (type assertion TS); saneo de headers + modelos ampliados | server/index.js, providers.ts (CLOUDFLARE_FALLBACK 8 modelos) | v3.33.3–v3.33.7 |
| 60 | Ollama Cloud (nuevo proveedor) + 11 modelos free verificados + retry 429 + Cloudflare fix headers + error accionable 403/429 | providers.ts (OLLAMA_FALLBACK 11 modelos), retry.ts (429 + pattern), server/index.js (strip content-encoding), gemini.ts (error Cloudflare), i18n ES/EN | v3.34.0 |
| 58 | **Fase 1-3: Publicación flexible de documentación (sin paths hardcodeados)** — Selector de tipo de documentación en `DocumentFlowModal`: Repo completo / Archivo único / Documento específico del repo. `docPublisher.ts` generalizado a array de targets. | components/confirm/DocumentFlowModal.tsx, services/docPublisher.ts, services/assistantActions.ts, services/github.ts | v3.35.0 |
| 58 | **Fase 4: Instrucciones adicionales (selectividad)** — Campo opcional "Instrucciones adicionales" en el flujo de documento específico. `generateSpecificDoc` lo incluye como `userInstructionDirective` ("PREVALECE"). | components/confirm/DocumentFlowModal.tsx, App.tsx, services/gemini.ts, services/assistantActions.ts | v3.35.0 |
| 58 | **Fase 5: Crear repo + documentar archivo específico** — Flujo unificado para crear un repo inexistente y documentar un archivo específico del repo en un solo paso. | components/confirm/DocumentFlowModal.tsx, services/assistantActions.ts | v3.35.0 |
| 58 | **Fase 6: Persistencia avanzada** — Hook `useDocTargetSelector.ts` que persiste en `localStorage` la configuración del selector. | client/src/hooks/useDocTargetSelector.ts, components/confirm/DocumentFlowModal.tsx | v3.36.0 |
| 62 | Mitigación vulnerabilidades `xlsx` (SheetJS) — Límite 10 MB en `spreadsheetReader.ts` antes de parsear + validación básica cabecera post-parseo. Aviso UI en FileAttachButton/DocumentFlowModal. | client/src/utils/spreadsheetReader.ts, client/src/components/chat/FileAttachButton.tsx, server/index.js, .github/workflows/ci.yml | v3.36.1 |
| 63 | CI workflow `permissions: contents: read` (token con scope workflow). | .github/workflows/ci.yml | v3.36.1 |
| 59 | Nuevo proveedor Ai& (`api.aiand.com`) — OpenAI-compatible con proxy backend. | client/src/services/providers.ts, server/index.js, client/src/i18n/{es,en}.ts | v3.38.0 |
| 60 | `effectiveMaxTokens` por proveedor — campo `maxOutputTokens` en `ProviderDef`. | client/src/services/{providers,gemini}.ts | v3.38.0 |
| 61 | Renombrado del nombre visible — "Asistente de IA de GitHub" / "GitHub AI Assistant". | client/src/i18n/{es,en}.ts, client/index.html, package.json, server/index.js | v3.38.0 |
| 64 | Fix Ai& (CORS en prod + catálogo free-only `qwen/qwen3.6-27b`). | server/index.js, client/src/services/providers.ts | v3.38.1 |
| 65 | Deuda de lint de v3.50.1 resuelta (15 warnings → 0 warnings). | App.tsx, components/*, hooks/*, context/* | v3.50.2 |
| 26 | Cobertura de componentes `HistoryContext`, `RepoSelector`, `InstructionSuggestions`. | client/src/context/__tests__/HistoryContext.test.tsx, client/src/components/multi-repo/__tests__/RepoSelector.test.tsx | v3.50.3 |
| 53 | Sugerir mensaje de commit semántico con `commitSuggester.ts`. | client/src/services/commitSuggester.ts, client/src/prompts/commit-message.md | v3.50.0 |
| 26 | Cobertura de `DiffViewer` (18 tests nuevos). | client/src/components/confirm/__tests__/DiffViewer.test.tsx | v3.50.4 |
| 75 | Tests E2E con Playwright (3 specs iniciales en CI). | e2e/{chat.spec.ts,fixtures.ts}, playwright.config.ts, .github/workflows/ci.yml | v3.61.0 |
| 77 | Nuevo proveedor BazaarLink (`bazaarlink.ai/api/v1`) vía proxy backend. | client/src/services/providers.ts, server/index.js | v3.68.0 |
| 76 | Fix bug "Documentar → Documento específico" prevaleciendo la instrucción sobre el contenido previa. | client/src/services/gemini.ts, client/src/App.tsx | v3.67.0 |
| 24 | **i18n v4.0.0** Internacionalización a 13 idiomas globales (ES, EN, ZH, HI, FR, AR, BN, PT, ID, UR, RU, DE, JA) con banderas vectoriales SVG y soporte RTL. Solución del bug de renderizado de banderas en Chrome/Windows. | context/LanguageContext.tsx, components/layout/{LanguageSelector.tsx,FlagIcon.tsx}, i18n/*.ts, tests | v4.0.0 |
| 78 | Menú progresivo de herramientas avanzadas del chat (`ChatToolsMenu`) para reducir carga visual (UI Refactor). | client/src/components/chat/{ChatToolsMenu.tsx, ChatInput.tsx} | v4.0.5 |
| 91 | Fix QwenCloud / OpenCode Zen (400 Bad Request Payload Too Large): Filtrar data URIs de base64 de imágenes adjuntas en `truncateByLines` y `generateFileDoc` para evitar que revienten el prompt al pedir documentar archivos o repositorios. | client/src/services/gemini.ts | v4.0.5 |
| 92 | Cobertura de Codecov patch 100% + unit tests para la sanitización de base64/data URIs en `gemini.ts`. | client/src/services/__tests__/gemini.test.ts | v4.0.5 |
| 81 | Tests unitarios y cobertura 100% en `rateLimitHandler.ts` (#26). | client/src/utils/__tests__/rateLimitHandler.test.ts | v4.0.6 |
| 82 | Fix duplicación de footers (`cleanDocFooter`) al documentar e inyección explícita de directiva de fecha/año actual (2026) para evitar alucinaciones con 2025. | client/src/services/gemini.ts, client/src/services/__tests__/gemini.test.ts | v4.0.7 |
| 83 | Vista previa visual automática en `README.md` (`injectImagePreviewBlock`) para capturas adjuntas subidas a `screenshots/` y verificación de publicación vía chat. | client/src/services/gemini.ts, client/src/services/assistantActions.ts, client/src/App.tsx | v4.0.8 |
| 96 | Cobertura de Codecov patch 100% para las funciones de vista previa de imagen `injectImagePreviewBlock` y flujos de documentación con capturas en `gemini.test.ts` y `assistantActions.test.ts`. | client/src/services/__tests__/gemini.test.ts, client/src/services/__tests__/assistantActions.test.ts | v4.0.9 |
| 95 | Fix resolución de capturas (`./screenshots/`), sanitización de diacríticos (`normalize('NFD')` en `sanitizeRepoPath`), posicionamiento sin desbordamiento de `ChatToolsMenu`, mejora del área de clic de `✕` en chips de contexto y habilitación del verbo "mejora" en modo Acción. | client/src/services/{gemini.ts,docPublisher.ts,assistantActions.ts}, client/src/components/chat/{ChatToolsMenu.tsx,RepoContextButton.tsx}, client/src/utils/modeDetection.ts, tests | v4.0.17 |
| 96 | Inyección de `combinedContext` en `ACTION_PROMPT`, aumento de `maxTokens` a 8.192 en `attemptSend` (`assistantActions.ts`), y fallback en `parseRepoTarget` (`actionExecutor.ts`) para evitar resoluciones erróneas `owner/owner` y truncado de respuestas largas. | client/src/services/{assistantActions.ts,actionExecutor.ts}, tests | v4.0.18 |
| 97 | Reemplazo case-insensitive de marcadores de repositorio (`OWNER`, `REPO`, `:owner`, `:repo`) en `resolveEndpoint` (`actionExecutor.ts`), evitando que endpoints devueltos por la IA como `/repos/OWNER/REPO/contents/...` fallen con 404 o marcadores sin resolver. | client/src/services/actionExecutor.ts, tests | v4.0.19 |
| 98 | Inyección de reglas de contexto obligatorio (`📌 REGLA DE REPOSITORIO Y ARCHIVOS EN CONTEXTO (CRÍTICO)`) en `action-system.md` y cabecera explícita en `assistantActions.ts` para prohibir `GET /user/repos` o `GET` redundantes y forzar la generación directa de `PUT` al modificar archivos con contexto activo. | client/src/prompts/action-system.md, client/src/services/assistantActions.ts, tests | v4.0.20 |
| 99 | Aumento de `DEFAULT_AI_TIMEOUT_MS` a 180s (3 minutos) en `retry.ts` para dar tiempo a modelos lentos y proveedores de IA al generar acciones `PUT` extensas en modo Acción. | client/src/utils/retry.ts, tests | v4.0.21 |
| 100 | Fix de alineación en `ChatToolsMenu.tsx` (`left: 0`, `right: 'auto'`), haciendo que el menú desplegable de "Más herramientas" abra hacia la derecha dentro del área de chat sin invadir ni superponerse sobre el panel lateral de Plantillas. | client/src/components/chat/ChatToolsMenu.tsx, tests | v4.0.22 |
| 101 | Sincronización a 180s del timeout de IA en el panel de selección de proveedores (`AIProviderPanel.tsx`), placeholders y diccionarios i18n (13 idiomas). Robustecimiento del Modo Acción tras Chat con extracción de bloques markdown embebidos en prosa, saneamiento de saltos de línea crudos en cadenas JSON de `contenidoPropuesto`, normalización case-insensitive (`metodo` a mayúsculas, `tipo` a minúsculas) y recordatorio de Modo Acción para modelos como Qwen 3.8 Max. | client/src/components/ai-provider/{AIProviderPanel.tsx,AIProviderPanel.test.tsx}, client/src/services/{gemini.ts,assistantActions.ts}, client/src/i18n/*.ts, tests | v4.0.22 |
| 102 | Fix de alineación del menú desplegable "Más herramientas" en `ChatToolsMenu.tsx` (`right: 0`, `left: 'auto'`), haciendo que el menú abra desplegándose hacia la izquierda dentro de la zona de chat central sin invadir ni superponerse sobre el panel lateral de Historial de la derecha. | client/src/components/chat/ChatToolsMenu.tsx, tests | v4.0.23 |
| 103 | Elevación del timeout del servidor backend proxy (`UPSTREAM_TIMEOUT_MS`) a 180s (180_000ms) en `server/index.js` y `server/__tests__/upstreamTimeout.test.js` para sincronizar con el cliente y evitar respuestas prematuras HTTP 504 Gateway Timeout al generar propuestas extensas en QwenCloud / Qwen 3.8 Max. | server/index.js, server/__tests__/upstreamTimeout.test.js | v4.0.24 |
| 104 | Corrección del clasificador de modelos dinámicos en QwenCloud (`fetchModels` en `providers.ts`): diferenciación estricta entre modelos de capa gratuita (Qwen / DeepSeek) y modelos comerciales de pago de terceros (`glm-5.2`, `zhipu`, `baichuan`, `minimax`...) para evitar etiquetas e insignias `FREE` falsas en la UI. | client/src/services/providers.ts, tests | v4.0.25 |

---

## 🗑️ Mejoras Descartadas / Inviables

- **#33 / #35 (v3.22.3):** Sugerencia automática de revisores y asignación de etiquetas a PRs (descartadas por sobre-complejidad sin API de Teams).
- **#36 (v3.41.0):** Migración a GitHub App con permisos granulares (descartada por romper la arquitectura Zero-Storage al requerir Tokens de Instalación persistidos server-side).
