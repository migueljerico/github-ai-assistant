# 📖 Manual Técnico — Asistente de IA para Publicar Repositorios

**Versión:** v2.1.0 · Junio 2026

---

## 🏗️ Arquitectura General

La aplicación sigue una arquitectura de **backend thin** deliberada: el servidor Express existe para gestionar el flujo OAuth de GitHub y actuar como proxy para la API de Gemini (necesario por restricciones geográficas en la UE). Las llamadas a la GitHub API y a Groq se realizan directamente desde el navegador del usuario.
┌────────────────────────────────────────────────────────────────┐
│ FRONTEND (cliente) │
│ React 18 · TypeScript · Vite · sessionStorage │
│ │
│ ┌─────────────────┐ ┌───────────────┐ ┌─────────────────┐ │
│ │ Autenticación │ │ Chat + IA │ │ UI Auxiliar │ │
│ │ AuthContext │ │ gemini.ts │ │ HistoryPanel │ │
│ │ LoginButton │ │ callAI() │ │ TemplatePanel │ │
│ │ PatInput │ │ parseAction()│ │ RepoSelector │ │
│ └────────┬────────┘ └──────┬────────┘ └─────────────────┘ │
│ │ │ │
│ ┌────────▼─────────────────▼──────────────────────────────┐ │
│ │ App.tsx — Orquestador principal │ │
│ │ handleSend → callAI → parseAction → ConfirmModal │ │
│ │ handleConfirm → executeAction → HistoryContext │ │
│ │ handleDocumentRepo → fetchRepoTreeRecursive → DocModal │ │
│ └────────────────────────────────────────────────────────┘ │
└──────────────┬────────────────────────────────────┬───────────┘
│ /auth/github · /auth/callback │ fetch()
│ /api/gemini (proxy) │
▼ ▼
┌──────────────────────────┐ ┌────────────────────────────────┐
│ Backend Express.js │ │ APIs Externas │
│ server/index.js │ │ │
│ ├── GET /health │ │ GitHub REST API v3 │
│ ├── GET /auth/github │ │ api.github.com │
│ ├── GET /auth/callback │ │ │
│ ├── POST /api/gemini │ │ Groq Cloud │
│ └── Static (prod) │ │ api.groq.com/openai/v1 │
│ │ │ │
│ Solo en memoria: │ │ Google Gemini │
│ GITHUB_CLIENT_SECRET │ │ generativelanguage.googleapis │
└──────────────────────────┘ │ (via proxy en el servidor) │
└────────────────────────────────┘


---

## 📁 Estructura del Proyecto

github-ai-assistant/
├── client/ # Aplicación React
│ └── src/
│ ├── components/
│ │ ├── ai-provider/ # Panel conexión de IA
│ │ ├── auth/ # OAuth / PAT / UserBadge
│ │ ├── chat/ # ChatArea, ChatInput, ChatMessage, DocRepoButton
│ │ ├── confirm/ # ConfirmModal
│ │ ├── layout/ # Header, HistoryPanel, AIProviderBadge
│ │ ├── multi-repo/ # RepoSelector
│ │ └── templates/ # TemplatePanel + templateData.ts
│ ├── context/
│ │ ├── AuthContext.tsx # Token GitHub, usuario, OAuth/PAT
│ │ ├── AIProviderContext.tsx # Proveedor IA activo (Groq/Gemini)
│ │ └── HistoryContext.tsx # Log de sesión + exportación
│ ├── services/
│ │ ├── github.ts # Wrapper GitHub REST API v3
│ │ ├── gemini.ts # Cliente unificado Groq + Gemini
│ │ └── actionExecutor.ts # Ejecutor de acciones confirmadas
│ └── types/index.ts # Tipos compartidos TypeScript
├── server/
│ └── index.js # Express: OAuth + proxy Gemini + health + static
├── Dockerfile # Multi-stage build (Node 20 Alpine)
├── .env.example # Plantilla de variables de entorno
└── .gitignore


---

## 🔄 Flujo de una Operación Completa

