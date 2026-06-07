<div align="center">

# 🔧 Manual Técnico — Asistente de IA para Publicar Repositorios

**Versión 2.0.0 · Junio 2026**

</div>

---

## 1. Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                     CAPA DE PRESENTACIÓN                    │
│              React 18 + TypeScript + Vite                   │
│                                                             │
│  AuthGate → AIProviderGate → App                           │
│  (GitHub auth)  (IA key)   (chat + acciones)               │
└───────────────────────┬─────────────────────────────────────┘
                        │
          ┌─────────────┼───────────────┐
          │             │               │
┌─────────▼──────┐ ┌────▼────┐ ┌───────▼──────────┐
│  CAPA DE IA    │ │  OAuth  │ │ CAPA INTEGRACIÓN │
│                │ │ Express │ │                   │
│  callAI()      │ │ Backend │ │ GitHub REST API   │
│  → Gemini API  │ │ (thin)  │ │ v3 (directo)     │
│  → Groq API    │ │         │ │                   │
└────────────────┘ └─────────┘ └───────────────────┘
```

La aplicación sigue el principio de **thin backend**: el servidor Express es lo más pequeño posible. Las decisiones de diseño que lo justifican:

1. El token de GitHub fluye directamente del callback de OAuth al `sessionStorage` del navegador — el servidor no lo guarda
2. Las claves de IA (Gemini/Groq) nunca tocan el servidor
3. Las llamadas a la GitHub API van directamente desde el navegador con el token del usuario

---

## 2. Backend (Express.js)

### Lo que hace

| Endpoint | Método | Descripción |
|---|---|---|
| `/auth/github` | GET | Redirige al flujo OAuth de GitHub con los scopes `repo user read:org` |
| `/auth/callback` | GET | Intercambia el `code` de OAuth por un `access_token` y redirige al frontend con el token en el hash de la URL |
| `/health` | GET | Health check requerido por Google Cloud Run |
| `/*` | GET | Sirve los archivos estáticos del build de React en producción |

### Lo que intencionalmente NO hace

- ❌ No tiene proxy de IA (no llama a Gemini ni a Groq)
- ❌ No almacena tokens de usuario ni claves de IA
- ❌ No tiene base de datos
- ❌ No valida ni procesa instrucciones del usuario

### Flujo OAuth detallado

```
Navegador           Express              GitHub OAuth
    │                   │                     │
    │── GET /auth/github ──►│                     │
    │                   │── redirect(authorize?) ──►│
    │◄────────── redirect to GitHub login ─────────│
    │── [user logs in GitHub] ─────────────────────►│
    │                   │◄── GET /auth/callback?code= ─│
    │                   │── POST /login/oauth/access_token ──►│
    │                   │◄──────── { access_token } ─────────│
    │◄── redirect(/#access_token=...) ──│
    │── stores token in sessionStorage  │
```

### Variables de entorno del servidor

| Variable | Requerida | Descripción |
|---|---|---|
| `GITHUB_CLIENT_ID` | ✅ Sí | ID de la OAuth App de GitHub |
| `GITHUB_CLIENT_SECRET` | ✅ Sí | Secret de la OAuth App de GitHub |
| `SESSION_SECRET` | ✅ Sí | Clave para firmar sesiones Express (mínimo 32 chars) |
| `FRONTEND_URL` | ✅ Sí | URL del frontend para CORS y redirecciones OAuth |
| `PORT` | ❌ No | Puerto del servidor (por defecto: 3001 en dev, 8080 en Cloud Run) |

---

## 3. Arquitectura del Frontend

### Flujo de arranque (`main.tsx`)

```
createRoot()
  └─ Root
       ├─ AuthProvider
       ├─ AIProviderContextProvider
       └─ HistoryProvider
            └─ AuthGate              ← Paso 1: ¿Tiene token GitHub?
                 └─ AIProviderGate   ← Paso 2: ¿Tiene clave de IA?
                      └─ App         ← Aplicación principal
```

### `services/github.ts`

Cliente completo para la GitHub REST API v3. Todas las llamadas incluyen los headers `Authorization: Bearer {token}`, `Accept: application/vnd.github+json` y `X-GitHub-Api-Version: 2022-11-28`.

| Función | Descripción |
|---|---|
| `getUser(token)` | Obtiene el perfil del usuario autenticado (`GET /user`) |
| `listAllRepos(token, onProgress?)` | Pagina automáticamente en bloques de 100 hasta obtener todos los repos ordenados por `updated` |
| `createRepo(token, name, desc, private)` | Crea un repo con `auto_init: true` |
| `getFileContents(token, owner, repo, path)` | Lee un archivo; el contenido viene codificado en Base64 |
| `createOrUpdateFile(token, ...)` | Crea o actualiza un archivo (requiere `sha` para actualizaciones) |
| `deleteFile(token, ...)` | Elimina un archivo (requiere `sha` del archivo actual) |
| `decodeBase64(encoded)` | Decodifica contenido Base64 preservando UTF-8 correctamente |
| `encodeBase64(text)` | Codifica texto a Base64 preservando UTF-8 |
| `fetchRepoTreeRecursive(token, owner, repo)` | Obtiene el árbol de archivos del repo y descarga el contenido de hasta 80 archivos en batches de 5 |

**Límites en `fetchRepoTreeRecursive`:**
- Máximo **80 archivos** por análisis
- Máximo **50 KB** por archivo
- Extensiones binarias excluidas: imágenes, fuentes, ejecutables, archivos comprimidos, audio/vídeo
- Prioridad de archivos: README → package.json → src/ → config files → código fuente
- Descarga en **batches de 5** para respetar los rate limits de GitHub

### `services/gemini.ts` (cliente IA unificado)

Este módulo expone la función `callAI()` que enruta hacia Gemini o Groq según el proveedor configurado en `sessionStorage`.

```typescript
// Lectura de configuración desde sessionStorage
const provider = sessionStorage.getItem('ai_provider'); // 'gemini' | 'groq'
const apiKey   = sessionStorage.getItem('ai_api_key');
const model    = sessionStorage.getItem('ai_model');

// Para Gemini: usa @google/generative-ai SDK
//   - systemInstruction pasada al constructor del modelo
//   - Historial de conversación en formato { role: 'user'|'model', parts: [{text}] }

// Para Groq: fetch directo a https://api.groq.com/openai/v1/chat/completions
//   - Formato OpenAI compatible: { role: 'system'|'user'|'assistant', content }
//   - temperature: 0.1, max_tokens: 4096
```

**Diseño del System Prompt:**
El prompt le indica a la IA que responda **siempre** con un objeto JSON estructurado que describe la acción a tomar (no que la ejecute directamente). El frontend valida este JSON, muestra el plan al usuario, y solo ejecuta si el usuario confirma. Las reglas de endpoints previenen el uso de placeholders literales como `{username}`.

**Validación de clave:** `validateProviderKey()` realiza una llamada de prueba con el mensaje `"Hi"` antes de almacenar la clave. Si recibe 401 → inválida. Si recibe 429 → cuota agotada pero clave válida (deja pasar).

### `services/actionExecutor.ts`

Ejecuta acciones que el usuario ha confirmado. Antes de llamar a la API, `resolveEndpoint()` sustituye cualquier placeholder que la IA haya dejado en el endpoint:

```
{username} → user.login
{owner}    → repoTarget.owner
{repo}     → repoTarget.repo
{branch}   → HEAD
```

**Routing de acciones:**

| Método | Patrón de endpoint | Acción |
|---|---|---|
| GET | `/user/repos` o `/users/*/repos` | Llama a `listAllRepos()` con paginación completa |
| GET | contiene `/contents/` | Llama a `getFileContents()` y decodifica Base64 |
| GET | cualquier otro | Fetch genérico al endpoint resuelto |
| POST | `/user/repos` | Llama a `createRepo()` |
| POST | cualquier otro | Fetch genérico |
| PUT | — | Verifica SHA del archivo existente y llama a `createOrUpdateFile()` |
| DELETE | — | Obtiene SHA del archivo y llama a `deleteFile()` |

**Modo multi-repo:** `executeActionMultiRepo()` itera sobre los repos seleccionados en serie (no en paralelo) para evitar sobrepasar los rate limits de GitHub, notificando el progreso con `onProgress()` en cada iteración.

---

## 4. Flujos de Autenticación

### GitHub OAuth (método principal)

1. Usuario hace clic en "Conectar con GitHub"
2. Frontend navega a `/auth/github` (Express)
3. Express redirige a `github.com/login/oauth/authorize` con los scopes `repo user read:org`
4. GitHub redirige de vuelta a `/auth/callback?code=XXX`
5. Express intercambia el `code` por un `access_token` llamando a GitHub server-side
6. Express redirige al frontend con el token en el **hash de la URL** (`#access_token=...`)
7. `AuthGate` extrae el token del hash, limpia la URL, y llama a `setTokenFromOAuth()`
8. `fetchUser()` valida el token con `GET /user` y lo guarda en `sessionStorage`

