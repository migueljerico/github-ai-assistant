# 📖 Manual Técnico — GitHub AI Assistant

**Versión:** v3.68.3 · Agosto 2026

---

## 🏗️ Arquitectura General

La aplicación sigue una arquitectura de **backend thin** deliberada: el servidor Express existe para gestionar el flujo OAuth de GitHub y actuar como proxy para la API de Gemini (necesario por restricciones geográficas en la UE). Las llamadas a la GitHub API y a Groq se realizan directamente desde el navegador del usuario.

```
┌────────────────────────────────────────────────────────────────┐
│  FRONTEND (cliente)                                            │
│  React 18 · TypeScript · Vite · Recharts · memoria React (Zero-Storage) │
│                                                                │
│  ┌─────────────────┐  ┌───────────────┐  ┌─────────────────┐  │
│  │  Autenticación  │  │   Chat + IA   │  │   UI Auxiliar   │  │
│  │  AuthContext    │  │   gemini.ts   │  │  HistoryPanel   │  │
│  │  LoginButton    │  │   callAI()    │  │  TemplatePanel  │  │
│  │  PatInput       │  │ parseAction() │  │  RepoSelector   │  │
│  └────────┬────────┘  └──────┬────────┘  └─────────────────┘  │
│           │                  │                                  │
│  ┌────────▼─────────────────▼──────────────────────────────┐   │
│  │  App.tsx (wrappers finos) → services/assistantActions   │   │
│  │  runSend → callAI → parseAction → ConfirmModal          │   │
│  │  runConfirmAction → executeAction → HistoryContext      │   │
│  │  runDocumentRepo → fetchRepoTreeRecursive               │   │
│  │    → DocumentFlowModal (stepper 4 pasos)                │   │
│  └────────────────────────────────────────────────────────┘   │
┌──────────────┬────────────────────────────────────┬───────────┘
               │ /auth/github · /auth/callback      │ fetch()
               │ /api/gemini · /api/nim · /api/openzen · /api/cloudflare · /api/ollama
               ▼                                    ▼
┌──────────────────────────┐  ┌────────────────────────────────┐
│  Backend Express.js      │  │  APIs Externas                 │
│  server/index.js         │  │                                │
│  ├── GET /health         │  │  GitHub REST API v3            │
│  ├── GET /auth/github    │  │  api.github.com                │
│  ├── GET /auth/callback  │  │                                │
│  ├── POST /api/gemini    │  │  Groq Cloud                    │
│  ├── POST /api/nim       │  │  api.groq.com/openai/v1        │
│  ├── POST /api/openzen   │  │                                │
│  ├── POST /api/cloudflare│  │  Google Gemini                 │
│  ├── POST /api/ollama    │  │  generativelanguage.googleapis │
│  └── Static (prod)       │  │  (via proxy en el servidor)    │
│                          │  │                                │
│  Solo en memoria:        │  │  NVIDIA NIM                    │
│  GITHUB_CLIENT_SECRET    │  │  integrate.api.nvidia.com      │
│                          │  │                                │
│  Rate limiters por       │  │  OpenCode Zen (opencode.ai)    │
│  proveedor (40-100       │  │                                │
│  req/min por IP)          │  │  Cloudflare Workers AI         │
│                          │  │  api.cloudflare.com            │
│                          │  │                                │
│                          │  │  Ollama Cloud                  │
│                          │  │  ollama.com/v1                 │
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
│       │   ├── chat/        # ChatArea, ChatInput, ChatMessage, DocumentRepoButton,
│       │   │                #   ThreadSummaryButton, FileAttachButton, RepoContextButton
│       │   ├── confirm/     # DocumentFlowModal (stepper 4 pasos),
│       │   │                #   ConfirmModal, PublishActions (commit/Draft PR/Release)
│       │   ├── layout/      # Header, HistoryPanel, AIProviderBadge
│       │   ├── multi-repo/  # RepoSelector
│       │   └── templates/   # TemplatePanel + templateData.ts
│       ├── context/
│       │   ├── AuthContext.tsx      # Token GitHub, usuario, OAuth/PAT (Zero-Storage)
│       │   ├── AIProviderContext.tsx # Proveedor IA activo (Zero-Storage)
│       │   ├── LanguageContext.tsx  # i18n ligero (#24): idioma + t() con interpolación; recordado en sessionStorage
│       │   └── HistoryContext.tsx   # Log de sesión + exportación
│       ├── i18n/                    # Diccionarios ES/EN (#24); t() con fallback ES→key
│       │   ├── es.ts
│       │   └── en.ts
│       ├── services/
│       │   ├── github.ts           # Wrapper GitHub REST API v3
│       │   ├── providers.ts        # Registro de los 10 proveedores de IA
│       │   ├── gemini.ts           # Cliente unificado (callAI, OpenAI-compatible + proxy)
│       │   ├── assistantActions.ts # Orquestación del chat (runSend/Confirm/Cancel + botones) #42;
│       │   │                        #   documentar+publicar archivo (commit/Draft PR/Release + fuente/extras) #28
│       │   ├── threadSummary.ts    # Resumen de hilos de issues/PRs (#32)
│       │   ├── docPublisher.ts     # Publica docs: commit/Draft PR; publishFileDoc + binarios/extras (#28/#45)
│       │   └── actionExecutor.ts   # Ejecutor de acciones confirmadas
│       ├── utils/
│       │   ├── formatResult.ts     # Formateador de resultados de API
│       │   ├── repoRef.ts          # resolveRepoRef (owner/repo vs repo)
│       │   ├── pdfReader.ts        # Lectura de archivos adjuntos: PDF/texto + assertSupportedFile (#28)
│       │   ├── pdfAdvanced.ts      # Extracción de PDF con pdfjs-dist (fallback básico) (#28)
│       │   ├── spreadsheetReader.ts # Excel/CSV con SheetJS: muestra de filas + aviso de tokens (#28 Fase 3a)
│       │   ├── powerbiReader.ts    # Power BI .pbix/.pbit (ZIP vía fflate): informe + modelo/DAX + Power Query/M del DataMashup (#28 Fase 3b/3b-bis)
│       │   ├── docxReader.ts       # Word .docx (ZIP OOXML vía fflate): texto de word/document.xml (#28)
│       │   ├── releaseGenerator.ts # createGitHubRelease + suggestNextVersion + notas
│       │   ├── releaseAssets.ts    # Subida de assets a uploads.github.com (validación + MIME)
│       │   ├── contextRanker.ts    # #49: rankFilesByQuery (BM25) — elige los archivos relevantes a la pregunta
│       │   ├── codeHealth.ts       # #44: métricas puras del dashboard (lenguajes/deuda/commits por semana)
│       │   ├── conversationIO.ts   # #46: serializar/parsear la conversación (export/import JSON, Zero-Storage)
│       │   ├── retry.ts            # #40: withTransientRetry/isTransientError/isAbortError (IA + GitHub)
│       │   └── modeDetection.ts    # Detección de modo chat vs action
│       └── types/index.ts          # Tipos compartidos TypeScript
├── server/
│   ├── index.js              # Express: OAuth + proxies (Gemini/NIM/OpenZen/CF/Ollama/Ai&) + rate limit + static
│   ├── logger.js             # #65 (v3.39.0): logEvent (JSON línea) + requestIdMiddleware
│   └── __tests__/            # Tests de servidor (vitest + supertest): geminiModelsProxy, rateLimit, logger, health
├── Dockerfile                # Multi-stage build (Node 22 Alpine)
├── .env.example              # Plantilla de variables de entorno
└── .gitignore
```

