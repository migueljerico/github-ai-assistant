# 🧪 Testing y calidad

**GitHub AI Assistant** utiliza una estrategia de testing progresiva basada en **Vitest**, **React Testing Library**, mocks de APIs externas, CI/CD y monitorización de cobertura con **Codecov**.

El objetivo no es solo comprobar que la aplicación funciona, sino reducir regresiones en una app que integra:

- GitHub REST API.
- OAuth.
- Proveedores de IA.
- Streaming.
- Adjuntos locales.
- Publicación en GitHub.
- Modales de confirmación.
- i18n.
- Seguridad Zero-Storage.

---

## 📊 Estado actual

| Métrica | Estado |
|---|---|
| Tests cliente | 476 |
| Archivos de test | 48 archivos `.test.ts(x)` |
| Framework principal | Vitest |
| Testing de componentes | React Testing Library |
| Cobertura | Monitorizada con Codecov |
| CI | GitHub Actions |
| CD | Cloud Build + Cloud Run |
| Servidor | Tests específicos para endpoints y rate limiting |

---

## 🏷️ Badge de cobertura

https://codecov.io/gh/migueljerico/github-ai-assistant/branch/main/graph/badge.svg](https://codecov.io/gh/migueljerico/github-ai-assistant)

> El porcentaje exacto de cobertura puede variar según la rama y los módulos añadidos. El badge de Codecov muestra el estado actualizado.

---

## ▶️ Ejecutar tests

Desde el directorio del cliente:

```bash
cd client
npm run test
```

---

## ▶️ Ejecutar tests una sola vez

```bash
cd client
npm run test:run
```

---

## 📈 Ejecutar tests con cobertura

```bash
cd client
npm run test:coverage
```

---

## 🧹 Lint

Si el script de lint está disponible:

```bash
cd client
npm run lint
```

---

## 🧱 Tipos de tests

La aplicación combina varios niveles de prueba.

| Tipo | Objetivo |
|---|---|
| Unitarios | Validar funciones puras, parsers, utilidades y servicios aislados |
| Integración | Validar contextos, flujos y coordinación entre módulos |
| Componentes | Validar interacción de usuario y renderizado |
| Servicios | Mockear GitHub API y proveedores IA |
| Seguridad | Validar acciones, endpoints, credenciales y rate limiting |
| Regresión | Cubrir bugs reales detectados durante el desarrollo |
| Accesibilidad | Validar foco, cierre con Escape y comportamiento de modales |

---

## 🧪 Áreas testeadas

### Autenticación

Tests relacionados con:

- `AuthContext`.
- Login OAuth.
- Login con PAT.
- Logout.
- Validación de usuario.
- Gestión del token en memoria.
- Ausencia de persistencia no deseada.

---

### Proveedores de IA

Tests relacionados con:

- `AIProviderContext`.
- Selección de proveedor.
- Validación de clave.
- Conexión y desconexión.
- Preferencias no sensibles.
- Modelos disponibles.
- Errores de proveedor.
- Manejo de cuota o credenciales inválidas.

---

### Registro de proveedores

Tests relacionados con:

- Configuración de proveedores.
- Transporte OpenAI-compatible.
- Gemini vía proxy.
- Groq directo.
- OpenRouter directo.
- Modelos por defecto.
- Validación de proveedores soportados.

---

### GitHub API

Tests relacionados con:

- `github.ts`.
- Obtener usuario.
- Listar repositorios.
- Crear repositorios.
- Leer archivos.
- Crear o actualizar archivos.
- Crear ramas.
- Crear Pull Requests.
- Crear Releases.
- Obtener commits.
- Obtener issues y PRs.
- Paginación.
- Manejo de errores.
- Utilidades Base64.

---

### Ejecución de acciones

Tests relacionados con:

- `actionExecutor.ts`.
- Métodos HTTP permitidos.
- Resolución de placeholders.
- Validación de endpoints.
- Rechazo de métodos inválidos.
- Rechazo de endpoints externos.
- Ejecución multi-repo.
- Formateo de resultados.

---

### Parsing de acciones IA

Tests relacionados con:

- `parseGeminiAction`.
- Extracción de JSON.
- Respuestas conversacionales.
- Acciones inválidas.
- Allowlist de métodos.
- Allowlist de tipos.
- Validación de endpoints relativos.
- Rechazo de URLs absolutas.

---

### Orquestación del asistente

Tests relacionados con:

- `assistantActions.ts`.
- `runSend`.
- `runConfirmAction`.
- `runCancelAction`.
- `runDocumentRepo`.
- `runLoadRepoContext`.
- `runSummarizeThread`.
- `runGenerateChangelog`.
- `runAttachFile`.
- `runGenerateFileDoc`.
- `runPublishFileDoc`.
- `runCodeHealth`.

---

