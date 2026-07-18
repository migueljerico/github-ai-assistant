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

  // Suggestions deriva de inputValue + templates: sin setState, sin effect.
  // Antes esto vivía en un effect que hacía setSuggestions (set-state-in-effect);
  // al derivarlo con useMemo eliminamos el warning y el re-render en cascada.
  const suggestions = useMemo<InstructionTemplate[]>(() => {
    if (inputValue.trim().length === 0) {
      return templates.slice(0, 5); // Show first 5 by default
    }
    const filtered = filterInstructions(inputValue, templates);
    return filtered.slice(0, 8); // Limit to 8 suggestions
  }, [inputValue, templates]);

  // Sincronizar la apertura del popover con el resultado del filtrado. Es un
  // side-effect sobre una prop callback del padre (no un setState local), así
  // que no dispara set-state-in-effect.
  useEffect(() => {
    if (inputValue.trim().length === 0) {
      onOpenChange(true);
    } else {
      const filtered = filterInstructions(inputValue, templates);
      onOpenChange(filtered.length > 0);
    }
  }, [inputValue, templates, onOpenChange]);

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
