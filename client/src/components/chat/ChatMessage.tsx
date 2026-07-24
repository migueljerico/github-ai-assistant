import type { ChatMessage } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  /**
   * v3.56.0: callback del botón 1-clic "cambiar de modo". Se invoca cuando el mensaje
   * lleva `actionMode` (sugerencia de la IA tras detectar que el modo seleccionado no
   * encajaba con lo que pidió el usuario). Opcional por retrocompatibilidad.
   */
  onSwitchMode?: (mode: 'chat' | 'action', retryText: string) => void;
}

export default function ChatMessageBubble({ message, onSwitchMode }: ChatMessageBubbleProps) {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const isUser = message.role === 'user';

  const avatarContent = isUser ? (
    user?.avatar_url ? (
      <img src={user.avatar_url} alt={user.login} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    ) : '👤'
  ) : '🤖';

  return (
    <div className={`message ${message.role}`} role="article">
      <div className="message-avatar" aria-hidden="true">
        {avatarContent}
      </div>
      <div>
        {message.isLoading && !message.content ? (
          // Estado inicial: aún no ha llegado el primer token (#38).
          <div className="message-loading">
            <span className="spinner spinner-sm" />
            {t('chat.message.thinking')}
          </div>
        ) : (
          <div className="message-bubble">
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {message.content}
              {/* #38: cursor parpadeante mientras llega el streaming */}
              {message.isLoading && <span className="typing-cursor" aria-hidden="true">▍</span>}
            </div>

            {/* Action card shown on assistant messages with parsed action */}
            {!isUser && message.action && (
              <div className="message-action-card">
                <div className="action-label">
                  {message.action.requiereConfirmacion ? t('chat.message.actionPending') : t('chat.message.readAction')}
                </div>
                <div className="action-desc">{message.action.accion}</div>
                <div className="action-meta">
                  {message.action.repo && <span>📁 {message.action.repo}</span>}
                  {message.action.archivo && <span>📄 {message.action.archivo}</span>}
                  <span style={{ marginLeft: 'auto' }}>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', background: 'var(--bg-base)', padding: '2px 6px', borderRadius: '4px' }}>
                      {message.action.metodo} {message.action.endpoint}
                    </code>
                  </span>
                </div>
              </div>
            )}

            {/* #51: archivos del repo consultados para esta respuesta (transparencia
                del contextRanker). Lista plegable nativa, solo en mensajes del
                asistente que se basaron en un contexto de repo. */}
            {!isUser && message.consultedFiles && message.consultedFiles.length > 0 && (
              <details className="message-consulted-files">
                <summary>📂 {t('chat.message.consultedFiles')} ({message.consultedFiles.length})</summary>
                <ul className="consulted-files-list">
                  {message.consultedFiles.map((p) => (
                    <li key={p}><code>{p}</code></li>
                  ))}
                </ul>
              </details>
            )}

            {/* v3.56.0: botón 1-clic para cambiar de modo cuando la IA detectó que el
                seleccionado no encajaba con la petición del usuario. */}
            {!isUser && message.actionMode && onSwitchMode && (
              <div style={{ marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onSwitchMode(message.actionMode!.mode, message.actionMode!.retryText)}
                  style={{ fontSize: '0.85rem', padding: '6px 14px' }}
                >
                  {message.actionMode.mode === 'action'
                    ? t('chat.modeSuggest.toAction.title')
                    : t('chat.modeSuggest.toChat.title')}
                </button>
              </div>
            )}
          </div>
        )}
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', paddingLeft: '4px' }}>
          {message.timestamp.toLocaleTimeString(lang === 'en' ? 'en-US' : 'es-ES', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
