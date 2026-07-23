# 🏗️ Arquitectura

**GitHub AI Assistant** es una aplicación full-stack con frontend React, backend Express y una arquitectura diseñada alrededor de tres principios:

1. **Zero-Storage:** las credenciales del usuario no se almacenan de forma persistente.
2. **Backend thin:** el servidor hace lo mínimo imprescindible.
3. **Propón → Confirma → Ejecuta:** la IA propone, pero el usuario decide antes de cualquier acción sensible.

---

## 🧭 Visión general

```text
Usuario
  ↓ lenguaje natural

Frontend React + TypeScript + Vite
  ├── Interfaz conversacional
  ├── Contexto de autenticación
  ├── Contexto de proveedor IA
  ├── Contexto de repositorio
  ├── Confirmación de acciones
  ├── Adjuntos locales
  ├── Historial de sesión
  └── Dashboard / modales / paneles

Backend Express thin
  ├── OAuth GitHub
  ├── Proxy Gemini
  ├── Rate limiting
  ├── Health check
  └── Servir build estático en producción

APIs externas
  ├── GitHub REST API v3
  ├── Groq Cloud
  ├── Google Gemini
  ├── OpenRouter
  ├── NVIDIA NIM
  └── Zenmux
  ├── OpenCode Zen
  ├── Cloudflare Workers AI
  └── Ollama Cloud
```

---

## 🧩 Diagrama de arquitectura

```text
┌────────────────────────────────────────────────────────────────────┐
│                            Usuario                                 │
│                 Escribe instrucciones en lenguaje natural           │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│              Frontend React 18 + TypeScript + Vite                 │
│                                                                    │
│  ┌─────────────────────┐   ┌──────────────────────┐               │
│  │ AuthContext          │   │ AIProviderContext     │               │
│  │ Token GitHub         │   │ Proveedor + clave IA  │               │
│  │ solo en memoria      │   │ solo en memoria       │               │
│  └─────────────────────┘   └──────────────────────┘               │
│                                                                    │
│  ┌─────────────────────┐   ┌──────────────────────┐               │
│  │ ChatArea / ChatInput │   │ ConfirmModal          │               │
│  │ Conversación         │   │ Revisión de acciones  │               │
│  └─────────────────────┘   └──────────────────────┘               │
│                                                                    │
│  ┌─────────────────────┐   ┌──────────────────────┐               │
│  │ FileAttachButton     │   │ HistoryPanel          │               │
│  │ Archivos locales     │   │ Historial exportable  │               │
│  └─────────────────────┘   └──────────────────────┘               │
│                                                                    │
│  ┌─────────────────────┐   ┌──────────────────────┐               │
│  │ services/github.ts   │   │ services/gemini.ts    │               │
│  │ GitHub REST API      │   │ IA multi-proveedor    │               │
│  └─────────────────────┘   └──────────────────────┘               │
└──────────────┬───────────────────────────────┬─────────────────────┘
               │                               │
               │ llamadas directas             │ /api/gemini
               ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│ APIs externas directas         │   │ Backend Express.js             │
│                                │   │                                │
│ ├── GitHub REST API v3         │   │ ├── /auth/github               │
│ ├── Groq Cloud                 │   │ ├── /auth/callback             │
│ ├── OpenRouter                 │   │ ├── /api/gemini                │
│ ├── NVIDIA NIM                 │   │ ├── /api/nim                   │
│ ├── Zenmux                     │   │ ├── /api/openzen               │
│ ├── OpenCode Zen               │   │ ├── /api/cloudflare            │
│ ├── Cloudflare Workers AI      │   │ ├── /api/ollama                │
│ └── Ollama Cloud               │   │ ├── /health                    │
│                                │   │ └── static files               │
└───────────────────────────────┘   └───────────────┬───────────────┘
                                                    │
                                                    ▼
                                      ┌───────────────────────────────┐
                                      │ Gemini + NVIDIA NIM + OpenCode Zen + Cloudflare + Ollama APIs │
                                      │ vía proxy (bloqueo CORS/EEA del navegador)                    │
                                      └───────────────────────────────┘
```