### Publicación de documentación

Tests relacionados con:

- `docPublisher.ts`.
- Commit directo.
- Draft Pull Request.
- Publicación de README.
- Publicación de `MANUAL_TECNICO.md`.
- Actualización de archivos existentes.
- Uso de SHA.
- Publicación de documentación de archivo.
- Gestión de repos inexistentes.

---

### Releases

Tests relacionados con:

- `releaseGenerator.ts`.
- Creación de GitHub Releases.
- Versión sugerida.
- Release notes.
- Assets.
- Archivo fuente adjunto.
- Archivos extra.

---

### Resumen de issues y Pull Requests

Tests relacionados con:

- `threadSummary.ts`.
- Parseo de referencias `owner/repo#42`.
- Issues.
- Pull Requests.
- Comentarios.
- Comentarios de revisión.
- Limpieza de respuestas.
- Hilos vacíos.
- Errores de API.

---

### Generación de changelog

Tests relacionados con:

- Clasificación de commits.
- Agrupación por tipo.
- Último release.
- Commits recientes.
- Limpieza de merges.
- Generación de texto final.
- Errores de repositorio.

---

### Contexto de repositorio

Tests relacionados con:

- Construcción de contexto.
- Árbol completo de archivos.
- Priorización de documentación raíz.
- Ranking de archivos relevantes.
- Selección por pregunta.
- Evitar negar archivos existentes sin contenido cargado.
- Control de tamaño de contexto.

---

### Adjuntos locales

Tests relacionados con:

- Validación de extensión.
- Validación de tamaño.
- Lectura de archivos.
- Errores por archivo vacío.
- Errores por formato no soportado.
- Contexto de archivo activo.
- Interacción con chat.

---

### PDF

Tests relacionados con:

- `pdfReader.ts`.
- Extracción de texto.
- Fallbacks.
- PDFs sin texto.
- Errores de lectura.
- Truncado.

---

### Word `.docx`

Tests relacionados con:

- `docxReader.ts`.
- Extracción de texto desde OOXML.
- Párrafos.
- Tablas.
- Entidades XML.
- Truncado.
- Errores de formato.

---

### Excel y CSV

Tests relacionados con:

- `spreadsheetReader.ts`.
- Lectura de `.xlsx`.
- Lectura de `.xls`.
- Lectura de `.csv`.
- Múltiples hojas.
- Cabeceras.
- Muestra de filas.
- Archivos vacíos.
- Truncado para datasets grandes.

---

### Power BI

Tests relacionados con:

- `powerbiReader.ts`.
- Lectura de `.pbix`.
- Lectura de `.pbit`.
- Report layout.
- Páginas.
- Visuales.
- DataModelSchema.
- Tablas.
- Columnas.
- Medidas DAX.
- Power Query M.
- DataMashup.
- Avisos honestos cuando el modelo no es legible.
- ZIP corrupto.
- Caps de contenido.

---

### Salud del código

Tests relacionados con:

- `codeHealth.ts`.
- Distribución de lenguajes.
- Commits por semana.
- Marcadores de deuda técnica.
- `TODO`.
- `FIXME`.
- `HACK`.
- `XXX`.
- Dashboard.
- Estados de carga y error.

---

### Export/import de conversación

Tests relacionados con:

- `conversationIO.ts`.
- Serialización.
- Parseo.
- Round-trip.
- Restaurar timestamps.
- Descartar estados temporales.
- JSON inválido.
- Nombre de fichero.
- Recuperación de contexto.

---

### Componentes React

Tests relacionados con:

- `ChatArea`.
- `ChatInput`.
- `ChatMessage`.
- `ConfirmModal`.
- `DocModal`.
- `FilePublishModal`.
- `PublishActions`.
- `FileAttachButton`.
- `Header`.
- `TemplatePanel`.
- `AIProviderPanel`.
- `AIProviderBadge`.
- `RepoContextButton`.
- `ThreadSummaryButton`.
- `CodeHealthButton`.
- `CodeHealthModal`.
- `ConversationIOButton`.

---

### Accesibilidad

Tests relacionados con:

- `ErrorBoundary`.
- `useModalDialog`.
- Cierre con `Esc`.
- Focus trap.
- Restauración de foco.
- `aria-labelledby`.
- `role`.
- Comportamiento de modales.

---

### Streaming y cancelación

Tests relacionados con:

- Streaming SSE.
- Acumulación de tokens.
- `AbortController`.
- Cancelación de generación.
- No reintentar cancelaciones.
- Mantener texto parcial.
- No mostrar error falso tras detener.

---

### i18n

Tests relacionados con:

- `LanguageContext`.
- Función `t()`.
- Interpolación.
- Cambio ES/EN.
- Modales traducidos.
- Chat traducido.
- Plantillas traducidas.
- Historial traducido.
- Directiva de idioma en prompts.

