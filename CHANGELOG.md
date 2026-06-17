### CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] — 2026-06-08

### Added
- **Gemini API proxy** — Solución al bloqueo europeo (EEA). Las llamadas a Gemini ahora se enrutan a través del servidor Express desplegado en us-central1 (Cloud Run), donde la API es plenamente accesible.
- **POST /api/gemini** en `server/index.js` — Proxy que recibe `{ apiKey, model, messages, systemPrompt }` del frontend, reconstruye el historial de conversación multi-turno con el SDK de Gemini, y devuelve `{ text }`. La API key viaja en el body HTTPS y no se almacena.
- **@google/generative-ai** añadido a las dependencias del servidor (`package.json` raíz).

### Changed
- **callGeminiDirect()** en `gemini.ts` — Ahora llama a `POST /api/gemini` en lugar de usar el SDK directamente desde el navegador. La estructura de mensajes multi-turno y el system prompt se preservan íntegramente.
- **@google/generative-ai** eliminado de las dependencias del cliente (`client/package.json`) — el SDK ahora reside solo en el servidor.
- **Región de despliegue** migrada de `europe-southwest1` a `us-central1` para eludir las restricciones de la API de Gemini en la UE/EEA.

### Architecture note
Groq no se ve afectado — sus llamadas siguen siendo directas desde el navegador sin restricción geográfica. El proxy solo aplica a Gemini.

---

## [2.0.1] — 2026-06-07

### Fixed
- **OAuth state verification** (`server/index.js`) — El parámetro `state` ahora se genera, almacena en sesión y verifica en el callback para prevenir ataques CSRF en el flujo OAuth.
- **SESSION_SECRET obligatorio en producción** — El servidor llama a `process.exit(1)` si `SESSION_SECRET` no está definido en entorno de producción, previniendo despliegues con secret débil por omisión.

---

## [2.0.0] — 2026-06-07

### Added
- **GitHub OAuth** — Autenticación completa con flujo OAuth 2.0 (+ fallback con PAT)
- **Panel de confirmación** — Toda operación de escritura muestra el plan en lenguaje natural y requiere confirmación explícita del usuario
- **Historial de sesión** — Sidebar con todas las acciones de la sesión, estados (✅/❌/⏸️/⏳) y exportación a .txt
- **Biblioteca de plantillas** — Plantillas predefinidas de README, .gitignore, licencias y CI/CD
- **Modo multi-repo** — Selección y aplicación simultánea de acciones a varios repositorios
- **Modo "Documenta mi repositorio"** — Análisis automático de hasta 80 archivos y generación de README + MANUAL_TECNICO.md
- **Soporte dual de proveedor de IA** — Google Gemini y Groq Cloud, con el usuario aportando su propia clave
- **Panel de conexión de IA** — Onboarding guiado para conectar Gemini o Groq con validación de clave en tiempo real
- **Badge del proveedor de IA** — Indicador visual en el header con proveedor y modelo activos
- **Health check /health** — Requerido por Google Cloud Run
- **Dockerfile multi-stage** — Build optimizado para Cloud Run (Node 20 Alpine)
- **Límite de 80 archivos** y exclusión de binarios en el modo de documentación de repos
- **Resolución de placeholders en endpoints** — El executor sustituye `{username}`, `{owner}`, `{repo}` automáticamente
- **Formateador inteligente de resultados** — Muestra repos, archivos y datos de la API en formato legible (no JSON crudo)

### Changed
- **Migración completa** desde Google AI Studio a aplicación full-stack React + Express
- **Arquitectura backend thin** — El servidor Express solo gestiona OAuth y proxy Gemini; todas las llamadas a GitHub y Groq son directas desde el navegador

---

## [1.0.0] — 2026-05-15

### Added
- **Prototipo en Google AI Studio** — Primera versión construida directamente en Google AI Studio, configurando un agente de Gemini mediante ingeniería de prompts.
- **Ejecución directa** — El agente ejecuta instrucciones sobre la GitHub API sin confirmación previa.
- **Autenticación PAT** — Solo soporte para Personal Access Tokens.
- **Despliegue en Cloud Run** — Primera versión desplegada en Google Cloud Run.
