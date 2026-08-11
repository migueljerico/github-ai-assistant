// ────────────────────────────────────────────────────────────────────────────
// Detección de modo (Opción D): decide si una instrucción del usuario va a modo
// "chat" (consultor, texto) o "action" (agente GitHub, JSON). Extraído de App.tsx
// para poder testearlo de forma aislada.
// ────────────────────────────────────────────────────────────────────────────

export type ChatMode = 'chat' | 'action';
export type ModeOverride = 'auto' | ChatMode | 'review';

// Palabras que sugieren conversación / petición de opinión.
const CONVERSATION_KEYWORDS = [
  'opinión', 'opinion', 'qué opinas', 'que opinas', 'piensas',
  'consejo', 'recomendación', 'recomendacion', 'recomiendas',
  'crítica', 'critica', 'constructiva', 'constructivo', 'feedback',
  'propón', 'propon', 'propuesta', 'sugerencia',
  'analiza', 'análisis', 'analisis', 'evalúa', 'evalua', 'valoración',
  'qué te parece', 'que te parece', 'cómo puedo', 'como puedo',
  'debería', 'deberia', 'es buena', 'es malo', 'es mejor',
  'ventajas', 'desventajas', 'pros', 'contras',
  'explícame', 'explicame', 'qué es', 'que es', 'cómo funciona',
  'ayuda', 'help', 'guía', 'guia', 'tutorial',
  'documentación', 'documentacion', 'información', 'informacion',
];

// Verbos de acción explícitos (operaciones sobre la GitHub API o modificación de archivos/repos).
const ACTION_KEYWORDS = [
  'lista', 'muéstrame', 'muestra', 'enséñame', 'enseñame', 'ver',
  'lee', 'leer', 'abre', 'abrir', 'carga', 'cargar',
  'crea', 'crear', 'genera', 'generar', 'haz', 'hacer',
  'actualiza', 'actualizar', 'modifica', 'modificar', 'edita', 'editar',
  'mejora', 'mejorar', 'aplica', 'aplicar', 'corrige', 'corregir', 'arregla', 'arreglar', 'perfecciona', 'perfeccionar',
  'borra', 'borrar', 'elimina', 'eliminar', 'quita', 'quitar',
  'cierra', 'cerrar', 'reabre', 'reabrir',
  'fusiona', 'merge', 'une', 'unir',
  'comenta', 'comentar', 'responde', 'responder',
  'ejecuta', 'ejecutar', 'rerun', 'corre', 'correr',
  'sube', 'subir', 'publica', 'publicar',
  'descarga', 'descargar', 'clona', 'clonar',
];

export function isConversationRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return CONVERSATION_KEYWORDS.some(k => lower.includes(k));
}

export function isActionRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return ACTION_KEYWORDS.some(k => lower.includes(k));
}

/**
 * Resultado de la detección de desajuste de modo (v3.56.0). Si el usuario FORZÓ un modo
 * con el selector pero lo que escribió encaja claramente con el otro, sugerimos
 * cambiar con un botón de 1 clic. `suggestMode` es el modo recomendado; `retryText`
 * es la frase original para reenviarla automáticamente tras el cambio.
 */
export interface ModeMismatch {
  suggestMode: 'chat' | 'action';
  retryText: string;
}

/**
 * v3.56.0: detecta cuando el modo seleccionado a mano no encaja con la intención del
 * mensaje. Solo aplica a overrides explícitos (`chat`/`action`/`review`); en `auto`
 * nunca hay mismatch porque auto ya decide por sí mismo.
 *
 * Reglas (simétricas, basadas en las keyword lists existentes):
 *  - Está en `chat`/`opinión` y pide claramente una ACCIÓN (verbo de acción y ningún
 *    verbo de opinión) → sugerir `action`.
 *  - Está en `action`/`review` y pide claramente una OPINIÓN (verbo de opinión y ningún
 *    verbo de acción) → sugerir `chat`.
 *
 * La exigencia de "y no el otro" evita falsos positivos en frases ambiguas: si la
 * intención no está clara, no sugerimos nada (devolvemos null) y dejamos que el modo
 * seleccionado siga su curso.
 */
export function detectModeMismatch(
  message: string,
  override: ModeOverride,
): ModeMismatch | null {
  if (override === 'auto') return null;
  const isConversation = isConversationRequest(message);
  const isAction = isActionRequest(message);

  // En modo opinión forzado, pero claramente pide una acción → sugerir acción.
  if (override === 'chat' && isAction && !isConversation) {
    return { suggestMode: 'action', retryText: message };
  }
  // En modo acción/revisión forzado, pero claramente pide opinión → sugerir opinión.
  if ((override === 'action' || override === 'review') && isConversation && !isAction) {
    return { suggestMode: 'chat', retryText: message };
  }
  return null;
}

/**
 * Decide el modo final.
 * - Si hay override manual ('chat'/'action'), se respeta.
 * - En 'auto':
 *   - CON archivo adjunto (#28): SIEMPRE chat. Un archivo local vive solo en el
 *     navegador y ninguna acción de GitHub puede leerlo; lo único que se hace con
 *     él es conversar o documentarlo (con su botón). Así evitamos que verbos
 *     incidentales de la frase (p. ej. "el PBIX que acabo de *subir*") lo desvíen a
 *     modo acción y produzcan un endpoint con placeholders inútil. Para operar sobre
 *     GitHub con un archivo adjunto, el usuario usa el toggle manual de Acción.
 *   - SIN contexto de repo: chat solo si parece conversación y no acción
 *     (comportamiento conservador histórico).
 *   - CON contexto de repo cargado (#41): se sesga a chat (el usuario cargó el
 *     repo para conversar sobre él); solo va a acción si es claramente una acción
 *     explícita y no una pregunta de opinión.
 */
export function resolveMode(
  message: string,
  override: ModeOverride,
  hasRepoContext: boolean,
  hasFileContext = false,
): ChatMode {
  // #58 (c): 'review' se comporta como 'action' (necesita JSON) pero el flag
  // reviewMode en runSend acumula las acciones en vez de abrir ConfirmModal.
  if (override === 'review') return 'action';
  if (override !== 'auto') return override;

  if (hasFileContext) return 'chat';

  const isConversation = isConversationRequest(message);
  const isAction = isActionRequest(message);

  if (hasRepoContext) {
    return isAction && !isConversation ? 'action' : 'chat';
  }
  return isConversation && !isAction ? 'chat' : 'action';
}
