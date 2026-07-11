# ✨ Funcionalidades

**GitHub AI Assistant** no es un chatbot genérico: es una herramienta para **analizar, documentar, operar y publicar repositorios de GitHub mediante lenguaje natural**, manteniendo siempre el principio de seguridad:

> **Propón → Confirma → Ejecuta**

El usuario expresa lo que quiere hacer, la IA interpreta la intención, la aplicación valida la acción propuesta y solo se ejecuta si el usuario confirma.

---

## 🧭 Resumen por áreas

| Área | Funcionalidades |
|---|---|
| 💬 Lenguaje natural | Chat conversacional, acciones sobre GitHub y respuestas con contexto |
| ✅ Seguridad operativa | Confirmación previa, diff de cambios y validación de acciones |
| 🗂️ GitHub | Repositorios, archivos, ramas, commits, Draft PRs, Releases y multi-repo |
| 🤖 Documentación | README, MANUAL_TECNICO, documentación de archivos y changelog |
| 📎 Archivos locales | PDF, Word, Excel/CSV, Power BI, texto y código |
| 📝 Issues / PRs | Resumen de hilos con TL;DR, decisiones, pendientes y tono |
| 📊 Salud del código | Lenguajes, commits por semana y deuda técnica |
| 🌐 Experiencia | Streaming, detener generación, historial, export/import e i18n |
| 🔑 IA | Groq Cloud, Google Gemini, OpenRouter, NVIDIA NIM y Zenmux |

---

## 💬 Chat en lenguaje natural

La aplicación permite trabajar con GitHub escribiendo instrucciones normales, sin conocer comandos Git, endpoints de la API ni estructuras JSON.

Ejemplos:

> “Crea un repositorio público llamado `mi-proyecto`.”

> “Lista mis repositorios privados.”

> “Documenta este repo y prepara un Draft PR.”

> “Resume el issue `owner/repo#42`.”

> “Analiza este `.pbit` y dime qué hace el informe.”

La IA interpreta la intención y decide si debe responder en modo conversación o proponer una acción ejecutable.

---

## ✅ Panel de confirmación

Toda operación de escritura requiere confirmación explícita.

Antes de ejecutar una acción, la app muestra:

- Qué acción se va a realizar.
- Qué endpoint o servicio se va a usar.
- Qué datos se van a enviar.
- Qué repositorio o archivo se verá afectado.
- Si procede, una vista de diferencias antes/después.

Esto evita que la IA ejecute cambios directamente sin control humano.

---

## 🧩 Patrón `propón → confirma → ejecuta`

El flujo principal de seguridad es:

1. El usuario pide algo en lenguaje natural.
2. La IA propone una acción estructurada.
3. La app valida la propuesta.
4. El usuario revisa el plan.
5. El usuario acepta o cancela.
6. Solo entonces se ejecuta la acción.

Este patrón se aplica especialmente a operaciones como:

- Crear repositorios.
- Modificar archivos.
- Subir documentación.
- Crear ramas.
- Crear Draft Pull Requests.
- Crear Releases.
- Aplicar acciones a varios repositorios.

---

## ⚡ Respuestas en streaming

En modo conversación, las respuestas aparecen progresivamente, token a token, en lugar de mostrarse solo al final.

Esto mejora la sensación de fluidez cuando se generan respuestas largas, opiniones técnicas, documentación o análisis de archivos.

---

## ⏹️ Detener generación

Durante una respuesta larga, el usuario puede detener la generación en curso.

La aplicación conserva lo ya generado y permite continuar trabajando sin esperar a que termine toda la respuesta.

---

## 🗂️ Operaciones sobre GitHub

La app actúa como una capa conversacional sobre la **GitHub REST API v3**.

Permite trabajar con:

- Repositorios.
- Archivos.
- Ramas.
- Commits.
- Pull Requests.
- Issues.
- Releases.
- Comentarios.
- Árbol de archivos.
- Contenido de repositorios.

El usuario no necesita conocer los endpoints ni los payloads de GitHub.

---

## 🧱 Operaciones multi-repo

El modo multi-repo permite seleccionar varios repositorios y aplicar una misma acción a todos ellos.

Ejemplos:

- Añadir un archivo común.
- Crear documentación base.
- Aplicar una plantilla.
- Ejecutar una consulta.
- Revisar varios repositorios.

