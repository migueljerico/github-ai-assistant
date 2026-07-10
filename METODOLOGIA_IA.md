# 🤝 Metodología de trabajo con Asistentes de IA

Cómo se **colabora** en este proyecto humano↔IA: el flujo, las convenciones de
colaboración y la trazabilidad de qué hace cada asistente. Es la **memoria
operativa** que permite que el trabajo continúe coherentemente entre sesiones,
herramientas y modelos distintos.

> **Idioma:** este documento va en **español** (como el resto de la prosa del
> proyecto; ver `CLAUDE.md §5`). Las instrucciones a un asistente en el chat de la
> sesión también van en castellano.

> **Relación con otros documentos y jerarquía canónica:**
>
> El proyecto tiene **dos capas documentales**. Si hay discrepancia entre ellas,
> **la capa interna es la fuente de verdad**; la externa se actualiza a partir de ella.
>
> **Capa interna (canónica, para asistentes y mantenedores):**
> - [`CLAUDE.md`](./CLAUDE.md) → **cómo está hecho** el código (guía técnica:
>   arquitectura, comandos, convenciones, trampas).
> - [`MEJORAS_FUTURAS.md`](./MEJORAS_FUTURAS.md) → **qué queda por hacer**
>   (roadmap, estado de issues por versión).
> - [`CONTRIBUTING.md`](./CONTRIBUTING.md) → **cómo contribuir** (reglas de PR,
>   Zero-Storage, estilo).
> - [`MANUAL_TECNICO.md`](./MANUAL_TECNICO.md) → referencia técnica histórica
>   (parcialmente cubierta por `CLAUDE.md`, se conserva por completitud).
> - **Este documento** → **cómo trabajamos juntos** (el proceso de colaboración).
>
> **Capa externa (portfolio / público, orientada al lector final):**
> - [`README.md`](./README.md) y la carpeta [`docs/`](./docs/) (`ARQUITECTURA.md`,
>   `DESARROLLO_IA.md`, `FUNCIONALIDADES.md`, `INSTALACION.md`, `SEGURIDAD.md`,
>   `TESTING_CALIDAD.md`, `COMPARATIVA_COPILOT.md`) → son la "ventana al exterior",
>   más narrativas y extensas. **Reorganizadas por GPT 5.5 en v3.22.1.**
>
> **Regla práctica:** al tocar una convención técnica o de seguridad en la capa
> interna (p. ej. `CLAUDE.md §5`), recordar que `docs/SEGURIDAD.md`,
> `docs/ARQUITECTURA.md` y el `README.md` la parafrasean y puede que necesiten
> actualizarse para no divergir. La capa interna manda; la externa se deriva.

---

## 1. Filosofía de la colaboración

El proyecto se construye íntegramente **con** asistencia de IA, pero bajo
**supervisión humana constante**. No es "la IA hace y se acepta": es un diálogo.

- **El autor decide, la IA propone y ejecuta.** Toda decisión de producto,
  arquitectura o alcance la toma el autor. La IA investiga, planifica y propone;
  el autor aprueba antes de cualquier cambio.
- **Propón → apruebo → ejecutas.** Extiende al chat la misma garantía que la app
  aplica a la GitHub API (*propón→confirmar→ejecutar*). **Excepción desde v3.23.2:
  push a `main` + tag anotado + GitHub release se hacen de forma automática al
  cerrar una gestión** (lo pidió el autor expresamente para no frenar el ciclo).
  Los cambios irreversibles sobre el repo —merge de ramas que tocan orquestación,
  borrado de ramas/archivos, envío de contenido a servicios externos— **siguen
  esperando confirmación explícita**. El **deploy a Cloud Run (vía Cloud Build)**
  se dispara automáticamente gracias a un trigger configurado que se activa con
  cada push a `main` o tag, por lo que tampoco requiere confirmación manual.
