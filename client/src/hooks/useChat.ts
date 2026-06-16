/**
 * useChat — Custom Hook for Chat Logic
 * 
 * Encapsulates all chat-related state and logic:
 * - Message management (add, update, delete)
 * - Conversation history
 * - Loading states
 * - Message sending
 */

import { useState, useCallback } from 'react';
import type { ChatMessage } from '../types';

export interface UseChatState {
  messages: ChatMessage[];
  inputValue: string;
  isChatLoading: boolean;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface UseChatActions {
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, update: Partial<ChatMessage>) => void;
  deleteMessage: (id: string) => void;
  setInputValue: (value: string) => void;
  setIsChatLoading: (loading: boolean) => void;
  addToHistory: (role: 'user' | 'assistant', content: string) => void;
  clearChat: () => void;
}

export function useChat(): UseChatState & UseChatActions {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  const uid = () => crypto.randomUUID();

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>): string => {
    const id = uid();
    setMessages(prev => [...prev, { ...msg, id, timestamp: new Date() }]);
    return id;
  }, []);

  const updateMessage = useCallback((id: string, update: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...update } : m));
  }, []);

  const deleteMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  const addToHistory = useCallback((role: 'user' | 'assistant', content: string) => {
    setConversationHistory(prev => [...prev, { role, content }]);
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setInputValue('');
    setConversationHistory([]);
    setIsChatLoading(false);
  }, []);

  return {
    // State
    messages,
    inputValue,
    isChatLoading,
    conversationHistory,
    // Actions
    addMessage,
    updateMessage,
    deleteMessage,
    setInputValue,
    setIsChatLoading,
    addToHistory,
    clearChat,
  };
}