Usuario escribe en el chat
"Crea un repositorio público llamado mi-proyecto"
↓
App.tsx → handleSend()
Construye el historial de conversación
Llama a callAI(messages) → gemini.ts
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
requiereConfirmacion === true →
Se abre ConfirmModal con descripción
Usuario pulsa "✅ Confirmar y ejecutar"
↓
handleConfirm() → executeAction()
actionExecutor.ts → resolveEndpoint()
→ createRepo() en github.ts
→ POST https://api.github.com/user/repos
→ Token Bearer del usuario en el header
↓
Resultado → HistoryContext.addEntry()
Mensaje de éxito/error en el chat


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

Las claves de API se leen de sessionStorage en cada llamada y nunca pasan por el servidor (excepto la clave de Gemini que viaja en el body HTTPS hacia el proxy).
Groq vs. Gemini — diferencias de implementación
Aspecto
Groq
Gemini
SDK
fetch() directo
@google/generative-ai (via proxy)
Formato mensajes
OpenAI-compatible (system + messages)
startChat({ history }) + sendMessage()
System prompt
Mensaje con role: 'system'
systemInstruction en el modelo
Temperatura
0.1 (determinista)
Por defecto del SDK
Max tokens
4096
1024 (SDK default)
Restricciones geográficas
Ninguna
Bloqueado en UE/EEA (requiere proxy)
Proxy de Gemini
La API de Gemini bloquea las peticiones directas desde navegadores en la región europea (EEA). Para solucionar esto, el servidor Express actúa como proxy:


// Frontend → POST /api/gemini
// Body: { apiKey, model, messages, systemPrompt }
// Server → SDK de Gemini (desde us-central1, sin restricciones)
// Server → { text } → Frontend

La API key viaja en el body HTTPS y no se almacena en el servidor.
🔌 GitHub REST API v3 — github.ts
Endpoints utilizados

Función
Método
Endpoint
getUser()
GET
/user
listAllRepos()
GET
/user/repos?per_page=100&page=N
createRepo()
POST
/user/repos
getFileContents()
GET
/repos/{owner}/{repo}/contents/{path}
createOrUpdateFile()
PUT
/repos/{owner}/{repo}/contents/{path}
deleteFile()
DELETE
/repos/{owner}/{repo}/contents/{path}
fetchRepoTreeRecursive()
GET
/repos/{owner}/{repo}/git/trees/{branch}?recursive=1
Paginación automática
listAllRepos() itera páginas de 100 repos hasta recibir una respuesta con menos de 100 resultados, garantizando que los usuarios con decenas de repos los vean todos.
Modo documentación — límites y priorización

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

🔐 Autenticación — AuthContext.tsx y server/index.js
Arquitectura de Seguridad
La aplicación implementa una arquitectura de seguridad diferenciada para las dos credenciales críticas:
Token de GitHub — Memoria React (Zero-Storage):
El token de acceso de GitHub vive exclusivamente en el estado de React (memoria volátil del contexto). Nunca se escribe en ninguna API de almacenamiento del navegador (sessionStorage, localStorage, cookies, etc.).
Justificación de seguridad:
La aplicación requiere el scope repo de GitHub, que otorga acceso completo de lectura/escritura a todos los repositorios del usuario (públicos y privados).
El vector de ataque más común en aplicaciones web es XSS (Cross-Site Scripting), que permite a un atacante ejecutar JavaScript arbitrario en el contexto de la página.
Si el token estuviera en sessionStorage o localStorage, un script XSS podría leerlo con sessionStorage.getItem('gh_token') y exfiltrar las credenciales.
Al mantener el token solo en memoria de React, un script XSS no puede acceder directamente a las variables de estado de React, eliminando este vector de ataque.
Claves de IA — sessionStorage:
Las claves de API de IA (Groq/Gemini) se almacenan en sessionStorage del navegador por conveniencia, para que el usuario no tenga que reintroducirlas al recargar la página.
Trade-off aceptado:
Si el usuario recarga la página (F5), pierde la sesión de GitHub y debe reautenticarse.
Las claves de IA se mantienen al recargar la página (sessionStorage), pero desaparecen al cerrar la pestaña.
Esto es una característica de seguridad intencionada, no un bug.
Implementación técnica
AuthContext.tsx (Zero-Storage para token GitHub):

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
    });
  } catch (err) {
    setState({ token: null, user: null, isAuthenticated: false, isLoading: false, error: (err as Error).message });
  }
}, []);

