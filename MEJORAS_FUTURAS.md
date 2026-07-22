# 🔮 Roadmap de Mejoras — Análisis del Código

Estado del código, mejoras realizadas y pendientes del proyecto.

**Actualizado a:** v3.50.5 · Julio 2026

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

---

## ⏳ Pendientes

Ordenadas por prioridad. Cada ítem se mueve a la tabla ✅ al resolverse.

### 🔴 Alta Prioridad

| # | Punto | Esfuerzo | Estado |
|---|-------|----------|--------|
| 26 | Mantener y expandir cobertura de tests con Codecov | Continuo (2-4h/sprint) | 🔄 En progreso |

#### #26 — Mantener y expandir cobertura de tests con Codecov
**Esfuerzo:** Continuo (2-4h por sprint)

**Progreso realizado (v3.50.4):** ✅ Infraestructura completa
- ✅ Vitest + Codecov + CI con GitHub Actions (cliente + servidor)
- ✅ Badge de Codecov en README
- ✅ Cobertura actual: ver Codecov (histórico ~60–64%)
- ✅ **665 tests en el cliente (57 suites) + 44 en el servidor (5 suites)** = **709 totales, 62 suites**. Cobertura amplia de contextos, services, utils, hooks y componentes.

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

## 📊 Resumen

| Prioridad | ✅ Resueltos | ⏳ Pendientes |
|---|---|---|
| 🔴 Alta | #1, #2, #13, #14, #15, #27, #28, #45, #62, #63 | #26 (en progreso, continuo) |
| 🟡 Media | #12, #17, #18, #19, #20, #21, #22, #32, #34, #37, #38, #39, #40, #41, #42, #44, #46, #48, #49, #50, #51, #55, #56, #57, #59, #60, #61, #64 | — |
| 🟢 Baja | #23, #24, #25, #52, #53, #58 | — |
| 🗑️ Descartados | — | #33, #35 (descartados en v3.22.3), #36 (descartado en v3.41.0) |

> **Cómputo:** 49 ítems resueltos + 1 pendiente + 3 descartados = 53 referencias (algunos issues como `#28`, `#57`, `#58` generan varias filas por sus fases). Los pendientes reales accionables son: **#26** (continuo, cobertura). **#58 cerrado completo en v3.54.0** (bulk v3.53.0, diff incremental v3.52.0/.1/.2, modo revisión v3.54.0). **#53 resuelto en v3.50.0** (sugerencia de commit semántico vía `commitSuggester.ts` + few-shot con commits recientes + fallback determinista; documentado en el roadmap en v3.50.3). **#25 cerrado completo en v3.41.0** (logs v3.39.0 + healthcheck v3.40.0 + deploy.sh v3.41.0). **#52 resuelto en v3.42.0** (Modo Auditoría de Seguridad: botón 🛡️ + plantilla + `runSecurityAudit` + prompt dedicado, lectura-only). **#36 descartado en v3.41.0** (rompe zero-storage, costo alto, beneficio marginal en single-user).

> **#28** cubierto en su norte por las Fases 1 (v3.0.0, adjuntar como contexto) y 2 (v3.1.0, documentar→publicar). Más formatos: Fase 3a (v3.2.0, Excel/CSV), Fase 3b MVP (v3.3.0, Power BI .pbix/.pbit) y Fase 3b-bis (v3.4.0, Power Query M del `DataMashup`). Única limitación restante: en un `.pbix` moderno el M va en el modelo binario (no legible) → exporta `.pbit`. Word `.docx` (v3.11.0): texto de `word/document.xml`. Imágenes/visión: descartada.

---

## 🎯 Próximo enfoque (post-v3.50.5)

Con #53 cerrado (docs), el roadmap queda con dos únicos pendientes accionables:

1. **#26 — Cobertura de tests (🔴 Alta, continuo).** Tras v3.50.5 el proyecto
   suma **709 tests** (cliente 665 en 57 suites + servidor 44 en 5). Con
   `DiffViewer` ya cubierto, quedan: edge cases de servicios existentes, y
   configurar un **umbral mínimo de cobertura en CI** (fail si < 70%). `App.tsx`
   y `main.tsx` se dejan fuera (bajo valor, opcional).
2. **#58 — Extensiones de publicación flexible (🟢 Baja, fuera de alcance
   inmediato).** Bulk de varios archivos, edición incremental con diff contra
   doc existente, y modo "revisión de doc existente" (la IA sugiere, el usuario
   confirma uno a uno).

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
