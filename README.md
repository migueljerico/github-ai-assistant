# 🤖 Asistente de IA para Publicar Repositorios

![React](https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![GitHub OAuth](https://img.shields.io/badge/GitHub_OAuth-181717?style=for-the-badge&logo=github&logoColor=white)
![Groq](https://img.shields.io/badge/Groq_Cloud-F55036?style=for-the-badge&logo=groq&logoColor=white)
![Gemini](https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)
![Cloud Run](https://img.shields.io/badge/Google_Cloud_Run-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)
![Estado](https://img.shields.io/badge/Estado-Publicado-4CAF50?style=for-the-badge)
![License](https://img.shields.io/badge/Licencia-MIT-green?style=for-the-badge)

> **Proyecto de portfolio — Curso Análisis de Datos e IA (2025–2026)**  
> Gestiona tus repositorios de GitHub escribiendo en lenguaje natural — con confirmación previa, historial de sesión y documentación automática, impulsado por **Groq Cloud** o **Google Gemini**

---

## 🔗 Acceso a la Aplicación

[![Ver App en Producción](https://img.shields.io/badge/🚀_Ver_App-Cloud_Run-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)](https://github-ai-assistant-748914382449.us-central1.run.app/)

> Conecta tu cuenta de GitHub (OAuth) y tu proveedor de IA preferido para empezar.  
> Tus claves **nunca salen de tu navegador** — no se almacenan en ningún servidor.

---

## 📋 Descripción del Proyecto

**Asistente de IA para Publicar Repositorios** es una aplicación web conversacional de código abierto que actúa como capa de abstracción inteligente sobre la GitHub REST API v3. El usuario escribe sus intenciones en lenguaje natural — sin necesidad de conocer endpoints, payloads ni codificación Base64 — y el agente de IA las interpreta, propone la acción y espera confirmación antes de ejecutar.

El proyecto evolucionó de un prototipo en **Google AI Studio** a una aplicación full-stack completa, diseñada y construida íntegramente con asistencia de agentes de IA: **Claude** (Anthropic) como arquitecto y revisor, y **Antigravity 2.0** (Google) como entorno de desarrollo agéntico.

---

## ✨ Funcionalidades

| Funcionalidad | Descripción |
|---|---|
| 💬 **Chat en lenguaje natural** | Escribe instrucciones como "crea un repo público llamado mi-proyecto" y la IA las ejecuta |
| ✅ **Panel de confirmación** | Toda operación de escritura muestra lo que va a hacer y espera tu aprobación |
| 🔍 **Vista diff antes del commit** | Compara el contenido actual vs. el propuesto lado a lado antes de confirmar |
| 📋 **Historial de sesión** | Log exportable de todas las acciones con estado (✅ ❌ ⏸️ ⏳) |
| 📄 **Plantillas predefinidas** | README, `.gitignore` y licencias por tipo de proyecto, pre-formuladas para el chat |
| 🗂️ **Operaciones multi-repo** | Aplica la misma acción a varios repositorios seleccionados simultáneamente |
| 🤖 **Documenta tu repositorio entero** | El agente lee hasta 80 archivos y genera README + MANUAL_TECNICO de forma automática |
| 🔑 **Doble proveedor de IA** | Soporte para **Groq Cloud** (llama-3.3-70b) y **Google Gemini** — usas tu propia clave |
| 🔒 **Autenticación OAuth** | Flujo GitHub OAuth completo con fallback a PAT manual |

---

## 🛠️ Proceso de Desarrollo — Cómo se construyó esta app

Este proyecto es el resultado de un proceso de desarrollo agéntico en múltiples fases, donde la IA no solo ejecutó código sino que tomó decisiones arquitectónicas.

### Fase 1 — Prototipo en Google AI Studio

La primera versión de la app fue construida directamente en **Google AI Studio**, configurando un agente de Gemini mediante ingeniería de prompts. Operaba como una caja negra: el usuario escribía una instrucción, el agente la ejecutaba directamente sobre la GitHub API sin confirmación previa. Autenticación solo por PAT. El resultado fue desplegado en **Google Cloud Run**.

### Fase 2 — Diseño arquitectónico con Claude (Anthropic)

Se inició una consultoría técnica con **Claude Sonnet** (claude.ai) para auditar el concepto y diseñar la arquitectura de la v2. Claude identificó los problemas críticos del prototipo (ausencia de confirmación previa, key de IA expuesta en servidor, sin historial) y propuso una arquitectura full-stack con:

- Backend Express **thin** (solo OAuth — la IA se llama desde el cliente)
- Panel de confirmación + vista diff con `diff2html`
- Historial de sesión exportable
- Soporte dual Groq/Gemini con clave del usuario
- OAuth de GitHub

Claude también revisó el plan de implementación generado por Antigravity y detectó 8 problemas antes de que se escribiera una sola línea de código (incluyendo la exposición de la Gemini API key al frontend).

### Fase 3 — Construcción con Antigravity 2.0

La construcción del código se realizó con **Antigravity 2.0** (plataforma de desarrollo agéntico de Google, presentada en I/O 2026), usando **Claude** como modelo subyacente del agente. A partir del prompt maestro diseñado en la Fase 2, Antigravity generó la estructura completa del proyecto:

```
github-ai-assistant/
├── client/          # React 18 + TypeScript + Vite (36 archivos)
├── server/          # Express.js OAuth (1 archivo, ~120 líneas)
└── Dockerfile       # Multi-stage build para Cloud Run
```

El agente de Antigravity generó los 15 componentes planificados incluyendo servicios, contextos, hooks y el sistema de tipos TypeScript completo.

### Fase 4 — Corrección de errores y ajustes

Durante las pruebas locales surgieron errores de compilación típicos de código generado por IA:
- Caracteres Unicode (`→`, comillas invertidas) dentro de bloques JSDoc que el compilador esbuild interpretaba como código
- La secuencia `*/` en comentarios con rutas de URL (`/users/*/repos`) que cerraba prematuramente los bloques de comentario

Los errores fueron identificados y corregidos manualmente mediante análisis del stack trace.

### Fase 5 — Despliegue local y push a GitHub

```bash
# Instalación de dependencias (Node.js 20+ y Git requeridos)
npm install
cd client && npm install && cd ..

# Arranque en desarrollo
npm run dev  # Express :3001 + Vite :5173 en paralelo

# Push al repositorio
git init
git remote add origin https://github.com/migueljerico/github-ai-assistant.git
git add .
git commit -m "feat: v2 completa — OAuth, Groq/Gemini, diff, historial, plantillas, multi-repo"
git push -u origin main
```

### Fase 6 — Despliegue en Google Cloud Run

```bash
gcloud run deploy github-ai-assistant \
  --source . \
  --region europe-southwest1 \
  --allow-unauthenticated \
  --set-env-vars GITHUB_CLIENT_ID=...,GITHUB_CLIENT_SECRET=...,SESSION_SECRET=...
```

---

## ⚙️ Configuración local

### Prerrequisitos

- Node.js 20+
- Git
- Una **GitHub OAuth App** ([crear aquí](https://github.com/settings/developers)):
  - Homepage URL: `http://localhost:5173`
  - Callback URL: `http://localhost:3001/auth/callback`
- Una API key de **Groq Cloud** ([console.groq.com](https://console.groq.com)) o **Google Gemini** ([aistudio.google.com/apikey](https://aistudio.google.com/apikey))

### Variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus valores:

```env
GITHUB_CLIENT_ID=       # Client ID de tu GitHub OAuth App
GITHUB_CLIENT_SECRET=   # Client Secret de tu GitHub OAuth App
SESSION_SECRET=         # Cadena aleatoria larga (ej: openssl rand -hex 32)
PORT=3001
```

> La clave de IA **no va en el .env** — cada usuario la introduce directamente en la app.

### Arrancar en desarrollo

```bash
npm install
cd client && npm install && cd ..
npm run dev
```

Abre `http://localhost:5173`

---

## 🏗️ Arquitectura

```
Usuario (lenguaje natural)
        ↓
┌─────────────────────────────────────────────────────┐
│  Frontend React 18 + TypeScript + Vite              │
│  ├── AIProviderPanel  (conectar Groq / Gemini)      │
│  ├── LoginButton      (OAuth) / PatInput (PAT)      │
│  ├── ChatArea + ChatInput                           │
│  ├── ConfirmModal + DiffViewer (diff2html)          │
│  ├── HistoryPanel     (log exportable)              │
│  ├── TemplatePanel    (plantillas predefinidas)     │
│  └── RepoSelector     (multi-repo con paginación)  │
└──────────┬─────────────────────────┬────────────────┘
           │ /auth/github            │ Llamadas directas
           │ /auth/callback          │ con la key del usuario
           ▼                         ▼
┌─────────────────┐    ┌──────────────────────────────┐
│  Express.js     │    │  APIs externas               │
│  (solo OAuth)   │    │  ├── GitHub REST API v3       │
│  + /health      │    │  ├── Groq Cloud API           │
│  + static files │    │  └── Google Gemini API        │
└─────────────────┘    └──────────────────────────────┘
```

**Decisión arquitectónica clave:** el backend Express es intencionalmente mínimo. Solo gestiona el intercambio de secretos OAuth. Todas las llamadas a GitHub y a la IA se realizan directamente desde el navegador del usuario, con su propio token y su propia clave de IA. Esto elimina costes de API para el desarrollador y garantiza que ningún dato del usuario pasa por el servidor.

---

## 🛠️ Stack tecnológico

| Herramienta | Uso | Coste |
|---|---|---|
| **React 18 + TypeScript** | Interfaz de usuario, estado, contextos | Gratuito |
| **Vite** | Bundler y dev server del frontend | Gratuito |
| **Express.js** | Backend thin — solo OAuth | Gratuito |
| **GitHub REST API v3** | Todas las operaciones sobre repositorios | Gratuito |
| **Groq Cloud** | Inferencia de IA ultrarrápida (llama-3.3-70b) | Tier gratuito |
| **Google Gemini** | Modelo de IA alternativo (gemini-2.0-flash) | Tier gratuito |
| **diff + diff2html** | Motor y renderizado de diffs | Gratuito |
| **Google Cloud Run** | Despliegue serverless | Pay-per-use |
| **Antigravity 2.0** | Entorno de desarrollo agéntico (construcción del código) | — |
| **Claude (Anthropic)** | Arquitectura, revisión y documentación | — |

---

## 🔒 Modelo de seguridad

| Elemento | Dónde vive | Cuándo desaparece |
|---|---|---|
| Token OAuth de GitHub | `sessionStorage` del navegador | Al cerrar la pestaña |
| Clave de IA (Groq/Gemini) | `sessionStorage` del navegador | Al cerrar la pestaña |
| `GITHUB_CLIENT_SECRET` | Variables de entorno del servidor | Solo en memoria del proceso |
| Datos del usuario | Ningún servidor externo | No se almacenan |

---

## 🔮 Mejoras futuras

Ver [`MEJORAS_FUTURAS.md`](./MEJORAS_FUTURAS.md) para el análisis completo del código con los puntos de mejora identificados.

---

## 📚 Contexto formativo

Este proyecto forma parte del programa de formación en **Análisis de Datos e Inteligencia Artificial** (INAEM, 2025–2026). El objetivo fue explorar el desarrollo de aplicaciones full-stack asistido por agentes de IA, desde la arquitectura hasta el despliegue en producción, integrando múltiples servicios de IA y APIs REST en un flujo de trabajo completamente agéntico.

---

<p align="center">
  Desarrollado por <a href="https://github.com/migueljerico">@migueljerico</a> con la asistencia de <strong>Claude</strong> (Anthropic) y <strong>Antigravity 2.0</strong> (Google) · 2026
</p>