---

## 🔄 Flujo de una Operación Completa

```
Usuario escribe en el chat "Crea un repositorio público llamado mi-proyecto"
↓
App.tsx (wrapper fino) → services/assistantActions.ts → runSend()
  Construye el historial de conversación
  Llama a callAI(messages, provider, apiKey, model) → gemini.ts
↓
gemini.ts → callOpenAICompatible() o callGeminiDirect()  (con reintento transitorio)
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
runConfirmAction() → executeAction()
  actionExecutor.ts → resolveEndpoint() → createRepo() en github.ts
  → POST https://api.github.com/user/repos → Token Bearer del usuario en el header
↓
Resultado → HistoryContext.addEntry()
Mensaje de éxito/error en el chat
```

### Flujo de documentar y publicar (v3.27.0 — unificado)

La UI de documentación es un único flujo stepper de 4 pasos (`DocumentFlowModal`)
que unifica los dos flujos divergentes previos ("Documentar repo" → DocModal y
"📤 Documentar y publicar archivo" → FilePublishModal):

```
Paso 1 — Alcance: elegir "repo" o "archivo adjunto"
Paso 2 — Generar: analizar repo o generar doc del archivo
Paso 3 — Revisar: preview de README.md / MANUAL_TECNICO.md (scope repo)
              o del documento generado (scope archivo)
Paso 4 — Destino + método: commit directo / Draft PR / Release
           + opción de subir archivo fuente y extras (imágenes→screenshots/,
             datos→data/)
```

