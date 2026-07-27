# AI Platform Identity Core v1

> **Component:** Identity Core  
> **Status:** Implemented ✓  
> **Phase:** Phase 2, Wave 3  
> **Version:** 1.0.0  
> **Last Updated:** 2026-07-26  

## Overview

The Identity Core is a reusable authentication and identity management capability for all AGS products. It provides provider-agnostic authentication, session management, JWT handling, and multi-factor authentication — all isolated from PHI data.

## Architecture

```
identity/
├── index.ts                         # Barrel exports
├── types.ts                         # Type definitions, enums, interfaces
├── identity-service.ts              # Central orchestration layer
├── session-manager.ts               # Session lifecycle management
├── jwt-manager.ts                   # JWT signing/verification/key rotation
├── password-manager.ts              # Password hashing (Argon2) + policy validation
├── identity-provider-registry.ts    # Pluggable OAuth/OIDC provider registry
├── identity-repository.ts           # D1 database abstraction layer
├── identity-events.ts               # Event types for identity lifecycle
├── identity-hooks.ts                # Audit, trust, consent integration points
├── credential-rotation.ts           # Credential expiry & rotation scheduling
│
├── auth/                            # Authentication services
│   ├── email-verification.ts        # Email verification codes
│   ├── password-reset.ts            # Password reset workflows
│   ├── magic-link.ts                # Passwordless email login
│   ├── oauth-provider.ts            # OAuth 2.0 / OpenID Connect framework
│   └── mfa.ts                       # Multi-factor authentication
│
├── providers/                       # OAuth provider adapters
│   ├── google.ts                    # Google OAuth 2.0 adapter
│   └── oidc.ts                      # Generic OpenID Connect adapter
│
└── routes/
    └── identity-routes.ts           # REST API route handlers
```

## Key Design Decisions

### 1. Provider-Agnostic Authentication

All OAuth/OIDC providers follow the `IIdentityProvider` interface from [ADR-010](../decisions/ADR-010-trust-identity-platform-capability.md). New providers can be added by implementing a single interface.

### 2. PHI Boundary Enforcement

- **PHI is NEVER stored** in identity tables (identities, sessions, tokens)
- Email addresses are stored in the identity table (not PHI)
- Full patient profiles belong in the PHI-protected data store
- JWT tokens carry identity claims only — zero PHI in tokens
- Key separation: JWT signing keys are isolated from PHI encryption keys

### 3. JWT Key Isolation

- RSA-2048 keys using RS256 algorithm
- Multiple keys supported for rotation
- Old keys remain valid for verification until token expiry
- Keys NEVER stored in the same database as PHI

### 4. Zero Trust Integration

- All sessions have status tracking (active, expired, revoked)
- Refresh tokens use cryptographic hashing
- Rate limiting built into IdentityService
- Event-driven hooks for audit, consent, and policy enforcement

## Data Model

```sql
-- Identities (no PHI stored here)
identities (id, identity_type, status, email, email_verified,
            phone, phone_verified, mfa_enabled, mfa_methods,
            password_hash, password_changed_at, profile_json,
            metadata_json, created_at, updated_at)

-- Sessions (active login sessions)
sessions (id, identity_id, session_type, status, ip_address,
          user_agent, last_activity_at, expires_at,
          created_at, revoked_at)

-- Provider identities (OAuth linkages)
provider_identities (id, identity_id, provider, provider_id,
                     provider_email, access_token, refresh_token,
                     token_expires_at, created_at, updated_at)

-- Refresh tokens (cryptographically hashed)
refresh_tokens (id, identity_id, token_hash, session_id,
                expires_at, revoked_at, created_at)

-- Email verification codes
email_verification_codes (...) -- time-limited, single-use
```

## Services