- **Honestidad por encima de elogios.** Si algo falla, se dice con la salida real
  del comando. Si un paso se saltó, se declara. No se infla lo conseguido. Las
  revisiones externas (otras IAs) se filtran: se incorpora lo accionable, se
  reformula lo dudoso y **se descartan los elogios** (ver § dogfooding del README).

---

## 2. Flujo de trabajo por iteración

Cada incremento de valor sigue este ciclo, independientemente del asistente o la
sesión:

1. **Entender el contexto.** Cargar `CLAUDE.md` (guía técnica) y el estado actual
   del repo (rama `main`, versión, `MEJORAS_FUTURAS.md`). **No dar nada por hecho**:
   verificar versión, ramas existentes y divergencias antes de asumir nada.
2. **Investigar antes de proponer.** Explorar el código real (no inventar firmas,
   archivos ni patrones). Si un cambio toca la capa de orquestación
   (`assistantActions.ts`) o el backend (`server/index.js`), tratar con cuidado
   extra — son cohesivos y deliberados, no deuda técnica.
3. **Planificar y aprobar.** Presentar un plan concreto (archivos, enfoque,
   verificación) y esperar aprobación. Usar `EnterPlanMode` para tareas no
   triviales; `AskUserQuestion` solo para decisiones reales del usuario, no para
   validar lo obvio.
   - **⚠️ Aviso de límite de sesión/tokens (rector, v3.22.1):** antes de empezar
     a ejecutar, estimar si la tarea cabe en el presupuesto de tokens/tiempo de
     la sesión. Si existe riesgo razonable de quedarse a medias, **avisar al
     autor antes de tocar nada** y proponer dividir o reordenar el trabajo. **No
     iniciar una ejecución que se pueda quedar a mitad** — un cambio a medias
     (rama sin merge, código sin verificar, docs sin commitear) es peor que no
     empezar. Si la sesión se corta a pesar de todo, dejar el estado del repo en
     un punto coherente y comunicado.
   - **🪙 Economía de contexto (rector, v3.22.3) — el contexto de la sesión es
     finito y caro; gastarlo bien prolonga lo que da de sí cada sesión:**
     1. **Subagentes para investigar, no para volcar.** Delegar la exploración
        amplia (barrer muchos archivos, buscar patrones) a un subagente
        `Explore`, **pidiendo explícitamente un informe compacto**: solo
        conclusiones + líneas/rutas exactas, sin transcriptciones de archivos
        enteros. El subagente gasta SU contexto, no el de la sesión principal.
     2. **Lecturas selectivas.** `Read` con `offset`/`limit` o `grep -n` antes
        que leer un archivo completo de 800 líneas. Releer lo que ya está en
        contexto es derroche.
     3. **Outputs filtrados.** Tras `build`/`test:run`, leer solo el resumen
        (`grep "Tests "`) en vez de todo el log. Redirigir a fichero temporal y
        `grep`ear es más barato que volcar stdout.
     4. **Paralelizar con criterio.** Varios `Explore` en paralelo solo si
        investigan cosas **distintas**; si se solapan, uno basta.
     5. **Dividir el cierre.** El "fix de código commiteado" ya está a salvo.
        Desde v3.23.2, **push a `main` + tag + GitHub release se hacen
        automáticamente** al cerrar la gestión (no necesitan confirmación); el
        **deploy a Cloud Run (vía Cloud Build)** también se dispara automáticamente
        gracias a un trigger configurado que se activa con cada push a `main` o tag,
        por lo que tampoco requiere visto bueno del autor.
4. **Ejecutar en una rama** nacida de `main` actualizado (trunk-based). Commits
   atómicos con Conventional Commits.
5. **Verificar** antes de pushear: `npm run build` (tsc estricto), `npm run lint`
   (0 errores), `npm run test:run` (suite completa verde). Reportar los números
   reales.
