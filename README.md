# 🤖 GitHub AI Assistant

![React](https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![GitHub OAuth](https://img.shields.io/badge/GitHub_OAuth-181717?style=for-the-badge&logo=github&logoColor=white)
![Groq](https://img.shields.io/badge/Groq_Cloud-F55036?style=for-the-badge&logo=groq&logoColor=white)
![Gemini](https://img.shields.io/badge/Google_Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)
![Cloud Run](https://img.shields.io/badge/Google_Cloud_Run-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)
![Estado](https://img.shields.io/badge/Estado-Publicado-4CAF50?style=for-the-badge)
![Versión](https://img.shields.io/badge/Versión-v2.4.0-blue?style=for-the-badge)
![License](https://img.shields.io/badge/Licencia-MIT-green?style=for-the-badge)
[![codecov](https://codecov.io/gh/migueljerico/github-ai-assistant/branch/main/graph/badge.svg)](https://codecov.io/gh/migueljerico/github-ai-assistant)

> **Proyecto de portfolio — Curso Análisis de Datos e IA (2025–2026)**
>
> Gestiona tus repositorios de GitHub escribiendo en lenguaje natural — con confirmación previa, historial de sesión y documentación automática, impulsado por **Groq Cloud** o **Google Gemini**.

**Asistente de IA que entiende tu código.** Se conecta a tus repos de GitHub, lee tu codebase y responde preguntas sobre tu proyecto — con una arquitectura de seguridad que protege tus credenciales.

> Construido en 30 días por un profesional de negocio sin experiencia previa en programación.

---

## 📊 Métricas del proyecto

| Aspecto | Detalle |
|---|---|
| ⏱️ Tiempo de desarrollo | 30 días (desde cero) |
| 🤖 Modelos soportados | Groq (Llama 3.3) + Gemini 2.5 Flash |
| ⚡ Latencia media | ~400ms (Groq) / ~1.2s (Gemini) |
| 🛡️ Seguridad | Zero-Storage completo: token GitHub + claves IA en memoria React |
| 🌍 Deploy | Google Cloud Run (HTTPS, auto-scaling) |
| 📦 Stack | React + TypeScript + Express + Vite |

---

## 🎯 ¿Qué hace este asistente?

A diferencia de un chatbot convencional, este asistente:

- ✅ **Lee tu código real** de cualquier repo de GitHub (público o privado)
- ✅ **Responde con contexto** de tu proyecto, no respuestas genéricas
- ✅ **Protege tus credenciales** con arquitectura Zero-Storage (anti-XSS)
- ✅ **Funciona con múltiples modelos** (Groq para velocidad, Gemini para calidad)
- ✅ **Documenta repositorios completos** generando README + MANUAL_TECNICO automáticamente

### Ejemplo de uso real

> **Tú:** *"Lista mis repositorios privados"*
>
> **Asistente:** *"Voy a consultar la API de GitHub... He encontrado 5 repositorios privados. ¿Quieres que te muestre los detalles de alguno en particular?"*

---

## 🔗 Acceso a la Aplicación

[![Ver App en Producción](https://img.shields.io/badge/Ver_App-Cloud_Run-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)](https://github-ai-assistant-748914382449.us-central1.run.app/)

> Conecta tu cuenta de GitHub (OAuth) y tu proveedor de IA preferido para empezar.
> Tu token de GitHub y tus claves de IA **nunca salen de la memoria del navegador** — no se almacenan en ningún servidor ni en storage del navegador.

---

## 📋 Descripción del Proyecto

**GitHub AI Assistant** es una aplicación web conversacional de código abierto que actúa como capa de abstracción inteligente sobre la GitHub REST API v3. El usuario escribe sus intenciones en lenguaje natural — sin necesidad de conocer endpoints, payloads ni codificación Base64 — y el agente de IA las interpreta, propone la acción y espera confirmación antes de ejecutar.

El proyecto evolucionó de un prototipo en **Google AI Studio** a una aplicación full-stack completa, diseñada y construida íntegramente con asistencia de agentes de IA: **Claude** (Anthropic) como arquitecto y revisor, y **Antigravity 2.0** (Google) como entorno de desarrollo agéntico.

---

## ✨ Funcionalidades

| Funcionalidad | Descripción |
|---|---|
| 💬 **Chat en lenguaje natural** | Escribe instrucciones como "crea un repo público llamado mi-proyecto" y la IA las ejecuta |
| ✅ **Panel de confirmación** | Toda operación de escritura muestra lo que va a hacer y espera tu aprobación |
| 📋 **Historial de sesión** | Log exportable de todas las acciones con estado (✅ ❌ ⏸️ ⏳) |
| 📄 **Plantillas predefinidas** | README, `.gitignore` y licencias por tipo de proyecto, pre-formuladas para el chat |
| 🗂️ **Operaciones multi-repo** | Aplica la misma acción a varios repositorios seleccionados simultáneamente |
| 🤖 **Documenta tu repositorio entero** | El agente lee hasta 80 archivos y genera README + MANUAL_TECNICO de forma automática |
| 🔑 **Doble proveedor de IA** | Soporte para **Groq Cloud** y **Google Gemini 2.5 Flash** — usas tu propia clave |
| 🔒 **Autenticación OAuth** | Flujo GitHub OAuth completo con fallback a PAT manual |
| 🛡️ **Rate limiting** | Protección contra abuso en el proxy de Gemini (40 req/min por IP) |

---

## 🛠️ Proceso de Desarrollo — Cómo se construyó esta app

Este proyecto es el resultado de un proceso de desarrollo agéntico en múltiples fases, donde la IA no solo ejecutó código sino que tomó decisiones arquitectónicas.

### Fase 1 — Prototipo en Google AI Studio

La primera versión de la app fue construida directamente en **Google AI Studio**, configurando un agente de Gemini mediante ingeniería de prompts. Operaba como una caja negra: el usuario escribía una instrucción, el agente la ejecutaba directamente sobre la GitHub API sin confirmación previa. Autenticación solo por PAT. El resultado fue desplegado en **Google Cloud Run**.

### Fase 2 — Diseño arquitectónico con Claude (Anthropic)

Se inició una consultoría técnica con **Claude Sonnet** (claude.ai) para auditar el concepto y diseñar la arquitectura de la v2. Claude identificó los problemas críticos del prototipo (ausencia de confirmación previa, key de IA expuesta en servidor, sin historial) y propuso una arquitectura full-stack con:

- Backend Express **thin** (solo OAuth — la IA se llama desde el cliente)
- Panel de confirmación para operaciones de escritura
- Historial de sesión exportable
- Soporte dual Groq/Gemini con clave del usuario
- OAuth de GitHub

Claude también revisó el plan de implementación generado por Antigravity y detectó 8 problemas antes de que se escribiera una sola línea de código (incluyendo la exposición de la Gemini API key al frontend).

### Fase 3 — Construcción con Antigravity 2.0

La construcción del código se realizó con **Antigravity 2.0** (plataforma de desarrollo agéntico de Google, presentada en I/O 2026), usando **Claude** como modelo subyacente del agente. A partir del prompt maestro diseñado en la Fase 2, Antigravity generó la estructura completa del proyecto:

```
github-ai-assistant/
├── client/     # React 18 + TypeScript + Vite (36 archivos)
├── server/     # Express.js OAuth (1 archivo, ~120 líneas)
└── Dockerfile  # Multi-stage build para Cloud Run
```

El agente de Antigravity generó los 15 componentes planificados incluyendo servicios, contextos y el sistema de tipos TypeScript completo.

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
git commit -m "feat: v2 completa — OAuth, Groq/Gemini, historial, plantillas, multi-repo"
git push -u origin main
```

### Fase 6 — Despliegue en Google Cloud Run

```bash
gcloud run deploy github-ai-assistant \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GITHUB_CLIENT_ID=...,GITHUB_CLIENT_SECRET=...,SESSION_SECRET=...
```

---

## ⚙️ Configuración local

### Prerrequisitos

- Node.js 20+
- Git
- Una GitHub OAuth App ([crear aquí](https://github.com/settings/developers)):
  - Homepage URL: `http://localhost:5173`
  - Callback URL: `http://localhost:3001/auth/callback`
- Una API key de [Groq Cloud](https://console.groq.com) o [Google Gemini](https://aistudio.google.com/apikey)

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

> La clave de IA no va en el `.env` — cada usuario la introduce directamente en la app.

### Arrancar en desarrollo

```bash
npm install
cd client && npm install && cd ..
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173)

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
│  ├── ConfirmModal     (confirmación de acciones)    │
│  ├── HistoryPanel     (log exportable)              │
│  ├── TemplatePanel    (plantillas predefinidas)     │
│  └── RepoSelector     (multi-repo)                 │
└──────────┬──────────────────────────┬───────────────┘
           │ /auth/github             │ Llamadas directas
           │ /auth/callback           │ (GitHub + Groq)
           │ /api/gemini (proxy EU)   │
           ▼                          ▼
┌──────────────────────┐  ┌───────────────────────────────┐
│  Express.js          │  │  APIs externas                │
│  ├── OAuth           │  │  ├── GitHub REST API v3        │
│  ├── /api/gemini     │  │  ├── Groq Cloud (directo)      │
│  │   (rate limited)  │  │  └── Google Gemini API         │
│  ├── /health         │  │    (via proxy en el servidor) │
│  └── static files    │  │                               │
└──────────────────────┘  └───────────────────────────────┘
```

**Decisión arquitectónica clave:** el backend Express es intencionalmente mínimo. Gestiona el intercambio de secretos OAuth y actúa como proxy para la API de Gemini — necesario porque Google bloquea las llamadas directas desde navegadores en la UE/EEA. Las llamadas a GitHub y a Groq se realizan directamente desde el navegador del usuario, con su propio token y su propia clave de IA.

---

## 🛠️ Stack tecnológico

| Herramienta | Uso | Coste |
|---|---|---|
| React 18 + TypeScript | Interfaz de usuario, estado, contextos | Gratuito |
| Vite | Bundler y dev server del frontend | Gratuito |
| Express.js | Backend thin — OAuth + proxy Gemini | Gratuito |
| GitHub REST API v3 | Todas las operaciones sobre repositorios | Gratuito |
| Groq Cloud | Inferencia de IA ultrarrápida (Llama 3.3) | Tier gratuito |
| Google Gemini | Modelo de IA alternativo (gemini-2.5-flash) | Tier gratuito |
| Google Cloud Run | Despliegue serverless (us-central1) | Pay-per-use |
| Antigravity 2.0 | Entorno de desarrollo agéntico (construcción del código) | — |
| Claude (Anthropic) | Arquitectura, revisión y documentación | — |

---

## 🧪 Testing y Calidad

El proyecto utiliza **Vitest** para testing unitario e integración, con **Codecov** para monitorización de cobertura.

### Ejecutar tests

```bash
cd client
npm run test          # Tests en modo watch
npm run test:run      # Tests una sola vez
npm run test:coverage # Tests con reporte de cobertura
```

### Cobertura actual

- **Cobertura total:** 48%
- **Módulos testeados:** AuthContext, AIProviderContext, actionExecutor, github, gemini, formatResult, releaseGenerator, pdfReader, pdfAdvanced, useChat, useActions, ChatArea, ChatInput, ConfirmModal, Header, TemplatePanel, AIProviderPanel, AIProviderBadge — más los tests del servidor (rate limiter)
- **Badge con cobertura actual:** [![codecov](https://codecov.io/gh/migueljerico/github-ai-assistant/branch/main/graph/badge.svg)](https://codecov.io/gh/migueljerico/github-ai-assistant)

### Estrategia de testing

- Tests unitarios para servicios y utilidades
- Tests de integración para contextos de React
- Tests de componentes con React Testing Library
- Mock de APIs externas (GitHub API, proveedores IA)
- **CI** (GitHub Actions): lint + tests del cliente con cobertura + tests del servidor, en cada push/PR a `main`
- **CD** (Cloud Build): build del Dockerfile + despliegue automático a Cloud Run en cada push a `main`

---

## 🔒 Modelo de seguridad

### 🛡️ Arquitectura Zero-Storage

Esta aplicación implementa una arquitectura **Zero-Storage** completa: ninguna credencial del usuario se almacena en el navegador (ni sessionStorage, ni localStorage, ni cookies, ni IndexedDB).

**Token de GitHub — Memoria React:**

El token de acceso de GitHub (ya sea OAuth o PAT) vive exclusivamente en la memoria de React (estado global del contexto). Jamás se escribe en ninguna API de almacenamiento del navegador.

**Claves de IA — Memoria React:**

Las claves de API de IA (Groq/Gemini) también viven exclusivamente en la memoria de React, dentro del `AIProviderContext`. No se almacenan en ningún sitio.

**¿Por qué es esto importante?**

La aplicación requiere el scope `repo` de GitHub, que otorga acceso de lectura y escritura a todos tus repositorios públicos y privados. Si un atacante lograra inyectar código JavaScript en la aplicación (ataque XSS), podría:

- ❌ **Con almacenamiento en navegador:** Leer el token desde `sessionStorage`/`localStorage` y robar todas tus credenciales en segundos.
- ✅ **Con memoria React:** El token solo existe en la memoria volátil de React. Un script malicioso no puede acceder a variables de estado de React directamente, haciendo el robo de credenciales extremadamente difícil.

**¿Qué significa esto para ti como usuario?**

- 🔄 Al recargar la página (F5), perderás tu sesión de GitHub y tus claves de IA. Tendrás que volver a conectarte.
- 🛡️ Tanto tu token de GitHub como tus claves de IA están protegidos contra el vector de ataque más común en aplicaciones web (XSS + robo de tokens desde storage).
- 🔐 El logout cierra tu sesión tanto en la app como en GitHub.com.

> **Esto NO es un bug, es una característica de seguridad intencionada.**
>
> Priorizamos la seguridad de tus credenciales (el activo más crítico) por encima de la comodidad de no tener que volver a iniciar sesión. Dado el nivel de acceso que requiere la aplicación (scope `repo`), consideramos que este trade-off es necesario y responsable.

### Modelo de almacenamiento de credenciales

| Elemento | Dónde vive | Cuándo desaparece |
|---|---|---|
| Token OAuth de GitHub | Solo en memoria de React (estado) | Al recargar la página o cerrar la pestaña |
| Clave de IA (Groq/Gemini) | Solo en memoria de React (estado) | Al recargar la página o cerrar la pestaña |
| GITHUB_CLIENT_SECRET | Variables de entorno del servidor | Solo en memoria del proceso |
| Datos del usuario | Ningún servidor externo | No se almacenan |
| Clave Gemini en tránsito | Cuerpo HTTPS hacia /api/gemini | No se persiste en el servidor |

### Protección contra abuso

- **Rate limiting en proxy Gemini:** 40 peticiones por minuto por IP, usando `express-rate-limit`. Previene que un atacante agote la cuota de la API key.
- **Verificación de estado OAuth:** Se genera un `state` aleatorio en cada flujo OAuth para prevenir ataques CSRF.
- **IDs únicos seguros:** Los mensajes del chat usan `crypto.randomUUID()` (CSPRNG) en lugar de `Math.random()`.

---

## 🔮 Mejoras futuras

Ver [MEJORAS_FUTURAS.md](./MEJORAS_FUTURAS.md) — Estado actual, sprints y roadmap completo.

---

## 🔌 Proveedores de IA soportados y roadmap

La app soporta actualmente Groq Cloud y Google Gemini. Para el análisis de proveedores alternativos evaluados (Together AI, OpenRouter, Fireworks AI, Ollama local, DeepInfra), métricas de código y sprints pendientes, consulta [MEJORAS_FUTURAS.md](./MEJORAS_FUTURAS.md).

---

## 🧠 El proceso: De los negocios a la Ingeniería de IA

Este proyecto no es solo código; es el resultado de un profesional de Ciencias Empresariales adentrándose en el desarrollo de software y la Inteligencia Artificial desde cero en 30 días.

### ¿Por qué este enfoque?

Al no tener la "mochila" de la formación técnica tradicional, mi enfoque no fue solo "hacer que funcione", sino construir un producto robusto, seguro y mantenible aplicando las mejores prácticas de la industria desde el primer día:

- 🛡️ **Seguridad por diseño:** Implementación de arquitectura Zero-Storage para proteger todas las credenciales del usuario, priorizando la seguridad sobre la comodidad.
- 📚 **Documentación profesional:** Manuales técnicos y roadmap de mejoras siguiendo estándares de la industria.
- 🧪 **Testing continuo:** Infraestructura de tests con Codecov y CI/CD automatizado.

### La lección principal

La Inteligencia Artificial y las herramientas modernas (como GitHub Copilot, LLMs y plataformas Cloud) han democratizado la ingeniería. Este proyecto demuestra que el criterio de negocio, la curiosidad y la obsesión por la calidad son tan importantes como saber escribir código.

> *"No soy ingeniero de software. Soy un profesional de negocio que ha aprendido a construir productos de IA pensando como un ingeniero."*

---

## 📚 Contexto formativo

Este proyecto forma parte del programa de formación en Análisis de Datos e Inteligencia Artificial (INAEM, 2025–2026). El objetivo fue explorar el desarrollo de aplicaciones full-stack asistido por agentes de IA, desde la arquitectura hasta el despliegue en producción, integrando múltiples servicios de IA y APIs REST en un flujo de trabajo completamente agéntico.

---

<p align="center">
Desarrollado por <a href="https://github.com/migueljerico">@migueljerico</a> con la asistencia de <strong>Claude</strong> (Anthropic), <strong>Antigravity 2.0</strong> (Google) y <strong>Qwen 3.7-Plus</strong> (Componentes de código) · 2026
</p>