AIProviderContext.tsx (sessionStorage para claves IA):

// Las claves de IA se guardan en sessionStorage
export function AIProviderProvider({ children }: { children: React.ReactNode }) {
  const [provider, setProvider] = useState<AIProviderType | null>(
    () => (sessionStorage.getItem('ai_provider') as AIProviderType) || null
  );
  const [apiKey, setApiKey] = useState<string | null>(
    () => sessionStorage.getItem('ai_api_key')
  );
  const [model, setModel] = useState<string | null>(
    () => sessionStorage.getItem('ai_model')
  );

  const connect = (p: AIProviderType, k: string, m: string) => {
    setProvider(p);
    setApiKey(k);
    setModel(m);
    sessionStorage.setItem('ai_provider', p);
    sessionStorage.setItem('ai_api_key', k);
    sessionStorage.setItem('ai_model', m);
  };

  const disconnect = () => {
    setProvider(null);
    setApiKey(null);
    setModel(null);
    sessionStorage.removeItem('ai_provider');
    sessionStorage.removeItem('ai_api_key');
    sessionStorage.removeItem('ai_model');
  };

Flujo OAuth completo

1. Frontend → window.location.href = '/auth/github'
2. Express → genera state aleatorio, lo guarda en sesión
3. Express → redirect a GitHub con client_id + scope + state
4. GitHub → muestra pantalla de autorización al usuario
5. Usuario aprueba → GitHub redirige a /auth/callback?code=XXX&state=YYY
6. Express → verifica que state coincide (previene CSRF)
7. Express → POST a github.com/login/oauth/access_token
   (CLIENT_SECRET nunca sale del servidor)
8. GitHub → devuelve access_token
9. Express → redirect al frontend con token en URL hash
10. Frontend → extrae token, llama GET /user para validar
11. Token guardado SOLO en estado de React (ZERO-STORAGE)

Fix de protocolo para Cloud Run
El servidor detecta si el host contiene run.app y fuerza el protocolo https:// en el callback URL, evitando redirecciones HTTP en producción que GitHub rechaza.
🚀 Despliegue — Dockerfile y Cloud Run
Dockerfile multi-stage

Stage 1 (builder):
  node:20-alpine → npm ci → npm run build (Vite)
  Produce: client/dist/ (archivos estáticos)

Stage 2 (production):
  node:20-alpine → npm install --omit=dev
  Copia: server/ + client/dist/
  Expone: $PORT (8080 en Cloud Run)
  CMD: node server/index.js

Variables de entorno en producción
Variable
Requerida
Descripción
GITHUB_CLIENT_ID
✅ Sí
Client ID de la GitHub OAuth App
GITHUB_CLIENT_SECRET
✅ Sí
Client Secret (nunca al frontend)
SESSION_SECRET
✅ Sí
Clave para firmar cookies de sesión
PORT
Cloud Run lo inyecta
Puerto de escucha (default: 8080)
NODE_ENV
Auto en Dockerfile
production activa cookies secure: true
⚠️ Limitaciones conocidas
Ver MEJORAS_FUTURAS.md para el detalle completo.
Limitación
Impacto
Solución planificada
Claves de IA en sessionStorage
Exposición a XSS
Zero-Storage real (#13)
Sin rate limiting en proxy Gemini
Riesgo de abuso
express-rate-limit (#14)
DocModal embebido en App.tsx
Dificulta el mantenimiento
Extraer a componente (#16)
formatResultData embebida en App.tsx
Dificulta testing
Extraer a utilidad (#17)
uid() usa Math.random()
Posibles colisiones
crypto.randomUUID() (#18)
Sin soporte PATCH en executor
Limita operaciones
Añadir case PATCH (#19)
Truncamiento por caracteres (2000)
Corta código a mitad
Truncamiento por líneas (#20)
fetch() duplicado en actionExecutor
Código repetido
Unificar con ghFetch() (#21)

