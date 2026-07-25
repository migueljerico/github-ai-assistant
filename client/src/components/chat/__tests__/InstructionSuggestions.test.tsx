import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InstructionSuggestions from '../InstructionSuggestions';

// El LanguageContext está mockeado globalmente en setup.ts con el diccionario es,
// así que buildTemplates(t) devuelve plantillas con sus textos reales. Esto nos
// permite filtrar por tokens del título (p.ej. "readme", "issue") de forma realista.

describe('InstructionSuggestions (componente) (#22, v3.50.2)', () => {
  const baseProps = {
    inputValue: '/',
    onSelectTemplate: vi.fn(),
    isOpen: true,
    onOpenChange: vi.fn(),
  };

  it('con solo "/" muestra las primeras 5 plantillas por defecto', () => {
    render(<InstructionSuggestions {...baseProps} />);
    // Cada sugerencia es un botón con clase .suggestion-item
    const items = screen.getAllByRole('button').filter(b =>
      b.className.includes('suggestion-item'),
    );
    expect(items).toHaveLength(5);
  });

  it('filtra las plantillas según el input y limita a 8', () => {
    // query amplia para forzar el límite de 8
    const { rerender } = render(<InstructionSuggestions {...baseProps} inputValue="/a" />);
    let items = screen.getAllByRole('button').filter(b => b.className.includes('suggestion-item'));
    expect(items.length).toBeLessThanOrEqual(8);

    // query específica: "readme" deja pocas coincidencias
    rerender(<InstructionSuggestions {...baseProps} inputValue="/readme" />);
    items = screen.getAllByRole('button').filter(b => b.className.includes('suggestion-item'));
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items.length).toBeLessThanOrEqual(8);
  });

  it('no renderiza nada si isOpen=false', () => {
    render(<InstructionSuggestions {...baseProps} isOpen={false} />);
    expect(screen.queryByText(/Sugerencias|suggestions/i)).not.toBeInTheDocument();
  });

  it('no renderiza nada si el filtrado no produce coincidencias', () => {
    render(<InstructionSuggestions {...baseProps} inputValue="/zzzzzzz-no-existe" />);
    expect(screen.queryByText(/Sugerencias|suggestions/i)).not.toBeInTheDocument();
  });

  it('al hacer click en una sugerencia llama a onSelectTemplate con la plantilla', () => {
    const onSelect = vi.fn();
    render(<InstructionSuggestions {...baseProps} onSelectTemplate={onSelect} />);

    const items = screen.getAllByRole('button').filter(b => b.className.includes('suggestion-item'));
    fireEvent.click(items[0]);

    expect(onSelect).toHaveBeenCalledTimes(1);
    const arg = onSelect.mock.calls[0][0];
    expect(arg).toHaveProperty('id');
    expect(arg).toHaveProperty('template');
  });

  it('ArrowDown/ArrowUp mueven la selección cíclicamente', () => {
    render(<InstructionSuggestions {...baseProps} />);

    const items = () =>
      screen.getAllByRole('button').filter(b => b.className.includes('suggestion-item'));

    // Al inicio nada está seleccionado
    expect(items().find(i => i.className.includes('selected'))).toBeUndefined();

    // ArrowDown → selecciona la primera (índice 0)
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(items()[0].className.includes('selected')).toBe(true);

    // Otra ArrowDown → selecciona la segunda (índice 1)
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(items()[1].className.includes('selected')).toBe(true);

    // ArrowUp vuelve a la primera
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(items()[0].className.includes('selected')).toBe(true);
  });

  it('ArrowDown al final de la lista vuelve al principio (cíclico)', () => {
    render(<InstructionSuggestions {...baseProps} />);

    const items = () =>
      screen.getAllByRole('button').filter(b => b.className.includes('suggestion-item'));

    // Saltamos hasta el final y luego uno más
    for (let i = 0; i < items().length; i++) {
      fireEvent.keyDown(window, { key: 'ArrowDown' });
    }
    // Una pulsación más: debe volver al índice 0 (módulo length)
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(items()[0].className.includes('selected')).toBe(true);
  });

  it('Enter sobre la sugerencia seleccionada la invoca vía onSelectTemplate', () => {
    const onSelect = vi.fn();
    render(<InstructionSuggestions {...baseProps} onSelectTemplate={onSelect} />);

    // Seleccionamos la primera con ArrowDown
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('Enter sin selección previa no llama a onSelectTemplate', () => {
    const onSelect = vi.fn();
    render(<InstructionSuggestions {...baseProps} onSelectTemplate={onSelect} />);

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('Escape cierra el popover vía onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    render(<InstructionSuggestions {...baseProps} onOpenChange={onOpenChange} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('ArrowUp desde el inicio salta a una posición válida (cíclico negativo)', () => {
    render(<InstructionSuggestions {...baseProps} />);

    const items = () =>
      screen.getAllByRole('button').filter(b => b.className.includes('suggestion-item'));

    // Desde selectedIndex=-1: ArrowUp calcula (-1 - 1 + length) % length.
    // Con 5 items → 3. Lo que importa es que aterrizamos en un índice válido
    // (no negativo, no NaN) y hay exactamente una sugerencia seleccionada.
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    const selected = items().filter(i => i.className.includes('selected'));
    expect(selected).toHaveLength(1);
  });

  it('cambiar el input resetea el índice de selección a -1', () => {
    const { rerender } = render(<InstructionSuggestions {...baseProps} inputValue="/" />);

    // Seleccionamos la primera
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    const items = () =>
      screen.getAllByRole('button').filter(b => b.className.includes('suggestion-item'));
    expect(items()[0].className.includes('selected')).toBe(true);

    // Cambiamos el input → efecto resetea selectedIndex a -1
    rerender(<InstructionSuggestions {...baseProps} inputValue="/a" />);
    // En el nuevo renderizado ninguna debería estar seleccionada
    expect(items().find(i => i.className.includes('selected'))).toBeUndefined();
  });

  it('onMouseEnter marca la sugerencia como seleccionada', () => {
    render(<InstructionSuggestions {...baseProps} />);

    const items = () =>
      screen.getAllByRole('button').filter(b => b.className.includes('suggestion-item'));

    fireEvent.mouseEnter(items()[2]);
    expect(items()[2].className.includes('selected')).toBe(true);
  });

  it('las teclas de navegación no hacen nada si isOpen=false', () => {
    const onSelect = vi.fn();
    render(
      <InstructionSuggestions {...baseProps} isOpen={false} onSelectTemplate={onSelect} />,
    );

    // Aunque el listener siga activo, el guard `if (!isOpen...) return` lo corta
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('#69: sin trigger "/" no renderiza sugerencias (input normal de chat)', () => {
    // Aunque isOpen=true, el input "explícame el repo" no empieza por '/' → 0 items.
    render(<InstructionSuggestions {...baseProps} inputValue="explícame el repo" />);
    const items = screen.queryAllByRole('button').filter(b =>
      b.className.includes('suggestion-item'),
    );
    expect(items).toHaveLength(0);
    expect(screen.queryByText(/Sugerencias|suggestions/i)).not.toBeInTheDocument();
  });

  it('#69: con trigger "/" pero isOpen forzado a false no renderiza nada', () => {
    // El guard de isOpen tiene prioridad sobre la presencia de sugerencias.
    render(<InstructionSuggestions {...baseProps} inputValue="/" isOpen={false} />);
    expect(screen.queryByText(/Sugerencias|suggestions/i)).not.toBeInTheDocument();
  });
});