**Componentes implicados:**
- `DocumentFlowModal.tsx` — stepper de 4 pasos, estado compartido.
- `PublishActions.tsx` — barra de acciones (commit / Draft PR / Release + versión).
- `docPublisher.ts` — escritura de `README.md` + `MANUAL_TECNICO.md` (commit/Draft PR)
  + `publishFileDoc` para scope archivo (`docs/{basename}.md`).
- `assistantActions.ts` — orquestación (`runCommitDocs`, `runCreateDraftPr`,
  `runCreateRepoRelease`, `runPublishFileDoc`, `runCreateFileRelease`).

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

Al cargar el catálogo dinámico, `pickDefaultModel` (en `providers.ts`) elige como
modelo por defecto uno gratuito **fiable** (preferencia: Gemma → modelos Llama vigentes →
DeepSeek) en vez de un `:free` arbitrario, ya que muchos endpoints gratuitos de
OpenRouter están a menudo saturados. Si el usuario ya cambió el selector, se respeta
su elección.

### Reintento ante errores transitorios (v2.7.3)

Los proveedores de IA fallan a menudo con errores **transitorios** del servidor
(Gemini `503 "high demand, try again later"`; OpenRouter `"Provider returned error"`).
`callAI` envuelve la llamada en `withTransientRetry` (en `gemini.ts`), que reintenta
con backoff exponencial corto (hasta 2 veces) **solo** cuando `isTransientAIError`
detecta un caso transitorio (status 5xx, patrones de mensaje conocidos, fallos de red).
Los errores **no recuperables** (key inválida, 400/401) se propagan de inmediato sin
reintentar. La validación de clave (`validateProviderKey`) llama a las funciones internas
directamente, por lo que no se ve afectada por este reintento.

### Diferencias de implementación por transporte

| Proveedor | Transporte | Proxy backend | Razón del proxy |
|---|---|---|---|
| Groq Cloud | OpenAI-compatible | No (fetch directo) | Sin bloqueo CORS ni geográfico |
| OpenRouter | OpenAI-compatible | No (fetch directo) | Sin bloqueo CORS ni geográfico |
| Zenmux | OpenAI-compatible | No (fetch directo) | Sin bloqueo CORS ni geográfico |
| NVIDIA NIM | OpenAI-compatible | Sí (`/api/nim`) | Sin CORS → el navegador bloquea "Failed to fetch" |
| OpenCode Zen | OpenAI-compatible | Sí (`/api/openzen`) | Sin CORS → el navegador bloquea "Failed to fetch" |
| Cloudflare Workers AI | OpenAI-compatible | Sí (`/api/cloudflare`) | Sin CORS → el navegador bloquea "Failed to fetch" |
| Ollama Cloud | OpenAI-compatible | Sí (`/api/ollama`) | Sin CORS → el navegador bloquea "Failed to fetch" |
| Ai& | OpenAI-compatible | Sí (`/api/aiand`) | Sin CORS → el navegador bloquea "Failed to fetch" |
| Google Gemini | `gemini-proxy` (SDK) | Sí (`/api/gemini`) | Bloqueo geográfico en EEA |

