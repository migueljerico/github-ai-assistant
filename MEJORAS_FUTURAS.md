# 🔮 Roadmap de Mejoras — Análisis del Código

Estado del código, mejoras pendientes y roadmap del proyecto.

**Actualizado a:** v2.5.0 · Junio 2026

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

---

## ⏳ Pendientes

Los issues están numerados y ordenados por prioridad descendente dentro de cada bloque. Al resolver un punto, moverlo a la tabla ✅ con versión y SHA de commit.

### 🔴 Alta Prioridad

#### #28 — Subida de archivos locales (PDF, PBIX, Excel, etc.)
**Esfuerzo:** 8–12h (feature v3.0)
**Problema actual:** No existe forma de subir archivos del usuario para análisis. Solo se pueden analizar repositorios de GitHub.

**Solución propuesta:**
- UI drag & drop en ChatInput para archivos locales
- Backend con parser para múltiples formatos (PDF, Excel, PBIX, Word, imágenes)
- Extracción de texto/contenido de cada formato
- Análisis con LLM y generación de documentación
- Almacenamiento temporal en memoria (Zero-Storage)

**Beneficio:** Función clave para usuarios que quieren documentar proyectos locales o analizar documentos externos.

---

#### #15 — Soporte multi-proveedor con fallback (Together AI / OpenRouter / Ollama)
**Esfuerzo:** 3–4h

**Proveedores evaluados:**

| Proveedor | Ventajas | Tier gratuito | Prioridad |
|---|---|---|---|
| Together AI | Llama 3.1, Qwen2.5, DeepSeek, Mistral | Generoso | ⭐ Alta |
| OpenRouter | Router a decenas de modelos, incluyendo gratuitos | Free credits + pay-per-use | ⭐ Alta |
| Ollama (local) | 100% privado, sin red, sin límites | Ilimitado (hardware propio) | ⭐ Alta (portfolio) |
| Fireworks AI | Muy rápido en modelos grandes | Buen free tier | Media |
| DeepInfra | Barato y rápido | Tier gratuito | Media |

**Arquitectura sugerida:** Groq → Together AI → Gemini como cadena de fallback con selector de prioridad en el panel de IA.

**Beneficio:** Resiliencia ante cortes de servicio; diferenciador claro frente a apps mono-proveedor.

---

### 🟡 Media Prioridad

#### #16 — Extraer DocModal a componente propio
**Esfuerzo:** 1h

**Problema actual:** `DocModal` está embebido en `App.tsx` (~80 líneas de JSX), dificultando el mantenimiento.

**Solución propuesta:** Mover `DocModal` a `client/src/components/confirm/DocModal.tsx` con props tipadas.

**Beneficio:** `App.tsx` pasa de ~450 a ~370 líneas; mejor separación de responsabilidades.

---

#### #20 — Truncamiento semántico por líneas en generateRepoDocs()
**Esfuerzo:** 2h

**Problema actual:** `generateRepoDocs()` trunca archivos a 2000 caracteres, cortando código a mitad de función.
**Solución propuesta:** Truncar a 80 líneas preservando imports y firmas de funciones. Los Markdown conservan encabezados e introducción.

**Beneficio:** Documentación más coherente y útil; contexto preservado.

---

#### #22 — SessionWarningBanner — Advertencia de caducidad de sesión
**Esfuerzo:** 3h

**Problema actual:** El usuario no recibe advertencia cuando su token de GitHub o clave de IA llevan muchas horas activos.

**Solución propuesta:** Nuevo componente `SessionWarningBanner.tsx` que muestra banner amber si las credenciales llevan >8h activas. Revisión cada 60s.

