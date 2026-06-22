# 📖 Manual Técnico — GitHub AI Assistant

**Versión:** v2.5.0 · Junio 2026

---

## 🏗️ Arquitectura General

La aplicación sigue una arquitectura de **backend thin** deliberada: el servidor Express existe para gestionar el flujo OAuth de GitHub y actuar como proxy para la API de Gemini (necesario por restricciones geográficas en la UE). Las llamadas a la GitHub API y a Groq se realizan directamente desde el navegador del usuario.

```
┌────────────────────────────────────────────────────────────────┐
│  FRONTEND (cliente)                                            │
│  React 18 · TypeScript · Vite · memoria React (Zero-Storage)   │
│                                                                │
│  ┌─────────────────┐  ┌───────────────┐  ┌─────────────────┐  │
│  │  Autenticación  │  │   Chat + IA   │  │   UI Auxiliar   │  │
│  │  AuthContext    │  │   gemini.ts   │  │  HistoryPanel   │  │
│  │  LoginButton    │  │   callAI()    │  │  TemplatePanel  │  │
│  │  PatInput       │  │ parseAction() │  │  RepoSelector   │  │
│  └────────┬────────┘  └──────┬────────┘  └─────────────────┘  │
│           │                  │                                  │
│  ┌────────▼─────────────────▼──────────────────────────────┐   │
│  │  App.tsx — Orquestador principal                        │   │
│  │  handleSend → callAI → parseAction → ConfirmModal       │   │
│  │  handleConfirm → executeAction → HistoryContext         │   │
│  │  handleDocumentRepo → fetchRepoTreeRecursive → DocModal │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────┬────────────────────────────────────┬───────────┘
               │ /auth/github · /auth/callback      │ fetch()
               │ /api/gemini (proxy + rate limit)   │
               ▼                                    ▼
┌──────────────────────────┐  ┌────────────────────────────────┐
│  Backend Express.js      │  │  APIs Externas                 │
│  server/index.js         │  │                                │
│  ├── GET /health         │  │  GitHub REST API v3            │
│  ├── GET /auth/github    │  │  api.github.com                │
│  ├── GET /auth/callback  │  │                                │
│  ├── POST /api/gemini    │  │  Groq Cloud                    │
│  │   (rate limited)     │  │  api.groq.com/openai/v1        │
│  └── Static (prod)       │  │                                │
│                          │  │  Google Gemini                 │
│  Solo en memoria:        │  │  generativelanguage.googleapis │
│  GITHUB_CLIENT_SECRET    │  │  (via proxy en el servidor)    │
└──────────────────────────┘  └────────────────────────────────┘
```

---

## 📁 Estructura del Proyecto

```
github-ai-assistant/
├── client/                  # Aplicación React
│   └── src/
│       ├── components/
│       │   ├── ai-provider/ # Panel conexión de IA
│       │   ├── auth/        # OAuth / PAT / UserBadge
│       │   ├── chat/        # ChatArea, ChatInput, ChatMessage, DocRepoButton
│       │   ├── confirm/     # ConfirmModal
│       │   ├── layout/      # Header, HistoryPanel, AIProviderBadge
│       │   ├── multi-repo/  # RepoSelector
│       │   └── templates/   # TemplatePanel + templateData.ts
│       ├── context/
│       │   ├── AuthContext.tsx      # Token GitHub, usuario, OAuth/PAT (Zero-Storage)
│       │   ├── AIProviderContext.tsx # Proveedor IA activo (Zero-Storage)
│       │   └── HistoryContext.tsx   # Log de sesión + exportación
│       ├── services/
│       │   ├── github.ts           # Wrapper GitHub REST API v3
│       │   ├── providers.ts        # Registro de proveedores (Gemini/Groq/OpenRouter)
│       │   ├── gemini.ts           # Cliente unificado (callAI, OpenAI-compatible + proxy)
│       │   └── actionExecutor.ts   # Ejecutor de acciones confirmadas
│       ├── utils/
│       │   └── formatResult.ts     # Formateador de resultados de API
│       └── types/index.ts          # Tipos compartidos TypeScript
├── server/
│   └── index.js              # Express: OAuth + proxy Gemini + rate limit + static
├── Dockerfile                # Multi-stage build (Node 20 Alpine)
├── .env.example              # Plantilla de variables de entorno
└── .gitignore
```

---

## 🔄 Flujo de una Operación Completa