Las operaciones se ejecutan de forma controlada para evitar errores y respetar límites de API.

---

## 🤖 Documentación automática de repositorios

El asistente puede analizar un repositorio y generar documentación completa.

Genera, entre otros:

- `README.md`
- `MANUAL_TECNICO.md`

El análisis incluye archivos relevantes del proyecto y usa el contexto del repositorio para producir documentación coherente.

Opciones de publicación:

| Opción | Descripción |
|---|---|
| Commit directo | Publica los archivos generados directamente en la rama principal |
| Draft PR | Crea una rama nueva y abre un Pull Request revisable |
| GitHub Release | Usa la documentación como base para una publicación versionada |

---

## 📤 Documentar y publicar archivos

Además de documentar repositorios completos, la app permite adjuntar un archivo local, generar documentación sobre él y publicarla en GitHub.

Flujo típico:

1. Adjuntas un archivo.
2. Lo analizas mediante chat.
3. Pides generar documentación.
4. Revisas la vista previa.
5. Publicas como commit, Draft PR o Release.

La documentación generada puede incorporar el contexto de la conversación previa.

---

## 📦 Publicar archivo fuente y extras

Al documentar un archivo, también puedes publicar:

- El archivo original.
- Capturas de pantalla.
- Datasets.
- Archivos adicionales relacionados.

Convención de destino:

| Tipo de archivo | Destino sugerido |
|---|---|
| Imágenes / capturas | `screenshots/` |
| Datasets | `data/` |
| Otros archivos | raíz del repositorio o ruta indicada |

En Releases, estos archivos pueden adjuntarse como assets.

---

## 📎 Adjuntar archivos locales

La aplicación permite trabajar con archivos locales directamente desde el navegador.

Formatos soportados:

| Tipo | Extensiones |
|---|---|
| PDF | `.pdf` |
| Word | `.docx` |
| Excel | `.xlsx`, `.xls` |
| CSV | `.csv` |
| Power BI | `.pbix`, `.pbit` |
| Texto | `.txt`, `.md`, `.json`, `.yaml`, `.yml` |
| Código | extensiones habituales de código fuente |

Los archivos se leen en el navegador. No se suben a ningún servidor para ser procesados.

---

## 📄 PDF

Al adjuntar un PDF, la app extrae el texto y permite:

- Resumir el contenido.
- Preguntar sobre el documento.
- Generar documentación.
- Preparar una publicación en GitHub.

---

## 📝 Word `.docx`

Al adjuntar un documento Word, la app extrae el contenido textual del archivo y permite trabajar con él en lenguaje natural.

Casos de uso:

- Resumir informes.
- Convertir contenido en documentación.
- Analizar estructura.
- Publicar un resumen o manual en GitHub.

---

## 📊 Excel y CSV

La app permite adjuntar hojas de cálculo y trabajar con ellas conversacionalmente.

Puede analizar:

- Cabeceras.
- Hojas.
- Muestra de filas.
- Estructura general.
- Posibles usos del dataset.

Para archivos grandes, la app trabaja con una muestra representativa y avisa al usuario para no saturar la ventana de contexto del modelo.

---

## 📈 Power BI `.pbix` / `.pbit`

La app puede leer estructura de informes Power BI sin abrir Power BI Desktop.

Puede extraer y explicar:

- Páginas del informe.
- Visuales.
- Estructura del informe.
- Consultas de Power Query M.
- Orígenes y transformaciones.
- Modelo de datos en `.pbit`.
- Tablas.
- Columnas.
- Medidas DAX.

También informa de las limitaciones del formato `.pbix` cuando parte del modelo está en binario y no puede leerse completamente desde el navegador.

---

## 📝 Resumen de issues y Pull Requests

Puedes introducir una referencia como:

`owner/repo#42`

La app obtiene la conversación del issue o PR y genera un resumen estructurado:

- TL;DR.
- Puntos clave.
- Decisiones tomadas.
- Pendientes.
- Tono de la conversación.
- Comentarios relevantes.

En Pull Requests también puede incorporar comentarios de revisión.

---

## 📋 Generación automática de changelog

La app puede generar un changelog a partir de los commits de un repositorio.

Puede trabajar:

