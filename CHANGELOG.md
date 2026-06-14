# Changelog

All notable changes to this project are documented in this file.  
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2.7.0] — 2026-06-12

### DX & Consistencia — ghFetch unificado

### Refactored

- **Fix #10 — Unificación de cliente fetch** — `ghFetch()` en `github.ts` pasa de función privada a exportada. `actionExecutor.ts` elimina los 3 bloques `fetch()` directos con headers de `Authorization` duplicados (GET genérico, POST genérico, PATCH) y los sustituye por llamadas a `ghFetch()`. Esto establece un **único punto de verdad** para la gestión de headers y autenticación hacia la GitHub API, simplificando futuros cambios (retry logic, rate-limit handling, etc.).
  - `Authorization` inline en `actionExecutor.ts`: **3 → 0**
  - Líneas en `actionExecutor.ts`: **293 → 278**

### Resolved (MEJORAS_FUTURAS.md)

- Mejora #10 → ✅ `ghFetch()` exportado e importado en `actionExecutor.ts`

---

## [2.6.0] — 2026-06-12

### Refactorización UI — Sprint 1 completado

### Refactored

- **Fix #5 — DocModal extraído** — El componente `DocModal` (~80 líneas de JSX) ha sido movido de `App.tsx` a su propio módulo `client/src/components/confirm/DocModal.tsx`. Props tipadas con interfaz explícita `DocModalProps`. `App.tsx` pasa de 456 a 324 líneas.
- **Fix #6 — formatResultData extraída** — La función `formatResultData()` y la interfaz auxiliar `GitHubRepoItem` han sido movidas a `client/src/utils/formatResult.ts` como utilidad pura sin dependencias React. Exportada nombrada para facilitar testing unitario en aislamiento.

### Resolved (MEJORAS_FUTURAS.md)

- Mejora #5 → ✅ `DocModal` en `components/confirm/DocModal.tsx`
- Mejora #6 → ✅ `formatResultData` en `utils/formatResult.ts`
- **Sprint 1 — Refactorización UI** → ✅ COMPLETADO

---

## [2.5.0] — 2026-06-12

### Code Quality & Documentation Consolidation

### Fixed

- **Fix #8 — Truncamiento semántico** (`gemini.ts`) — `generateRepoDocs()` ahora trunca a 80 líneas en lugar de 2000 caracteres. Los archivos de código preservan imports y firmas de funciones; los Markdown conservan encabezados e introducción. El marcador de truncación incluye el número de líneas original: `... (truncated — showing first 80 of N lines)`.
- **Fix #9 — crypto.randomUUID()** (`App.tsx`) — Reemplazado `Math.random()` por `crypto.randomUUID()` en la función `uid()`. CSPRNG nativo del navegador, IDs UUID v4 garantizadamente únicos.

### Docs

- **MEJORAS_FUTURAS.md** unificado: absorbe `OTRAS POSIBLES MEJORAS.md`, añade mejora #14 (autocompletado), tabla de resumen actualizada (9 resueltos / 4 pendientes).
- **OTRAS POSIBLES MEJORAS.md** eliminado — contenido integrado en `MEJORAS_FUTURAS.md`.
- **README.md** simplificado: tabla de proveedores alternativos movida a `MEJORAS_FUTURAS.md`.
- **v2.4_COMPLETION_SUMMARY.md** actualizado: Sprint 2 marcado como completado con SHAs de commit.

### Resolved (MEJORAS_FUTURAS.md)

- Mejora #8 → ✅ Truncamiento semántico por líneas implementado
- Mejora #9 → ✅ `crypto.randomUUID()` implementado

---

## [2.2.0] — 2026-06-09

### Modelos Gemini 2.5 · catálogo Groq dinámico · región us-central1

### Added

- **Gemini 2.5 Flash** y **Gemini 2.5 Flash Lite** como únicos modelos disponibles en el panel de Gemini. Los modelos anteriores (`gemini-2.0-flash`, `gemini-1.5-*`) tienen cuota = 0 por deprecación de Google y producen siempre un error 429. Cada modelo incluye descripción de características y un indicador de recomendación para orientar al usuario.
- **Catálogo dinámico de Groq** — `AIProviderPanel.tsx` llama a `GET https://api.groq.com/openai/v1/models` en cuanto el usuario introduce una clave `gsk_*` válida (≥ 20 caracteres). Los resultados se filtran (excluyen `whisper`, `playai`, `tts`), se ordenan alfabéticamente y se cachean en `sessionStorage` durante 1 hora. Un mensaje de estado confirma cuántos modelos están disponibles en tiempo real.
- **Sección de proveedores alternativos** en `README.md` con tabla comparativa de Mistral AI, Together AI, OpenAI GPT-4o-mini, Anthropic Claude API y Ollama — indicadores de tier gratuito, restricciones EU y compatibilidad con el código actual.

