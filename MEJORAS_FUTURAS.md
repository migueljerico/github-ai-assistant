# 🔮 Roadmap de Mejoras — Análisis del Código

Estado del código, mejoras pendientes y roadmap del proyecto.

**Actualizado a:** v2.3.0 · Junio 2026

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

---

## ⏳ Pendientes

Los issues están numerados y ordenados por prioridad descendente dentro de cada bloque. Al resolver un punto, moverlo a la tabla ✅ con versión y SHA de commit.

### 🔴 Alta Prioridad

#### #27 — Mejorar calidad de respuestas Groq ⚠️ URGENTE
**Esfuerzo:** 2–3h

**Problema actual:** Groq da respuestas genéricas tipo "plantilla" mientras que Gemini da análisis detallados y personalizados. Diagnóstico realizado:
- `callGroq()` no soporta el parámetro `mode` (siempre usa prompt de acción con JSON)
- Temperatura fija en `0.1` (demasiado baja para chat conversacional)
- System prompt incorrecto para modo conversacional

**Solución propuesta:**
- Añadir parámetro `mode` a `callGroq()` igual que en `callGeminiDirect()`
- Ajustar temperatura según modo: `0.1` para action, `0.7` para chat
- Usar el system prompt correcto según mode (CHAT_PROMPT vs ACTION_PROMPT)

**Beneficio:** Respuestas de Groq a la par de Gemini en calidad; experiencia de usuario consistente entre proveedores.

---

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

**Estado actual (v2.3.0):** ✅ Infraestructura completa implementada

**Progreso realizado:**
- ✅ Configuración de Vitest + Codecov
- ✅ CI/CD con GitHub Actions ejecutando tests automáticamente
- ✅ Badge de Codecov en README
- ✅ Cobertura actual: **32%**
- ✅ Tests implementados para:
  - `AuthContext.tsx` (login, logout, OAuth flow, Zero-Storage)
  - `AIProviderContext.tsx` (conexión/desconexión de proveedores)
  - `actionExecutor.ts` (ejecutor de acciones GitHub)
  - `github.ts` (wrapper de GitHub API, decodeBase64, encodeBase64)
  - `gemini.ts` (parseGeminiAction, detectPrimaryLanguage)
  - `formatResult.ts` (formateo de resultados de API)
  - Componentes React: `ChatArea`, `ChatInput`, `ConfirmModal`, `Header`

**Pendiente:**
- Aumentar cobertura del 32% al 70% objetivo
- Añadir tests para módulos no cubiertos:
  - `HistoryContext.tsx`
  - `TemplatePanel` y `RepoSelector`
  - `DiffViewer`
  - Edge cases y errores en servicios existentes
- Configurar umbral mínimo de cobertura en CI (fail si < 70%)

**Beneficio:** Mayor confianza en cambios futuros; detección temprana de regresiones; documentación viva del comportamiento esperado.

**Nota:** Esta mejora es transversal — cada vez que se resuelva otra mejora (#16, #20, #22, #27, #28, etc.), se deben añadir tests correspondientes.

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
- GitHub Actions CI — lint + build en cada push/PR a main (badge en README)
- Logs estructurados en el servidor (JSON con timestamp, level, requestId)
- Healthcheck extendido en `/health` (versión, uptime, estado de variables de entorno)
- Script `deploy.sh` automatizado para Cloud Run con validación previa de variables

---

## 📊 Resumen

| Prioridad | Total | ✅ Resueltos | ⏳ Pendientes |
|---|---|---|---|
| 🔴 Alta | 7 | 4 (#1, #2, #13, #14) | 3 (#15, #27, #28) |
| 🟡 Media | 11 | 5 (#12, #17, #18, #19, #21) | 6 (#16, #20, #22, #26, #29, #30) |
| 🟢 Baja | 9 | 0 | 9 (#23, #24, #25, #31, #32, #33, #34, #35, #36) |
| **TOTAL** | **27** | **9** | **18** |

---

## 📝 Convenciones

- Al resolver un punto → moverlo a la tabla ✅ con versión y SHA de commit
- Issues pendientes ordenados por prioridad dentro de cada bloque 🔴 / 🟡 / 🟢
- Crear commit: `docs: mark issue #X as resolved in vX.Y`
- Cada mejora debe incluir tests correspondientes (ver #26)
