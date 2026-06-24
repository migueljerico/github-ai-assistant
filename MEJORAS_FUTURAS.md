# 🔮 Roadmap de Mejoras — Análisis del Código

Estado del código, mejoras pendientes y roadmap del proyecto.

**Actualizado a:** v3.0.0 · Junio 2026

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

---

## ⏳ Pendientes

Los issues están numerados y ordenados por prioridad descendente dentro de cada bloque. Al resolver un punto, moverlo a la tabla ✅ con versión y SHA de commit.

### 🔴 Alta Prioridad

✅ Sin ítems pendientes — todos resueltos.

> **#28 (subida de archivos) entregado por fases.** **Fase 1** (v3.0.0): adjuntar
> PDF + texto/código como **contexto** del chat (cliente / Zero-Storage; reutiliza
> `pdfReader`/`pdfAdvanced` + el patrón #41) → ya permite *"documéntame este archivo"*
> en lenguaje natural. **Norte pendiente** (se planificará como fases/ítems propios):
> **Fase 2** — *documentar→publicar*: generar documentación del archivo y publicarla
> (commit / Draft PR / release) reutilizando `docPublisher`/`releaseGenerator`;
> **Fase 3** — más formatos: Excel/CSV (SheetJS) e imágenes (visión). PBIX queda fuera
> (formato propietario complejo).

---

### 🟡 Media Prioridad

#### #20 — Truncamiento semántico por líneas en generateRepoDocs()
**Esfuerzo:** 2h

**Problema actual:** `generateRepoDocs()` trunca archivos a 2000 caracteres, cortando código a mitad de función.
**Solución propuesta:** Truncar a 80 líneas preservando imports y firmas de funciones. Los Markdown conservan encabezados e introducción.

**Beneficio:** Documentación más coherente y útil; contexto preservado.

---

#### #26 — Mantener y expandir cobertura de tests con Codecov
**Esfuerzo:** Continuo (2-4h por sprint)

**Estado actual (v3.0.0):** ✅ Infraestructura completa implementada

**Progreso realizado:**
- ✅ Configuración de Vitest + Codecov
- ✅ CI con GitHub Actions ejecutando tests (cliente + servidor) automáticamente
- ✅ Badge de Codecov en README
- ✅ Cobertura actual: **≈64%** (ver Codecov para el valor exacto)
- ✅ 269 tests en el cliente. Implementados para:
  - `AuthContext.tsx` (login, logout, OAuth flow, Zero-Storage)
  - `AIProviderContext.tsx` (conexión/desconexión de proveedores)
  - `providers.ts` (registro de proveedores, detección de modelos 🆓, caché, `pickDefaultModel`)
  - `actionExecutor.ts` (ejecutor de acciones GitHub)
  - `github.ts` (wrapper de GitHub API, decodeBase64, encodeBase64, getRepo, getBranchSha)
  - `gemini.ts` (parseGeminiAction, detectPrimaryLanguage, temperatura por modo, contexto de repo #41, enrutado OpenRouter, reintento transitorio `withTransientRetry`/`isTransientAIError`)
  - `docPublisher.ts` (commit directo / Draft PR — #45)
  - `threadSummary.ts` (resumen de hilos #32: `parseThreadInput`, issue vs PR, hilo vacío) + wrappers de comentarios en `github.ts` (paginación)
  - `assistantActions.ts` (#42: orquestación del chat — `runSend`, `runConfirmAction`, `runCancelAction` y los flujos de botón; ~98%) + `repoRef.ts` (`resolveRepoRef`) + `DocModal.tsx`
  - `modeDetection.ts` (chat vs action; sesgo a chat con contexto de repo)
  - `formatResult.ts`, `releaseGenerator.ts`, `pdfReader.ts`, `pdfAdvanced.ts`
  - Hooks: `useChat`, `useActions`
  - Componentes React: `ChatArea`, `ChatInput`, `ConfirmModal`, `Header`, `TemplatePanel`, `AIProviderPanel`, `AIProviderBadge`, `RepoContextButton`
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

#### #34 — Generar changelogs de lanzamientos
**Esfuerzo:** 2h

**Problema actual:** Los changelogs se hacen manualmente y suelen estar desactualizados.

**Solución propuesta:**
- Analizar commits entre dos tags/releases
- Clasificar commits (feat, fix, docs, refactor)
- Generar CHANGELOG.md con formato Keep a Changelog

**Beneficio:** Documentación automática de releases; comunicación clara a usuarios.

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

#### #23 — Migrar prompts largos a archivos externos
**Esfuerzo:** 2h

**Problema actual:** Los system prompts están incrustados como template literals en los archivos `.ts`, dificultando su edición y lectura.

**Solución propuesta:** Mover todos los prompts a `client/src/prompts/` como archivos `.md` y cargarlos en runtime con `import ... as text`.

**Beneficio:** Edición sin tocar código TypeScript; base para futura internacionalización de prompts.

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

#### #40 — Robustez de red e IA/UX (reintentos, cancelación, validación, persistencia)
**Esfuerzo:** ~6h (agrupa 4 sub-tareas)

**Problema actual:** Las llamadas a GitHub/Gemini/Groq fallan silenciosamente ante errores temporales (rate limits, timeouts, 5xx); no se puede abortar una generación larga; `parseGeminiAction()` solo valida 3 campos del JSON de acción; y el usuario debe re-seleccionar proveedor y modelo en cada recarga.

**Solución propuesta:**
- **Reintentos con backoff:** wrapper `fetchWithRetry()` (máx. 3 intentos, backoff exponencial 1s/2s/4s, logging por reintento, error final descriptivo) en las llamadas a GitHub/Gemini/Groq.
  - ✅ **Parcial (v2.7.3):** `callAI` ya reintenta con backoff ante errores **transitorios** de los proveedores de IA (`withTransientRetry`/`isTransientAIError`: 503 "high demand", "Provider returned error", red). Falta extenderlo a las llamadas a GitHub (`ghFetch`) y unificar en un `fetchWithRetry` genérico.
- **Cancelación:** `AbortController` en `callAI()` + botón "Detener" mientras genera. Ahorra cuota y mejora la UX.
- **Validación estricta:** validar el JSON de acción con `zod` y una allowlist de métodos/endpoints, reforzando la garantía *proponer → confirmar → ejecutar*.
- **Persistencia parcial:** guardar **proveedor + modelo** (NUNCA la API key) en `sessionStorage`, respetando Zero-Storage, para no re-seleccionarlos en cada recarga.

**Beneficio:** Robustez ante red inestable (menos fallos silenciosos); más control para el usuario; defensa adicional ante respuestas malformadas de la IA; mejor experiencia de reconexión.

**Nota:** absorbe el antiguo #29 (reintentos con backoff) como primera sub-tarea.

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
| 🟡 Media | 15 | 10 (#12, #17, #18, #19, #21, #37, #41, #32, #42, #38) | 5 (#20, #26, #39, #44, #49) |
| 🟢 Baja | 11 | 0 | 11 (#22, #23, #24, #25, #33, #34, #35, #36, #40, #46, #48) |
| **TOTAL** | **34** | **18** | **16** |

> **#28** cuenta como resuelto por su **Fase 1** (v3.0.0); sus fases siguientes
> (documentar→publicar, más formatos) se trackearán como ítems nuevos cuando se aborden.

> **Nota de numeración:** los huecos en #16, #29, #30, #31, #43 y #47 son intencionados — esos ítems se fusionaron o descartaron en revisiones del roadmap y sus números no se reutilizan (convención del documento). #16 se fusionó en #42; #29 en #40.

---

## 📝 Convenciones

- Al resolver un punto → moverlo a la tabla ✅ con versión y SHA de commit
- Issues pendientes ordenados por prioridad dentro de cada bloque 🔴 / 🟡 / 🟢
- Crear commit: `docs: mark issue #X as resolved in vX.Y`
- Cada mejora debe incluir tests correspondientes (ver #26)
