import React, { useState, useRef, useEffect } from 'react';
import { useLanguage, LANGUAGES, type Language } from '../../context/LanguageContext';
import FlagIcon from './FlagIcon';

export default function LanguageSelector() {
  const { lang, setLang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentOption = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  // Cerrar al hacer clic fuera o al pulsar Esc
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (code: Language) => {
    setLang(code);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'inline-block', marginLeft: '8px' }}
    >
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select language"
        title={`Idioma: ${currentOption.nativeName} (${currentOption.code.toUpperCase()})`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 8px',
          fontSize: '0.85rem',
          cursor: 'pointer',
        }}
      >
        <FlagIcon code={currentOption.code} size={14} />
        <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{currentOption.code.toUpperCase()}</span>
        <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>▼</span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Languages"
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: '4px',
            backgroundColor: 'var(--bg-secondary, #1e293b)',
            border: '1px solid var(--border-color, #334155)',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            minWidth: '170px',
            maxHeight: '300px',
            overflowY: 'auto',
            padding: '4px',
          }}
        >
          {LANGUAGES.map((option) => {
            const isSelected = option.code === lang;
            return (
              <div
                key={option.code}
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
                onClick={() => handleSelect(option.code)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(option.code);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  backgroundColor: isSelected ? 'var(--bg-tertiary, #334155)' : 'transparent',
                  color: isSelected ? 'var(--text-primary, #ffffff)' : 'var(--text-secondary, #cbd5e1)',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <FlagIcon code={option.code} size={14} />
                <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{option.nativeName}</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.6, fontFamily: 'monospace' }}>
                  {option.code.toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