---

## 🔁 Tests de regresión

Una parte importante de la suite cubre bugs reales encontrados durante el desarrollo.

Ejemplos de regresiones cubiertas:

- El chat saltaba a modo acción cuando había archivo adjunto.
- El asistente negaba archivos que existían en el árbol del repo.
- El selector de modelos no abría por problemas de overlay.
- El layout móvil quedaba tapado por paneles.
- La documentación inventaba autor o año.
- Repos inexistentes devolvían errores poco útiles.
- Algunos modelos devolvían respuestas vacías.
- Acciones inválidas se proponían como ejecutables.
- Endpoints absolutos no debían aceptarse.
- Tests rotos tras migrar a i18n.
- Modales sin foco correctamente gestionado.

---

## 🧪 Testing del servidor

El backend también incluye pruebas específicas.

Áreas cubiertas:

- Proxy Gemini.
- Rate limiting.
- Health check.
- Configuración crítica.
- Comportamiento básico de endpoints.

---

## 🤖 Mocks

Para evitar llamadas reales durante los tests se usan mocks de:

- GitHub API.
- Proveedores IA.
- `fetch`.
- `sessionStorage` cuando aplica.
- Archivos locales.
- Respuestas SSE.
- Navegador.
- Eventos de usuario.

Esto permite validar flujos complejos sin depender de servicios externos.

---

## 🚦 CI

El pipeline de CI ejecuta comprobaciones automáticas en cada push o Pull Request a `main`.

Tareas habituales:

```text
Instalar dependencias
Ejecutar lint
Ejecutar tests del cliente
Generar cobertura
Subir cobertura a Codecov
Ejecutar tests del servidor
```

---

## ☁️ CD

El despliegue continuo usa Cloud Build y Google Cloud Run.

Flujo general:

```text
Push a main
  ↓
Build del Dockerfile
  ↓
Build del frontend
  ↓
Servidor Express prepara producción
  ↓
Deploy a Cloud Run
```

---

## 📈 Evolución de la cobertura

La cobertura fue creciendo de forma progresiva conforme la lógica se extrajo a módulos testeables.

Evolución general:

| Etapa | Resultado |
|---|---|
| Infraestructura inicial | Vitest + Codecov |
| Primera cobertura base | Contextos, servicios y componentes principales |
| Refactor de App | Lógica movida a `assistantActions.ts` y utilidades testeables |
| Adjuntos locales | Tests para PDF, Excel, Power BI y DOCX |
| Seguridad | Validación de acciones, endpoints y rate limiting |
| UX avanzada | Streaming, cancelación, modales e i18n |
| Estado actual | 476 tests cliente |

---

## 🧱 Diseño para testabilidad

El proyecto fue refactorizado para mejorar testabilidad.

Decisiones clave:

- Extraer lógica fuera de `App.tsx`.
- Crear servicios especializados.
- Usar funciones puras en `utils/`.
- Inyectar dependencias en flujos complejos.
- Separar componentes visuales de lógica.
- Evitar hardcoding de proveedores.
- Centralizar tipos.
- Hacer prompts más mantenibles.

---

## ✅ Buenas prácticas aplicadas

- Tests cerca del código.
- Mocks para servicios externos.
- Casos felices y casos de error.
- Cobertura de regresiones reales.
- CI en cada push/PR.
- Cobertura monitorizada.
- Componentes testeados con interacción.
- Utilidades puras testeables.
- Separación de responsabilidades.
- Refactors acompañados de tests.

---

## ⚠️ Límites actuales

Aunque la suite es amplia, hay áreas que podrían seguir mejorando:

- Tests E2E completos en navegador real.
- Tests contra sandbox real de GitHub.
- Tests visuales de regresión.
- Auditoría automatizada de accesibilidad más profunda.
- Tests de carga.
- Tests de seguridad más avanzados.
- Validación con usuarios externos.

---

## 🧭 Próximas mejoras posibles

Ideas futuras para reforzar calidad:

- Añadir Playwright o Cypress para E2E.
- Crear fixtures realistas de repositorios.
- Añadir tests visuales para modales y dashboards.
- Medir rendimiento de lectura de archivos grandes.
- Añadir pruebas de accesibilidad automatizadas.
- Crear tests de contrato para proveedores IA.
- Añadir matriz de compatibilidad de navegadores.

---

## ✅ Resumen

La estrategia de testing de GitHub AI Assistant busca asegurar que una aplicación basada en IA siga siendo:

- Predecible.
- Revisable.
- Mantenible.
- Segura.
- Testeable.
- Resistente a regresiones.

La idea principal es:

> **Si una IA puede proponer acciones sobre GitHub, la aplicación debe validar, probar y controlar cuidadosamente cada paso antes de ejecutarlo.**
