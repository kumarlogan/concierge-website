// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Identity Core Google OAuth Provider Adapter    │
// │ First working OAuth provider — follows IIdentityProvider.   │
// │ Wave 3 — AI Platform Identity Core v1                        │
// └─────────────────────────────────────────────────────────────┘

import { AuthProvider, AuthInitiateRequest, AuthInitiateResult, AuthCallbackRequest, AuthCallbackResult } from "../identity-provider-registry.js";

/**
 * Google OAuth Provider — implements AuthProvider interface.
 * First working OAuth provider for the AI Platform.
 */
export class GoogleOAuthProvider implements AuthProvider {
  readonly id = "google";
  readonly providerType = "google";
  readonly displayName = "Google";
  readonly supportedMethods = ["oauth2", "oidc"];

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly scopes: string[];

  constructor(clientId: string, clientSecret: string, scopes?: string[]) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.scopes = scopes ?? ["openid", "email", "profile"];
  }

  /**
   * Initiate Google OAuth flow — returns the authorization URL.
   */
  async initiate(request: AuthInitiateRequest): Promise<AuthInitiateResult> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: request.redirectUri ?? "",
      response_type: "code",
      scope: this.scopes.join(" "),
      state: request.state ?? crypto.randomUUID(),
      access_type: "offline",
      prompt: "consent",
    });

    return {
      redirectUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      state: request.state,
    };
  }

  /**
   * Handle Google OAuth callback — exchange code for tokens + user info.
   */
  async handleCallback(request: AuthCallbackRequest): Promise<AuthCallbackResult> {
    try {
      // Exchange authorization code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: request.code ?? "",
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: request.redirectUri ?? "",
          grant_type: "authorization_code",
        }).toString(),
      });

      const tokens = await tokenResponse.json() as {
        access_token?: string;
        id_token?: string;
        refresh_token?: string;
        expires_in?: number;
      };

      if (!tokens.access_token) {
        return {
          authenticated: false,
          error: "Failed to exchange authorization code for tokens",
        };
      }

      // Fetch user info
      const userInfoResponse = await fetch(
              "https://www.googleapis.com/oauth2/v2/userinfo",
              {
                headers: { Authorization: `Bearer ${tokens.access_token}` },
              },
      );

      const userInfo = await userInfoResponse.json() as {
        id?: string;
        email?: string;
        verified_email?: boolean;
        name?: string;
        picture?: string;
      };

      if (!userInfo.id) {
        return {
          authenticated: false,
          error: "Failed to fetch user info from Google",
        };
      }

      return {
        authenticated: true,
        subjectId: userInfo.id,
        email: userInfo.email,
        displayName: userInfo.name,
        raw: { ...userInfo, tokens },
      };
    } catch (err) {
      return {
        authenticated: false,
        error: err instanceof Error ? err.message : "Google OAuth callback failed",
      };
    }
  }

  /**
   * Health check — verify Google OAuth endpoints are reachable.
   */
  async health(): Promise<{ ok: boolean; message?: string }> {
    try {
      const response = await fetch("https://accounts.google.com/.well-known/openid-configuration", {
        method: "HEAD",
      });
      return { ok: response.ok };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Google OAuth endpoint unreachable",
      };
    }
  }
}