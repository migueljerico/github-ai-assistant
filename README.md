<div align="center">

# 🤖 Asistente de IA para Publicar Repositorios

[![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![GitHub OAuth](https://img.shields.io/badge/GitHub_OAuth-181717?style=for-the-badge&logo=github&logoColor=white)](https://docs.github.com/en/apps/oauth-apps)
[![Groq](https://img.shields.io/badge/Groq_Cloud-F55036?style=for-the-badge&logo=groq&logoColor=white)](https://console.groq.com)
[![Gemini](https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://aistudio.google.com)
[![Cloud Run](https://img.shields.io/badge/Google_Cloud_Run-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)](https://cloud.google.com/run)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](./LICENSE)

**Gestiona tus repositorios de GitHub en lenguaje natural,  
con confirmación previa, historial de sesión y documentación automática.**

</div>

---

## 🔗 Acceso a la Aplicación

[![Abrir aplicación](https://img.shields.io/badge/Abrir_Aplicación-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)](YOUR_CLOUD_RUN_URL)

> La URL de producción se configura al desplegar en Google Cloud Run (ver sección de despliegue).

---

## 📋 Descripción del Proyecto

El **Asistente de IA para Publicar Repositorios** es una aplicación web que permite gestionar repositorios de GitHub mediante lenguaje natural, sin necesidad de recordar comandos de API. El usuario escribe instrucciones como _"Crea un repositorio privado llamado mi-proyecto"_ o _"Documenta todos mis repositorios"_, y la IA genera el plan de acción que el usuario revisa y confirma antes de ejecutar.

La arquitectura está diseñada con un principio de **mínima exposición**: el servidor Express se ocupa exclusivamente del flujo OAuth de GitHub, mientras que las llamadas a la IA (Gemini o Groq) se realizan directamente desde el navegador usando la clave API del propio usuario. Las claves nunca viajan al servidor.

---

## ✨ Funcionalidades

| # | Funcionalidad | Descripción |
|---|---|---|
| 1 | 💬 **Chat en lenguaje natural** | Escribe instrucciones en español; la IA las traduce a llamadas a la GitHub REST API v3 |
| 2 | ✅ **Panel de confirmación + diff** | Toda operación de escritura muestra el plan y un diff lado a lado antes de ejecutarse |
| 3 | 📋 **Historial de sesión exportable** | Registro completo de acciones con estado; exportable como `.txt` |
| 4 | 📚 **Biblioteca de plantillas** | Plantillas predefinidas de README, `.gitignore`, licencias y más |
| 5 | 📦 **Operaciones multi-repo** | Aplicar la misma acción a varios repositorios simultáneamente |
| 6 | 📄 **Modo "Documenta mi repositorio"** | Analiza hasta 80 archivos del repo y genera README + manual técnico automáticamente |
| 7 | 🤖 **Doble proveedor de IA** | Compatible con Google Gemini y Groq Cloud — el usuario conecta su propia clave |

---

## 🔄 Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────┐
│                    USUARIO (Navegador)                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Frontend React + TypeScript                │   │
│  │                                                         │   │
│  │  [Chat Input] → callAI() ──────────────────────────────────────► Gemini API
│  │                       └──────────────────────────────────────► Groq Cloud API
│  │                                                         │   │
│  │  [Confirm Modal] → executeAction() ────────────────────────► GitHub REST API v3
│  │                                                         │   │
│  └───────────────────────┬─────────────────────────────────┘   │
│                          │ OAuth redirect only                  │
└──────────────────────────┼──────────────────────────────────────┘
                           │
               ┌───────────▼──────────┐
               │   Express Backend    │
               │  (OAuth only)        │
               │                      │
               │  GET  /auth/github   │
               │  GET  /auth/callback │
               │  GET  /health        │
               │  Static files (prod) │
               └──────────────────────┘
```

---

## ⚙️ Configuración y Despliegue

### Paso 1 — Crear una GitHub OAuth App

1. Ve a **github.com/settings/developers** → **OAuth Apps** → **New OAuth App**
2. Rellena los campos:
   - **Application name**: `Asistente de IA para Publicar Repositorios`
   - **Homepage URL**: `http://localhost:5173` (dev) o tu URL de Cloud Run (prod)
   - **Authorization callback URL**: `http://localhost:3001/auth/callback` (dev)
3. Copia el **Client ID** y genera un **Client Secret**

### Paso 2 — Obtener una clave de API de IA

El usuario conecta su propia clave en la interfaz — no se necesita clave en el servidor.

| Proveedor | Link | Formato de clave | Tier gratuito |
|---|---|---|---|
| Google Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | `AIzaSy...` | 15 RPM |
| Groq Cloud | [console.groq.com](https://console.groq.com) | `gsk_...` | 30 RPM (llama-3.3-70b) |

### Paso 3 — Clonar y configurar `.env`

```bash
git clone https://github.com/migueljerico/github_workspace.git
cd github_workspace
cp .env.example .env
```

Edita `.env`:

```env
GITHUB_CLIENT_ID=tu_client_id
GITHUB_CLIENT_SECRET=tu_client_secret
SESSION_SECRET=una_cadena_aleatoria_larga
FRONTEND_URL=http://localhost:5173
```

### Paso 4 — Instalar y ejecutar en desarrollo

```bash
npm install          # instala dependencias del servidor
cd client && npm install && cd ..   # instala dependencias del cliente
npm run dev          # arranca servidor (puerto 3001) + cliente (puerto 5173)
```

Abre [http://localhost:5173](http://localhost:5173)

### Paso 5 — Desplegar en Google Cloud Run

```bash
# Autenticarse
gcloud auth login
gcloud config set project TU_PROJECT_ID

# Construir y desplegar
gcloud run deploy asistente-ia-repos \
  --source . \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars GITHUB_CLIENT_ID=xxx,GITHUB_CLIENT_SECRET=yyy,SESSION_SECRET=zzz,FRONTEND_URL=https://TU_URL.run.app
```

Actualiza el Callback URL de tu OAuth App con la URL de Cloud Run: `https://TU_URL.run.app/auth/callback`

---

## 🛠️ Herramientas Utilizadas

| Herramienta | Uso | Coste |
|---|---|---|
| React 18 + TypeScript | UI declarativa con tipado estático | Gratuito |
| Vite | Bundler y dev server ultrarrápido | Gratuito |
| Express.js | Servidor OAuth mínimo | Gratuito |
| GitHub REST API v3 | Todas las operaciones sobre repositorios | Gratuito |
| GitHub OAuth | Autenticación segura sin almacenar contraseñas | Gratuito |
| Google Gemini API | Proveedor de IA (opción 1, clave del usuario) | Tier gratuito disponible |
| Groq Cloud API | Proveedor de IA (opción 2, ultra-rápido) | Tier gratuito muy generoso |
| diff + diff2html | Visualización de diffs lado a lado | Gratuito |
| Google Cloud Run | Despliegue serverless en contenedor | Pay-per-use |
| Docker | Contenedor multi-stage para producción | Gratuito |

---

## 🔒 Modelo de Seguridad

| Dato | Dónde se almacena | Cuándo se elimina |
|---|---|---|
| Token GitHub (OAuth/PAT) | `sessionStorage` del navegador | Al cerrar la pestaña |
| Clave de IA (Gemini/Groq) | `sessionStorage` del navegador | Al cerrar la pestaña |
| Client Secret de GitHub | Variable de entorno del servidor | Nunca sale del servidor |
| Datos de repositorios | Solo en memoria React | Al recargar la página |

**Principios aplicados:**
- 🔒 El servidor Express **nunca ve** la clave de IA del usuario
- 🔒 El servidor Express **nunca almacena** el token OAuth — solo lo pasa al frontend
- 🔒 Las claves del usuario viajan directamente al proveedor de IA (Gemini/Groq) desde el navegador
- 🔒 El backend es un "thin server": OAuth + archivos estáticos, nada más

---

## 📁 Estructura del Proyecto

```
github-ai-assistant/
├── client/                        # Frontend React + TypeScript
│   ├── src/
│   │   ├── components/
│   │   │   ├── ai-provider/       # Panel de conexión de IA
│   │   │   │   └── AIProviderPanel.tsx
│   │   │   ├── auth/              # Login (OAuth + PAT) y badge de usuario
│   │   │   │   ├── LoginButton.tsx
│   │   │   │   ├── PatInput.tsx
│   │   │   │   └── UserBadge.tsx
│   │   │   ├── chat/              # Área de chat y entrada de texto
│   │   │   │   ├── ChatArea.tsx
│   │   │   │   └── ChatInput.tsx
│   │   │   ├── confirm/           # Modal de confirmación con diff
│   │   │   │   └── ConfirmModal.tsx
│   │   │   ├── layout/            # Header, historial, badge de IA
│   │   │   │   ├── AIProviderBadge.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   └── HistoryPanel.tsx
│   │   │   └── templates/         # Biblioteca de plantillas
│   │   │       └── TemplatePanel.tsx
│   │   ├── context/
│   │   │   ├── AIProviderContext.tsx  # Estado del proveedor de IA
│   │   │   ├── AuthContext.tsx        # Autenticación GitHub dual
│   │   │   └── HistoryContext.tsx     # Historial de sesión
│   │   ├── services/
│   │   │   ├── actionExecutor.ts  # Ejecución de acciones confirmadas
│   │   │   ├── gemini.ts          # Cliente IA unificado (Gemini + Groq)
│   │   │   └── github.ts          # Cliente GitHub REST API
│   │   ├── App.tsx                # Componente raíz + lógica de chat
│   │   ├── index.css              # Design system (glassmorphism dark)
│   │   ├── main.tsx               # AuthGate → AIProviderGate → App
│   │   └── types.ts               # Tipos TypeScript compartidos
│   ├── package.json
│   └── vite.config.ts
├── server/
│   └── index.js                   # Express: OAuth + health + static
├── .env.example                   # Plantilla de variables de entorno
├── .gitignore
├── Dockerfile                     # Multi-stage build para Cloud Run
├── CHANGELOG.md
├── MANUAL_TECNICO.md
├── README.md
└── package.json                   # Scripts raíz + deps del servidor
```

---

## 📚 Contexto Formativo

Este proyecto fue desarrollado como ejercicio práctico de integración de APIs modernas en el contexto de un ciclo formativo de desarrollo de aplicaciones web. Combina autenticación OAuth real, llamadas a APIs REST de terceros (GitHub, Gemini, Groq), diseño de interfaces con glassmorphism, y despliegue en infraestructura serverless (Google Cloud Run), aplicando los principios de arquitectura de mínima exposición de credenciales y separación de responsabilidades entre frontend y backend.

---

<p align="center">
  Desarrollado con ❤️ por <a href="https://github.com/migueljerico">@migueljerico</a> · 2026
</p>
