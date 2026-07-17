# CLAUDE.md

Guía para asistentes de IA (Claude Code y similares) que trabajen en este
repositorio. Resume la arquitectura, dónde vive cada cosa, cómo construir y
probar, y las convenciones que es fácil romper sin querer.

> **Idioma:** la UI, los comentarios del código y los mensajes de usuario están
> en **español**; los identificadores (variables, funciones, tipos) están en
> **inglés**. Mantén ese estilo bilingüe al editar.
>
> **Al dirigirte al usuario en el chat de la sesión, hazlo SIEMPRE en castellano**
> (el autor lo pidió expresamente; evita mezclar inglés en tus respuestas).

---

## 0. Lectura inicial obligatoria (arranque de cada sesión)

**Antes de tocar nada**, lee en este orden:

1. **Este archivo (`CLAUDE.md`)** — cómo está hecho el código, convenciones,
   trampas y la rutina de cierre (§5).
2. **`METODOLOGIA_IA.md`** — cómo se colabora humano↔IA, qué asistente hizo qué
   y las lecciones registradas.

Es **obligatorio** para no repetir errores ya documentados ni romper
convenciones asentadas. Si el usuario pasa un handoff de una sesión anterior,
ese handoff referencia estos dos documentos; úsalos como contexto, no los
reemplazan. Saltarse este paso es la causa nº1 de trabajar en bucle.

---

## 1. Visión general

**GitHub AI Assistant** (v3.42.0) es una app web que permite operar la **GitHub
REST API en lenguaje natural** a través de un proveedor de IA (Google Gemini,
Groq Cloud, OpenRouter, NVIDIA NIM, Zenmux, OpenCode Zen, Cloudflare Workers AI,
Ollama Cloud o Ai&). El usuario escribe una instrucción,
la IA propone una acción, y
**cada operación de escritura se confirma manualmente** antes de ejecutarse.

Es un proyecto pequeño con dos partes:

- **Frontend**: SPA de React 18 + TypeScript + Vite (`client/`).
- **Backend**: un servidor Express fino de un solo archivo (`server/index.js`),
  que actúa como proxy de OAuth y de Gemini, y sirve el frontend ya construido.

No hay base de datos: el estado vive en el navegador (memoria/sessionStorage).

### Principio de producto — UX para usuarios NO técnicos (rector)

El público objetivo son **personas sin experiencia en programación ni en GitHub**
(el propio autor empezó hace ~1 mes). La promesa es interactuar con los repos **en
lenguaje natural**, sin saber de endpoints, payloads, Base64, números de issue/PR ni
URLs. Por eso, **toda** función nueva o modificada debe cumplir:

