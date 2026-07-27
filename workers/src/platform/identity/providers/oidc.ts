// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Identity Core Generic OIDC Provider            │
// │ Adapter for any OpenID Connect-compatible provider.         │
// │ Wave 3 — AI Platform Identity Core v1                        │
// └─────────────────────────────────────────────────────────────┘

import { AuthProvider, AuthInitiateRequest, AuthInitiateResult, AuthCallbackRequest, AuthCallbackResult } from "../identity-provider-registry.js";

/**
 * Generic OIDC Provider — configurable for any OIDC-compatible provider.
 * Microsoft, Apple, GitHub, and others that follow OIDC.
 */
export class OIDCProvider implements AuthProvider {
  readonly id: string;
  readonly providerType: string;
  readonly displayName: string;
  readonly supportedMethods = ["oidc"];

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly issuerUrl: string;
  private readonly authorizationEndpoint: string;
  private readonly tokenEndpoint: string;
  private readonly userInfoEndpoint: string;
  private readonly jwksUri: string;
  private readonly scopes: string[];

  constructor(
    id: string,
    displayName: string,
    config: {
      clientId: string;
      clientSecret: string;
      issuerUrl: string;
      authorizationEndpoint: string;
      tokenEndpoint: string;
      userInfoEndpoint: string;
      jwksUri: string;
      scopes?: string[];
    },
  ) {
    this.id = id;
    this.displayName = displayName;
    this.providerType = id;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.issuerUrl = config.issuerUrl;
    this.authorizationEndpoint = config.authorizationEndpoint;
    this.tokenEndpoint = config.tokenEndpoint;
    this.userInfoEndpoint = config.userInfoEndpoint;
    this.jwksUri = config.jwksUri;
    this.scopes = config.scopes ?? ["openid", "email", "profile"];
  }

  async initiate(request: AuthInitiateRequest): Promise<AuthInitiateResult> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: request.redirectUri ?? "",
      response_type: "code",
      scope: this.scopes.join(" "),
      state: request.state ?? crypto.randomUUID(),
      nonce: crypto.randomUUID(),
    });

    return {
      redirectUrl: `${this.authorizationEndpoint}?${params.toString()}`,
      state: request.state,
    };
  }

  async handleCallback(request: AuthCallbackRequest): Promise<AuthCallbackResult> {
    try {
      const tokenResponse = await fetch(this.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: request.code ?? "",
          redirect_uri: request.redirectUri ?? "",
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }).toString(),
      });

      const tokens = await tokenResponse.json() as {
        access_token?: string;
        id_token?: string;
        refresh_token?: string;
        expires_in?: number;
      };

      if (!tokens.access_token) {
        return { authenticated: false, error: "Token exchange failed" };
      }

      const userInfoResponse = await fetch(this.userInfoEndpoint, {
        headers: {
          "Authorization": `Bearer ${tokens.access_token}`,
        },
      });

      const userInfo = await userInfoResponse.json() as {
        sub?: string;
        email?: string;
        name?: string;
        preferred_username?: string;
        picture?: string;
        email_verified?: boolean;
      };

      if (!userInfo.sub) {
        return { authenticated: false, error: "Failed to fetch user info" };
      }

      return {
        authenticated: true,
        subjectId: userInfo.sub,
        email: userInfo.email,
        displayName: userInfo.name ?? userInfo.preferred_username,
        raw: { ...userInfo, tokens },
      };
    } catch (err) {
      return {
        authenticated: false,
        error: err instanceof Error ? err.message : "OIDC callback failed",
      };
    }
  }

  async health(): Promise<{ ok: boolean; message?: string }> {
    try {
      const response = await fetch(`${this.issuerUrl}/.well-known/openid-configuration`, {
        method: "HEAD",
      });
      return { ok: response.ok };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "OIDC endpoint unreachable",
      };
    }
  }
}

/**
 * Pre-configured Microsoft OIDC provider factory.
 */
export function createMicrosoftProvider(
  clientId: string,
  clientSecret: string,
): OIDCProvider {
  return new OIDCProvider("microsoft", "Microsoft", {
    clientId,
    clientSecret,
    issuerUrl: "https://login.microsoftonline.com/common",
    authorizationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userInfoEndpoint: "https://graph.microsoft.com/v1.0/me",
    jwksUri: "https://login.microsoftonline.com/common/discovery/v2.0/keys",
    scopes: ["openid", "email", "profile", "User.Read"],
  });
}

/**
 * Pre-configured GitHub OIDC provider factory.
 */
export function createGitHubProvider(
  clientId: string,
  clientSecret: string,
): OIDCProvider {
  return new OIDCProvider("github", "GitHub", {
    clientId,
    clientSecret,
    issuerUrl: "https://github.com",
    authorizationEndpoint: "https://github.com/login/oauth/authorize",
    tokenEndpoint: "https://github.com/login/oauth/access_token",
    userInfoEndpoint: "https://api.github.com/user",
    jwksUri: "https://api.github.com/meta/public_keys",
    scopes: ["read:user", "user:email"],
  });
}

/**
 * Pre-configured Apple Sign In provider factory (OIDC-based).
 */
export function createAppleProvider(
  clientId: string,
  clientSecret: string,
): OIDCProvider {
  return new OIDCProvider("apple", "Apple", {
    clientId,
    clientSecret,
    issuerUrl: "https://appleid.apple.com",
    authorizationEndpoint: "https://appleid.apple.com/auth/authorize",
    tokenEndpoint: "https://appleid.apple.com/auth/token",
    userInfoEndpoint: "https://appleid.apple.com/auth/userinfo",
    jwksUri: "https://appleid.apple.com/auth/keys",
    scopes: ["openid", "email", "name"],
  });
}

/**
 * Placeholder SAML provider — architecture-ready, not implemented.
 * Throws with a clear message if someone tries to use it.
 */
export class SAMLProvider implements AuthProvider {
  readonly id = "saml";
  readonly providerType = "saml";
  readonly displayName = "SAML 2.0";
  readonly supportedMethods = ["saml"];

  async initiate(_request: AuthInitiateRequest): Promise<AuthInitiateResult> {
    throw new Error("SAML provider is not yet implemented. This is a placeholder for future enterprise SSO integration.");
  }

  async handleCallback(_request: AuthCallbackRequest): Promise<AuthCallbackResult> {
    throw new Error("SAML provider is not yet implemented. This is a placeholder for future enterprise SSO integration.");
  }

  async health(): Promise<{ ok: boolean; message?: string }> {
    return { ok: false, message: "SAML provider is not yet implemented" };
  }
}