# AGENTS.md — Instrucciones para asistentes de IA

> **Fuente de verdad:** este archivo es un **punto de entrada** que ZCode carga al
> arrancar. La guía técnica completa vive en `CLAUDE.md` y la metodología de
> colaboración humano↔IA en `METODOLOGIA_IA.md`. **Lee ambos antes de tocar código**
> (§0 de CLAUDE.md). Lo de abajo NO los sustituye; los referencia y refuerza.

---

## Idioma

- UI, comentarios y mensajes al usuario: **español**.
- Identificadores (variables, funciones, tipos): **inglish**.
- Dirígete al usuario en el chat **siempre en castellano**.

---

## Rutina de cierre automática (OBLIGATORIA al terminar una gestión)

**Cuándo:** al cerrar una gestión con **tests verdes y build limpio**.
**Cómo:** ejecútala **sin pedir permiso** (lo pidió el autor, v3.23.2). El único
motivo para frenar es que tests o build fallen, o que el usuario pidiera algo fuera
de esta rutina.

### Punto de partida: SIEMPRE la rama remota, nunca la local (v3.58.0)

Antes de crear la rama de trabajo o de mergear/pushear, **sincroniza contra el
remoto** y parte de ahí. La copia local puede estar atrasada respecto a GitHub
(merges de Dependabot aceptados fuera de la sesión, pushes de otras máquinas…).
Partir de la local lleva a push rechazados, rebase tardío y, lo peor, a publicar
sobre una base obsoleta.

Flujo obligatorio al empezar una gestión:
1. `git fetch origin` (trae el estado real del remoto).
2. `git checkout main && git pull --ff-only origin main` (actualiza local al
   remoto; `--ff-only` aborta si hay divergencia, señal de que algo no cuadra).
3. **Solo entonces** crea la rama: `git checkout -b feat/...` desde ese `main`
   recién sincronizado.

Y al cerrar: si `origin/main` avanzó mientras trabajabas (Dependabot, etc.),
**rebasea tu rama sobre `origin/main`** antes de mergear/pushear, re-verifica la
rutina AUTO (las deps nuevas pueden romper tests/build) y, si moviste un tag tras
el rebase, fuerzo el tag (`git tag -f`) y lo re-pushas (`git push -f <tag>`).
Precedente: v3.58.0 partió de un `main` local atrasado → push rechazado por 10
merges de Dependabot que no estaban en local; tag publicado apuntando a un commit
fuera de la historia lineal.

Orden exacto (regla de oro: commit + push + tag + release + deploy van **siempre
juntos**; nunca commitees sin pushear, ni pushees sin tagear, ni tagees sin publicar
el release):

1. **Bump de versión** `X.Y.Z` → siguiente. Editar:
   `package.json` (línea 3), `client/package.json` (línea 4),
   `README.md` (badge shields.io), `CLAUDE.md` (`(vX.Y.Z)`), `MANUAL_TECNICO.md`
   (`**Versión:**`), `MEJORAS_FUTURAS.md` (`**Actualizado a:**`).
   Luego `npm install` en raíz y en `client/` para regenerar lockfiles.
2. **`CHANGELOG.md`**: entrada `## [X.Y.Z] — YYYY-MM-DD` (em-dash `—`, ISO date)
   con blockquote de resumen + secciones `### Added/Changed/Fixed` + cierre
   `Cambio de código por [asistente] ([modelo]).`
3. **`README.md`** sincronizado (badge, métricas). Nunca pushear con el README
   desfasado respecto a la versión publicada.
4. **`MEJORAS_FUTURAS.md`**: versión + marcar ítems resueltos como ✅.
5. **Verificar TODO (frena el cierre si algo falla)**, en este orden:
   - `npm run lint` en `client/` — **OBLIGATORIO antes de commitear**. El CI usa una
     config de ESLint MÁS ESTRICTA que la local (caso real v3.56.0: pasó en local,
     rompió el CI). Cero errores. Los warnings `set-state-in-effect` preexistentes
     no bloquean, pero cualquier `error` sí.
   - `npm test` (client) — todo verde.
   - `npm run test:server` — todo verde.
   - `npm run test:coverage` (client) — sin bajar del umbral global (70% en
     lines/functions/branches/statements). Y **presta atención a la cobertura de las
     líneas NUEVAS del diff**: Codecov `codecov/patch` exige ≥89% del diff cubierto.
     Si añades código, añade tests que lo cubran. Los archivos de UI (componentes
     con mucho JSX) son los que más cuesta cubrir; para lógica nueva extrae funciones
     puras testeables (ver `modeDetection.ts`, `gemini.ts` parsers).
   - `npm run build` (TS estricto).
