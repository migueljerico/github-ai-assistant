import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChat } from '../useChat';

describe('useChat Hook', () => {
  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.inputValue).toBe('');
    expect(result.current.isChatLoading).toBe(false);
    expect(result.current.conversationHistory).toEqual([]);
  });

  it('should add a message with unique ID and timestamp', () => {
    const { result } = renderHook(() => useChat());

    let messageId: string = '';
    act(() => {
      messageId = result.current.addMessage({
        role: 'user',
        content: 'Hello',
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].id).toBe(messageId);
    expect(result.current.messages[0].content).toBe('Hello');
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].timestamp).toBeInstanceOf(Date);
  });

  it('should update a message by ID', () => {
    const { result } = renderHook(() => useChat());

    let messageId: string = '';
    act(() => {
      messageId = result.current.addMessage({
        role: 'assistant',
        content: 'Loading...',
        isLoading: true,
      });
    });

    act(() => {
      result.current.updateMessage(messageId, {
        content: 'Done!',
        isLoading: false,
      });
    });

    expect(result.current.messages[0].content).toBe('Done!');
    expect(result.current.messages[0].isLoading).toBe(false);
  });

  it('should delete a message by ID', () => {
    const { result } = renderHook(() => useChat());

    let messageId: string = '';
    act(() => {
      messageId = result.current.addMessage({
        role: 'user',
        content: 'Test',
      });
    });

    expect(result.current.messages).toHaveLength(1);

    act(() => {
      result.current.deleteMessage(messageId);
    });

    expect(result.current.messages).toHaveLength(0);
  });

  it('should set input value', () => {
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.setInputValue('New input');
    });

    expect(result.current.inputValue).toBe('New input');
  });

  it('should set loading state', () => {
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.setIsChatLoading(true);
    });

    expect(result.current.isChatLoading).toBe(true);

    act(() => {
      result.current.setIsChatLoading(false);
    });

    expect(result.current.isChatLoading).toBe(false);
  });

  it('should add to conversation history', () => {
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.addToHistory('user', 'Hello');
      result.current.addToHistory('assistant', 'Hi there!');
    });

    expect(result.current.conversationHistory).toHaveLength(2);
    expect(result.current.conversationHistory[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(result.current.conversationHistory[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
  });

  it('should clear all chat data', () => {
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.addMessage({ role: 'user', content: 'Test' });
      result.current.setInputValue('Some input');
      result.current.addToHistory('user', 'History');
      result.current.setIsChatLoading(true);
    });

    act(() => {
      result.current.clearChat();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.inputValue).toBe('');
    expect(result.current.conversationHistory).toEqual([]);
    expect(result.current.isChatLoading).toBe(false);
  });

  it('should maintain message order', () => {
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.addMessage({ role: 'user', content: 'First' });
      result.current.addMessage({ role: 'assistant', content: 'Second' });
      result.current.addMessage({ role: 'user', content: 'Third' });
    });

    expect(result.current.messages).toHaveLength(3);
    expect(result.current.messages[0].content).toBe('First');
    expect(result.current.messages[1].content).toBe('Second');
    expect(result.current.messages[2].content).toBe('Third');
  });
});
