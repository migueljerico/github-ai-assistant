import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import TemplatePanel from '../TemplatePanel';

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
