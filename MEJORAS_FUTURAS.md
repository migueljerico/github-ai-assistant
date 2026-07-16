# 🔮 Roadmap de Mejoras — Análisis del Código

Estado del código, mejoras pendientes y roadmap del proyecto.

**Actualizado a:** v3.38.0 · Julio 2026

---

## ✅ Implementado (Resuelto)

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
| 57 fix | Crash al documentar con multi-archivo: DocumentFlowModal recibía solo fileContext[0] y perdía el resto, causando pantalla de ErrorBoundary. Ahora recibe allAttachedFiles, muestra primary/extras en Paso 2, auto-puebla extras en Paso 4 y fusiona no-principales en crear+documentar | components/confirm/DocumentFlowModal.tsx, App.tsx, ChatInput.tsx (lint), tests | v3.30.0 |
| 57 fix bis | Crash `TypeError: S.trim is not a function` al pulsar "Documentar": DocumentRepoButton pasaba el MouseEvent como `initialRepo` (regresión de la Tanda B). Fix: wrapper `onClick={() => onOpen()}` + saneado `initialRepo` a string en DocumentFlowModal | components/chat/DocumentRepoButton.tsx, components/confirm/DocumentFlowModal.tsx, tests | v3.30.2 |
| 57 fix tris | Error "La IA no devolvió JSON válido" al documentar (repos creados vacíos): el límite de salida de 4096 tokens truncaba el README+MANUAL a medias. Fix: `maxTokens` param en `callAI` + `generateRepoDocs(8192)` + proxy lee `maxOutputTokens`. Además: firma de documentación con IA real (about del repo + commit messages + PR bodies + footer del README), about automático vía `updateRepo` (PATCH `/repos/`), botón "Actualizar documentación" siempre visible, banner verde afirmativo para repos ya documentados | services/gemini.ts, server/index.js, services/assistantActions.ts, services/docPublisher.ts, services/github.ts, services/providers.ts, components/chat/ChatInput.tsx, components/confirm/DocumentFlowModal.tsx, i18n/{es,en}.ts | v3.31.0 |
| — | **OpenCode Zen y Cloudflare Workers AI: fix CORS + catálogo estático** | providers.ts (openzen/cloudflare: proxy /api/openzen y /api/cloudflare, catálogos estáticos), server/index.js (proxies + rate limiters), gemini.ts (accountId header), i18n/es/en.ts, providers.test.ts | v3.33.2 |
| — | **Cloudflare 400 fix: proxy lee X-Account-Id del header** | server/index.js (proxy /api/cloudflare: accountId desde header, no body) | v3.33.3 |
| — | **Cloud Run startup fix: eliminar type assertion TS en server/index.js** | server/index.js (eliminado `as string | undefined` en lectura de header) | v3.33.5 |
| — | **Cloudflare: saneo de headers + rate limit + modelos ampliados** | server/index.js (proxy /api/cloudflare: headers saneados, rate limit 100/min), providers.ts (CLOUDFLARE_FALLBACK: 8 modelos), i18n | v3.33.7 |
| — | **Ollama Cloud (nuevo proveedor) + 11 modelos free verificados + retry 429 + Cloudflare fix headers + error accionable 403/429** | providers.ts (OLLAMA_FALLBACK 11 modelos), retry.ts (429 + pattern), server/index.js (strip content-encoding), gemini.ts (error Cloudflare), i18n ES/EN | v3.34.0 |
| 58 | **Fase 1-3: Publicación flexible de documentación (sin paths hardcodeados)** — Selector de tipo de documentación en `DocumentFlowModal`: Repo completo (README+MANUAL) / Archivo único (docs/{base}.md) / Documento específico del repo (path elegido por usuario de lista editable: MEJORAS_FUTURAS.md, CHANGELOG.md, docs/*.md, custom). `docPublisher.ts` generalizado a array de targets `{ path, content, message }`; `publishFileDoc` generalizado a `publishDocAt(path, content)`. Validación de permisos de escritura (HEAD `/repos/{owner}/{repo}/contents/{path}`). | components/confirm/DocumentFlowModal.tsx, services/docPublisher.ts, services/assistantActions.ts (runGenerateSpecificDoc, runPublishSpecificDoc), services/github.ts | v3.35.0 |
| 58 | **Fase 4: Instrucciones adicionales (selectividad)** — Campo de texto opcional "Instrucciones adicionales" en el flujo de documento específico se propaga hasta el generador. En `App.tsx`, `flowGenerateSpecific` reenvía `extraInstructions` como `conversation` a `runGenerateSpecificDoc`; `generateSpecificDoc` lo incluye como `CONTEXTO ADICIONAL` en el prompt del LLM. | components/confirm/DocumentFlowModal.tsx, App.tsx, services/gemini.ts, services/assistantActions.ts | v3.35.0 |
| 58 | **Fase 5: Crear repo + documentar archivo específico** — Flujo unificado para crear un repo inexistente y documentar un archivo específico del repo en un solo paso (reusa callbacks Fase 2/3/4). | components/confirm/DocumentFlowModal.tsx, services/assistantActions.ts | v3.35.0 |
| 58 | **Fase 6: Persistencia avanzada** — Hook `useDocTargetSelector.ts` que persiste en `localStorage` (clave `doc_target_selector`) el `scope`, `repoInput`, `targetPath` y `extraInstructions` del último flujo "documento específico del repo". Al reabrir `DocumentFlowModal`, el usuario recupera su contexto previo. 11 tests unitarios. | client/src/hooks/useDocTargetSelector.ts, client/src/hooks/__tests__/useDocTargetSelector.test.ts, components/confirm/DocumentFlowModal.tsx, client/src/test/setup.ts | v3.36.0 |
| — | **Mitigación vulnerabilidades `xlsx` (SheetJS)** — Límite 10 MB en `spreadsheetReader.ts` antes de parsear + validación básica cabecera post-parseo. Aviso UI en FileAttachButton/DocumentFlowModal. Rate limiting en catch-all SPA route. CI workflow `permissions: contents: read`. | client/src/utils/spreadsheetReader.ts, client/src/components/chat/FileAttachButton.tsx, server/index.js, .github/workflows/ci.yml, docs/SEGURIDAD.md, README.md | v3.36.1 |
| — | **Nuevo proveedor Ai& (`api.aiand.com`)** — OpenAI-compatible directo del navegador (sin proxy). Catálogo dinámico con detección free por `input_per_1m`/`output_per_1m` a 0 + fallback sin pricing. `defaultModel: qwen/qwen3.6-27b`. i18n ES/EN. | client/src/services/providers.ts, client/src/i18n/{es,en}.ts | v3.38.0 |
| — | **`effectiveMaxTokens` por proveedor** — campo `maxOutputTokens` en `ProviderDef`; `callAI` resuelve `maxTokens ?? provider.maxOutputTokens ?? 4096` para ambos transportes. Ai& → 8192 (evita respuestas vacías en modelos de razonamiento). | client/src/services/{providers,gemini}.ts | v3.38.0 |
| — | **Renombrado del nombre visible (ES/EN)** — "Asistente de IA para Publicar Repositorios" → "Asistente de IA de GitHub" / "AI Assistant for Publishing Repositories" → "GitHub AI Assistant" (4 claves i18n × idioma, title, description, banner server, cabeceras css/Dockerfile). | client/src/i18n/{es,en}.ts, client/index.html, package.json, server/index.js, client/src/index.css, Dockerfile | v3.38.0 |

---

## 🗺️ Hoja de ruta por sprints (acuerdo vigente · post-v3.11.0)

Secuencia acordada con el autor para abordar lo pendiente. Es **independiente de la sesión o herramienta**: si el trabajo continúa en otro entorno, este es el orden de referencia.

- **🥇 Sprint 1 — Robustez y pulido del núcleo (quick wins) — ✅ COMPLETADO (v3.11.1–v3.14.0):**
  **#20** (documentación sin cortar funciones, truncado por líneas) ✅ · **#23** (prompts a archivos `.md`) ✅ · **#40 parcial** (botón **Detener** + recordar proveedor/modelo) ✅ · **#34** (changelog automático de releases) ✅.
- **🥈 Sprint 2 — Calidad de IA / contexto — ✅ COMPLETADO (v3.15.0–v3.16.0):** **#49** (seleccionar archivos relevantes del repo antes de llamar al LLM) ✅ **(v3.15.0)** · resto de **#40** (reintentos en `ghFetch` + validación estricta de la acción — sin `zod`) ✅ **(v3.16.0)**.
- **🥉 Sprint 3 — UI robusta + escaparate de datos — ✅ COMPLETADO (v3.17.0–v3.18.0):** **#39** (ErrorBoundary + a11y) ✅ **(v3.17.0)** · **#44** (dashboard "Salud del Código" con Recharts — pieza de escaparate Análisis de Datos) ✅ **(v3.18.0)**.
- **🏅 Sprint 4 — Alcance e i18n — ✅ COMPLETADO (v3.19.0–v3.22.0):** **#46** (export/import de conversación) ✅ **(v3.19.0)** · **#24 Fase 1** (i18n ligera sin dependencias: `LanguageContext` + `t()` + ES/EN; selector 🌐; login, cabecera, `AIProviderPanel`, `ChatInput` y sus 7 botones traducidos) ✅ **(v3.20.0)** · **#24 Fase 2** (modales + DiffViewer + mensajes visibles del chat vía `t()` inyectada en `ChatDeps`) ✅ **(v3.21.0)** · **#24 Fase 3** (chat central + historial + plantillas de autocompletado + **respuestas de la IA en el idioma activo** vía `lang` cableado a los system prompts) ✅ **(v3.22.0)**.
- **📋 Backlog:** #25 (logs/health), #22 (aviso de sesión), #48 (sync repo), **#36** (GitHub App — hito grande aparte). #26 (cobertura) es transversal: sube con cada sprint.
- **🗑️ Descartados (v3.22.3, dogfooding Tencent HY3):** **#33** (sugerir revisores) y **#35** (auto-labels) — nicho/fuera del núcleo; eran "candidatos a poda" desde hacía versiones.

> **Cómo se prioriza (criterios):** un ítem pasa de **backlog → sprint** por su **valor para el usuario** y su **encaje con la misión** (asistente NL para no técnicos, *propón→confirma→ejecuta*), no por su complejidad. Los **candidatos a poda** no son un descarte definitivo: se revisan si surge demanda real. Las **propuestas externas** (otras IAs) se filtran con **validación cruzada** — se incorpora lo accionable, se reformula lo dudoso y **se descartan los elogios** (ver § dogfooding del README).

> **⚠️ Nota durable sobre revisiones externas (no es un sprint).** El backend de **un solo `server/index.js`** (thin: OAuth + proxy Gemini + estático, ~244 líneas) y los módulos de cliente cohesivos de ~700 líneas (`gemini.ts`, `assistantActions.ts`, `github.ts`) son **decisiones de arquitectura intencionadas, NO deuda técnica**. Las revisiones de IA externas (DeepSeek y similares) **sobreponderan** este punto y **reinciden** en proponer partir el `index.js` / cambiar la infraestructura, sin entender el objetivo del proyecto. **No se actúa sobre ello sin aprobación explícita del autor.** Lo único a modularizar, si acaso, es sacar los **prompts** de `gemini.ts` a archivos (#23) — **no** tocar el backend. Ver la convención rectora en `CLAUDE.md §5`.

---

## ⏳ Pendientes

Los issues están numerados y ordenados por prioridad descendente dentro de cada bloque. Al resolver un punto, moverlo a la tabla ✅ con versión y SHA de commit.

### 🔴 Alta Prioridad

| # | Punto | Esfuerzo | Estado |
|---|-------|----------|--------|
| 26 | Mantener y expandir cobertura de tests con Codecov | Continuo (2-4h/sprint) | 🔄 En progreso |
| — | **Mitigación vulnerabilidades `xlsx` (SheetJS)** — Límite 10 MB, validación post-parseo, aviso UI, documentar en SEGURIDAD.md/README.md. **NO migrar a `exceljs`** (+4 MB bundle) | 2–3h | 🔴 **Pendiente v3.36.1** |
| — | Revisar CI workflow: añadir `permissions: contents: read` (requiere token con scope `workflow`) | 1h | 🔴 **Pendiente v3.36.1** |

### 🟡 Media Prioridad

#### #26 — Mantener y expandir cobertura de tests con Codecov
**Esfuerzo:** Continuo (2-4h por sprint)

**Estado actual (v3.36.0):** ✅ Infraestructura completa implementada

**Progreso realizado:**
- ✅ Configuración de Vitest + Codecov
- ✅ CI con GitHub Actions ejecutando tests (cliente + servidor) automáticamente
- ✅ Badge de Codecov en README
- ✅ Cobertura actual: ver Codecov (oscila según versión; histórico ~60–64%)
- ✅ **556 tests en el cliente** (v3.36.0; 48 archivos `.test.ts(x)` co-locados). Implementados para:
  - `AuthContext.tsx` (login, logout, OAuth flow, Zero-Storage)
  - `AIProviderContext.tsx` (conexión/desconexión de proveedores)
  - `providers.ts` (registro de proveedores, detección de modelos 🆓, caché, `pickDefaultModel`)
  - `actionExecutor.ts` (ejecutor de acciones GitHub)
  - `github.ts` (wrapper de GitHub API, decodeBase64, encodeBase64, getRepo, getBranchSha)
  - `gemini.ts` (parseGeminiAction, detectPrimaryLanguage, temperatura por modo, contexto de repo #41, enrutado OpenRouter, reintento transitorio `withTransientRetry`/`isTransientAIError`)
  - `docPublisher.ts` (commit directo / Draft PR — #45; `publishFileDoc` de fichero suelto — #28 Fase 2)
  - `gemini.ts` `generateFileDoc` + `assistantActions.ts` `runGenerateFileDoc`/`runPublishFileDoc`/`runCreateFileRelease` + `FilePublishModal.tsx` (documentar y publicar archivos — #28 Fase 2)
  - `threadSummary.ts` (resumen de hilos #32: `parseThreadInput`, issue vs PR, hilo vacío) + wrappers de comentarios en `github.ts` (paginación)
  - `assistantActions.ts` (#42: orquestación del chat — `runSend`, `runConfirmAction`, `runCancelAction` y los flujos de botón, incl. `runAttachFile` por formato; ~98%) + `repoRef.ts` (`resolveRepoRef`)
  - `modeDetection.ts` (chat vs action; sesgo a chat con contexto de repo/archivo)
  - `formatResult.ts`, `releaseGenerator.ts`, `releaseAssets.ts`, `pdfReader.ts`, `pdfAdvanced.ts`, `spreadsheetReader.ts` (#28 Fase 3a), `powerbiReader.ts` (#28 Fase 3b/3b-bis), `docxReader.ts` (#28 Word .docx)
  - Hooks: `useChat`, `useActions`, `useDocTargetSelector` (11 tests)
  - Componentes React: `ChatArea`, `ChatInput`, `ChatMessage`, `ConfirmModal`, `DocModal`, `FilePublishModal`, `PublishActions` (barra de publicación compartida, v3.10.0), `FileAttachButton`, `Header`, `TemplatePanel`, `AIProviderPanel`, `AIProviderBadge`, `RepoContextButton`, `ThreadSummaryButton`
  - Servidor: `rateLimit.test.js`

**Pendiente:**
- Aumentar cobertura del ~64% al 70% objetivo
- Añadir tests para módulos no cubiertos:
  - `App.tsx` (~0%): tras #42 ya es solo JSX + wrappers finos (la lógica vive testeada en `assistantActions.ts`). Llevarlo a verde requiere un **test de integración que renderice `App`** (mockeando los 3 contextos y los hijos) — bajo valor, opcional.
  - `HistoryContext.tsx`
  - `RepoSelector`
  - `DiffViewer`
  - Edge cases y errores en servicios existentes
- Configurar umbral mínimo de cobertura en CI (fail si < 70%)

**Beneficio:** Mayor confianza en cambios futuros; detección temprana de regresiones; documentación viva del comportamiento esperado.

**Nota:** Esta mejora es transversal — cada vez que se resuelva otra mejora (#20, #28, #42, etc.), se deben añadir tests correspondientes.

---

#### #22 — SessionWarningBanner — Advertencia de caducidad de sesión
**Esfuerzo:** 3h

**Problema actual:** El usuario no recibe advertencia cuando su token de GitHub o clave de IA llevan muchas horas activas.

**Solución propuesta:** Nuevo componente `SessionWarningBanner.tsx` que muestra banner amber si las credenciales llevan >8h activas. Revisión cada 60s.

**Dependencia:** Requiere Zero-Storage real (#13) para funcionar correctamente. ✅ Ya implementado.

**Beneficio:** Mejor UX; seguridad proactiva.

---

#### #36 — Migrar a GitHub App para permisos granulares
**Esfuerzo:** 6–8h (cambio de arquitectura de auth)

**Problema actual:** La app usa una **OAuth App** con scope `repo` (acceso total a todos los repos), excesivo si solo se usan funciones de lectura.

**Solución propuesta:** Los permisos finos por recurso (repos concretos, lectura vs escritura) **no son viables con la OAuth App actual** — requieren migrar a una **GitHub App** con *fine-grained permissions* y selección de repositorios por instalación. Implica rehacer el flujo OAuth del servidor (`server/index.js`) y el manejo de tokens de instalación.

**Beneficio:** Principio de mínimo privilegio real; el usuario elige a qué repos da acceso; mayor confianza.

**Nota:** caveat de viabilidad — no es un ajuste de scopes, es un cambio de tipo de aplicación en GitHub. Por eso sube de esfuerzo y de complejidad.

---

#### #48 — Revisión bajo demanda de cambios recientes ("Sync Repo Status") — **COMPLETADO v3.37.0**
**Esfuerzo:** 3–4h ✅

**Problema resuelto:** Una revisión proactiva con webhooks no es fiable porque Cloud Run escala a cero (los webhooks en frío pueden fallar).

**Solución implementada:** Botón **"Sync Repo Status"** en la UI (icono 🔄). Al pulsarlo, el frontend pide los últimos commits y diffs (wrappers `listRecentCommits`/`getCommit` en `github.ts`), y la IA los analiza en el momento para sugerir mejoras o detectar errores. Modelo **pull** (bajo demanda), no webhooks.

**Implementación:**
- `github.ts`: `listRecentCommits` + `getCommit` (con diffs/files).
- `assistantActions.ts`: `runSyncRepoStatus()` — orquestación pull-based + llamada a IA.
- `ChatInput`: `SyncRepoStatusButton` (icono 🔄, prompt "owner/repo").
- i18n ES/EN: `syncRepo.title/tooltip/prompt/noCommits`.
- Tests: 4 tests (`runSyncRepoStatus` éxito, sin commits, error, opciones).

---

### 🟢 Baja Prioridad

#### #25 — Mejorar DX y pipeline de despliegue
**Esfuerzo:** 2–3h

**Tareas:**
- ✅ GitHub Actions CI — lint + tests (cliente + servidor) con cobertura en cada push/PR a main (badge en README) — *implementado en v2.4.0*
- ✅ Despliegue continuo (CD) — activador de Cloud Build que construye y despliega `main` a Cloud Run en cada push (Build → Push → Deploy) — *ya operativo*
- ⏳ Logs estructurados en el servidor (JSON con timestamp, level, requestId)
- ⏳ Healthcheck extendido en `/health` (versión, uptime, estado de variables de entorno)
- ⏳ Script `deploy.sh` automatizado para Cloud Run con validación previa de variables (alternativa al deploy manual; el flujo habitual ya es automático vía Cloud Build)

---

#### #52 — Modo Auditoría de Seguridad (flujo/template)
**Esfuerzo:** 3–4h
**Origen:** sugerencia de **Gemma 4 31B** (OpenRouter), **dogfooding**.

**Problema actual:** la app gestiona y documenta repos, pero no ayuda a **asegurarlos**.

**Solución propuesta:** un botón/plantilla con un prompt especializado que, sobre el repo cargado como contexto, revise: **secrets expuestos** (claves/tokens en el código), **dependencias obsoletas** y **falta de validación de inputs**. Encaja con `utils/instructionSuggestions.ts` (plantillas de instrucción).

**Beneficio:** pasar de "gestionar el repo" a "asegurar el repo"; muy vendible en un portfolio.

**Caveat:** es una ayuda **orientativa vía LLM**, no una garantía de seguridad ni un escáner formal (no sustituye a herramientas como `gitleaks`/Dependabot). Comunicarlo con honestidad en la UI.

---

#### #53 — Sugerir mensaje de commit semántico (a validar encaje)
**Esfuerzo:** 2–3h
**Origen:** sugerencia de **Gemma 4 31B** (OpenRouter), **reformulada**, **dogfooding**.

**Problema actual:** el usuario no técnico no siempre escribe buenos mensajes de commit (Conventional Commits), lo que luego afecta al changelog automático (#34).

**Caveat de encaje:** la app **no tiene working tree/staging local** (opera la GitHub API, no es un cliente git con "cambios pendientes"), así que la idea original de "analizar el diff pendiente" no aplica tal cual.

**Solución propuesta (reformulada):** sugerir el mensaje **en el momento de subir/crear un archivo** (proponer un `feat:`/`docs:`… en el `ConfirmModal` a partir de la acción y el contenido), o a partir de **commits recientes** (reutiliza `compareCommits` de #34). **Pendiente de validar** que aporte valor real dado el modelo de la app.

**Beneficio:** mantener el repo limpio y un historial que alimente bien el changelog.

---

#### #58 — Extensiones futuras de publicación flexible (fuera de alcance inmediato)
- Publicación bulk de varios archivos
- Edición incremental (diff contra doc existente en vez de reescribir)
- Modo "revisión de doc existente" (la IA sugiere cambios, el usuario los confirma uno a uno)

---

## 📊 Resumen

| Prioridad | Total | ✅ Resueltos | ⏳ Pendientes |
|---|---|---|---|
| 🔴 Alta | 10 | 8 (#1, #2, #13, #14, #27, #45, #15, #28) | 2 (#26 continuo, xlsx vulns) |
| 🟡 Media | 17 | 16 (#12, #17, #18, #19, #21, #37, #41, #32, #42, #38, #20, #49, #39, #44, #50, #51) | 1 (#26 expandir) + 2 (#22, #36) |  #48 ✅ |
| 🟢 Baja | 18 | 9 (#23, #24, #34, #40, #46, #55, #56, #57, #54) | 7 (#22, #25, #36, #48, #52, #53, #58) |
| **🗑️ Descartados** | — | — | 2 (#33, #35) descartados en v3.22.3 |
| **TOTAL** | **43** | **33** + 2 descartados | **8** |

> **#28** cubierto en su **norte** por las Fases 1 (v3.0.0, adjuntar como contexto) y 2 (v3.1.0, documentar→publicar). **Más formatos:** Fase 3a (v3.2.0, Excel/CSV) y Fase 3b MVP (v3.3.0, Power BI .pbix/.pbit) y **Fase 3b-bis** (v3.4.0 + robustez v3.4.2: Power Query M del `DataMashup` binario/XML **y** de las particiones del `DataModelSchema` de `.pbit`). Única limitación restante: en un `.pbix` moderno el M va en el modelo binario (no legible) → exporta `.pbit`. **Word `.docx`** (v3.11.0): texto de `word/document.xml`. Imágenes/visión: descartada.

> **Nota de numeración:** los huecos en #16, #29, #30, #31, #43 y #47 son intencionados — esos ítems se fusionaron o descartaron en revisiones del roadmap y sus números no se reutilizan (convención del documento). #16 se fusionó en #42; #29 en #40.

---

## 🎯 Enfoque actual (v3.38.0)

1. Verificar Ai& en producción (CORS confirmado, catálogo dinámico y detección free por pricing).
2. Reconciliar las listas de proveedores incompletas en `docs/COMPARATIVA_COPILOT.md` y `docs/ARQUITECTURA.md` (tabla transporte) — desfasadas desde antes de v3.38.0 (no incluyen OpenCode Zen/Cloudflare/Ollama/Ai&).
3. **Mitigación vulnerabilidades `xlsx` (SheetJS)** — límite 10 MB en `spreadsheetReader.ts`, validación básica post-parseo, aviso en UI (FileAttachButton / DocumentFlowModal), documentar en `docs/SEGURIDAD.md` y `README.md` (sección "Limitaciones conocidas"). **NO migrar a `exceljs`**.
4. **Revisar CI workflow** — añadir `permissions: contents: read` (requiere token con scope `workflow`).

1. **Mitigación vulnerabilidades `xlsx` (SheetJS)** — límite 10 MB en `spreadsheetReader.ts`, validación básica post-parseo, aviso en UI (FileAttachButton / DocumentFlowModal), documentar en `docs/SEGURIDAD.md` y `README.md` (sección "Limitaciones conocidas"). **NO migrar a `exceljs`**.
2. **Revisar CI workflow** — añadir `permissions: contents: read` (requiere token con scope `workflow`).
3. Verificación de Ollama Cloud en producción y cuota Cloudflare reiniciada.
4. Sincronización documental completa a v3.36.1.

---

## 📝 Convenciones

- Al resolver un punto → moverlo a la tabla ✅ con versión y SHA de commit
- Issues pendientes ordenados por prioridad dentro de cada bloque 🔴 / 🟡 / 🟢
- Crear commit: `docs: mark issue #X as resolved in vX.Y`
- Cada mejora debe incluir tests correspondientes (ver #26)

---

## ⚠️ Vulnerabilidades conocidas (v3.36.0 → resueltas en v3.36.1)

### `xlsx` (SheetJS Community Edition) — Prototype Pollution + ReDoS — **MITIGADO v3.36.1**
- **Dependencia:** `xlsx@^0.18.5` (usado en `spreadsheetReader.ts` para Fase 3a Excel/CSV)
- **CVEs:** GHSA-xvch-5gv4-9q4h (Prototype Pollution), GHSA-93q8-gq69-qvxp (ReDoS)
- **Estado:** Sin fix en npm — el paquete está descontinuado. Versión 0.20.2 disponible solo en CDN (https://cdn.sheetjs.com/), no en npm.
- **Riesgo:** Solo al **leer archivos Excel/CSV maliciosos** adjuntados por el usuario (ataque de archivo). El flujo de escritura/exportación no se ve afectado.
- **Mitigación aplicada (v3.36.1):**
  1. Límite de tamaño de archivo (10 MB) antes de parsear en `spreadsheetReader.ts`.
  2. Validación básica de estructura (cabeceras esperadas) tras parseo.
  3. Aviso en UI (FileAttachButton / DocumentFlowModal): "Solo suba archivos de fuentes confiables. No se analizan archivos maliciosos. Límite: 10 MB."
  4. Rate limiting en ruta catch-all SPA (`server/index.js`) para prevenir DoS.
  5. CI workflow con `permissions: contents: read` para CodeQL compliance.
  6. **NO migrar a `exceljs`** — añade ~4 MB al bundle (chunk propio), inaceptable para la arquitectura de chunks lazy actuales.
  7. Documentado en `docs/SEGURIDAD.md` y `README.md` (sección "Limitaciones conocidas").