### GitHub PAT (método alternativo)

1. Usuario pega su Personal Access Token en el input
2. `loginWithPat()` llama directamente a `fetchUser()` con el PAT
3. `fetchUser()` valida contra `GET /user` de la API de GitHub
4. Si es válido: se guarda en `sessionStorage['gh_token']`

### Conexión de proveedor de IA

1. Tras autenticarse con GitHub, se muestra `AIProviderPanel`
2. Usuario selecciona proveedor (Gemini o Groq), modelo, y pega su clave
3. Al pulsar "Conectar", `validateProviderKey()` realiza una llamada real de prueba
4. Si válida: `connect()` guarda en `sessionStorage`: `ai_provider`, `ai_api_key`, `ai_model`
5. `AIProviderGate` detecta `isConnected = true` y renderiza `App`

---

## 5. Componentes Clave

### `ConfirmModal`

Modal de confirmación que se muestra antes de cualquier operación de escritura. Muestra:
- Tipo de acción (lectura/escritura/creación)
- Descripción en lenguaje natural generada por la IA
- Endpoint y método HTTP que se va a usar
- `DiffViewer` si la acción modifica un archivo existente
- Botones Cancelar / Ejecutar

### `DiffViewer`

Usa la biblioteca `diff` para calcular el diff entre el contenido actual y el propuesto, y `diff2html` para renderizar el resultado como HTML lado a lado. Los colores se sobrescriben con las variables CSS del design system (fondo verde `#1a3a1a` para añadidos, `#3a1a1a` para eliminados).

