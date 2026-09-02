# 🧠 Desarrollo asistido por IA

Este documento resume cómo se construyó **GitHub AI Assistant** mediante un flujo de trabajo humano ↔ IA.

El proyecto no se desarrolló siguiendo un proceso tradicional de programación desde cero, sino mediante una combinación de:

- criterio de producto,
- validación cruzada entre modelos,
- revisión crítica,
- pruebas reales,
- documentación continua,
- refactorización,
- testing,
- y uso intensivo de agentes de IA.

---

## 🎯 Contexto

**GitHub AI Assistant** fue construido en aproximadamente 30 días por un profesional de negocio sin experiencia previa en programación.

El objetivo no era solo “hacer una app que funcione”, sino comprobar hasta dónde puede llegar un flujo moderno de desarrollo asistido por IA cuando se combina con:

- curiosidad,
- pensamiento crítico,
- criterio de negocio,
- obsesión por la seguridad,
- documentación rigurosa,
- testing continuo,
- y capacidad de iterar rápido.

---

## 🧭 Idea principal

La idea central del proyecto fue crear un asistente capaz de operar sobre GitHub mediante lenguaje natural.

El usuario no tendría que conocer:

- GitHub REST API,
- endpoints,
- payloads,
- Base64,
- ramas,
- Pull Requests,
- Releases,
- comandos Git,
- ni detalles internos de autenticación.

En su lugar, podría pedir algo como:

```text
Documenta este repositorio y prepara un Draft PR.
```

O:

```text
Adjunta este informe Power BI, explícalo y publícalo como Release.
```

La aplicación traduciría esa intención en una acción controlada, revisable y confirmada por el usuario.

---

## 🧩 Principios rectores

Desde las primeras versiones, el proyecto se fue guiando por varios principios:

| Principio | Significado |
|---|---|
| Zero-Storage | No almacenar credenciales sensibles de forma persistente |
| Propón → Confirma → Ejecuta | La IA propone, pero el usuario decide |
| Backend thin | El servidor hace lo mínimo imprescindible |
| Multi-proveedor | No depender de un único modelo o API |
| Control humano | Ninguna acción sensible se ejecuta sin confirmación |
| Documentación viva | Cada decisión relevante queda registrada |
| Testing progresivo | Cada refactor importante se acompaña de pruebas |
| Validación cruzada | Las propuestas de IA se contrastan antes de aplicarse |
| Dogfooding | La app se usa para analizar y mejorar la propia app |

---

## 🧪 Hipótesis del proyecto

La hipótesis principal fue:

> Una persona sin experiencia previa en programación puede construir una aplicación full-stack real si usa IA como acelerador, pero mantiene criterio humano sobre arquitectura, seguridad, testing y producto.

El proyecto intenta demostrar que la IA no sustituye el criterio, sino que lo amplifica cuando se usa de forma crítica.

---

## 🛠️ Fase 1 — Prototipo en Google AI Studio

La primera versión nació como un prototipo construido directamente en **Google AI Studio**.

Características iniciales:

- Agente configurado mediante ingeniería de prompts.
- Autenticación mediante Personal Access Token.
- Ejecución directa sobre GitHub API.
- Sin panel de confirmación previa.
- Sin historial de sesión.
- Sin arquitectura Zero-Storage completa.
- Despliegue inicial en Cloud Run.

Esta fase sirvió para validar la idea:

> ¿Puede una IA traducir lenguaje natural en operaciones sobre GitHub?

La respuesta fue sí, pero también mostró riesgos importantes.

---

## ⚠️ Problemas detectados en el prototipo

El prototipo inicial era funcional, pero tenía limitaciones críticas:

- Ejecutaba acciones directamente.
- No mostraba un plan antes de escribir.
- No tenía un historial claro.
- Dependía demasiado del comportamiento del modelo.
- No separaba adecuadamente conversación y ejecución.
- No estaba diseñado con una capa de seguridad suficiente.
- No ofrecía una experiencia robusta para usuario final.

Esto llevó a rediseñar la aplicación desde cero como producto full-stack.

---

## 🏗️ Fase 2 — Diseño arquitectónico con Claude

La segunda fase consistió en pedir una revisión crítica del concepto y diseñar una arquitectura más segura.

Claude se utilizó como:

- arquitecto técnico,
- revisor de riesgos,
- asesor de seguridad,
- crítico del prototipo,
- y generador de plan de implementación.