6. **Cerrar la gestión** (rutina automática desde v3.23.2, ver §2 "Rutina de
   cierre"): bump + `CHANGELOG.md` + commit + **push a `main`** + **tag
   anotado** + **GitHub release** + **mensaje de handoff**. El deploy a
   Cloud Run (vía Cloud Build) se dispara automáticamente gracias a un
   trigger configurado que se activa con cada push a `main` o tag.

### Puntos de parada (siempre confirmar antes de)

- **Merge de ramas** que tocan la capa de orquestación.
- **Borrado de ramas o archivos** del repo.
- **Enviar contenido a servicios externos** (se publica, puede indexarse).

### Rutina de cierre (automática desde v3.23.2)

Al cerrar una gestión (fix, feature, iteración con tests verdes y build limpio),
el asistente ejecuta **sin pedir permiso**:

1. **Bump de versión** (`package.json` ×2 + lockfiles con `npm install`).
2. **`CHANGELOG.md`** con la entrada de la versión (crédito al modelo que hizo
   la investigación vs. el que cerró el fix).
3. **`README.md`** sincronizado: badge de versión, métricas actualizadas (tests,
   features). **Antes de cada push, toda la documentación del repo debe quedar
   actualizada.** No se permite pushear con el README desfasado respecto a la
   versión publicada.
4. **`MEJORAS_FUTURAS.md`** actualizado: versión, puntos resueltos marcados,
   contadores ajustados. Debe reflejar el estado real del repo tras el cierre.
5. **Commit** convencional con todos los cambios de la gestión (código + docs).
6. **Push a `main`** (`git push origin main`).
7. **Tag anotado** `vX.Y.Z` y push del tag (`git push origin vX.Y.Z`).
8. **GitHub release** (`gh release create vX.Y.Z --title ... --notes-file ...`,
   con la misma sección del `CHANGELOG.md` como notas). Automático desde
   v3.23.2. **Incluir la línea `Cambio de código por [asistente] ([modelo])`**
   en las notas del release.
9. **Mensaje de handoff** (ver §2.7): bloque de texto listo para pegar en la
   siguiente sesión.

La confirmación del usuario se pide **solo** para cualquier acción fuera de esta rutina.

### Mensaje de handoff (generar siempre al cerrar)

Cada cierre termina con un **bloque de handoff compacto** que el autor copia en
la siguiente sesión para retomar el trabajo con mínima inversión de tokens. Es
el mismo formato que se usó para abrir esta sesión con Grok 4.5 → ZCode. Debe
contener:

- **Repo, rama y versión** recién publicada.
- **Qué se acaba de cerrar** (1-3 frases, con número de issue y archivo clave).
- **Próximo trabajo priorizado** (sacado de `MEJORAS_FUTURAS.md`, con
  estimación).
- **Reglas de la sesión** (economía de contexto: subagentes Explore con
  informes compactos, lecturas con offset/limit, outputs filtrados; push+tag
  automáticos; crédito de modelo).

El asistente lo entrega como último mensaje de la sesión, en un bloque de
código para copiar fácil. Si queda trabajo a medias (contra la regla de §2), el
handoff lo declara sin inflar lo conseguido.

---

## 3. Convenciones de los asistentes

Estas reglas aplican a **cualquier** asistente de IA que trabaje en el repo, para
que el resultado sea consistente entre modelos:

- **Hablar al usuario en castellano** en el chat (lo pidió el autor expresamente).
  Identificadores y código en inglés.
- **No reintroducir heurísticas frágiles** eliminadas (p. ej. `intentDetection.ts`
  se borró en v3.7.0 por causar bugs recurrentes — no la resucites).
- **No "simplificar" la arquitectura** por recomendación externa. El backend de un
  solo `server/index.js` y los módulos cohesivos de ~700 líneas son **deliberados**.
  Las IAs externas (DeepSeek y similares) sobreponderan esto y reinciden ronda tras
  ronda; **no actúes sobre ello sin aprobación explícita** (ver `CLAUDE.md §5`).
- **Respetar Zero-Storage**: ninguna credencial en `localStorage`/`sessionStorage`
  (solo el idioma y `provider/model`, que no son secretos).
- **Cada cambio incluye sus tests** (#26 es transversal). Si tocas código, tocas o
  añades tests y los dejas en verde.
- **Lockfiles siempre regenerados** con `npm install`, nunca editados a mano; el
  `Dockerfile` usa `npm ci` y aborta si no cuadran.

---

## 4. Lecciones aprendidas (memoria de errores pasados)

Registro de errores con causa raíz, para no repetirlos. Se actualiza al detectar
patrones nuevos.

| Cuándo | Qué pasó | Causa | Prevención |
|---|---|---|---|
| v3.0.0–v3.1.1 | No desplegaba en Cloud Run | `pdfjs-dist@6` pide Node ≥22.13; con `node:20` del Dockerfile, `npm ci` la omitía **en silencio** (es `optionalDependency`) y luego `tsc` fallaba. No se veía en local/CI (Node ≥22) | Al añadir una dep con `engines` altos, verificar que el `FROM node:` del Dockerfile la cumpla. Alarma: `npm ci` instala **un paquete menos** que en local. Ver `CLAUDE.md §5`. |
| v3.7.0 | Bugs recurrentes por detección de intención | `intentDetection.ts` adivinaba la intención por palabras clave; era frágil y reintroducía el mismo bug cada ronda | **UI explícita > heurística por keywords.** Un botón/modal claro es más robusto. No reintroducir la heurística. |
| v3.21.0 (rama descartada) | 14 claves de diccionario i18n "muertas" | Se añadieron claves `docs.*` al diccionario destinadas a servicios (`docPublisher.ts`, `github.ts`), pero `useLanguage()` es un hook de React y **no puede usarse en módulos puros** → claves sin consumidor | Antes de añadir claves `t()`, verificar que el consumidor pueda importar `t()`. Para servicios, **inyectar** `t()` desde el componente llamador (patrón `ChatDeps.t`). Ver `CLAUDE.md §5` (i18n). |
| v3.21.0 (rama descartada) | Cambio espurio en `provider.openrouter.note` | Un asistente modificó una traducción ya existente (quitó "(Gemma suele estar disponible)") sin relación con la tarea, sin justificación ni entrada en changelog | Al reaprovechar trabajo de una rama, **revisar cada diff** y descartar los cambios fuera de alcance. No modificar strings existentes "de paso". |
| v3.25.0 | README.md desactualizado al publicar release | El badge de versión, CHANGELOG.md y MEJORAS_FUTURAS.md no se sincronizaron antes del release. El release no incluyó la línea de crédito al asistente | **Antes de cada push/tag/release, sincronizar obligatoriamente**: `README.md` (badge + métricas), `CHANGELOG.md` (entrada nueva), `MEJORAS_FUTURAS.md` (versión + puntos resueltos). El release debe incluir `Cambio de código por [asistente] ([modelo])`. Ver `CLAUDE.md §8` (rutina de releases). |

---

## 5. Trazabilidad de asistentes

Quién ha hecho qué, para reconocimiento y contexto. El autor figura como
**responsable último** de todo; los asistentes como herramienta de ejecución.

| Asistente | Modelo | Rol en el proyecto | Período |
|---|---|---|---|
| **Claude** | Sonnet (Anthropic) | Arquitecto y revisor; gran parte del desarrollo inicial | Junio 2026 |
| **Antigravity 2.0** | (Google) | Entorno de desarrollo agéntico (publicada el 18 may 2026) | Junio 2026 |
| **Gemini 2.5 Flash** | (Google) | Dogfooding: revisión del roadmap (métricas dashboard #44, inglés como 1er idioma de i18n #24, criterios de priorización) | 2026 |
| **Gemma 4 31B** | (OpenRouter) | Dogfooding: sugerencias de #51 (transparencia contextRanker), #52 (auditoría de seguridad), #53 (commit semántico) | 2026 |
| **GLM-5.2 (web)** | Zhipu | La **v3.20.0** (i18n Fase 1) se hizo con GLM-5.2 en su versión web | Junio 2026 |
| **ZCode (step-3.7-flash-free)** | GLM-5.2 (ZCode) | Corrección de **CLAUDE.md** y **METODOLOGIA_IA.md** (§1, §2.5, §2.6, §2.7, puntos de parada): al descubrirse que el trigger de Cloud Build depliega automáticamente al hacer push a `main`, actualizó las convenciones para reflejar que el **deploy a Cloud Run es automático** y no requiere punto de parada manual. | Julio 2026 |
| **ZCode (step-3.7-flash-free)** | GLM-5.2 (ZCode / Zhipu) | **v3.25.0:** i18n del panel lateral (#55) — refactor `templateData.ts` a factoría `buildTemplateCategories(t)`, ~36 claves en `tmpl_panel.*`; sincronización de `README.md`, `CHANGELOG.md` y `MEJORAS_FUTURAS.md`; release con crédito de autoría. Lección registrada en §4. | Julio 2026 |
| **Nemotron 3 Super 120B (nvidia)** | NVIDIA (vía OpenRouter, :free) | Validación cruzada en Z.ai: sugirió incluir el deploy automático de Cloud Run en la rutina de cierre y corregir la regla de oro (commit → push → tag → release → deploy) en `CLAUDE.md` y `METODOLOGIA_IA.md`. Verificado por el autor y confirmado. | Julio 2026 |
| **Tencent HY3** | (OpenRouter, desde 06/07) | Dogfooding (06/07): revisión del roadmap con el repo cargado (154 archivos). Aportó **decidir la poda de #33 (revisores) y #35 (auto-labels)** — confirmó lo que ya eran "candidatos a poda". Propuso además un "#50 claridad para no técnicos" que **ya existía** (#50 es presupuesto de contexto) y cuya idea de base (que la IA explique términos) **ya vive en `chat.md`**; validación cruzada: se incorporó lo accionable (la poda) y se descartó lo duplicado. | Julio 2026 |

> **Dogfooding:** el proyecto se prueba a sí mismo. Varias mejoras del roadmap
> surgieron de pedir opinión a distintos modelos con el repo cargado como contexto.
> Esas sugerencias se filtran con **validación cruzada**: se incorpora lo
> accionable, se reformula lo dudoso y se descartan los elogios (más detalles en el
> README y en `MEJORAS_FUTURAS.md`).

---

## 6. Cómo retomar el trabajo (checklist para una nueva sesión)

Si retomas el proyecto en otra sesión/herramienta, este es el punto de partida:

1. **Cargar contexto:** leer `CLAUDE.md` (guía técnica) y este documento
   (metodología). El asistente debe asimilarlos **antes** de proponer nada. Si el
   autor pega un **mensaje de handoff** de la sesión anterior (formato §2.7),
   ese es el contexto de arranque — leerlo antes que nada.
2. **Verificar estado real del repo** (no asumir): versión en `package.json`,
   rama activa, últimos commits, `git tag`, ramas sin mergear, divergencias. Una
   discrepancia entre lo que dice la doc y el código real es señal de que algo
   quedó a medias — investigar antes de avanzar.
3. **Revisar `MEJORAS_FUTURAS.md`** para el siguiente ítem del roadmap.
4. **Acordar el alcance** de la iteración con el autor antes de escribir código.
5. **Seguir el flujo de §2** y, al cerrar, ejecutar la rutina automática de
   cierre (push + tag + handoff).

---

## 7. Convenciones de edición de este documento

- **Actualizar al cerrar cada versión**: la fecha de "Actualizado a" no existe aquí
  (es un documento vivo), pero la §5 (trazabilidad) y la §4 (lecciones) sí crecen
  con cada iteración significativa.
- **Honestidad:** registrar también los errores y las ramas descartadas — son tan
  instructivos como los aciertos.
- **Sin elogios:** este documento describe hechos, no valora. La calidad se mide en
  tests verdes y código que cumple la filosofía, no en adjetivos.
