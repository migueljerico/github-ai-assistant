import { createContext, useContext, useState, type ReactNode } from 'react';

export type AIProviderType = 'gemini' | 'groq';

export interface AIProviderState {
  provider: AIProviderType | null;
  apiKey: string | null;
  model: string | null;
  isConnected: boolean;
  connectedAt: number | null;
  connect: (provider: AIProviderType, apiKey: string, model: string) => void;
  disconnect: () => void;
}

const AIProviderContext = createContext<AIProviderState | undefined>(undefined);

/**
 * AIProviderContextProvider — manages AI provider state (ZERO-STORAGE).
 * 
 * SECURITY: The API key lives ONLY in React state (memory). It is NEVER written
 * to sessionStorage, localStorage, or any browser storage API.
 * 
 * TRADE-OFF: If the user reloads the page, they must re-enter their API key.
 * This is an intentional security feature to protect credentials from XSS attacks.
 */
export function AIProviderContextProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<AIProviderType | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);

  const connect = (p: AIProviderType, k: string, m: string) => {
    // ZERO-STORAGE: API key lives ONLY in React state, never in browser storage
    setProvider(p);
    setApiKey(k);
    setModel(m);
    setConnectedAt(Date.now());
  };

  const disconnect = () => {
    // ZERO-STORAGE: Simply reset React state. No browser storage to clear.
    setProvider(null);
    setApiKey(null);
    setModel(null);
    setConnectedAt(null);
  };

  return (
    <AIProviderContext.Provider value={{
      provider,
      apiKey,
      model,
      isConnected: apiKey !== null,
      connectedAt,
      connect,
      disconnect,
    }}>
      {children}
    </AIProviderContext.Provider>
  );
}

export function useAIProvider(): AIProviderState {
  const ctx = useContext(AIProviderContext);
  if (!ctx) throw new Error('useAIProvider must be used within AIProviderContextProvider');
  return ctx;
}
