# 🔮 Mejoras Futuras — Análisis del Código

Este documento recoge los puntos de mejora identificados tras una auditoría completa del código fuente.

---

## ✅ Resueltos

### ~~1. Verificación del parámetro `state` en el flujo OAuth~~
**Archivo:** `server/index.js` — **Resuelto en commit `fix: verificar OAuth state`**

El servidor ahora genera un `state` aleatorio en `/auth/github`, lo almacena en `req.session.oauthState` y lo verifica en `/auth/callback`. Si no coincide, la petición se rechaza con `error=state_mismatch`. El state se consume tras el primer uso (single-use token).

---

### ~~2. `SESSION_SECRET` sin validación en producción~~
**Archivo:** `server/index.js` — **Resuelto en commit `fix: verificar OAuth state`**

El servidor ahora lanza `process.exit(1)` con un mensaje claro si `NODE_ENV === 'production'` y `SESSION_SECRET` no está definido. Imposible desplegar en producción sin configurar esta variable.

---

## 🔴 Alta prioridad

### 3. Calidad del contenido generado por Groq
**Archivo:** `client/src/services/gemini.ts` → `generateRepoDocs()`

El modo "Documenta mi repositorio" genera documentación funcional pero genérica cuando usa Groq. El prompt de documentación es idéntico para ambos proveedores, pero Groq con `llama-3.3-70b` produce resultados más sobrios que Gemini para tareas creativas de escritura larga.

**Solución:** Enriquecer el `docSystemPrompt` con ejemplos de estructura deseada (few-shot prompting) e incluir en el mensaje al modelo la descripción del repo y su lenguaje principal como contexto adicional antes de la lista de archivos.

---

## 🟠 Media prioridad

### 4. Soporte para `PATCH` en el ejecutor de acciones
**Archivo:** `client/src/services/actionExecutor.ts`

El switch de métodos HTTP soporta GET, POST, PUT y DELETE, pero no `PATCH`. Varias operaciones útiles de GitHub usan PATCH: actualizar la descripción de un repositorio (`PATCH /repos/{owner}/{repo}`), actualizar metadatos de un issue, etc. Si la IA genera una acción con `metodo: 'PATCH'`, cae en el `default` y lanza un error.

**Solución:** Añadir un case `'PATCH'` en el executor con lógica similar al case `'POST'`.

---

### 5. `DocModal` embebido en `App.tsx`
**Archivo:** `client/src/App.tsx`

El componente `DocModal` (unas 50 líneas) está definido directamente dentro de `App.tsx`. Esto dificulta su mantenimiento, prueba unitaria y reutilización.

**Solución:** Extraer a `client/src/components/confirm/DocModal.tsx` e importarlo en `App.tsx`.

---

### 6. Función `formatResultData` embebida en `App.tsx`
**Archivo:** `client/src/App.tsx`

La función `formatResultData` (~60 líneas) convierte respuestas de la GitHub API en texto legible. Su lógica es independiente de los componentes React y debería vivir en `utils/`.

**Solución:** Mover a `client/src/utils/formatResult.ts` e importarla donde se necesite.

---

### 7. Modelos de Groq hardcodeados
**Archivo:** `client/src/components/ai-provider/AIProviderPanel.tsx`

La lista de modelos disponibles en Groq Cloud está hardcodeada en el componente. Groq actualiza su catálogo periódicamente (añade modelos, depreca otros), por lo que la app quedará desactualizada sin intervención manual.

**Solución:** Llamar al endpoint `GET https://api.groq.com/openai/v1/models` al conectar Groq y mostrar la lista dinámica. Cachear en sessionStorage para evitar llamadas repetidas.

---

### 8. Truncado de contenido en modo documentación
**Archivo:** `client/src/services/gemini.ts` → `generateRepoDocs()`

Cada archivo se trunca a 2000 caracteres antes de enviarlo al modelo. Para archivos complejos como el propio `gemini.ts` o `actionExecutor.ts`, la parte más importante (implementación de funciones) puede quedar fuera.

**Solución:** En lugar de truncar por caracteres, enviar las primeras N líneas de cada archivo (más semántico) o, para archivos TypeScript/JavaScript, extraer solo las firmas de funciones exportadas usando una regex simple.

---

## 🟡 Baja prioridad

### 9. Generador de IDs con `Math.random()`
**Archivo:** `client/src/App.tsx`

`Math.random()` no es criptográficamente seguro y puede producir colisiones en teoría.

**Solución:** Usar `crypto.randomUUID()` disponible en todos los navegadores modernos.

---

### 10. Inconsistencia en fetch — `ghFetch()` vs `fetch()` directo
**Archivo:** `client/src/services/actionExecutor.ts`

Los casos genéricos (fallback de GET y POST) usan `fetch()` directo con headers manuales en lugar del wrapper tipado `ghFetch()` de `github.ts`.

**Solución:** Exponer `ghFetch` desde `github.ts` y usarlo también en los casos genéricos del executor.

---

### 11. Dependencia suprimida en `AuthContext`
**Archivo:** `client/src/context/AuthContext.tsx`

El `useEffect` que valida el token almacenado suprime el warning de dependencias de React con `eslint-disable-line`.

**Solución:** Refactorizar con un ref de control (`hasValidated`) para que el efecto incluya sus dependencias correctas.

---

### 12. Texto "Generando documentación con Gemini..." fijo
**Archivo:** `client/src/App.tsx`

El mensaje de estado dice "con Gemini..." aunque el usuario pueda estar usando Groq.

**Solución:** Leer el proveedor activo de `AIProviderContext` y mostrar el nombre correcto.

---

## 📋 Resumen

| # | Estado | Prioridad | Archivo | Esfuerzo estimado |
|---|---|---|---|---|
| 1 | ✅ Resuelto | ~~🔴 Alta~~ | `server/index.js` | — |
| 2 | ✅ Resuelto | ~~🔴 Alta~~ | `server/index.js` | — |
| 3 | ⏳ Pendiente | 🔴 Alta | `gemini.ts` | 2-3h |
| 4 | ⏳ Pendiente | 🟠 Media | `actionExecutor.ts` | 30 min |
| 5 | ⏳ Pendiente | 🟠 Media | `App.tsx` | 20 min |
| 6 | ⏳ Pendiente | 🟠 Media | `App.tsx` | 20 min |
| 7 | ⏳ Pendiente | 🟠 Media | `AIProviderPanel.tsx` | 1h |
| 8 | ⏳ Pendiente | 🟠 Media | `gemini.ts` | 1-2h |
| 9 | ⏳ Pendiente | 🟡 Baja | `App.tsx` | 5 min |
| 10 | ⏳ Pendiente | 🟡 Baja | `actionExecutor.ts` | 30 min |
| 11 | ⏳ Pendiente | 🟡 Baja | `AuthContext.tsx` | 30 min |
| 12 | ⏳ Pendiente | 🟡 Baja | `App.tsx` | 10 min |

---

<p align="center">
  <sub>Análisis realizado por <strong>Claude</strong> (Anthropic) · Junio 2026</sub>
</p>
