# CLAUDE.md

Guía para asistentes de IA (Claude Code y similares) que trabajen en este
repositorio. Resume la arquitectura, dónde vive cada cosa, cómo construir y
probar, y las convenciones que es fácil romper sin querer.

> **Idioma:** la UI, los comentarios del código y los mensajes de usuario están
> en **español**; los identificadores (variables, funciones, tipos) están en
> **inglés**. Mantén ese estilo bilingüe al editar.

---

## 1. Visión general

**GitHub AI Assistant** (v2.7.3) es una app web que permite operar la **GitHub
REST API en lenguaje natural** a través de un proveedor de IA (Google Gemini o
Groq Cloud). El usuario escribe una instrucción, la IA propone una acción, y
**cada operación de escritura se confirma manualmente** antes de ejecutarse.

Es un proyecto pequeño con dos partes:

- **Frontend**: SPA de React 18 + TypeScript + Vite (`client/`).
- **Backend**: un servidor Express fino de un solo archivo (`server/index.js`),
  que actúa como proxy de OAuth y de Gemini, y sirve el frontend ya construido.

No hay base de datos: el estado vive en el navegador (memoria/sessionStorage).

---

## 2. Arquitectura

### Ciclo principal (lenguaje natural → acción)

```
Usuario escribe instrucción
        │
        ▼
App.tsx  ──► detecta modo (chat | action)  ──► elige system prompt
        │
        ▼
services/gemini.ts  callAI()   (enruta según el `transport` del registro de proveedores)
        ├─ transport = 'gemini-proxy'      ──► POST /api/gemini  (proxy Express, evita bloqueo UE)
        └─ transport = 'openai-compatible' ──► fetch() directo (Groq, OpenRouter)
        │
        ▼
La IA responde con un JSON descriptivo de la acción  (parseGeminiAction)
        │
        ├─ requiereConfirmacion: false (lectura) ──► se ejecuta directo
        └─ requiereConfirmacion: true  (escritura) ──► ConfirmModal (con diff)
                                                          │ usuario confirma
                                                          ▼
                                          services/actionExecutor.ts
                                          executeAction() / executeActionMultiRepo()
                                                          ▼
                                                services/github.ts  ──► GitHub REST API
```

**Garantía de seguridad central:** `actionExecutor` **nunca** ejecuta una
escritura por su cuenta. El flujo siempre es *la IA propone → el usuario
confirma → el executor ejecuta*. No lo rompas.

### Por qué el proxy de Gemini

La API de Gemini bloquea peticiones directas desde el navegador en la UE/EEA.
Por eso las llamadas a Gemini pasan por `POST /api/gemini` en el servidor
(desplegado en us-central1). **Groq no se proxia** — va directo desde el
navegador. La API key del usuario viaja en el cuerpo de la petición y **nunca**
se guarda ni se loguea en el servidor.

### Modo dual ("Opción D")

`App.tsx` decide entre dos modos con heurísticas (`isConversationRequest` /
`isActionRequest`), o con un override manual (`modeOverride`):

- **chat** → usa `CHAT_PROMPT`: responde en Markdown como consultor, nunca
  genera JSON ni ejecuta acciones.
- **action** → usa `ACTION_PROMPT` (alias de `SYSTEM_PROMPT`): responde solo con
  el JSON de la acción.

---

## 3. Estructura del repositorio

```
.
├── server/
│   ├── index.js              # Backend Express completo (OAuth, proxy Gemini, static SPA)
│   └── __tests__/rateLimit.test.js
├── client/
│   ├── src/
│   │   ├── App.tsx           # Orquestador: estado de chat, detección de modo, modales
│   │   ├── main.tsx          # Punto de entrada React
│   │   ├── services/
│   │   │   ├── providers.ts      # Registro de proveedores de IA (Gemini/Groq/OpenRouter)
│   │   │   │                     #   + fetchModels() (catálogo dinámico, etiqueta 🆓)
│   │   │   ├── gemini.ts         # Cliente IA multi-proveedor (callAI, callOpenAICompatible,
│   │   │   │                     #   parseGeminiAction, generateRepoDocs) + system prompts
│   │   │   ├── github.ts         # Wrappers tipados de la GitHub REST API (ghFetch, ...)
│   │   │   ├── docPublisher.ts   # Publica docs: commit directo o Draft PR (#45)
│   │   │   └── actionExecutor.ts # Ejecuta acciones CONFIRMADAS; resuelve placeholders
│   │   ├── context/
│   │   │   ├── AuthContext.tsx        # Token de GitHub (sessionStorage)
│   │   │   ├── AIProviderContext.tsx  # Proveedor/apiKey/model — Zero-Storage (solo memoria)
│   │   │   └── HistoryContext.tsx     # Log de acciones de la sesión
│   │   ├── hooks/            # useChat, useActions
│   │   ├── utils/            # formatResult, pdfReader/pdfAdvanced, releaseGenerator/
│   │   │                     #   releaseAssets, instructionSuggestions, rateLimitHandler,
│   │   │                     #   modeDetection (chat vs action), modelLabels
│   │   ├── components/       # Agrupados por feature:
│   │   │                     #   auth/ ai-provider/ chat/ confirm/ layout/
│   │   │                     #   multi-repo/ templates/
│   │   └── types/index.ts    # Tipos TypeScript compartidos
│   ├── vite.config.ts        # Dev server :5173, proxy /auth → :3001
│   ├── vitest.config.ts      # jsdom + cobertura v8
│   └── package.json
├── package.json              # Scripts raíz + dependencias del servidor (ESM, Node ≥20)
├── Dockerfile                # Build multi-stage → Cloud Run
├── .github/workflows/ci.yml  # CI: tests de client/ + Codecov
└── .env.example
```

