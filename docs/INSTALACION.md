# ⚙️ Instalación y configuración local

Esta guía explica cómo ejecutar **GitHub AI Assistant** en local para desarrollo o pruebas.

La aplicación está dividida en:

- **Frontend:** React + TypeScript + Vite.
- **Backend:** Express.js para OAuth, proxies de IA y health check.
- **APIs externas:** GitHub REST API, Groq Cloud, Google Gemini, OpenRouter, NVIDIA NIM, Zenmux, OpenCode Zen, Cloudflare Workers AI, Ollama Cloud.

---

## 📋 Prerrequisitos

Antes de empezar necesitas:

| Requisito | Versión / detalle |
|---|---|
| Node.js | 20 o superior |
| npm | Incluido con Node.js |
| Git | Requerido para clonar y trabajar con el repo |
| GitHub OAuth App | Necesaria para login con GitHub |
| API key de IA | Groq, Gemini, OpenRouter, NVIDIA NIM, Zenmux, OpenCode Zen, Cloudflare Workers AI u Ollama Cloud |

---

## 📥 Clonar el repositorio

```bash
git clone https://github.com/migueljerico/github-ai-assistant.git
cd github-ai-assistant
```

---

## 🔐 Crear una GitHub OAuth App

Para usar el login con GitHub necesitas crear una OAuth App.

Ve a:

```text
https://github.com/settings/developers
```

Crea una nueva OAuth App con estos valores para desarrollo local:

| Campo | Valor |
|---|---|
| Application name | GitHub AI Assistant Local |
| Homepage URL | `http://localhost:5173` |
| Authorization callback URL | `http://localhost:3001/auth/callback` |

Cuando la crees, GitHub te dará:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

Los usarás en el archivo `.env`.

---

## 🧪 Proveedores de IA

La aplicación permite elegir entre varios proveedores de IA.

Necesitarás al menos una clave de:

| Proveedor | URL |
|---|---|
| Groq Cloud | `https://console.groq.com` |
| Google Gemini | `https://aistudio.google.com/apikey` |
| OpenRouter | `https://openrouter.ai/keys` |
| NVIDIA NIM | `https://build.nvidia.com/explore/discover` |
| Zenmux | `https://zenmux.ai` |
| OpenCode Zen | `https://opencode.ai` |
| Cloudflare Workers AI | `https://dash.cloudflare.com` |
| Ollama Cloud | `https://ollama.com` |

> La clave de IA **no** se configura en `.env`.  
> Cada usuario la introduce directamente en la aplicación y vive solo en memoria durante la sesión.

---

## 🧾 Variables de entorno

Copia el archivo de ejemplo:

```bash
cp .env.example .env
```

Edita `.env` con tus valores:

```env
GITHUB_CLIENT_ID=       # Client ID de tu GitHub OAuth App
GITHUB_CLIENT_SECRET=   # Client Secret de tu GitHub OAuth App
SESSION_SECRET=         # Cadena aleatoria larga
PORT=3001
FRONTEND_URL=http://localhost:5173
```

Puedes generar un `SESSION_SECRET` seguro con:

```bash
openssl rand -hex 32
```

Ejemplo:

```env
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SESSION_SECRET=8e7c2b2c2dbf4c8b9c0e9f6f2f6f3a0a9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b
PORT=3001
FRONTEND_URL=http://localhost:5173
```

---

## 📦 Instalar dependencias

Instala las dependencias del proyecto raíz:

```bash
npm install
```

Después instala las dependencias del cliente:

```bash
cd client
npm install
cd ..
```

---

## ▶️ Arrancar en desarrollo

Desde la raíz del proyecto:

```bash
npm run dev
```

Esto arranca:

| Servicio | URL |
|---|---|
| Frontend Vite | `http://localhost:5173` |
| Backend Express | `http://localhost:3001` |

Abre en el navegador:

```text
http://localhost:5173
```

---

## 🔁 Flujo de uso en local

1. Abre `http://localhost:5173`.
2. Pulsa conectar con GitHub.
3. Autoriza la OAuth App.
4. Elige proveedor de IA.
5. Pega tu clave de Groq, Gemini, OpenRouter, NVIDIA NIM, Zenmux, OpenCode Zen, Cloudflare Workers AI u Ollama Cloud.
6. Empieza a trabajar con tus repositorios.

---

## 🔑 Alternativa: Personal Access Token

Además de OAuth, la app puede permitir autenticación mediante PAT manual.

Este método es útil para pruebas rápidas, pero OAuth es el flujo recomendado.

Si usas PAT:

- Debe tener permisos suficientes para las operaciones que quieras realizar.
- No se almacena de forma persistente.
- Desaparece al recargar la página o cerrar la pestaña.

---

## 🧪 Ejecutar tests

### Tests del cliente

