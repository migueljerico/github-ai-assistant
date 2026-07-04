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
  const [suggestions, setSuggestions] = useState<InstructionTemplate[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Plantillas traducidas al idioma activo (se reconstruyen si cambia el idioma).
  const templates = useMemo(() => buildTemplates(t), [t]);

  // Filter suggestions based on input
  useEffect(() => {
    if (inputValue.trim().length === 0) {
      setSuggestions(templates.slice(0, 5)); // Show first 5 by default
      onOpenChange(true);
    } else {
      const filtered = filterInstructions(inputValue, templates);
      setSuggestions(filtered.slice(0, 8)); // Limit to 8 suggestions
      onOpenChange(filtered.length > 0);
    }
    setSelectedIndex(-1);
  }, [inputValue, onOpenChange, templates]);

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