```
Usuario escribe en el chat "Crea un repositorio público llamado mi-proyecto"
↓
App.tsx → handleSend()
  Construye el historial de conversación
  Llama a callAI(messages, provider, apiKey, model) → gemini.ts
↓
gemini.ts → callGroq() o callGeminiDirect()
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
parseGeminiAction() valida el JSON
  Si tiene tipo+accion+metodo → GeminiAction
  Si no → respuesta conversacional
↓
requiereConfirmacion === true → Se abre ConfirmModal con descripción
Usuario pulsa "✅ Confirmar y ejecutar"
↓
handleConfirm() → executeAction()
  actionExecutor.ts → resolveEndpoint() → createRepo() en github.ts
  → POST https://api.github.com/user/repos → Token Bearer del usuario en el header
↓
Resultado → HistoryContext.addEntry()
Mensaje de éxito/error en el chat
```

---

## 🧠 Sistema de IA — gemini.ts

### Diseño del System Prompt

El system prompt (`SYSTEM_PROMPT`) está diseñado con cuatro objetivos explícitos documentados en el código:

- **Respuestas solo JSON** — facilita el parseo estructurado y la UI de confirmación
- **Nunca ejecutar** — el agente propone, el usuario confirma, el executor actúa
- **Reglas de endpoint** — previene errores 404 por placeholders sin resolver
- **Idioma español** — el usuario objetivo interactúa en español

### Routing entre proveedores (registro config-driven, #15)

Los proveedores se describen en un **registro central** (`services/providers.ts`):
cada uno declara su `transport` (`gemini-proxy` u `openai-compatible`), endpoints,
modelos, etc. `callAI` enruta según ese `transport`, sin hardcodear proveedores.

```typescript
// transport === 'gemini-proxy'      → callGeminiDirect()  (proxy /api/gemini)
// transport === 'openai-compatible' → callOpenAICompatible(endpoint, …)  (Groq, OpenRouter)
export async function callAI(messages, systemPrompt, provider, apiKey, model, mode?): Promise<string>
```

Añadir un proveedor nuevo = rellenar una entrada en el registro. Las claves de API
se leen del `AIProviderContext` (memoria React) en cada llamada y nunca pasan por el
servidor (excepto la de Gemini, que viaja en el body HTTPS hacia el proxy).

### Diferencias de implementación por transporte

| Aspecto | OpenAI-compatible (Groq, OpenRouter) | Gemini |
|---|---|---|
| SDK | `fetch()` directo (sin proxy) | `@google/generative-ai` (via proxy) |
| Formato mensajes | OpenAI-compatible (`system` + `messages`) | `startChat({ history })` + `sendMessage()` |
| System prompt | Mensaje con `role: 'system'` | `systemInstruction` en el modelo |
| Catálogo de modelos | `GET /models` dinámico (OpenRouter etiqueta 🆓) | Lista curada estática |
| Temperatura | 0.7 chat / 0.1 acción | Por defecto del SDK |
| Max tokens | 4096 | 1024 (SDK default) |
| Restricciones geográficas | Ninguna | Bloqueado en UE/EEA (requiere proxy) |

### Proxy de Gemini con Rate Limiting

La API de Gemini bloquea las peticiones directas desde navegadores en la región europea (EEA). Para solucionar esto, el servidor Express actúa como proxy:

```
Frontend → POST /api/gemini
Body: { apiKey, model, messages, systemPrompt }
  ↓
Server → Rate limiter (40 req/min por IP) → SDK de Gemini (desde us-central1)
  ↓
Server → { text } → Frontend
```