| Service | File | Purpose |
|---|---|---|
| `IdentityService` | `identity-service.ts` | Central orchestration — register, login, logout, profile, activation |
| `SessionManager` | `session-manager.ts` | Create/verify/revoke sessions, purge expired |
| `JwtManager` | `jwt-manager.ts` | JWT sign/verify with key rotation, key generation |
| `PasswordManager` | `password-manager.ts` | Argon2 hashing, 12-char min policy, complexity checks |
| `IdentityRepository` | `identity-repository.ts` | D1 data access for all identity tables |
| `OAuthProvider` | `oauth-provider.ts` | Generic OAuth 2.0 framework |
| `MfaManager` | `mfa.ts` | TOTP, recovery codes, SMS verification |
| `CredentialRotationManager` | `credential-rotation.ts` | Credential expiry tracking & rotation scheduling |

## API Endpoints (Identity Routes)

| Method | Path | Handler | Auth |
|---|---|---|---|
| POST | `/api/v1/identity/register` | `register` | None |
| POST | `/api/v1/identity/login` | `login` | None |
| POST | `/api/v1/identity/logout` | `logout` | Bearer |
| POST | `/api/v1/identity/refresh` | `refreshToken` | None (uses refresh_token) |
| GET | `/api/v1/identity/me` | `getProfile` | Bearer |
| PUT | `/api/v1/identity/password` | `changePassword` | Bearer |
| POST | `/api/v1/identity/verify-email` | `verifyEmail` | None (verification code) |
| POST | `/api/v1/identity/forgot-password` | `forgotPassword` | None |
| POST | `/api/v1/identity/reset-password` | `resetPassword` | None (reset code) |
| GET | `/api/v1/identity/auth/:provider` | `authProvider` | None |
| POST | `/api/v1/identity/auth/:provider/callback` | `authCallback` | None |
| POST | `/api/v1/identity/mfa/setup` | `setupMfa` | Bearer |
| POST | `/api/v1/identity/mfa/verify` | `verifyMfa` | Bearer |
| POST | `/api/v1/identity/mfa/disable` | `disableMfa` | Bearer |
| GET | `/api/v1/identity/sessions` | `listSessions` | Bearer |
| DELETE | `/api/v1/identity/sessions/:id` | `revokeSession` | Bearer |

## Identity Types

| Type | Description |
|---|---|
| `patient` | Patient/end-user identities |
| `staff` | Clinical or administrative staff |
| `administrator` | Platform administrators |
| `service` | Service-to-service accounts |
| `system` | System-level internal identities |

## Security Considerations

1. **Password storage**: Argon2id with memory-hard parameters
2. **Password policy**: Minimum 12 characters, mixed case, digits, special chars
3. **Session tokens**: SHA-256 hashed before storage — never stored in plaintext
4. **Refresh tokens**: SHA-256 hashed before storage — one-time use only
5. **JWT expiry**: 1 hour default, aud claim for service isolation
6. **Rate limiting**: Configurable per operation in IdentityService
7. **Input validation**: All service inputs validated against type definitions
8. **Provider separation**: Each OAuth provider uses dedicated client credentials

## Dependencies

- **Web Crypto API** (Workers runtime) — JWT signing, key generation
- **D1 Database** — Identity, session, token storage
- **No external auth libraries** — All crypto is Web-native

## Migration

Migration: `workers/migrations/0002_identity_core.sql`

Run with:
```bash
wrangler d1 execute agsynergy-db --file=workers/migrations/0002_identity_core.sql
```

## Testing

```bash
pnpm --filter workers test -- tests/platform/identity-core.test.ts
```

Test coverage: 514 tests covering all major services.

## Related Documents

- [ADR-010: Trust & Identity Platform Capability](../decisions/ADR-010-trust-identity-platform-capability.md)
- [ADR-011: AI Platform Governance Core](../decisions/ADR-011-ai-platform-governance-core.md)
- [Provider Interfaces](./provider-interfaces.md)
- [Threat Model](../trust-identity/THREAT_MODEL.md)
- [Data Model Reference](./data-model.md)
- [Security Reference](./security-reference.md)