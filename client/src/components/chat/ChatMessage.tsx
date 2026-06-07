import type { ChatMessage } from '../../types';
import { useAuth } from '../../context/AuthContext';

export default function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const { user } = useAuth();
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
        {message.isLoading ? (
          <div className="message-loading">
            <span className="spinner spinner-sm" />
            Pensando...
          </div>
        ) : (
          <div className="message-bubble">
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {message.content}
            </div>

            {/* Action card shown on assistant messages with parsed action */}
            {!isUser && message.action && (
              <div className="message-action-card">
                <div className="action-label">
                  {message.action.requiereConfirmacion ? '⏸️ Acción pendiente de confirmación' : '✅ Acción de lectura'}
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
          </div>
        )}
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', paddingLeft: '4px' }}>
          {message.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
