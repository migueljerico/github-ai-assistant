# 🔮 Roadmap de Mejoras — Análisis del Código

Estado del código, mejoras pendientes y roadmap del proyecto.

**Actualizado a:** v3.14.0 · Junio 2026

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
| — | #40 (parcial): recordar proveedor/modelo (sin la key) + botón Detener (cancelar generación) | AIProviderContext.tsx, utils/providerPrefs.ts, gemini.ts, App.tsx, ChatInput.tsx | v3.12.0 / v3.13.0 |
| — | Crear Release desde "Documentar repo" (además de commit/Draft PR) | assistantActions.ts (runCreateRepoRelease), DocModal.tsx | v3.8.0 |
| — | Unificar los controles de los dos flujos de documentación (barra compartida commit/Draft PR/Release) | components/confirm/PublishActions.tsx, DocModal.tsx, FilePublishModal.tsx | v3.10.0 |
| — | Seguridad: `state` de OAuth con CSPRNG (crypto.randomUUID) | server/index.js | v3.7.1 |

---

## 🗺️ Hoja de ruta por sprints (acuerdo vigente · post-v3.11.0)

Secuencia acordada con el autor para abordar lo pendiente. Es **independiente de la sesión o
herramienta**: si el trabajo continúa en otro entorno, este es el orden de referencia.

- **🥇 Sprint 1 — Robustez y pulido del núcleo (quick wins) — ✅ COMPLETADO (v3.11.1–v3.14.0):**
  **#20** (documentación sin cortar funciones, truncado por líneas) ✅ · **#23** (prompts a archivos
  `.md`) ✅ · **#40 parcial** (botón **Detener** + recordar proveedor/modelo) ✅ · **#34** (changelog
  automático de releases) ✅.
- **🥈 Sprint 2 — Calidad de IA / contexto:** **#49** (seleccionar archivos relevantes del repo
  antes de llamar al LLM: mejores respuestas, menos tokens) · resto de **#40** (validación `zod` +
  reintentos en `ghFetch`).
- **🥉 Sprint 3 — UI robusta + escaparate de datos:** **#39** (ErrorBoundary + a11y) · **#44**
  (dashboard "Salud del Código" con Recharts — pieza de escaparate Análisis de Datos).
- **🏅 Sprint 4 — Alcance e i18n:** **#23→#24** (inglés) · **#46** (export/import de conversación).
- **📋 Backlog:** #25 (logs/health), #22 (aviso de sesión), #48 (sync repo), **#36** (GitHub App —
  hito grande aparte). #26 (cobertura) es transversal: sube con cada sprint.
- **🗑️ Candidatos a poda:** **#33** (sugerir revisores) y **#35** (auto-labels) — nicho/fuera del núcleo.

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

**Estado actual (v3.14.0):** ✅ Infraestructura completa implementada

**Progreso realizado:**
- ✅ Configuración de Vitest + Codecov
- ✅ CI con GitHub Actions ejecutando tests (cliente + servidor) automáticamente
- ✅ Badge de Codecov en README
- ✅ Cobertura actual: **~60%** (ver Codecov para el valor exacto)
- ✅ 419 tests en el cliente. Implementados para:
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

#### #39 — ErrorBoundary + accesibilidad (a11y)
**Esfuerzo:** 4h

**Problema actual:** Un fallo de render en cualquier componente tumba toda la SPA (no hay red de seguridad de UI). Además, los modales (`ConfirmModal`, `DocModal`) carecen de focus-trap, roles ARIA y navegación por teclado completa.

**Solución propuesta:**
- `ErrorBoundary` de React en `main.tsx` envolviendo `Root`, con pantalla de error amable y opción de recargar.
- Focus-trap y `role="dialog"` / `aria-modal` en los modales; cierre con `Esc`; foco inicial gestionado.

**Beneficio:** Robustez de UI ante errores inesperados; accesibilidad para usuarios de teclado y lectores de pantalla.

---

