# 🔮 Roadmap de Mejoras — Análisis del Código

Estado del código, mejoras pendientes y roadmap del proyecto.

**Actualizado a:** v3.31.0 · Julio 2026

---

## ✅ Resueltos

| # | Punto | Archivo | Versión |
|---|---|---|---|
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
| 28 | Subida de archivos locales — **Fase 1**: adjuntar PDF/texto/código como contexto del chat | utils/pdfReader.ts, utils/pdfAdvanced.ts (pdfjs-dist), services/assistantActions.ts (runAttachFile), FileAttachButton.tsx | v3.0.0 |
| 28 | Archivos locales — **Fase 2**: documentar el archivo y publicarlo (commit / Draft PR / GitHub Release) | services/gemini.ts (generateFileDoc), services/docPublisher.ts (publishFileDoc), services/assistantActions.ts, components/confirm/FilePublishModal.tsx | v3.1.0 |
| 28 | Archivos locales — **Fase 3a**: hojas de cálculo Excel/CSV (muestra de filas + aviso de tokens) | utils/spreadsheetReader.ts (SheetJS/xlsx), utils/pdfReader.ts, services/assistantActions.ts (runAttachFile) | v3.2.0 |
| 28 | Archivos locales — **Fase 3b (MVP)**: Power BI .pbix/.pbit (informe = páginas/visuales; modelo/DAX de .pbit) | utils/powerbiReader.ts (fflate), utils/pdfReader.ts, services/assistantActions.ts (runAttachFile) | v3.3.0 |
| 28 | Archivos locales — **Fase 3b-bis**: Power Query (M) del `DataMashup` (nombres de consulta + código M; orígenes/transformaciones, rescata el .pbix) | utils/powerbiReader.ts (extractMashup, fflate) | v3.4.0 |
| 28 | Archivos locales — **Fase 4a**: subir el archivo fuente al publicar (binario en commit/Draft PR o asset de Release) + doc sin inventar autor/año | services/github.ts (createOrUpdateBinaryFile), docPublisher.ts, releaseAssets.ts, gemini.ts | v3.6.0 |
| 28 | Archivos locales — **Fase 4b**: subir archivos extra al publicar (imágenes→screenshots/, datos→data/, resto→raíz; commit/Draft PR o assets de Release) | docPublisher.ts (uploadPathFor), assistantActions.ts, FilePublishModal.tsx | v3.9.0 |
| 28 | Archivos locales — **documentos Word (.docx)**: ZIP OOXML; se extrae el texto de `word/document.xml` (párrafos, listas y tablas) vía fflate, con muestra acotada | utils/docxReader.ts (readDocx, docxXmlToText), utils/pdfReader.ts, services/assistantActions.ts (runAttachFile) | v3.11.0 |
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
| 24 | Internacionalización (i18n) ligera sin dependencias — Fase 1: `LanguageContext` + `t()` + ES/EN; selector 🌐; login, cabecera, `AIProviderPanel`, `ChatInput`, botones y paneles laterales | context/LanguageContext.tsx, i18n/{es,en}.ts, components/layout/LanguageSelector.tsx, Header.tsx, AIProviderPanel.tsx, ChatInput.tsx | v3.20.0 |
| 24 | Internacionalización — Fase 2: modales + `DiffViewer` + mensajes visibles del chat (`t()` inyectada en `ChatDeps`); refactor del `labelMap` por `labelKey`; fix de clave inexistente y 3 tests rotos | components/confirm/{ConfirmModal,DocModal,FilePublishModal,PublishActions,DiffViewer}.tsx, services/assistantActions.ts (ChatDeps.t), App.tsx, i18n/{es,en}.ts | v3.21.0 |
| 55 | Plantillas del panel lateral hardcodeadas en español — i18n con `buildTemplateCategories(t)` + ~36 claves `tmpl_panel.*` | components/templates/templateData.ts (factoría), i18n/{es,en}.ts, components/templates/TemplatePanel.tsx | v3.25.0 |
| 56 | Descripciones del historial de acciones de solo lectura emitidas en español — i18n con `history.exec.*` + `t` opcional en el executor | client/src/services/actionExecutor.ts, client/src/services/assistantActions.ts, i18n/{es,en}.ts | v3.26.0 |
| 50 | Presupuesto de contexto adaptativo (TPM bajo) + reintento con menos contexto + fix del mensaje duplicado | services/providers.ts (contextBudget), services/assistantActions.ts (getActiveContextBudget, reintento TPM), services/gemini.ts (error diferenciado), utils/retry.ts (isContextTooLargeError) | v3.28.0 |
| 51 | "Archivos consultados para esta respuesta" (transparencia del contextRanker) | types/index.ts (consultedFiles), services/assistantActions.ts (propagación), components/chat/ChatMessage.tsx (bloque plegable), i18n/{es,en}.ts | v3.28.0 |
| 57 fix | Crash al documentar con multi-archivo: DocumentFlowModal recibía solo fileContext[0] y perdía el resto, causando pantalla de ErrorBoundary. Ahora recibe allAttachedFiles, muestra primary/extras en Paso 2, auto-puebla extras en Paso 4 y fusiona no-principales en crear+documentar | components/confirm/DocumentFlowModal.tsx, App.tsx, ChatInput.tsx (lint), tests | v3.30.0 |
| 57 fix bis | Crash `TypeError: S.trim is not a function` al pulsar "Documentar": DocumentRepoButton pasaba el MouseEvent como `initialRepo` (regresión Tanda B). Fix: wrapper `onClick={() => onOpen()}` + saneado `initialRepo` a string en DocumentFlowModal | components/chat/DocumentRepoButton.tsx, components/confirm/DocumentFlowModal.tsx, tests | v3.30.2 |
| 57 fix tris | Error "La IA no devolvió JSON válido" al documentar (repos creados vacíos): el límite de salida de 4096 tokens truncaba el README+MANUAL a medias. Fix: `maxTokens` param en `callAI` + `generateRepoDocs(8192)` + proxy lee `maxOutputTokens`. Además: firma de documentación con IA real (about + commits + PR + footer README), about automático (`updateRepo` PATCH), botón "Actualizar" siempre visible, banner verde para repos ya documentados | services/gemini.ts, server/index.js, services/assistantActions.ts, services/docPublisher.ts, services/github.ts, services/providers.ts, components/chat/ChatInput.tsx, components/confirm/DocumentFlowModal.tsx, i18n/{es,en}.ts | v3.31.0 |

