# Changelog

All notable changes to this project are documented in this file.  
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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

### Changed

- **Clave de IA en el cliente** — `GEMINI_API_KEY` eliminada del servidor; cada usuario conecta su propia clave en el navegador vía `sessionStorage`
- **Arquitectura de llamadas a IA** — de proxy en el servidor a llamadas directas del navegador al proveedor de IA
- **System prompt mejorado** — instrucciones explícitas de endpoints correctos (ej: `/user/repos` en vez de `/users/{username}/repos`)
- **Dependencias del servidor** — eliminadas `@google/generative-ai` y `node-fetch` del servidor; solo quedan `cors`, `express`, `express-session`

### Security

- La clave de IA del usuario **nunca llega al servidor Express**
- El token OAuth de GitHub se almacena en `sessionStorage` (se elimina al cerrar la pestaña)
- El servidor no almacena ningún dato del usuario
- `sessionStorage` preferido sobre `localStorage` para reducir ventana de exposición

### Fixed

- Error `GEMINI_API_KEY not configured on server` — eliminada la dependencia de clave en servidor
- Error `404 Not Found` en `GET /users/{username}/repos` — corregido a `GET /user/repos` con resolución de placeholders
- Error `500` genérico del proxy de IA — reemplazado con mensajes de error específicos en español
- Respuesta JSON cruda de la API de GitHub — reemplazada con formateador legible por humanos

---

## [1.0.0] — 2026 (versión original)

### Initial Release

- Despliegue inicial en Google AI Studio
- Operaciones básicas en lenguaje natural → GitHub REST API
- Autenticación solo con PAT (Personal Access Token)
- Proxy de Gemini API en el servidor con `GEMINI_API_KEY` en `.env`
- Sin interfaz gráfica de confirmación (ejecución directa)
- Sin historial de sesión
- Sin soporte multi-repo

---

<p align="center">
  Desarrollado con ❤️ por <a href="https://github.com/migueljerico">@migueljerico</a> · 2026
</p>
