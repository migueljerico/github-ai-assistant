import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, type Mock } from 'vitest';
import ChatInput from '../ChatInput';

/**
 * #69: integración del popover InstructionSuggestions dentro de ChatInput.
 * Cubre las líneas nuevas: import, useState suggestionsOpen, adapter
 * (tpl) => onChange(tpl.template) y el guard `if (suggestionsOpen) return`
 * en handleKeyDown (el textarea cede el Enter al popover).
 *
 * El LanguageContext está mockeado globalmente (setup.ts, diccionario es),
 * así que el header del popover dice "💡 Sugerencias de instrucciones".
 */

function setup(overrides: Partial<React.ComponentProps<typeof ChatInput>> = {}) {
  // Guardamos los mocks con su tipo Mock antes de meterlos en `props` (que TS
  // estrecharía a `(v: string) => void`, perdiendo .mock en el build con tsc).
  const onChange = vi.fn() as unknown as Mock<(v: string) => void>;
  const onSend = vi.fn() as unknown as Mock<() => void>;
  const props: React.ComponentProps<typeof ChatInput> = {
    value: '',
    onChange,
    onSend,
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
  return { props, onChange, onSend, ...render(<ChatInput {...props} />) };
}

const SUGGESTIONS_HEADER = /Sugerencias de instrucciones|Instruction suggestions/i;

describe('ChatInput — integración InstructionSuggestions (#69)', () => {
  it('con value="/" abre el popover de sugerencias', () => {
    setup({ value: '/' });
    // El header del popover aparece solo si hay sugerencias que mostrar.
    expect(screen.getByText(SUGGESTIONS_HEADER)).toBeInTheDocument();
  });

  it('con texto sin "/" no abre el popover (input normal de chat)', () => {
    setup({ value: 'explícame este repo' });
    // El popover solo dispara con el trigger '/'; cualquier otro texto lo mantiene oculto.
    expect(screen.queryByText(SUGGESTIONS_HEADER)).not.toBeInTheDocument();
  });

  it('al pulsar una sugerencia inserta la plantilla vía onChange', () => {
    const { onChange } = setup({ value: '/' });

    // Cada sugerencia es un botón .suggestion-item.
    const items = screen.getAllByRole('button').filter(b => b.className.includes('suggestion-item'));
    expect(items.length).toBeGreaterThan(0);

    fireEvent.click(items[0]);

    // El adapter (tpl) => onChange(tpl.template) debe pasar el texto de la plantilla.
    expect(onChange).toHaveBeenCalledTimes(1);
    const inserted = onChange.mock.calls[0][0] as string;
    expect(typeof inserted).toBe('string');
    expect(inserted.length).toBeGreaterThan(0);
  });

  it('con el popover abierto, Enter en el textarea NO dispara onSend (guard)', () => {
    const { onSend } = setup({ value: '/' });
    // Confirmamos que el popover está abierto antes del Enter.
    expect(screen.getByText(SUGGESTIONS_HEADER)).toBeInTheDocument();

    // El textarea tiene id="chat-textarea" (selector más fiable que aria-label,
    // que colisiona con otros botones del área de chat).
    const textarea = document.getElementById('chat-textarea') as HTMLTextAreaElement;
    // El textarea maneja Enter vía handleKeyDown; con suggestionsOpen debe ceder.
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(onSend).not.toHaveBeenCalled();
  });
});