---

## 🗺️ Hoja de ruta por sprints (acuerdo vigente · post-v3.11.0)

Secuencia acordada con el autor para abordar lo pendiente. Es **independiente de la sesión o
herramienta**: si el trabajo continúa en otro entorno, este es el orden de referencia.

- **🥇 Sprint 1 — Robustez y pulido del núcleo (quick wins) — ✅ COMPLETADO (v3.11.1–v3.14.0):**
  **#20** (documentación sin cortar funciones, truncado por líneas) ✅ · **#23** (prompts a archivos
  `.md`) ✅ · **#40 parcial** (botón **Detener** + recordar proveedor/modelo) ✅ · **#34** (changelog
  automático de releases) ✅.
- **🥈 Sprint 2 — Calidad de IA / contexto — ✅ COMPLETADO (v3.15.0–v3.16.0):** **#49** (seleccionar
  archivos relevantes del repo antes de llamar al LLM) ✅ **(v3.15.0)** · resto de **#40** (reintentos
  en `ghFetch` + validación estricta de la acción — sin `zod`) ✅ **(v3.16.0)**.
- **🥉 Sprint 3 — UI robusta + escaparate de datos — ✅ COMPLETADO (v3.17.0–v3.18.0):** **#39**
  (ErrorBoundary + a11y) ✅ **(v3.17.0)** · **#44** (dashboard "Salud del Código" con Recharts — pieza de
  escaparate Análisis de Datos) ✅ **(v3.18.0)**.
- **🏅 Sprint 4 — Alcance e i18n — ✅ COMPLETADO (v3.19.0–v3.22.0):** **#46** (export/import de conversación) ✅ **(v3.19.0)** ·
  **#24 Fase 1** (i18n ligera sin dependencias: `LanguageContext` + `t()` + ES/EN; selector 🌐; login,
  cabecera, `AIProviderPanel`, `ChatInput` y sus 7 botones traducidos) ✅ **(v3.20.0)** ·
  **#24 Fase 2** (modales + DiffViewer + mensajes visibles del chat vía `t()` inyectada en `ChatDeps`) ✅ **(v3.21.0)** ·
  **#24 Fase 3** (chat central + historial + plantillas de autocompletado + **respuestas de la IA en el idioma activo** vía `lang` cableado a los system prompts) ✅ **(v3.22.0)**.
- **📋 Backlog:** #25 (logs/health), #22 (aviso de sesión), #48 (sync repo), **#36** (GitHub App —
  hito grande aparte). #26 (cobertura) es transversal: sube con cada sprint.
- **🗑️ Descartados (v3.22.3, dogfooding Tencent HY3):** **#33** (sugerir revisores) y **#35** (auto-labels) — nicho/fuera del núcleo; eran "candidatos a poda" desde hacía versiones.

> **Cómo se prioriza (criterios):** un ítem pasa de **backlog → sprint** por su **valor para el
> usuario** y su **encaje con la misión** (asistente NL para no técnicos, *propón→confirma→ejecuta*),
> no por su complejidad. Los **candidatos a poda** no son un descarte definitivo: se revisan si surge
> demanda real. Las **propuestas externas** (otras IAs) se filtran con **validación cruzada** — se
> incorpora lo accionable, se reformula lo dudoso y se descartan los elogios (ver § dogfooding del README).

