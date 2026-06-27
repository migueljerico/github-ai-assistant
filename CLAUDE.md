# CLAUDE.md

Guía para asistentes de IA (Claude Code y similares) que trabajen en este
repositorio. Resume la arquitectura, dónde vive cada cosa, cómo construir y
probar, y las convenciones que es fácil romper sin querer.

> **Idioma:** la UI, los comentarios del código y los mensajes de usuario están
> en **español**; los identificadores (variables, funciones, tipos) están en
> **inglés**. Mantén ese estilo bilingüe al editar.

---

## 1. Visión general

**GitHub AI Assistant** (v3.14.0) es una app web que permite operar la **GitHub
REST API en lenguaje natural** a través de un proveedor de IA (Google Gemini o
Groq Cloud). El usuario escribe una instrucción, la IA propone una acción, y
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
│   │   │   └── HistoryContext.tsx     # Log de acciones de la sesión
│   │   ├── hooks/            # useChat, useActions
│   │   ├── utils/            # formatResult, repoRef (resolveRepoRef), pdfReader/pdfAdvanced,
│   │   │                     #   spreadsheetReader (Excel/CSV vía SheetJS #28 Fase 3a),
│   │   │                     #   powerbiReader (.pbix/.pbit vía fflate: informe + modelo/DAX + Power Query/M del DataMashup #28 Fase 3b/3b-bis),
│   │   │                     #   docxReader (Word .docx vía fflate: texto de word/document.xml #28),
│   │   │                     #   releaseGenerator/releaseAssets, instructionSuggestions,
│   │   │                     #   rateLimitHandler, modeDetection (chat vs action), modelLabels
│   │   ├── components/       # Agrupados por feature:
│   │   │                     #   auth/ ai-provider/ chat/ confirm/ layout/
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
2. **Tras CADA merge**, sin que haga falta pedirlo, **preparar las notas de release**
   para que el usuario las publique: **tag `vX.Y.Z`**, **target `main`**, **título** y
   **cuerpo en lenguaje de usuario** (Markdown, novedades en claro, no técnico). El bump
   de versión (`package.json` ×2 + lockfiles) va en el propio PR.
3. El usuario publica el release y confirma el despliegue de Cloud Build antes de probar.

> El usuario lo pidió explícitamente: *"el release como siempre"*. Hazlo de forma
> proactiva tras el merge.

---

## 9. Referencias

Para más detalle, consulta:

- `README.md` — visión de producto, arquitectura ampliada, modelo de seguridad.
- `MANUAL_TECNICO.md` — documentación técnica detallada.
- `CONTRIBUTING.md` — estándares de código, flujo de PRs, testing.
- `MEJORAS_FUTURAS.md` — roadmap e issues priorizados.
- `CHANGELOG.md` — historial de versiones.
