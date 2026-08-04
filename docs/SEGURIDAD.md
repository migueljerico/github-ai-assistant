# 🔒 Modelo de seguridad

La seguridad de **GitHub AI Assistant** gira alrededor de una idea central:

> **Las credenciales del usuario son el activo más crítico del sistema.**

La aplicación puede operar sobre repositorios públicos y privados de GitHub, por lo que el diseño prioriza la protección de tokens, claves de IA y acciones de escritura.

---

## 🛡️ Principios de seguridad

| Principio | Aplicación en el proyecto |
|---|---|
| Zero-Storage | Las credenciales no se guardan en almacenamiento persistente |
| Confirmación previa | Ninguna acción sensible se ejecuta sin revisión del usuario |
| Backend mínimo | El servidor no almacena usuarios, tokens ni conversaciones |
| Validación de acciones | Las acciones propuestas por IA se validan antes de ejecutarse |
| Menor persistencia posible | La sesión desaparece al recargar o cerrar la pestaña |
| Errores claros | Los fallos se comunican en lenguaje comprensible |
| Control humano | La IA propone, pero el usuario decide |

---

## 🧠 Arquitectura Zero-Storage

La aplicación implementa una arquitectura **Zero-Storage** para credenciales.

Esto significa que no se almacenan tokens ni claves en:

- `localStorage`
- `sessionStorage`
- cookies
- IndexedDB
- base de datos
- servidor propio
- ficheros locales generados por la app

Las credenciales viven únicamente en memoria durante la sesión activa.

---

## 🔑 Token de GitHub

El token de GitHub puede venir de:

- OAuth.
- Personal Access Token manual.

En ambos casos:

- Vive solo en memoria React.
- No se escribe en almacenamiento del navegador.
- No se guarda en el backend.
- Desaparece al recargar la página.
- Desaparece al cerrar la pestaña.
- Se elimina al hacer logout.

---

## 🤖 Claves de IA

Las claves de proveedores IA también viven solo en memoria.

Proveedores soportados:

- Groq Cloud.
- Google Gemini.
- OpenRouter.
- NVIDIA NIM.
- Zenmux.
- OpenCode Zen.
- Cloudflare Workers AI.
- Ollama Cloud.
- Ai&.

La clave:

- Se introduce en la interfaz.
- Se valida contra el proveedor.
- Se mantiene en memoria durante la sesión.
- No se persiste.
- No se guarda en `.env`.
- No se almacena en servidor.

---

## 🧾 Qué se guarda y qué no

| Elemento | Se almacena de forma persistente | Dónde vive |
|---|---:|---|
| Token OAuth GitHub | No | Memoria React |
| PAT GitHub | No | Memoria React |
| Clave Groq | No | Memoria React |
| Clave Gemini | No | Memoria React / tránsito HTTPS al proxy |
| Clave OpenRouter | No | Memoria React |
| Clave NVIDIA NIM | No | Memoria React / tránsito HTTPS al proxy |
| Clave Zenmux | No | Memoria React |
| Conversación | No automáticamente | Estado React o fichero exportado por el usuario |
| Historial de sesión | No automáticamente | Estado React |
| Preferencias no sensibles | Puede recordarse si aplica | Estado o almacenamiento no sensible |
| `GITHUB_CLIENT_SECRET` | Sí, como variable de entorno del servidor | Entorno de ejecución |
| Código del usuario | No se almacena en servidor propio | GitHub / memoria del navegador |

---

## 🔄 Consecuencia práctica

Al recargar la página:

- Se pierde la sesión de GitHub.
- Se pierde la clave de IA.
- Se pierde el contexto activo.
- Se pierde la conversación, salvo que el usuario la haya exportado manualmente.

Esto no es un bug.

Es un trade-off deliberado:

> Se sacrifica comodidad para reducir exposición de credenciales.

---

## 🧨 Sobre XSS y credenciales