### Proxies backend (rate limiters por proveedor)

Cada proxy backend tiene su propio rate limiter (`express-rate-limit`) para que el
abuso de un proveedor no agote la cuota del otro:

| Proxy | Rate limit | Endpoints |
|---|---|---|
| `POST /api/gemini` | 40 req/min por IP | `generativelanguage.googleapis` |
| `POST /api/nim` + `GET /api/nim/models` | 40 req/min por IP | `integrate.api.nvidia.com/v1` |
| `POST /api/openzen` | 100 req/min por IP | `opencode.ai/zen/v1` |
| `POST /api/cloudflare` + `GET /api/cloudflare/models` | 100 req/min por IP | `api.cloudflare.com/client/v4/accounts/{id}/ai/...` (chat `v1` + `models/search`) |
| `POST /api/ollama` + `GET /api/ollama/models` | 100 req/min por IP | `ollama.com/v1` |
| `POST /api/aiand` + `GET /api/aiand/models` | 100 req/min por IP | `api.aiand.com/v1` |

Todos los proxies reenvían el body y el header `Authorization` sin tocarlos,
respeta streaming SSE (`pipeUpstream`), y sanean headers del upstream para
evitar caracteres no ISO-8859-1. La API key del usuario viaja en HTTPS y nunca
se persiste, loguea ni cachea.

---

## 🔌 GitHub REST API v3 — github.ts

### Endpoints utilizados

| Función | Método | Endpoint |
|---|---|---|
| `getUser()` | GET | `/user` |
| `listAllRepos()` | GET | `/user/repos?per_page=100&page=N` |
| `createRepo()` | POST | `/user/repos` |
| `getRepo()` / `repoExists()` | GET | `/repos/{owner}/{repo}` |
| `getBranchSha()` | GET | `/repos/{owner}/{repo}/git/ref/heads/{branch}` |
| `createBranch()` | POST | `/repos/{owner}/{repo}/git/refs` |
| `getFileContents()` | GET | `/repos/{owner}/{repo}/contents/{path}` |
| `createOrUpdateFile()` | PUT | `/repos/{owner}/{repo}/contents/{path}` |
| `createOrUpdateBinaryFile()` | PUT | `/repos/{owner}/{repo}/contents/{path}` (bytes en Base64) |
| `deleteFile()` | DELETE | `/repos/{owner}/{repo}/contents/{path}` |
| `createPullRequest()` | POST | `/repos/{owner}/{repo}/pulls` (admite `draft`) |
| `createGitHubRelease()` | POST | `/repos/{owner}/{repo}/releases` |
| `uploadReleaseAsset()` | POST | `uploads.github.com/.../releases/{id}/assets` |
| `getIssueOrPr()` / comentarios | GET | `/repos/{owner}/{repo}/issues/{n}` (+ `/comments`, `/pulls/{n}/comments`) |
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

Las claves de API de IA (Groq, Gemini, OpenRouter, NVIDIA NIM, Zenmux,
OpenCode Zen, Cloudflare Workers AI, Ollama Cloud) también viven exclusivamente
en la memoria de React, dentro del `AIProviderContext`. No se almacenan en
ningún sitio.

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
2. Express → genera `state` con **CSPRNG** (`randomUUID()` de `node:crypto`, no `Math.random()`), lo guarda en sesión
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

El mismo criterio aplica al **`state` anti-CSRF del flujo OAuth** (v3.7.1): el servidor lo
genera con `randomUUID()` de `node:crypto` (CSPRNG, 122 bits impredecibles) y lo valida un
solo uso en el callback, en lugar del antiguo `Math.random()` (no criptográfico, predecible).

---

## 🚀 Despliegue — Dockerfile y Cloud Run

### Dockerfile multi-stage

- **Stage 1 (builder):** `node:22-alpine` → `npm ci` → `npm run build` (Vite)
  Produce: `client/dist/` (archivos estáticos)
- **Stage 2 (production):** `node:22-alpine` → `npm install --omit=dev`
  Copia: `server/` + `client/dist/`
  Expone: `$PORT` (8080 en Cloud Run)
  CMD: `node server/index.js`

