# 🔮 Roadmap de Mejoras — Análisis del Código (v2.4)

## 📌 Introducción

Este documento centraliza el análisis de mejoras futuras identificadas tras auditorías completas del código. Se organiza en tres categorías: **Resueltos**, **En progreso** y **Pendientes**, con esfuerzo estimado y estado actual.

---

## ✅ Resueltos en v2.4

| # | Punto | Archivo | Detalles |
|---|-------|---------|----------|
| 1 | Verificación OAuth state | `server/index.js` | ✅ v2.0.1 — State aleatorio + verificación CSRF |
| 2 | SESSION_SECRET en producción | `server/index.js` | ✅ v2.0.1 — Validación con `process.exit(1)` |
| 3 | Calidad generateRepoDocs() | `client/src/services/gemini.ts` | ✅ v2.4 — Prompt estructurado, lenguaje detectado, validación JSON |
| 4 | Soporte PATCH | `client/src/services/actionExecutor.ts` | ✅ v2.4 — Case PATCH añadido |
| 7 | Modelos Groq dinámicos | `client/src/components/ai-provider/AIProviderPanel.tsx` | ✅ v2.2.0 — Carga desde API oficial |
| 11 | AuthContext ESLint suppression | `client/src/context/AuthContext.tsx` | ✅ v2.4 — useRef guard en lugar de eslint-disable |
| 12 | Proveedor IA dinámico | `client/src/App.tsx` | ✅ v2.2.0 — Nombre correcto (Groq Cloud / Google Gemini) |

---

## 🟠 Media Prioridad — Pendientes

### **#5 — DocModal embebido en App.tsx**
- **Esfuerzo:** 20 min
- **Estado:** ⏳ Pendiente
- **Descripción:** El componente `DocModal` (~50 líneas) está definido dentro de `App.tsx`, dificultando reutilización y testing.
- **Solución:** Extraer a `client/src/components/confirm/DocModal.tsx`
- **Impacto:** Mejora mantenibilidad y testabilidad

---

### **#6 — Función formatResultData embebida en App.tsx**
- **Esfuerzo:** 20 min
- **Estado:** ⏳ Pendiente
- **Descripción:** La función convierte respuestas de GitHub API en texto legible pero su lógica es independiente de React.
- **Solución:** Mover a `client/src/utils/formatResult.ts`
- **Impacto:** Reutilización en otros contextos, testing más sencillo

---

### **#8 — Truncamiento semántico en generateRepoDocs()**
- **Esfuerzo:** 1-2h
- **Estado:** ⏳ Parcialmente resuelto
- **Descripción:** Actualmente trunca a 2000 caracteres. Para archivos complejos, la implementación puede quedar fuera.
- **Solución:** Enviar primeras N líneas (más semántico) o extraer solo firmas de funciones con regex.
- **Impacto:** Mejor contexto para el modelo, menos tokens consumidos
- **v2.4 Status:** ✅ Ya marca con `... (truncated)` explícitamente

---

## 🟡 Baja Prioridad — Pendientes

### **#9 — Generador de IDs con Math.random()**
- **Esfuerzo:** 5 min
- **Estado:** ⏳ Pendiente
- **Ubicación:** `client/src/App.tsx` línea 17
- **Problema:** `const uid = () => \`${Date.now()}-${Math.random().toString(36).slice(2, 7)}\`;`
- **Solución:** Reemplazar con `crypto.randomUUID()`
- **Impacto:** Mejor seguridad (CSPRNG vs pseudo-random)

```typescript
// Antes
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// Después
const uid = () => crypto.randomUUID();
```

---

### **#10 — Inconsistencia fetch: ghFetch() vs fetch() directo**
- **Esfuerzo:** 30 min
- **Estado:** ⏳ Pendiente
- **Archivos:** `client/src/services/actionExecutor.ts`, `client/src/services/github.ts`
- **Problema:** `actionExecutor.ts` usa `fetch()` directo; debería usar wrapper centralizado.
- **Solución:** Exponer `ghFetch()` desde `github.ts` y usarlo en casos genéricos del executor.
- **Impacto:** Consistencia, mantenimiento centralizado de headers/autenticación

---

### **#13 — Internacionalización (i18n)**
- **Esfuerzo:** 3-4h
- **Estado:** ⏳ Pendiente
- **Alcance:** App completamente en español (UI, prompts, mensajes)
- **Solución:** 
  - Extraer todos los strings a `src/locales/es.json` y `en.json`
  - Configurar `i18next`
  - Añadir selector de idioma en header
  - Adaptar system prompts según idioma
- **Impacto:** Soporte multiidioma, accesibilidad global

---

## 📊 Resumen Global

| Categoría | Total | ✅ Resueltos | ⏳ Pendientes |
|-----------|-------|------------|------------|
| **Alta** | 1 | 1 | 0 |
| **Media** | 3 | 0 | 3 |
| **Baja** | 3 | 0 | 3 |
| **TOTAL** | 13 | 7 | 6 |

---

## 🎯 Próximas Sprints Recomendadas

### Sprint 1 (Prioridad Alta)
- [ ] #5 — Extraer DocModal (20 min)
- [ ] #6 — Extraer formatResultData (20 min)
- **Tiempo total:** 40 min

### Sprint 2 (Prioridad Media)
- [ ] #8 — Truncamiento semántico (1-2h)
- [ ] #9 — crypto.randomUUID() (5 min)
- **Tiempo total:** 1h 5min

### Sprint 3 (Prioridad Baja)
- [ ] #10 — Unificar fetch (30 min)
- [ ] #13 — i18n (3-4h)
- **Tiempo total:** 3h 30min

---

## 📈 Métricas de Código

| Métrica | v2.3 | v2.4 | Mejora |
|---------|------|------|--------|
| Funciones exportadas de gemini.ts | 4 | 6 | +50% (generateRepoDocs, detectPrimaryLanguage) |
| Métodos HTTP soportados | 4 | 5 | +25% (añadido PATCH) |
| ESLint suppressions en cliente | 1 | 0 | -100% |
| Tests unitarios | 0 | 51 | ✨ Nueva suite |

---

## 🔗 Referencias

- **CHANGELOG.md** — Historial de cambios por versión
- **IMPLEMENTATION_SUMMARY_v2.4.md** — Detalles técnicos de v2.4
- **MANUAL_TECNICO.md** — Arquitectura completa
- **README.md** — Documentación general del proyecto

---

## 📝 Notas para Desarrolladores

### Convenciones

- Los puntos resueltos se marcan con ✅ y se dejan documentados como referencia histórica
- Los pendientes usan ⏳ y especifican esfuerzo en minutos/horas
- Cada punto incluye ubicación exacta (archivo + línea si es aplicable)

### Cómo Actualizar Este Documento

1. Cuando resuelvas un punto, cámbialo de sección (Pendientes → Resueltos)
2. Añade la versión en que se resolvió (ej: v2.5)
3. Actualiza la tabla de resumen
4. Crea un commit: `docs: mark issue #X as resolved in v2.X`

---

<p align="center">
  <sub>
    Análisis inicial: Claude (Anthropic) · Junio 2026 | 
    Actualizado: v2.4 | 
    Próxima revisión recomendada: v2.5
  </sub>
</p>
