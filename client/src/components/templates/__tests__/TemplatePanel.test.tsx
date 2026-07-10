import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import TemplatePanel from '../TemplatePanel';

/** Mock translations for the sidebar templates. */
const mockT = (key: string): string => {
  const map: Record<string, string> = {
    'tmpl_panel.cat_readme.name': 'README',
    'tmpl_panel.cat_gitignore.name': '.gitignore',
    'tmpl_panel.cat_licenses.name': 'Licencias',
    'tmpl_panel.tmpl_readme-python.name': 'Python',
    'tmpl_panel.tmpl_readme-python.description': 'README para proyecto Python',
    'tmpl_panel.tmpl_readme-python.instruction': 'instrucción Python',
    'tmpl_panel.tmpl_gitignore-python.name': 'Python',
    'tmpl_panel.tmpl_gitignore-python.description': '.gitignore para Python',
    'tmpl_panel.tmpl_gitignore-python.instruction': 'instrucción gitignore Python',
    'tmpl_panel.tmpl_license-mit.name': 'MIT',
    'tmpl_panel.tmpl_license-mit.description': 'Licencia MIT',
    'tmpl_panel.tmpl_license-mit.instruction': 'instrucción MIT',
  };
  return map[key] || key;
};

// Mock LanguageContext
vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: mockT }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/** Devuelve un elemento por id, fallando si no existe (los botones de categoría
 *  y plantilla llevan ids estables como `template-cat-readme`). */
function byId(container: HTMLElement, id: string): HTMLElement {
  const el = container.querySelector(`#${id}`);
  if (!el) throw new Error(`No se encontró #${id}`);
  return el as HTMLElement;
}

describe('TemplatePanel', () => {
  it('renderiza las categorías de plantillas', () => {
    const { container } = render(<TemplatePanel isOpen={true} onSelectTemplate={vi.fn()} />);
    expect(byId(container, 'template-cat-readme')).toBeInTheDocument();
    expect(byId(container, 'template-cat-gitignore')).toBeInTheDocument();
  });

  it('la categoría README está abierta por defecto', () => {
    const { container } = render(<TemplatePanel isOpen={true} onSelectTemplate={vi.fn()} />);
    expect(byId(container, 'template-cat-readme')).toHaveAttribute('aria-expanded', 'true');
  });

  it('alterna una categoría: la cierra al pulsar (rama delete)', () => {
    const { container } = render(<TemplatePanel isOpen={true} onSelectTemplate={vi.fn()} />);
    const readmeBtn = byId(container, 'template-cat-readme');
    fireEvent.click(readmeBtn);
    expect(readmeBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('alterna una categoría: la abre al pulsar (rama add)', () => {
    const { container } = render(<TemplatePanel isOpen={true} onSelectTemplate={vi.fn()} />);
    const gitignoreBtn = byId(container, 'template-cat-gitignore');
    expect(gitignoreBtn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(gitignoreBtn);
    expect(gitignoreBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('llama a onSelectTemplate al elegir una plantilla', () => {
    const onSelect = vi.fn();
    const { container } = render(<TemplatePanel isOpen={true} onSelectTemplate={onSelect} />);
    // La categoría README está abierta → sus plantillas son visibles
    fireEvent.click(byId(container, 'template-readme-python'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(typeof onSelect.mock.calls[0][0]).toBe('string');
  });
});
