# Changelog

All notable changes to this project are documented in this file.  
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
