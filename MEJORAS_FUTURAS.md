# 🔮 Roadmap de Mejoras Pendientes

Plan de trabajo activo y tareas pendientes para el proyecto **Asistente de IA de GitHub**.

**Actualizado a:** v4.0.13 — Agosto 2026

> 📜 **Historial de Mejoras Implementadas:** Para consultar las 80+ características y correcciones resueltas desde la v1.0.0 a la v4.0.13, consulta el [Historial de Mejoras (`HISTORIAL_MEJORAS.md`)](HISTORIAL_MEJORAS.md).

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

**Progreso realizado (v4.0.13):** ✅ Infraestructura completa y documentación sincronizada en `/docs`
- ✅ Vitest + Codecov + CI con GitHub Actions (cliente + servidor)
- ✅ Badge de Codecov en README
- ✅ **1.084 tests en el cliente (72 suites) + 58 en el servidor (8 suites)** = **1.142 unitarios** + **13 tests E2E** con Playwright. Cobertura global mantenida al **95.54% en líneas** y **83.23% en ramas**. Cobertura del 100% alcanzada en componentes (`DocumentRepoButton`, `ChangelogButton`, `CodeHealthButton`, `ConversationIOButton`, `AIProviderBadge`, `LanguageSelector`) y utilidades/hooks (`repoRef`, `docxReader`, `useModalDialog`, `useDocTargetSelector`).


**Pendiente:**
- Aumentar la cobertura global al 70%+ objetivo.
- Cobertura de edge cases en nuevos servicios y proveedores.
- Configurar umbral mínimo de cobertura en CI (fail si < 70%).

---

### 🟡 Media Prioridad

*(Sin tareas de prioridad media en este momento)*

---

### 🟢 Baja Prioridad

#### #66 — Revisión periódica del catálogo Gemini (cada 2-3 meses)
**Esfuerzo:** ~1h cada revisión · **Estado:** ⏳ Pendiente (Próxima revisión: ~Octubre 2026)

**Contexto:** El catálogo de Gemini es estático (`GEMINI_MODELS` en `client/src/services/providers.ts`, 18 modelos) para garantizar fiabilidad y evitar incluir modelos no-chat expuestos por la API de Google.

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
