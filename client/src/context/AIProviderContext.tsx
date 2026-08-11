import { createContext, useContext, useState, type ReactNode } from 'react';
import type { AIProviderType } from '../services/providers';
import { saveProviderPref, loadProviderPref, clearProviderPref } from '../utils/providerPrefs';

export type { AIProviderType };

export interface AIProviderState {
  provider: AIProviderType | null;
  apiKey: string | null;
  model: string | null;
  /** Solo Cloudflare Workers AI: account_id necesario en la ruta URL del endpoint. */
  accountId: string | null;
  /** #73: timeout de la llamada IA en ms (null = default 180s). Configurable en el panel. */
  timeoutMs: number | null;
  isConnected: boolean;
  connectedAt: number | null;
  connect: (provider: AIProviderType, apiKey: string, model: string, accountId?: string | null) => void;
  disconnect: () => void;
  /** #73: actualiza el timeout sin reconectar. */
  setTimeoutMs: (ms: number | null) => void;
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
  const [accountId, setAccountId] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  // #73: timeout configurable. null = default (180s). Se hidrata del sessionStorage
  // al conectar (connect) y persiste ahí; mientras no haya conexión, null.
  const [timeoutMs, setTimeoutMsState] = useState<number | null>(null);

  const connect = (p: AIProviderType, k: string, m: string, acc?: string | null) => {
    // ZERO-STORAGE: API key lives ONLY in React state, never in browser storage
    setProvider(p);
    setApiKey(k);
    setModel(m);
    setAccountId(acc ?? null);
    setConnectedAt(Date.now());
    // #73: hidrata el timeout guardado (si existe) al conectar.
    const saved = loadProviderPref();
    setTimeoutMsState(saved?.timeoutMs ?? null);
    // #40: recuerda SOLO proveedor + modelo (no la key) para no re-seleccionarlos al recargar
    saveProviderPref(p, m, saved?.timeoutMs);
  };

  const disconnect = () => {
    // ZERO-STORAGE: Simply reset React state. No browser storage to clear.
    setProvider(null);
    setApiKey(null);
    setModel(null);
    setAccountId(null);
    setConnectedAt(null);
    setTimeoutMsState(null);
    clearProviderPref(); // #40: olvida la preferencia al desconectar
  };

  // #73: actualiza el timeout sin reconectar; persiste junto a proveedor+modelo.
  const setTimeoutMs = (ms: number | null) => {
    setTimeoutMsState(ms);
    if (provider && model) saveProviderPref(provider, model, ms ?? undefined);
  };

  return (
    <AIProviderContext.Provider value={{
      provider,
      apiKey,
      model,
      accountId,
      timeoutMs,
      isConnected: apiKey !== null,
      connectedAt,
      connect,
      disconnect,
      setTimeoutMs,
    }}>
      {children}
    </AIProviderContext.Provider>
  );
}

// Hook de consumo co-localizado con el Provider (patrón canónico de Context).
// Fast Refresh avisa porque el archivo exporta algo que no es componente,
// pero separar el hook a otro fichero rompería imports en toda la app sin
// ganancia real. Patrón estándar y recomendado en React.
// eslint-disable-next-line react-refresh/only-export-components
export function useAIProvider(): AIProviderState {
  const ctx = useContext(AIProviderContext);
  if (!ctx) throw new Error('useAIProvider must be used within AIProviderContextProvider');
  return ctx;
}