De esta fase salieron decisiones clave:

- Backend Express mínimo.
- OAuth con GitHub.
- Panel de confirmación.
- Historial de sesión.
- Separación entre propuesta y ejecución.
- Multi-proveedor IA.
- Claves introducidas por el usuario.
- No almacenar credenciales de forma persistente.

---

## 🔐 Decisión clave: confirmación previa

Una de las decisiones más importantes fue que la IA no ejecutara directamente las acciones.

El flujo correcto sería:

```text
Usuario pide algo
  ↓
IA propone una acción
  ↓
Aplicación valida la acción
  ↓
Usuario revisa
  ↓
Usuario confirma
  ↓
Aplicación ejecuta
```

Este patrón se convirtió en una regla de producto:

> La IA puede acelerar, pero no debe quitar control al usuario.

---

## 🧱 Decisión clave: backend thin

Otra decisión fundamental fue mantener un backend mínimo.

El backend se limita a:

- OAuth GitHub.
- Callback OAuth.
- Proxy Gemini.
- Rate limiting.
- Health check.
- Servir frontend en producción.

No guarda:

- tokens,
- claves IA,
- conversaciones,
- repositorios,
- archivos,
- historial,
- ni datos de usuario.

Esta arquitectura reduce superficie de ataque y simplifica el despliegue.

---

## 🧪 Fase 3 — Construcción con Antigravity 2.0

La construcción inicial de la versión full-stack se realizó con un entorno de desarrollo agéntico.

A partir del prompt maestro y del diseño arquitectónico, se generó una estructura inicial similar a:

```text
github-ai-assistant/
├── client/
├── server/
└── Dockerfile
```

El frontend se construyó con:

- React,
- TypeScript,
- Vite,
- Context API,
- servicios separados,
- componentes modulares,
- tipos compartidos.

El backend se construyó con:

- Express,
- OAuth,
- sesiones,
- endpoints mínimos,
- proxy Gemini,
- health check.

---

## 🧯 Fase 4 — Corrección manual de errores

Durante las primeras pruebas aparecieron errores típicos de código generado por IA.

Ejemplos:

- Comentarios JSDoc que rompían compilación.
- Secuencias `*/` dentro de rutas que cerraban comentarios.
- Caracteres Unicode problemáticos en lugares inesperados.
- Imports muertos.
- Variables sin uso.
- Inconsistencias entre módulos.
- Bugs de UX.
- Problemas en móvil.
- Errores de flujo por detección de intención demasiado agresiva.

Estos errores fueron corregidos mediante:

- lectura de stack traces,
- revisión manual,
- pruebas locales,
- comparación entre modelos,
- y refactorización progresiva.

---

## 🔁 Fase 5 — Iteración rápida por versiones

El proyecto evolucionó mediante versiones pequeñas y frecuentes.

La evolución incluyó:

- OAuth completo.
- Gemini proxy.
- soporte Groq.
- soporte OpenRouter.
- testing con Vitest.
- Codecov.
- CI/CD.
- streaming.
- carga de archivos.
- PDF.
- Excel/CSV.
- Power BI.
- DOCX.
- documentación de repos.
- publicación como commit, Draft PR o Release.
- generación de changelog.
- resumen de issues/PRs.
- dashboard de salud del código.
- i18n ES/EN.
- export/import de conversación.
- mejoras de seguridad.
- mejoras de accesibilidad.
- refactors de mantenibilidad.

---

## 🧪 Fase 6 — Testing como herramienta de aprendizaje

El testing no se añadió solo como requisito técnico, sino como forma de entender mejor la aplicación.

La suite de tests ayudó a:

- detectar regresiones,
- entender dependencias,
- separar lógica de UI,
- refactorizar `App.tsx`,
- validar flujos complejos,
- comprobar errores,
- asegurar reglas de seguridad,
- y ganar confianza al iterar.

La cobertura fue creciendo conforme la lógica se movía a servicios, hooks y utilidades testeables.

---

## 🧩 Fase 7 — Refactorización de arquitectura

A medida que el proyecto crecía, se detectó que algunos componentes acumulaban demasiada lógica.

Se realizaron refactors para:

- extraer flujos a `assistantActions.ts`,
- separar publicación en `docPublisher.ts`,
- mover utilidades a `utils/`,
- centralizar tipos,
- mover prompts a archivos Markdown,
- crear servicios especializados,
- inyectar dependencias,
- reducir tamaño de componentes,
- y aumentar cobertura de tests.

