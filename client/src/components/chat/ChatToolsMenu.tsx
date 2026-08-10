import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface ChatToolsMenuProps {
  children: React.ReactNode;
  disabled?: boolean;
}

export default function ChatToolsMenu({ children, disabled }: ChatToolsMenuProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Manejar navegación por teclado dentro del menú
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    
    // Obtener todos los elementos interactivos dentro del menú
    const elements = Array.from(
      menuRef.current?.querySelectorAll('button:not([disabled]), [href]:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || []
    ) as HTMLElement[];
    
    if (elements.length === 0) return;
    
    const currentIndex = elements.indexOf(document.activeElement as HTMLElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = currentIndex < elements.length - 1 ? currentIndex + 1 : 0;
      elements[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : elements.length - 1;
      elements[prevIndex]?.focus();
    }
  };

  return (
    <div className="chat-tools-menu-container" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        ref={buttonRef}
        type="button"
        className="doc-repo-btn chat-tools-menu-btn"
        disabled={disabled}
        onClick={() => setIsOpen(prev => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={t('chat.moreTools') || 'Más herramientas'}
        aria-label={t('chat.moreTools') || 'Más herramientas'}
      >
        ⚙️ {t('chat.moreTools') || 'Más herramientas'} <span style={{ fontSize: '0.8em', marginLeft: '4px' }}>▼</span>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="chat-tools-menu-dropdown"
          role="menu"
          onKeyDown={handleKeyDown}
          style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            left: 'auto',
            transform: 'none',
            marginBottom: '8px',
            backgroundColor: 'var(--bg-elevated, #fff)',
            border: '1px solid var(--border-color, #ccc)',
            borderRadius: '8px',
            padding: '8px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            minWidth: '240px',
            maxWidth: '320px',
            maxHeight: '380px',
            overflowY: 'auto',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