6. **Commit** convencional (`feat:`/`fix:`/`chore(vX.Y.Z):`) con TODOS los cambios
   de la gestión (código + docs).
7. **Push a `main`**: `git push origin main`.
8. **Tag anotado**: `git tag -a vX.Y.Z -m "vX.Y.Z — <resumen>"` + `git push origin vX.Y.Z`.
9. **GitHub release**: `gh release create vX.Y.Z --title "..." --notes-file <sección del CHANGELOG>`.
   Incluir la línea `Cambio de código por [asistente] ([modelo])` en las notas.
10. **Deploy a Cloud Run: automático.** El push a `main` dispara el trigger de Cloud
    Build. No requiere `gcloud` manual. Verificar a los ~2-3 min que llegó a prod.
11. **Handoff como MENSAJE en el chat** (último mensaje de la sesión). Ver §abajo.

---

## Regla anti-HANDOFF (v3.34.1, no negociable)

El handoff es un **mensaje en el chat**, **NO un archivo en el repo**. No crees ni
dejes archivos `HANDOFF_*.md`, `SESSION_*.md` ni notas personales de sesión en el
repo a menos que el usuario lo pida explícitamente. Precedente: un asistente creó
`HANDOFF_2026-07-13.md` sin que se lo pidieran → se borró y se registró la regla.

### Formato del handoff (entregar como último mensaje, en un bloque de código)

Compacto, para copiar/pegar en la siguiente sesión:

```
## Handoff — vX.Y.Z (YYYY-MM-DD)
- **Repo:** github-ai-assistant · **Rama:** main · **HEAD:** <hash corto> · **Tag:** vX.Y.Z
- **Cerrado:** <1-3 frases, con nº de issue y archivo clave>
- **Próximo trabajo priorizado** (de MEJORAS_FUTURAS.md):
  1. <ítem, con estimación>
  2. <ítem>
- **Reglas de sesión:** economía de contexto (subagentes Explore con informes
  compactos, lecturas con offset/limit, outputs filtrados); push+tag automáticos;
  crédito de modelo.
```

Si queda trabajo a medias (contra la regla de §2 de METODOLOGIA_IA.md), el handoff
lo declara **sin inflar** lo conseguido.

---

## Reglas de sesión (economía de contexto)

- **Subagentes Explore** para búsquedas amplias; pídeles informes compactos
  (file:line + conclusión), no volcados de archivos.
- Lee con `offset`/`limit` en archivos grandes; no los leas enteros.
- Filtra outputs de bash (`grep`, `head`, `tail`); evita `cat` de archivos largos.
- Crédito: atribuye siempre el modelo que hizo el trabajo (`Cambio de código por
  ZCode (GLM-5.2)` en commit/release/changelog).

---

## Quick reference — comandos

```bash
npm test                  # tests client (vitest) — debe dar todo verde
npm run test:server       # tests server
npm run build             # build TS estricto (client) — debe estar limpio
npm run deploy            # deploy manual puntual (NO para rutina normal; el CD es auto)
```

---

## Comunicación con el usuario (reglas de v3.57.2)

- **Entrega el handoff a la primera.** Cuando cierres una gestión con rutina AUTO,
  el handoff va como **mensaje de cierre explícito y destacado**, no embebido al
  final del resumen ni omitido. El usuario lo pide explícitamente cada vez y se
  frustra si no llega en cuanto termina el trabajo. Precedente: asistente que
  entregaba el resumen y dejaba el handoff para "después" o lo omitía.
- **`AskUserQuestion` no es fiable en este entorno.** A veces el canal falla y la
  respuesta del usuario no llega al modelo. **Si falla, NO tomes decisiones
  autónomas basándote en "continúa con tu mejor juicio"**: vuelve a preguntar en
  **texto plano** y espera la respuesta. Asume que el canal puede fallar y no
  dejes al usuario bloqueado sin poder elegir. No uses `AskUserQuestion` para
  pedir aprobación del plan (para eso está `ExitPlanMode`).
