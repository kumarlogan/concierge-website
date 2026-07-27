// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Identity Core Barrel Export                    │
// │ Single import point for all Identity Core components.       │
// │ Wave 3 — AI Platform Identity Core v1                        │
// └─────────────────────────────────────────────────────────────┘

// Types
export * from "./types.js";

// Core Services
export { IdentityRepository } from "./identity-repository.js";
export { IdentityService } from "./identity-service.js";
export { SessionManager } from "./session-manager.js";
export { JwtManager, generateJwtKeyPair } from "./jwt-manager.js";
export { PasswordManager } from "./password-manager.js";
export { IdentityProviderRegistry } from "./identity-provider-registry.js";
export type { AuthProvider, AuthInitiateRequest, AuthInitiateResult, AuthCallbackRequest, AuthCallbackResult } from "./identity-provider-registry.js";
export { RefreshTokenManager } from "./refresh-token-manager.js";
export { CredentialRotationManager } from "./credential-rotation.js";
export { IdentityHooks } from "./identity-hooks.js";
export type { IAuditHook, ITrustHook, IConsentHook, IPolicyHook } from "./identity-hooks.js";

// Authentication Services
export { EmailVerificationManager } from "./email-verification.js";
export { PasswordResetManager } from "./password-reset.js";
export { MagicLinkManager } from "./magic-link.js";
export { OAuthService } from "./oauth-provider.js";
export { MFAManager, MFAMethod } from "./mfa.js";

// Events
export { IdentityEventType, createEvent } from "./identity-events.js";
export type { IdentityEventPayload } from "./identity-events.js";

// Providers
export { GoogleOAuthProvider } from "./providers/google.js";
export { OIDCProvider, SAMLProvider, createMicrosoftProvider, createGitHubProvider, createAppleProvider } from "./providers/oidc.js";

// Routes
export { IdentityRouter } from "./routes/identity-routes.js";