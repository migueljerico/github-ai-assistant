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
  'mejora', 'mejorar', 'propón', 'propon', 'propuesta', 'sugerencia',
  'analiza', 'análisis', 'analisis', 'evalúa', 'evalua', 'valoración',
  'qué te parece', 'que te parece', 'cómo puedo', 'como puedo',
  'debería', 'deberia', 'es buena', 'es malo', 'es mejor',
  'ventajas', 'desventajas', 'pros', 'contras',
  'explícame', 'explicame', 'qué es', 'que es', 'cómo funciona',
  'ayuda', 'help', 'guía', 'guia', 'tutorial',
  'documentación', 'documentacion', 'información', 'informacion',
];

// Verbos de acción explícitos (operaciones sobre la GitHub API).
const ACTION_KEYWORDS = [
  'lista', 'muéstrame', 'muestra', 'enséñame', 'enseñame', 'ver',
  'lee', 'leer', 'abre', 'abrir', 'carga', 'cargar',
  'crea', 'crear', 'genera', 'generar', 'haz', 'hacer',
  'actualiza', 'actualizar', 'modifica', 'modificar', 'edita', 'editar',
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