---

## 🧠 Principios de diseño

### 1. Zero-Storage

Las credenciales sensibles viven solo en memoria durante la sesión activa.

No se almacenan en:

- `localStorage`
- `sessionStorage`
- cookies
- IndexedDB
- base de datos
- backend propio

Esto aplica a:

- Token OAuth de GitHub.
- PAT manual, si se usa.
- Claves de Groq.
- Claves de Gemini.
- Claves de OpenRouter.
- Claves de NVIDIA NIM.
- Claves de Zenmux.
- Claves de OpenCode Zen.
- Claves de Cloudflare Workers AI.
- Claves de Ollama Cloud.

---

### 2. Backend thin

El backend Express es intencionalmente mínimo.

Responsabilidades principales:

- Iniciar OAuth con GitHub.
- Recibir el callback OAuth.
- Intercambiar el `code` por un token.
- Servir el frontend en producción.
- Exponer `/health`.
- Actuar como proxy para Gemini, NVIDIA NIM, OpenCode Zen, Cloudflare Workers AI y Ollama Cloud (bloqueo CORS/geográfico).
- Aplicar rate limiting a cada proxy.

Responsabilidades que **no** asume:

- No guarda usuarios.
- No guarda tokens.
- No guarda claves de IA.
- No guarda conversaciones.
- No analiza repositorios.
- No procesa archivos locales.
- No actúa como base de datos.

---

### 3. Propón → Confirma → Ejecuta

La IA no ejecuta cambios directamente.

El flujo de acciones sensibles es:

```text
Usuario pide algo
  ↓
IA propone una acción estructurada
  ↓
La app valida la propuesta
  ↓
La app muestra el plan al usuario
  ↓
El usuario confirma o cancela
  ↓
Solo si confirma, se ejecuta la acción
```

Este patrón se aplica a operaciones como:

- Crear repositorios.
- Modificar archivos.
- Crear commits.
- Crear ramas.
- Crear Draft Pull Requests.
- Crear Releases.
- Publicar documentación.
- Operaciones multi-repo.

---

## 🖥️ Frontend

El frontend está construido con:

- React 18.
- TypeScript.
- Vite.
- Context API.
- Componentes modulares.
- Servicios desacoplados.
- Utilidades puras testeables.

---

## 🧱 Capas del frontend

```text
client/src/
├── components/     # Componentes visuales
├── context/        # Estado global de auth, IA, historial, idioma
├── hooks/          # Hooks reutilizables
├── prompts/        # Prompts del sistema en Markdown
├── services/       # Integraciones y orquestación
├── types/          # Tipos TypeScript compartidos
└── utils/          # Funciones puras y testeables
```

---

## 🧩 Componentes principales

| Componente | Responsabilidad |
|---|---|
| `AuthGate` | Controla si el usuario está autenticado con GitHub |
| `AIProviderGate` | Controla si hay proveedor IA activo |
| `AIProviderPanel` | Selección y validación de proveedor/modelo |
| `ChatArea` | Renderizado de la conversación |
| `ChatInput` | Entrada principal del usuario |
| `ConfirmModal` | Confirmación de acciones sensibles |
| `DocModal` | Vista previa y publicación de documentación de repositorio |
| `FilePublishModal` | Documentación y publicación de archivos adjuntos |
| `HistoryPanel` | Historial de sesión |
| `TemplatePanel` | Plantillas predefinidas |
| `RepoSelector` | Selección multi-repo |
| `CodeHealthModal` | Dashboard de salud del código |
| `ErrorBoundary` | Pantalla amable ante errores de render |

---

## 🔄 Contextos principales

### `AuthContext`

Responsable de:

- Gestionar el token GitHub en memoria.
- Validar usuario.
- Login OAuth.
- Login con PAT.
- Logout.
- Estado de autenticación.

---

### `AIProviderContext`

Responsable de:

- Guardar proveedor activo.
- Guardar modelo activo.
- Guardar clave IA en memoria.
- Validar claves.
- Conectar y desconectar proveedor.
- Mantener coherencia multi-proveedor.

---

### `HistoryContext`

Responsable de:

- Registrar acciones de la sesión.
- Marcar estados.
- Exportar historial.
- Mostrar actividad al usuario.

---

### `LanguageContext`

Responsable de:

- Idioma activo.
- Función `t()`.
- Interpolación de variables.
- Traducción de UI.
- Directivas de idioma para respuestas IA.

---

## 🔌 Servicios principales

### `services/github.ts`

Capa de integración con GitHub REST API v3.

Incluye operaciones como:

- Obtener usuario.
- Listar repositorios.
- Crear repositorios.
- Leer archivos.
- Crear o actualizar archivos.
- Eliminar archivos.
- Crear ramas.
- Crear Pull Requests.
- Crear Releases.
- Obtener commits.
- Obtener issues y PRs.
- Descargar árbol del repositorio.
- Trabajar con contenido Base64.

---

### `services/gemini.ts`

Aunque mantiene el nombre histórico `gemini.ts`, actúa como cliente unificado de IA.

Responsabilidades:

- Enrutar llamadas según proveedor activo.
- Llamar a Gemini.
- Llamar a Groq.
- Llamar a OpenRouter.
- Llamar a NVIDIA NIM (vía proxy `/api/nim`).
- Llamar a Zenmux.
- Gestionar streaming.
- Validar claves.
- Parsear respuestas.
- Interpretar acciones propuestas.
- Aplicar directivas de idioma.
- Manejar errores transitorios.

---

### `services/assistantActions.ts`

Orquesta los flujos principales del asistente.

Ejemplos:

- Enviar mensaje.
- Confirmar acción.
- Cancelar acción.
- Documentar repositorio.
- Cargar repo como contexto.
- Resumir hilo.
- Generar changelog.
- Adjuntar archivo.
- Documentar archivo.
- Publicar archivo.
- Crear release.
- Ejecutar salud del código.

---

### `services/actionExecutor.ts`

Ejecuta acciones confirmadas por el usuario.

Responsabilidades:

- Resolver placeholders.
- Validar método HTTP.
- Llamar a GitHub API.
- Ejecutar operaciones GET, POST, PUT, PATCH y DELETE.
- Manejar acciones multi-repo.
- Formatear resultados.

---

### `services/docPublisher.ts`

Gestiona la publicación de documentación generada.

Permite:

- Commit directo.
- Draft Pull Request.
- Actualización de archivos existentes.
- Publicación de documentación de repositorio.
- Publicación de documentación de archivo.

---

## 🧰 Utilidades relevantes

| Utilidad | Responsabilidad |
|---|---|
| `repoRef.ts` | Resolver referencias `owner/repo` |
| `formatResult.ts` | Formatear respuestas de GitHub |
| `modeDetection.ts` | Decidir modo chat o acción |
| `contextRanker.ts` | Seleccionar archivos relevantes |
| `conversationIO.ts` | Exportar/importar conversación |
| `retry.ts` | Reintentos transitorios |
| `pdfReader.ts` | Lectura de PDF |
| `spreadsheetReader.ts` | Lectura de Excel/CSV |
| `powerbiReader.ts` | Lectura de Power BI |
| `docxReader.ts` | Lectura de Word `.docx` |
| `releaseAssets.ts` | Gestión de assets de releases |
| `codeHealth.ts` | Métricas de salud del código |

---

## 🧠 Flujo de chat

```text
Usuario escribe mensaje
  ↓
ChatInput envía el texto
  ↓
assistantActions.runSend()
  ↓
modeDetection decide chat o acción
  ↓
callAI() envía contexto al proveedor
  ↓
La respuesta llega completa o en streaming
  ↓
Si es conversación: se muestra en ChatArea
  ↓
Si es acción: se valida y se abre ConfirmModal
```

---

