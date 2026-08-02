# 🔮 Roadmap de Mejoras — Análisis del Código

Estado del código, mejoras realizadas y pendientes del proyecto.

**Actualizado a:** v3.64.0 · Julio 2026

---

## 📖 Convenciones del documento

- Los IDs (`#1`–`#58`) son **issues reales del repositorio GitHub** y no se reutilizan; los huecos son intencionados (ítems fusionados o descartados — ver nota al final).
- Los ítems que no tuvieron issue propio se numeran desde **`#59`** en adelante.
- Al resolver un punto, se mueve a la tabla ✅ con su versión. El estado se deduce de la sección en la que vive el ítem.
- Las prioridades (🔴 Alta / 🟡 Media / 🟢 Baja) son orientativas y se reevalúan por sprint.

---

## ✅ Implementado (Resuelto)

Ordenado por versión ascendente. Las fases de un mismo issue (`#24`, `#28`, `#57`, `#58`) se listan como filas independientes para mantener la trazabilidad de versiones.

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
| 48 | Sync Repo Status — revisión bajo demanda de cambios recientes. Botón 🔄 en la UI (modelo pull, no webhooks: Cloud Run escala a cero y los webhooks en frío fallarían). `listRecentCommits`/`getCommit` en github.ts, `runSyncRepoStatus` en assistantActions.ts, `SyncRepoStatusButton`. 4 tests | services/assistantActions.ts (runSyncRepoStatus), services/github.ts (listRecentCommits, getCommit), components/chat/SyncRepoStatusButton.tsx, ChatInput.tsx, i18n/{es,en}.ts | v3.37.0 |
| 59 | OpenCode Zen y Cloudflare Workers AI: fix CORS + catálogo estático (proxies `/api/openzen` y `/api/cloudflare`) | providers.ts, server/index.js (proxies + rate limiters), gemini.ts (accountId header), i18n, providers.test.ts | v3.33.2–v3.33.7 |
| 59 | Cloudflare 400 fix: proxy lee `X-Account-Id` del header (no del body); Cloud Run startup fix (type assertion TS); saneo de headers + modelos ampliados | server/index.js, providers.ts (CLOUDFLARE_FALLBACK 8 modelos) | v3.33.3–v3.33.7 |
| 60 | Ollama Cloud (nuevo proveedor) + 11 modelos free verificados + retry 429 + Cloudflare fix headers + error accionable 403/429 | providers.ts (OLLAMA_FALLBACK 11 modelos), retry.ts (429 + pattern), server/index.js (strip content-encoding), gemini.ts (error Cloudflare), i18n ES/EN | v3.34.0 |
| 58 | **Fase 1-3: Publicación flexible de documentación (sin paths hardcodeados)** — Selector de tipo de documentación en `DocumentFlowModal`: Repo completo (README+MANUAL) / Archivo único (docs/{base}.md) / Documento específico del repo (path elegido por usuario de lista editable: MEJORAS_FUTURAS.md, CHANGELOG.md, docs/*.md, custom). `docPublisher.ts` generalizado a array de targets `{ path, content, message }`; `publishFileDoc` generalizado a `publishDocAt(path, content)`. Validación de permisos de escritura (HEAD `/repos/{owner}/{repo}/contents/{path}`). | components/confirm/DocumentFlowModal.tsx, services/docPublisher.ts, services/assistantActions.ts (runGenerateSpecificDoc, runPublishSpecificDoc), services/github.ts | v3.35.0 |
| 58 | **Fase 4: Instrucciones adicionales (selectividad)** — Campo de texto opcional "Instrucciones adicionales" en el flujo de documento específico se propaga hasta el generador. En `App.tsx`, `flowGenerateSpecific` reenvía `extraInstructions` como `conversation` a `runGenerateSpecificDoc`; `generateSpecificDoc` lo incluye como `CONTEXTO ADICIONAL` en el prompt del LLM. | components/confirm/DocumentFlowModal.tsx, App.tsx, services/gemini.ts, services/assistantActions.ts | v3.35.0 |
| 58 | **Fase 5: Crear repo + documentar archivo específico** — Flujo unificado para crear un repo inexistente y documentar un archivo específico del repo en un solo paso (reusa callbacks Fase 2/3/4). | components/confirm/DocumentFlowModal.tsx, services/assistantActions.ts | v3.35.0 |
| 58 | **Fase 6: Persistencia avanzada** — Hook `useDocTargetSelector.ts` que persiste en `localStorage` (clave `doc_target_selector`) el `scope`, `repoInput`, `targetPath` y `extraInstructions` del último flujo "documento específico del repo". Al reabrir `DocumentFlowModal`, el usuario recupera su contexto previo. 11 tests unitarios. | client/src/hooks/useDocTargetSelector.ts, client/src/hooks/__tests__/useDocTargetSelector.test.ts, components/confirm/DocumentFlowModal.tsx, client/src/test/setup.ts | v3.36.0 |
| 62 | Mitigación vulnerabilidades `xlsx` (SheetJS) — Límite 10 MB en `spreadsheetReader.ts` antes de parsear + validación básica cabecera post-parseo. Aviso UI en FileAttachButton/DocumentFlowModal. Rate limiting en catch-all SPA route. CI workflow `permissions: contents: read`. **NO migrar a `exceljs`** (+4 MB bundle) | client/src/utils/spreadsheetReader.ts, client/src/components/chat/FileAttachButton.tsx, server/index.js, .github/workflows/ci.yml, docs/SEGURIDAD.md, README.md | v3.36.1 |
| 63 | CI workflow `permissions: contents: read` (token con scope workflow). Re-confirmado en v3.38.1 (ya aplicado desde v3.36.1) | .github/workflows/ci.yml | v3.36.1 |
| 59 | Nuevo proveedor Ai& (`api.aiand.com`) — OpenAI-compatible. Catálogo dinámico con detección free por `input_per_1m`/`output_per_1m` a 0 + fallback sin pricing. `defaultModel: qwen/qwen3.6-27b`. i18n ES/EN. ⚠️ Añadido en v3.38.0 como "directo del navegador, sin proxy" (asunción falsa); corregido en v3.38.1 (ver #64) | client/src/services/providers.ts, client/src/i18n/{es,en}.ts | v3.38.0 |
| 60 | `effectiveMaxTokens` por proveedor — campo `maxOutputTokens` en `ProviderDef`; `callAI` resuelve `maxTokens ?? provider.maxOutputTokens ?? 4096` para ambos transportes. Ai& → 8192 (evita respuestas vacías en modelos de razonamiento). | client/src/services/{providers,gemini}.ts | v3.38.0 |
| 61 | Renombrado del nombre visible (ES/EN) — "Asistente de IA para Publicar Repositorios" → "Asistente de IA de GitHub" / "AI Assistant for Publishing Repositories" → "GitHub AI Assistant" (4 claves i18n × idioma, title, description, banner server, cabeceras css/Dockerfile). | client/src/i18n/{es,en}.ts, client/index.html, package.json, server/index.js, client/src/index.css, Dockerfile | v3.38.0 |
| 64 | **Fix Ai& (v3.38.1):** CORS en prod + catálogo. (1) `api.aiand.com` no envía CORS → `Failed to fetch`; movido a proxy backend (`aiandLimiter` + `POST /api/aiand` + `GET /api/aiand/models`, patrón idéntico a NIM/OpenZen/CF/Ollama). (2) Catálogo mostraba 5 modelos (fallback `AIAND_FALLBACK` con 4 modelos no validados) → reducido a solo `qwen/qwen3.6-27b` + filtro free-only en `fetchModels`. No cambia `transport`, `defaultModel` ni `maxOutputTokens: 8192` | server/index.js, client/src/services/providers.ts, client/src/services/__tests__/providers.test.ts, CHANGELOG.md, METODOLOGIA_IA.md | v3.38.1 |
| 65 | **Deuda de lint de v3.50.1 resuelta** — Los 15 warnings heredados de subir ESLint 9→10 + react-hooks 5→7 (#77) se resuelven caso por caso: `npm run lint` 15→0 warnings. Bug real corregido (`App.tsx:128` `provider` duplicado en deps), 5 refactors (derived state con `useMemo` en `InstructionSuggestions`, `SessionWarningBanner` con `visible` filtrado en render + intervalo vía latest-ref, `useModalDialog` con ref en `useEffect`), 8 silenciamientos in situ justificados (fetch en mount, hooks co-localizados con Provider, gates del entry point) y 1 `eslint-disable` inútil borrado. Las 3 reglas siguen en `warn` en `eslint.config.js`. | App.tsx, components/{chat/InstructionSuggestions,layout/SessionWarningBanner,multi-repo/RepoSelector,confirm/DocumentFlowModal}.tsx, hooks/useModalDialog.ts, context/{AIProvider,Auth,History}Context.tsx, main.tsx, test/setup.ts | v3.50.2 |
| 26 | **Cobertura de los componentes tocados en v3.50.2 sin suite propia.** 34 tests nuevos en 3 suites que blindan los refactors de v3.50.2: `HistoryContext` (9 tests — add/update/clear/export + guard), `RepoSelector` (11 tests — fetch en mount, filtro, toggle/toggleAll con estado controlado, error de red, pluralización), `InstructionSuggestions` componente (14 tests — navegación por teclado cíclica, renderizado condicional, reset de selección). `main.tsx` y `App.tsx` se dejan fuera (el propio #26 los marca "bajo valor, opcional"). | client/src/context/__tests__/HistoryContext.test.tsx, client/src/components/multi-repo/__tests__/RepoSelector.test.tsx, client/src/components/chat/__tests__/InstructionSuggestions.test.tsx | v3.50.3 |
| 53 | **Sugerir mensaje de commit semántico** — Reformulación final: como la app opera vía GitHub API sin working tree local, "analizar el diff pendiente" no aplica. En su lugar, `commitSuggester.ts` propone el mensaje **antes de abrir el `ConfirmModal`** para acciones PUT/DELETE sobre archivos, usando los 10 commits recientes del repo destino como few-shot de estilo y el prompt dedicado `prompts/commit-message.md` (Conventional Commits). Best-effort con fallback determinista (`feat:`/`docs:`/`chore:` según tipo de acción) si no hay apiKey/model o falla la red; nunca bloquea el flujo. Zero-Storage intacto (la sugerencia vive solo en el textarea del modal). 24 tests. ⚠️ **Implementado de hecho en v3.50.0 pero sin documentar entonces en el roadmap;** este cierre editorial llega en v3.50.3. | client/src/services/commitSuggester.ts, client/src/services/assistantActions.ts:901-933, client/src/prompts/commit-message.md, client/src/services/__tests__/commitSuggester.test.ts | v3.50.0 (docs: v3.50.3) |
| 26 | **Cobertura de `DiffViewer`** — Último componente de confirmación con valor real y sin suite propia. 18 tests nuevos en `DiffViewer.test.tsx`: render de cabecera y leyendas i18n (`● Eliminado`/`● Añadido`), invocación de `Diff.createPatch` con los 5 argumentos (incluye headers `Versión actual`/`Versión propuesta`), opciones de `diff2html` (`side-by-side` + `matching: 'lines'`), inyección del HTML en `.diff-wrapper`, re-renders selectivos por dep cambiada (e inmutabilidad cuando las props no cambian), casos límite (contenido idéntico, creación, borrado, multilinea) y resiliencia ante errores/HTML vacío de `diff2html`. Patrones documentados: mock de namespaces ESM vía `vi.mock` + factory (no `vi.spyOn`) y mock determinista del HTML de librerías externas. | client/src/components/confirm/__tests__/DiffViewer.test.tsx | v3.50.4 |
| 75 | **Tests E2E con Playwright** — Primera batería de tests de fin de flujo. 3 specs (`e2e/chat.spec.ts`) sobre la **arquitectura real de producción** (Express en `:3300` sirviendo el SPA construido, no dev servers): (1) camino feliz de chat, (2) acción confirmada con diff → `ConfirmModal` → PUT a GitHub, (3) proveedor falla → error accionable sin stack trace. Helpers en `e2e/fixtures.ts` cruzan los dos gates (auth mock + mock del chat de validación) y reproducen el contrato SSE del proxy `/api/gemini` cuando el body pide `stream:true`. Job de CI `e2e` paralelo en `.github/workflows/ci.yml` (instala Chromium, buildea, ejecuta, sube reporte). | e2e/{chat.spec.ts,fixtures.ts}, playwright.config.ts, package.json, .github/workflows/ci.yml | v3.61.0 |

---

## ⏳ Pendientes

Ordenadas por prioridad. Cada ítem se mueve a la tabla ✅ al resolverse.

### 🔴 Alta Prioridad

| # | Punto | Esfuerzo | Estado |
|---|-------|----------|--------|
| 26 | Mantener y expandir cobertura de tests con Codecov | Continuo (2-4h/sprint) | 🔄 En progreso |

#### #26 — Mantener y expandir cobertura de tests con Codecov
**Esfuerzo:** Continuo (2-4h por sprint)

**Progreso realizado (v3.64.0):** ✅ Infraestructura completa
- ✅ Vitest + Codecov + CI con GitHub Actions (cliente + servidor)
- ✅ Badge de Codecov en README
- ✅ Cobertura actual: ver Codecov (~90% líneas)
- ✅ **926 tests en el cliente (63 suites) + 50 en el servidor (6 suites)** = **976 unitarios** + **13 tests E2E** con Playwright (5 specs). Cobertura amplia de contextos, services, utils, hooks y componentes.

**Pendiente:**
- Aumentar cobertura del ~64% al 70% objetivo.
- Añadir tests para módulos poco cubiertos:
  - `App.tsx` (~0%): tras #42 ya es solo JSX + wrappers finos (la lógica vive testeada en `assistantActions.ts`). Llevarlo a verde requiere un **test de integración que renderice `App`** (mockeando los 3 contextos y los hijos) — bajo valor, opcional.
  - ✅ `HistoryContext.tsx` — cubierto en v3.50.3 (9 tests).
  - ✅ `RepoSelector` — cubierto en v3.50.3 (11 tests).
  - ✅ `InstructionSuggestions.tsx` (componente) — cubierto en v3.50.3 (14 tests).
  - ✅ `DiffViewer.tsx` — cubierto en v3.50.4 (18 tests).
  - Edge cases y errores en servicios existentes.
- Configurar umbral mínimo de cobertura en CI (fail si < 70%).

**Beneficio:** Mayor confianza en cambios futuros; detección temprana de regresiones; documentación viva del comportamiento esperado.

**Nota:** Mejora transversal — cada vez que se resuelva otra mejora, se deben añadir tests correspondientes.

---

### 🟡 Media Prioridad

#### #36 — ~~Migrar a GitHub App para permisos granulares~~ (DESCARTADO en v3.41.0)
**Esfuerzo:** 6–8h (cambio de arquitectura de auth)

**Problema original:** La app usa una **OAuth App** con scope `repo` (acceso total
a todos los repos), excesivo si solo se usan funciones de lectura.

**Solución propuesta:** Los permisos finos por recurso (repos concretos, lectura
vs escritura) **no son viables con la OAuth App actual** — requieren migrar a una
**GitHub App** con *fine-grained permissions* y selección de repositorios por
instalación. Implica rehacer el flujo OAuth del servidor (`server/index.js`) y el
manejo de tokens de instalación.

**Beneficio:** Principio de mínimo privilegio real; el usuario elige a qué repos
da acceso; mayor confianza.

**Caveat:** No es un ajuste de scopes, es un cambio de tipo de aplicación en
GitHub. Por eso sube de esfuerzo y complejidad.

**❌ Descartado en v3.41.0** tras análisis del flujo de auth real. Razones:
1. **Rompe el principio zero-storage**: la app hoy guarda el token **solo en
   memoria del navegador** (`AuthContext.tsx:19-26`, nunca en el server). Los
   *installation tokens* de una GitHub App **expiran cada ~1h** y requieren
   refresh con JWT de la App + `installation_id` **persistidos server-side** — lo
   que destruiría la arquitectura deliberadamente sin-persistencia actual.
2. **Beneficio marginal para el modelo de uso**: la app es **single-user, uso
   personal** (un usuario, su token, sesión de navegador). El principio de mínimo
   privilegio por-usuario no aporta valor cuando no hay multi-tenant.
3. **Coste alto, riesgo alto**: 6-8h tocando el núcleo de auth (que funciona),
   para un beneficio de seguridad marginal en este modelo de amenaza (el riesgo
   real es robo de sesión de navegador, no over-scoping).
4. El scope `read:org` (también pedido en `server/index.js:694`) **no se usa** —
   no hay endpoints `/orgs` ni `/teams` en el código. Si se quisiera reducir el
   over-scoping sin migrar, bastaría con quitar ese scope; pero `repo` es
   indivisible en OAuth App y la app escribe (PRs, ficheros, branches), así que
   no se puede acotar más sin migrar. **Decisión: el coste/beneficio no se
   justifica. Cerrado como descartado.**

---

#### #67 — Normalización de acentos/ñ en el tokenizador de `contextRanker.ts` ✅ RESUELTO en v3.57.1
**Esfuerzo:** ~1-2h · **Prioridad:** 🟡 Media

> ✅ **Implementado en v3.57.1**: `tokenize()` en
> `client/src/utils/contextRanker.ts` normaliza con
> `text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()` antes de
> aplicar el rango `[a-z0-9]`. NFD descompone los diacríticos (á→a+◌́, ñ→n+◌̃) y el
> replace los elimina, dejando la letra base: `autenticación`→`autenticacion`,
> `ñoño`→`nono`, `más`→`mas`. El rango `\u0300-\u036f` ya cubre la tilde de la `ñ`
> (U+0303) tras NFD, así que **no** hace falta el `.replace(/ñ/g,'n')` que proponía
> el borrador original. Como todo el matching (query, contenido+ruta, `pathTokens`)
> pasa por `tokenize()`, **un solo punto de cambio** arregla toda la familia
> léxica del español técnico en `-ción`. 5 tests nuevos (`contextRanker.test.ts`):
> normalización de acentos, acentos+`ñ`+mayúsculas, no-pérdida de monosílabos
> (`más`), y ranking `autenticación` ↔ contenido `autenticacion` (fallaba pre-fix).
> Función pura → Zero-Storage intacto, cero coste/latencia.

**Contexto (v3.56.2, 2026-07-24):** el ranker de archivos (#49, BM25, v3.15.0)
tokeniza con `text.toLowerCase().match(/[a-z0-9]+/gi)` en
`client/src/utils/contextRanker.ts:22`. El rango `[a-z]` **no incluye letras
acentuadas ni `ñ`** (la flag `i` no extiende el rango a `á`-`ú`), así que los
acentos actúan como separadores. Consecuencias en español técnico:

| Consulta | Tokens resultantes |
|---|---|
| `autenticación` | `['autenticaci']` (truncado) |
| `envío` | `['env']` (roto) |
| `más` | `[]` (desaparece) |
| `configuración` | `['configuraci']` (truncado) |

Casi todo el léxico técnico en `-ción` se trunca a `-ci`. Como los identificadores
del código van **sin acento** (`autenticacion`, `configuracion`), el token
truncado `autenticaci` **no coincide** con el identificador real → el archivo
correcto no sube en el ranking aunque el usuario pregunte por él.

**Fix:** normalizar antes de tokenizar:
`text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ñ/g,'n').toLowerCase()`.
Una sola línea; convierte `autenticación`→`autenticacion`, que ya coincide con el
código. Arregla una familia entera de fallos, sin diccionario manual.

**Beneficio:** corrige toda la clase de fallos de acentuación (mucho más común en
español que el cruce de idioma de #68); cero coste/latencia; función pura → fácil
de testear. Complementario de #68 (este cubre acentos; #68 cubre sinónimos
ES↔EN).

**Origen:** análisis derivado de evaluar por **dogfooding** la propuesta de
Gemini Flash 3.6 sobre `contextRanker.ts` (ver #68); redacción por [GLM-5.2].

---

#### #70 — Activar `SyncRepoStatus` (#48): el botón 🔄 estaba huérfano ✅ RESUELTO (v3.59.0)
**Esfuerzo:** ~2-4h · **Prioridad:** 🟡 Media

**Cerrado en v3.59.0** (dogfooding GLM-5.2, 2026-07-29). El servicio
`runSyncRepoStatus` (`client/src/services/assistantActions.ts:453`) y el botón
`SyncRepoStatusButton` estaban construidos pero sin cablear en la UI. Se completó:

1. **`ChatInput.tsx`:** import de `SyncRepoStatusButton`, prop opcional
   `onSyncRepoStatus?` (patrón `onOpenSecurityAudit`, render condicional) y
   montaje en `chat-input-extras`.
2. **`App.tsx`:** import de `runSyncRepoStatus` y handler `handleSyncRepoStatus`
   (patrón `handleSummarizeThread`; el servicio resuelve el ref del repo
   internamente con `resolveRepoRef`, así que no requiere cargar `repoContext`).
3. **Bug i18n corregido:** las 4 claves `syncRepo.*` estaban **comentadas** en
   `i18n/es.ts:315` y `en.ts:314` (un `//` de cabecera absorbía toda la línea), de
   modo que el botón mostraba la clave literal en producción. Descomentadas en
   ambos idiomas.
4. **Tests:** suite nueva `SyncRepoStatusButton.test.tsx` (5 casos: render,
   click→callback con trim, disabled, prompt cancelado, prompt vacío). El
   servicio ya tenía 4 tests previos en `assistantActions.test.ts`.

**Beneficio:** análisis bajo demanda de commits recientes con IA (pull, no
webhooks — compatible con Cloud Run escala-a-cero).

**Caveat:** sin los tests del servicio, el CI fallará por codecov/patch; esta
mejora **no** es de bajo riesgo como #69.

---

#### #73 — Timeout automático en llamadas a la IA ✅ (v3.60.0)
**Esfuerzo:** ~2-3h · **Prioridad:** 🟡 Media · **Estado:** ✅ Resuelto en v3.60.0

**Contexto (v3.56.2):** hoy la única cancelación de una llamada IA es manual, vía
el `AbortSignal` del botón "Detener" (`client/src/utils/retry.ts` +
`ChatInput.tsx`). **No hay timeout automático:** si un proveedor cuelga (conexión
abierta sin respuesta), el spinner queda girando indefinidamente hasta que el
usuario pulse Detener o recargue.

**Resuelto en v3.60.0 (extremo a extremo, default 120 s configurable):**
- `client/src/utils/retry.ts`: `DEFAULT_AI_TIMEOUT_MS` (120 s) + `combineSignals`
  (combina el signal manual del usuario con `AbortSignal.timeout` vía
  `AbortSignal.any`, con polyfill) + `isTimeoutAbortError`. Reutiliza
  `withTransientRetry` sin tocarlo: el timeout dispara un abort que ya se propaga
  sin reintentos.
- `callAI` acepta `timeoutMs` (nuevo parámetro, retrocompatible); `AIProviderConfig`
  lo añade y fluye por `App.tsx` → `runSend`/`runSecurityAudit`.
- UI: input "Timeout (segundos)" en `AIProviderPanel` (10–600), persistido en
  `sessionStorage` vía `providerPrefs`. Mensaje diferenciado timeout vs. Detener
  (`chat.generationTimeout`).
- **Server:** los 6 proxies POST + la ruta Gemini (SDK) aplican
  `signal: upstreamSignal()` (defensa en profundidad: si el cliente desaparece,
  el server suelta la conexión upstream); el `catch` responde **504** cuando el
  error es de timeout.

**Caveat resuelto:** 120 s cubre modelos de razonamiento (Ai& 8192 tokens) y
generación de docs (README+MANUAL); configurable por el usuario (subir/bajar en
el panel) en vez de por proveedor, más sencillo y suficiente.

---

### 🟢 Baja Prioridad

#### #25 — Mejorar DX y pipeline de despliegue
**Esfuerzo:** 2–3h

**Tareas:**
- ✅ GitHub Actions CI — lint + tests (cliente + servidor) con cobertura en cada push/PR a main — *v2.4.0*
- ✅ Despliegue continuo (CD) — Cloud Build construye y despliega `main` a Cloud Run en cada push — *operativo*
- ✅ Logs estructurados en el servidor (JSON con timestamp, level, requestId) — *v3.39.0* (#65: `server/logger.js` con `logEvent` + `requestIdMiddleware`; 34 `console.*` → `log.info/error`)
- ✅ Healthcheck extendido en `/health` (versión, uptime, timestamp, nodeVersion, estado de variables críticas como booleanos) — *v3.40.0* (#25-parte2: `HEALTH_VARS` + versión leída de `package.json` vía `createRequire`; `/health` sigue HTTP 200 + `status:'ok'` para Cloud Run; `server/__tests__/health.test.js` 8 tests)
- ✅ Script `deploy.sh` con validación previa de variables (alternativa al deploy manual) — *v3.41.0* (#25-parte3: valida `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`/`SESSION_SECRET` antes de `gcloud run deploy --source .`; lee `.env` si existe; confirmación `[s/N]`; no sustituye el CD automático; `npm run deploy`)

---

#### #52 — Modo Auditoría de Seguridad (flujo/template) ✅ RESUELTO en v3.42.0
**Esfuerzo:** 3–4h
**Origen:** sugerencia de **Gemma 4 31B** (OpenRouter), **dogfooding**.

> ✅ **Implementado en v3.42.0**: botón 🛡️ (`SecurityAuditButton`) + plantilla
> "Auditar Seguridad" en el dropdown. Runner `runSecurityAudit` (molde de
> `runSummarizeThread`) que carga archivos sensibles extra por path conocido
> (`package.json`, lockfile, `Dockerfile`, workflows, etc., tragando 404s) y los
> pasa al prompt dedicado `prompts/security-audit.md` (rol auditor, 3 ejes,
> disclaimer). Lectura-only (modo `chat`), Zero-Storage intacto. Caveat
> comunicado en UI: orientativo, no sustituye a `gitleaks`/Dependabot/CodeQL.

**Problema actual:** la app gestiona y documenta repos, pero no ayuda a **asegurarlos**.

**Solución propuesta:** un botón/plantilla con un prompt especializado que, sobre el repo cargado como contexto, revise: **secrets expuestos** (claves/tokens en el código), **dependencias obsoletas** y **falta de validación de inputs**. Encaja con `utils/instructionSuggestions.ts` (plantillas de instrucción).

**Beneficio:** pasar de "gestionar el repo" a "asegurar el repo"; muy vendible en un portfolio.

**Caveat:** ayuda **orientativa vía LLM**, no una garantía de seguridad ni un escáner formal (no sustituye a `gitleaks`/Dependabot). Comunicarlo con honestidad en la UI.

---

#### #53 — ~~Sugerir mensaje de commit semántico~~ ✅ RESUELTO en v3.50.0 (docs: v3.50.3)

> ✅ **Implementado en v3.50.0** (sin documentar entonces en el roadmap; cierre
> editorial en v3.50.3). Reformulación final: la app opera vía GitHub API sin
> working tree local, así que "analizar el diff pendiente" no aplica. En su
> lugar, `commitSuggester.ts` propone el mensaje **antes de abrir el
> `ConfirmModal`** para acciones PUT/DELETE sobre archivos, usando los commits
> recientes del repo como few-shot y un prompt dedicado. Best-effort con
> fallback determinista; nunca bloquea el flujo. Zero-Storage intacto. 24 tests.
> Ver la fila correspondiente en la tabla ✅ de arriba.

---

#### #58 — Publicación flexible de documentación ✅
- **Fase 1-6** (v3.35.0–v3.36.0): Selector de documentación, doc específica, instrucciones adicionales, crear+documentar, persistencia.
- **#58(a)** ✅ v3.53.0 — Publicación bulk de varios archivos (Git Data API, commit atómico).
- **#58(b)** ✅ v3.52.0/.1/.2 — Edición incremental con diff en los 3 scopes.
- **#58(c)** ✅ v3.54.0 — Modo revisión uno-a-uno (ChangeReviewModal, parseGeminiActions).

---

#### #66 — Revisión periódica del catálogo Gemini (cada 2-3 meses)
**Esfuerzo:** ~1h cada revisión · **Prioridad:** 🟢 Baja

**Contexto (v3.55.0, 2026-07-23):** el catálogo de Gemini es **estático**
(`GEMINI_MODELS` en `client/src/services/providers.ts`, 18 modelos). El fetch
dinámico se retiró en v3.24.0 por falta de fiabilidad en producción y porque
la API devuelve muchos modelos no-chat. Como contrapartida, el catálogo estático
puede desfasarse cuando Google añade modelos de chat nuevos. Esta es la
revisión periódica que lo mantiene al día sin reactivar el riesgo del fetch
automático.

**Análisis cuantitativo de la API (consulta real `GET /v1beta/models`, 2026-07-23):**
- **56** modelos totales devueltos por la API.
- **41** con `generateContent` en `supportedGenerationMethods`.
- **23** de esos 41 **NO son de chat** aunque expongan `generateContent`:
  imagen (`*-image*`, "Nano Banana"), TTS (`*-tts*`), música (`lyria-*`),
  robótica (`gemini-robotics-er-*`), agentes (`antigravity`, `deep-research`,
  `computer-use`, `customtools`, `omni`), y versiones pinned redundantes (`-001`).
- Los **18 modelos curados** coinciden exactamente con el subconjunto óptimo
  tras filtrar el ruido. Ninguno es ficticio (el viejo problema de v3.23.x,
  donde `gemini-2.5-flash-lite` no existía, ya no aplica).
- **Hallazgo:** el campo `supportedGenerationMethods` **nunca** lista
  `streamGenerateContent` (solo `generateContent` + `countTokens`); no sirve
  para distinguir modelos con streaming.

**Procedimiento de revisión (cada 2-3 meses):**
1. Consultar la API vía el endpoint ya existente del backend
   (`GET /api/gemini/models` en `server/index.js:261`, con una `Bearer` key
   válida) — o directamente `GET https://generativelanguage.googleapis.com/v1beta/models`.
2. Comparar la lista devuelta (filtrando el ruido con el denylist de abajo)
   contra los 18 `GEMINI_MODELS` actuales.
3. Añadir/retirar modelos del array estático + su i18n (`provider.gemini.model.*`
   en `es.ts`/`en.ts`) + `modelLabels.ts` + los 2 tests (`providers.test.ts`,
   `AIProviderPanel.test.tsx`).
4. Bump de versión (minor) + entrada en `CHANGELOG.md`.

**Denylist que haría falta si en el futuro se decide reactivar el catálogo
dinámico** (filtro adicional al `generateContent` requerido):
`['image', 'tts', 'robotics', 'lyria', 'nano-banana', 'antigravity',
'deep-research', 'computer-use', 'customtools', 'omni', '-001']`.
El denylist actual (`['embed', 'vision', 'aqa', 'imagen', 'chirp']`) **no**
filtra ninguno de los 23 modelos ruidosos de hoy — habría que expandirlo.

**Beneficio:** catálogo fiable al 100% (sin los riesgos de v3.23.x) y siempre
actualizado con los modelos de chat reales de Google.

**Caveat:** la revisión es manual; si se quiere automatizar, conviene esperar
a que Google publique una forma fiable de distinguir modelos de chat (hoy no
la hay: ni `streamGenerateContent` ni un campo `task`/`type` fiable en la API).

---

#### #68 — Expansión léxica ES↔EN en `contextRanker.ts` (glosario agnóstico de repo) ✅ RESUELTO en v3.57.2
**Esfuerzo:** ~2-3h · **Prioridad:** 🟢 Baja

**Origen:** propuesta de **Gemini Flash 3.6** vía **dogfooding**, **refinada**.
Su idea original (añadir sinónimos al ranking de archivos) es correcta; sus
*ejemplos* eran arquitectónicamente erróneos.

**Contexto (v3.56.2):** idea original de Gemini: enriquecer el BM25 de
`contextRanker.ts` con una capa de sinónimos/conceptos antes de puntuar, para
que una pregunta en castellano coloquial encuentre código con identificadores en
inglés. El usuario no técnico escribe *"¿cómo se limita la cantidad de mensajes
que puedo enviar?"* y el ranker debe conectar con `rateLimit`, `retry`, `rateLimiter`.

**Refinamiento (error en la propuesta original):** Gemini mapeaba conceptos a
**identificadores de esta propia app** (`"seguridad"`→`['Zero-Storage',
'AuthContext', 'rateLimitHandler']`). Pero `contextRanker` rankea los archivos
**del repo que el usuario cargue** (`repoContext.files`, verificado en
`assistantActions.ts:949`), no el código de github-ai-assistant. Si el usuario
analiza un repo Django o Python, mapear a `AuthContext` no sirve. La versión
correcta es un **glosario de programación genérico** (agnóstico de repo):
`enviar`→`send`, `mensaje`→`message`, `error`→`error/retry/catch`,
`seguridad`→`security/auth/token`, `pantalla`→`screen/view/ui`…

**Fix:** función pura `expandQuery(query)` en `contextRanker.ts` que devuelva la
consulta enriquecida con sinónimos EN antes de pasarla a `rankFilesByQuery`.
Glosario como `const` estático, sin dependencias ni red (Zero-Storage intacto,
cero latencia). Cubre el cruce de idioma; los **acentos** se cubren aparte en
#67 (mejor relación coste/beneficio, hacer primero).

**Beneficio:** rankea mejor para usuarios no técnicos que preguntan en español.
**Caveat:** el glosario es manual y nunca será exhaustivo; beneficio marginal si
se hace #67 antes.

---

#### #69 — Activar el autocomplete de instrucciones (#22) ✅ RESUELTO en v3.57.0
**Esfuerzo:** ~1-2h · **Prioridad:** 🟢 Baja

> ✅ **Implementado en v3.57.0**: popover `InstructionSuggestions` montado en
> `ChatInput.tsx` dentro de `.chat-textarea-wrap`. Apertura por **trigger `/`**
> (convención Slack/GitHub/Linear): popover cerrado en carga, aparece al escribir
> `/` y filtra las 18 plantillas. El adapter `(tpl) => onChange(tpl.template)`
> inserta la plantilla; el `Enter` del textarea cede al popover cuando está abierto
> (guard `suggestionsOpen`) para evitar doble-envío. 2 tests nuevos de integración
> (`ChatInputSuggestions.test.tsx`) + 16 tests del componente actualizados al
> trigger `/`. Cierre del issue original **#22** (Autocompletado de instrucciones).

**Contexto (v3.56.2):** `client/src/components/chat/InstructionSuggestions.tsx`
es un popover de autocomplete de instrucciones (navegación por teclado completa:
`↑↓` navegar, `Enter` seleccionar, `Esc` cerrar) con **CSS propio**
(`InstructionSuggestions.css`), **i18n ES/EN** (`chat.suggestions.title`/`hint` +
18 plantillas `tmpl.*` vía `buildTemplates(t)`) y **15 tests verdes**
(`InstructionSuggestions.test.tsx`, v3.50.2). Pero **nunca se importa** en
`ChatInput.tsx`: está desconectado de la UI. Capacidad lista, sin estrenar.

**Tareas:**
1. Importar `InstructionSuggestions` + `useState` para el popover en
   `ChatInput.tsx`.
2. Renderizarlo dentro de `.chat-textarea-wrap` (flotante sobre el textarea).
3. `onSelectTemplate` → `onChange(template.template)` + cerrar popover.
4. Reconciliar el `Enter` (el componente ya captura `Enter` con selección; sin
   selección, el `handleKeyDown` de `ChatInput` envía el mensaje).
5. Smoke test de integración en un `ChatInput.test.tsx` nuevo (hoy no existe).

**Beneficio:** reduce fricción en una app que se vende como "opera GitHub en
lenguaje natural"; descubribilidad de las 18 acciones. **Bajo riesgo:** el
componente ya está testeado, la integración está aislada en `ChatInput.tsx` y no
toca lógica nueva → cero riesgo de codecov/patch (la mejora de mejor
valor/esfuerzo del roadmap).

---

#### #71 — Tema claro / toggle de tema ✅ RESUELTO (v3.62.0)
**Esfuerzo:** ~3-4h · **Prioridad:** 🟢 Baja

**Contexto (v3.56.2):** la app era **solo tema oscuro**. Los tokens CSS vivían
en `:root` (`client/src/index.css:10`, paleta `--bg-*`/`--text-*`). No había
`prefers-color-scheme`, ni atributo `data-theme`, ni toggle. Quien prefería tema
claro no tenía opción.

**Implementado (v3.62.0):** sistema de theming de cero, aunque la base era
favorable porque todo el CSS ya iba por variables `:root`.
- `ThemeContext` con 3 estados (`light` | `dark` | `auto`) y persistencia en
  `localStorage('app-theme')` (no `sessionStorage`: el tema debe sobrevivir a
  recargas). `auto` resuelve contra `matchMedia('(prefers-color-scheme: dark)')`
  y reacciona en vivo a cambios del SO.
- Tokens claros en `:root[data-theme='light']` (paleta GitHub-light, manteniendo
  el gradiente de acento). Anti-FOUC con script inline en `index.html`.
- `ThemeToggle` cíclico (claro☀️ → oscuro🌙 → auto🌓) en el `Header`, junto al
  selector de idioma.
- Refactor de `InstructionSuggestions.css` (13 hex hardcodeados → variables):
  era el único bloque de UI no temizable; ya responde al tema.
- 15 tests unitarios del contexto (`ThemeContext.test.tsx`).

**Beneficio:** accesibilidad/confort visual; cumplimiento de la preferencia del
SO. Default `'auto'` (para la mayoría = oscuro = estado previo, sin forzar
preferencia).

---

#### #72 — a11y: focus rings visibles + `prefers-reduced-motion` ✅ RESUELTO (v3.64.0)
**Esfuerzo:** ~1-2h · **Prioridad:** 🟢 Baja

> ✅ **Implementado en v3.64.0** (dogfooding GLM-5.2, 2026-07-31). Cero cambios en
> componentes: todo en `client/src/index.css`.
> - **Foco visible (WCAG 2.4.7):** nuevos tokens `--focus-ring-color/width/offset`
>   en `:root` (resuelven a `--accent-cyan`, idéntico en claro/oscuro) + regla
>   global `:focus-visible { outline + outline-offset }`. Solo aparece en
>   navegación por teclado. **Eliminados los 2 `outline: none`** de `.input` y
>   `.chat-textarea`, junto con su glow cian hardcodeado (no tokenizado); los
>   inputs mantienen `border-color: var(--accent-cyan)` al foco. **Cubre los
>   `<div tabIndex>` de `AIProviderBadge` y `AIProviderPanel`** —antes foco
>   invisible al recibirlo por teclado.
> - **Movimiento reducido (WCAG 2.3.3):** bloque `@media (prefers-reduced-motion:
>   reduce)` con `!important` (receta Mozilla). Neutraliza animaciones y
>   transiciones, incluidas las inline de `UserBadge`/`ChatInput`/`ChangeReviewModal`,
>   sin tocar los componentes. `iteration-count: 1` detiene los infinitos (`spin`,
>   `pulse`, `blink`).
> - **Tests:** `e2e/a11y.spec.ts` (3 specs sobre la app autenticada, reutilizando
>   `goAuthed` + `connectProvider`). Introduce el patrón `toHaveCSS` en la base E2E.
>
> **Honestidad sobre el proceso:** el primer test de reduced-motion falló por una
> asunción del propio test (esperaba `animation-duration: 0s`, pero Chromium computa
> `0.01ms` como `"1e-05s"` en notación científica). La app se comportó
> correctamente en todo momento; se corrigió la aserción a `/^(0s|1e-05s)$/`.

**Contexto (v3.56.2):** `client/src/index.css` declaraba `outline: none` en
`.input` y `.chat-textarea`, con lo que **no había anillo de foco visible** al
navegar con teclado (solo un glow tenue y no tokenizado). Además **no existía**
soporte de `prefers-reduced-motion`, así que las transiciones se animaban siempre,
incluso para usuarios sensibles al movimiento.

**Beneficio:** conformidad WCAG 2.4.7 (Foco visible) y 2.3.3 (Animación de
interacciones); navegación por teclado usable. Sin cambios de comportamiento para
usuarios de ratón (`:focus-visible` no dispara en clic).

---

#### #74 — Revisión periódica de catálogos free/dinámicos (cada 2-3 meses)
**Esfuerzo:** ~1-2h cada revisión · **Prioridad:** 🟢 Baja

**Contexto (v3.58.0, 2026-07-28):** la app soporta **10 proveedores**. De ellos,
**6 son dinámicos** —su catálogo se carga vía `fetchModels()` al seleccionarlos, y
los modelos se marcan 🆓 cuando son gratuitos:

| Proveedor | Catálogo | Señal de "free" | Origen de los modelos |
|---|---|---|---|
| Groq | dinámico | sin flag (todos son tier free) | `https://api.groq.com/openai/v1/models` |
| OpenRouter | dinámico | sufijo `:free` **o** pricing a 0 | `https://openrouter.ai/api/v1/models` (público) |
| Zenmux | dinámico | pricing a 0 | `https://zenmux.ai/api/v1/models` |
| Ollama | dinámico | sin flag | `/api/ollama/models` (proxy) |
| Ai& | dinámico | pricing `input_per_1m`/`output_per_1m` a 0 | `/api/aiand/models` (proxy, free-only) |
| **Kilo** | dinámico | sufijo `:free` | `/api/kilo/models` (proxy, público) |

Los otros **4 son estáticos** (catálogo fijo en `*_FALLBACK`, sin fetch dinámico):
**Gemini** (`GEMINI_MODELS`, 18 modelos — ver #66), **NVIDIA NIM** (`NIM_FALLBACK`),
**OpenCode Zen** (`OPENZEN_FALLBACK`) y **Cloudflare** (`CLOUDFLARE_FALLBACK`). La
razón es siempre la misma: el endpoint de modelos es ruidoso o no envía CORS, así
que se curatea a mano.

Los arrays `*_FALLBACK` de los proveedores dinámicos son **red de seguridad**: se
muestran solo si el fetch falla o mientras carga. El catálogo "vivo" es el que
devuelve la API. Con el tiempo, los fallback se desfasan (modelos retirados,
nuevos `:free` que no aparecen). Esta revisión los mantiene al día.

**Procedimiento de revisión (cada 2-3 meses):**
1. Para cada proveedor **dinámico**, consultar su endpoint real (con una key
   válida del usuario o el proxy correspondiente) y comparar contra el array
   `*_FALLBACK` actual. Si hay modelos nuevos estables o algún fallback ya
   retirado, actualizar el array.
2. Comprobar la **señal de free** de cada rama de `fetchModels()` (sufijo
   `:free`, pricing a 0…): si el proveedor cambia su esquema, ajustar la
   detección (ej. Zenmux/Ai& pasaron de strings a arrays de `{ value }`).
3. Para **Gemini** (#66) y los demás estáticos, seguir su procedimiento propio
   (consultar API, comparar, actualizar array + i18n + `modelLabels.ts` + tests).
4. Bump de versión (patch o minor según volumen) + entrada en `CHANGELOG.md`.

**Archivos a tocar:** `client/src/services/providers.ts` (arrays `*_FALLBACK` y
rama de `fetchModels()`), `client/src/i18n/{es,en}.ts` (claves `provider.*.model.*`
solo si se añaden modelos estáticos con label i18n), `client/src/utils/modelLabels.ts`
(si se quiere etiqueta amigable en el badge), `client/src/services/__tests__/providers.test.ts`
y `client/src/components/ai-provider/__tests__/AIProviderPanel.test.tsx` (recuentos).

**Beneficio:** catálogos siempre útiles (sin modelos rotos/retirados en el
fallback) y detección de free al día con cada proveedor.
**Caveat:** la revisión es manual; automatizarla choca con que cada proveedor
expone el "free" de forma distinta y varios requieren key. Cubre el mismo espíritu
que #66 (Gemini) pero generalizado a los 6 proveedores dinámicos.

> **Revisión v3.65.0 (2026-08-01).** Cloudflare pasa de **estático a dinámico**:
> nuevo proxy `GET /api/cloudflare/models` que lista `Text Generation` excluyendo
> los 3 modelos no-Free (`kimi-k2.6`, `kimi-k2.7-code`, `glm-5.2`). El fallback
> `CLOUDFLARE_FALLBACK` se reordena sin esos modelos (recommended Qwen3 30B) — esto
> arregla los 403/429 que sufrían las cuentas Free. **Zenmux**: `ZENMUX_FALLBACK`
> ampliado con `deepseek/deepseek-v4-flash-free` (4.º free). `modelLabels.ts`
> (Zenmux desfasado + nuevo mapa Cloudflare) e i18n corregidos. Verificado contra la
> API real de CF. **Quedan pendientes** de revisar en la próxima pasada (~octubre
> 2026, junto con #66): Groq, OpenRouter, NIM, OpenCode Zen, Ollama, Ai&, Kilo.

> **Revisión v3.65.1 (2026-08-01).** **Groq** resuelto antes de su deprecation del
> 2026-08-16: `GROQ_FALLBACK` pierde `llama-3.3-70b-versatile` y `llama-3.1-8b-instant`
> (el `defaultModel` ya apuntaba a `openai/gpt-oss-20b` desde v3.64.0). Añadido
> `GROQ_DEPRECATED` y filtro en la rama dinámica de `fetchModels()` para que el
> catálogo no ofrezca esos modelos aunque la API aún los devuelva hasta el 16-ago.
> Traslada `GROQ_DEPRECATED` a la lista "limpieza post-deprecation" (borrable sin
> riesgo tras esa fecha). **Quedan pendientes** para ~octubre 2026 (con #66):
> OpenRouter, NIM, OpenCode Zen, Ollama, Ai&, Kilo.

---

#### #75 — Tests E2E (fin de flujo con Playwright) ✅ RESUELTO (v3.61.0, ampliado v3.63.0)
**Esfuerzo:** ~1 día · **Prioridad:** 🟢 Baja

**Contexto (v3.58.0):** el proyecto suma 884 tests unitarios (792
cliente + 44 servidor) pero no tiene ningún test E2E que valide el flujo
completo del usuario (autenticación → chat con proveedor → ejecución de
acción confirmada). Los tests unitarios cubren servicios y utilidades,
pero el "camino feliz" de la UI no tiene protección against regresiones de
integración.

**Propuesta:** configurar Playwright (stack estándar del ecosistema
Vitest/TypeScript) y escribir 2-3 tests que cubran el flujo crítico:
1. Carga de página → autenticación (mock) → envío de instrucción →
   respuesta en chat visible.
2. Instrucción que genera una acción → ConfirmModal con diff → usuario
   confirma → ejecución → resultado visible.
3. Proveedor no responde o tarda demasiado → mensaje de error
   accionable en la UI (no un stack trace crudo).

**Beneficio:** protege el flujo principal contra regresiones de integración;
complementa los tests unitarios existentes sin duplicar cobertura. Un
futuro cambio en `assistantActions.ts` o en los prompts no rompería el
flujo sin que los E2E lo detecten.

**Caveat:** Playwright añade ~2-3 MB al bundle de testing y requiere
navegadores headless en CI. El CI actual (Node 24, GitHub Actions) lo
soporta sin problema. Se ejecutaría en paralelo a los tests unitarios
existentes, no como sustituto.

**Origen:** sugerencia del dogfooding con **ling-3.0-flash:free** (2026-07-28).

---

## 📊 Resumen

| Prioridad | ✅ Resueltos | ⏳ Pendientes |
|---|---|---|
| 🔴 Alta | #1, #2, #13, #14, #15, #27, #28, #45, #62, #63 | #26 (en progreso, continuo) |
| 🟡 Media | #12, #17, #18, #19, #20, #21, #32, #34, #37, #38, #39, #40, #41, #42, #44, #46, #48, #49, #50, #51, #55, #56, #57, #59, #60, #61, #64, #67, #70, #73 | — |
| 🟢 Baja | #23, #24, #25, #52, #53, #58, #68, #69, #71, #72, #75 | #66 (revisión catálogo Gemini), #74 (revisión catálogos free/dinámicos) |
| 🗑️ Descartados | — | #33, #35 (descartados en v3.22.3), #36 (descartado en v3.41.0) |

> **Cómputo:** 56 ítems resueltos + 3 pendientes + 3 descartados (algunos issues como `#28`, `#57`, `#58` generan varias filas por sus fases). Los pendientes reales accionables son: **#26** (continuo, cobertura), **#66** (revisión periódica cada 2-3 meses del catálogo Gemini estático) y **#74** (revisión periódica de catálogos free/dinámicos, añadido en v3.58.0). **#72 cerrado en v3.64.0** (a11y foco visible `:focus-visible` tokenizado + `prefers-reduced-motion`, WCAG 2.4.7/2.3.3; cero cambios en componentes, todo en `index.css`; 3 specs E2E `a11y.spec.ts`). **#75 cerrado en v3.61.0** (tests E2E con Playwright; en v3.63.0 ampliados con specs de tema/i18n/persistencia + job E2E separado a `e2e.yml` con badge dedicado; en v3.64.0 +1 spec de a11y → 13 E2E). **#71 cerrado en v3.62.0** (tema claro/oscuro/auto con `ThemeContext` + `localStorage` + anti-FOUC + toggle en `Header` + refactor de `InstructionSuggestions.css` a variables + 15 tests). **#73 cerrado en v3.60.0** (timeout automático en llamadas IA, default 120 s configurable, extremo a extremo: `retry.ts` `combineSignals` + `AbortSignal.timeout` + UI + proxies server 504). **#70 cerrado en v3.59.0** (cableado de `SyncRepoStatus` en `ChatInput`/`App.tsx` + fix bug i18n `syncRepo.*` que estaban comentadas en `es.ts`/`en.ts` + suite `SyncRepoStatusButton.test.tsx`; dogfooding GLM-5.2). **#67 cerrado en v3.57.1** (normalización de acentos/`ñ` en `tokenize()` de `contextRanker.ts` vía NFD). **#68 cerrado en v3.57.2** (glosario ES↔EN agnóstico de repo + `expandQuery()` antes del BM25). **#69 cerrado en v3.57.0** (autocomplete de instrucciones #22: popover `InstructionSuggestions` con trigger `/` en `ChatInput.tsx`). **#58 cerrado completo en v3.54.0** (bulk v3.53.0, diff incremental v3.52.0/.1/.2, modo revisión v3.54.0). **#53 resuelto en v3.50.0** (sugerencia de commit semántico vía `commitSuggester.ts` + few-shot + fallback determinista). **#25 cerrado completo en v3.41.0** (logs v3.39.0 + healthcheck v3.40.0 + deploy.sh v3.41.0). **#52 resuelto en v3.42.0** (Modo Auditoría de Seguridad: botón 🛡️ + `runSecurityAudit` + prompt dedicado, lectura-only). **#36 descartado en v3.41.0** (rompe zero-storage, costo alto, beneficio marginal en single-user).
>
> **Reconciliación de inconsistencias (v3.64.0):** igual que v3.63.0 corrigió #75 (listado como pendiente pese a estar resuelto desde v3.61.0), esta versión reconcilia **#73** (resuelto en v3.60.0 pero constaba como pendiente en la tabla resumen, el cómputo y el "Próximo enfoque") y confirma **#68** (resuelto en v3.57.2). El "Próximo enfoque" y los conteos reflejan ahora el estado real.

> **#28** cubierto en su norte por las Fases 1 (v3.0.0, adjuntar como contexto) y 2 (v3.1.0, documentar→publicar). Más formatos: Fase 3a (v3.2.0, Excel/CSV), Fase 3b MVP (v3.3.0, Power BI .pbix/.pbit) y Fase 3b-bis (v3.4.0, Power Query M del `DataMashup`). Única limitación restante: en un `.pbix` moderno el M va en el modelo binario (no legible) → exporta `.pbit`. Word `.docx` (v3.11.0): texto de `word/document.xml`. Imágenes/visión: descartada.

---

## 🎯 Próximo enfoque (post-v3.64.0)

Con **v3.64.0** (**#72 resuelto**: a11y foco visible + reduced-motion), **v3.63.0**
(ampliación E2E + workflow propio), **v3.62.0** (**#71 resuelto**: tema claro/oscuro),
**v3.61.0** (**#75 resuelto**: tests E2E con Playwright), **v3.60.0** (**#73
resuelto**: timeout automático IA) y **v3.59.0** (**#70 resuelto**: SyncRepoStatus),
el roadmap queda en **3 pendientes accionables**. Orden recomendado:

1. **#26 — Cobertura de tests (🔴 Alta, continuo).** El proyecto suma
   **976 tests unitarios** (cliente 926 en 63 suites + servidor 50 en 6) y
   **13 tests E2E** con Playwright (5 specs: chat, theme, i18n, persistence,
   a11y). Cobertura global ~90% líneas (umbral codecov/patch ≥89%; umbral mínimo
   Vitest 70%). Quedan: edge cases de servicios existentes y subir el umbral mínimo
   en CI. `App.tsx` y `main.tsx` se dejan fuera (bajo valor, opcional).
2. **#66 — Revisión periódica del catálogo Gemini (🟢, ~1h c/2-3 meses).** No
   urgente (última v3.55.0, 2026-07-23; próxima ~oct-2026).
3. **#74 — Revisión periódica de catálogos free/dinámicos (🟢, ~1-2h c/2-3 meses).**
   Generaliza #66 a los 6 proveedores dinámicos (Groq, OpenRouter, Zenmux, Ollama,
   Ai&, Kilo): refrescar los arrays `*_FALLBACK` y la detección de `free` en
   `fetchModels()`. Añadido en v3.58.0 junto con Kilo.

Fuera de roadmap: vigilar si aparece parche para la vuln `xlsx` (GHSA-4r6h-8v6p-xvw6
+ GHSA-5pgg-2g8v-p4x9, *No fix available*, mitigada en v3.36.1).

---

## ⚠️ Vulnerabilidades conocidas

### `xlsx` (SheetJS CE) — Prototype Pollution + ReDoS — MITIGADO v3.36.1 (#62)

`xlsx@^0.18.5` tiene **Prototype Pollution** (GHSA-xvch-5gv4-9q4h) y **ReDoS** (GHSA-93q8-gq69-qvxp) sin fix en npm (paquete descontinuado). Riesgo solo al leer archivos Excel/CSV maliciosos.

**Mitigaciones aplicadas (v3.36.1):**
1. Límite de **10 MB** en `spreadsheetReader.ts` antes de parsear.
2. Validación básica de cabecera post-parseo.
3. Aviso UI en `FileAttachButton`/`DocumentFlowModal`.
4. Rate limiting en el catch-all SPA route del servidor.
5. CI workflow con `permissions: contents: read`.
6. Documentación en `docs/SEGURIDAD.md` y `README.md`.
7. **NO migrar a `exceljs`** (+4 MB bundle) — evaluado y descartado.

---

## 📝 Nota de numeración

Los IDs `#1`–`#58` corresponden a **issues reales del repositorio GitHub** y se conservan para trazabilidad. Los huecos son intencionados:
- `#3`–`#11`: IDs reservados de issues iniciales archivados/sustituidos antes de la apertura del roadmap público; no se reutilizan.
- `#16` se fusionó en #42; `#29` en #40; `#30`, `#31`, `#43`, `#47` se descartaron o fusionaron en revisiones.
- `#33` y `#35`: descartados en v3.22.3 (sugerir revisores, auto-labels).
- `#54`: ID reservado, sin ítem asociado (no usar).
- `#59` en adelante: mejoras que no tuvieron issue propio, numeradas consecutivamente a partir de v3.33.2.
