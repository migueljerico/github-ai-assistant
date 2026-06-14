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

### Sprint — Seguridad, Mantenibilidad y Multi-Proveedor · ~8-10h

#### **#15 — Migrar prompts largos a archivos externos**
- **Esfuerzo:** 2h
- Mover todos los system prompts largos a carpeta `client/src/prompts/`.
- **Beneficio:** Legibilidad, edición sin tocar código TypeScript, posibilidad de i18n por prompt.

#### **#16 — Refactor de App.tsx — Extraer lógica a custom hooks**
- **Esfuerzo:** 2h
- Crear `hooks/useChat.ts` (lógica de `handleSend`, historial de mensajes) y `hooks/useActions.ts` (confirmación, ejecución, log de sesión).
- **Beneficio:** App.tsx queda como orquestador puro; cada hook es testeable de forma aislada.

#### ~~**#17 — Añadir rate limiting en proxy Gemini**~~ ✅ Resuelto
- **Esfuerzo:** 1h · **Versión:** v2.8
- Usar `express-rate-limit` en el endpoint `/api/gemini` (40 req/min).
- **Beneficio:** Protección contra abuso y rate limits excesivos de la API de Gemini.

#### **#18 — Soporte multi-proveedor (Together AI / OpenRouter / Ollama)**
- **Esfuerzo:** 3–4h
- Implementar un sistema de fallback configurable entre proveedores.
- **Proveedores evaluados:**

| Proveedor | Ventajas | Tier gratuito | Prioridad |
|-----------|----------|---------------|-----------|
| **Together AI** | Llama 3.1, Qwen2.5, DeepSeek, Mistral | Generoso | ⭐ Alta |
| **OpenRouter** | Router a decenas de modelos, incluyendo gratuitos | Free credits + pay-per-use | ⭐ Alta |
| **Fireworks AI** | Muy rápido en modelos grandes, buen contexto | Buen free tier | Media |
| **DeepInfra** | Barato y rápido, buena selección | Tier gratuito | Media |
| **Ollama (local)** | 100% privado, sin red, sin límites | Ilimitado (hardware propio) | ⭐ Alta (portfolio) |
| **Hugging Face** | Miles de modelos para tareas específicas | Free tier | Baja |

- **Arquitectura sugerida:** Groq → Together AI → Gemini como cadena de fallback con selector de prioridad en el panel de IA.

#### **#19 — Añadir tests unitarios básicos**
- **Esfuerzo:** 2–3h
- Añadir Vitest (ya en el ecosistema Vite) para cobertura mínima de las funciones críticas.
- **Targets prioritarios:**
  - `parseGeminiAction()` — parseo de JSON desde respuesta del modelo
  - `detectPrimaryLanguage()` — detección de lenguaje de archivos del repo
  - `extractJSON()` — extracción robusta de bloques JSON en texto libre
  - `formatResultData()` — ya extraído como utilidad pura, ideal para empezar
  - Proxy `/api/gemini` — tests de integración con supertest

#### **#20 — Mejorar DX y despliegue**
- **Esfuerzo:** 2–3h
- **Tareas:**
  - Añadir **GitHub Actions CI** (lint + build en cada push/PR a main)
  - Logs estructurados en el servidor (JSON con timestamp, level, requestId)
  - Healthcheck extendido en `/health` (versión, uptime, estado de variables de entorno)
  - Script `deploy.sh` automatizado para Cloud Run con validación previa de variables

---

### Sprint — Expansión Funcional · ~5-7h

#### **#21 — Advertencia de caducidad de sesión (sessionStorage TTL)**
- **Esfuerzo:** 1–2h · **Prioridad:** Alta
- Los tokens de GitHub y las claves de IA se guardan en `sessionStorage` sin ninguna indicación de caducidad para el usuario.
- **Solución:** Guardar timestamp al conectar y mostrar un aviso visual (banner o tooltip) cuando el token de GitHub lleve más de X horas activo, o cuando la pestaña lleve mucho tiempo abierta. No es bloqueo forzado, es UX defensiva.
- **Beneficio:** El usuario sabe cuándo reconnectar antes de que una acción falle por token expirado.

#### **#22 — Mejor manejo de errores de rate limit de GitHub API**
- **Esfuerzo:** 1h · **Prioridad:** Media
- Actualmente los errores 429 de GitHub API se muestran como errores genéricos.
- **Solución:** Leer la cabecera `X-RateLimit-Reset` de la respuesta de GitHub y mostrar al usuario "Rate limit de GitHub alcanzado. Disponible de nuevo en X minutos." con un countdown visual opcional.
- **Beneficio:** UX mucho más clara; el usuario entiende qué esperar y no reintenta en bucle.

#### **#23 — Expansión de acciones GitHub: issues, PRs, branches, workflows**
- **Esfuerzo:** 3–4h · **Prioridad:** Alta
- La app actualmente opera principalmente sobre contenido de archivos y metadatos de repos.
- **Acciones a añadir (por orden de impacto):**
  1. **Issues:** crear, cerrar, comentar, listar (muy solicitado en portfolios)
  2. **Branches:** crear, borrar, listar, proteger rama main
  3. **Pull Requests:** crear, listar, merge básico
  4. **GitHub Actions workflows:** listar, relanzar un workflow fallido
- **Beneficio:** Convierte la app en un gestor de proyecto completo sobre GitHub, no solo de contenido.

#### **#24 — Añadir CONTRIBUTING.md**
- **Esfuerzo:** 1h · **Prioridad:** Baja
- Documento estándar para proyectos open-source: cómo configurar el entorno local, convenciones de commits, cómo abrir PRs.
- **Beneficio:** Señal de madurez del proyecto en el portfolio; GitHub lo enlaza automáticamente al abrir issues y PRs.

---

## 📊 Resumen

| Prioridad | Total | ✅ Resueltos | ⏳ Pendientes |
|-----------|-------|-------------|--------------|
| Alta | 9 | 6 | 3 |
| Media | 7 | 4 | 3 |
| Baja | 5 | 1 | 4 |
| **TOTAL** | **21** | **11** | **10** |

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
