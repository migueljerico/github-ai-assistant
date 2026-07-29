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

describe('ChatInput — cableado de SyncRepoStatus (#70, v3.59.0)', () => {
  it('no renderiza el botón SyncRepoStatus cuando onSyncRepoStatus no se pasa', () => {
    setup();
    expect(screen.queryByRole('button', { name: /Sincronizar estado del repo/ })).not.toBeInTheDocument();
  });

  it('renderiza el botón SyncRepoStatus cuando onSyncRepoStatus se pasa', () => {
    setup({ onSyncRepoStatus: vi.fn() });
    expect(screen.getByRole('button', { name: /Sincronizar estado del repo/ })).toBeInTheDocument();
  });

  it('un click en el botón propaga el repo al callback vía prompt', () => {
    const onSyncRepoStatus = vi.fn();
    vi.spyOn(window, 'prompt').mockReturnValue('owner/repo');
    setup({ onSyncRepoStatus });
    fireEvent.click(screen.getByRole('button', { name: /Sincronizar estado del repo/ }));
    expect(onSyncRepoStatus).toHaveBeenCalledWith('owner/repo');
  });
});
