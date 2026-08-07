import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChatInput from '../ChatInput';
import { LanguageProvider } from '../../../context/LanguageContext';
import React from 'react';

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

describe('ChatInput Docs buttons', () => {
  it('calls onOpenDocumentFlow when update docs button is clicked', () => {
    const { props } = setup({ repoContextName: 'test/repo' });
    const updateBtn = screen.getByRole('button', { name: /actualizar|update/i });
    fireEvent.click(updateBtn);
    expect(props.onOpenDocumentFlow).toHaveBeenCalledWith('test/repo');
  });

  it('calls onOpenDocumentFlow without repo context when update docs button is clicked and no repo', () => {
    const { props } = setup({ repoContextName: null });
    const updateBtn = screen.getByRole('button', { name: /actualizar|update/i });
    fireEvent.click(updateBtn);
    expect(props.onOpenDocumentFlow).toHaveBeenCalledWith(undefined);
  });

  it('renders and clicks doc with screenshots button when image is attached', () => {
    const { props } = setup({ fileContextNames: ['test.png'], repoContextName: 'test/repo' });
    const screenshotBtn = screen.getByRole('button', { name: /captura|screenshot/i });
    fireEvent.click(screenshotBtn);
    expect(props.onOpenDocumentFlow).toHaveBeenCalledWith('test/repo');
  });

  it('calls onMultiRepoChange when multi repo checkbox is clicked', () => {
    const { props } = setup({ multiRepoEnabled: false });
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(props.onMultiRepoChange).toHaveBeenCalledWith(true);
  });
});
