import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { HistoryProvider } from './context/HistoryContext.tsx';
import { AIProviderContextProvider, useAIProvider } from './context/AIProviderContext.tsx';
import LoginButton from './components/auth/LoginButton.tsx';
import PatInput from './components/auth/PatInput.tsx';
import AIProviderPanel from './components/ai-provider/AIProviderPanel.tsx';

// ── Step 1: GitHub Auth Gate ──────────────────────────────────────────────────
function AuthGate() {
  const { isAuthenticated, isLoading, setTokenFromOAuth } = useAuth();

  // Extract token from URL hash after OAuth redirect
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const params = new URLSearchParams(hash.slice(1));
    const token = params.get('access_token');
    const error = params.get('error');

    if (token) {
      window.history.replaceState({}, document.title, window.location.pathname);
      setTokenFromOAuth(token);
    } else if (error) {
      console.error('OAuth error:', decodeURIComponent(error));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '16px' }}>
        <span className="spinner spinner-lg" />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Verificando autenticación...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-icon">🤖</div>
          <h1 className="auth-title gradient-text">Asistente de IA para Publicar Repositorios</h1>
          <p className="auth-subtitle">
            Gestiona tus repositorios de GitHub con lenguaje natural,<br />
            impulsado por Gemini, Groq u OpenRouter (con modelos gratuitos).
          </p>
          <LoginButton />
          <div className="auth-divider">o usa un token personal</div>
          <PatInput />
        </div>
      </div>
    );
  }

  // GitHub auth OK → check AI provider
  return <AIProviderGate />;
}

// ── Step 2: AI Provider Gate ──────────────────────────────────────────────────
function AIProviderGate() {
  const { isConnected } = useAIProvider();

  if (!isConnected) {
    return <AIProviderPanel />;
  }

  return <App />;
}

// ── Root ──────────────────────────────────────────────────────────────────────
function Root() {
  return (
    <AuthProvider>
      <AIProviderContextProvider>
        <HistoryProvider>
          <AuthGate />
        </HistoryProvider>
      </AIProviderContextProvider>
    </AuthProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
