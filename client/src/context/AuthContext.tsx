// ────────────────────────────────────────────────────────────────────────────
// AuthContext — GitHub authentication state
//
// DUAL AUTH MODEL:
// The app supports two ways to authenticate with GitHub:
//
//   1. GitHub OAuth (recommended)
//      - User clicks "Conectar con GitHub"
//      - Browser navigates to /auth/github (Express)
//      - Express redirects to GitHub, GitHub returns a code
//      - Express exchanges the code for an access_token server-side
//      - Express redirects to the frontend with the token in the URL hash
//      - AuthGate extracts the token and calls setTokenFromOAuth()
//
//   2. Personal Access Token (PAT)
//      - User pastes their PAT directly into the PatInput component
//      - loginWithPat() validates it immediately against GET /user
//
// TOKEN STORAGE:
// The token is stored in sessionStorage (key: 'gh_token'), NOT localStorage.
// sessionStorage is scoped to the browser tab and is cleared when the tab
// closes, reducing the window of exposure if the device is left unlocked.
// ────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import type { GitHubUser } from '../types';

/** Full authentication state shape */
interface AuthState {
  /** The active GitHub token (OAuth access token or PAT), or null if not authenticated */
  token: string | null;
  /** The authenticated user's profile, or null if not yet fetched */
  user: GitHubUser | null;
  /** True when both token and user are populated and valid */
  isAuthenticated: boolean;
  /** True during the initial token validation on mount or after login */
  isLoading: boolean;
  /** Error message from the last failed auth attempt, or null */
  error: string | null;
}

/** AuthContext value — combines state with action methods */
interface AuthContextValue extends AuthState {
  /**
   * Authenticate using a GitHub Personal Access Token.
   * Validates the token against `GET /user` before storing it.
   * @param pat - GitHub Personal Access Token
   */
  loginWithPat: (pat: string) => Promise<void>;

  /** Remove the stored token and reset all auth state */
  logout: () => void;

  /**
   * Initiate the GitHub OAuth flow.
   * Navigates to `/auth/github` which triggers the Express OAuth redirect chain.
   */
  initiateOAuth: () => void;

  /**
   * Store and validate a token received from the OAuth callback.
   * Called by AuthGate after extracting the token from the URL hash.
   * @param token - The GitHub access token from the OAuth callback
   */
  setTokenFromOAuth: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * AuthProvider — wraps the app and provides GitHub authentication state.
 *
 * On mount, if a token exists in sessionStorage, it is validated immediately
 * (in case the page was refreshed). If validation fails, the stale token is
 * removed and the user is shown the login screen.
 *
 * Uses a ref-based approach (hasValidated) to guard against double-validation
 * in Strict Mode without suppressing ESLint warnings.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: sessionStorage.getItem('gh_token'),
    user: null,
    isAuthenticated: false,
    // If we have a stored token, start in loading state so we can validate it
    isLoading: !!sessionStorage.getItem('gh_token'),
    error: null,
  });

  // Ref-based guard: ensure we validate the stored token only once on mount
  // This prevents double-validation in Strict Mode without suppressing ESLint
  const hasValidated = useRef(false);

  /**
   * Validate a token by calling `GET https://api.github.com/user`.
   * On success: stores token in sessionStorage and updates state.
   * On failure: clears sessionStorage and resets state to unauthenticated.
   *
   * @param token - The token to validate (OAuth or PAT)
   */
  const fetchUser = useCallback(async (token: string) => {
    setState(s => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) throw new Error('Invalid token or API error');
      const user: GitHubUser = await res.json();
      sessionStorage.setItem('gh_token', token);
      setState({ token, user, isAuthenticated: true, isLoading: false, error: null });
    } catch (err) {
      sessionStorage.removeItem('gh_token');
      setState({ token: null, user: null, isAuthenticated: false, isLoading: false, error: (err as Error).message });
    }
  }, []);

  // On mount: validate any token that survived a page refresh
  // Using a ref guard instead of an empty dependency array to avoid ESLint suppression
  React.useEffect(() => {
    // Skip validation if already done (prevents double-validation in Strict Mode)
    if (hasValidated.current) return;
    hasValidated.current = true;

    const stored = sessionStorage.getItem('gh_token');
    if (stored && !state.user) {
      fetchUser(stored);
    }
  }, [state.user, fetchUser]);

  const loginWithPat = useCallback(async (pat: string) => {
    await fetchUser(pat);
  }, [fetchUser]);

  const setTokenFromOAuth = useCallback(async (token: string) => {
    await fetchUser(token);
  }, [fetchUser]);

  const initiateOAuth = useCallback(() => {
    // Navigate to the Express OAuth endpoint which starts the GitHub redirect chain
    window.location.href = '/auth/github';
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('gh_token');
    setState({ token: null, user: null, isAuthenticated: false, isLoading: false, error: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, loginWithPat, logout, initiateOAuth, setTokenFromOAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to consume the AuthContext.
 * Must be used inside an `<AuthProvider>`.
 * @throws Error if called outside of AuthProvider
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
