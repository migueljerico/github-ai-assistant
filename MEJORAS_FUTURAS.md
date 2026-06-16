# 🔮 Roadmap de Mejoras — Análisis del Código

> **Estado del código, mejoras pendientes y roadmap del proyecto** \
> Actualizado a: **v3.3** · Junio 2026 (Modo Dual Conversación, File Upload, Autocompletado)

---

## ✅ Resueltos

| # | Punto | Archivo | Versión |
|---|-------|---------|---------|
| 1 | Verificación OAuth state (CSRF) | `server/index.js` | v2.0.1 |
| 2 | SESSION_SECRET obligatorio en producción | `server/index.js` | v2.0.1 |
| 3 | Calidad `generateRepoDocs()` — prompt estructurado y tipos exportados | `services/gemini.ts` | v2.4 |
| 4 | Soporte método HTTP PATCH en `executeAction()` | `services/actionExecutor.ts` | v2.4 |
| 5 | Extraer `DocModal` a componente propio | `components/confirm/DocModal.tsx` | v2.6 · `8287ebc476` |
| 6 | Extraer `formatResultData` a utilidad pura | `utils/formatResult.ts` | v2.6 · `c7cf86211b` |
| 7 | Modelos Groq cargados dinámicamente desde API | `AIProviderPanel.tsx` | v2.2.0 |
| 8 | Truncamiento semántico por líneas (80 líneas) | `services/gemini.ts` | v2.5 · `c2553e92be` |
| 9 | `crypto.randomUUID()` en lugar de `Math.random()` | `App.tsx` | v2.5 · `87aa5c5b15` |
| 10 | Unificar cliente fetch — `ghFetch()` en `actionExecutor.ts` | `services/github.ts` + `actionExecutor.ts` | v2.7 · `3f55dbf49a` |
| 11 | Eliminación ESLint suppression en `AuthContext` | `context/AuthContext.tsx` | v2.4 |
| 12 | Nombre del proveedor IA dinámico en mensajes | `App.tsx` | v2.2.0 |
| 13 | Advertencia de caducidad de sesión (Zero-Storage TTL 8h) | `SessionWarningBanner.tsx` · `AuthContext.tsx` · `AIProviderContext.tsx` | v3.0 · `ef8f158` |
| 16 | Añadir tests unitarios con Vitest | `client/src/**/__tests__/` · `client/package.json` | v3.1 · `(pending)` |
| 17 | Rate limiting en proxy Gemini (40 req/min) | `server/index.js` · `package.json` | v2.8 |
| 24 | Añadir CONTRIBUTING.md | `CONTRIBUTING.md` | v3.1 · `(pending)` |
| 14 | Expansión de acciones GitHub: issues, PRs, branches, workflows | `types/index.ts` · `github.ts` · `actionExecutor.ts` · `gemini.ts` | v3.2 · `bee3e86` |
| 22 | Autocompletado de instrucciones en el chat | `utils/instructionSuggestions.ts` | v3.3 · `b0aab89` |

---

## ⏳ Pendientes

> Los issues están numerados y ordenados por **prioridad descendente** dentro de cada bloque.
> Al resolver un punto, moverlo a la tabla ✅ con versión y SHA de commit.

---

### 🔴 Alta Prioridad



#### **#15 — Soporte multi-proveedor con fallback (Together AI / OpenRouter / Ollama)**
- **Esfuerzo:** 3–4h
- **Proveedores evaluados:**

| Proveedor | Ventajas | Tier gratuito | Prioridad |
|-----------|----------|---------------|-----------|
| **Together AI** | Llama 3.1, Qwen2.5, DeepSeek, Mistral | Generoso | ⭐ Alta |
| **OpenRouter** | Router a decenas de modelos, incluyendo gratuitos | Free credits + pay-per-use | ⭐ Alta |
| **Ollama (local)** | 100% privado, sin red, sin límites | Ilimitado (hardware propio) | ⭐ Alta (portfolio) |
| **Fireworks AI** | Muy rápido en modelos grandes | Buen free tier | Media |
| **DeepInfra** | Barato y rápido | Tier gratuito | Media |
| **Hugging Face** | Miles de modelos para tareas específicas | Free tier | Baja |

