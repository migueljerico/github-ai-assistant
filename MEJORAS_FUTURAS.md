# 🔮 Roadmap de Mejoras Pendientes

Plan de trabajo activo y tareas pendientes para el proyecto **Asistente de IA de GitHub**.

**Actualizado a:** v4.0.37 — Agosto 2026

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

**Progreso realizado (v4.0.37):** ✅ Infraestructura completa, reglas permanentes documentadas y suites ampliadas
- ✅ Vitest + Codecov + CI con GitHub Actions (cliente + servidor)
- ✅ Badge de Codecov en README
- ✅ **1.261 tests en el cliente (75 suites) + 60 en el servidor (8 suites)** = **1.321 unitarios** + **13 tests E2E** con Playwright. Cobertura del 100% de diff patch para Codecov, `gemini.ts` al 100% de líneas, `DocumentFlowModal.tsx` al 100% de funciones y 100% de líneas, y `assistantActions.ts` al 98,16% de líneas.
- ✅ Cobertura del 100% alcanzada en `gemini.ts` (líneas), `github.ts`, `docPublisher.ts`, `threadSummary.ts`, `DocumentFlowModal.tsx` (funciones y líneas), `ErrorBoundary`, `FileAttachButton`, `AIProviderContext`, `ConfirmModal`, `useModalDialog`, `ChatMessage` (líneas), `DocumentRepoButton`, `ChangelogButton`, `CodeHealthButton`, `ConversationIOButton`, `AIProviderBadge`, `LanguageSelector` y utilidades/hooks (`repoRef`, `docxReader`, `useDocTargetSelector`, `modelLabels`, `retry`).


**Pendiente:**
- Cobertura de edge cases en nuevos servicios y proveedores.
- Cobertura de ramas defensivas inalcanzables (catch de `pdfReader.ts`, guard de `DiffViewer.tsx`): valorar exclusión o refactor antes que tests artificiales.

---

### 🟡 Media Prioridad

*(Sin tareas de prioridad media en este momento)*

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
| ⏳ **Pendientes Activos** | 3 ítems (#26, #66, #74) | Secciones superiores |
| 🗑️ **Descartados / Inviables** | 3 ítems (#33, #35, #36) | [HISTORIAL_MEJORAS.md](HISTORIAL_MEJORAS.md) |

---

## ⚠️ Vulnerabilidades conocidas

### `xlsx` (SheetJS CE) — Prototype Pollution + ReDoS — MITIGADO v3.36.1 (#62)
- Límite de 10 MB antes de parsear hojas Excel/CSV.
- Validación básica post-parseo y aviso UI.
- No migrar a `exceljs` (+4 MB de sobrecoste al bundle).
