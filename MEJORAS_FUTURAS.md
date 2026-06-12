# 🔮 Roadmap de Mejoras — Análisis del Código

> **Estado del código, mejoras pendientes y roadmap del proyecto** 
> Actualizado a: **v2.5** · Junio 2026

---

## ✅ Resueltos

| # | Punto | Archivo | Versión |
|---|-------|---------|---------|
| 1 | Verificación OAuth state (CSRF) | `server/index.js` | v2.0.1 |
| 2 | SESSION_SECRET obligatorio en producción | `server/index.js` | v2.0.1 |
| 3 | Calidad `generateRepoDocs()` — prompt estructurado | `services/gemini.ts` | v2.4 |
| 4 | Soporte método HTTP PATCH en `executeAction()` | `services/actionExecutor.ts` | v2.4 |
| 7 | Modelos Groq cargados dinámicamente desde API | `AIProviderPanel.tsx` | v2.2.0 |
| 8 | Truncamiento semántico por líneas (80 líneas) | `services/gemini.ts` | v2.5 · `c2553e92be` |
| 9 | `crypto.randomUUID()` en lugar de `Math.random()` | `App.tsx` | v2.5 · `87aa5c5b15` |
| 11 | Eliminación ESLint suppression en `AuthContext` | `context/AuthContext.tsx` | v2.4 |
| 12 | Nombre del proveedor IA dinámico en mensajes | `App.tsx` | v2.2.0 |

---

## ⏳ Pendientes

### Sprint 1 — Refactorización UI · ~40 min

#### **#5 — Extraer DocModal de App.tsx**
- **Esfuerzo:** 20 min · **Milestone:** [Sprint 1](https://github.com/migueljerico/github-ai-assistant/milestone/1)
- `DocModal` (~50 líneas) está embebido en `App.tsx`, dificultando reutilización y tests.
- **Solución:** Mover a `client/src/components/confirm/DocModal.tsx`

#### **#6 — Extraer formatResultData a utils**
- **Esfuerzo:** 20 min · **Milestone:** [Sprint 1](https://github.com/migueljerico/github-ai-assistant/milestone/1)
- Función pura sin dependencias React; debería vivir fuera del componente.
- **Solución:** Mover a `client/src/utils/formatResult.ts`

---

### Sprint 2 — DX & Consistencia · ~30 min

#### **#10 — Unificar cliente fetch con ghFetch()**
- **Esfuerzo:** 30 min · **Milestone:** [Sprint 3](https://github.com/migueljerico/github-ai-assistant/milestone/3)
- `actionExecutor.ts` usa `fetch()` directo; debería usar el wrapper `ghFetch()` de `github.ts`.
- **Solución:** Exportar `ghFetch()` e importarlo en el executor.

---

### Sprint 3 — Internacionalización · ~3-4h

#### **#13 — Soporte i18n con i18next**
- **Esfuerzo:** 3–4h · **Milestone:** [Sprint 3](https://github.com/migueljerico/github-ai-assistant/milestone/3)
- App 100% en español; añadir soporte EN mínimo con `i18next` + `react-i18next`.
- **Alcance:** strings de UI, system prompts adaptados al idioma, selector en header.

#### **#14 — Autocompletado de instrucciones en el chat**
- **Esfuerzo:** 2–3h · **Estado:** 💡 Idea nueva
- Sugerencias de instrucciones frecuentes al escribir en el chat (ej: "crea un repo", "documenta").
- **Solución:** Datalist HTML o dropdown con instrucciones predefinidas filtradas por input.

---

## 📊 Resumen

| Prioridad | Total | ✅ Resueltos | ⏳ Pendientes |
|-----------|-------|-------------|--------------|
| Alta | 5 | 5 | 0 |
| Media | 4 | 2 | 2 |
| Baja | 3 | 0 | 3 |
| **TOTAL** | **12** | **9** | **4** |

---

## 🔗 Documentación relacionada

- **[CHANGELOG.md](./CHANGELOG.md)** — Historial de versiones
- **[MANUAL_TECNICO.md](./MANUAL_TECNICO.md)** — Arquitectura completa
- **[README.md](./README.md)** — Descripción general y stack

---

## 📝 Convenciones

1. Al resolver un punto → moverlo a la tabla ✅ con versión y SHA de commit
2. Actualizar tabla de resumen
3. Crear commit: `docs: mark issue #X as resolved in vX.Y`

---

<p align="center">
  <sub>
    Análisis inicial: Claude (Anthropic) · Junio 2026 |
    Actualizado: v2.5 |
    Próxima revisión: v2.6
  </sub>
</p>