Zero-Storage no significa que un XSS deje de ser peligroso.

Un XSS siempre debe considerarse grave.

Lo que Zero-Storage reduce es el vector más directo de robo persistente:

```text
script malicioso → leer localStorage/sessionStorage → extraer token
```

Al no guardar tokens en almacenamiento del navegador, un atacante no tiene un almacén trivial desde el que extraer credenciales persistidas.

---

## ✅ Ventaja del modelo en memoria

Con credenciales en memoria:

- No hay token persistente que robar desde `localStorage`.
- No hay clave guardada en `sessionStorage`.
- No hay cookie de credencial propia de la app.
- Al cerrar o recargar, desaparecen las credenciales.
- La superficie de robo persistente se reduce.

---

## ⚠️ Límites del modelo

Este modelo no elimina todos los riesgos.

Un atacante con ejecución JavaScript dentro de la app podría intentar:

- Manipular la interfaz.
- Interceptar acciones.
- Forzar llamadas mientras la sesión está activa.
- Engañar al usuario.
- Alterar el flujo de confirmación.

Por eso Zero-Storage se combina con:

- Confirmación previa.
- Validación de acciones.
- Endpoints relativos.
- Rechazo de endpoints externos.
- Diff antes de modificar.
- Rate limiting.
- Logout.
- Mensajes claros.

---

## 🧩 Patrón `propón → confirma → ejecuta`

La IA no ejecuta acciones directamente.

Flujo:

```text
Usuario pide una acción
  ↓
IA propone acción estructurada
  ↓
La app valida la propuesta
  ↓
Se muestra el plan al usuario
  ↓
El usuario confirma o cancela
  ↓
Solo si confirma, se ejecuta
```

Este patrón protege frente a:

- Acciones inesperadas.
- Malinterpretaciones del modelo.
- Cambios destructivos.
- Escrituras accidentales.
- Operaciones sobre el repositorio equivocado.

---

## ✅ Confirmación de acciones

Antes de ejecutar, el usuario puede revisar:

- Descripción de la acción.
- Método o tipo de operación.
- Repositorio afectado.
- Archivo afectado.
- Payload propuesto.
- Resultado esperado.
- Diff si se modifica contenido existente.

---

## 🆚 Diff antes de modificar

Cuando se modifica un archivo existente, la app puede mostrar una vista de diferencias.

Esto permite ver:

- Líneas añadidas.
- Líneas eliminadas.
- Cambios relevantes.
- Posibles errores antes de publicar.

---

## 🔐 OAuth con `state` anti-CSRF

El flujo OAuth usa un parámetro `state`.

Objetivo:

- Prevenir ataques CSRF en el login.
- Asegurar que el callback corresponde a un flujo iniciado por el usuario.
- Evitar callbacks no solicitados.

El `state` se genera con fuente criptográficamente segura y se valida en el callback.

---

## 🔒 `SESSION_SECRET`

En producción, el servidor debe tener configurado un `SESSION_SECRET` fuerte.

Recomendación:

```bash
openssl rand -hex 32
```

El servidor no debería ejecutarse en producción con un secret débil o ausente.

---

## 🧱 Backend thin

El backend Express tiene responsabilidades limitadas.

Hace:

- OAuth GitHub.
- Callback OAuth.
- Proxy Gemini.
- Rate limiting.
- Health check.
- Servir frontend en producción.

No hace:

- Guardar usuarios.
- Guardar tokens.
- Guardar claves de IA.
- Guardar conversaciones.
- Guardar código.
- Crear una base de datos de actividad.

---

## 🔁 Proxy Gemini

Gemini usa un proxy porque las llamadas directas desde navegador pueden tener restricciones regionales.

Flujo:

```text
Frontend
  ↓ HTTPS
POST /api/gemini
  ↓
Backend Express
  ↓
Google Gemini API
```

La clave Gemini:

- Viaja en la petición HTTPS.
- Se usa para la llamada.
- No se guarda.
- No se persiste.
- No se registra intencionadamente.

---

## 🚦 Rate limiting

El backend de Express implementa rate limiting independiente para cada proxy a proveedores de IA (Gemini, NVIDIA NIM, OpenCode Zen, Cloudflare, Ollama, Ai&, Kilo y BazaarLink).

Objetivo:

- Reducir abuso.
- Evitar saturación.
- Proteger cuota.
- Limitar impacto de llamadas repetidas.

Configuración documentada:

```text
40 peticiones por minuto por IP
```

---

## 🧪 Validación de acciones propuestas por IA

Las acciones propuestas por el modelo se validan antes de ejecutarse.

Validaciones típicas:

- Método permitido.
- Tipo de acción permitido.
- Endpoint relativo.
- Rechazo de URLs absolutas.
- Rechazo de hosts externos.
- Placeholders resueltos de forma controlada.
- Payload esperado.
- Confirmación de usuario.

---

## 🚫 Endpoints externos

Una acción propuesta por IA no debe poder redirigir la ejecución a un host externo arbitrario.

Por eso se rechazan endpoints absolutos como:

```text
https://example.com/...
http://malicious.site/...
```

Las operaciones deben ir contra rutas esperadas de GitHub o flujos controlados.

---

## 🧱 Allowlist de métodos

La app acepta solo métodos previstos.

Ejemplo:

```text
GET
POST
PUT
PATCH
DELETE
```

Cualquier método fuera de la allowlist debe rechazarse o tratarse como respuesta conversacional.

---

## 🧯 Manejo de errores

Los errores técnicos se traducen a mensajes más comprensibles para el usuario.

Ejemplos:

| Error técnico | Mensaje útil |
|---|---|
| 401 | Credencial inválida o caducada |
| 403 | Permiso insuficiente o límite alcanzado |
| 404 | Repositorio, archivo o recurso no encontrado |
| 422 | Datos inválidos para GitHub |
| 429 | Límite de peticiones alcanzado |
| 5xx | Error temporal del proveedor o servidor |

---

## 🔁 Política de reintentos

La app puede reintentar fallos transitorios.

Se pueden reintentar:

- Fallos puntuales de red.
- Errores 5xx.
- Saturación temporal.
- Respuestas transitorias de proveedor IA.

No se reintentan:

- 401.
- 403.
- 404.
- 422.
- Cancelaciones del usuario.
- Payloads inválidos.
- Acciones rechazadas.

---

## ⏹️ Cancelación de generación

El usuario puede detener una generación en curso.

Esto reduce:

- Coste.
- Tiempo perdido.
- Uso innecesario de cuota.
- Respuestas largas no deseadas.

Las cancelaciones no deben tratarse como errores reales.

---

## 📎 Seguridad en archivos locales

Los archivos adjuntos se procesan en el navegador.

La app no los sube a un servidor propio para extraer contenido.

Esto aplica a:

- PDF.
- DOCX.
- Excel.
- CSV.
- Power BI.
- Texto.
- Código.

---

## 📊 Archivos grandes

Para evitar saturar la ventana de contexto o bloquear el navegador:

- Se aplican límites de tamaño.
- Se toman muestras representativas.
- Se avisa al usuario cuando no se analiza todo.
- Se evita enviar contenido innecesario al modelo.

---

## ⚠️ Vulnerabilidades conocidas en dependencias

### `xlsx` (SheetJS Community Edition) — Prototype Pollution + ReDoS

