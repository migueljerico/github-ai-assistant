# 🔮 Mejoras Futuras — Análisis del Código

Este documento recoge los puntos de mejora identificados tras una auditoría completa del código fuente. Ninguno es un bug crítico — la app funciona en producción — pero representan oportunidades de calidad, seguridad y experiencia de usuario para futuras iteraciones.

---

## 🔴 Alta prioridad

### 1. Verificación del parámetro `state` en el flujo OAuth
**Archivo:** `server/index.js`

El servidor genera un parámetro `state` aleatorio en `/auth/github` para prevenir ataques CSRF, pero **no lo verifica** en `/auth/callback`. Un atacante podría engañar a un usuario autenticado para que autorice una sesión maliciosa.

**Solución:** Guardar el `state` en `req.session` antes del redirect y compararlo con el `state` recibido en el callback. Rechazar si no coinciden.

---

### 2. `SESSION_SECRET` sin validación en producción
**Archivo:** `server/index.js`

El servidor tiene un valor por defecto `'dev-secret-change-in-production'` para `SESSION_SECRET`. Si la variable de entorno se omite accidentalmente en producción, las sesiones son criptográficamente débiles sin ningún aviso.

**Solución:** Añadir una comprobación al inicio del servidor:
```javascript
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET must be set in production');
  process.exit(1);
}
```

---

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

```typescript
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
```

`Math.random()` no es criptográficamente seguro y puede producir colisiones en teoría. Para IDs de mensajes de chat la consecuencia es baja, pero es una mala práctica.

**Solución:** Usar `crypto.randomUUID()` disponible en todos los navegadores modernos.

---

### 10. Inconsistencia en fetch — `ghFetch()` vs `fetch()` directo
**Archivo:** `client/src/services/actionExecutor.ts`

Las funciones especializadas del executor (listar repos, crear repo, etc.) usan el wrapper tipado `ghFetch()` de `github.ts`, que gestiona errores y cabeceras de forma consistente. Los casos genéricos (fallback de GET y POST) usan `fetch()` directo con headers manuales.

**Solución:** Exponer `ghFetch` desde `github.ts` y usarlo también en los casos genéricos del executor para consistencia.

---

### 11. Dependencia suprimida en `AuthContext`
**Archivo:** `client/src/context/AuthContext.tsx`

```typescript
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

El `useEffect` que valida el token almacenado suprime el warning de dependencias de React. Aunque el comportamiento actual es correcto, es una deuda técnica que puede causar bugs sutiles si el efecto se modifica en el futuro.

**Solución:** Refactorizar con un ref de control (`hasValidated`) para que el efecto se pueda incluir con sus dependencias correctas sin ejecutarse en cada render.

---

### 12. Texto "Generando documentación con Gemini..." fijo
**Archivo:** `client/src/App.tsx` → `handleDocumentRepo()`

El mensaje de estado durante la generación de documentación dice "con Gemini..." aunque el usuario puede estar usando Groq.

**Solución:** Leer el proveedor activo de `AIProviderContext` y mostrar el nombre correcto: "con Groq..." o "con Gemini...".

---

## 📋 Resumen

| # | Prioridad | Archivo | Esfuerzo estimado |
|---|---|---|---|
| 1 | 🔴 Alta | `server/index.js` | 30 min |
| 2 | 🔴 Alta | `server/index.js` | 15 min |
| 3 | 🔴 Alta | `gemini.ts` | 2-3h |
| 4 | 🟠 Media | `actionExecutor.ts` | 30 min |
| 5 | 🟠 Media | `App.tsx` | 20 min |
| 6 | 🟠 Media | `App.tsx` | 20 min |
| 7 | 🟠 Media | `AIProviderPanel.tsx` | 1h |
| 8 | 🟠 Media | `gemini.ts` | 1-2h |
| 9 | 🟡 Baja | `App.tsx` | 5 min |
| 10 | 🟡 Baja | `actionExecutor.ts` | 30 min |
| 11 | 🟡 Baja | `AuthContext.tsx` | 30 min |
| 12 | 🟡 Baja | `App.tsx` | 10 min |

---

<p align="center">
  <sub>Análisis realizado por <strong>Claude</strong> (Anthropic) · Junio 2026</sub>
</p>