> **⚠️ Nota durable sobre revisiones externas (no es un sprint).** El backend de **un solo
> `server/index.js`** (thin: OAuth + proxy Gemini + estático, ~244 líneas) y los módulos de cliente
> cohesivos de ~700 líneas (`gemini.ts`, `assistantActions.ts`, `github.ts`) son **decisiones de
> arquitectura intencionadas, NO deuda técnica**. Las revisiones de IA externas (DeepSeek y
> similares) **sobreponderan** este punto y **reinciden** en proponer partir el `index.js` / cambiar
> la infraestructura, sin entender el objetivo del proyecto. **No se actúa sobre ello sin aprobación
> explícita del autor.** Lo único a modularizar, si acaso, es sacar los prompts de `gemini.ts` a
> archivos (#23). Ver la convención rectora en `CLAUDE.md §5`.

---

## ⏳ Pendientes

Los issues están numerados y ordenados por prioridad descendente dentro de cada bloque. Al resolver un punto, moverlo a la tabla ✅ con versión y SHA de commit.

### 🔴 Alta Prioridad

✅ Sin ítems pendientes — todos resueltos.

> **#28 (subida de archivos) entregado por fases.** **Fase 1** (v3.0.0): adjuntar
> PDF + texto/código como **contexto** del chat (cliente / Zero-Storage; reutiliza
> `pdfReader`/`pdfAdvanced` + el patrón #41) → ya permite *"documéntame este archivo"*
> en lenguaje natural. **Fase 2** (v3.1.0): *documentar→publicar* — generar
> documentación del archivo y publicarla como **commit**, **Draft PR** o **GitHub
> Release** (reutiliza `docPublisher`/`releaseGenerator`). Con esto el **norte de #28
> queda cubierto**: adjuntar cualquier archivo → documentar → publicar.
> **Fase 3a** (v3.2.0): **hojas de cálculo Excel/CSV** (SheetJS) con muestra de
> cabeceras + 100 filas y aviso de tokens. **Visión/imágenes: DESCARTADA**
> (multimodal; tocaría el servidor y depende del modelo).
> **Fase 3b MVP** (v3.3.0): **Power BI `.pbix`/`.pbit`** — un `.pbix` es un ZIP;
> con `fflate` (cliente) se extrae el **informe** (páginas/visuales del
> `Report/Layout`) y, en `.pbit`, el **modelo de datos** (`DataModelSchema`:
> tablas/columnas/**medidas DAX** en JSON). El modelo de un `.pbix` va en binario
> propietario VertiPaq (no legible) → se avisa y se sugiere exportar como `.pbit`.
> **Fase 3b-bis** (v3.4.0): **Power Query (M)** del `DataMashup` (blob binario con un
> ZIP anidado cuyo `Formulas/Section1.m` lleva las consultas) — nombres de consulta
> + código **M** (orígenes/transformaciones), que **rescata el `.pbix`**.
> **Robustez (v3.4.2):** el M se extrae del `DataMashup` (binario **y** la variante
> XML/base64 antigua) y, en `.pbit`, de las **particiones** del `DataModelSchema`. Única
> limitación restante: en un `.pbix` moderno el M va en el modelo binario → exporta `.pbit`.
> **Fase 4a (v3.6.0):** al publicar se sube también el **archivo fuente** (binario en
> commit/Draft PR o asset de Release) y la doc ya no inventa autor/año. **Fase 4b (v3.9.0):**
> al publicar se pueden añadir **archivos extra** (imágenes → `screenshots/`, datos → `data/`,
> resto → raíz; commit/Draft PR o assets de Release) → publicar el **proyecto completo**.
> Las imágenes no se analizan (no hay visión): son solo-subir.
> **Word `.docx` (v3.11.0):** un `.docx` es un ZIP OOXML; se extrae el **texto** de
> `word/document.xml` (párrafos, listas y el contenido de las tablas) vía `fflate`, con muestra
> acotada y aviso. El `.doc` binario antiguo no está soportado (exporta a `.docx`).

---

### 🟡 Media Prioridad

#### #26 — Mantener y expandir cobertura de tests con Codecov
**Esfuerzo:** Continuo (2-4h por sprint)

**Estado actual (v3.16.0):** ✅ Infraestructura completa implementada

**Progreso realizado:**
- ✅ Configuración de Vitest + Codecov
- ✅ CI con GitHub Actions ejecutando tests (cliente + servidor) automáticamente
- ✅ Badge de Codecov en README
- ✅ Cobertura actual: ver Codecov (oscila según versión; histórico ~60–64%)
- ✅ 520 tests en el cliente (v3.31.0; 48 archivos `.test.ts(x)` co-locados). Implementados para:
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
  - Hooks: `useChat`, `useActions`
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

#### #50 — Presupuesto de contexto ajustado (que quepa en modelos con TPM bajo) ✅ RESUELTO en v3.28.0
**Esfuerzo:** 2–3h
**Origen:** **dogfooding** — al pedir opinión del roadmap con el repo cargado, **Groq (tier gratuito) rechazó la petición por límite TPM** (`Request too large`: ~16-20k tokens pedidos vs. límite 6-12k). Gemini sí lo aguantó.

**Problema:** con un repo grande cargado como contexto (#41/#49), el bloque de contexto (árbol completo + contenido de los 12 archivos más relevantes a 80 líneas) podía superar el límite de tokens por minuto de los modelos pequeños (Groq free), que devolvían error. Además, el hint de error genérico de "saturación" se pegaba también a los errores de contexto excesivo.

**Solución aplicada (v3.28.0):** presupuesto **declarativo por proveedor** — nuevo campo `contextBudget?` en `ProviderDef`; Groq declara `{ maxFiles: 6, maxLinesPerFile: 60 }`, el resto usa los defaults 12/80. Helper `getActiveContextBudget()` lo lee en `runSend`/`runLoadRepoContext`. **Reintento automático**: si el primer intento falla por contexto excesivo, `runSend` reintenta con la mitad de archivos (`isContextTooLargeError` en `retry.ts`). **Fix del mensaje duplicado**: el error de TPM ahora es diferenciado en `gemini.ts` (flag `contextTooLarge`, sin hint de saturación) y muestra un mensaje accionable i18n (`chat.contextTooLarge`).

**Beneficio:** que el chat con repo cargado funcione también en Groq y otros modelos con TPM bajo; menos coste de tokens; UX de error clara y accionable.

---

#### #51 — "Archivos consultados para esta respuesta" (transparencia del contextRanker) ✅ RESUELTO en v3.28.0
**Esfuerzo:** 2–3h
**Origen:** sugerencia de **Gemma 4 31B** (OpenRouter), **dogfooding**.

**Problema:** con #49 la IA responde basándose en los archivos que el `contextRanker` selecciona, pero el usuario no ve **cuáles**; queda como "caja negra".

**Solución aplicada (v3.28.0):** nuevo campo `consultedFiles?: string[]` en `ChatMessage`; `runSend` captura el resultado de `rankFilesByQuery` (antes descartado) y lo propaga en el `updateMessage` final (ramas chat y acción). Render: bloque `<details>` plegable bajo la respuesta con clase `.message-consulted-files`, clave i18n `chat.message.consultedFiles`. La lista refleja lo realmente enviado (incluso tras el reintento con menos contexto de #50).

**Beneficio:** transparencia y confianza; el usuario entiende qué partes de su código leyó la IA.

---

### 🟢 Baja Prioridad

#### #22 — SessionWarningBanner — Advertencia de caducidad de sesión
**Esfuerzo:** 3h

**Problema actual:** El usuario no recibe advertencia cuando su token de GitHub o clave de IA llevan muchas horas activos.

**Solución propuesta:** Nuevo componente `SessionWarningBanner.tsx` que muestra banner amber si las credenciales llevan >8h activas. Revisión cada 60s.

**Dependencia:** Requiere Zero-Storage real (#13) para funcionar correctamente. ✅ Ya implementado.

**Beneficio:** Mejor UX; seguridad proactiva.

---

#### ~~#33 — Sugerir revisores de código basándose en historial~~ ❌ DESCARTADO (v3.22.3)
**Esfuerzo:** 4h

**Problema actual:** Elegir revisores de PRs es subjetivo y manual.

**Solución propuesta:**
- Analizar git blame del repo
- Identificar autores más frecuentes en los archivos modificados
- Sugerir revisores con ranking de relevancia

**Beneficio:** PRs revisados más rápido; distribución equilibrada de carga de revisión.

**Nota:** nicho — bajo valor en repos pequeños o individuales. **Descartado definitivamente en v3.22.3** (era "candidato a poda" desde hacía versiones; confirmado por dogfooding con **Tencent HY3**, 06/07). No se reabre salvo demanda real.

---

#### ~~#35 — Automatizar gestión de labels/proyectos~~ ❌ DESCARTADO (v3.22.3)
**Esfuerzo:** 3h

**Problema actual:** Etiquetar issues y organizar proyectos es manual y tedioso.

**Solución propuesta:**
- Acción "etiquetar automáticamente" basada en contenido del issue
- Reglas configurables (ej: si contiene "bug" → label "bug")
- Integración con GitHub Projects

**Beneficio:** Organización automática del repositorio; ahorro de tiempo en gestión.

---

#### #36 — Migrar a GitHub App para permisos granulares
**Esfuerzo:** 6–8h (cambio de arquitectura de auth)

**Problema actual:** La app usa una **OAuth App** con scope `repo` (acceso total a todos los repos), excesivo si solo se usan funciones de lectura.

**Solución propuesta:** Los permisos finos por recurso (repos concretos, lectura vs escritura) **no son viables con la OAuth App actual** — requieren migrar a una **GitHub App** con *fine-grained permissions* y selección de repositorios por instalación. Implica rehacer el flujo OAuth del servidor (`server/index.js`) y el manejo de tokens de instalación.

**Beneficio:** Principio de mínimo privilegio real; el usuario elige a qué repos da acceso; mayor confianza.

**Nota:** caveat de viabilidad — no es un ajuste de scopes, es un cambio de tipo de aplicación en GitHub. Por eso sube de esfuerzo y de complejidad.

---

#### #24 — Internacionalización (i18n) — ✅ Entregada (Fases 1, 2 y 3)
**Esfuerzo:** Fase 1 (v3.20.0) + Fase 2 (v3.21.0) + Fase 3 (v3.22.0)

**Estado (v3.22.0):** ✅ **Fase 1** — Infraestructura **ligera sin dependencias externas** (se descartó
`i18next`): `LanguageContext` + función `t()` con interpolación, selector 🌐 e idioma recordado en
`sessionStorage` (no secreto → Zero-Storage). Traducidos: login (`AuthGate`), cabecera (`Header`),
`AIProviderPanel`, `ChatInput` y sus botones de acciones rápidas, y los paneles laterales
(`HistoryPanel`, `TemplatePanel`).

✅ **Fase 2 (v3.21.0):** modales (`ConfirmModal`, `DocModal`, `FilePublishModal`, `PublishActions`),
el visor de diferencias (`DiffViewer`) y los **mensajes visibles del chat** en `assistantActions.ts`.
La función `t()` se **inyecta** en la capa de orquestación vía `ChatDeps` (patrón de inyección de
dependencias existente), sin tocar la arquitectura.

✅ **Fase 3 (v3.22.0):** chat central (`ChatArea`, `ChatMessage` + locale del timestamp), las ~32
descripciones del historial (oración + log exportado) y las 17 plantillas de autocompletado
(reestructuradas como factoría `buildTemplates(t)`). Además, las **respuestas de la IA** respetan el
idioma activo: `lang` se cablea por `ChatDeps` hasta los system prompts y una directiva dinámica
(`withLangDirective`) fuerza la respuesta en ES/EN. La app queda **bilingüe de extremo a extremo**.

**Fuera de alcance (deliberado):** los mensajes de commit / cuerpos de Draft PR de `docPublisher.ts`
y `github.ts` (van a GitHub como texto técnico) y las etiquetas `Usuario`/`Asistente` del contexto
que va al LLM (no son UI visible). Para traducir los servicios haría falta refactorizar el i18n a una
función `t(lang, key)` pura (no hook); se deja para el futuro si hay demanda real.

**Dependencia resuelta:** #23 (prompts en archivos `prompts/*.md`) facilita una futura i18n de prompts
(`chat.en.md`, etc.) si se quieren versiones completas en cada idioma.

---

#### #25 — Mejorar DX y pipeline de despliegue
**Esfuerzo:** 2–3h

**Tareas:**
- ✅ GitHub Actions CI — lint + tests (cliente + servidor) con cobertura en cada push/PR a main (badge en README) — *implementado en v2.4.0*
- ✅ Despliegue continuo (CD) — activador de Cloud Build que construye y despliega `main` a Cloud Run en cada push (Build → Push → Deploy) — *ya operativo*
- ⏳ Logs estructurados en el servidor (JSON con timestamp, level, requestId)
- ⏳ Healthcheck extendido en `/health` (versión, uptime, estado de variables de entorno)
- ⏳ Script `deploy.sh` automatizado para Cloud Run con validación previa de variables (alternativa al deploy manual; el flujo habitual ya es automático vía Cloud Build)

---

#### #48 — Revisión bajo demanda de cambios recientes ("Sync Repo Status")
**Esfuerzo:** 3–4h

**Problema actual:** Una revisión proactiva con webhooks no es fiable porque Cloud Run escala a cero (los webhooks en frío pueden fallar).

**Solución propuesta:** Botón **"Sync Repo Status"** en la UI. Al pulsarlo, el frontend pide al backend los últimos commits y diffs recientes (nuevos wrappers `listCommits`/`getCommit` en `github.ts`), y la IA los analiza en el momento para sugerir mejoras o detectar errores. Modelo **pull** (bajo demanda), no webhooks.

**Beneficio:** Simular revisión de código proactiva sin necesidad de mantener servidores siempre activos.

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

#### #54 — Añadir NVIDIA Build (NIM) + Zenmux como proveedores de IA ✅ RESUELTO en v3.32.0
**Esfuerzo:** 3–4h
**Origen:** análisis de la propuesta de Claude Sonnet 5.0 + configuración ZCode existente.

**Problema actual:** la app soporta Gemini, Groq y OpenRouter. NVIDIA Build (NIM) expone `integrate.api.nvidia.com/v1` con catálogo dinámico y modelos interesantes. Zenmux (configurado en ZCode) ofrece gateway unificado a múltiples proveedores.

**Enfoque correcto (cliente, NO backend):** Ambos son OpenAI-compatible → entrada en `PROVIDERS` con `transport: 'openai-compatible'`. Peticiones directas del navegador, key en memoria React (Zero-Storage). **No tocar `server/index.js` ni añadir SDK OpenAI.**

**Implementación (v3.32.0):**
- **NIM (`nvidia`):** endpoint `https://integrate.api.nvidia.com/v1`, `keyPrefix: 'nvapi-'`. Catálogo filtrado (`NIM_EXCLUDED`: embeddings, rerank, vision, safety...), enriquecido con `featured-models.json` (NGC) para priorizar activos. Fallback 12 modelos (Nemotron 3 Ultra, GLM 5.2, Llama 3.3 70B, Codestral 22B, DeepSeek V4 Pro, Minimax M3, etc.). Sin flag `free` (API no distingue).
- **Zenmux (`zenmux`):** endpoint `https://zenmux.ai/api/v1`, `keyPrefix: 'sk-ai-v1-'`. Catálogo con pricing → marca `free: true` donde pricing=0 (patrón OpenRouter). 7 modelos free en fallback (Step 3.7 Flash, Grok 4.5 500K ctx, GLM 4.7/4.6V Flash, Ling 2.6, MiniMax M2.5, Qwen3 ASR). Badge 🆓 en selector, free primero.
- Tests: registro, `fetchModels`, `modelLabel`, panel UI.
- i18n ES/EN, badges CSS.

**Beneficio:** dos proveedores más (con modelos de primera línea), reutilizando toda la infraestructura, sin deuda técnica.

---

#### #55 — Plantillas del panel lateral sin traducir (i18n) ✅ RESUELTO en v3.25.0
**Esfuerzo:** 1–1.5h
**Origen:** bug detectado por el autor (v3.22.2); análisis completo hecho.

**Problema:** con la interfaz en inglés, el panel lateral de Plantillas (`TemplatePanel`) seguía mostrando texto en español.

**Causa raíz:** `client/src/components/templates/templateData.ts` exportaba un array estático (`TEMPLATE_CATEGORIES`) con literales en español duros. La Fase 3 de i18n (v3.22.0) refactorizó `instructionSuggestions.ts` a factoría `buildTemplates(t)`, pero no tocó `templateData.ts`.

**Solución aplicada (v3.25.0):** replicar el patrón de `instructionSuggestions.ts` — factoría `buildTemplateCategories(t)` con ids/emojis fijos y textos vía `t('tmpl_panel.*')`; ~36 claves en `es.ts`/`en.ts`; `TemplatePanel.tsx` consume la factoría.

**Beneficio:** panel de plantillas coherente con el idioma activo (cierra el bilingüe de extremo a extremo).

---

#### #56 — Descripciones del historial de acciones de solo lectura en español (i18n)
**Esfuerzo:** 1–1.5h
**Origen:** bug detectado por el autor (v3.22.2); análisis parcial hecho.

**Problema actual:** con la interfaz en inglés, las descripciones de las entradas del historial que provienen de **acciones de solo lectura / confirmadas** salen en español. Las descripciones de los flujos documentar/resumir/changelog/salud SÍ se traducen (usan `deps.t('history.*')` desde la Fase 3).

**Causa raíz:** los flujos de acción (`runSend` modo lectura, `runConfirmAction`, `executeActionMultiRepo`) escriben `result.message` / `message` (de `executeAction`/`actionExecutor.ts`) directamente en la `description` de la entry, **sin pasar por `t()`** (assistantActions.ts:516, 549, 556 aprox.). Esos mensajes los emite `actionExecutor.ts` en español duro.

**Solución propuesta:** auditar `client/src/services/actionExecutor.ts` para identificar los mensajes visibles que emite; envolverlos en `deps.t('history.exec.*')` con claves nuevas (inyectando `t` al executor como ya se hace con `ChatDeps`), o bien construir las descripciones en `assistantActions.ts` a partir del resultado en vez de usar `result.message` directo.

**Caveat:** las entries previas al cambio de idioma seguirán en su idioma original — el historial es **inmutable por diseño** (ver `HistoryContext.tsx:5-22`: "session-only, intentionally not persisted"). No es un bug retraducir entries antiguas; el fix aplica a las nuevas.

**Beneficio:** historial coherente con el idioma activo en todos los flujos, no solo en los de documentación.

---

#### ✅ #57 — Unificar la UI de documentación en un solo flujo + atribución correcta
**Esfuerzo:** ~2 sesiones (dividido en 2 tandas; ver abajo)
**Origen:** reporte del autor (v3.22.3); la confusión de UX persiste aunque los errores concretos ya están arreglados. Ampliado con el reporte Llama 4 Scout (README vacío al crear repo, About pobre, firma sin modelo).

**Problema actual:** existen **dos botones/modales divergentes** para documentar:
- **"📄 Documentar repo"** (`DocumentRepoButton` → `DocModal` con tabs README/MANUAL): genera README + MANUAL_TECNICO de un repo entero.
- **"📤 Documentar y publicar"** (inline en `ChatInput:227`, **solo visible con archivo adjunto** → `FilePublishModal`): genera un MD a partir de un archivo, con extras + repo destino + oferta de crearlo.

El usuario los encuentra confusos: no sabe cuándo usar cuál, y con un repo cargado como contexto (opinión) **el segundo botón ni aparece**. Además, al crear un repo inexistente desde el flujo de archivo, el README queda vacío (`auto_init` de GitHub), el About es un placeholder estático, y la firma no incluye el modelo.

**Lo que ya está unificado (no se toca):** `PublishActions` (barra commit/PR/release, `PublishActions.tsx:41`) ya es **compartido** por ambos modales desde v3.10.0. La capa de "cómo publicar" está limpia y reusable.

---

### 🅰️ TANDA A — Atribución + README vacío al crear repo (~3–4h, aislada, baja dependencia)

**Objetivo:** arreglar la atribución (firma con modelo + About con descripción) y el bug del README vacío, **sin tocar la UI de botones/modales** (eso va en Tanda B). Es un cambio de fondo (servicios + prompts) con superficie acotada → cabe en una sesión con margen.

**Decisiones cerradas (acordadas con el autor):**
- ✅ La firma incluye el **modelo**: *"Desarrollado por @{user} · {año} **y documentado por {modelo}** a través de la app Asistente de IA para Publicar Repositorios"*.
- ✅ La firma se aplica **a ambos** generadores (`generateRepoDocs` y `generateFileDoc`).
- ✅ Al crear un repo, la **descripción (About) la genera la IA** a partir del archivo adjunto / instrucción, y se muestra en el modal antes de confirmar (editable).
- ✅ Al crear un repo desde el flujo de archivo, el **README se genera con contenido** (de la IA + firma), no se deja el `auto_init` de GitHub.

**Pasos de implementación (puntos de código confirmados, HEAD `cf050bf`):**

1. **Firma con modelo en `generateRepoDocs`** (`gemini.ts`):
   - Líneas 550-551: `docOwner`/`docYear` (mantener).
   - Añadir `const docModel = config?.model ?? 'IA';` junto a esas.
   - Línea 579 (footer en el system prompt): cambiar la plantilla a
     `<p align="center">Desarrollado por @${docOwner} · ${docYear} y documentado por ${docModel} a través de la app Asistente de IA para Publicar Repositorios</p>`.
   - `config.model` ya está disponible (líneas 638-640).

2. **Firma nueva en `generateFileDoc`** (`gemini.ts:701`):
   - Hoy no tiene footer. Añadir al system prompt (710-722) una instrucción equivalente: que el documento termine con la misma firma, interpolando `config.model` (disponible, se pasa a callAI en 731), `fileName` para derivar un owner si procede, y el año.

3. **About del repo al crearlo** (`assistantActions.ts` + `App.tsx`):
   - `runCreateRepo` (`assistantActions.ts:721-729`): hoy el fallback es `'Creado desde el Asistente de IA'`. Cambiar la firma para aceptar la descripción generada por la IA y componer: *"Creado y documentado a través de la app Asistente de IA para Publicar Repositorios — {descripción IA}"*.
   - `handleConfirmCreateRepo` (`App.tsx:205-220`): hoy llama `runCreateRepo(deps, repo)` **sin** `opts.description` (línea 211). Pasarle la descripción generada por la IA (nueva llamada corta al LLM a partir del `fileContext`/instrucción; reusa el transporte existente).
   - Decidir si la generación de la descripción va en un nuevo `runGenerateRepoDescription` (aislado y testeable) o inline en `handleConfirmCreateRepo`.

4. **README con contenido al crear repo desde flujo de archivo** (`docPublisher.ts` + `assistantActions.ts`):
   - Hoy `publishFileDoc` (`docPublisher.ts:141`) escribe solo en `docs/{archivo}.md`; el README queda el `auto_init` de GitHub (`# repo`).
   - Cuando el destino sea un repo **recién creado**, además de `docs/{archivo}.md`, commitear un `README.md` con contenido (el `doc` generado por `generateFileDoc`, que ya llevará la firma nueva) — reusa `createOrUpdateFile` de `github.ts`. Cuidado de no duplicar la lógica de `writeDocFiles` (que es del flujo repo).

5. **Tests:**
   - `gemini.test.ts:636` — aserta `toContain(\`@migueljerico · ${year}\`)`; actualizar al nuevo formato de firma (con `y documentado por`).
   - Añadir test de que `generateFileDoc` ahora incluye la firma.
   - No hay test del `'Creado desde el Asistente de IA'` (confirmado: no aparece en tests) — añadir uno para el nuevo About si se cambia `runCreateRepo`.

**Cierre Tanda A:** bump menor (p. ej. v3.23.0 o v3.22.4), build/lint/tests verdes, tag/release.

---

### 🅱️ TANDA B — Unificación de la UI en un solo flujo (~1 día, sesión dedicada)

**Objetivo:** reemplazar los 2 botones/modales divergentes por **un solo botón "📝 Documentar"** que abre un modal unificado. Hacer **después** de la Tanda A (que ya deja la atribución correcta).

**Diseño (MVP) del `DocumentModal` unificado:**
1. **Selector de origen** (segmented/radio):
   - **Repo** → pide `owner/repo` (reusa `runDocumentRepo`; pre-chequeo `repoExists` + default_branch ya están tras v3.22.3).
   - **Archivo adjunto** → habilitado solo si `fileContext` activo (reusa `runGenerateFileDoc`).
   - **Contexto de opinión (repo activo)** → NUEVO: si hay `repoContext`, genera doc usando ese contexto (`runDocumentRepo(repoContext.repoName)` precargado). Resuelve "no puedo publicar la opinión".
2. **Vista previa** (tabs si repo — reusa `DocModal` body; MD único si archivo — reusa `FilePublishModal` body).
3. **Barra de publicación** = `PublishActions` existente (`PublishActions.tsx:41`), sin tocar.

**Lo que diverge hoy y hay que fundir:**
- Dos disparadores → uno: `DocumentRepoButton.tsx` + inline `publish-file-btn` (`ChatInput.tsx:227`) → 1 botón.
- Dos modales de revisión (`DocModal.tsx` con tabs vs `FilePublishModal.tsx` con MD único + extras + repo destino) → 1 `DocumentModal` con selector de origen.
- Dos sets de handlers/state en `App.tsx` (`handleDocumentRepo` ~225-234 / `handleDocumentAndPublishFile` ~160-173 + los de publicación paralelos) → despachar por `kind` como ya hace `runPublishFileDocByKind` (`assistantActions.ts:823-829`).
- Avisar "actualizar documentación" cuando el repo ya esté documentado (detectar README existente).

**Componentes implicados:** `DocumentRepoButton.tsx`, inline `publish-file-btn` de `ChatInput.tsx:227`, `DocModal.tsx`, `FilePublishModal.tsx`, `PublishActions.tsx` (**sin tocar**), `App.tsx` (state/handlers), `assistantActions.ts` (`runDocumentRepo`, `runGenerateFileDoc`, `runPublishFileDoc*`).

**Tests a actualizar:** `DocModal.test.tsx`, `FilePublishModal.test.tsx`, `PublishActions.test.tsx`, `useActions.test.ts`, `assistantActions.test.ts` (se romperán al cambiar la superficie de componentes — contabilizar medio día).

**Cierre Tanda B:** bump (p. ej. v3.24.0), build/lint/tests verdes, tag/release. Marcar #57 como ✅.

---

**Beneficio global:** un solo flujo claro donde el usuario decide qué documentar (repo/archivo/opinión) y cómo publicar (commit/PR/release), sin adivinar qué botón usar; además, los repos creados/documentados quedan con un README y un About profesionales y con atribución correcta (modelo + app). Cierra la deuda UX del módulo de documentación.

**Nota:** los fixes de v3.22.3 (Qwen `<think>`, 404 amable, parser robusto en `generateRepoDocs`, rama por defecto real) ya eliminan los errores concretos que bloqueaban el uso; #57 es la unificación de la experiencia + la atribución.

---

## 📊 Resumen

| Prioridad | Total | ✅ Resueltos | ⏳ Pendientes |
|---|---|---|---|
| 🔴 Alta | 8 | 8 (#1, #2, #13, #14, #27, #45, #15, #28) | 0 |
| 🟡 Media | 17 | 16 (#12, #17, #18, #19, #21, #37, #41, #32, #42, #38, #20, #49, #39, #44, #50, #51) | 1 (#26) |
| 🟢 Baja | 18 | 10 (#23, #24, #34, #40, #46, #58, #55, #56, #57, #54) | 6 (#22, #25, #36, #48, #52, #53) |
| **🗑️ Descartados** | — | — | 2 (#33, #35) descartados en v3.22.3 |
| **TOTAL** | **43** | **32** | **9** |

> **#28** cubierto en su **norte** por las Fases 1 (v3.0.0, adjuntar como contexto) y
> 2 (v3.1.0, documentar→publicar). **Más formatos:** Fase 3a (v3.2.0, Excel/CSV) y
> Fase 3b MVP (v3.3.0, Power BI .pbix/.pbit) y **Fase 3b-bis** (v3.4.0 + robustez v3.4.2:
> Power Query M del `DataMashup` binario/XML **y** de las particiones del `DataModelSchema`
> de `.pbit`). Única limitación restante: en un `.pbix` moderno el M va en el modelo binario
> (no legible) → exporta `.pbit`. **Word `.docx`** (v3.11.0): texto de `word/document.xml`.
> Imágenes/visión: descartada.

> **Nota de numeración:** los huecos en #16, #29, #30, #31, #43 y #47 son intencionados — esos ítems se fusionaron o descartaron en revisiones del roadmap y sus números no se reutilizan (convención del documento). #16 se fusionó en #42; #29 en #40.

---

## 📝 Convenciones

- Al resolver un punto → moverlo a la tabla ✅ con versión y SHA de commit
- Issues pendientes ordenados por prioridad dentro de cada bloque 🔴 / 🟡 / 🟢
- Crear commit: `docs: mark issue #X as resolved in vX.Y`
- Cada mejora debe incluir tests correspondientes (ver #26)