> **Node 22 (no bajar a 20):** `pdfjs-dist@6` exige Node `>=22.13`. Con `node:20` npm
> omitía `pdfjs-dist` en silencio (es `optionalDependency`) y `tsc` fallaba en el build.
> Debe seguir alineado con CI (Node 24) y el entorno local.

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

**`deploy.sh` (deploy manual validado, v3.41.0 — #25-parte3).** Alternativa al
comando anterior: valida que las **3 variables críticas**
(`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`) estén presentes
**antes** de desplegar, para no subir una revisión rota (OAuth caído o sesión sin
firmar). Las lee de `.env` si existe (las ya exportadas en el shell/CI tienen
prioridad); si falta alguna, aborta con `exit 1` y un mensaje claro. Pide
confirmación `[s/N]` (default NO) antes de invocar el mismo `gcloud run deploy`
de arriba.

```bash
./deploy.sh        # o:  npm run deploy
```

> **No sustituye al CD automático** (activador de Cloud Build en cada push a
> `main`): es para deploys puntuales o rollbacks sin pasar por `main`. Tampoco
> gestiona secretos — las variables viven en el servicio de Cloud Run, no las
> pasa el script (no `--set-env-vars`).

---

## 🧪 Testing y Calidad

### Infraestructura

- **Framework unitarios:** Vitest + React Testing Library (jsdom)
- **Framework E2E:** Playwright (chromium) — tests del flujo crítico en navegador real
- **Cobertura:** Codecov (badge en README)
- **CI:** GitHub Actions ejecuta en cada push/PR a `main`:
  - `.github/workflows/ci.yml` (`CI & Coverage`): lint + tests del cliente con cobertura + tests del servidor (job `server-test`) + escaneo de secretos (gitleaks).
  - `.github/workflows/e2e.yml` (`E2E`): tests E2E con Playwright sobre la arquitectura real (Express sirviendo el SPA construido). Workflow separado para tener un badge de estado dedicado en el README.
- **Cobertura actual:** ~90% líneas (ver Codecov para el valor exacto; umbral mínimo Vitest 70%) · 926 tests en el cliente + 50 en el servidor (976 totales) + 13 tests E2E con Playwright (5 specs, incluyendo `a11y.spec.ts` de foco visible y movimiento reducido desde v3.64.0)

### Módulos testeados

| Módulo | Tests | Cobertura |
|---|---|---|
| `AuthContext.tsx` | Login, logout, OAuth, Zero-Storage | ✅ |
| `AIProviderContext.tsx` | Connect/disconnect, Zero-Storage | ✅ |
| `providers.ts` | Registro, detección de modelos 🆓, caché de catálogo, `pickDefaultModel` | ✅ |
| `actionExecutor.ts` | GET, POST, PUT, DELETE, PATCH, multi-repo | ✅ |
| `github.ts` | Base64 (texto + binario), ghFetch, getUser, createRepo, repoExists, getRepo, getBranchSha, createBranch, createPullRequest | ✅ |
| `gemini.ts` | parseGeminiAction, detectPrimaryLanguage, temperatura por modo, contexto de repo (#41), `generateFileDoc` (incorpora conversación), enrutado OpenRouter, reintento transitorio (`withTransientRetry`) | ✅ |
| `docPublisher.ts` | Commit directo / Draft PR (#45); `publishFileDoc` + binarios/extras (`uploadPathFor`) (#28) | ✅ |
| `threadSummary.ts` | Resumen de hilos issue/PR (#32): parseo, issue vs PR, hilo vacío | ✅ |
| `assistantActions.ts` | Orquestación del chat (#42): `runSend`, `runConfirmAction`, `runCancelAction`; documentar repo (`runCommitDocs`/`runCreateDraftPr`/`runCreateRepoRelease`); documentar/publicar archivo (`runPublishFileDoc`/`runCreateFileRelease`) y `runAttachFile` (~98%) | ✅ |
| `repoRef.ts` | `resolveRepoRef` (owner/repo vs repo) | ✅ |
| `DocumentFlowModal.tsx` / `PublishActions.tsx` | Stepper 4 pasos (alcance → generar → revisar → destino + método); barra de acciones compartida (v3.10.0); tabs README/MANUAL; offer crear repo; extras a subir | ✅ |
| `modeDetection.ts` | Chat vs action; sesgo a chat con contexto de repo/archivo | ✅ |
| `formatResult.ts` | Arrays, objetos, strings, JSON | ✅ |
| `releaseGenerator.ts` / `releaseAssets.ts` | createGitHubRelease, notas, suggestNextVersion; subida/validación de assets | ✅ |
| `pdfReader.ts` / `pdfAdvanced.ts` | Extracción/limpieza de texto, fallback, `assertSupportedFile` | ✅ |
| `spreadsheetReader.ts` / `powerbiReader.ts` | Excel/CSV (muestra de filas); Power BI informe + DAX + Power Query/M | ✅ |
| `docxReader.ts` | Word `.docx`: extracción de párrafos/tablas, entidades XML, truncado, errores | ✅ |
| Hooks | `useChat`, `useActions` | ✅ |
| Componentes React | ChatArea, ChatInput, ChatMessage, ConfirmModal, Header, TemplatePanel, AIProviderPanel, AIProviderBadge, RepoContextButton, FileAttachButton, ThreadSummaryButton | ✅ |
| Servidor | `rateLimit.test.js` (rate limiter del proxy), `logger.test.js` (logs estructurados #65), `health.test.js` (healthcheck extendido #25-parte2) | ✅ |
| E2E (`e2e/`) | `chat.spec.ts` (auth → chat → acción confirmada → error accionable, #75), `theme.spec.ts` (toggle #71), `i18n.spec.ts` (ES↔EN), `persistence.spec.ts` (anti-FOUC + reload) | ✅ |

### Ejecutar tests localmente

```bash
# Unitarios del cliente (con cobertura)
cd client
npm run test:coverage

# Tests del servidor (desde la raíz)
npm run test:server

# Tests E2E con Playwright (desde la raíz). El webServer del playwright.config
# arranca Express en :3300 sirviendo el SPA ya construido en client/dist.
npm run test:e2e:full   # build + e2e   |   npm run test:e2e   # solo e2e
```

---

## ⚠️ Limitaciones conocidas

Ver [MEJORAS_FUTURAS.md](./MEJORAS_FUTURAS.md) para el detalle completo.

| Limitación | Impacto | Solución planificada |
|---|---|---|
| ~~Truncamiento por caracteres (2000)~~ | ~~Corta código a mitad~~ | ✅ Truncamiento por líneas (#20, v3.11.1) |
| SessionWarningBanner no implementado | Sin aviso de caducidad | Banner de advertencia (#22) |
| ~~Prompts incrustados en código~~ | ~~Dificulta edición/i18n~~ | ✅ Migrados a archivos `prompts/*.md` (#23, v3.11.2) |
| ~~App solo en español~~ | ~~Limita audiencia~~ | ✅ i18n ligero ES/EN sin dependencias (#24, Fases 1–2: v3.20.0–v3.21.0) |
| ~~Sin healthcheck extendido~~ | ~~Menos visibilidad~~ | ✅ Healthcheck ampliado en `/health` con versión/uptime/env + logs estructurados (#25 partes 1–2: v3.39.0–v3.40.0) |

### Limitaciones resueltas en v2.3.0

| Limitación | Solución aplicada | Versión |
|---|---|---|
| ~~Claves de IA en sessionStorage~~ | Zero-Storage completo | v2.2.0 |
| ~~Sin rate limiting en proxy Gemini~~ | `express-rate-limit` (40 req/min) | v2.3.0 |
| ~~`formatResultData` embebida en App.tsx~~ | Extraída a `utils/formatResult.ts` | v2.3.0 |
| ~~`uid()` usa `Math.random()`~~ | `crypto.randomUUID()` | v2.3.0 |
| ~~Sin soporte PATCH en executor~~ | `case 'PATCH'` añadido | v2.1.0 |
| ~~`fetch()` duplicado en actionExecutor~~ | Unificado con `ghFetch()` | v2.1.0 |
