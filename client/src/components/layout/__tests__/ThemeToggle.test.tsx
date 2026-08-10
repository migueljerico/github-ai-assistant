import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ThemeToggle from '../ThemeToggle';
import { LanguageProvider } from '../../../context/LanguageContext';
import * as ThemeModule from '../../../context/ThemeContext';
import type { Theme } from '../../../context/ThemeContext';

function renderThemeToggle(theme: Theme = 'light', toggle = vi.fn()) {
  vi.spyOn(ThemeModule, 'useTheme').mockReturnValue({
    theme,
    resolvedTheme: theme === 'auto' ? 'dark' : theme,
    setTheme: vi.fn(),
    toggle,
  });

  return render(
    <LanguageProvider>
      <ThemeToggle />
    </LanguageProvider>
  );
}

describe('ThemeToggle (#71)', () => {
  it('renderiza tema claro con emoji ☀️', () => {
    renderThemeToggle('light');
    const btn = screen.getByRole('button');
    expect(btn).toHaveTextContent('☀️');
    expect(btn).toHaveTextContent(/Claro|Light/i);
  });

  it('renderiza tema oscuro con emoji 🌙', () => {
    renderThemeToggle('dark');
    const btn = screen.getByRole('button');
    expect(btn).toHaveTextContent('🌙');
    expect(btn).toHaveTextContent(/Oscuro|Dark/i);
  });

  it('renderiza tema auto con emoji 🌓', () => {
    renderThemeToggle('auto');
    const btn = screen.getByRole('button');
    expect(btn).toHaveTextContent('🌓');
    expect(btn).toHaveTextContent(/Auto/i);
  });

  it('llama a toggle al pulsar el botón', () => {
    const toggle = vi.fn();
    renderThemeToggle('light', toggle);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(toggle).toHaveBeenCalledTimes(1);
  });
});