El objetivo fue evitar que el proyecto se convirtiera en un prototipo difícil de mantener.

---

## 🧠 Fase 8 — Multi-modelo y validación cruzada

El proyecto se desarrolló con ayuda de varios modelos y herramientas.

La regla fue:

> Ninguna salida de una IA se acepta como verdad absoluta.

Cada propuesta se revisa según criterios como:

- ¿Respeta Zero-Storage?
- ¿Mantiene confirmación previa?
- ¿Es testeable?
- ¿Introduce deuda técnica?
- ¿Encaja con la arquitectura?
- ¿Aporta valor real al usuario?
- ¿Complica innecesariamente el producto?
- ¿Puede romper flujos existentes?

---

## 🤝 Herramientas e IAs utilizadas

| IA / herramienta | Rol principal |
|---|---|
| **Antigravity 2.0 / Gemini 3.7 Flash** | Modelo activo en v4.0.39 (2026-09-02): corrección de selección automática en Groq (priorización de `openai/gpt-oss-20b` sobre `qwen3.8-27b`), manejo de error de modelos bloqueados por límites de proyecto en consola Groq (`model_permission_blocked_project`) y etiquetas amigables. En v4.0.37: corrección de vulnerabilidad de sanitización incompleta multi-carácter (CWE-116) con `stripHtmlTags` iterativo en `gemini.ts`. Total: 1.324 tests unitarios en verde (1.264 cliente + 60 servidor) al 100% de líneas en `gemini.ts` y 100% de cobertura en diff patch para Codecov y sincronización documental completa |
| **ZCode / GLM-5.3** | Modelo activo en v4.0.34 (2026-08-16): expansión de cobertura Codecov (#26) con +30 tests sobre servicios sin testear — `gemini.ts` al 100% de líneas, `github.ts`/`docPublisher.ts`/`threadSummary.ts` al 100% en líneas y funciones; cobertura global 96,26% statements / 88,22% branches con 1.272 tests unitarios en verde, y sincronización documental integral |
| **Antigravity 2.0 / Gemini 3.7 Flash** | Entorno de desarrollo agéntico principal en el ciclo v4.0.32–v4.0.33: soporte de Gemini 3.7 Flash en catálogo nativo con 13 idiomas, sincronización documental integral, optimización de timeouts y ampliación sistemática de cobertura hacia el 100% en Codecov |
| **Antigravity 2.0 / Gemini 3.6 Flash** | Desarrollo agéntico previo desde v3.68.0: integración de nuevos proveedores (Kilo, BazaarLink), resolución de rate limiting 429 y mantenimiento de releases |
| **Claude / Claude Code** | Arquitectura, revisión crítica, documentación e implementación asistida |
| **Antigravity 2.0** | Construcción inicial agéntica de la versión full-stack |
| **ZCode / GLM-5.2** | Roadmap, cierre de versiones, documentación, releases e i18n |
| **Gemini 2.5 Flash** | Revisión de roadmap, validación de ideas y contraste técnico |
| **Gemma 4 31B** | Revisión de arquitectura y propuestas de mejora sobre gestión de contexto |
| **Groq / Llama** | Pruebas de velocidad, respuestas rápidas y validación de límites de contexto |
| **OpenRouter** | Acceso a múltiples modelos y validación cruzada |
| **DeepSeek** | Ideas, contraste técnico y propuestas de mejora |
| **Qwen** | Generación puntual de componentes y apoyo en implementación |
| **Manus** | Propuestas e ideas, algunas descartadas por introducir regresiones |
| **Microsoft 365 Copilot — GPT 5.5 Razonamiento** | Revisión editorial del README, propuesta de dividir la documentación en archivos específicos dentro de `docs/`, mejora de la narrativa de portfolio y reorganización de contenidos para hacer el proyecto más legible y presentable |

La aportación de cada IA se trató como una propuesta, no como una decisión automática. Las ideas se aceptaron, modificaron o descartaron según su coherencia con los principios del proyecto.


---

## 🚫 Ejemplo de propuesta rechazada

Una propuesta de mejora sugería usar IndexedDB para persistir memoria entre sesiones.

La idea se rechazó porque:

- contradecía Zero-Storage,
- podía almacenar información sensible,
- aumentaba superficie de ataque,
- y rompía el principio de no persistencia automática.

La idea se reformuló como:

> Exportar/importar conversación mediante un fichero JSON controlado por el usuario.

Así se conservó la utilidad sin romper el modelo de seguridad.

---

## 🔁 Dogfooding: usar la app para mejorar la propia app

Una parte importante del desarrollo de **GitHub AI Assistant** fue el uso de la propia aplicación para analizar, revisar y mejorar el repositorio `github-ai-assistant`.

Este proceso de dogfooding consistió en utilizar la herramienta como si fuera un usuario real, pero aplicada sobre su propio código fuente, documentación y roadmap.

---

## 🎯 Objetivo del dogfooding

El objetivo no era pedir elogios al modelo, sino comprobar si la app podía aportar valor real sobre un repositorio complejo.

En concreto, se buscaba validar si la aplicación podía:

- cargar el repositorio como contexto,
- entender su estructura,
- responder preguntas sobre arquitectura,
- revisar documentación existente,
- detectar carencias,
- proponer mejoras razonables,
- identificar límites técnicos,
- y ayudar a priorizar el roadmap.

---

## 🧪 Flujo aplicado

El flujo seguido fue:

```text
1. Cargar el repositorio github-ai-assistant como contexto.
2. Pedir una revisión crítica de arquitectura, seguridad, UX o roadmap.
3. Ejecutar la misma consulta con distintos modelos/proveedores.
4. Comparar respuestas.
5. Separar ideas útiles de elogios genéricos o propuestas incompatibles.
6. Reformular las propuestas válidas según los principios del proyecto.
7. Añadirlas al roadmap o implementarlas en versiones posteriores.
```

---

## 🤖 Modelos utilizados en el dogfooding

Durante el proceso se usaron distintos modelos y proveedores para contrastar resultados:

| Modelo / proveedor | Uso en dogfooding |
|---|---|
| **Gemma 4 31B vía OpenRouter** | Revisión de arquitectura y propuestas de mejora sobre gestión de contexto |
| **Gemini 2.5 Flash** | Revisión de roadmap, priorización y propuestas de mejora funcional |
| **Groq / Llama** | Pruebas de velocidad y validación de límites de contexto en modelos rápidos |
| **Microsoft 365 Copilot — GPT 5.5 Razonamiento** | Revisión editorial del README, propuesta de modularización documental y separación del contenido en archivos específicos dentro de `docs/` |

---

## 📌 Hallazgo 1: el contexto inicial era insuficiente

Durante las primeras pruebas, la app podía analizar parte del repositorio, pero no siempre cargaba o priorizaba correctamente documentos importantes como:

- `README.md`,
- `CHANGELOG.md`,
- `MANUAL_TECNICO.md`,
- `MEJORAS_FUTURAS.md`,
- archivos raíz de documentación.

Esto provocaba que el asistente pudiera responder de forma incompleta o incluso negar la existencia de archivos que sí estaban en el repositorio.

---

## 🛠️ Mejora derivada: ranking de contexto

A partir de ese problema, se reforzó la gestión del contexto del repositorio.

La mejora consistió en:

- exponer el árbol completo de archivos,
- priorizar documentación raíz,
- seleccionar archivos relevantes según la pregunta,
- usar ranking léxico en memoria,
- ampliar el límite de archivos analizados,
- y evitar que el modelo negara archivos que estaban en la estructura pero no se habían cargado completos.

Esta mejora convirtió el análisis del repositorio en un flujo más fiable.

---

## 📌 Hallazgo 2: no todos los modelos soportan el mismo contexto

Al probar la app con diferentes modelos, se observó que algunos proveedores o modelos gratuitos no podían manejar la misma cantidad de contexto.

Esto permitió detectar una necesidad real:

> El presupuesto de contexto debe adaptarse al proveedor y al modelo activo.

Este hallazgo reforzó la idea de que la app no debía asumir que todos los modelos tienen la misma capacidad, velocidad o tolerancia a prompts largos.

---

## 📌 Hallazgo 3: algunas propuestas de IA eran útiles, pero no directamente aplicables

Durante las revisiones, varios modelos propusieron mejoras interesantes, pero algunas chocaban con los principios del proyecto.

Ejemplo:

```text
Propuesta: persistir memoria en IndexedDB.
Problema: contradice Zero-Storage.
Resultado: se descarta la persistencia automática y se reformula como export/import manual de conversación.
```

Esto confirmó una regla importante:

> Una propuesta de IA puede ser buena en abstracto, pero incorrecta para una arquitectura concreta.

---

## 📌 Hallazgo 4: el README era demasiado denso

Al revisar la documentación principal, se detectó que el `README.md` contenía demasiadas funciones a la vez:

- presentación del producto,
- instalación,
- arquitectura,
- seguridad,
- testing,
- proceso de desarrollo,
- metodología IA,
- comparación con Copilot,
- roadmap,
- narrativa personal.

El contenido era valioso, pero la primera lectura resultaba demasiado pesada.

---

## 🛠️ Mejora derivada: documentación modular

A partir de esa revisión, se propuso separar la documentación en dos niveles:

1. Un `README.md` más corto, visual y orientado a impacto.
2. Una carpeta `docs/` con documentación extendida.

Estructura resultante:

```text
docs/
├── FUNCIONALIDADES.md
├── COMPARATIVA_COPILOT.md
├── INSTALACION.md
├── ARQUITECTURA.md
├── SEGURIDAD.md
├── TESTING_CALIDAD.md
└── DESARROLLO_IA.md
```

La idea fue:

> El README como escaparate.  
> La carpeta `docs/` como documentación técnica y metodológica extendida.

---

## ✅ Criterios para aceptar una propuesta surgida del dogfooding

No todas las propuestas generadas por IA se incorporaron.

Cada idea se revisó según estos criterios:

| Criterio | Pregunta |
|---|---|
| Seguridad | ¿Respeta Zero-Storage? |
| Control humano | ¿Mantiene confirmación previa? |
| Mantenibilidad | ¿Reduce o aumenta complejidad? |
| Testabilidad | ¿Puede probarse de forma fiable? |
| Coherencia | ¿Encaja con la arquitectura existente? |
| Valor de usuario | ¿Resuelve un problema real? |
| Simplicidad | ¿Evita añadir funcionalidad innecesaria? |
| Roadmap | ¿Tiene sentido ahora o debe aplazarse? |

---

## 🧠 Valor del dogfooding

El dogfooding aportó valor en varios niveles:

- validó que la app podía analizar repos reales,
- reveló límites de contexto,
- ayudó a mejorar el ranking de archivos,
- generó ideas de roadmap,
- mejoró la documentación,
- permitió comparar proveedores,
- detectó problemas de UX,
- y reforzó la narrativa del proyecto como herramienta práctica.

---

## 🚫 Qué se descartó

También se descartaron ideas que no encajaban.

Ejemplos de propuestas descartadas o reformuladas:

- Persistencia automática con IndexedDB.
- Memoria de usuario incompatible con Zero-Storage.
- Funciones que requerían backend con base de datos.
- Cambios que complicaban demasiado el flujo principal.
- Propuestas demasiado genéricas sin valor inmediato.
- Elogios del modelo sin acciones concretas.

---

## 📚 Resultado

El dogfooding permitió que GitHub AI Assistant evolucionara usando su propio caso de uso como prueba real.

El proyecto no solo fue construido con IA, sino que fue revisado, documentado y mejorado mediante la propia herramienta.

En resumen:

> **La app se usó para entenderse, criticarse y mejorarse a sí misma.**

---

## 🌐 Internacionalización

La i18n se añadió en varias fases.

Se tradujeron:

- login,
- cabecera,
- panel IA,
- chat,
- botones,
- modales,
- visor de diferencias,
- mensajes visibles,
- historial,
- plantillas,
- y directivas de idioma para respuestas IA.

La infraestructura se creó sin librerías externas de i18n.

---

## 🔐 Evolución de seguridad

El proyecto fue endureciendo su seguridad con el tiempo.

Mejoras relevantes:

- OAuth con `state`.
- `SESSION_SECRET` obligatorio en producción.
- `crypto.randomUUID()` para IDs y state.
- Rate limiting en proxy Gemini.
- Validación estricta de acciones IA.
- Rechazo de endpoints absolutos.
- Allowlist de métodos.
- Confirmación previa.
- Diff antes de modificar.
- Zero-Storage completo.
- No persistencia de claves IA.
- No persistencia de token GitHub.

---

## 🧪 Evolución de calidad

El proyecto pasó de una app funcional a una app con una suite amplia de pruebas.

Áreas cubiertas:

- autenticación,
- IA,
- GitHub API,
- acciones,
- publicación,
- adjuntos,
- PDF,
- Excel,
- Power BI,
- DOCX,
- changelog,
- issues/PRs,
- salud del código,
- modales,
- i18n,
- streaming,
- cancelación,
- seguridad,
- rate limiting.

---

## 📚 Documentación como parte del producto

La documentación no se trató como algo secundario.

El proyecto incluye:

- `README.md`,
- `CHANGELOG.md`,
- `MANUAL_TECNICO.md`,
- `MEJORAS_FUTURAS.md`,
- `METODOLOGIA_IA.md`,
- `CLAUDE.md`,
- documentación en `docs/`.

La documentación cumple varias funciones:

- explicar el producto,
- registrar decisiones,
- mantener continuidad entre sesiones,
- guiar a agentes IA,
- facilitar revisión externa,
- y mostrar evolución del proyecto.

---

## 🗂️ Reestructuración documental con Microsoft 365 Copilot

En una fase posterior del proyecto, se revisó el README completo con **Microsoft 365 Copilot — GPT 5.5 Razonamiento** para mejorar su claridad como pieza de portfolio.

El README original contenía mucha información valiosa, pero concentraba demasiados objetivos en un único archivo:

- presentación del producto,
- explicación técnica,
- arquitectura,
- seguridad,
- testing,
- metodología IA,
- comparación con GitHub Copilot,
- proceso formativo,
- roadmap,
- y narrativa personal.

La recomendación fue separar el contenido en dos niveles:

1. Un `README.md` más breve, visual y orientado a impacto.
2. Documentación extendida en la carpeta `docs/`.

La estructura propuesta fue:

```text
docs/
├── FUNCIONALIDADES.md
├── COMPARATIVA_COPILOT.md
├── INSTALACION.md
├── ARQUITECTURA.md
├── SEGURIDAD.md
├── TESTING_CALIDAD.md
└── DESARROLLO_IA.md
```

Esta reorganización permitió:

- reducir la carga cognitiva del README,
- mantener los badges y el impacto visual inicial,
- separar documentación técnica de narrativa de producto,
- hacer más fácil la revisión por reclutadores o evaluadores,
- mejorar la mantenibilidad documental,
- y presentar el proyecto como una aplicación más madura y profesional.

La idea no fue eliminar contenido, sino colocarlo en el lugar adecuado:

> El README como escaparate.  
> La carpeta `docs/` como documentación extendida.


---

## 🧭 Rol humano en el proceso

Aunque la IA generó y revisó gran parte del trabajo, el papel humano fue clave en:

- definir el problema,
- decidir prioridades,
- aceptar o rechazar propuestas,
- probar la app,
- detectar fallos,
- validar experiencia de usuario,
- exigir seguridad,
- mantener coherencia,
- y orientar el producto.

La IA aceleró el proceso, pero no sustituyó la responsabilidad de decidir.

---

## 🧩 Lo aprendido

Lecciones principales:

- La IA puede construir mucho, pero también rompe cosas.
- Los tests son esenciales para iterar rápido.
- La documentación ayuda a mantener continuidad.
- Varias IAs dan mejores resultados que una sola.
- Las propuestas deben contrastarse.
- La seguridad debe diseñarse desde el principio.
- Menos backend puede significar menos riesgo.
- No toda mejora técnica mejora el producto.
- La experiencia de usuario importa tanto como la arquitectura.
- Saber decir “no” a una propuesta de IA es tan importante como saber pedirle código.

---

## 🧪 De negocio a ingeniería de IA

Este proyecto refleja una transición:

De un perfil de negocio sin experiencia previa en programación a la construcción de una aplicación full-stack funcional, desplegada y testeada.

No demuestra necesariamente dominio senior tradicional de ingeniería de software, pero sí demuestra:

- capacidad de aprendizaje acelerado,
- criterio de producto,
- uso estratégico de IA,
- pensamiento crítico,
- documentación,
- iteración,
- y orientación a calidad.

---

## 💬 Frase que resume el proyecto

> *“No soy ingeniero de software. Soy un profesional de negocio que ha aprendido a construir productos de IA pensando como un ingeniero.”*

---

## ✅ Resumen

GitHub AI Assistant es tanto una aplicación como un experimento práctico sobre desarrollo moderno asistido por IA.

La conclusión principal es:

> La IA permite construir más rápido, pero el valor real aparece cuando se combina con criterio humano, validación cruzada, testing, documentación y principios claros de arquitectura.