> La API key viaja en el body HTTPS y no se almacena en el servidor. El rate limiter (`express-rate-limit`) protege contra abuso con un límite de 40 peticiones por minuto por IP.

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
MAX_FILES    = 80      // Cap de archivos a analizar
MAX_FILE_SIZE = 50KB   // Archivos más grandes se saltan
```

Prioridad de análisis:

```
0 → README              (más informativo)
1 → package.json        (contexto de dependencias)
2 → src/                (implementación principal)
3 → Archivos de configuración (.json, .yaml, .toml)
4 → Código fuente (.ts, .js, .py, etc.)
5 → Todo lo demás
```

Descarga en batches de 5 archivos en paralelo (respeto a los rate limits de GitHub: 5000 req/h con OAuth).

---

## 🔐 Autenticación — AuthContext.tsx y server/index.js

### Arquitectura Zero-Storage Completa

La aplicación implementa una arquitectura **Zero-Storage** completa: ninguna credencial del usuario se almacena en el navegador (ni sessionStorage, ni localStorage, ni cookies, ni IndexedDB).

**Token de GitHub — Memoria React:**

El token de acceso de GitHub vive exclusivamente en el estado de React (memoria volátil del contexto). Nunca se escribe en ninguna API de almacenamiento del navegador.

**Claves de IA — Memoria React:**

Las claves de API de IA (Groq/Gemini) también viven exclusivamente en la memoria de React, dentro del `AIProviderContext`. No se almacenan en ningún sitio.

**Justificación de seguridad:** La aplicación requiere el scope `repo` de GitHub, que otorga acceso completo de lectura/escritura a todos los repositorios del usuario (públicos y privados). El vector de ataque más común en aplicaciones web es XSS (Cross-Site Scripting), que permite a un atacante ejecutar JavaScript arbitrario en el contexto de la página. Si las credenciales estuvieran en sessionStorage o localStorage, un script XSS podría leerlas y exfiltrarlas. Al mantener todo solo en memoria de React, un script XSS no puede acceder directamente a las variables de estado de React, eliminando este vector de ataque.

### Implementación técnica

#### AuthContext.tsx (Zero-Storage para token GitHub)

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
    setState({ token, user, isAuthenticated: true, isLoading: false, error: null });
  } catch (err) {
    setState({ token: null, user: null, isAuthenticated: false, isLoading: false, error: (err as Error).message });
  }
}, []);

// Logout: limpia estado React Y cierra sesión en GitHub.com
const logout = useCallback(() => {
  setState({ token: null, user: null, isAuthenticated: false, isLoading: false, error: null, connectedAt: null });
  window.location.href = `https://github.com/logout?return_to=${encodeURIComponent(window.location.origin)}`;
}, []);
```

#### AIProviderContext.tsx (Zero-Storage para claves IA)

```typescript
// Las claves de IA viven SOLO en memoria React (no en sessionStorage)
export function AIProviderProvider({ children }: { children: React.ReactNode }) {
  const [provider, setProvider] = useState<AIProviderType | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);

  const connect = (p: AIProviderType, k: string, m: string) => {
    setProvider(p); setApiKey(k); setModel(m);
    // ZERO-STORAGE: No se guarda en sessionStorage
  };

  const disconnect = () => {
    setProvider(null); setApiKey(null); setModel(null);
    // ZERO-STORAGE: No hay nada que borrar de sessionStorage
  };
```

### Flujo OAuth completo

1. Frontend → `window.location.href = '/auth/github'`
2. Express → genera `state` aleatorio, lo guarda en sesión
3. Express → redirect a GitHub con `client_id` + `scope` + `state`
4. GitHub → muestra pantalla de autorización al usuario
5. Usuario aprueba → GitHub redirige a `/auth/callback?code=XXX&state=YYY`
6. Express → verifica que `state` coincide (previene CSRF)
7. Express → POST a `github.com/login/oauth/access_token` (`CLIENT_SECRET` nunca sale del servidor)
8. GitHub → devuelve `access_token`
9. Express → redirect al frontend con token en URL hash
10. Frontend → extrae token, llama `GET /user` para validar
11. Token guardado **SOLO** en estado de React (ZERO-STORAGE)

### Logout completo

Cuando el usuario hace clic en "Cerrar sesión":
1. Se limpia el estado de React (token GitHub desaparece de memoria)
2. Se redirige a `https://github.com/logout?return_to=...`
3. GitHub cierra la sesión del usuario en github.com
4. GitHub redirige de vuelta a la app
5. El usuario está completamente deslogueado de ambos sitios

### Fix de protocolo para Cloud Run

El servidor detecta si el host contiene `run.app` y fuerza el protocolo `https://` en el callback URL, evitando redirecciones HTTP en producción que GitHub rechaza.

---

## 🛡️ Seguridad y Protección

### Rate Limiting

El endpoint `/api/gemini` está protegido con `express-rate-limit`:

```javascript
const geminiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 40,             // 40 peticiones por ventana
  message: { error: 'Demasiadas peticiones a Gemini. Por favor espera un minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});
```

Esto previene que un atacante agote la cuota de la API key del usuario.

### IDs Únicos Seguros

Los mensajes del chat usan `crypto.randomUUID()` (UUID v4, CSPRNG) en lugar de `Math.random()`:

```typescript
const uid = () => crypto.randomUUID();
```

Esto garantiza IDs únicos y protege contra posibles colisiones en sesiones largas.

---

## 🚀 Despliegue — Dockerfile y Cloud Run

### Dockerfile multi-stage

- **Stage 1 (builder):** `node:20-alpine` → `npm ci` → `npm run build` (Vite)
  Produce: `client/dist/` (archivos estáticos)
- **Stage 2 (production):** `node:20-alpine` → `npm install --omit=dev`
  Copia: `server/` + `client/dist/`
  Expone: `$PORT` (8080 en Cloud Run)
  CMD: `node server/index.js`

### Variables de entorno en producción

| Variable | Requerida | Descripción |
|---|---|---|
| `GITHUB_CLIENT_ID` | ✅ Sí | Client ID de la GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | ✅ Sí | Client Secret (nunca al frontend) |
| `SESSION_SECRET` | ✅ Sí | Clave para firmar cookies de sesión |
| `PORT` | Cloud Run lo inyecta | Puerto de escucha (default: 8080) |
| `NODE_ENV` | Auto en Dockerfile | `production` activa cookies `secure: true` |

