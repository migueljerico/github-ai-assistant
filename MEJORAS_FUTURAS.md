# 🔮 Roadmap de Mejoras — Análisis del Código

> **Estado del código, mejoras pendientes y roadmap del proyecto** \
> Actualizado a: **v2.8** · Junio 2026

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
| 5 | Extraer `DocModal` a componente propio | `components/confirm/DocModal.tsx` | v2.6 · `8287ebc476` |
| 6 | Extraer `formatResultData` a utilidad pura | `utils/formatResult.ts` | v2.6 · `c7cf86211b` |
| 10 | Unificar cliente fetch — `ghFetch()` en `actionExecutor.ts` | `services/github.ts` + `actionExecutor.ts` | v2.7 · `3f55dbf49a` |
| 11 | Eliminación ESLint suppression en `AuthContext` | `context/AuthContext.tsx` | v2.4 |
| 12 | Nombre del proveedor IA dinámico en mensajes | `App.tsx` | v2.2.0 |
| 17 | Rate limiting en proxy Gemini (40 req/min) | `server/index.js` · `package.json` | v2.8 |

---

## ⏳ Pendientes

### Sprint — Internacionalización · ~3-4h

#### **#13 — Soporte i18n con i18next**
- **Esfuerzo:** 3–4h · **Milestone:** [Sprint 3](https://github.com/migueljerico/github-ai-assistant/milestone/3)
- App 100% en español; añadir soporte EN mínimo con `i18next` + `react-i18next`.
- **Alcance:** strings de UI, system prompts adaptados al idioma, selector en header.

#### **#14 — Autocompletado de instrucciones en el chat**
- **Esfuerzo:** 2–3h · **Estado:** 💡 Idea nueva
- Sugerencias de instrucciones frecuentes al escribir en el chat (ej: "crea un repo", "documenta").
- **Solución:** Datalist HTML o dropdown con instrucciones predefinidas filtradas por input.

---

### Sprint — Seguridad, Mantenibilidad y Multi-Proveedor · ~6-8h

#### **#15 — Migrar prompts largos a archivos externos**
- **Esfuerzo:** 2h
- Mover todos los system prompts largos a carpeta `client/src/prompts/`.

#### **#16 — Refactor de App.tsx — Extraer lógica a custom hooks**
- **Esfuerzo:** 2h
- Crear `hooks/useChat.ts` y `hooks/useActions.ts`.

#### ~~**#17 — Añadir rate limiting en proxy Gemini**~~ ✅ Resuelto
- **Esfuerzo:** 1h · **Versión:** v2.8
- Usar `express-rate-limit` en el endpoint `/api/gemini` (40 req/min).
- **Beneficio:** Protección contra abuso y rate limits excesivos.

#### **#18 — Soporte multi-proveedor (Together AI / OpenRouter)**
- **Esfuerzo:** 2h
- Añadir Together AI y fallback automático entre proveedores.

#### **#19 — Añadir tests unitarios básicos**
- **Esfuerzo:** 2h
- Cobertura mínima de `formatResult.ts`, `github.ts` y el proxy Gemini.

#### **#20 — Mejorar DX y despliegue**
- **Esfuerzo:** 1h
- Dockerizar el proyecto y añadir script de despliegue automatizado a Cloud Run.

---

## 📊 Resumen

| Prioridad | Total | ✅ Resueltos | ⏳ Pendientes |
|-----------|-------|-------------|--------------|
| Alta | 7 | 6 | 1 |
| Media | 6 | 4 | 2 |
| Baja | 4 | 1 | 3 |
| **TOTAL** | **17** | **11** | **6** |

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
    Actualizado: v2.8 |
    Próxima revisión: v3.0
  </sub>
</p>