- **Dependencia:** `xlsx@^0.18.5` (usado en `spreadsheetReader.ts` para Fase 3a Excel/CSV)
- **CVEs:** GHSA-xvch-5gv4-9q4h (Prototype Pollution), GHSA-93q8-gq69-qvxp (ReDoS)
- **Estado:** Sin fix en npm — el paquete está descontinuado. Versión 0.20.2 disponible solo en CDN (https://cdn.sheetjs.com/), no en npm.
- **Riesgo:** Solo al **leer archivos Excel/CSV maliciosos** adjuntados por el usuario (ataque de archivo). El flujo de escritura/exportación no se ve afectado.
- **Mitigación actual (v3.36.0):**
  - El usuario debe confiar en el archivo que sube (no hay validación previa).
  - El parseo ocurre en el navegador (cliente), no en servidor.
- **Plan para v3.36.1:**
  1. Límite de tamaño de archivo (ej. 10 MB) antes de parsear.
  2. Validación básica de estructura (cabeceras esperadas) tras parseo.
  3. Aviso en UI: "Solo suba archivos de fuentes confiables. No se analizan archivos maliciosos."
  4. **NO migrar a `exceljs`** — añade ~4 MB al bundle (chunk propio), inaceptable para la arquitectura de chunks lazy actuales.
  5. Documentado en `docs/SEGURIDAD.md` y `README.md` (sección "Limitaciones conocidas").

---

## 💾 Export/import de conversación

La exportación de conversación se realiza mediante fichero controlado por el usuario.

Ventajas:

- No rompe Zero-Storage.
- No requiere base de datos.
- No guarda nada automáticamente.
- El usuario decide si conserva el contexto.

Riesgo:

- El fichero exportado puede contener información sensible.
- El usuario debe guardarlo con cuidado.

---

## 🧠 Seguridad en prompts y acciones

La app separa:

- Conversación.
- Acción.
- Confirmación.
- Ejecución.

Esto reduce el riesgo de que una respuesta conversacional se convierta directamente en una operación destructiva.

La IA puede equivocarse, por eso la aplicación no delega la decisión final.

---

## 🧬 Riesgos residuales

Ninguna arquitectura elimina todo el riesgo.

Riesgos residuales:

- XSS durante sesión activa.
- Usuario confirmando una acción equivocada.
- Permisos amplios del scope `repo`.
- Errores de proveedor IA.
- Cambios en APIs externas.
- Bugs en librerías de terceros.
- Exposición accidental de claves por el usuario.
- Publicación involuntaria de información sensible.

---

## ⚠️ Vulnerabilidades conocidas (v3.36.0 → mitigadas en v3.36.1)

### `xlsx` (SheetJS Community Edition) — Prototype Pollution + ReDoS — **MITIGADO v3.36.1**
- **Dependencia:** `xlsx@^0.18.5` (usado en `spreadsheetReader.ts` para Fase 3a Excel/CSV)
- **CVEs:** GHSA-xvch-5gv4-9q4h (Prototype Pollution), GHSA-93q8-gq69-qvxp (ReDoS)
- **Estado:** Sin fix en npm — el paquete está descontinuado. Versión 0.20.2 disponible solo en CDN (https://cdn.sheetjs.com/), no en npm.
- **Riesgo:** Solo al **leer archivos Excel/CSV maliciosos** adjuntados por el usuario (ataque de archivo). El flujo de escritura/exportación no se ve afectado.
- **Mitigación aplicada (v3.36.1):**
  1. Límite de tamaño de archivo (10 MB) antes de parsear en `spreadsheetReader.ts`.
  2. Validación básica de estructura (cabeceras esperadas) tras parseo.
  3. Aviso en UI (FileAttachButton / DocumentFlowModal): "Solo suba archivos de fuentes confiables. No se analizan archivos maliciosos. Límite: 10 MB."
  4. Rate limiting en ruta catch-all SPA (`server/index.js`) para prevenir DoS.
  5. CI workflow con `permissions: contents: read` para CodeQL compliance.
  6. **NO migrar a `exceljs`** — añade ~4 MB al bundle (chunk propio), inaceptable para la arquitectura de chunks lazy actuales.
  7. Documentado en `docs/SEGURIDAD.md` y `README.md` (sección "Limitaciones conocidas").

---

## 🧭 Mitigaciones

| Riesgo | Mitigación |
|---|---|
| Robo de tokens persistidos | Zero-Storage |
| Acción equivocada de IA | Confirmación previa |
| Modificación inesperada | Diff antes de escribir |
| Endpoint malicioso | Rechazo de endpoints absolutos |
| Abuso del proxy Gemini | Rate limiting |
| Error temporal de proveedor | Reintentos controlados |
| Saturación de contexto | Ranking y truncado de contenido |
| Pérdida de sesión | Export/import manual |
| Errores de UI | ErrorBoundary |
| Confusión del usuario | Mensajes claros y flujo guiado |
| Archivos Excel/CSV maliciosos | Límite 10 MB + validación post-parseo + aviso UI (v3.36.1 ✅) |

---

## 🤖 Automatización de seguridad

### Dependabot
- **Activo** en `client/` y `server/` (npm ecosystem).
- Abre PRs automáticos para actualizaciones de dependencias (patch/minor/major configurado en `.github/dependabot.yml`).
- Alertas de vulnerabilidades (GHSA/CVE) se generan en **Security → Dependabot alerts**.
- **Política**: revisar PRs de Dependabot semanalmente; merguear tras CI verde.
- **Ejemplo actual**: alertas xlsx (Prototype Pollution + ReDoS) → mitigadas en v3.36.1 (ver sección anterior).

### CodeQL (GitHub Advanced Security)
- **Activo** en cada push/PR a `main` (workflow `.github/workflows/codeql.yml` o CodeQL nativo en Actions).
- Analiza: JavaScript/TypeScript (client + server), workflows YAML, Dockerfile.
- Reglas: `security-extended`, `security-and-quality`.
- **Alertas** aparecen en **Security → Code scanning alerts**.
- **Política**: cero alertas `High/Critical` en main; `Medium/Low` revisadas en PR.
- **Ejemplo actual**: 2 alertas `actions/missing-workflow-permissions` → corregidas en v3.36.1 con `permissions: contents: read`.

> **Configuración**: `.github/workflows/ci.yml` incluye `permissions: contents: read` para cumplimiento CodeQL.

---

## 🧪 Seguridad y testing

Las decisiones de seguridad se acompañan de tests en áreas como:

- Validación de acciones.
- Rechazo de endpoints inválidos.
- Métodos permitidos.
- Rate limiting.
- Gestión de credenciales en contexto.
- No persistencia de claves.
- Cancelación de peticiones.
- Manejo de errores.
- Flujos de confirmación.

---

## 📌 Recomendaciones para usuarios

- Usa OAuth cuando sea posible.
- Revisa siempre las acciones antes de confirmar.
- No pegues claves reales en issues, PRs o documentación pública.
- Revoca cualquier token que sospeches expuesto.
- No subas archivos con secretos.
- Comprueba el destino antes de publicar.
- Usa repos privados para pruebas sensibles.
- Cierra sesión cuando termines.
- Recarga la página si quieres limpiar la sesión.

---

## 📌 Recomendaciones para despliegue

- Usa HTTPS.
- Define `SESSION_SECRET` fuerte.
- No subas `.env`.
- Configura correctamente OAuth callback.
- Revisa logs para evitar imprimir secretos.
- Mantén dependencias actualizadas.
- Usa permisos mínimos cuando sea posible.
- Audita cambios antes de desplegar.
- Protege la cuenta de Google Cloud.
- Protege la OAuth App de GitHub.

---

## ✅ Resumen

El modelo de seguridad de GitHub AI Assistant se basa en:

- No persistir credenciales.
- Mantener al usuario en control.
- Validar antes de ejecutar.
- Confirmar antes de escribir.
- Reducir superficie del backend.
- Procesar archivos localmente cuando es posible.
- Documentar límites y riesgos.

La idea central es:

> **La IA puede acelerar el trabajo, pero no debe quitar control al usuario sobre sus repositorios y credenciales.**
