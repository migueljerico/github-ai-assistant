# 🔮 Roadmap de Mejoras Pendientes

Plan de trabajo activo y tareas pendientes para el proyecto **Asistente de IA de GitHub**.

**Actualizado a:** v4.0.44 — Septiembre 2026

> 📜 **Historial de Mejoras Implementadas:** Para consultar las 100+ características y correcciones resueltas desde la v1.0.0 a la v4.0.33, consulta el [Historial de Mejoras (`HISTORIAL_MEJORAS.md`)](HISTORIAL_MEJORAS.md).


---

## 📖 Convenciones del documento

- Los IDs (`#1`–`#58`) corresponden a **issues reales del repositorio GitHub** y se conservan para trazabilidad.
- Los ítems que no tuvieron issue propio se numeran desde **`#59`** en adelante.
- Las prioridades (🔴 Alta / 🟡 Media / 🟢 Baja) guían la planificación de los siguientes sprints.

---

## ⏳ Tareas y Mejoras Pendientes

### 🔴 Alta Prioridad

#### #26 — Mantener y expandir cobertura de tests con Codecov
**Esfuerzo:** Continuo (2-4h por sprint) · **Estado:** 🔄 En progreso

**Progreso realizado (v4.0.44):** ✅ Infraestructura completa, reglas permanentes documentadas y suites ampliadas
- ✅ Vitest + Codecov + CI con GitHub Actions (cliente + servidor)
- ✅ Badge de Codecov en README
- ✅ **1.303 tests en el cliente (75 suites) + 60 en el servidor (8 suites)** = **1.363 unitarios** + **13 tests E2E** con Playwright. Cobertura del 100% de diff patch para Codecov, `gemini.ts` al 100% de statements, `DocumentFlowModal.tsx` al 100% de funciones y 100% de statements, y `assistantActions.ts` al 98,22% de statements.
- ✅ Cobertura del 100% alcanzada en `gemini.ts` (statements), `github.ts`, `docPublisher.ts`, `threadSummary.ts`, `DocumentFlowModal.tsx` (funciones y statements), `ErrorBoundary`, `FileAttachButton`, `AIProviderContext`, `ConfirmModal`, `useModalDialog`, `ChatMessage` (líneas), `DocumentRepoButton`, `ChangelogButton`, `CodeHealthButton`, `ConversationIOButton`, `AIProviderBadge`, `LanguageSelector` y utilidades/hooks (`repoRef`, `docxReader`, `useDocTargetSelector`, `modelLabels`, `retry`).


**Pendiente:**
- Cobertura de edge cases en nuevos servicios y proveedores.
- Cobertura de ramas defensivas inalcanzables (catch de `pdfReader.ts`, guard de `DiffViewer.tsx`): valorar exclusión o refactor antes que tests artificiales.

---

### 🟡 Media Prioridad

#### #77 — Streaming en la generación de documentación con timeout por inactividad
**Esfuerzo:** ~6-8h · **Estado:** ⏳ Pendiente

**Contexto (v4.0.44):** la documentación completa hace dos llamadas no-streaming secuenciales (README + MANUAL_TECNICO) con timeout absoluto de 600 s por llamada. Los modelos de razonamiento pesados (p. ej. Qwen 3.8 Max vía QwenCloud) en repos muy grandes pueden acercarse o superar ese techo, y subir timeouts indefinidamente no es sostenible: el usuario espera a ciegas sin progreso visible.

**Propuesta:**
1. Generar las docs con **streaming SSE** (la infraestructura ya existe: `pipeUpstream` en el proxy y `onToken` en `callAI`) y sustituir el timeout absoluto por un **timeout por inactividad** (abortar solo si pasan N segundos sin recibir ningún chunk).
2. **Reducción adaptativa de contexto** para modelos de razonamiento (menos archivos/líneas por llamada cuando el modelo es lento o el repo enorme), en el espíritu del presupuesto adaptativo de chat (#50).
3. Progreso visible en `DocumentFlowModal` (documento que se está generando, tokens/chunks recibidos).

---

### 🟢 Baja Prioridad

#### #66 — Revisión periódica del catálogo Gemini (cada 2-3 meses)
**Esfuerzo:** ~1h cada revisión · **Estado:** ⏳ Pendiente (Próxima revisión: ~Octubre 2026)

**Contexto:** El catálogo de Gemini es estático (`GEMINI_MODELS` en `client/src/services/providers.ts`, 19 modelos) para garantizar fiabilidad y evitar incluir modelos no-chat expuestos por la API de Google.

**Procedimiento de revisión:**
1. Consultar la API oficial de Google Gemini (`GET /v1beta/models`).
2. Comparar la lista devuelta filtrando modelos de imagen, audio o robótica.
3. Actualizar el array estático `GEMINI_MODELS` y sus traducciones i18n.

---

#### #74 — Revisión periódica de catálogos free/dinámicos (cada 2-3 meses)
**Esfuerzo:** ~1-2h cada revisión · **Estado:** ⏳ Pendiente (Próxima revisión: ~Octubre 2026)


**Procedimiento de revisión:**
1. Consultar endpoints reales de los proveedores dinámicos.
2. Refrescar los fallbacks `*_FALLBACK` con los modelos de tier gratuito más recientes.
3. Ajustar la lógica de detección `free` en `fetchModels()`.

---

## 📊 Resumen del Estado del Proyecto

| Categoría | Cantidad | Referencia |
|---|---|---|
| ✅ **Mejoras Implementadas** | 80 ítems | [HISTORIAL_MEJORAS.md](HISTORIAL_MEJORAS.md) |
| ⏳ **Pendientes Activos** | 4 ítems (#26, #66, #74, #77) | Secciones superiores |
| 🗑️ **Descartados / Inviables** | 3 ítems (#33, #35, #36) | [HISTORIAL_MEJORAS.md](HISTORIAL_MEJORAS.md) |

---

## ⚠️ Vulnerabilidades conocidas

### `xlsx` (SheetJS CE) — Prototype Pollution + ReDoS — MITIGADO v3.36.1 (#62)
- Límite de 10 MB antes de parsear hojas Excel/CSV.
- Validación básica post-parseo y aviso UI.
- No migrar a `exceljs` (+4 MB de sobrecoste al bundle).