#### #44 — Dashboard de "Salud del Código" (Recharts)
**Esfuerzo:** 6–8h

**Problema actual:** El asistente responde en texto, pero algunas métricas de un repo se entienden mucho mejor visualmente.

**Solución propuesta:** Vista de visualización de datos en el frontend React (Recharts o Chart.js):
- Frecuencia de commits (línea temporal) — API de commits de GitHub.
- Deuda técnica: conteo de `TODO`/`FIXME` extraídos del árbol de archivos (reutiliza `fetchRepoTreeRecursive` de `github.ts`).
- Distribución de lenguajes (donut chart) — reutiliza `detectPrimaryLanguage` (`gemini.ts`).

**Beneficio:** Demostrar skills de Análisis de Datos aplicados a DevOps; aprovechar la experiencia previa con Power BI para diseñar dashboards en web.

**Nota:** ítem de **escaparate** (Análisis de Datos), no núcleo de gestión de GitHub. Es el primer candidato a soltar si se quiere enfocar más el roadmap.

---

#### #49 — Gestión de la ventana de contexto (selección de archivos relevantes / RAG ligero)
**Esfuerzo:** 6–10h
**Origen:** sugerencia de **Gemma 4 31B** (Google, vía OpenRouter) en una revisión de arquitectura, **obtenida usando la propia app** (dogfooding: se cargó este repo como contexto y se pidió su opinión), contrastada con el modelo "sin base de datos" del proyecto.

