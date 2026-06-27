import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChatInput from '../ChatInput';

function setup(overrides: Partial<React.ComponentProps<typeof ChatInput>> = {}) {
  const props: React.ComponentProps<typeof ChatInput> = {
    value: 'hola',
    onChange: vi.fn(),
    onSend: vi.fn(),
    onStop: vi.fn(),
    isLoading: false,
    disabled: false,
    multiRepoEnabled: false,
    onMultiRepoChange: vi.fn(),
    selectedRepos: [],
    onSelectedReposChange: vi.fn(),
    onDocumentRepo: vi.fn(),
    onSummarizeThread: vi.fn(),
    repoContextName: null,
    onLoadRepoContext: vi.fn(),
    onClearRepoContext: vi.fn(),
    fileContextName: null,
    onAttachFile: vi.fn(),
    onClearFile: vi.fn(),
    onPublishFile: vi.fn(),
    ...overrides,
  };
  const { container } = render(<ChatInput {...props} />);
  return { props, btn: container.querySelector('#send-btn') as HTMLButtonElement };
}

describe('ChatInput — botón Enviar/Detener (#40)', () => {
  it('sin carga: muestra ➤ y al pulsar llama onSend', () => {
    const { props, btn } = setup({ isLoading: false });
    expect(btn.textContent).toContain('➤');
    expect(btn.getAttribute('aria-label')).toBe('Enviar instrucción');
    fireEvent.click(btn);
    expect(props.onSend).toHaveBeenCalledTimes(1);
    expect(props.onStop).not.toHaveBeenCalled();
  });

  it('mientras genera: muestra ⏹️, queda habilitado y al pulsar llama onStop', () => {
    const { props, btn } = setup({ isLoading: true });
    expect(btn.textContent).toContain('⏹️');
    expect(btn.getAttribute('aria-label')).toBe('Detener generación');
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(props.onStop).toHaveBeenCalledTimes(1);
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it('sin carga y con el input vacío, el botón de enviar queda deshabilitado', () => {
    const { btn } = setup({ isLoading: false, value: '' });
    expect(btn.disabled).toBe(true);
  });
});
