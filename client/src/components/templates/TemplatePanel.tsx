import { useState } from 'react';
import { buildTemplateCategories } from './templateData';
import type { Template } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface TemplatePanelProps {
  isOpen: boolean;
  onSelectTemplate: (instruction: string) => void;
}

export default function TemplatePanel({ isOpen, onSelectTemplate }: TemplatePanelProps) {
  const { t } = useLanguage();
  const categories = buildTemplateCategories(t);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(['readme']));

  const toggleCategory = (id: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTemplate = (template: Template) => {
    onSelectTemplate(template.instruction);
  };

  return (
    <aside className={`sidebar ${isOpen ? '' : 'collapsed'}`} aria-label={t('templates.ariaLabel')}>
      <div className="sidebar-header">
        <span className="sidebar-title">📋 {t('templates.title')}</span>
      </div>
      <div className="sidebar-content">
        {categories.map(category => {
          const isOpen = openCategories.has(category.id);
          return (
            <div key={category.id} className="template-category">
              <button
                id={`template-cat-${category.id}`}
                className="template-category-btn"
                onClick={() => toggleCategory(category.id)}
                aria-expanded={isOpen}
              >
                <span>{category.emoji} {category.name}</span>
                <span className={`template-category-chevron ${isOpen ? 'open' : ''}`}>›</span>
              </button>
              {isOpen && (
                <div className="template-list">
                  {category.templates.map(template => (
                    <button
                      key={template.id}
                      id={`template-${template.id}`}
                      className="template-item"
                      onClick={() => handleTemplate(template)}
                      title={template.description}
                    >
                      <div>
                        <div className="template-item-name">{template.name}</div>
                        <div className="template-item-desc">{template.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
