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
});
