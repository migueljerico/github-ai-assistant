import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';

// #26 (v4.0.52): cubre ramas de ChatInput que los demás ficheros no disparan:
// el selector multi-repo visible (multiRepoEnabled=true), Shift+Enter sin envío,
// el botón de documento con capturas SIN repo activo y el botón de auditoría
// de seguridad presente.

vi.mock('../../multi-repo/RepoSelector', () => ({
  default: ({ selectedRepos }: any) => (
    <div data-testid="multi-repo-selector">-selector:{selectedRepos.length}-</div>
  ),
}));

vi.mock('../SecurityAuditButton', () => ({
  default: () => <button data-testid="security-audit-btn">seguridad</button>,
}));

import ChatInput from '../ChatInput';
import { LanguageProvider } from '../../../context/LanguageContext';

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
  return { props, ...render(<LanguageProvider><ChatInput {...props} /></LanguageProvider>) };
}

describe('ChatInput — ramas restantes (v4.0.52 #26)', () => {
  it('multiRepoEnabled=true: renderiza el selector multi-repo', () => {
    const { getByTestId } = setup({
      multiRepoEnabled: true,
      selectedRepos: [{ id: 1, name: 'uno', full_name: 'u/uno' } as any],
    });
    expect(getByTestId('multi-repo-selector')).toBeInTheDocument();
    expect(getByTestId('multi-repo-selector')).toHaveTextContent('-selector:1-');
  });

  it('Shift+Enter no envía el mensaje (rama !e.shiftKey falsa)', () => {
    const onSend = vi.fn();
    const { container } = setup({ value: 'borrador', onSend });
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;

    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('documento con capturas SIN repo activo: onOpenDocumentFlow(undefined)', () => {
    const onOpenDocumentFlow = vi.fn();
    const { container } = setup({ fileContextNames: ['captura.png'], onOpenDocumentFlow });

    // El botón vive dentro del menú de herramientas (cerrado por defecto)
    fireEvent.click(container.querySelector('.chat-tools-menu-btn') as HTMLElement);
    fireEvent.click(container.querySelector('#doc-with-screenshots-btn') as HTMLElement);

    // repoContextName es null → se pasa undefined (lado nullish del ??)
    expect(onOpenDocumentFlow).toHaveBeenCalledWith(undefined);
  });

  it('onOpenSecurityAudit presente: renderiza el botón de auditoría', () => {
    const { container, getByTestId } = setup({ onOpenSecurityAudit: vi.fn() });

    // El botón vive dentro del menú de herramientas (cerrado por defecto)
    fireEvent.click(container.querySelector('.chat-tools-menu-btn') as HTMLElement);
    expect(getByTestId('security-audit-btn')).toBeInTheDocument();
  });
});
