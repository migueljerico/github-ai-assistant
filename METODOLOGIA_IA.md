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
   (0 errores), `npm run test:run` (suite completa verde) y `npm run test:coverage`
   (revisión obligatoria del `codecov/patch`: 100% de las líneas/condicionales nuevos
   del diff cubiertos por tests unitarios para evitar fallos en CI). Reportar los
   números reales.
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
- **Reglas de la sesión** (lectura obligatoria de AGENTS.md, CLAUDE.md y METODOLOGIA_IA.md
  antes de tocar código; economía de contexto: subagentes Explore con informes
  compactos, lecturas con offset/limit, outputs filtrados; push+tag automáticos;
  expansión continua de cobertura Codecov al 100%; crédito de modelo).

El asistente lo entrega como último mensaje de la sesión, en un bloque de
código para copiar fácil. Si queda trabajo a medias (contra la regla de §2), el
handoff lo declara sin inflar lo conseguido.

> **Regla anti-HANDOFF (v3.34.1):** el handoff es un mensaje en el chat, no un
> archivo en el repo. No se crean, ni se dejan, archivos `HANDOFF_*.md`,
> `SESSION_*.md` ni notas personales de sesión en el repo a menos que el usuario
> lo pida explícitamente. Caso real: un asistente creó `HANDOFF_2026-07-13.md`
> sin que se lo pidieran → se borró y se registra la regla aquí para no repetirlo.

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
| v3.31.0 | "La IA no devolvió JSON válido" al documentar (repos creados vacíos) | `callOpenAICompatible` limitaba la salida a **4096 tokens** y el proxy de Gemini no fijaba límite. Un README + MANUAL_TECNICO detallado supera ese presupuesto → el JSON se truncaba a medias → el parser fallaba → el repo quedaba creado pero vacío (el flujo "crear + documentar" crea el repo *antes* de generar la doc) | Para tareas de **generación larga** (docs, changelog…), pasar un `maxTokens` mayor a `callAI` y propagarlo al proxy. No asumir que el default del proveedor basta para salidas estructuradas largas. El parser ya es robusto (`extractJsonCandidates`), pero un JSON truncado no tiene recuperación. |
| v3.60.1 | Los modelos de **CHAT Nemotron** (familia principal de NVIDIA) no aparecían en el selector de modelos NIM | `NIM_EXCLUDED` filtra por **substring** (`m.id.toLowerCase().includes(p)`) y contenía la entrada `'nemo'`, que es substring de `'nemotron'` → excluía por error todos los Nemotron. El caso que se quería excluir (NeMo Retriever, no-chat) queda cubierto por la entrada más específica `'nemoretriever'` | Cuando un filtro opere por **substring** (`includes`), usar entradas específicas (`nemoretriever`) y no prefijos ambiguos (`nemo`) que colisionen con ids válidos. El bug lo destapó subir la cobertura del catálogo dinámico de `providers.ts` (sesión v3.60.1): sin tests sobre `NIM_EXCLUDED` pasó desapercibido desde v3.32.0 (`#54`). Test de regresión: `providers.test.ts → 'regresión NIM_EXCLUDED: NO excluye modelos de chat Nemotron (v3.60.1)'`. |
| v4.0.40 | Límite de TPM / tokens por minuto al documentar repos con modelos de cuota estricta (p. ej. Qwen 3.8 con 8K TPM en Groq) | En Groq on-demand, Qwen 3.8 tiene un límite de 8.000 TPM. Una petición de documentación con decenas de archivos y 80 líneas cada uno solicita ~65K tokens en un único HTTP request atómico → error 413 "Request too large... on tokens per minute (TPM)". No se puede "fraccionar entre minutos" una sola llamada atómica a `/chat/completions` | **Detección proactiva + degradación elegante interactiva**: 1) Interceptar con `isContextTooLargeError` y explicar pedagógicamente el límite en lenguaje natural; 2) En `DocumentFlowModal` ofrecer botón de acción directa "Generar documentación ligera (archivos esenciales)" (top 6 archivos, 40 líneas máx, 2500 tokens salida); 3) Recomendar cambiar a Gemini 2.5 Flash (1M tokens de contexto) para repositorios grandes completos. |
| v4.0.42 | Error CORS en OpenRouter ("x-timeout-ms is not allowed by Access-Control-Allow-Headers") y botones móviles cortados en app instalada | 1) Las cabeceras HTTP internas del proxy Express (`X-Timeout-Ms`, `X-Account-Id`) se enviaban indiscriminadamente en llamadas directas de cliente a API externa, disparando rechazo preflight CORS. 2) La PWA en modo standalone no incluía `viewport-fit=cover`, manifest.json ni padding `env(safe-area-inset-bottom)`, y `.chat-input-area` carecía de `flex-shrink: 0`. | 1) Aislar cabeceras internas del proxy con `isProxyEndpoint`; llamadas directas usan solo AbortSignal en cliente. 2) Incluir siempre `viewport-fit=cover`, manifest.json y variables safe-area con `flex-shrink: 0` en inputs inferiores de apps web móviles instalables. |
| v4.0.42 | Falso positivo en CI de Gitleaks `generic-api-key` y `.gitleaks.toml` no aplicado (fallo en GitHub Actions tras 9s en `CI & Coverage / security`) | 1) En tests unitarios (p. ej. `gemini.test.ts`), un mock con `'gsk-key'` seguido del nombre de modelo `'llama-3.3-70b-versatile'` (>16 chars) fue detectado como par clave-valor por la heurística `generic-api-key`. 2) `.gitleaks.toml` usaba la tabla inválida `[[allowlists]]` (en plural/array), ignorada silenciosamente por Gitleaks v8 (que exige `[allowlist]` singular a nivel raíz). Mismo fallo replicado en repositorios hermanos como `dataflow_ai`. | 1) En `.gitleaks.toml` usar siempre `[allowlist]` (singular) a nivel raíz con regexes de paths (`'''client/src/.*__tests__/.*'''`). 2) En tests, evitar nombres de parámetros mock terminados en `-key` que precedan a strings largos; usar sufijos como `-auth` o `-token` (p. ej. `'mock-groq-auth'`). 3) Añadir siempre el comentario en línea `// gitleaks:allow` en la llamada del test como defensa en profundidad. |

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
| **ZCode (step-3.7-flash-free)** | GLM-5.2 (ZCode) | **v3.30.0:** Fix crash multi-archivo en flujo de documentación (#57 fix). Restauración de `onClearAllFiles` en `ChatInputProps` (v3.30.1 lint fix). 504 tests verdes, build limpio, lint 0 errores. | Julio 2026 |
| **ZCode (step-3.7-flash-free)** | GLM-5.2 (ZCode / Zhipu) | **v3.30.2:** Fix definitivo del `TypeError: S.trim is not a function` al pulsar "Documentar" — el bug real que persistía tras v3.30.0/v3.30.1. Causa raíz: `DocumentRepoButton` pasaba el `MouseEvent` como `initialRepo` (regresión de la Tanda B). Diagnóstico forense del bundle de prod (`index-DjJbaFKb.js`): mapeo del stack minificado contra el sourcemap local para localizar el throw exacto (`disabled:!S.trim()` = `DocumentFlowModal.tsx:347`). Fix puntual (`onClick={() => onOpen()}`) + defensa (`initialRepo` saneado a string) + 2 tests de regresión. 506/506 verdes, build limpio. | Julio 2026 |
| **ZCode (step-3.7-flash-free)** | GLM-5.2 (ZCode / Zhipu) | **v3.31.0:** Fix del error "La IA no devolvió JSON válido" al documentar (repos creados vacíos) — el límite de salida de 4096 tokens truncaba el README+MANUAL a medias. Fix: `maxTokens` param en `callAI` + `generateRepoDocs(8192)` + proxy de Gemini lee `maxOutputTokens`. Además: firma de documentación con IA real (about del repo + commit messages + PR bodies + footer del README), about automático vía `updateRepo` (PATCH `/repos/`), botón "Actualizar documentación" siempre visible, y banner verde afirmativo para repos ya documentados. 520/520 verdes, build limpio. | Julio 2026 |
| **Nemotron 3 Ultra (NIM)** | NVIDIA (vía ZCode) | **v3.32.0:** cerró **#54** — añadió NVIDIA Build (NIM) y Zenmux como proveedores de IA (`openai-compatible`). NIM: catálogo dinámico filtrado (`NIM_EXCLUDED`) + enriquecido con `featured-models.json` de NGC. Zenmux: catálogo dinámico con detección free por pricing. 530/530 verdes. La sincronización de docs quedó incompleta (badge README y contadores sin actualizar) — corregido en v3.32.1. | Julio 2026 |
| **ZCode (builtin:zai-coding-plan)** | GLM-5.2 (ZCode / Zhipu) | **v3.32.1:** Hotfix doble. (1) NIM no funcionaba: "❌ Failed to fetch" por CORS — NIM no envía `Access-Control-Allow-Origin`. Añadido proxy backend transparente (`POST /api/nim`, `GET /api/nim/models` con rate limiter propio) y endpoints de `providers.ts` cambiados a rutas relativas; el stream SSE se reenvía sin bufferizar. (2) Corrección de la documentación que v3.32.0 dejó a medias: badge/contadores/proveedores en README y CLAUDE.md, TOTAL en MEJORAS_FUTURAS (34/7), fila de trazabilidad v3.32.0, y listas de proveedores en `docs/`. 530+5 tests verdes, build limpio. | Julio 2026 |
| **Gemma 4 31B** | (Google/OpenRouter) | **v3.29.0:** Bug fixer y feature dev (#57 Tanda B). Implementó multi-archivo en chat, flujo "Crear repo + Documentar" y detección de docs existentes. Build verde, 497 tests. | Julio 2026 |
| **Nemotron 3 Super 120B (nvidia)** | NVIDIA (vía OpenRouter, :free) | Validación cruzada en Z.ai: sugirió incluir el deploy automático de Cloud Run en la rutina de cierre y corregir la regla de oro (commit → push → tag → release → deploy) en `CLAUDE.md` y `METODOLOGIA_IA.md`. Verificado por el autor y confirmado. | Julio 2026 |
| **Tencent HY3** | (OpenRouter, desde 06/07) | Dogfooding (06/07): revisión del roadmap con el repo cargado (154 archivos). Aportó **decidir la poda de #33 (revisores) y #35 (auto-labels)** — confirmó lo que ya eran "candidatos a poda". Propuso además un "#50 claridad para no técnicos" que **ya existía** (#50 es presupuesto de contexto) y cuya idea de base (que la IA explique términos) **ya vive en `chat.md`**; validación cruzada: se incorporó lo accionable (la poda) y se descartó lo duplicado. | Julio 2026 |
| **Tencent HY3** | (OpenRouter, openrouter-free/tencent/hy3:free) | **v3.27.0:** retomó el proyecto y cerró **#57** — unificó la UI de documentación en un único flujo stepper de 4 pasos que fusiona los botones "Documentar repo" y "Documentar y publicar"; eliminó `DocModal`/`FilePublishModal` y añadió `DocumentFlowModal` (reutiliza `PublishActions` y las `run*`), con nuevas claves `modal.flow.*`. Sincronización de `README.md`, `CHANGELOG.md` y `MEJORAS_FUTURAS.md` y release con crédito de autoría. | Julio 2026 |
| **GLM-5.2** | (builtin:zai-coding-plan/GLM-5.2) | **v3.28.0:** cerró **#50** (presupuesto de contexto adaptativo por proveedor — Groq free 6/60 vs 12/80; reintento automático con menos contexto ante error TPM/context-length; fix del mensaje de error duplicado) y **#51** (bloque plegable "Archivos consultados para esta respuesta" que hace transparente el `contextRanker`). Sincronización completa de docs (README, CHANGELOG, MEJORAS_FUTURAS, esta tabla) y release. | Julio 2026 |
| **ZCode (mimo-v2.5-free)** | GLM-5.2 (ZCode / Zhipu) | **v3.32.3:** Cambio de NIM a acceso directo (sin proxy). `nvidia.chatEndpoint` cambiado de `/api/nim` a `https://integrate.api.nvidia.com/v1/chat/completions`, siguiendo el patrón de Zenmux. Proxy `/api/nim` se mantiene en `server/index.js` como fallback por si CORS sigue bloqueando. 531/531 tests verdes, build limpio. | Julio 2026 |
| **Kimi (Kimi-K2.7-code)** | Moonshot AI (vía ZCode) | **v3.32.4:** Revertido `nvidia.chatEndpoint` a `/api/nim` tras confirmarse en prod que NVIDIA NIM no envía cabeceras CORS y el acceso directo falla con "Failed to fetch". El proxy en `server/index.js` sigue reenviando a `integrate.api.nvidia.com` de servidor a servidor. Tests, documentación, changelog y métricas sincronizadas. | Julio 2026 |
| **ZCode (builtin:zai-coding-plan)** | GLM-5.2 (ZCode / Zhipu) | **v3.38.0:** Añadió el proveedor **Ai&** (`api.aiand.com`, OpenAI-compatible) con catálogo dinámico y detección free por pricing (`input_per_1m`/`output_per_1m` a 0). Robustez `effectiveMaxTokens` (campo `maxOutputTokens` por proveedor; Ai& → 8192 para evitar respuestas vacías en modelos de razonamiento; corrige asimetría del default 4096 entre transportes). Renombrado del nombre visible del producto a "Asistente de IA de GitHub" / "GitHub AI Assistant". 569/569 (client) + 5/5 (server) tests verdes, build limpio. | Julio 2026 |
| **ZCode (builtin:zai-coding-plan/GLM-5.2)** | GLM-5.2 (ZCode / Zhipu) | **v3.38.1:** Fix de Ai& (bugfix). (1) **CORS:** el handoff v3.38.0 asumía (por Tencent HY3, no por el usuario) que Ai& no necesitaba proxy; en prod daba `Failed to fetch` (No 'Access-Control-Allow-Origin'). Confirmado que `api.aiand.com` **no envía CORS** → movido a proxy backend (mismo patrón que NIM/OpenZen/CF/Ollama, añadidos `aiandLimiter` + `POST /api/aiand` + `GET /api/aiand/models` en `server/index.js`; endpoints del cliente ahora `/api/aiand` y `/api/aiand/models`). (2) **Catálogo:** aparecían 5 modelos (el fallback `AIAND_FALLBACK`, con 4 modelos no validados); reducido a **solo `qwen/qwen3.6-27b`** y añadido filtro **free-only** en la rama `aiand` de `fetchModels`. No cambia `transport`, `defaultModel` ni `maxOutputTokens: 8192`. | Julio 2026 |
| **ZCode (builtin:zai-coding-plan/GLM-5.2)** | GLM-5.2 (ZCode / Zhipu) | **v3.50.1:** Hotfix de main tras fusionar 10 PRs de Dependabot de golpe (4 majors + 6 menores) — build de Docker y CD a Cloud Run rotos. Causas raíz en cadena: mismatch React 19/18 (react-dom alineado a 19), `app.get('*')` inválido en Express 5 (→ `app.get('/{*splat}')`), `eslint-plugin-react-hooks` 5→7.1.1 (peer eslint^10), reglas nuevas v7 degradadas a warn, 3 falsos positivos de `no-useless-assignment` silenciados. 613 tests cliente + 44 server verdes. | Julio 2026 |
| **ZCode (builtin:zai-coding-plan/GLM-5.2)** | GLM-5.2 (ZCode / Zhipu) | **v3.50.2:** Cierre de la deuda de lint heredada de v3.50.1 (15 warnings → 0). Estrategia *refactor + silenciar selectivo*: bug real corregido (`App.tsx:128` `provider` duplicado en deps), 5 refactors (derived state con `useMemo` en `InstructionSuggestions`, `SessionWarningBanner` con `visible` en render + intervalo vía latest-ref, `useModalDialog` con ref en `useEffect`), 8 silenciamientos in situ justificados (fetch en mount, hooks co-localizados con Provider, gates del entry point) y 1 `eslint-disable` inútil borrado. Las 3 reglas siguen en `warn`. 613/613 tests, lint 0/0, build limpio. | Julio 2026 |
| **Antigravity 2.0 / Gemini 3.6 Flash** | Google (Antigravity 2.0) | **v3.68.0–v4.0.31:** Desarrollo agéntico continuo, integración de proveedores Kilo y BazaarLink, solución de error 429 de rate limit, reintentos transitorios y sincronización/mantenimiento documental integral. | Agosto 2026 |
| **Antigravity 2.0 / Gemini 3.7 Flash** | Google (Antigravity 2.0) | **v4.0.32–v4.0.33:** Incorporación de Gemini 3.7 Flash al catálogo con i18n en 13 idiomas, sincronización documental integral del repositorio dejando constancia del modelo activo y ampliación de pruebas unitarias (1.182 tests cliente + 60 servidor, 100% cobertura patch en Codecov). | Agosto 2026 |
| **ling-3.0-flash:free** | Zhipu | Dogfooding (2026-07-28): revisión del MEJORAS_FUTURAS.md con sugerencias honestas. Aportó **#75 (tests E2E)** como la única mejora concreta y accionable del roadmap. Descartó las sugerencias genéricas ya cubiertas (accesibilidad ya en #71/#72, prioridad ya en el roadmap) y las que no aplican al proyecto (monitoring operativo, auditoría de deps con Dependabot ya activo). Refinó la propuesta para que sea medible, con criterio de aceptación claro y contextualizada al estado real del repositorio (884 tests unitarios, 0 E2E). | Julio 2026 |

| **QwenCloud · Qwen 3.8 Max** | Alibaba Cloud (vía QwenCloud) | **Dogfooding (2026-08-06):** primera sesión de uso de la app con el repo `migueljerico/github-ai-assistant` cargado como contexto (218 archivos analizados). Ejecutó acciones de lectura (lista de repos, carga de contexto), respondió en español y propuso de forma autónoma la mejora **#76 — `ChatToolsMenu` (revelado progresivo de herramientas avanzadas del chat)**: detectó que los 9 botones de la barra de herramientas son excesivos para usuarios sin experiencia técnica y propuso agrupar los avanzados en un menú desplegable "Mas herramientas", preservando toda la funcionalidad existente. La propuesta fue evaluada por el autor y añadida al roadmap (`MEJORAS_FUTURAS.md`). | Agosto 2026 |

| **ZCode (builtin:zai-start-plan/GLM-5.3)** | GLM-5.3 (ZCode / Zhipu) | **v4.0.34:** expansión de cobertura Codecov (#26) con +30 tests unitarios sobre servicios sin testear: `gemini.ts` al 100% de líneas (`buildSecurityAuditContext` del Modo Auditoría #52, rutas de `validateProviderKey`, errores HTTP de ambos transportes, streaming vacío, diagnóstico de JSON truncado — con registro de que Node ≥21 cambió el mensaje de V8 —, límites del escáner balanceado), `priorityScore` y refetch 404 en `github.ts`, dedup de catálogos y detección free en `providers.ts`, y adjuntos (`extraFiles`/`uploadFilesToRepo`) en `docPublisher.ts`. Cobertura global 95,22→96,26% statements y 86,67→88,22% branches; 1.212 tests cliente + 60 servidor en verde. Sincronización documental integral (README, CHANGELOG, MANUAL_TECNICO, MEJORAS_FUTURAS, CLAUDE.md) dejando constancia del modelo activo. | Agosto 2026 |
| **Antigravity 2.0 / Gemini 3.7 Flash** | Google (Antigravity 2.0) | **v4.0.35:** Extracción inteligente del resumen de repositorio para el "about" de GitHub (`extractRepoSummary` en `gemini.ts`), saneamiento de Markdown/HTML/enlaces y acotación segura a 350 caracteres para la descripción del repo. Ampliación de tests unitarios (+14 tests en `gemini.test.ts`), alcanzando **1.286 tests unitarios en verde** (1.226 cliente + 60 servidor) al 100% de líneas en `gemini.ts` y 100% de cobertura en diff patch para Codecov y sincronización documental completa. | Agosto 2026 |
| **Antigravity 2.0 / Gemini 3.7 Flash** | Google (Antigravity 2.0) | **v4.0.36:** Expansión sistemática de cobertura de pruebas unitarias (#26) alcanzando el **100% de funciones y 100% de líneas** en `DocumentFlowModal.tsx` (+16 tests) y **98,16% de líneas** en `assistantActions.ts` (+17 tests). Total de la suite: **1.319 tests unitarios en verde** (1.259 cliente + 60 servidor, 0 fallos), compilación estricta de TypeScript limpia y sincronización documental integral. | Agosto 2026 |
| **Antigravity 2.0 / Gemini 3.7 Flash** | Google (Antigravity 2.0) | **v4.0.37:** Corrección de alertas de seguridad CodeQL (CWE-116: `js/incomplete-multi-character-sanitization` #7 y #8) implementando sanitización iterativa de punto fijo `stripHtmlTags` en utilidades Markdown (`cleanMarkdownText`, `isOnlyBadgesOrLinks` en `gemini.ts`). Ampliación de tests unitarios (+2 tests en `gemini.test.ts`), alcanzando **1.321 tests unitarios en verde** (1.261 cliente + 60 servidor, 100% patch Codecov) y sincronización documental integral. | Agosto 2026 |
| **Muse Spark 1.2 Contributor** | Muse (ZCode) | **v4.0.38:** Reorganización de la sección de modelos de IA del README (`## 🧠 Desarrollo asistido por IA`) tras revisión completa del repositorio (README, `docs/DESARROLLO_IA.md`, `METODOLOGIA_IA.md`, `MANUAL_TECNICO.md`, `CLAUDE.md`, `CHANGELOG.md` y `providers.ts`). Reagrupación de 18 viñetas planas en tres bloques tabulados por rol (línea principal de desarrollo, contribuciones cerradas, validación/dogfooding), orden cronológico por grupo y corrección de duplicado en tabla de funcionalidades. Bump `4.0.37` → `4.0.38`, sincronización documental integral y release. | Agosto 2026 |
| **Antigravity 2.0 / Gemini 3.7 Flash** | Google (Antigravity 2.0) | **v4.0.39:** Corrección de la selección de modelos en Groq (`RELIABLE_MODEL_PREFS` en `providers.ts` prioriza `openai/gpt-oss-20b` sobre `qwen3.8-27b`), interceptación de errores 403 por límites de proyecto en Groq (`model_permission_blocked_project` / `blocked at the project level`) con mensaje accionable y enlace a la consola, ajuste del hint genérico para peticiones hacia Groq y etiquetas amigables en `modelLabels.ts`. Suite: 1.324 tests unitarios en verde (1.264 cliente + 60 servidor, +3 tests), 100% líneas en `gemini.ts` y 100% diff patch en Codecov. | Septiembre 2026 |
| **Antigravity 2.0 / Gemini 3.7 Flash** | Google (Antigravity 2.0) | **v4.0.40:** Manejo proactivo de límites de tokens/TPM en documentación de repositorios, orientación pedagógica al usuario y Modo de Documentación Ligera interactivo en `DocumentFlowModal` y `assistantActions.ts` (con selección de 6 archivos clave, truncado a 40 líneas y salida de 2.500 tokens en `gemini.ts`), 6 claves i18n en los 13 idiomas. Suite ampliada a 1.333 tests unitarios (1.273 cliente + 60 servidor, +9 tests, 100% diff patch Codecov) y sincronización documental integral. | Septiembre 2026 |
| **ZCode (builtin:zai-start-plan/GLM-5.3-Flash)** | GLM-5.3-Flash (ZCode / Zhipu) | **v4.0.41:** Diagnóstico y fix del error "signal timed out" / 503 al documentar repositorios grandes: timeout adaptativo en `generateRepoDocs` (300s modo completo / 120s ligero, propagado por `X-Timeout-Ms` al proxy), interceptación pedagógica de timeouts (`'timeout'`) y sobrecarga (503 → `'overloaded'`, nuevo `isProviderOverloadedError` en `retry.ts`) en chat y modal, botón directo ⚡ Doc. ligera y corrección de la alerta de seguridad CodeQL #9 (`js/incomplete-url-substring-sanitization`) con el helper `isGroqEndpoint` (comparación de hostname de URL en lugar de substring). +13 tests (1.345 totales en verde: 1.285 cliente + 60 servidor), 100% diff patch en Codecov, lint 0 errores, build limpia. | Septiembre 2026 |
| **Antigravity 2.0 / Gemini 3.8 Flash** | Google (Antigravity 2.0) | **v4.0.42:** Corrección de CORS en llamadas directas a proveedores externos (`X-Timeout-Ms` y `X-Account-Id` condicionados a proxy interno vía `isProxyEndpoint`), incorporación de Gemini 3.8 Flash al catálogo de modelos con i18n en 13 idiomas, y corrección del layout en app móvil instalada (PWA standalone con `viewport-fit=cover`, `manifest.json`, padding `safe-area-inset-*` y `flex-shrink: 0` en barra inferior). +5 tests unitarios (1.350 tests en verde: 1.290 cliente + 60 servidor), lint 0 errores y build limpia. | Septiembre 2026 |

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