- **Acepta lenguaje natural y formatos variados:** nunca exijas una sintaxis exacta;
  admite frases, sinónimos y referencias parciales (nombre de repo, URL pegada, "el
  último issue", etc.).
- **Nunca dejes un callejón sin salida:** si falta un dato (p. ej. *qué* issue/PR
  resumir), **guía** al usuario — ofrece una lista para elegir o pregunta en lenguaje
  llano — en lugar de devolver un error de formato.
- **No presupongas conocimiento de GitHub** (números de issue, URLs, ramas, Base64…):
  dedúcelo del contexto o pídelo con naturalidad.
- **Errores en lenguaje claro**, orientados a la siguiente acción y sin jerga.
- **Mantén la garantía** *propón→confirmar→ejecutar* y Zero-Storage al hacerlo.

> **Ejemplo ya aplicado (#32):** "Resumir hilo" solo aceptaba `owner/repo#N`;
> ahora acepta una URL de GitHub o el repo, y si das **solo el repo** lista los
> issues/PRs abiertos para que elijas. Úsalo como patrón de referencia.

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

> **Dónde vive la orquestación (#42, v2.8.2):** desde `App.tsx` los handlers son
> *wrappers finos* que delegan en **`services/assistantActions.ts`** —`runSend`
> (loop chat/acción), `runConfirmAction`, `runCancelAction` y los flujos de botón
> (documentar, resumir, contexto)— con sus dependencias (estado de React) inyectadas.
> `App.tsx` solo cablea estado + JSX. Esa lógica está testeada de forma aislada.

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

- **chat** → usa `CHAT_PROMPT`: responde en Markdown, nunca genera JSON ni ejecuta
  acciones. **Tono (v3.5.0, rector):** habla al usuario en lenguaje **natural y
  accesible**, adaptado a su nivel (no como "senior/arquitecto"). El registro
  profesional se reserva para el **documento** generado (`generateFileDoc`), no para
  el chat.
- **action** → usa `ACTION_PROMPT` (alias de `SYSTEM_PROMPT`): responde solo con
  el JSON de la acción.

> **Documentar/publicar es EXPLÍCITO (#28, v3.7.0):** con un archivo adjunto el chat
> **siempre conversa/analiza** (`resolveMode` fuerza chat). Documentar/publicar se hace
> con el botón **📤 "Documentar y publicar"** → `FilePublishModal` (commit / Draft PR /
> Release + subir el archivo), que incorpora la conversación como contexto. Se eliminó
> la antigua detección de intención por palabras clave (`intentDetection.ts`): era frágil
> y causó bugs repetidos. **No la reintroduzcas** — ver la convención de §5.

---

## 3. Estructura del repositorio

```
.
├── server/
│   ├── index.js              # Backend Express completo (OAuth, proxy Gemini, static SPA)
│   └── __tests__/rateLimit.test.js
├── client/
│   ├── src/
│   │   ├── App.tsx           # Componente raíz: estado + JSX + wrappers finos (la lógica
│   │   │                     #   del chat vive en services/assistantActions.ts — #42)
│   │   ├── main.tsx          # Punto de entrada React
│   │   ├── services/
│   │   │   ├── providers.ts      # Registro de proveedores de IA (Gemini/Groq/OpenRouter)
│   │   │   │                     #   + fetchModels() (catálogo dinámico, etiqueta 🆓)
│   │   │   ├── gemini.ts         # Cliente IA multi-proveedor (callAI, callOpenAICompatible,
│   │   │   │                     #   parseGeminiAction, generateRepoDocs, generateFileDoc #28).
│   │   │   │                     #   Los system prompts (acción/chat) viven en src/prompts/*.md (#23, ?raw)
│   │   │   ├── github.ts         # Wrappers tipados de la GitHub REST API (ghFetch, ...)
│   │   │   ├── assistantActions.ts # Orquestación del chat extraída de App.tsx (#42):
│   │   │   │                     #   runSend/runConfirmAction/runCancelAction + flujos de botón
│   │   │   │                     #   (incl. documentar+publicar archivo #28 Fase 2)
│   │   │   ├── docPublisher.ts   # Publica docs: commit directo o Draft PR (#45);
│   │   │   │                     #   publishFileDoc de fichero suelto (#28 Fase 2)
│   │   │   ├── threadSummary.ts  # Resume hilos de issues/PRs vía LLM (#32)
│   │   │   └── actionExecutor.ts # Ejecuta acciones CONFIRMADAS; resuelve placeholders
│   │   ├── context/
│   │   │   ├── AuthContext.tsx        # Token de GitHub (sessionStorage)
│   │   │   ├── AIProviderContext.tsx  # Proveedor/apiKey/model — Zero-Storage (solo memoria)
│   │   │   ├── LanguageContext.tsx    # i18n ligero (#24): idioma + t() con interpolación; sessionStorage (no secreto)
│   │   │   └── HistoryContext.tsx     # Log de acciones de la sesión
│   │   ├── i18n/              # Diccionarios ES/EN (#24); t() con fallback ES→EN→key
│   │   │                     #   useLanguage() es un HOOK: solo usable en componentes React (ver §5)
│   │   ├── hooks/            # useChat, useActions,
│   │   │                     #   useModalDialog (#39: a11y de modales — Esc, focus-trap, foco restaurado)
│   │   ├── utils/            # formatResult, repoRef (resolveRepoRef), pdfReader/pdfAdvanced,
│   │   │                     #   spreadsheetReader (Excel/CSV vía SheetJS #28 Fase 3a),
│   │   │                     #   powerbiReader (.pbix/.pbit vía fflate: informe + modelo/DAX + Power Query/M del DataMashup #28 Fase 3b/3b-bis),
│   │   │                     #   docxReader (Word .docx vía fflate: texto de word/document.xml #28),
│   │   │                     #   releaseGenerator/releaseAssets, instructionSuggestions,
│   │   │                     #   contextRanker (#49: elige los archivos relevantes a la pregunta, BM25),
│   │   │                     #   codeHealth (#44: métricas puras del dashboard — lenguajes/deuda/commits),
│   │   │                     #   conversationIO (#46: exportar/importar la conversación a JSON, Zero-Storage),
│   │   │                     #   providerPrefs (#40: recuerda proveedor/modelo, no la key),
│   │   │                     #   retry (#40: withTransientRetry/isTransientError/isAbortError, compartido IA+GitHub),
│   │   │                     #   rateLimitHandler, modeDetection (chat vs action), modelLabels
│   │   ├── components/       # Agrupados por feature:
│   │   │                     #   ErrorBoundary (#39: red de seguridad de UI ante errores de render)
│   │   │                     #   auth/ ai-provider/ chat/ confirm/ dashboard/ layout/
│   │   │                     #   dashboard/: CodeHealthModal + CodeHealthCharts (Recharts lazy,
│   │   │                     #     chunk propio) — panel "Salud del código" #44
│   │   │                     #   multi-repo/ templates/
│   │   │                     #   confirm/: ConfirmModal, DocModal (repo), FilePublishModal
│   │   │                     #   (archivo) y PublishActions (barra commit/Draft PR/Release
│   │   │                     #   compartida por ambos flujos de documentación, v3.10.0)
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
`CONTRIBUTING.md`, `CHANGELOG.md`, `MEJORAS_FUTURAS.md` (roadmap) y
`METODOLOGIA_IA.md` (cómo se colabora humano↔IA; flujo, lecciones y trazabilidad).

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

- **Zero-Storage (seguridad crítica):** las API keys de IA **y** el token de
  GitHub viven **solo** en estado de React (`AIProviderContext`, `AuthContext`),
  **nunca** en `localStorage`, `sessionStorage`, cookies ni ninguna otra storage
  del navegador. Recargar la página (F5) pierde la sesión y obliga a re-autenticarse
  y re-introducir la key — es **intencionado** (mitiga robo vía XSS). El token llega
  por el **hash** de la URL tras el OAuth y se extrae inmediatamente a memoria (no se
  persistite). Ver `AuthContext.tsx` (cabecera "ZERO-STORAGE ARCHITECTURE") y
  `docs/SEGURIDAD.md`. **No introduzcas credenciales en almacenamiento del
  navegador** — CONTRIBUTING rechaza PRs que lo hacen.
- **Proxies de proveedores de IA — patrón cliente por defecto (rector):** los
  proveedores OpenAI-compatible se llaman **directo desde el navegador** con la
  key del usuario en memoria (Zero-Storage), vía `callOpenAICompatible`. Es el
  caso de **Groq, OpenRouter y Zenmux** (estos tres sí envían cabeceras CORS).
  El resto de OpenAI-compatible **no envían CORS** y el navegador bloquea la
  llamada con "Failed to fetch", por lo que requieren **proxy backend**:
  `/api/nim` (NVIDIA NIM), `/api/openzen` (OpenCode Zen), `/api/cloudflare`
  (Cloudflare Workers AI), `/api/ollama` (Ollama Cloud) y `/api/aiand` (Ai&).
  La única excepción verdaderamente "por bloqueo geográfico" sigue siendo
  `POST /api/gemini` (Gemini bloquea EEA desde el navegador).
  ⚠️ Lección v3.38.1: Ai& se añadió en v3.38.0 como "directo" asumiendo que no
  necesitaba proxy (afirmación de un asistente previo, no del autor); en prod daba
  `Failed to fetch`. **Ante la duda sobre CORS de un nuevo proveedor, ponlo detrás
  de proxy desde el principio.**
  ⚠️ Lección v3.39.0 (#65): el servidor ahora emite **logs estructurados** (JSON
  línea, ver `server/logger.js`) en vez de `console.*` de texto plano. Cada proxy
  loguea `log.info('upstream', {provider, flow, status, requestId})` y los errores
  `log.error('proxy_error', {...})`. **Zero-Storage sigue: nunca loguear bodies,
  headers Authorization ni API keys** — solo metadatos. El `requestId` se inyecta
  vía `requestIdMiddleware` y se devuelve en `X-Request-Id`.
  La key viaja en HTTPS (cliente→backend) y nunca se persistite ni loguea.
  ⚠️ Lección v3.40.0 (#25-parte2): `GET /health` ahora devuelve diagnóstico
  (`version`, `uptime`, `timestamp`, `nodeVersion`, `env`). El bloque `env`
  reporta **booleanos** por variable crítica (¿está presente?), **nunca el
  valor** — Zero-Storage sin cambios. Sigue devolviendo `status:'ok'` + **HTTP
  200 siempre** (la sonda de Cloud Run reinicia el contenedor si responde 5xx).
  La versión se lee de `package.json` vía `createRequire` (single source of
  truth); **no hardcodear la versión** en `index.js` al bumpar.
  ⚠️ Lección v3.41.0 (#25-parte3, completo): `deploy.sh` valida las **3 vars
  críticas** antes de `gcloud run deploy` (aborta `exit 1` si falta alguna).
  **No sustituye al CD automático** (Cloud Build trigger en push a `main`): es
  para deploys puntuales/rollbacks. **No gestiona secretos** (las vars viven en
  el servicio de Cloud Run; el script no usa `--set-env-vars`). Lee `.env` si
  existe (vars del shell ya exportadas tienen prioridad). Lánzalo con
  `./deploy.sh` o `npm run deploy`.
  ⚠️ Lección v3.42.0 (#52): el **Modo Auditoría de Seguridad** es un **runner
  especializado** (`runSecurityAudit`, molde de `runSummarizeThread`), NO un
  flag en `runSend`/`SendParams`. Es **lectura-only** (modo `'chat'` forzado, sin
  JSON de acción ni `ConfirmModal`) y reutiliza `callAI` + streaming + abort.
  Carga **archivos sensibles por path conocido** (package.json, lockfile,
  Dockerfile, workflows, etc.) porque `package-lock.json` queda fuera del árbol
  general (filtro `.lock` + 50KB) y los workflows pueden caer del cap de 120;
  los 404 se tragan. Prompt dedicado en `prompts/security-audit.md` (patrón #23,
  `?raw`). **Es orientativo**: el prompt prohíbe afirmar CVEs no verificables y
  el disclaimer "no sustituye a gitleaks/Dependabot/CodeQL" va en la UI.
  **No añadas proxies backend ni `process.env.*API_KEY` para nuevos proveedores
  sin aprobación explícita del autor.** Para añadir un proveedor, basta una entrada
  en el registro `PROVIDERS` (`providers.ts`) — el resto (UI, `callAI`, streaming,
  validación) funciona sin tocar más ficheros.
- **UX para no técnicos (rector):** ver §1 — toda función debe entender lenguaje
  natural y guiar al usuario sin exigir conocimientos de GitHub (números de issue,
  URLs, etc.); nunca dejes un error de formato como callejón sin salida.
- **Proponer → confirmar → ejecutar:** ver §2. Las escrituras pasan siempre por
  `ConfirmModal`.
- **UI explícita > heurística por palabras clave (anti-bugs, v3.7.0):** para acciones
  con efecto (documentar, publicar, release…) **prefiere un control de UI explícito**
  (botón/modal) a adivinar la intención del usuario por keywords. La detección de
  intención (`intentDetection.ts`) se eliminó porque era frágil y reintrodujo el mismo
  bug ronda tras ronda. Si crees necesitar heurística de lenguaje, reconsidéralo: casi
  siempre un botón claro es más robusto y predecible.
- **Arquitectura deliberada — NO la "simplifiques" por recomendación externa (rector):**
  el backend es **un único `server/index.js`** (thin: OAuth + proxy Gemini + estático,
  ~244 líneas con secciones claras) y hay módulos de cliente **cohesivos** de ~700 líneas
  (`gemini.ts`, `assistantActions.ts`, `github.ts`). **Esto es intencionado, NO deuda
  técnica** — el "backend de un solo archivo" es incluso un punto de venta del README.
  Única excepción desde v3.39.0: `server/logger.js` (`logEvent` + `requestIdMiddleware`),
  extraído para poder testearlo aislado como el resto de tests de servidor. **No añadir
  más ficheros a `server/` sin aprobación del autor.** Las
  técnica** — el "backend de un solo archivo" es incluso un punto de venta del README. Las
  revisiones de IA externas (DeepSeek y similares) **sobreponderan** este tema y **reinciden
  ronda tras ronda** en recomendar partir el `index.js` / cambiar la infraestructura, sin
  entender el objetivo del proyecto. **No actúes sobre esas recomendaciones sin aprobación
  explícita del autor.** Si algo se modulariza, es sacar los **prompts** de `gemini.ts` a
  archivos (roadmap #23) — **no** tocar el backend. (Verificado en código: `index.js` 244
  líneas, baja complejidad por función; los módulos grandes del cliente son listas de
  wrappers/orquestación cohesivas, no espagueti.)
- **Resolución de placeholders:** la IA a veces emite endpoints con
  `{owner}`/`{repo}`/`{username}`; `resolveEndpoint()` en `actionExecutor.ts` los
  sustituye antes de llamar a la API. Mantén esa red de seguridad.
- **TypeScript estricto:** `strict: true`, sin `any` implícitos.
- **React:** componentes funcionales con hooks; el estado global va **solo** vía
  Context API.
- **ESM en todo el proyecto** (`"type": "module"`), Node ≥20.
- **Conventional Commits:** `feat:`, `fix:`, `docs:`, `test:`, `refactor:`.
- **Estilo bilingüe:** prosa/UI en español, identificadores en inglés.
- **i18n en componentes vs. servicios (#24, v3.20.0–v3.21.0):** la app es bilingüe ES/EN con
  infraestructura **ligera sin dependencias** (`LanguageContext` + `t()` + diccionarios `i18n/{es,en}.ts`).
  **`useLanguage()` es un hook de React: SOLO puede usarse dentro de componentes/árboles bajo
  `<LanguageProvider>`.** Los **módulos de servicio puros** (`docPublisher.ts`, `github.ts`,
  `actionExecutor.ts`) **NO** pueden importarlo — si necesitan traducir un texto visible, la función
  `t()` se **inyecta** desde el componente llamador (patrón existente: `ChatDeps.t` en
  `assistantActions.ts`, v3.21.0). **Lección (rama descartada):** añadir claves `t()` al diccionario
  sin cablearlas a un consumidor real = código muerto; antes de añadir claves, verifica que el
  consumidor pueda importar `t()`. Los mensajes que **no** son UI (commit messages/PR bodies hacia
  GitHub, log interno del historial, contexto que va al LLM) se dejan en español a propósito.
- **Proveedores de IA — registro central (#15):** todos los proveedores viven en
  `services/providers.ts` como entradas del registro `PROVIDERS`. Añadir uno nuevo = una
  entrada más, sin tocar más ficheros. Los 10 proveedores actuales y su transporte:
  - `transport: 'openai-compatible'` con `chatEndpoint` absoluto (fetch **directo**
    desde navegador, sí envían CORS): **Groq Cloud, OpenRouter, Zenmux**.
  - `transport: 'openai-compatible'` con `chatEndpoint` relativo (proxy backend,
    no envían CORS): NVIDIA NIM (`/api/nim`), OpenCode Zen (`/api/openzen`),
    Cloudflare Workers AI (`/api/cloudflare`), Ollama Cloud (`/api/ollama`),
    Ai& (`/api/aiand`).
  - `transport: 'gemini-proxy'` (proxy backend, bloqueo EEA): Google Gemini (`/api/gemini`).
  Ver `server/index.js` para los endpoints proxy: `/api/gemini`, `/api/nim`,
  `/api/openzen`, `/api/cloudflare`, `/api/ollama`, `/api/aiand`.
- **⚠️ No crear archivos de handoff / notas de sesión en el repo.** El handoff se entrega
  como mensaje en el chat (formato `METODOLOGIA_IA.md §2.7`). No se crean ni se dejan
  archivos `HANDOFF_*.md`, `SESSION_*.md` ni notas personales de sesión en el repo a
  menos que el usuario lo pida explícitamente. Caso real (v3.34.1): un asistente creó
  `HANDOFF_2026-07-13.md` sin que se lo pidieran; se borró y se registra aquí para no
  repetirlo.
- **Versión de Node del Dockerfile = la de CI/local (o rompe el deploy):** el build
  de Cloud Run corre dentro del `Dockerfile` con `node:22-alpine`. Debe **satisfacer
  el `engines` de todas las dependencias**. Caso real (v3.0.0–v3.1.1 no desplegaban):
  `pdfjs-dist@6` pide Node `>=22.13.0 || >=24`; con `node:20` npm **omitía pdfjs-dist
  en silencio** (es `optionalDependency`, no da error en `npm ci`) y luego `tsc`
  fallaba con *"Cannot find module 'pdfjs-dist'"*. **No se detecta en local ni en CI**
  porque ambos usan Node ≥22 (CI: 24). Al añadir una dependencia con `engines` altos,
  revisa que el `FROM node:` del Dockerfile lo cumpla; señal de alarma: `npm ci` en el
  builder instala **un paquete menos** que en local (la opcional omitida).
- **Lockfiles sincronizados:** al tocar dependencias, regenera el lockfile con
  `npm install` (nunca lo edites a mano); el `Dockerfile` usa `npm ci`, que **aborta**
  si `client/package-lock.json` no cuadra con su `package.json`. Valida con
  `cd client && rm -rf node_modules && npm ci` antes de pushear deps o un bump.
- **⚠️ No hardcodear `PORT=8080` en el Dockerfile (trampa recurrente).** Cloud Run
  asigna un puerto dinámico mediante la variable de entorno `PORT`. Si el Dockerfile
  establece `ENV PORT=8080`, sobrescribe el valor dinámico y el health check falla con
  `HealthCheckContainerError` ("failed to start and listen on the port defined provided
  by the PORT=8080 environment variable"). Caso real: v3.33.4 y v3.33.5 se rompieron
  por esto. El servidor Express ya lee `process.env.PORT` correctamente; **no lo
  sobrescribas en el Dockerfile**. Eliminada línea `ENV PORT=8080`.
- **⚠️ No usar sintaxis TypeScript en archivos JavaScript puros (trampa recurrente).**
  `server/index.js` es JS puro (no se transpila con TypeScript). Usar type assertions
  como `as string | undefined` causa `SyntaxError: Unexpected identifier 'as'` al
  arrancar, y el contenedor se cierra inmediatamente → `HealthCheckContainerError`
  en Cloud Run. Caso real: v3.33.5 se rompió por `req.headers['x-account-id'] as
  string | undefined`. En JS puro, usa comprobaciones normales: `if (!headerValue)`
  o `const val = headerValue || ''`.
- **⚠️ Headers de upstream con caracteres no ISO-8859-1 (Cloudflare).** Algunos
  proveedores devuelven cabeceras con emojis o caracteres especiales (p. ej.
  `Server: cloudflare`, `CF-Ray` con emojis). El navegador no puede parsear esos
  headers y lanza: `Failed to read the 'headers' property from 'RequestInit':
  String contains non ISO-8859-1 code point`. Solución: en los proxies backend,
  **sanea los headers del upstream antes de reenviarlos** al cliente. Filtra valores
  que no sean ASCII puro (`/^[\x00-\x7F]*$/`). Aplicado en `/api/cloudflare` v3.33.7.

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
- **Codecov (`codecov.yml`):** `App.tsx` y `main.tsx` están **excluidos** de cobertura
  (glue/entry sin lógica). Mantén la lógica en `services/`/`utils/` testeados; si metes
  lógica en `App.tsx` no se medirá (otra razón para no hacerlo). No quites la exclusión
  sin motivo: evita que PRs de solo-cableado fallen el `patch` por el ~0% de App.

---

## 8. Despliegue

`Dockerfile` multi-stage → **Google Cloud Run** (us-central1):

1. Stage 1 construye el frontend (`client/dist`).
2. Stage 2 levanta Express sirviendo esa SPA + el proxy.

> **Node del builder = `node:22-alpine`** (≥22.13). No bajarlo: `pdfjs-dist@6` lo
> exige; con Node 20 se omite como dependencia opcional y `tsc` falla en el build.
> Mantenerlo alineado con CI (Node 24) y el entorno local (ver §5).

En producción: `NODE_ENV=production`, `PORT=8080`, `HEALTHCHECK` sobre
`/health`. El catch-all sirve `index.html` para el routing de la SPA (devuelve
404 para `/api/*` y `/auth/*`).

### Flujo de trabajo de releases (rutina fija)

El flujo con el usuario es siempre el mismo, **no lo cambies**:

1. Desarrollar en la rama de feature, abrir PR, **vigilarlo** hasta merge (CI verde).
2. **Rutina de cierre automática (desde v3.23.2):** al cerrar una gestión —con
   tests verdes y build limpio— el asistente ejecuta **sin pedir permiso**, en
   este orden (bump → changelog → commit → push → tag → release → deploy → handoff):
   1. **Bump de versión** (`package.json` ×2 + lockfiles con `npm install`).
   2. **`CHANGELOG.md`** con la entrada de la versión (crédito al modelo que
      investigó vs. el que cerró el fix).
   3. **`README.md`** sincronizado: badge de versión, métricas actualizadas (tests,
      features). **Antes de cada push, toda la documentación del repo debe quedar
      actualizada.** No se permite pushear con el README desfasado respecto a la
      versión publicada.
   4. **`MEJORAS_FUTURAS.md`** actualizado: versión, puntos resueltos marcados,
      contadores ajustados. Debe reflejar el estado real del repo tras el cierre.
   5. **Commit** convencional con todos los cambios de la gestión (código + docs).
   6. **Push a `main`** (`git push origin main`).
   7. **Tag anotado** `vX.Y.Z` + push del tag (`git push origin vX.Y.Z`).
   8. **GitHub release** (`gh release create vX.Y.Z --title ... --notes-file ...`,
      con la misma sección del `CHANGELOG.md` como notas). Automático desde
      v3.23.2 (lo pidió el autor para no frenar el ciclo). Incluir la línea
      `Cambio de código por [asistente] ([modelo])` en las notas del release.
   9. **Deploy a Cloud Run: automático.** El push a `main` dispara el trigger de
      Cloud Build (`rmgpgab-github-ai-assistant-...`), que construye la imagen y
      actualiza el servicio. **No** requiere comando `gcloud` manual ni
      confirmación del autor. Tras cerrar, **verificar** que llegó a prod
      (`gcloud run services describe github-ai-assistant --region=us-central1
      --project=proyecto-app-antigravity --format="value(...image)"`: el tag de
      la imagen debe coincidir con el hash del commit recién pusheado).
   10. **Mensaje de handoff** (bloque de código listo para copiar en la siguiente
       sesión: repo, versión, qué se cerró, próximo trabajo priorizado, reglas de
       economía de contexto y crédito).
3. **No hay puntos de parada manuales** en la rutina de cierre: el push, el tag,
   el GitHub release **y el deploy a Cloud Run** son todos automáticos. Lo único
   que espera confirmación del usuario son acciones **fuera** de esta rutina.
4. **Deploy manual puntual:** si hace falta desplegar sin pasar por `main`
   (rollback, prueba aislada), usa `./deploy.sh` o `npm run deploy` (v3.41.0,
   #25-parte3): valida las 3 vars críticas antes de `gcloud run deploy`. **No lo
   uses para la rutina normal** — el CD automático del punto 9 es lo canónico.

> Regla de oro: el `commit` + `push` + `tag` + `release` + `deploy` van siempre
> juntos al cerrar. Nunca commitees sin pushear, ni pushees sin tagear, ni
> tagees sin publicar el release, ni publiques el release sin haber desplegado.
> El repo queda siempre en un estado publicable y en prod.

---

## 9. Referencias

Para más detalle, consulta:

- `README.md` — visión de producto, arquitectura ampliada, modelo de seguridad.
- `MANUAL_TECNICO.md` — documentación técnica detallada.
- `CONTRIBUTING.md` — estándares de código, flujo de PRs, testing.
- `MEJORAS_FUTURAS.md` — roadmap e issues priorizados.
- `CHANGELOG.md` — historial de versiones.
