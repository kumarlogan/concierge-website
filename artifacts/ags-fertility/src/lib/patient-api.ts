// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Patient API Client                       │
// │ Consumes AI Platform Identity Core & Trust Runtime APIs.     │
// │ Wave 5 — Patient Workspace                                  │
// │ NOT a platform capability — Concierge-specific frontend.    │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: This client sends NO personal health information.
// All calls use opaque identity IDs. PHI never enters the client.

// Production: VITE_API_BASE is injected at build time (GitHub secret, value
// https://api.agsynergy.ca). Falls back to the live API host so a missing
// var can never silently POST to the SPA origin (the 2026-07-28 incident).
const API_BASE = import.meta.env.VITE_API_BASE || "https://api.agsynergy.ca";

// ── Response Types ──────────────────────────────────────────

export interface ApiErrorResponse {
  success: false;
  error: { code: string; message: string };
}

export interface ApiSuccessResponse<T = Record<string, unknown>> {
  success: true;
  [key: string]: unknown;
}

// ── Identity Types (mirrors platform/identity/types.ts) ─────

export interface IdentityResponse {
  identity: {
    id: string;
    identityType: string;
    status: string;
    email: string;
    emailVerified: boolean;
    displayName?: string;
    mfaEnabled: boolean;
    trustScore: number;
    createdAt: string;
    updatedAt: string;
    profile?: Record<string, unknown>;
  };
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  identity: IdentityResponse["identity"];
  sessionId: string;
  expiresIn: number;
  mfaRequired: boolean;
  mfaSessionToken?: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MFASetupResponse {
  method: string;
  secret?: string;
  qrCodeUrl?: string;
  backupCodes?: string[];
}

export interface MFAVerifyResponse {
  verified: boolean;
  sessionUpgraded: boolean;
}

export interface ProviderResponse {
  id: string;
  name: string;
  type: string;
  methods: string[];
}

export interface SessionResponse {
  sessionId: string;
  deviceName: string;
  ipAddress: string;
  createdAt: string;
  lastActivity: string;
  isCurrent: boolean;
}

export interface OAuthInitiateResponse {
  authorizeUrl: string;
  state: string;
}

// ── API Error ───────────────────────────────────────────────

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

// ── Core API Client ─────────────────────────────────────────

interface RequestOptions {
  method?: string;
  body?: Record<string, unknown>;
  token?: string | null;
}

async function apiRequest<T = Record<string, unknown>>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "POST", body, token } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    const err = data as ApiErrorResponse;
    throw new ApiError(
      err.error?.message || `API error: ${res.status}`,
      err.error?.code || "UNKNOWN",
      res.status,
    );
  }

  return data as T;
}

// ── Client Storage for Auth Tokens ─────────────────────────

const STORAGE_KEY_ACCESS = "ags_patient_access_token";
const STORAGE_KEY_REFRESH = "ags_patient_refresh_token";

class TokenStore {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private listeners: Array<() => void> = [];

