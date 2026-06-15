import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type AIProviderType = 'gemini' | 'groq';

export interface AIProviderState {
  provider: AIProviderType | null;
  apiKey: string | null;
  model: string | null;
  isConnected: boolean;
  connect: (provider: AIProviderType, apiKey: string, model: string) => void;
  disconnect: () => void;
}

const AIProviderContext = createContext<AIProviderState | undefined>(undefined);

const SS_PROVIDER = 'ai_provider';
const SS_KEY      = 'ai_api_key';
const SS_MODEL    = 'ai_model';
const SS_TS       = 'ai_connected_ts'; // session TTL timestamp (#13)

export function AIProviderContextProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<AIProviderType | null>(null);
  const [apiKey, setApiKey]     = useState<string | null>(null);
  const [model, setModel]       = useState<string | null>(null);

  // Restore from sessionStorage on mount
  useEffect(() => {
    const p = sessionStorage.getItem(SS_PROVIDER) as AIProviderType | null;
    const k = sessionStorage.getItem(SS_KEY);
    const m = sessionStorage.getItem(SS_MODEL);
    if (p && k && m) {
      setProvider(p);
      setApiKey(k);
      setModel(m);
    }
  }, []);

  const connect = (p: AIProviderType, k: string, m: string) => {
    sessionStorage.setItem(SS_PROVIDER, p);
    sessionStorage.setItem(SS_KEY, k);
    sessionStorage.setItem(SS_MODEL, m);
    // Store connection timestamp for session TTL warnings (#13)
    sessionStorage.setItem(SS_TS, Date.now().toString());
    setProvider(p);
    setApiKey(k);
    setModel(m);
  };

  const disconnect = () => {
    sessionStorage.removeItem(SS_PROVIDER);
    sessionStorage.removeItem(SS_KEY);
    sessionStorage.removeItem(SS_MODEL);
    sessionStorage.removeItem(SS_TS);
    setProvider(null);
    setApiKey(null);
    setModel(null);
  };

  return (
    <AIProviderContext.Provider
      value={{ provider, apiKey, model, isConnected: !!provider && !!apiKey, connect, disconnect }}
    >
      {children}
    </AIProviderContext.Provider>
  );
}

export function useAIProvider(): AIProviderState {
  const ctx = useContext(AIProviderContext);
  if (!ctx) throw new Error('useAIProvider must be used within AIProviderContextProvider');
  return ctx;
}
