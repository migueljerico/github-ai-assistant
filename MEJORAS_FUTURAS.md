# 🔮 Roadmap de Mejoras Pendientes

Plan de trabajo activo y tareas pendientes para el proyecto **Asistente de IA de GitHub**.

**Actualizado a:** v4.0.1 — Agosto 2026

> 📜 **Historial de Mejoras Implementadas:** Para consultar las 57+ características y correcciones resueltas desde la v1.0.0 a la v4.0.1, consulta el [Historial de Mejoras (`HISTORIAL_MEJORAS.md`)](HISTORIAL_MEJORAS.md).

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

**Progreso realizado (v4.0.1):** ✅ Infraestructura completa
- ✅ Vitest + Codecov + CI con GitHub Actions (cliente + servidor)
- ✅ Badge de Codecov en README
- ✅ **1.014 tests en el cliente (68 suites) + 58 en el servidor (8 suites)** = **1.072 unitarios** + **13 tests E2E** con Playwright. Cobertura amplia de contextos, services, utils, hooks y componentes.

**Pendiente:**
- Aumentar la cobertura global al 70%+ objetivo.
- Cobertura de edge cases en nuevos servicios y proveedores.
- Configurar umbral mínimo de cobertura en CI (fail si < 70%).

---

### 🟡 Media Prioridad

#### #76 — Menú progresivo de herramientas avanzadas del chat (`ChatToolsMenu`)
**Esfuerzo:** ~4-6h · **Estado:** ⏳ Pendiente

> 🤖 **Dogfooding:** Propuesta generada por **QwenCloud · Qwen 3.8 Max** al usar la propia app (sesión de chat, 2026-08-06) y analizar el contexto real del repositorio. La IA detectó de forma autónoma el problema de sobrecarga visual de la barra de herramientas del chat y propuso la solución de revelado progresivo.

**Contexto:** La barra de herramientas del chat expone actualmente 9 botones especializados de forma simultánea:
`DocumentRepoButton`, `ThreadSummaryButton`, `ChangelogButton`, `CodeHealthButton`, `SecurityAuditButton`, `SyncRepoStatusButton`, `ConversationIOButton`, `RepoContextButton`, `FileAttachButton`.

Para usuarios sin experiencia técnica — el público objetivo principal de la app — esta densidad puede resultar intimidante y reducir la curva de entrada.

**Solución propuesta:** Crear un componente `ChatToolsMenu` que agrupe los botones avanzados bajo un menú desplegable "⚙️ Más herramientas", manteniendo visible solo los esenciales.

**Barra principal (siempre visible):**
1. 📄 Documentar repo
2. 📎 Adjuntar archivo
3. ⚙️ Más herramientas *(menú desplegable)*

**Dentro de "Más herramientas":**
- Generar changelog
- Salud del código
- Auditoría de seguridad
- Resumir hilo
- Exportar / importar conversación
- Estado del repo

**Criterios de aceptación:**
- El usuario nuevo ve ≤ 3 botones al abrir el chat.
- Las herramientas avanzadas siguen accesibles desde el menú.
- No se elimina ninguna funcionalidad existente.
- Textos nuevos traducidos en los 13 idiomas (i18n).
- Tests actualizados para el nuevo menú.
- Accesibilidad por teclado preservada (WCAG 2.4.7).

**Archivos afectados:**
- `client/src/components/chat/ChatToolsMenu.tsx` *(nuevo)*
- `client/src/components/chat/ChatInput.tsx` *(modificar)*
- `client/src/i18n/es.ts`, `en.ts` y los 11 idiomas globales
- `client/src/components/chat/__tests__/ChatToolsMenu.test.tsx` *(nuevo)*

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

**Contexto:** La app soporta 10 proveedores de IA. Los arrays `*_FALLBACK` de los 6 proveedores dinámicos (Groq, OpenRouter, Zenmux, Ollama, Ai&, Kilo) sirven como red de seguridad cuando la red falla.

**Procedimiento de revisión:**
1. Consultar endpoints reales de los proveedores dinámicos.
2. Refrescar los fallbacks `*_FALLBACK` con los modelos de tier gratuito más recientes.
3. Ajustar la lógica de detección `free` en `fetchModels()`.

---

## 📊 Resumen del Estado del Proyecto

| Categoría | Cantidad | Referencia |
|---|---|---|
| ✅ **Mejoras Implementadas** | 57 ítems | [HISTORIAL_MEJORAS.md](HISTORIAL_MEJORAS.md) |
| ⏳ **Pendientes Activos** | 4 ítems (#26, #76, #66, #74) | Secciones superiores |
| 🗑️ **Descartados / Inviables** | 3 ítems (#33, #35, #36) | [HISTORIAL_MEJORAS.md](HISTORIAL_MEJORAS.md) |

---

## ⚠️ Vulnerabilidades conocidas

### `xlsx` (SheetJS CE) — Prototype Pollution + ReDoS — MITIGADO v3.36.1 (#62)
- Límite de 10 MB antes de parsear hojas Excel/CSV.
- Validación básica post-parseo y aviso UI.
- No migrar a `exceljs` (+4 MB de sobrecoste al bundle).