### Pipeline CI/CD

El proyecto tiene **dos sistemas separados** (es importante no confundirlos):

- **CI — GitHub Actions** (`.github/workflows/ci.yml`): en cada push/PR a `main`
  ejecuta lint, tests del cliente con cobertura (→ Codecov) y los tests del
  servidor. **No despliega**; solo valida el código.
- **CD — Activador de Cloud Build**: conectado al repo de GitHub, en cada push a
  `main` ejecuta automáticamente **Build** (Dockerfile multi-stage) → **Push** a
  Artifact Registry (`us-central1-docker.pkg.dev/.../github-ai-assistant`) →
  **Deploy** de una nueva revisión en Cloud Run (que pasa a servir el 100% del
  tráfico). Es decir, **cada merge a `main` llega solo a producción** en ~2 min.

> Compilar (CI, en servidores de GitHub) y desplegar (CD, en Cloud Build) son
> procesos distintos: que el CI esté verde no actualiza la app en vivo; de eso se
> encarga el activador de Cloud Build.

**Despliegue manual** (alternativa puntual, p. ej. para un rollback o sin pasar
por `main`):

```bash
gcloud run deploy github-ai-assistant \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 🧪 Testing y Calidad

### Infraestructura

- **Framework:** Vitest + React Testing Library (jsdom)
- **Cobertura:** Codecov (badge en README)
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) ejecuta en cada push/PR a `main`
  el lint, los tests del cliente con cobertura y los tests del servidor
  (job `server-test`). Ver "Pipeline CI/CD" en la sección de despliegue.
- **Cobertura actual:** 49%

### Módulos testeados

| Módulo | Tests | Cobertura |
|---|---|---|
| `AuthContext.tsx` | Login, logout, OAuth, Zero-Storage | ✅ |
| `AIProviderContext.tsx` | Connect/disconnect, Zero-Storage | ✅ |
| `actionExecutor.ts` | GET, POST, PUT, DELETE, PATCH, multi-repo | ✅ |
| `github.ts` | Base64, ghFetch, getUser, createRepo, etc. | ✅ |
| `gemini.ts` | parseGeminiAction, detectPrimaryLanguage, temperatura Groq por modo, contexto de repo (#41) | ✅ |
| `formatResult.ts` | Arrays, objetos, strings, JSON | ✅ |
| `releaseGenerator.ts` | createGitHubRelease, notas, suggestNextVersion | ✅ |
| `pdfReader.ts` / `pdfAdvanced.ts` | Extracción/limpieza de texto, fallback | ✅ |
| Hooks | `useChat`, `useActions` | ✅ |
| Componentes React | ChatArea, ChatInput, ConfirmModal, Header, TemplatePanel, AIProviderPanel, AIProviderBadge, RepoContextButton | ✅ |
| Servidor | `rateLimit.test.js` (rate limiter del proxy) | ✅ |

### Ejecutar tests localmente

```bash
cd client
npm run test:coverage
```

---

## ⚠️ Limitaciones conocidas

Ver [MEJORAS_FUTURAS.md](./MEJORAS_FUTURAS.md) para el detalle completo.

| Limitación | Impacto | Solución planificada |
|---|---|---|
| DocModal embebido en App.tsx | Dificulta el mantenimiento | Extraer a componente (#16) |
| Truncamiento por caracteres (2000) | Corta código a mitad | Truncamiento por líneas (#20) |
| SessionWarningBanner no implementado | Sin aviso de caducidad | Banner de advertencia (#22) |
| Prompts incrustados en código | Dificulta edición/i18n | Migrar a archivos .md (#23) |
| App solo en español | Limita audiencia | i18n con i18next (#24) |
| Sin healthcheck extendido | Menos visibilidad | Logs + health mejorado (#25) |

### Limitaciones resueltas en v2.3.0

| Limitación | Solución aplicada | Versión |
|---|---|---|
| ~~Claves de IA en sessionStorage~~ | Zero-Storage completo | v2.2.0 |
| ~~Sin rate limiting en proxy Gemini~~ | `express-rate-limit` (40 req/min) | v2.3.0 |
| ~~`formatResultData` embebida en App.tsx~~ | Extraída a `utils/formatResult.ts` | v2.3.0 |
| ~~`uid()` usa `Math.random()`~~ | `crypto.randomUUID()` | v2.3.0 |
| ~~Sin soporte PATCH en executor~~ | `case 'PATCH'` añadido | v2.1.0 |
| ~~`fetch()` duplicado en actionExecutor~~ | Unificado con `ghFetch()` | v2.1.0 |
