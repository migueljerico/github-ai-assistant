// ────────────────────────────────────────────────────────────────────────────
// AuthContext — GitHub authentication state (ZERO-STORAGE ARCHITECTURE)
//
// DUAL AUTH MODEL:
// The app supports two ways to authenticate with GitHub:
//
// 1. GitHub OAuth (recommended)
// - User clicks "Conectar con GitHub"
// - Browser navigates to /auth/github (Express)
// - Express redirects to GitHub, GitHub returns a code
// - Express exchanges the code for an access_token server-side
// - Express redirects to the frontend with the token in the URL hash
// - AuthGate extracts the token and calls setTokenFromOAuth()
//
// 2. Personal Access Token (PAT)
// - User pastes their PAT directly into the PatInput component
// - loginWithPat() validates it immediately against GET /user
//
// SECURITY MODEL — ZERO-STORAGE:
// The token is stored STRICTLY in React state (memory). It is NEVER written
// to sessionStorage, localStorage, cookies, or any browser storage API.
// This eliminates the risk of token theft via XSS attacks.
//
// TRADE-OFF: If the user reloads the page (F5), the session is lost and
// they must re-authenticate. This is an intentional security feature, not a bug.
// ────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
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
  /** Timestamp when the token was connected (for session warnings) */
  connectedAt: number | null;
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
 * ZERO-STORAGE: The token lives ONLY in React state (memory).
 * On mount, the app always starts unauthenticated. The user must re-authenticate
 * after any page reload. This is an intentional security feature.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    connectedAt: null,
  });

  /**
   * Validate a token by calling `GET https://api.github.com/user`.
   * On success: stores token + timestamp in React state ONLY (no browser storage).
   * On failure: resets state to unauthenticated.
   *
   * @param token - The token to validate (OAuth or PAT)
   */
  const fetchUser = useCallback(async (token: string) => {
    setState(s => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      });
      if (!res.ok) throw new Error("Invalid token or API error");
      const user: GitHubUser = await res.json();
      
      // ZERO-STORAGE: Token lives ONLY in React state, never in browser storage
      setState({
        token,
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        connectedAt: Date.now(),
      });
    } catch (err) {
      setState({
        token: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: (err as Error).message,
        connectedAt: null,
      });
    }
  }, []);

  const loginWithPat = useCallback(async (pat: string) => {
    await fetchUser(pat);
  }, [fetchUser]);

  const setTokenFromOAuth = useCallback(async (token: string) => {
    await fetchUser(token);
  }, [fetchUser]);

  const initiateOAuth = useCallback(() => {
    // Navigate to the Express OAuth endpoint which starts the GitHub redirect chain
    window.location.href = "/auth/github";
  }, []);

  const logout = useCallback(() => {
    // ZERO-STORAGE: Simply reset React state. No browser storage to clear.
    setState({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      connectedAt: null,
    });
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
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