- **Arquitectura sugerida:** Groq → Together AI → Gemini como cadena de fallback con selector de prioridad en el panel de IA.
- **Beneficio:** Resiliencia ante cortes de servicio; diferenciador claro frente a apps mono-proveedor.



---

### 🟡 Media Prioridad

#### **#18 — Mejor manejo de errores de rate limit de GitHub API**
- **Esfuerzo:** 1h
- Los errores 429 de GitHub API se muestran actualmente como errores genéricos sin contexto temporal.
- **Solución:** Leer la cabecera `X-RateLimit-Reset` de la respuesta y mostrar "Rate limit alcanzado. Disponible en X minutos." con countdown opcional.
- **Beneficio:** UX clara; el usuario entiende qué esperar y no reintenta en bucle.

#### **#19 — Refactor de App.tsx — Extraer lógica a custom hooks**
- **Esfuerzo:** 2h
- `App.tsx` actúa como orquestador principal y acumula lógica de negocio que dificulta la lectura y el testing.
- **Solución:** Crear `hooks/useChat.ts` (lógica de `handleSend`, historial de mensajes) y `hooks/useActions.ts` (confirmación, ejecución, log de sesión).
- **Beneficio:** `App.tsx` queda como orquestador puro; cada hook es testeable de forma aislada.

#### **#20 — Migrar prompts largos a archivos externos**
- **Esfuerzo:** 2h
- Los system prompts están incrustados como template literals en los archivos `.ts`, dificultando su edición y lectura.
- **Solución:** Mover todos los prompts a `client/src/prompts/` como archivos `.md` y cargarlos en runtime con `import ... as text`.
- **Beneficio:** Edición sin tocar código TypeScript; base para futura internacionalización de prompts.

#### **#21 — Internacionalización (i18n) con i18next**
- **Esfuerzo:** 3–4h · **Milestone:** [Sprint 3](https://github.com/migueljerico/github-ai-assistant/milestone/3)
- La app es 100% en español. Añadir soporte EN mínimo con `i18next` + `react-i18next`.
- **Alcance:** strings de UI, system prompts adaptados al idioma, selector en header.
- **Dependencia:** Recomendable completar #20 antes — facilita la i18n de prompts.

---

### 🟢 Baja Prioridad



#### **#23 — Mejorar DX y pipeline de despliegue**
- **Esfuerzo:** 2–3h
- **Tareas:**
  - **GitHub Actions CI** — lint + build en cada push/PR a main (badge en README)
  - Logs estructurados en el servidor (JSON con timestamp, level, requestId)
  - Healthcheck extendido en `/health` (versión, uptime, estado de variables de entorno)
  - Script `deploy.sh` automatizado para Cloud Run con validación previa de variables



---

## 📊 Resumen

| Prioridad | Total | ✅ Resueltos | ⏳ Pendientes |
|-----------|-------|-------------|--------------|
| 🔴 Alta | 9 | 8 | 1 |
| 🟡 Media | 6 | 5 | 1 |
| 🟢 Baja | 5 | 3 | 2 |
| **TOTAL** | **20** | **18** | **2** |

---

## 🔗 Documentación relacionada

- **[CHANGELOG.md](./CHANGELOG.md)** — Historial de versiones
- **[MANUAL_TECNICO.md](./MANUAL_TECNICO.md)** — Arquitectura completa
- **[README.md](./README.md)** — Descripción general y stack

---

## 📝 Convenciones

1. Al resolver un punto → moverlo a la tabla ✅ con versión y SHA de commit
2. Issues pendientes ordenados por prioridad dentro de cada bloque 🔴 / 🟡 / 🟢
3. Crear commit: `docs: mark issue #X as resolved in vX.Y`

---

<p align="center">
  <sub>
    Análisis inicial: Claude (Anthropic) · Junio 2026 |
    Actualizado: v3.0 |
    Próxima revisión: v3.0
  </sub>
</p>
