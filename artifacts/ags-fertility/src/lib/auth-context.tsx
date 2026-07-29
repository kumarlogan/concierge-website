// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Auth Context Provider                   │
// │ React context for patient authentication state.             │
// │ Consumes AI Platform Identity Core via patient-api client.  │
// │ Wave 5 — Patient Workspace                                  │
// └─────────────────────────────────────────────────────────────┘

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { patientAuth, tokenStore, tryRefreshToken } from "./patient-api";

// ── Types ──────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  identityType: string;
  status: string;
  mfaEnabled: boolean;
  emailVerified: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, displayName?: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  mfaRequired: boolean;
  mfaSessionToken: string | null;
  completeMFA: (code: string) => Promise<void>;
}

// ── Context ────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaSessionToken, setMfaSessionToken] = useState<string | null>(null);

  // ── Initialise: try to restore session ────────────────────

  useEffect(() => {
    const init = async () => {
      if (tokenStore.isAuthenticated()) {
        try {
          const me = await patientAuth.me();
          setUser({
            id: me.identity.id,
            email: me.identity.email,
            displayName: me.identity.displayName,
            identityType: me.identity.identityType,
            status: me.identity.status,
            mfaEnabled: me.identity.mfaEnabled,
            emailVerified: me.identity.emailVerified,
          });
        } catch {
          // Token expired — try refresh
          const restored = await tryRefreshToken();
          if (restored) {
            const me = await patientAuth.me();
            setUser({
              id: me.identity.id,
              email: me.identity.email,
              displayName: me.identity.displayName,
              identityType: me.identity.identityType,
              status: me.identity.status,
              mfaEnabled: me.identity.mfaEnabled,
              emailVerified: me.identity.emailVerified,
            });
          }
        }
      }
      setIsLoading(false);
    };
    init();
  }, []);

  // ── Subscribe to token store changes ─────────────────────

  useEffect(() => {
    const unsub = tokenStore.subscribe(() => {
      if (!tokenStore.isAuthenticated()) {
        setUser(null);
      }
    });
    return unsub;
  }, []);

  // ── Login ────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const result = await patientAuth.login(email, password);

    if (result.mfaRequired) {
      setMfaRequired(true);
      setMfaSessionToken(result.mfaSessionToken ?? null);
      throw new Error("MFA_REQUIRED");
    }

    const userObj: AuthUser = {
      id: result.identity.id,
      email: result.identity.email,
      displayName: result.identity.displayName,
      identityType: result.identity.identityType,
      status: result.identity.status,
      mfaEnabled: result.identity.mfaEnabled,
      emailVerified: result.identity.emailVerified,
    };
    setUser(userObj);
    return userObj;
  }, []);

  // ── Register ─────────────────────────────────────────────

  const register = useCallback(async (
    email: string,
    password: string,
    displayName?: string,
  ): Promise<AuthUser> => {
    const result = await patientAuth.register(email, password, displayName);

    // Return user info from registration — no auto-login since new
    // identities start as REGISTERED and need email verification first.
    const userObj: AuthUser = {
      id: result.identity.id,
      email: result.identity.email,
      displayName: result.identity.displayName,
      identityType: result.identity.identityType,
      status: result.identity.status,
      mfaEnabled: result.identity.mfaEnabled,
      emailVerified: result.identity.emailVerified,
    };
    return userObj;
  }, []);

  // ── Logout ───────────────────────────────────────────────

  const logout = useCallback(async () => {
    await patientAuth.logout();
    setUser(null);
    setMfaRequired(false);
    setMfaSessionToken(null);
  }, []);

  // ── Refresh user data ────────────────────────────────────

  const refreshUser = useCallback(async () => {
    if (!tokenStore.isAuthenticated()) return;
    try {
      const me = await patientAuth.me();
      setUser({
        id: me.identity.id,
        email: me.identity.email,
        displayName: me.identity.displayName,
        identityType: me.identity.identityType,
        status: me.identity.status,
        mfaEnabled: me.identity.mfaEnabled,
        emailVerified: me.identity.emailVerified,
      });
    } catch {
      const restored = await tryRefreshToken();
      if (!restored) {
        setUser(null);
      }
    }
  }, []);

  // ── Complete MFA ─────────────────────────────────────────

  const completeMFA = useCallback(async (code: string) => {
    const result = await patientAuth.verifyMFA(code);
    if (result.verified) {
      setMfaRequired(false);
      setMfaSessionToken(null);
      await refreshUser();
    }
  }, [refreshUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: user !== null,
        login,
        register,
        logout,
        refreshUser,
        mfaRequired,
        mfaSessionToken,
        completeMFA,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}