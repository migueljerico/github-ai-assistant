import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChatInput from '../ChatInput';

function setup(overrides: Partial<React.ComponentProps<typeof ChatInput>> = {}) {
  const props: React.ComponentProps<typeof ChatInput> = {
    value: '',
    onChange: vi.fn(),
    onSend: vi.fn(),
    onStop: vi.fn(),
    isLoading: false,
    disabled: false,
    multiRepoEnabled: false,
    onMultiRepoChange: vi.fn(),
    selectedRepos: [],
    onSelectedReposChange: vi.fn(),
    onOpenDocumentFlow: vi.fn(),
    onSummarizeThread: vi.fn(),
    onGenerateChangelog: vi.fn(),
    onCodeHealth: vi.fn(),
    onExportConversation: vi.fn(),
    onImportConversation: vi.fn(),
    hasMessages: false,
    repoContextName: null,
    onLoadRepoContext: vi.fn(),
    onClearRepoContext: vi.fn(),
    fileContextNames: [],
    onAttachFiles: vi.fn(),
    onClearFileAt: vi.fn(),
    onClearAllFiles: vi.fn(),
    modeOverride: 'auto',
    onModeOverrideChange: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<ChatInput {...props} />) };
}

describe('ChatInput — selector de modo (v3.56.0)', () => {
  it('el botón Acción muestra el emoji ⚡ (regresión del emoji roto)', () => {
    setup();
    const actionBtn = screen.getByText(/Acción/);
    expect(actionBtn.textContent).toContain('⚡');
    // Y NO contiene el variation selector huérfano (U+FE0F sin base) que rompía antes.
    expect(actionBtn.textContent).not.toContain('\uFE0F');
  });

  it('renderiza los 4 botones de modo con sus etiquetas', () => {
    setup();
    expect(screen.getByText(/🤖 Auto/)).toBeInTheDocument();
    expect(screen.getByText(/💬 Opinión/)).toBeInTheDocument();
    expect(screen.getByText(/⚡ Acción/)).toBeInTheDocument();
    expect(screen.getByText(/📋 Modo Revisión/)).toBeInTheDocument();
  });

  it('muestra la línea de ayuda del modo activo', () => {
    setup({ modeOverride: 'action' });
    // La clave chat.modeHelp.action contiene "confirmación".
    expect(screen.getByText(/confirmación/i)).toBeInTheDocument();
  });

  it('cambia la línea de ayuda al cambiar de modo', () => {
    const { rerender } = setup({ modeOverride: 'chat' });
    expect(screen.getByText(/no toco tus repos/i)).toBeInTheDocument();
    rerender(<ChatInput {...setup({ modeOverride: 'action' }).props} modeOverride="action" />);
  });

  it('al pulsar un botón de modo llama onModeOverrideChange con el valor correcto', () => {
    const { props } = setup();
    fireEvent.click(screen.getByText(/🤖 Auto/).closest('button')!);
    expect(props.onModeOverrideChange).toHaveBeenCalledWith('auto');
    fireEvent.click(screen.getByText(/💬 Opinión/).closest('button')!);
    expect(props.onModeOverrideChange).toHaveBeenCalledWith('chat');
  });

  it('cada botón tiene tooltip (title) descriptivo', () => {
    setup();
    const actionBtn = screen.getByText(/⚡ Acción/).closest('button')!;
    expect(actionBtn.getAttribute('title')).toBeTruthy();
    expect(actionBtn.getAttribute('title')!.length).toBeGreaterThan(5);
  });

  it('el botón [?] despliega la guía completa de modos', () => {
    setup();
    const guideBtn = screen.getByRole('button', { name: /qué hace cada botón/i });
    // Inicialmente la guía no está visible (título de la caja).
    expect(screen.queryByText(/¿Para qué sirve cada modo\?/)).not.toBeInTheDocument();
    fireEvent.click(guideBtn);
    expect(screen.getByText(/¿Para qué sirve cada modo\?/)).toBeInTheDocument();
    // Contiene los 4 modos explicados.
    expect(screen.getByText(/Auto.*Detecto/)).toBeInTheDocument();
    expect(screen.getByText(/Opinión.*analizo/)).toBeInTheDocument();
  });

  it('pulsar [?] de nuevo colapsa la guía', () => {
    setup();
    const guideBtn = screen.getByRole('button', { name: /qué hace cada botón/i });
    fireEvent.click(guideBtn);
    expect(screen.getByText(/¿Para qué sirve cada modo\?/)).toBeInTheDocument();
    fireEvent.click(guideBtn);
    expect(screen.queryByText(/¿Para qué sirve cada modo\?/)).not.toBeInTheDocument();
  });
});

describe('ChatInput — botón 🖼️ Documentar con capturas (v3.66.0 Frente D2)', () => {
  it('NO renderiza el botón si no hay imágenes adjuntas', () => {
    setup({ fileContextNames: ['notas.txt', 'datos.csv'] });
    expect(screen.queryByRole('button', { name: /Documentar con capturas/i })).not.toBeInTheDocument();
  });

  it('renderiza el botón cuando hay al menos una imagen adjunta', () => {
    setup({ fileContextNames: ['notas.txt', 'captura.png'] });
    expect(screen.getByRole('button', { name: /Documentar con capturas/i })).toBeInTheDocument();
  });

  it('al pulsarlo abre el flujo de documentación (con el repo de contexto si lo hay)', () => {
    const { props } = setup({ fileContextNames: ['login.png'], repoContextName: 'migueljerico/powerbi-dashboard-mercadona' });
    fireEvent.click(screen.getByRole('button', { name: /Documentar con capturas/i }));
    expect(props.onOpenDocumentFlow).toHaveBeenCalledWith('migueljerico/powerbi-dashboard-mercadona');
  });
});
