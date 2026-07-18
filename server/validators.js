// ─── Validadores de body para los proxies /api/* (Hallazgos #1+#3, v3.50.0) ────
//
// Los proxies de chat (/api/gemini, /api/nim, /api/openzen, /api/cloudflare,
// /api/ollama, /api/aiand) reenvían el body del cliente al upstream casi tal cual.
// Antes de v3.50.0 solo validaban la presencia de la API key; un cliente podía
// enviar bodies malformados que llegaban al proveedor y consumían cuota/token.
//
// Estos helpers validan la ESTRUCTURA del body (no auth, no sesión — ver la
// nota sobre Zero-Storage más abajo) y se reutilizan en todos los handlers POST.
//
// Límites:
//   - express.json({ limit: '4mb' }) ya acota el tamaño total del body a nivel
//     global (server/index.js:44). Aquí validamos la FORMA de `messages`:
//     array no vacío, cada item con role+content strings, longitudes razonables.
//
// NOTA Zero-Storage: NADA se persiste en servidor. La API key del usuario viaja
// en cada llamada (header Authorization) y se descarta al terminar. Esta
// validación es de CONTENIDO/body, no de sesión — el proxy no tiene auth de
// aplicación por diseño (el frontend solo usa sesión para OAuth login).

export const MAX_MESSAGES = 200;       // turnos máximos por petición
export const MAX_CONTENT_BYTES = 100_000;  // ~100KB por mensaje (texto plano)

const VALID_ROLES = new Set(['system', 'user', 'assistant', 'developer', 'tool']);

/**
 * Comprueba que `req.body.messages` es un array no vacío de mensajes con la
 * forma { role: string, content: string }. Devuelve un string de error humano
 * legible si algo falla, o null si el body es válido.
 *
 * No valida apiKey/model/systemPrompt: cada handler ya comprueba esos campos
 * (en estilo propio) y el shape exacto varía entre Gemini (estructurado) y los
 * proxies OpenAI-compatibles (passthrough). `messages` sí es común a todos.
 *
 * Exportada para tests unitarios; los handlers la llaman vía validateChatBody.
 */
export function validateMessages(messages) {
  if (!Array.isArray(messages)) {
    return 'El cuerpo de la petición debe incluir "messages" como array.';
  }
  if (messages.length === 0) {
    return '"messages" no puede estar vacío.';
  }
  if (messages.length > MAX_MESSAGES) {
    return `"messages" excede el máximo de ${MAX_MESSAGES} turnos por petición.`;
  }
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const where = `messages[${i}]`;
    if (!m || typeof m !== 'object' || Array.isArray(m)) {
      return `${where} debe ser un objeto { role, content }.`;
    }
    if (typeof m.role !== 'string' || m.role.length === 0) {
      return `${where}.role debe ser un string no vacío.`;
    }
    // OpenAI admite roles {system, user, assistant, developer, tool}. No
    // rechazamos roles desconocidos (algunos proveedores aceptan los suyos),
    // pero avisamos de los habituales en el JSDoc para mantener el contexto.
    // Gemini mapea internamente assistant→model en el handler.
    if (typeof m.content !== 'string') {
      return `${where}.content debe ser un string (no se admiten cargas multimodales).`;
    }
    // Byte length real: Buffer.byteLength cuenta UTF-8 correctamente.
    if (Buffer.byteLength(m.content, 'utf8') > MAX_CONTENT_BYTES) {
      return `${where}.content supera el máximo de ${MAX_CONTENT_BYTES} bytes por mensaje.`;
    }
    if (!VALID_ROLES.has(m.role)) {
      return `${where}.role "${m.role}" no es uno de: ${[...VALID_ROLES].join(', ')}.`;
    }
  }
  return null;
}

/**
 * Middleware express para los 6 handlers POST de chat. Si el body no es JSON
 * válido o `messages` falla la validación, responde 4xx y corta la cadena.
 *
 * Uso:
 *   app.post('/api/nim', nimLimiter, validateChatBody, async (req, res) => { ... });
 *
 * El check de content-type lo hace express.json() (solo parsea si es JSON),
 * pero reforzamos explícitamente para rechazar peticiones con content-type
 * raro antes de tocar req.body.
 */
export function validateChatBody(req, res, next) {
  // (a) content-type: express.json() ya responde 400 si el JSON es inválido o
  // falta el charset, pero el body podría llegar parseado pese a un content-type
  // inesperado. Reforzamos: el proxy reenvía JSON, así que exigimos JSON.
  const ct = req.headers['content-type'] || '';
  if (!ct.toLowerCase().includes('application/json')) {
    return res.status(415).json({
      error: 'Content-Type debe ser application/json.',
    });
  }
  // (b) estructura de messages. Si el handler no necesita messages (p.ej. un
  // futuro endpoint), `req.body` puede ser undefined/null → array check cubre.
  const err = validateMessages(req.body?.messages);
  if (err) {
    return res.status(400).json({ error: err });
  }
  next();
}