- Desde el último release.
- Con commits recientes si no hay releases.
- Agrupando cambios por tipo.
- Redactando notas comprensibles para usuario final.

Categorías habituales:

- Novedades.
- Correcciones.
- Documentación.
- Mantenimiento.
- Otros cambios.

---

## 📊 Salud del código

La función de salud del código abre un dashboard visual con métricas del repositorio.

Incluye:

- Distribución de lenguajes.
- Frecuencia de commits por semana.
- Deuda técnica basada en marcadores como `TODO`, `FIXME`, `HACK` o `XXX`.

El objetivo es dar una vista rápida del estado general del proyecto.

---

## 💾 Exportar e importar conversación

La aplicación permite exportar la conversación actual como JSON e importarla más tarde.

Esto permite recuperar contexto sin romper el principio Zero-Storage:

- Nada se guarda automáticamente.
- El usuario controla el archivo.
- La conversación puede restaurarse manualmente.
- No se usa base de datos ni almacenamiento persistente interno.

---

## 📋 Historial de sesión

La app mantiene un historial de acciones durante la sesión activa.

El historial muestra estados como:

- Completado.
- Error.
- Cancelado.
- Pendiente.

También puede exportarse para conservar un registro de trabajo.

---

## 📄 Plantillas predefinidas

Incluye plantillas para acelerar tareas frecuentes:

- README.
- `.gitignore`.
- Licencias.
- CI/CD.
- Documentación inicial.
- Instrucciones habituales para el chat.

Las plantillas se insertan en el chat y pueden adaptarse antes de ejecutarse.

---

## 🌐 Interfaz bilingüe ES/EN

La aplicación permite alternar entre español e inglés.

La internacionalización cubre:

- Login.
- Cabecera.
- Paneles.
- Chat.
- Modales.
- Diálogos.
- Historial.
- Plantillas.
- Mensajes visibles.
- Respuestas del modelo mediante directiva de idioma.

La infraestructura i18n es propia y no depende de librerías externas.

---

## 🔑 Multi-proveedor de IA

La app soporta varios proveedores de IA.

| Proveedor | Uso principal |
|---|---|
| Groq Cloud | Respuestas rápidas con modelos Llama |
| Google Gemini | Calidad de respuesta y documentación |
| OpenRouter | Acceso a múltiples modelos, gratuitos y de pago |
| NVIDIA NIM | Modelos optimizados (Nemotron, GLM, Llama) vía proxy |
| Zenmux | Pasarela con modelos gratuitos (Grok, GLM, Step) |

El usuario introduce su propia clave de API.

La app no guarda las claves en almacenamiento persistente.

---

## 🧠 Contexto de repositorio

El usuario puede cargar un repositorio como contexto activo del chat.

Esto permite que las respuestas se basen en el código real del proyecto y no en respuestas genéricas.

La app puede usar:

- Árbol completo de archivos.
- Archivos relevantes.
- Documentación existente.
- Código fuente.
- Configuración del proyecto.

---

## 🔎 Selección de contexto relevante

Para evitar saturar la ventana de contexto, la app selecciona archivos relevantes según la pregunta del usuario.

Esto permite:

- Responder sobre archivos concretos.
- Evitar negar archivos existentes por falta de contexto.
- Priorizar documentación raíz.
- Ajustar el contexto a modelos con diferentes límites.

---

## 🧪 Funcionalidades pensadas para calidad

Muchas funcionalidades están diseñadas no solo para funcionar, sino para reducir errores:

- Validación de acciones propuestas por IA.
- Reintentos ante errores transitorios.
- No reintentar errores no recuperables.
- Confirmación antes de escritura.
- Diff antes de modificar archivos.
- Mensajes de error en lenguaje claro.
- Manejo explícito de límites técnicos.

---

## 🧩 Filosofía de producto

El objetivo no es sustituir al desarrollador ni a GitHub Copilot.

El objetivo es ofrecer una capa conversacional para:

- Entender repositorios.
- Operar GitHub.
- Documentar proyectos.
- Publicar entregables.
- Automatizar tareas repetitivas.
- Mantener control humano sobre cada acción sensible.

GitHub AI Assistant está diseñado para que el usuario pueda trabajar con GitHub sin conocer todos los detalles técnicos de la API, pero sin perder seguridad ni control.