Documentos de referencia (en español): `README.md`, `MANUAL_TECNICO.md`,
`CONTRIBUTING.md`, `CHANGELOG.md`, `MEJORAS_FUTURAS.md` (roadmap).

---

## 4. Comandos

Desde la **raíz** del proyecto:

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta servidor + cliente a la vez (`concurrently`) |
| `npm run dev:server` | Solo Express con `--watch` (puerto 3001) |
| `npm run dev:client` | Solo Vite (puerto 5173) |
| `npm start` | Producción: `node --env-file=.env server/index.js` |
| `npm run build` | Construye el cliente (`client/dist`) |

Dentro de **`client/`** (`cd client`):

| Comando | Qué hace |
|---|---|
| `npm run dev` | Dev server de Vite |
| `npm run build` | `tsc -b && vite build` |
| `npm run lint` | ESLint sobre todo el cliente |
| `npm run test` | Vitest en modo watch |
| `npm run test:run` | Vitest una sola pasada (úsalo antes de commitear) |
| `npm run test:coverage` | Vitest con cobertura (genera `client/coverage/`) |

Ejecutar **un solo test**: `cd client && npm run test:run -- src/services/github.test.ts`
(o `-- -t "nombre del test"` para filtrar por nombre).

---

## 5. Convenciones y trampas

- **Zero-Storage (seguridad crítica):** las API keys de IA viven **solo** en
  estado de React (`AIProviderContext`), **nunca** en `localStorage` ni
  `sessionStorage`. Recargar la página obliga a re-introducir la key — es
  intencionado (mitiga XSS). El token de GitHub sí va en `sessionStorage` (llega
  por el hash de la URL tras el OAuth). **No introduzcas credenciales en
  almacenamiento del navegador** — CONTRIBUTING rechaza PRs que lo hagan.
- **Proponer → confirmar → ejecutar:** ver §2. Las escrituras pasan siempre por
  `ConfirmModal`.
- **Resolución de placeholders:** la IA a veces emite endpoints con
  `{owner}`/`{repo}`/`{username}`; `resolveEndpoint()` en `actionExecutor.ts` los
  sustituye antes de llamar a la API. Mantén esa red de seguridad.
- **TypeScript estricto:** `strict: true`, sin `any` implícitos.
- **React:** componentes funcionales con hooks; el estado global va **solo** vía
  Context API.
- **ESM en todo el proyecto** (`"type": "module"`), Node ≥20.
- **Conventional Commits:** `feat:`, `fix:`, `docs:`, `test:`, `refactor:`.
- **Estilo bilingüe:** prosa/UI en español, identificadores en inglés.

---

## 6. Entorno

Copia `.env.example` a `.env` y rellena (ver detalle en ese archivo):

| Variable | Para qué |
|---|---|
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | OAuth App de GitHub |
| `SESSION_SECRET` | Firma de sesión (obligatoria en producción; el server aborta si falta) |
| `FRONTEND_URL` | CORS + redirección OAuth en desarrollo |
| `PORT` | Opcional (3001 en dev, 8080 en prod) |

**No se configura ninguna API key de IA aquí**: cada usuario conecta su propia
clave de Gemini o Groq desde el navegador en tiempo de ejecución.

---

## 7. Testing

- Stack: **Vitest** + **jsdom** + **@testing-library/react**; setup en
  `client/src/test/setup.ts`, configuración en `client/vitest.config.ts`
  (`globals: true`, cobertura v8 → `client/coverage/`).
- Ubicación de tests: co-locados como `*.test.ts(x)` junto al código, o en
  carpetas `__tests__/`.
- El **CI** (`.github/workflows/ci.yml`) corre en push/PR a `main`, **solo los
  tests de `client/`** (Node 24, `npm install` + `npm run test:coverage`) y sube
  cobertura a Codecov. Hay un test del servidor
  (`server/__tests__/rateLimit.test.js`) que el CI no ejecuta.

---

## 8. Despliegue

`Dockerfile` multi-stage → **Google Cloud Run** (us-central1):

1. Stage 1 construye el frontend (`client/dist`).
2. Stage 2 levanta Express sirviendo esa SPA + el proxy.

En producción: `NODE_ENV=production`, `PORT=8080`, `HEALTHCHECK` sobre
`/health`. El catch-all sirve `index.html` para el routing de la SPA (devuelve
404 para `/api/*` y `/auth/*`).

---

## 9. Referencias

Para más detalle, consulta:

- `README.md` — visión de producto, arquitectura ampliada, modelo de seguridad.
- `MANUAL_TECNICO.md` — documentación técnica detallada.
- `CONTRIBUTING.md` — estándares de código, flujo de PRs, testing.
- `MEJORAS_FUTURAS.md` — roadmap e issues priorizados.
- `CHANGELOG.md` — historial de versiones.
