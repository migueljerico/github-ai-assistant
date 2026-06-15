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

### Arquitectura Zero-Storage

La aplicación implementa una **arquitectura de seguridad Zero-Storage** para la gestión de credenciales sensibles (token de GitHub y claves de API de IA).

**Decisión arquitectónica:** El token y las claves de API **viven exclusivamente en el estado de React** (memoria volátil del contexto). **Nunca se escriben en ninguna API de almacenamiento del navegador** (`sessionStorage`, `localStorage`, cookies, etc.).

**Justificación de seguridad:**

- La aplicación requiere el scope `repo` de GitHub, que otorga acceso completo de lectura/escritura a todos los repositorios del usuario (públicos y privados).
- El vector de ataque más común en aplicaciones web es XSS (Cross-Site Scripting), que permite a un atacante ejecutar JavaScript arbitrario en el contexto de la página.
- Si el token estuviera en `sessionStorage` o `localStorage`, un script XSS podría leerlo con `sessionStorage.getItem('gh_token')` y exfiltrar las credenciales.
- Al mantener el token **solo en memoria de React**, un script XSS no puede acceder directamente a las variables de estado de React, eliminando este vector de ataque.

**Trade-off aceptado:**

- Si el usuario recarga la página (F5), la sesión se pierde y debe reautenticarse.
- Si el usuario cierra la pestaña, todas las credenciales desaparecen instantáneamente.
- Esto es una **característica de seguridad intencionada**, no un bug.

### Implementación técnica

**AuthContext.tsx (Zero-Storage):**

```typescript
// El token NUNCA se escribe en sessionStorage
const fetchUser = useCallback(async (token: string) => {
  setState(s => ({ ...s, isLoading: true, error: null }));
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error('Invalid token or API error');
    const user: GitHubUser = await res.json();
    
    // ZERO-STORAGE: Token lives ONLY in React state
    setState({
      token,
      user,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      connectedAt: Date.now(), // Timestamp en memoria para SessionWarningBanner
    });
  } catch (err) {
    setState({ token: null, user: null, isAuthenticated: false, isLoading: false, error: (err as Error).message, connectedAt: null });
  }
}, []);
```

**AIProviderContext.tsx (Zero-Storage):**

```typescript
// La clave de IA NUNCA se escribe en sessionStorage
const connect = (p: AIProviderType, k: string, m: string) => {
  setProvider(p);
  setApiKey(k);  // Solo en memoria de React
  setModel(m);
  setConnectedAt(Date.now());
};
```

**SessionWarningBanner.tsx (adaptado a Zero-Storage):**

```typescript
// Lee timestamps desde el contexto de React, NO desde sessionStorage
const { isAuthenticated, connectedAt: ghConnectedAt, initiateOAuth } = useAuth();
const { isConnected, connectedAt: aiConnectedAt } = useAIProvider();

const checkTTL = useCallback(() => {
  const now = Date.now();
  if (isAuthenticated && ghConnectedAt) {
    const elapsed = now - ghConnectedAt;
    if (elapsed >= WARN_AFTER) {
      // Mostrar advertencia
    }
  }
}, [isAuthenticated, ghConnectedAt]);
```

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
9. Token guardado SOLO en estado de React (ZERO-STORAGE)
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
  Desarrollado por <a href="https://github.com/migueljerico">@migueljerico</a> con <strong>Claude</strong> (Anthropic), <strong>Antigravity 2.0</strong> (Google), <strong>Manus AI</strong> (Refactorización de seguridad Zero-Storage) y <strong>Qwen 3.7-Plus</strong> (Componentes de código) · 2026
</p>