  constructor() {
    // Restore tokens from localStorage on instantiation
    try {
      const storedAccess = localStorage.getItem(STORAGE_KEY_ACCESS);
      const storedRefresh = localStorage.getItem(STORAGE_KEY_REFRESH);
      if (storedAccess && storedRefresh) {
        this.accessToken = storedAccess;
        this.refreshToken = storedRefresh;
      }
    } catch {
      // localStorage may be unavailable (private browsing, etc.)
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  setTokens(access: string, refresh: string): void {
    this.accessToken = access;
    this.refreshToken = refresh;
    this.persist();
    this.notify();
  }

  clear(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.clearPersisted();
    this.notify();
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private persist(): void {
    try {
      if (this.accessToken) localStorage.setItem(STORAGE_KEY_ACCESS, this.accessToken);
      if (this.refreshToken) localStorage.setItem(STORAGE_KEY_REFRESH, this.refreshToken);
    } catch {
      // Silently fail if storage unavailable
    }
  }

  private clearPersisted(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_ACCESS);
      localStorage.removeItem(STORAGE_KEY_REFRESH);
    } catch {
      // Silently fail if storage unavailable
    }
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }
}

export const tokenStore = new TokenStore();

// ── Authentication API ─────────────────────────────────────

export const patientAuth = {
  /** Register a new patient identity */
  async register(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<IdentityResponse> {
    const result = await apiRequest<IdentityResponse>("/identity/register", {
      body: {
        identityType: "patient",
        email,
        password,
        profile: displayName ? { displayName } : undefined,
      },
    });

    // No auto-login: new identities start as REGISTERED and need email
    // verification before they can authenticate. The caller handles this.
    return result;
  },

  /** Log in with email and password */
  async login(
    email: string,
    password: string,
    deviceFingerprint?: string,
  ): Promise<LoginResponse> {
    const result = await apiRequest<LoginResponse>("/identity/login", {
      body: { email, password, deviceFingerprint },
    });

    if (!result.mfaRequired) {
      tokenStore.setTokens(result.accessToken, result.refreshToken);
    }

    return result;
  },

  /** Log out */
  async logout(): Promise<void> {
    const token = tokenStore.getAccessToken();
    try {
      await apiRequest("/identity/logout", {
        method: "POST",
        body: {},
        token,
      });
    } finally {
      tokenStore.clear();
    }
  },

  /** Refresh the access token */
  async refresh(): Promise<RefreshResponse> {
    const refreshToken = tokenStore.getRefreshToken();
    if (!refreshToken) throw new Error("No refresh token available");

    const result = await apiRequest<RefreshResponse>("/identity/refresh", {
      body: { refreshToken },
    });

    tokenStore.setTokens(result.accessToken, result.refreshToken);
    return result;
  },

  /** Get current identity profile */
  async me(): Promise<IdentityResponse> {
    return apiRequest<IdentityResponse>("/identity/me", {
      method: "GET",
      token: tokenStore.getAccessToken(),
    });
  },

  /** Request a password reset email */
  async requestPasswordReset(email: string): Promise<void> {
    await apiRequest("/identity/password/reset", {
      body: { email },
    });
  },

  /** Complete password reset */
  async completePasswordReset(
    token: string,
    newPassword: string,
  ): Promise<void> {
    await apiRequest("/identity/password/change", {
      body: { token, newPassword },
    });
  },

  /** Change password (authenticated) */
  async changePassword(newPassword: string): Promise<void> {
    await apiRequest("/identity/password/update", {
      body: { newPassword },
      token: tokenStore.getAccessToken(),
    });
  },

  /** Request email verification */
  async requestEmailVerification(identityId: string, email: string): Promise<{ token: string }> {
    return apiRequest<{ token: string }>("/identity/email/verify", {
      body: { identityId, email },
    });
  },

  /** Complete email verification */
  async completeEmailVerification(token: string): Promise<void> {
    await apiRequest("/identity/email/verify/complete", {
      body: { token },
    });
  },

  /** Request a magic link */
  async requestMagicLink(email: string): Promise<void> {
    await apiRequest("/identity/magic-link", {
      body: { email },
    });
  },

  /** Verify and consume a magic link */
  async verifyMagicLink(
    token: string,
    deviceFingerprint?: string,
  ): Promise<LoginResponse> {
    const result = await apiRequest<LoginResponse>("/identity/magic-link/verify", {
      body: { token, deviceFingerprint },
    });

    if (!result.mfaRequired) {
      tokenStore.setTokens(result.accessToken, result.refreshToken);
    }

    return result;
  },

  /** Initiate OAuth login (Google, OIDC, etc.) */
  async initiateOAuth(
    providerType: string,
    redirectUri: string,
  ): Promise<OAuthInitiateResponse> {
    return apiRequest<OAuthInitiateResponse>("/identity/oauth/initiate", {
      body: { providerType, redirectUri },
    });
  },

  /** Handle OAuth callback */
  async handleOAuthCallback(
    providerType: string,
    code: string,
    redirectUri: string,
    deviceFingerprint?: string,
  ): Promise<LoginResponse> {
    const result = await apiRequest<LoginResponse>("/identity/oauth/callback", {
      body: { providerType, code, redirectUri, deviceFingerprint },
    });

    if (!result.mfaRequired) {
      tokenStore.setTokens(result.accessToken, result.refreshToken);
    }

    return result;
  },

  /** List available identity providers */
  async listProviders(): Promise<{ providers: ProviderResponse[] }> {
    return apiRequest<{ providers: ProviderResponse[] }>(
      "/identity/providers",
      { method: "GET" },
    );
  },

  /** Set up MFA (TOTP) */
  async setupMFA(): Promise<MFASetupResponse> {
    return apiRequest<MFASetupResponse>("/identity/mfa/setup", {
      body: {},
      token: tokenStore.getAccessToken(),
    });
  },

  /** Verify and enable MFA */
  async verifyMFA(code: string): Promise<MFAVerifyResponse> {
    return apiRequest<MFAVerifyResponse>("/identity/mfa/verify", {
      body: { code },
      token: tokenStore.getAccessToken(),
    });
  },

  /** List active login sessions */
  async listSessions(): Promise<{ sessions: SessionResponse[] }> {
    return apiRequest<{ sessions: SessionResponse[] }>(
      "/identity/sessions",
      { method: "GET" },
    );
  },

  /** Revoke a specific session */
  async revokeSession(sessionId: string): Promise<void> {
    await apiRequest(`/identity/sessions/${sessionId}`, {
      method: "DELETE",
    });
  },
};

// ── Profile API ────────────────────────────────────────────

export const patientProfile = {
  /** Get the current identity's profile */
  async get(): Promise<IdentityResponse> {
    return patientAuth.me();
  },

  /** Update profile fields */
  async update(profile: Record<string, unknown>): Promise<IdentityResponse> {
    return apiRequest<IdentityResponse>("/identity/me", {
      method: "PATCH",
      body: { profile },
      token: tokenStore.getAccessToken(),
    });
  },
};

// ── Consent API (consumes Trust Runtime) ───────────────────

export interface Consent {
  consentId: string;
  consentType: string;
  state: string;
  grantedAt?: string;
  expiresAt?: string;
  versionToken?: string;
}

export interface ConsentHistoryResponse {
  consents: Consent[];
  total: number;
}

export const patientConsent = {
  /** List current consents for the patient */
  async list(): Promise<ConsentHistoryResponse> {
    const identityId = await getCurrentIdentityId();
    const token = tokenStore.getAccessToken();
    const res = await fetch(
      `${API_BASE}/api/v1/consent/history?identityId=${identityId}&limit=50`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(
        err.error?.message || `Consent API error: ${res.status}`,
        err.error?.code || "CONSENT_ERROR",
        res.status,
      );
    }
    return res.json();
  },

  /** Grant consent for a specific type */
  async grant(consentType: string): Promise<void> {
    const identityId = await getCurrentIdentityId();
    await apiRequest("/api/v1/consent/grant", {
      body: { identityId, consentType },
      token: tokenStore.getAccessToken(),
    });
  },

  /** Revoke/withdraw a consent */
  async revoke(consentId: string, reason: string): Promise<void> {
    await apiRequest("/api/v1/consent/revoke", {
      body: { consentId, reason },
      token: tokenStore.getAccessToken(),
    });
  },
};

// ── Helpers ────────────────────────────────────────────────

async function getCurrentIdentityId(): Promise<string> {
  const me = await patientAuth.me();
  return me.identity.id;
}

/**
 * Try to refresh the access token if expired.
 * Returns the restored access token or null if refresh fails.
 */
export async function tryRefreshToken(): Promise<string | null> {
  try {
    const result = await patientAuth.refresh();
    return result.accessToken;
  } catch {
    tokenStore.clear();
    return null;
  }
}