### `TemplatePanel`

Panel lateral con plantillas predefinidas organizadas por categorías (README, .gitignore, Licencias, CI/CD). Al seleccionar una plantilla, el texto se copia directamente al textarea del chat.

### `RepoSelector` (dentro de `ChatInput`)

Permite buscar y seleccionar múltiples repositorios del usuario para operaciones multi-repo. Usa paginación local sobre la lista cacheada de repos del usuario. Al activar el modo multi-repo, las acciones confirmadas se aplican a todos los repos seleccionados en serie.

### `HistoryPanel`

Muestra el historial de acciones de la sesión actual con estados (✅ completado, ❌ error, ⏸️ cancelado, ⏳ pendiente). El botón "Exportar" genera un archivo `.txt` con timestamp para descarga directa usando `URL.createObjectURL()`.

---

## 6. Modo "Documenta mi Repositorio"

Flujo completo del modo de documentación automática:

```
1. Usuario introduce el nombre del repo en ChatInput
2. handleDocumentRepo() llama a fetchRepoTreeRecursive()
   → Git Trees API para listado eficiente del árbol
   → Filtra binarios y archivos > 50KB
   → Ordena por prioridad (README primero, src/ segundo)
   → Descarga hasta 80 archivos en batches de 5
3. Se construye un prompt con el contenido de todos los archivos
4. callAI() envía el prompt al proveedor configurado
   → System prompt pide JSON: { readme, manualTecnico }
5. DocModal muestra una preview con tabs (README / MANUAL_TECNICO)
6. Usuario revisa y hace clic en "Hacer commit"
7. Para cada archivo:
   → Intenta GET /repos/.../contents/FILE para obtener SHA
   → PUT /repos/.../contents/FILE con SHA si existe
   → Commit message: "docs: generate X via Asistente de IA"
```

