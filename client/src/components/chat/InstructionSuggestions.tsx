/**
 * InstructionSuggestions — Autocomplete component for chat instructions
 * 
 * Displays filtered instruction templates as user types
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { filterInstructions, buildTemplates, type InstructionTemplate } from '../../utils/instructionSuggestions';
import { useLanguage } from '../../context/LanguageContext';
import './InstructionSuggestions.css';

interface InstructionSuggestionsProps {
  inputValue: string;
  onSelectTemplate: (template: InstructionTemplate) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InstructionSuggestions({
  inputValue,
  onSelectTemplate,
  isOpen,
  onOpenChange,
}: InstructionSuggestionsProps) {
  const { t } = useLanguage();
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Plantillas traducidas al idioma activo (se reconstruyen si cambia el idioma).
  const templates = useMemo(() => buildTemplates(t), [t]);

  // #69: trigger '/'. El popover solo ofrece sugerencias cuando el input empieza
  // por '/'; cualquier otro texto (o input vacío) no produce coincidencias y por
  // tanto mantiene el popover cerrado. Convención Slack/GitHub/Linear.
  const suggestions = useMemo<InstructionTemplate[]>(() => {
    const trimmed = inputValue.trim();
    if (!trimmed.startsWith('/')) {
      return [];
    }
    // La query de filtrado es lo que sigue a '/' (p.ej. '/issue' → 'issue').
    const query = trimmed.slice(1);
    if (query.length === 0) {
      // Solo '/' → mostrar las primeras 5 como guía inicial.
      return templates.slice(0, 5);
    }
    const filtered = filterInstructions(query, templates);
    return filtered.slice(0, 8); // Limit to 8 suggestions
  }, [inputValue, templates]);

  // Sincronizar la apertura del popover con el resultado del filtrado. Es un
  // side-effect sobre una prop callback del padre (no un setState local), así
  // que no dispara set-state-in-effect. #69: solo abre con trigger '/' y si hay
  // coincidencias reales (delega el cálculo en `suggestions`, fuente única).
  useEffect(() => {
    onOpenChange(suggestions.length > 0);
  }, [suggestions, onOpenChange]);

  // Reset de la selección al cambiar el input. Legítimo: la selección anterior
  // ya no aplica a la lista nueva. Silenciamos in situ.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset de selección al cambiar el input
    setSelectedIndex(-1);
  }, [inputValue]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % suggestions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0) {
            onSelectTemplate(suggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          onOpenChange(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, suggestions, selectedIndex, onSelectTemplate, onOpenChange]);

  if (!isOpen || suggestions.length === 0) return null;

  return (
    <div ref={containerRef} className="instruction-suggestions">
      <div className="suggestions-header">
        <span className="suggestions-title">{t('chat.suggestions.title')}</span>
        <span className="suggestions-count">{suggestions.length}</span>
      </div>
      <div className="suggestions-list">
        {suggestions.map((template, index) => (
          <button
            key={template.id}
            className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
            onClick={() => onSelectTemplate(template)}
            onMouseEnter={() => setSelectedIndex(index)}
            title={template.description}
          >
            <span className="suggestion-emoji">{template.emoji}</span>
            <div className="suggestion-content">
              <div className="suggestion-title">{template.title}</div>
              <div className="suggestion-desc">{template.description}</div>
            </div>
            <span className="suggestion-category">{template.category}</span>
          </button>
        ))}
      </div>
      <div className="suggestions-footer">
        <span className="suggestions-hint">{t('chat.suggestions.hint')}</span>
      </div>
    </div>
  );
}
