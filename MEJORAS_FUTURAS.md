# 🔮 Roadmap de Mejoras — Análisis del Código

Estado del código, mejoras pendientes y roadmap del proyecto.

**Actualizado a:** v2.1.0 · Junio 2026

---

## ✅ Resueltos

| # | Punto | Archivo | Versión |
|---|---|---|---|
| 1 | Verificación OAuth state (CSRF) | server/index.js | v2.0.1 |
| 2 | SESSION_SECRET obligatorio en producción | server/index.js | v2.0.1 |
| 12 | Nombre del proveedor IA dinámico en mensajes | App.tsx | v2.1.0 |

---

## ⏳ Pendientes

Los issues están numerados y ordenados por prioridad descendente dentro de cada bloque. Al resolver un punto, moverlo a la tabla ✅ con versión y SHA de commit.

### 🔴 Alta Prioridad

#### #13 — Zero-Storage real para claves de IA
**Esfuerzo:** 2–3h

**Problema actual:** Las claves de IA (Groq/Gemini) se almacenan en `sessionStorage` del navegador. Esto las expone a ataques XSS que puedan leer `sessionStorage.getItem('ai_api_key')`.

**Solución propuesta:** Mover las claves de IA al estado de React (memoria volátil), igual que el token de GitHub. Las claves vivirían solo en `AIProviderContext` y se perderían al recargar la página.

**Trade-off:** El usuario tendría que reintroducir su clave de IA al recargar la página (igual que ya ocurre con el token de GitHub).

**Beneficio:** Seguridad consistente — todas las credenciales sensibles (token GitHub + claves IA) protegidas contra XSS.

---

#### #14 — Rate limiting en proxy Gemini
**Esfuerzo:** 1h

**Problema actual:** El endpoint `/api/gemini` no tiene protección contra abuso. Un usuario malintencionado podría hacer miles de peticiones y agotar la cuota de la API key.

**Solución propuesta:** Añadir `express-rate-limit` con límite de 40 peticiones por minuto por IP.

**Beneficio:** Prevención de abuso y protección de cuotas de API.

---

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

#### #17 — Extraer formatResultData a utilidad pura
**Esfuerzo:** 1h

**Problema actual:** `formatResultData()` y la interfaz `GitHubRepoItem` están embebidas en `App.tsx`, dificultando testing unitario.

**Solución propuesta:** Mover a `client/src/utils/formatResult.ts` como utilidad pura sin dependencias React.

**Beneficio:** Facilita testing en aislamiento; reutilización en otros módulos.

---

#### #18 — crypto.randomUUID() en lugar de Math.random()
**Esfuerzo:** 30min

**Problema actual:** La función `uid()` usa `Math.random()` para generar IDs de mensajes, lo que puede producir colisiones en sesiones largas.

**Solución propuesta:** Reemplazar por `crypto.randomUUID()` (UUID v4 nativo del navegador, CSPRNG).

**Beneficio:** IDs garantizadamente únicos; mejor práctica de seguridad.

---

#### #19 — Soporte método HTTP PATCH en executeAction()
**Esfuerzo:** 1h

**Problema actual:** `actionExecutor.ts` no soporta el método `PATCH`, limitando las operaciones de actualización parcial de repositorios.

**Solución propuesta:** Añadir `case 'PATCH'` en el switch de métodos HTTP con la misma estructura de respuesta que POST y PUT.

**Beneficio:** Habilita actualizaciones parciales de repositorios (descripción, visibilidad, permisos).

---

#### #20 — Truncamiento semántico por líneas en generateRepoDocs()
**Esfuerzo:** 2h

**Problema actual:** `generateRepoDocs()` trunca archivos a 2000 caracteres, cortando código a mitad de función.

**Solución propuesta:** Truncar a 80 líneas preservando imports y firmas de funciones. Los Markdown conservan encabezados e introducción.

**Beneficio:** Documentación más coherente y útil; contexto preservado.

---

#### #21 — Unificar cliente fetch — ghFetch() en actionExecutor.ts
**Esfuerzo:** 2h

**Problema actual:** `actionExecutor.ts` tiene 3 bloques `fetch()` directos con headers de `Authorization` duplicados (GET genérico, POST genérico, PATCH).

**Solución propuesta:** Exportar `ghFetch()` de `github.ts` y sustituir los 3 bloques por llamadas a `ghFetch()`.

**Beneficio:** Un único punto de verdad para gestión de headers; facilita futuros cambios (retry logic, rate-limit handling).

---

#### #22 — SessionWarningBanner — Advertencia de caducidad de sesión
**Esfuerzo:** 3h

**Problema actual:** El usuario no recibe advertencia cuando su token de GitHub o clave de IA llevan muchas horas activos.

**Solución propuesta:** Nuevo componente `SessionWarningBanner.tsx` que muestra banner amber si las credenciales llevan >8h activas. Revisión cada 60s.

**Dependencia:** Requiere Zero-Storage real (#13) para funcionar correctamente.

**Beneficio:** Mejor UX; seguridad proactiva.

---

#### #26 — Mantener y expandir cobertura de tests con Codecov
**Esfuerzo:** Continuo (2-4h por sprint)

**Estado actual:** El proyecto ya tiene infraestructura de tests con Vitest y Codecov configurado (badge en README). Existen tests unitarios para `gemini.ts` (language detection, JSON extraction, validation).

**Problema:** La cobertura de tests es parcial. Muchos módulos críticos no tienen tests:
- `AuthContext.tsx` — Flujo de autenticación
- `AIProviderContext.tsx` — Gestión de proveedores IA
- `actionExecutor.ts` — Ejecutor de acciones
- `github.ts` — Wrapper de GitHub API
- Componentes React — `ConfirmModal`, `ChatInput`, `RepoSelector`

**Solución propuesta:**
1. Mantener cobertura actual de `gemini.ts` y actualizarla cuando se modifique
2. Añadir tests para `AuthContext.tsx` (login, logout, OAuth flow)
3. Añadir tests para `actionExecutor.ts` (cada método HTTP)
4. Añadir tests para componentes críticos con React Testing Library
5. Mantener badge de Codecov en README y asegurar que CI falle si cobertura < 70%

**Beneficio:** Mayor confianza en cambios futuros; detección temprana de regresiones; documentación viva del comportamiento esperado.

**Nota:** Esta mejora es transversal — cada vez que se resuelva otra mejora (#13, #16, #17, etc.), se deben añadir tests correspondientes.

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
| 🔴 Alta | 3 | 0 | 3 |
| 🟡 Media | 8 | 0 | 8 |
|  Baja | 3 | 0 | 3 |
| **TOTAL** | **14** | **0** | **14** |

---

## 📝 Convenciones

- Al resolver un punto → moverlo a la tabla ✅ con versión y SHA de commit
- Issues pendientes ordenados por prioridad dentro de cada bloque 🔴 / 🟡 / 🟢
- Crear commit: `docs: mark issue #X as resolved in vX.Y`
- Cada mejora debe incluir tests correspondientes (ver #26)
