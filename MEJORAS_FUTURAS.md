# 🔮 Roadmap de Mejoras Pendientes

Plan de trabajo activo y tareas pendientes para el proyecto **Asistente de IA de GitHub**.

**Actualizado a:** v4.0.51 — Octubre 2026

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

**Progreso realizado (v4.0.50, 2026-10-17):** ✅ Sprint de lagunas concretas — rama dinámica de Gemini en `fetchModels` (def override de `modelsEndpoint`), catch defensivo de `extractMashup` con ZIP interno corrupto (`powerbiReader.ts`), BOM UTF-8 en `document.xml` (`docxReader`) y 5 tests del watchdog de inactividad (`retry.ts`). Suite: **1.349 tests en el cliente (76 suites) + 68 en el servidor (9 suites) = 1.417 unitarios** (+13 vs v4.0.49) + 13 E2E. Cobertura global 97,93% statements / 99,43% lines; `retry.ts` con el watchdog nuevo cubierto al 100% de sus ramas nuevas; `providers.ts` al 100% de líneas.

**Progreso realizado (v4.0.48):** ✅ Infraestructura completa, reglas permanentes documentadas y suites ampliadas
- ✅ Vitest + Codecov + CI con GitHub Actions (cliente + servidor)
- ✅ Badge de Codecov en README
- ✅ **1.335 tests en el cliente (75 suites) + 68 en el servidor (9 suites)** = **1.403 unitarios** + **13 tests E2E** con Playwright. Cobertura del 100% de diff patch para Codecov, `gemini.ts` al 100% de statements, `DocumentFlowModal.tsx` al 100% de funciones y 100% de statements, y `assistantActions.ts` al 98,22% de statements.
- ✅ Cobertura del 100% alcanzada en `gemini.ts` (statements), `github.ts`, `docPublisher.ts`, `threadSummary.ts`, `DocumentFlowModal.tsx` (funciones y statements), `ErrorBoundary`, `FileAttachButton`, `AIProviderContext`, `ConfirmModal`, `useModalDialog`, `ChatMessage` (líneas), `DocumentRepoButton`, `ChangelogButton`, `CodeHealthButton`, `ConversationIOButton`, `AIProviderBadge`, `LanguageSelector` y utilidades/hooks (`repoRef`, `docxReader`, `useDocTargetSelector`, `modelLabels`, `retry`).


**Pendiente:**
- Cobertura de edge cases en nuevos servicios y proveedores.
- Cobertura de ramas defensivas inalcanzables (catch de `pdfReader.ts`, guard de `DiffViewer.tsx`): valorar exclusión o refactor antes que tests artificiales.

---

### 🟢 Baja Prioridad

#### #66 — Revisión periódica del catálogo Gemini (cada 2-3 meses)
**Esfuerzo:** ~1h cada revisión · **Estado:** ⏳ Pendiente (Próxima revisión: ~Enero 2027)

**Contexto:** El catálogo de Gemini es estático (`GEMINI_MODELS` en `client/src/services/providers.ts`, 15 modelos desde v4.0.49) para garantizar fiabilidad y evitar incluir modelos no-chat expuestos por la API de Google.

**Progreso realizado (v4.0.49, 2026-10-15):** ✅ Revisión anticipada (la programada para ~Octubre 2026): catálogo 20→15 con la API oficial como referencia (4 modelos apagados por Google fuera, 2 deprecados el 08-oct fuera, flagship `gemini-4-argon` dentro con i18n ×13). Próxima revisión programada: ~Enero 2027.

**Procedimiento de revisión:**
1. Consultar la API oficial de Google Gemini (`GET /v1beta/models`).
2. Comparar la lista devuelta filtrando modelos de imagen, audio o robótica.
3. Actualizar el array estático `GEMINI_MODELS` y sus traducciones i18n.

---

#### #74 — Revisión periódica de catálogos free/dinámicos (cada 2-3 meses)
**Esfuerzo:** ~1-2h cada revisión · **Estado:** ⏳ Pendiente (Próxima revisión: ~Enero 2027)


**Procedimiento de revisión:**
1. Consultar endpoints reales de los proveedores dinámicos.
2. Refrescar los fallbacks `*_FALLBACK` con los modelos de tier gratuito más recientes.
3. Ajustar la lógica de detección `free` en `fetchModels()`.

**Progreso realizado (v4.0.47, 2026-09-05):** ✅ Auditoría integral anticipada de los 11 proveedores (metodología del fix de OpenCode): verificación en vivo de todos los endpoints de chat/modelos y reconstrucción de los fallbacks de OpenRouter, NIM, Zenmux, OpenZen, Ollama, Kilo y BazaarLink con ids verificados — 4 defaultModel muertos corregidos (OpenRouter, Zenmux, Kilo, BazaarLink). Gemini (#66), Cloudflare y QwenCloud quedan para la revisión programada de ~Octubre 2026 (requieren key/account en vivo).

**Progreso realizado (v4.0.49, 2026-10-15):** ✅ Segunda auditoría (continuación de la v4.0.47, misma metodología de verificación en vivo): ids muertos fuera y vigentes dentro en Groq (compounds retirados 21-sep), OpenRouter, OpenCode Zen, Kilo (default `stepfun/step-5-preview-free`), Ollama (18 modelos = catálogo vivo), NIM (`deepseek-v4.1-flash`, feed NGC featured-models), QwenCloud (fichas oficiales; retiradas del 10-oct) y Cloudflare (`CF_NOT_FREE` a la tarifa 09-oct, cliente + proxy); Gemini (#66) y los "pendientes key/account" de la v4.0.47 quedan así cubiertos vía fuentes oficiales. Zenmux y BazaarLink verificados sin cambios. Próxima revisión programada: ~Enero 2027.

---

## 📊 Resumen del Estado del Proyecto

| Categoría | Cantidad | Referencia |
|---|---|---|
| ✅ **Mejoras Implementadas** | 81 ítems | [HISTORIAL_MEJORAS.md](HISTORIAL_MEJORAS.md) |
| ⏳ **Pendientes Activos** | 3 ítems (#26, #66, #74) | Secciones superiores |
| 🗑️ **Descartados / Inviables** | 3 ítems (#33, #35, #36) | [HISTORIAL_MEJORAS.md](HISTORIAL_MEJORAS.md) |

---

## ⚠️ Vulnerabilidades conocidas

### `xlsx` (SheetJS CE) — Prototype Pollution + ReDoS — MITIGADO v3.36.1 (#62)
- Límite de 10 MB antes de parsear hojas Excel/CSV.
- Validación básica post-parseo y aviso UI.
- No migrar a `exceljs` (+4 MB de sobrecoste al bundle).
