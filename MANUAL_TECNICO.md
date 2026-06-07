# 📖 Manual Técnico — Asistente de IA para Publicar Repositorios

---

## 🏗️ Arquitectura General

La aplicación sigue una arquitectura de **backend thin** deliberada: el servidor Express existe únicamente para gestionar el flujo OAuth de GitHub. Todas las llamadas a la GitHub API y a los proveedores de IA se realizan directamente desde el navegador del usuario.

```
┌────────────────────────────────────────────────────────────────┐
│                     FRONTEND (cliente)                         │
│  React 18 · TypeScript · Vite · sessionStorage                 │
│                                                                │
│  ┌─────────────────┐  ┌───────────────┐  ┌─────────────────┐  │
│  │  Autenticación  │  │  Chat + IA    │  │  UI Auxiliar    │  │
│  │  AuthContext    │  │  gemini.ts    │  │  HistoryPanel   │  │
│  │  LoginButton    │  │  callAI()     │  │  TemplatePanel  │  │
│  │  PatInput       │  │  parseAction()│  │  RepoSelector   │  │
│  └────────┬────────┘  └──────┬────────┘  └─────────────────┘  │
│           │                 │                                  │
│  ┌────────▼─────────────────▼──────────────────────────────┐  │
│  │              App.tsx — Orquestador principal             │  │
│  │  handleSend → callAI → parseAction → ConfirmModal        │  │
│  │  handleConfirm → executeAction → HistoryContext          │  │
│  │  handleDocumentRepo → fetchRepoTreeRecursive → DocModal  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────┬────────────────────────────────────┬───────────┘
               │ /auth/github · /auth/callback       │ fetch()
               ▼                                     ▼
┌──────────────────────────┐   ┌────────────────────────────────┐
│  Backend Express.js      │   │  APIs Externas                 │
│  server/index.js         │   │                                │
│  ├── GET /health         │   │  GitHub REST API v3            │
│  ├── GET /auth/github    │   │  api.github.com                │
│  ├── GET /auth/callback  │   │                                │
│  └── Static (prod)       │   │  Groq Cloud                    │
│                          │   │  api.groq.com/openai/v1        │
│  Solo en memoria:        │   │                                │
│  GITHUB_CLIENT_SECRET    │   │  Google Gemini                 │
└──────────────────────────┘   │  generativelanguage.googleapis │
                               └────────────────────────────────┘
```

---

## 📁 Estructura del Proyecto

```
github-ai-assistant/
├── client/                         # Aplicación React
│   └── src/
│       ├── components/
│       │   ├── ai-provider/        # Panel conexión de IA
│       │   ├── auth/               # OAuth / PAT / UserBadge
│       │   ├── chat/               # ChatArea, ChatInput, ChatMessage, DocRepoButton
│       │   ├── confirm/            # ConfirmModal, DiffViewer (diff2html)
│       │   ├── layout/             # Header, HistoryPanel, AIProviderBadge
│       │   ├── multi-repo/         # RepoSelector con paginación
│       │   └── templates/          # TemplatePanel + templateData.ts
│       ├── context/
│       │   ├── AuthContext.tsx     # Token GitHub, usuario, OAuth/PAT
│       │   ├── AIProviderContext.tsx # Proveedor IA activo (Groq/Gemini)
│       │   └── HistoryContext.tsx  # Log de sesión + exportación
│       ├── services/
│       │   ├── github.ts           # Wrapper GitHub REST API v3
│       │   ├── gemini.ts           # Cliente unificado Groq + Gemini
│       │   └── actionExecutor.ts   # Ejecutor de acciones confirmadas
│       └── types/index.ts          # Tipos compartidos TypeScript
├── server/
│   └── index.js                    # Express: OAuth + health + static
├── Dockerfile                      # Multi-stage build (Node 20 Alpine)
├── .env.example                    # Plantilla de variables de entorno
└── .gitignore
```

---

## 🔄 Flujo de una Operación Completa

```
1. Usuario escribe en el chat
   "Crea un repositorio público llamado mi-proyecto"
          ↓
2. App.tsx → handleSend()
   Construye el historial de conversación
   Llama a callAI(messages) → gemini.ts
          ↓
3. gemini.ts → callGroq() o callGeminiDirect()
   Envía el SYSTEM_PROMPT + historial al modelo
   Recibe JSON estructurado:
   {
     "tipo": "creacion",
     "accion": "Crear repositorio público mi-proyecto",
     "endpoint": "/user/repos",
     "metodo": "POST",
     "payload": { "name": "mi-proyecto", "private": false },
     "requiereConfirmacion": true
   }
          ↓
4. parseGeminiAction() valida el JSON
   Si tiene tipo+accion+metodo → GeminiAction
   Si no → respuesta conversacional
          ↓
5. requiereConfirmacion === true →
   Se abre ConfirmModal con descripción + preview
   Usuario pulsa "✅ Confirmar y ejecutar"
          ↓
6. handleConfirm() → executeAction()
   actionExecutor.ts → resolveEndpoint()
   → createRepo() en github.ts
   → POST https://api.github.com/user/repos
   → Token Bearer del usuario en el header
          ↓
7. Resultado → HistoryContext.addEntry()
   Mensaje de éxito/error en el chat
```

---

## 🧠 Sistema de IA — gemini.ts

### Diseño del System Prompt

El system prompt (`SYSTEM_PROMPT`) está diseñado con cuatro objetivos explícitos documentados en el código:

1. **Respuestas solo JSON** — facilita el parseo estructurado y la UI de confirmación
2. **Nunca ejecutar** — el agente propone, el usuario confirma, el executor actúa
3. **Reglas de endpoint** — previene errores 404 por placeholders sin resolver
4. **Idioma español** — el usuario objetivo interactúa en español

### Routing entre proveedores

```typescript
// sessionStorage['ai_provider'] === 'groq'   → callGroq()
// sessionStorage['ai_provider'] === 'gemini' → callGeminiDirect()
export async function callAI(messages, systemPrompt): Promise<string>
```

Las claves de API se leen de `sessionStorage` en cada llamada y **nunca pasan por el servidor**.

### Groq vs. Gemini — diferencias de implementación

| Aspecto | Groq | Gemini |
|---|---|---|
| SDK | `fetch()` directo | `@google/generative-ai` |
| Formato mensajes | OpenAI-compatible (system + messages) | `startChat({ history }) + sendMessage()` |
| System prompt | Mensaje con `role: 'system'` | `systemInstruction` en el modelo |
| Temperatura | 0.1 (determinista) | Por defecto del SDK |
| Max tokens | 4096 | 1024 (SDK default) |

---

## 🔌 GitHub REST API v3 — github.ts

### Endpoints utilizados

| Función | Método | Endpoint |
|---|---|---|
| `getUser()` | GET | `/user` |
| `listAllRepos()` | GET | `/user/repos?per_page=100&page=N` |
| `createRepo()` | POST | `/user/repos` |
| `getFileContents()` | GET | `/repos/{owner}/{repo}/contents/{path}` |
| `createOrUpdateFile()` | PUT | `/repos/{owner}/{repo}/contents/{path}` |
| `deleteFile()` | DELETE | `/repos/{owner}/{repo}/contents/{path}` |
| `fetchRepoTreeRecursive()` | GET | `/repos/{owner}/{repo}/git/trees/{branch}?recursive=1` |

### Paginación automática

`listAllRepos()` itera páginas de 100 repos hasta recibir una respuesta con menos de 100 resultados, garantizando que los usuarios con decenas de repos los vean todos.

### Modo documentación — límites y priorización

```
MAX_FILES = 80     // Cap de archivos a analizar
MAX_FILE_SIZE = 50KB  // Archivos más grandes se saltan

Prioridad de análisis:
  0 → README (más informativo)
  1 → package.json (contexto de dependencias)
  2 → src/ (implementación principal)
  3 → Archivos de configuración (.json, .yaml, .toml)
  4 → Código fuente (.ts, .js, .py, etc.)
  5 → Todo lo demás

Descarga en batches de 5 archivos en paralelo
(respeto a los rate limits de GitHub: 5000 req/h con OAuth)
```

---

## 🔐 Autenticación — AuthContext.tsx y server/index.js

### Flujo OAuth completo

```
1. Frontend → window.location.href = '/auth/github'
2. Express → redirect a GitHub con client_id + scope
3. GitHub → muestra pantalla de autorización al usuario
4. Usuario aprueba → GitHub redirige a /auth/callback?code=XXX
5. Express → POST a github.com/login/oauth/access_token
   (CLIENT_SECRET nunca sale del servidor)
6. GitHub → devuelve access_token
7. Express → redirect al frontend con token en URL hash
8. Frontend → extrae token, llama GET /user para validar
9. Token guardado en sessionStorage['gh_token']
```

### Fix de protocolo para Cloud Run

El servidor detecta si el host contiene `run.app` y fuerza el protocolo `https://` en el callback URL, evitando redirecciones HTTP en producción que GitHub rechaza.

---

## 🚀 Despliegue — Dockerfile y Cloud Run

### Dockerfile multi-stage

```dockerfile
Stage 1 (builder):
  node:20-alpine → npm ci → npm run build (Vite)
  Produce: client/dist/ (archivos estáticos)

Stage 2 (production):
  node:20-alpine → npm ci --omit=dev
  Copia: server/ + client/dist/
  Expone: $PORT (8080 en Cloud Run)
  CMD: node server/index.js
```

### Variables de entorno en producción

| Variable | Requerida | Descripción |
|---|---|---|
| `GITHUB_CLIENT_ID` | ✅ Sí | Client ID de la GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | ✅ Sí | Client Secret (nunca al frontend) |
| `SESSION_SECRET` | ✅ Sí | Clave para firmar cookies de sesión |
| `PORT` | Cloud Run lo inyecta | Puerto de escucha (default: 8080) |
| `NODE_ENV` | Auto en Dockerfile | `production` activa cookies `secure: true` |

---

## ⚠️ Limitaciones conocidas

Ver [`MEJORAS_FUTURAS.md`](./MEJORAS_FUTURAS.md) para el detalle completo.

| Limitación | Impacto |
|---|---|
| Contenido de repos generado básico con Groq | Los READMEs creados son funcionales pero no muy ricos |
| Sin soporte para `PATCH` en el executor | No se puede actualizar descripción de repo directamente |
| OAuth state no verificado en callback | Riesgo CSRF teórico (bajo en la práctica) |
| `DocModal` embebido en `App.tsx` | Dificulta el mantenimiento a largo plazo |
| Modelos de Groq hardcodeados | Requiere actualización manual cuando Groq cambia su catálogo |

---

<p align="center">
  Desarrollado por <a href="https://github.com/migueljerico">@migueljerico</a> con <strong>Claude</strong> (Anthropic) y <strong>Antigravity 2.0</strong> (Google) · 2026
</p>
