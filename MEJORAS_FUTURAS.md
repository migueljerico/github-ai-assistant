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

**Nota:** Esta mejora es transversal — cada vez que se resuelva otra mejora (#16, #20, #22, etc.), se deben añadir tests correspondientes.

---

### 🟢 Baja Prioridad

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
| 🔴 Alta | 3 | 2 (#13, #14) | 1 (#15) |
| 🟡 Media | 8 | 4 (#17, #18, #19, #21) | 4 (#16, #20, #22, #26) |
| 🟢 Baja | 3 | 0 | 3 (#23, #24, #25) |
| **TOTAL** | **14** | **6** | **8** |

---

## 📝 Convenciones

- Al resolver un punto → moverlo a la tabla ✅ con versión y SHA de commit
- Issues pendientes ordenados por prioridad dentro de cada bloque 🔴 / 🟡 / 🟢
- Crear commit: `docs: mark issue #X as resolved in vX.Y`
- Cada mejora debe incluir tests correspondientes (ver #26)