## 🛡️ Flujo de acción confirmada

```text
IA propone acción
  ↓
parseGeminiAction valida estructura
  ↓
ConfirmModal muestra plan
  ↓
Usuario confirma
  ↓
actionExecutor ejecuta
  ↓
GitHub API responde
  ↓
formatResultData formatea salida
  ↓
HistoryPanel registra resultado
```

---

## 📎 Flujo de archivo adjunto

```text
Usuario adjunta archivo
  ↓
FileAttachButton valida tipo y tamaño
  ↓
runAttachFile selecciona lector
  ↓
El contenido se extrae en navegador
  ↓
Se guarda como contexto en memoria
  ↓
El usuario pregunta o documenta
  ↓
La IA responde usando el contexto del archivo
```

Lectores por tipo:

| Tipo | Lector |
|---|---|
| PDF | `pdfReader.ts` |
| Word `.docx` | `docxReader.ts` |
| Excel / CSV | `spreadsheetReader.ts` |
| Power BI | `powerbiReader.ts` |
| Texto / código | lectura directa |

---

## 🤖 Flujo de documentación de repositorio

```text
Usuario pide documentar repo
  ↓
fetchRepoTreeRecursive obtiene árbol y archivos relevantes
  ↓
Se construye contexto del repositorio
  ↓
callAI genera README + MANUAL_TECNICO
  ↓
DocModal muestra vista previa
  ↓
Usuario elige publicación
  ├── Commit directo
  ├── Draft PR
  └── Release
```

---

## 📤 Flujo de documentación de archivo

```text
Usuario adjunta archivo
  ↓
La app extrae contenido
  ↓
Usuario conversa o analiza
  ↓
Usuario pulsa Documentar y publicar
  ↓
generateFileDoc genera Markdown
  ↓
FilePublishModal muestra vista previa
  ↓
Usuario elige destino
  ├── Commit directo
  ├── Draft PR
  └── Release
```

Opcionalmente puede publicar:

- Archivo original.
- Imágenes.
- Datasets.
- Assets extra.

---

## 📊 Flujo de salud del código

```text
Usuario indica repo
  ↓
La app obtiene árbol y commits
  ↓
codeHealth calcula métricas
  ↓
Recharts renderiza dashboard
```

Métricas:

- Lenguajes.
- Commits por semana.
- Marcadores de deuda técnica.

---

## 🌐 Flujo i18n

```text
Usuario selecciona idioma
  ↓
LanguageContext actualiza estado
  ↓
Componentes usan t()
  ↓
assistantActions recibe t por inyección
  ↓
Prompts reciben directiva de idioma
  ↓
La IA responde en el idioma activo
```

Idiomas actuales:

- Español.
- Inglés.

---

## 🔑 Flujo multi-proveedor IA

```text
Usuario elige proveedor
  ↓
AIProviderPanel carga modelos disponibles
  ↓
Usuario introduce clave
  ↓
validateProviderKey comprueba credencial
  ↓
AIProviderContext guarda configuración en memoria
  ↓
callAI enruta al transporte adecuado
```

Proveedores:

| Proveedor | Transporte |
|---|---|
| Groq | OpenAI-compatible directo desde navegador (envía CORS) |
| OpenRouter | OpenAI-compatible directo desde navegador (envía CORS) |
| Zenmux | OpenAI-compatible directo desde navegador (envía CORS) |
| Gemini | Proxy Express `/api/gemini` (bloqueo UE/EEA) |
| NVIDIA NIM | Proxy Express `/api/nim` (sin cabeceras CORS) |
| OpenCode Zen | Proxy Express `/api/openzen` (sin cabeceras CORS) |
| Cloudflare Workers AI | Proxy Express `/api/cloudflare` (sin cabeceras CORS) |
| Ollama Cloud | Proxy Express `/api/ollama` (sin cabeceras CORS) |
| Ai& | Proxy Express `/api/aiand` (sin cabeceras CORS) |

---

## 🧱 Backend Express

El backend reside principalmente en:

