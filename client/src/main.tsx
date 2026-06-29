import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { HistoryProvider } from './context/HistoryContext.tsx';
import { AIProviderContextProvider, useAIProvider } from './context/AIProviderContext.tsx';
import { LanguageProvider, useLanguage } from './context/LanguageContext.tsx';
import LoginButton from './components/auth/LoginButton.tsx';
import PatInput from './components/auth/PatInput.tsx';
import AIProviderPanel from './components/ai-provider/AIProviderPanel.tsx';
import LanguageSelector from './components/layout/LanguageSelector.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';

// ── Step 1: GitHub Auth Gate ──────────────────────────────────────────────────
function AuthGate() {
  const { isAuthenticated, isLoading, setTokenFromOAuth } = useAuth();
  const { t } = useLanguage();

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
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('auth.verifying')}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-screen">
        <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
          <LanguageSelector />
        </div>
        <div className="auth-card">
          <div className="auth-icon">🤖</div>
          <h1 className="auth-title gradient-text">{t('auth.title')}</h1>
          <p className="auth-subtitle">
            {t('auth.subtitle')}
          </p>
          <LoginButton />
          <div className="auth-divider">{t('auth.patDivider')}</div>
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
    <LanguageProvider>
      <AuthProvider>
        <AIProviderContextProvider>
          <HistoryProvider>
            <AuthGate />
          </HistoryProvider>
        </AIProviderContextProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </StrictMode>,
);
