import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConversationIOButton from '../ConversationIOButton';

describe('ConversationIOButton (#46)', () => {
  it('muestra los botones Exportar e Importar', () => {
    render(<ConversationIOButton disabled={false} hasMessages={true} onExport={vi.fn()} onImport={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Exportar/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Importar/ })).toBeInTheDocument();
  });

  it('Exportar invoca onExport', () => {
    const onExport = vi.fn();
    render(<ConversationIOButton disabled={false} hasMessages={true} onExport={onExport} onImport={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Exportar/ }));
    expect(onExport).toHaveBeenCalled();
  });

  it('Exportar está deshabilitado si no hay mensajes', () => {
    render(<ConversationIOButton disabled={false} hasMessages={false} onExport={vi.fn()} onImport={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Exportar/ })).toBeDisabled();
  });

  it('elegir un fichero invoca onImport con el File', () => {
    const onImport = vi.fn();
    const { container } = render(<ConversationIOButton disabled={false} hasMessages={true} onExport={vi.fn()} onImport={onImport} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['{}'], 'conv.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onImport).toHaveBeenCalledWith(file);
  });

  it('pulsar Importar desencadena el clic en el input de archivo oculto', () => {
    const { container } = render(<ConversationIOButton disabled={false} hasMessages={true} onExport={vi.fn()} onImport={vi.fn()} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const inputClickSpy = vi.spyOn(input, 'click');
    
    fireEvent.click(screen.getByRole('button', { name: /Importar/ }));
    expect(inputClickSpy).toHaveBeenCalled();
  });

  it('ambos botones deshabilitados cuando disabled=true', () => {
    render(<ConversationIOButton disabled={true} hasMessages={true} onExport={vi.fn()} onImport={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Exportar/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Importar/ })).toBeDisabled();
  });
});