```text
server/index.js
```

Responsabilidades:

| Endpoint | Función |
|---|---|
| `GET /auth/github` | Inicia flujo OAuth con GitHub |
| `GET /auth/callback` | Recibe callback y completa OAuth |
| `POST /api/gemini` | Proxy hacia Gemini (SDK, bloqueo EEA) |
| `GET /api/gemini/models` | Listado de modelos Gemini vía proxy (mantenido, sin uso por el frontend desde v3.24.0 — catálogo estático) |
| `POST /api/nim` | Proxy hacia NVIDIA NIM (sin CORS upstream) |
| `POST /api/openzen` | Proxy hacia OpenCode Zen (sin CORS upstream) |
| `POST /api/cloudflare` | Proxy hacia Cloudflare Workers AI (sin CORS upstream) |
| `POST /api/ollama` | Proxy hacia Ollama Cloud (sin CORS upstream) |
| `POST /api/aiand` | Proxy hacia Ai& (sin CORS upstream) |
| `GET /api/nim/models` · `/api/ollama/models` · `/api/aiand/models` | Catálogos dinámicos de modelos de NIM, Ollama y Ai& vía proxy |
| `GET /health` | Health check |
| `GET /*` | Sirve frontend en producción |

---

## 🔐 OAuth GitHub

Flujo:

```text
Usuario pulsa conectar
  ↓
Frontend navega a /auth/github
  ↓
Express genera state y redirige a GitHub
  ↓
GitHub autentica usuario
  ↓
GitHub redirige a /auth/callback
  ↓
Express valida state
  ↓
Express intercambia code por token
  ↓
Frontend recibe token
  ↓
AuthContext lo guarda en memoria
```

---

## 🧠 Por qué no hay base de datos

El proyecto no usa base de datos por diseño.

Motivos:

- Mantener Zero-Storage.
- Evitar persistir credenciales.
- Reducir superficie de ataque.
- Simplificar despliegue.
- Mantener control en el cliente.
- Hacer que el usuario controle export/import.

---

## 🚦 Gestión de errores

La app intenta transformar errores técnicos en mensajes accionables.

Ejemplos:

- Clave IA inválida.
- Modelo saturado.
- Cuota agotada.
- Repo inexistente.
- Callback OAuth mal configurada.
- Archivo demasiado grande.
- Formato no soportado.
- Acción inválida propuesta por IA.
- Endpoint externo rechazado.

---

## 🔁 Reintentos

La app puede reintentar errores transitorios, pero evita reintentar errores no recuperables.

Ejemplos de errores reintentables:

- Fallos puntuales de red.
- Errores 5xx.
- Saturación temporal de proveedor IA.

Errores que no se reintentan:

- 401.
- 403.
- 404.
- 422.
- Cancelaciones del usuario.
- Payloads inválidos.

---

## 🧪 Arquitectura testeable

La lógica se ha ido extrayendo de componentes grandes hacia:

- Servicios.
- Hooks.
- Utilidades puras.
- Contextos.
- Módulos pequeños.

Esto permite testear:

- Parsing.
- Validación.
- Lectores de archivos.
- Flujos de publicación.
- Componentes.
- Contextos.
- Errores.
- Accesibilidad básica.

---

## 📦 Despliegue

El proyecto está preparado para desplegarse en Google Cloud Run.

Elementos clave:

- `Dockerfile` multi-stage.
- Build del cliente.
- Servidor Express sirviendo estáticos.
- `/health` para health checks.
- Variables de entorno para OAuth.
- Región compatible con proxy Gemini.

---

## ✅ Resumen

La arquitectura de GitHub AI Assistant busca equilibrar:

- Potencia funcional.
- Seguridad.
- Control humano.
- Simplicidad operativa.
- Mantenibilidad.
- Uso de IA multi-proveedor.
- Acceso a GitHub sin conocer la API.

La idea central es:

> **Usar IA para traducir intención en acciones sobre GitHub, pero mantener siempre al usuario en control.**