**Problema actual:** `buildRepoContextSummary` (#41) envía el árbol completo + los primeros N archivos truncados. En repos grandes esto (1) gasta tokens, (2) puede degradar la calidad o agotar el contexto del modelo, y (3) puede dejar fuera los archivos realmente relevantes para la pregunta concreta.

**Solución propuesta (compatible con Zero-Storage / sin BD):**
- En lugar de una BD vectorial externa (Pinecone/ChromaDB — rompería el principio "sin base de datos"), un enfoque ligero **en cliente**: calcular embeddings de los fragmentos en memoria (volátil) y seleccionar por similitud (cosine) solo los más relevantes a la consulta antes de enviarlos al LLM.
- Alternativa aún más simple sin embeddings: ranking léxico (BM25 / TF-IDF) de los archivos frente a la consulta, reutilizando el árbol que ya descarga `fetchRepoTreeRecursive`.

**Beneficio:** opiniones y documentación más precisas y más baratas en tokens; mejor escalado a repos grandes; ataca el que Gemma identificó como "el mayor reto de un asistente de GitHub: el contexto".

**Nota:** Gemma proponía una BD vectorial (Pinecone/Chroma); se **reformula** a un índice en memoria para no contradecir el modelo Zero-Storage / sin BD del proyecto (mismo criterio que se aplicó a la propuesta de IndexedDB en #46). Ejemplo de la validación cruzada del README: se toma la idea útil y se adapta a la arquitectura.

---

### 🟢 Baja Prioridad

#### #22 — SessionWarningBanner — Advertencia de caducidad de sesión
**Esfuerzo:** 3h

**Problema actual:** El usuario no recibe advertencia cuando su token de GitHub o clave de IA llevan muchas horas activos.

**Solución propuesta:** Nuevo componente `SessionWarningBanner.tsx` que muestra banner amber si las credenciales llevan >8h activas. Revisión cada 60s.

**Dependencia:** Requiere Zero-Storage real (#13) para funcionar correctamente. ✅ Ya implementado.

**Beneficio:** Mejor UX; seguridad proactiva.

---

#### #46 — Exportar/importar conversación (memoria entre sesiones, Zero-Storage)
**Esfuerzo:** 4–5h

**Problema actual:** Al recargar la página (F5), se pierde el historial de conversación por la arquitectura Zero-Storage.

**Solución propuesta (compatible con Zero-Storage):**
- Botón **"Exportar conversación"** → descarga un JSON con el historial (y, opcionalmente, el repo de contexto activo de #41).
- Botón **"Importar"** → restaura ese estado en una sesión nueva.
- **Nada se auto-persiste** en el navegador (ni IndexedDB ni localStorage): el usuario controla el fichero.

**Beneficio:** Recuperar el contexto de sesiones anteriores ("¿qué estábamos haciendo con este repo?") sin romper Zero-Storage.

**Nota:** reemplaza la propuesta original (IndexedDB + cifrado con clave derivada del `access_token`), descartada porque (1) contradice el modelo Zero-Storage del README ("ni IndexedDB") y (2) no funcionaría entre sesiones, ya que el token cambia en cada sesión y la clave de descifrado dejaría de coincidir.

---

#### #33 — Sugerir revisores de código basándose en historial
**Esfuerzo:** 4h

**Problema actual:** Elegir revisores de PRs es subjetivo y manual.

**Solución propuesta:**
- Analizar git blame del repo
- Identificar autores más frecuentes en los archivos modificados
- Sugerir revisores con ranking de relevancia

**Beneficio:** PRs revisados más rápido; distribución equilibrada de carga de revisión.

**Nota:** nicho — bajo valor en repos pequeños o individuales; candidato a corte en una futura poda.

---

#### #35 — Automatizar gestión de labels/proyectos
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

#### #24 — Internacionalización (i18n) con i18next
**Esfuerzo:** 3–4h

**Problema actual:** La app es 100% en español.

**Solución propuesta:** Añadir soporte EN mínimo con `i18next` + `react-i18next`. Strings de UI, system prompts adaptados al idioma, selector en header.

**Dependencia:** Recomendable completar #23 antes — facilita la i18n de prompts.

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

#### #40 — Robustez de red e IA/UX (sub-tareas restantes)
**Esfuerzo:** ~3h (Sprint 2)

**Entregado ya:** ✅ reintentos transitorios en `callAI` (v2.7.3) · ✅ recordar proveedor/modelo
sin guardar la key (v3.12.0) · ✅ **botón Detener** para cancelar la generación con `AbortController` (v3.13.0).

**Pendiente (Sprint 2):**
- **Reintentos en GitHub:** extender el backoff a `ghFetch` (`github.ts`) y unificar en un
  `fetchWithRetry` genérico (hoy solo reintentan las llamadas a la IA).
- **Validación estricta:** validar el JSON de acción con `zod` + allowlist de métodos/endpoints,
  reforzando *proponer → confirmar → ejecutar*.

**Beneficio:** más robustez ante red inestable en GitHub y defensa extra ante respuestas
malformadas de la IA.

**Nota:** absorbió el antiguo #29 (reintentos con backoff).

---

#### #48 — Revisión bajo demanda de cambios recientes ("Sync Repo Status")
**Esfuerzo:** 3–4h

**Problema actual:** Una revisión proactiva con webhooks no es fiable porque Cloud Run escala a cero (los webhooks en frío pueden fallar).

**Solución propuesta:** Botón **"Sync Repo Status"** en la UI. Al pulsarlo, el frontend pide al backend los últimos commits y diffs recientes (nuevos wrappers `listCommits`/`getCommit` en `github.ts`), y la IA los analiza en el momento para sugerir mejoras o detectar errores. Modelo **pull** (bajo demanda), no webhooks.

**Beneficio:** Simular revisión de código proactiva sin necesidad de mantener servidores siempre activos.

---

## 📊 Resumen

| Prioridad | Total | ✅ Resueltos | ⏳ Pendientes |
|---|---|---|---|
| 🔴 Alta | 8 | 8 (#1, #2, #13, #14, #27, #45, #15, #28) | 0 |
| 🟡 Media | 15 | 11 (#12, #17, #18, #19, #21, #37, #41, #32, #42, #38, #20) | 4 (#26, #39, #44, #49) |
| 🟢 Baja | 11 | 2 (#23, #34) | 9 (#22, #24, #25, #33, #35, #36, #40, #46, #48) |
| **TOTAL** | **34** | **21** | **13** |

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
