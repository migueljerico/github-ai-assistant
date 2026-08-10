import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ChatToolsMenu from '../ChatToolsMenu';
import { LanguageProvider } from '../../../context/LanguageContext';
import React from 'react';

describe('ChatToolsMenu', () => {
  it('debería renderizar el botón y mantener el menú cerrado por defecto', () => {
    render(
      <LanguageProvider>
        <ChatToolsMenu>
          <button data-testid="child-btn">Child</button>
        </ChatToolsMenu>
      </LanguageProvider>
    );
    expect(screen.getByRole('button', { name: /Más herramientas/i })).toBeDefined();
    expect(screen.queryByTestId('child-btn')).toBeNull();
  });

  it('debería abrir el menú al hacer clic', () => {
    render(
      <LanguageProvider>
        <ChatToolsMenu>
          <button data-testid="child-btn">Child</button>
        </ChatToolsMenu>
      </LanguageProvider>
    );
    
    const btn = screen.getByRole('button', { name: /Más herramientas/i });
    fireEvent.click(btn);
    
    expect(screen.getByTestId('child-btn')).toBeDefined();
  });

  it('cierra el menú al hacer clic fuera y con Escape', () => {
    render(
      <LanguageProvider>
        <ChatToolsMenu>
          <button data-testid="child-btn">Child</button>
        </ChatToolsMenu>
      </LanguageProvider>
    );
    
    const btn = screen.getByRole('button', { name: /Más herramientas/i });
    
    // Click outside
    fireEvent.click(btn);
    expect(screen.getByTestId('child-btn')).toBeDefined();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('child-btn')).toBeNull();
    
    // Escape
    fireEvent.click(btn);
    expect(screen.getByTestId('child-btn')).toBeDefined();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('child-btn')).toBeNull();
  });

  it('navega con las flechas del teclado', () => {
    render(
      <LanguageProvider>
        <ChatToolsMenu>
          <button data-testid="btn1">Btn 1</button>
          <button data-testid="btn2">Btn 2</button>
        </ChatToolsMenu>
      </LanguageProvider>
    );
    
    const btn = screen.getByRole('button', { name: /Más herramientas/i });
    fireEvent.click(btn);
    
    const btn1 = screen.getByTestId('btn1');
    const btn2 = screen.getByTestId('btn2');
    
    btn1.focus();
    expect(document.activeElement).toBe(btn1);
    
    const menu = screen.getByRole('menu');
    
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(btn2);
    
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(btn1);

    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(btn2);

    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(btn1);

    // keypress that is not handled
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(document.activeElement).toBe(btn1);

    // keydown on unopen menu
    fireEvent.click(btn);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('soporta navegación por teclado en un menú sin elementos interactivos', () => {
    render(
      <LanguageProvider>
        <ChatToolsMenu>
          <div>Texto plano sin botones</div>
        </ChatToolsMenu>
      </LanguageProvider>
    );

    const btn = screen.getByRole('button', { name: /Más herramientas/i });
    fireEvent.click(btn);

    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();

    expect(() => {
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
    }).not.toThrow();
  });
});
