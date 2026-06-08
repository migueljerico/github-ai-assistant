# 🔮 Mejoras Futuras — Análisis del Código

Este documento recoge los puntos de mejora identificados tras una auditoría completa del código fuente.

---

## ✅ Resueltos

### ~~1. Verificación del parámetro `state` en el flujo OAuth~~
**Archivo:** `server/index.js` — **Resuelto en v2.0.1**

El servidor genera un `state` aleatorio, lo almacena en `req.session.oauthState` y lo verifica en el callback. El state se consume tras el primer uso.

---

### ~~2. `SESSION_SECRET` sin validación en producción~~
**Archivo:** `server/index.js` — **Resuelto en v2.0.1**

El servidor llama a `process.exit(1)` con mensaje claro si `SESSION_SECRET` no está definido en producción.

---

### ~~7. Modelos de Groq hardcodeados~~
**Archivo:** `client/src/components/ai-provider/AIProviderPanel.tsx` — **Resuelto en v2.2.0**

El componente ahora llama a `GET https://api.groq.com/openai/v1/models` cuando el usuario introduce una clave válida (`gsk_*`, longitud ≥ 20). Los modelos se filtran (excluyen whisper, playai, tts), se ordenan alfabéticamente y se cachean en `sessionStorage` durante 1 hora. Si la llamada falla, se usa la lista de fallback. El selector muestra el número de modelos disponibles y confirma que el catálogo está actualizado.

---

### ~~12. Texto "Generando documentación con Gemini..." fijo~~
**Archivo:** `client/src/App.tsx` — **Resuelto en v2.2.0**

`App.tsx` ahora importa `useAIProvider` y lee el proveedor activo. El mensaje de estado muestra el nombre correcto: "Generando documentación con **Groq Cloud**..." o "Generando documentación con **Google Gemini**..." según corresponda.

---

## 🔴 Alta prioridad

### 3. Calidad del contenido generado por Groq
**Archivo:** `client/src/services/gemini.ts` → `generateRepoDocs()`

El modo "Documenta mi repositorio" genera documentación funcional pero genérica cuando usa Groq. El prompt de documentación es idéntico para ambos proveedores, pero Groq produce resultados más sobrios para tareas de escritura larga.

**Solución:** Enriquecer el `docSystemPrompt` con ejemplos de estructura deseada (few-shot prompting) e incluir la descripción del repo y su lenguaje principal como contexto adicional.

---

## 🟠 Media prioridad

### 4. Soporte para `PATCH` en el ejecutor de acciones
**Archivo:** `client/src/services/actionExecutor.ts`

El switch de métodos HTTP no soporta `PATCH`. Operaciones como actualizar la descripción de un repo usan PATCH y caen en el `default`, lanzando un error.

**Solución:** Añadir un case `'PATCH'` con lógica similar al case `'POST'`.

---

### 5. `DocModal` embebido en `App.tsx`
**Archivo:** `client/src/App.tsx`

El componente `DocModal` (~50 líneas) está definido dentro de `App.tsx`, dificultando mantenimiento y pruebas unitarias.

**Solución:** Extraer a `client/src/components/confirm/DocModal.tsx`.

---

### 6. Función `formatResultData` embebida en `App.tsx`
**Archivo:** `client/src/App.tsx`

La función convierte respuestas de la GitHub API en texto legible pero su lógica es independiente de React.

**Solución:** Mover a `client/src/utils/formatResult.ts`.

---

### 8. Truncado de contenido en modo documentación
**Archivo:** `client/src/services/gemini.ts` → `generateRepoDocs()`

Cada archivo se trunca a 2000 caracteres. Para archivos complejos, la implementación real puede quedar fuera.

**Solución:** Enviar las primeras N líneas (más semántico) o extraer solo las firmas de funciones exportadas con regex.

---

## 🟡 Baja prioridad

### 9. Generador de IDs con `Math.random()`
**Archivo:** `client/src/App.tsx`

**Solución:** Usar `crypto.randomUUID()`.

---

### 10. Inconsistencia en fetch — `ghFetch()` vs `fetch()` directo
**Archivo:** `client/src/services/actionExecutor.ts`

**Solución:** Exponer `ghFetch` desde `github.ts` y usarlo en los casos genéricos del executor.

---

### 11. Dependencia suprimida en `AuthContext`
**Archivo:** `client/src/context/AuthContext.tsx`

El `useEffect` suprime el warning de dependencias de React con `eslint-disable-line`.

**Solución:** Refactorizar con un ref de control (`hasValidated`).

---

## 📋 Resumen

| # | Estado | Prioridad | Archivo | Esfuerzo |
|---|---|---|---|---|
| 1 | ✅ Resuelto | — | `server/index.js` | — |
| 2 | ✅ Resuelto | — | `server/index.js` | — |
| 3 | ⏳ Pendiente | 🔴 Alta | `gemini.ts` | 2-3h |
| 4 | ⏳ Pendiente | 🟠 Media | `actionExecutor.ts` | 30 min |
| 5 | ⏳ Pendiente | 🟠 Media | `App.tsx` | 20 min |
| 6 | ⏳ Pendiente | 🟠 Media | `App.tsx` | 20 min |
| 7 | ✅ Resuelto | — | `AIProviderPanel.tsx` | — |
| 8 | ⏳ Pendiente | 🟠 Media | `gemini.ts` | 1-2h |
| 9 | ⏳ Pendiente | 🟡 Baja | `App.tsx` | 5 min |
| 10 | ⏳ Pendiente | 🟡 Baja | `actionExecutor.ts` | 30 min |
| 11 | ⏳ Pendiente | 🟡 Baja | `AuthContext.tsx` | 30 min |
| 12 | ✅ Resuelto | — | `App.tsx` | — |

---

<p align="center">
  <sub>Análisis realizado por <strong>Claude</strong> (Anthropic) · Junio 2026</sub>
</p>