---

## 7. Modelo de Seguridad

| Elemento | En el servidor | En el navegador |
|---|---|---|
| `GITHUB_CLIENT_SECRET` | ✅ Solo aquí | ❌ Nunca |
| Token GitHub del usuario | ❌ Nunca almacenado | ✅ `sessionStorage` |
| Clave de IA del usuario | ❌ Nunca llega | ✅ `sessionStorage` |
| Llamadas a Gemini/Groq | ❌ No las hace | ✅ Desde el navegador |
| Llamadas a GitHub API | ❌ No las hace | ✅ Desde el navegador |

**`sessionStorage` vs `localStorage`:** Se usa `sessionStorage` deliberadamente. Los datos se eliminan al cerrar la pestaña, reduciendo la ventana de exposición si el dispositivo queda desbloqueado.

---

## 8. Despliegue

### Dockerfile (multi-stage)

```dockerfile
# Stage 1: Build del frontend
FROM node:20-alpine AS build-client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build       # → /app/client/dist

# Stage 2: Servidor de producción
FROM node:20-alpine AS server
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server/ ./server/
COPY --from=build-client /app/client/dist ./client/dist
EXPOSE 8080
CMD ["node", "server/index.js"]
```

### Comando de despliegue en Cloud Run

```bash
gcloud run deploy asistente-ia-repos \
  --source . \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars \
    GITHUB_CLIENT_ID=xxx,\
    GITHUB_CLIENT_SECRET=yyy,\
    SESSION_SECRET=zzz,\
    FRONTEND_URL=https://TU_URL.run.app
```

### Variables de entorno (referencia completa)

| Variable | Servidor | Descripción |
|---|---|---|
| `GITHUB_CLIENT_ID` | ✅ Requerida | Client ID de la OAuth App |
| `GITHUB_CLIENT_SECRET` | ✅ Requerida | Client Secret de la OAuth App |
| `SESSION_SECRET` | ✅ Requerida | Secreto para sesiones (≥32 chars) |
| `FRONTEND_URL` | ✅ Requerida | URL base del frontend (CORS + redirect) |
| `PORT` | Opcional | Puerto (default: 3001 dev / 8080 Cloud Run) |
| `GEMINI_API_KEY` | ❌ Eliminada | Ya no se usa — el usuario trae su propia clave |

---

## 9. Limitaciones Conocidas

| Limitación | Impacto | Solución futura sugerida |
|---|---|---|
| Historial no persistente | Se pierde al recargar la página | Añadir IndexedDB o backend con SQLite |
| Sin contexto entre sesiones | La IA no recuerda repos previos | Inyectar lista de repos en el system prompt |
| Rate limits de GitHub API | 5000 req/h con OAuth | Implementar caché con React Query |
| Análisis limitado a 80 archivos | Repos grandes quedan truncados | Usar la Search API de GitHub o embeddings |
| Sin soporte de branches | Siempre opera en `main`/`HEAD` | Añadir selector de branch al ChatInput |
| Multi-repo en serie | Lento para muchos repos | Paralelizar con límite de concurrencia |
| Sin tests automatizados | Regresiones posibles | Añadir Vitest + Testing Library |

---

<p align="center">
  Desarrollado con ❤️ por <a href="https://github.com/migueljerico">@migueljerico</a> · 2026
</p>