**Dependencia:** Requiere Zero-Storage real (#13) para funcionar correctamente. ✅ Ya implementado.

**Beneficio:** Mejor UX; seguridad proactiva.

---

#### #29 — Retries con backoff exponencial para APIs
**Esfuerzo:** 2h

**Problema actual:** Las llamadas a GitHub/Gemini/Groq fallan silenciosamente ante errores temporales (rate limits, timeouts, errores 5xx).

**Solución propuesta:** Implementar wrapper `fetchWithRetry()` con:
- Máximo 3 reintentos
- Backoff exponencial (1s, 2s, 4s)
- Logging de cada reintento
- Error final descriptivo al usuario

**Beneficio:** Robustez mejorada; menos fallos silenciosos; mejor experiencia en condiciones de red inestables.

---

#### #30 — Caché de respuestas LLM
**Esfuerzo:** 3h

**Problema actual:** Cada pregunta idéntica genera una nueva llamada al LLM, consumiendo cuota y tiempo.

**Solución propuesta:**
- Caché en memoria (Map) con clave = hash(prompt + messages)
- TTL configurable (por defecto 1h)
- Indicador visual "Respuesta cacheada" en el chat
- Opción de "forzar nueva respuesta"

**Beneficio:** Control de costos; respuestas instantáneas para queries repetidas; ahorro de cuota API.

---

#### #26 — Mantener y expandir cobertura de tests con Codecov
**Esfuerzo:** Continuo (2-4h por sprint)

**Estado actual (v2.5.0):** ✅ Infraestructura completa implementada

**Progreso realizado:**
- ✅ Configuración de Vitest + Codecov
- ✅ CI con GitHub Actions ejecutando tests (cliente + servidor) automáticamente
- ✅ Badge de Codecov en README
- ✅ Cobertura actual: **49%**
- ✅ Tests implementados para:
  - `AuthContext.tsx` (login, logout, OAuth flow, Zero-Storage)
  - `AIProviderContext.tsx` (conexión/desconexión de proveedores)
  - `actionExecutor.ts` (ejecutor de acciones GitHub)
  - `github.ts` (wrapper de GitHub API, decodeBase64, encodeBase64)
  - `gemini.ts` (parseGeminiAction, detectPrimaryLanguage, temperatura Groq por modo, contexto de repo #41)
  - `formatResult.ts`, `releaseGenerator.ts`, `pdfReader.ts`, `pdfAdvanced.ts`
  - Hooks: `useChat`, `useActions`
  - Componentes React: `ChatArea`, `ChatInput`, `ConfirmModal`, `Header`, `TemplatePanel`, `AIProviderPanel`, `AIProviderBadge`, `RepoContextButton`
  - Servidor: `rateLimit.test.js`

**Pendiente:**
- Aumentar cobertura del 49% al 70% objetivo
- Añadir tests para módulos no cubiertos:
  - `App.tsx` (~0%, el mayor bloque — ver #42)
  - `HistoryContext.tsx`
  - `RepoSelector`
  - `DiffViewer`
  - Edge cases y errores en servicios existentes
- Configurar umbral mínimo de cobertura en CI (fail si < 70%)

**Beneficio:** Mayor confianza en cambios futuros; detección temprana de regresiones; documentación viva del comportamiento esperado.

**Nota:** Esta mejora es transversal — cada vez que se resuelva otra mejora (#16, #20, #22, #28, etc.), se deben añadir tests correspondientes.

---

#### #38 — Streaming de respuestas (SSE)
**Esfuerzo:** 5–6h

**Problema actual:** Toda respuesta de la IA se espera completa antes de mostrarse (`result.response.text()` en el proxy; `data.choices[0].message.content` en Groq). En generación de documentación o respuestas largas de chat, la UI se siente congelada durante varios segundos.

**Solución propuesta:**
- El proxy `/api/gemini` y `callGroq()` emiten tokens incrementales (Server-Sent Events / streaming de la API).
- `callAI()` expone un callback `onToken` opcional.
- `ChatArea` renderiza el texto a medida que llega.

**Beneficio:** UX percibida mucho mejor; feedback inmediato; sensación de fluidez equiparable a las apps de chat modernas.

---

#### #39 — ErrorBoundary + accesibilidad (a11y)
**Esfuerzo:** 4h

**Problema actual:** Un fallo de render en cualquier componente tumba toda la SPA (no hay red de seguridad de UI). Además, los modales (`ConfirmModal`, `DocModal`) carecen de focus-trap, roles ARIA y navegación por teclado completa.

**Solución propuesta:**
- `ErrorBoundary` de React en `main.tsx` envolviendo `Root`, con pantalla de error amable y opción de recargar.
- Focus-trap y `role="dialog"` / `aria-modal` en los modales; cierre con `Esc`; foco inicial gestionado.

**Beneficio:** Robustez de UI ante errores inesperados; accesibilidad para usuarios de teclado y lectores de pantalla.

---

#### #42 — Refactor y cobertura de `App.tsx`
**Esfuerzo:** 5–6h

**Problema actual:** `App.tsx` (~473 líneas, **0% de cobertura**) concentra la orquestación del chat, la detección de modo, los modales y el flujo multi-repo. Es el mayor bloque sin testear del proyecto y el principal foco de mantenibilidad.

**Solución propuesta:**
- Extraer lógica a hooks ya existentes (`useChat`, `useActions`) y a componentes propios (relacionado con #16 — extraer `DocModal`).
- Añadir tests para la lógica extraída (detección de modo, manejo de confirmación/ejecución).

**Beneficio:** Mejor mantenibilidad y separación de responsabilidades; sube de forma significativa la cobertura global (es el bloque dominante a 0%).

---

#### #44 — Dashboard de "Salud del Código" (Recharts)
**Esfuerzo:** 6–8h

**Problema actual:** El asistente responde en texto, pero algunas métricas de un repo se entienden mucho mejor visualmente.

**Solución propuesta:** Vista de visualización de datos en el frontend React (Recharts o Chart.js):
- Frecuencia de commits (línea temporal) — API de commits de GitHub.
- Deuda técnica: conteo de `TODO`/`FIXME` extraídos del árbol de archivos (reutiliza `fetchRepoTreeRecursive` de `github.ts`).
- Distribución de lenguajes (donut chart) — reutiliza `detectPrimaryLanguage` (`gemini.ts`).

**Beneficio:** Demostrar skills de Análisis de Datos aplicados a DevOps; aprovechar la experiencia previa con Power BI para diseñar dashboards en web.

---

#### #45 — Generación de documentación vía Draft PR
**Esfuerzo:** 4–5h

**Problema actual:** La documentación generada se entrega en el chat, obligando al usuario a copiar/pegar a mano.

**Solución propuesta:** Extender el flujo `handleDocumentRepo`/`handleCommitDocs` (`App.tsx`): crear un branch `docs/auto-{timestamp}`, subir los archivos y abrir un **Draft Pull Request**. Reutiliza funciones ya existentes en `github.ts`: `createBranch` y `createPullRequest`.

**Beneficio:** Entregable tangible — el usuario recibe un PR listo para revisar y mergear, automatizando el flujo completo. Alto ROI (casi toda la infraestructura ya existe).

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

### 🟢 Baja Prioridad

#### #31 — Sistema de feedback del usuario (👍/👎)
**Esfuerzo:** 4h

**Problema actual:** No hay forma de que el usuario indique si una respuesta fue útil o no.

**Solución propuesta:**
- Botones 👍/👎 en cada mensaje del asistente
- Almacenamiento en HistoryContext (solo sesión)
- Exportación de feedback en el log
- Métricas de satisfacción en panel de admin (futuro)

**Beneficio:** Mejora continua del asistente; datos para optimizar prompts; detección de respuestas problemáticas.

---

#### #32 — Resumir hilos de comentarios largos
**Esfuerzo:** 3h

**Problema actual:** Los hilos de issues/PRs largos son difíciles de seguir.

**Solución propuesta:** Nueva acción "resumir hilo" que:
- Obtiene todos los comentarios de un issue/PR
- Envía al LLM con prompt de resumen
- Muestra resumen estructurado en el chat

**Beneficio:** Ahorro de tiempo en revisión de PRs complejos; onboarding rápido a discusiones técnicas.

---

#### #33 — Sugerir revisores de código basándose en historial
**Esfuerzo:** 4h

**Problema actual:** Elegir revisores de PRs es subjetivo y manual.

**Solución propuesta:**
- Analizar git blame del repo
- Identificar autores más frecuentes en los archivos modificados
- Sugerir revisores con ranking de relevancia

**Beneficio:** PRs revisados más rápido; distribución equilibrada de carga de revisión.

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

#### #36 — Permisos GitHub más granulares
**Esfuerzo:** 3h

**Problema actual:** La app requiere scope `repo` (acceso total a todos los repos), lo cual es excesivo si solo se usan funciones de lectura.

**Solución propuesta:**
- Detectar qué permisos necesita cada acción
- Solicitar solo los scopes mínimos necesarios
- Advertir al usuario si una acción requiere permisos adicionales

**Beneficio:** Seguridad mejorada; principio de mínimo privilegio; mayor confianza del usuario.

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

#### #40 — Robustez IA/UX (cancelación, validación, persistencia de proveedor)
**Esfuerzo:** 5h (agrupa 3 sub-tareas)

**Problema actual:** No se puede abortar una generación larga; `parseGeminiAction()` solo valida 3 campos del JSON de acción; y el usuario debe re-seleccionar proveedor y modelo en cada recarga.

**Solución propuesta:**
- **Cancelación:** `AbortController` en `callAI()` + botón "Detener" mientras genera. Ahorra cuota y mejora la UX.
- **Validación estricta:** validar el JSON de acción con `zod` y una allowlist de métodos/endpoints, reforzando la garantía *proponer → confirmar → ejecutar*.
- **Persistencia parcial:** guardar **proveedor + modelo** (NUNCA la API key) en `sessionStorage`, respetando Zero-Storage, para no re-seleccionarlos en cada recarga.

**Beneficio:** Más control y robustez para el usuario; defensa adicional ante respuestas malformadas de la IA; mejor experiencia de reconexión.

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
| 🔴 Alta | 7 | 5 (#1, #2, #13, #14, #27) | 2 (#15, #28) |
| 🟡 Media | 19 | 7 (#12, #17, #18, #19, #21, #37, #41) | 12 (#16, #20, #22, #26, #29, #30, #38, #39, #42, #44, #45, #46) |
| 🟢 Baja | 11 | 0 | 11 (#23, #24, #25, #31, #32, #33, #34, #35, #36, #40, #48) |
| **TOTAL** | **37** | **12** | **25** |

---

## 📝 Convenciones

- Al resolver un punto → moverlo a la tabla ✅ con versión y SHA de commit
- Issues pendientes ordenados por prioridad dentro de cada bloque 🔴 / 🟡 / 🟢
- Crear commit: `docs: mark issue #X as resolved in vX.Y`
- Cada mejora debe incluir tests correspondientes (ver #26)