### Fixed

- **Fix #12** — El mensaje de estado durante la generación de documentación ahora muestra el nombre del proveedor activo ("Groq Cloud" o "Google Gemini") en lugar de "Gemini" hardcodeado. Implementado leyendo `provider` desde `useAIProvider()` en `App.tsx`.

### Changed

- **Región de despliegue** migrada de `europe-southwest1` a `us-central1` para eludir las restricciones de la API de Gemini en la UE/EEA.

### Resolved (MEJORAS_FUTURAS.md)

- Mejora #7 → ✅ Catálogo de modelos Groq cargado dinámicamente desde la API oficial
- Mejora #12 → ✅ Nombre del proveedor de IA dinámico en mensajes de estado

---

## [2.1.0] — 2026-06-08

### Gemini API proxy — solución al bloqueo europeo (EEA)

La API de Gemini bloquea las peticiones directas desde navegadores en la región europea (EEA). Esta versión añade un proxy server-side que enruta las llamadas a Gemini a través del servidor Express, desplegado en `us-central1` (Cloud Run), donde la API es plenamente accesible.

### Added

- **`POST /api/gemini`** en `server/index.js` — proxy que recibe `{ apiKey, model, messages, systemPrompt }` del frontend, reconstruye el historial de conversación multi-turno con el SDK de Gemini, y devuelve `{ text }`. La API key viaja en el body HTTPS y no se almacena.
- **`@google/generative-ai`** añadido a las dependencias del servidor (`package.json` raíz).

### Changed

- **`callGeminiDirect()`** en `gemini.ts` — ahora llama a `POST /api/gemini` en lugar de usar el SDK directamente desde el navegador. La estructura de mensajes multi-turno y el system prompt se preservan íntegramente.
- **`@google/generative-ai`** eliminado de las dependencias del cliente (`client/package.json`) — el SDK ahora reside solo en el servidor.
- Log de arranque del servidor actualizado para reflejar el nuevo endpoint proxy.

### Architecture note

> Groq no se ve afectado — sus llamadas siguen siendo directas desde el navegador sin restricción geográfica. El proxy solo aplica a Gemini.

---

## [2.0.1] — 2026-06-07

### Security fixes

### Fixed

- **OAuth state verification** (`server/index.js`) — el parámetro `state` ahora se genera, almacena en sesión y verifica en el callback para prevenir ataques CSRF en el flujo OAuth.
- **SESSION_SECRET obligatorio en producción** — el servidor llama a `process.exit(1)` si `SESSION_SECRET` no está definido en entorno de producción, previniendo despliegues con secret débil por omisión.

---

## [2.0.0] — 2026-06-07

### Migración: Google AI Studio → Aplicación full-stack React + Express

La versión 2.0 es una reescritura completa que transforma el script original de Google AI Studio en una aplicación web full-stack con autenticación OAuth, interfaz de usuario rica, e integración con múltiples proveedores de IA.

### Added

- **GitHub OAuth** — autenticación completa con flujo OAuth 2.0 (+ fallback con PAT)
- **Panel de confirmación** — toda operación de escritura muestra el plan en lenguaje natural y requiere confirmación explícita del usuario
- **Visor de diff** — integración con `diff` + `diff2html` para mostrar cambios lado a lado antes de hacer commit (fondo verde `#1a3a1a` / rojo `#3a1a1a`)
- **Historial de sesión** — sidebar con todas las acciones de la sesión, estados (✅/❌/⏸️/⏳) y exportación a `.txt`
- **Biblioteca de plantillas** — plantillas predefinidas de README, `.gitignore`, licencias y CI/CD
- **Modo multi-repo** — selección y aplicación simultánea de acciones a varios repositorios
- **Modo "Documenta mi repositorio"** — análisis automático de hasta 80 archivos y generación de README + MANUAL_TECNICO.md
- **Soporte dual de proveedor de IA** — Google Gemini y Groq Cloud, con el usuario aportando su propia clave
- **Panel de conexión de IA** — onboarding guiado para conectar Gemini o Groq con validación de clave en tiempo real
- **Badge del proveedor de IA** — indicador visual en el header con proveedor y modelo activos
- **Health check** `/health` — requerido por Google Cloud Run
- **Dockerfile multi-stage** — build optimizado para Cloud Run (Node 20 Alpine)
- **Límite de 80 archivos** y exclusión de binarios en el modo de documentación de repos
- **Resolución de placeholders en endpoints** — el executor sustituye `{username}`, `{owner}`, `{repo}` automáticamente
- **Formateador inteligente de resultados** — muestra repos, archivos y datos de la API en formato legible (no JSON crudo)