```bash
cd client
npm run test
```

### Tests una sola vez

```bash
cd client
npm run test:run
```

### Tests con cobertura

```bash
cd client
npm run test:coverage
```

---

## 🧹 Lint

Si el proyecto tiene script de lint configurado, puedes ejecutarlo desde el cliente:

```bash
cd client
npm run lint
```

---

## 🏗️ Build de producción

Para construir el frontend:

```bash
cd client
npm run build
cd ..
```

Para construir todo el proyecto según los scripts disponibles:

```bash
npm run build
```

---

## 🐳 Docker

El proyecto incluye un `Dockerfile` multi-stage preparado para despliegue en Cloud Run.

Build local:

```bash
docker build -t github-ai-assistant .
```

Ejecutar el contenedor:

```bash
docker run -p 8080:8080 \
  -e GITHUB_CLIENT_ID=tu_client_id \
  -e GITHUB_CLIENT_SECRET=tu_client_secret \
  -e SESSION_SECRET=tu_session_secret \
  github-ai-assistant
```

Después abre:

```text
http://localhost:8080
```

---

## ☁️ Despliegue en Google Cloud Run

Ejemplo de despliegue:

```bash
gcloud run deploy github-ai-assistant \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GITHUB_CLIENT_ID=...,GITHUB_CLIENT_SECRET=...,SESSION_SECRET=...
```

---

## 🌍 Variables recomendadas en producción

En producción deberías definir:

```env
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
SESSION_SECRET=
FRONTEND_URL=https://tu-dominio-o-url-cloud-run
NODE_ENV=production
```

Recomendaciones:

- Usa un `SESSION_SECRET` largo y aleatorio.
- No subas `.env` al repositorio.
- Configura correctamente la Callback URL de GitHub OAuth.
- Usa HTTPS.
- Mantén las claves de IA fuera del servidor.

---

## 🔗 Callback URL en producción

Cuando despliegues en Cloud Run, actualiza la OAuth App de GitHub.

Ejemplo:

| Campo | Valor |
|---|---|
| Homepage URL | `https://tu-servicio.run.app` |
| Authorization callback URL | `https://tu-servicio.run.app/auth/callback` |

Si la callback no coincide exactamente, GitHub rechazará el flujo OAuth.

---

## 🧠 Notas sobre Gemini

La app usa un proxy Express para Gemini porque las llamadas directas desde navegador pueden tener restricciones regionales.

Por eso:

- Groq y OpenRouter se llaman directamente desde el navegador.
- Gemini se llama mediante `/api/gemini`.
- El backend no almacena la clave Gemini.
- La clave viaja en la petición HTTPS y no se persiste.

---

## 🔒 Notas de seguridad local

Durante el desarrollo:

- No compartas tu `.env`.
- No subas tokens ni claves al repositorio.
- No pegues claves reales en issues públicos.
- Usa claves revocables.
- Si una clave se expone, revócala inmediatamente.

---

## 🧯 Problemas frecuentes

### Error: OAuth callback mismatch

Revisa que la callback de GitHub coincida exactamente con:

```text
http://localhost:3001/auth/callback
```

O con tu URL real de Cloud Run en producción.

---

### Error: SESSION_SECRET missing

Asegúrate de tener definido:

```env
SESSION_SECRET=una_cadena_larga_y_segura
```

---

### Error al conectar proveedor de IA

Comprueba:

- Que la clave sea válida.
- Que el proveedor elegido corresponda a la clave.
- Que el modelo seleccionado esté disponible.
- Que no hayas agotado cuota.
- Que el navegador no bloquee la petición.

---

### Error de CORS en desarrollo

Comprueba que `FRONTEND_URL` apunta a:

```text
http://localhost:5173
```

Y que el backend está corriendo en:

```text
http://localhost:3001
```

---

### No se abre el frontend

Revisa que Vite esté activo:

```bash
cd client
npm run dev
```

O usa el script raíz:

```bash
npm run dev
```

---

## ✅ Checklist de instalación

Antes de empezar a usar la app, verifica:

- [ ] Node.js 20+ instalado.
- [ ] Dependencias raíz instaladas.
- [ ] Dependencias del cliente instaladas.
- [ ] `.env` creado.
- [ ] OAuth App configurada.
- [ ] `GITHUB_CLIENT_ID` definido.
- [ ] `GITHUB_CLIENT_SECRET` definido.
- [ ] `SESSION_SECRET` definido.
- [ ] Backend en `localhost:3001`.
- [ ] Frontend en `localhost:5173`.
- [ ] Clave de IA lista para introducir en la app.

---

## 📚 Documentación relacionada

- ../README.md
- ./ARQUITECTURA.md
- ./SEGURIDAD.md
- ./TESTING_CALIDAD.md
- ./DESARROLLO_IA.md
