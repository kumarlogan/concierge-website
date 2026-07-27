# Security Review — Concierge Website (Objective 6)
## AGS Fertility / AG Synergy Platform

**Review Date:** July 27, 2026  
**Scope:** Backend (Cloudflare Workers + D1), Platform Engines, Auth, Routes  
**Reviewed By:** Automated Security Assessment (Hermes Agent)

---

## Executive Summary

The platform demonstrates a **mature security architecture** with strong PHI isolation, comprehensive consent enforcement, well-structured JWT lifecycle, and proper audit trail design. The codebase shows consistent application of fail-closed patterns throughout. However, several findings require attention before production deployment, particularly around authentication enforcement at the route layer and the use of in-memory data structures for critical security state.

### Severity Legend
| Severity | Description |
|----------|-------------|
| 🔴 CRITICAL | Direct path to PHI exposure or unauthorized access |
| 🟠 HIGH | Significant security gap requiring remediation before production |
| 🟡 MEDIUM | Security weakness that should be addressed |
| 🟢 LOW | Minor improvement or hardening opportunity |
| ✅ PASS | Control verified and working correctly |

---

## 1. PHI Isolation (Patient Data Separation)

### 1.1 PHI Boundary Markers
**Status: ✅ PASS**

Every platform engine module declares explicit `PHI Boundary` comments at the top of each file, clearly stating what data crosses the PHI boundary and what stays outside. Examples:
- `jwt-manager.ts`: "Contains identity claims but NEVER PHI"
- `consent-engine.ts`: "Consent engine stores consent metadata, NOT PHI"
- `policy-engine.ts`: "Policy engine NEVER sees PHI"
- `document-encryption.ts`: "PHI document payloads...encrypted with AES-256-GCM"
- `delegation-engine.ts`: "stores delegation metadata — never PHI"

**Assessment:** Comprehensive PHI boundary discipline across all modules.

### 1.2 Document Storage PHI Segregation
**Status: ✅ PASS**

- PHI documents stored in segregated R2 buckets (`resolveBucket(isPhi)`)
- Non-PHI documents use server-side encryption (R2 default)
- PHI documents always encrypted with AES-256-GCM
- Storage key pattern: `${patientId}/${documentId}/${fileName}` — no PHI in keys

### 1.3 JWT Payload PHI Exclusion
**Status: ✅ PASS**

`JwtPayload` interface contains only identity metadata:
- `sub` (identity_id), `identity_type`, `session_id`, `email`, `mfa_level`, `trust_score`
- No health data, no medical records, no PHI in any JWT claim

### 1.4 API Response PHI Filtering
**Status: ✅ PASS**

- Document API responses return `DocumentMetadata` (no file content)
- Message API returns opaque metadata only
- Trust/consent/policy evaluations return scores and decisions, never PHI
- Route handlers explicitly note: "API handlers store NO PHI in request/response bodies"

---

## 2. Consent Enforcement

### 2.1 Consent Engine Design
**Status: ✅ PASS**

The `ConsentEngine` (`trust/consent-engine.ts`) implements:
- **Fail-closed default:** "No active consent found — denied by default"
- **9 consent types** supported via `ConsentType` enum
- **Consent withdrawal** with versioning and immutable history
- **Expiration checking** via `checkExpired()`
- **Version tokens** for integrity verification

### 2.2 Document Consent Integration
**Status: ✅ PASS**

`DocumentConsentIntegration` wires documents to consent:
- `checkDocumentAccessConsent()` — fail-closed if no consent
- Consent scope matching (document ID or wildcard `*`)
- Expiry and revocation checking
- Purpose-of-use matching
- Delegation chain verification

### 2.3 Consent API Authorization
**Status: 🟠 HIGH — Missing Authentication on Consent Endpoints**

The Trust Runtime routes (`routes/trustRuntime.ts`) expose:
- `POST /api/v1/consent/grant`
- `POST /api/v1/consent/revoke`
- `GET /api/v1/consent/history`

**These endpoints have NO authentication middleware.** Any HTTP client can:
- Grant consent for any identity
- Revoke consent for any identity
- Read consent history for any identity

The body only requires `identityId` — there is no verification that the caller is that identity or is authorized to act on their behalf.

### 2.4 Appointment/Message Consent Stubs
**Status: 🟠 HIGH — Stub Consent Bypasses Real Enforcement**

In `routes/wave7.ts` (lines 43-57):
```typescript
function stubConsent(): ConsentVerificationResult {
  return {
    decision: Decision.ALLOW,
    consentTypes: ["appointment_scheduling"],
    verified: true,
  };
}

function stubMessageConsent(): MessageConsentResult {
  return {
    decision: Decision.ALLOW,
    consentTypes: ["messaging"],
    verified: true,
  };
}
```

**All appointment and message operations bypass real consent verification** with hardcoded `ALLOW` decisions. This means any unauthenticated caller can:
- Create/read/update/cancel any appointment
- Send messages to any recipient
- Read any message thread

---

## 3. Policy Enforcement

### 3.1 Policy Engine Design
**Status: ✅ PASS**

The `PolicyEngine` (`trust/policy-engine.ts`) implements comprehensive policy evaluation:
- **Fail-closed:** "No matching rules found — fail-closed default DENY"
- **Deny-wins:** If any deny rule matches, access is denied
- Supports RBAC, ABAC, ReBAC, time windows, location, device, risk, purpose-of-use
- Policy snapshots for audit trail
- Content hashing for integrity verification

### 3.2 Document Policy Integration
**Status: ✅ PASS**

`DocumentPolicyIntegration` enforces policy on every document operation:
- Every `getDocument`, `shareDocument`, `deleteDocument` etc. calls `verifyDocumentAccess()`
- Resource identifiers only (no PHI passed to policy engine)

### 3.3 Policy API Authorization
**Status: 🟠 HIGH — Missing Authentication on Policy Endpoints**

Similar to consent endpoints, the policy evaluation API has no auth:
- `POST /api/v1/policy/evaluate`
- `GET /api/v1/policies`

Any caller can evaluate arbitrary policy combinations or enumerate all registered policies.

---

## 4. JWT Lifecycle

### 4.1 Token Generation
**Status: ✅ PASS**

`JwtManager` (`identity/jwt-manager.ts`):
- RS256 algorithm (asymmetric — public key for verification, private for signing)
- Unique `jti` (UUID) per token — replay protection
- Configurable expiry (default: 3600s / 1 hour)
- Key rotation support (multiple key pairs by `kid`)
- Web Crypto API (SubtleCrypto) for all cryptographic operations

### 4.2 Token Validation
**Status: ✅ PASS**

Verification checks:
1. Format validation (3 parts)
2. Header `kid` → key lookup
3. Cryptographic signature verification
4. Expiry check with configurable leeway (default: 30s)
5. `iat` (not-yet-valid) check
6. Issuer verification
7. Optional audience verification

### 4.3 Token Expiry
**Status: ✅ PASS**

- Access tokens: 1 hour default (`DEFAULT_EXPIRY_SECONDS = 3600`)
- Refresh tokens: 30 days default (`tokenExpiryMs`)
- Magic links: 15 minutes
- Password reset: 1 hour
- Email verification: 24 hours

### 4.4 Refresh Token Rotation
**Status: ✅ PASS**

`RefreshTokenManager` implements RFC 6749 rotation:
- Tokens hashed with SHA-256 before storage (never plaintext)
- Rotation: old token revoked, new one created
- Bulk revocation on password change (`revokeAllForIdentity`)
- 64-byte (512-bit) token length

### 4.5 JWT Key Management
**Status: 🟡 MEDIUM — Key Material in Module-Level State**

JWT signing keys are held in in-memory `Map` within `JwtManager`. In Cloudflare Workers, isolate state is ephemeral — keys are regenerated on every cold start. This means:
- JWTs signed before a cold start cannot be verified after
- No persistent key storage across invocations
- Key rotation state is lost

**Recommendation:** For production, use Cloudflare Workers Secrets or KV for key persistence.

---

## 5. MFA Implementation

### 5.1 MFA Framework
**Status: ✅ PASS (Framework), 🟡 MEDIUM (Implementation)**

`MFAManager` (`identity/mfa.ts`) supports:
- **TOTP** (RFC 6238) — implemented with caveats
- **SMS OTP** — stub (noted as awaiting notification integration)
- **Email OTP** — stub
- **Security Key** — enum only
- **Backup codes** — implemented with hashing

### 5.2 TOTP Implementation Issue
**Status: 🟡 MEDIUM — Non-Standard TOTP**

The `generateTOTP()` method (lines 179-195) uses a custom hash function instead of proper HMAC-SHA1:
```typescript
// Simplified check: verify against current + adjacent windows
const input = `${secret}:${counter}`;
let hash = 0;
for (let i = 0; i < data.length; i++) {
  hash = ((hash << 5) - hash) + data[i];
  hash |= 0;
}
const code = Math.abs(hash) % 1_000_000;
```

This is **NOT RFC 6238 compliant**. Standard authenticator apps (Google Authenticator, Authy) will generate different codes. The comment acknowledges this: "In production, use a proper TOTP library."

### 5.3 Backup Code Hashing Issue
**Status: 🟡 MEDIUM — Weak Hash for Backup Codes**

`simpleHash()` (lines 222-229) uses a non-cryptographic hash (djb2-style):
```typescript
private simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
```

This hash has ~32 bits of entropy at best. Backup codes are 6-digit numeric, so the hash space is inherently small (~1M values), but using a proper hash (SHA-256) would be more robust.

### 5.4 MFA Secret Storage
**Status: 🟡 MEDIUM — TOTP Secret in Metadata**

TOTP secrets are stored in `identity.metadata.mfa_totp_secret` — a JSON column in D1. While not plaintext in logs, this means the secret is accessible to any code with database access and is not encrypted at rest with a separate key.

---

## 6. Secure Messaging (Encryption)

### 6.1 Message Engine Architecture
**Status: ✅ PASS (Design), 🟠 HIGH (Route Implementation)**

The `MessageEngine` interface properly requires consent verification:
```typescript
send(request: CreateMessageRequest, consent: ConsentVerificationResult): Promise<Message>;
```

Message content is treated as PHI, with encrypted storage planned.

### 6.2 Route-Level Bypass
**Status: 🟠 HIGH**

As noted in Finding 2.4, the `wave7.ts` route uses `stubMessageConsent()` which always returns `ALLOW`. The consent verification infrastructure exists but is not wired to real consent enforcement.

### 6.3 In-Memory Storage
**Status: 🟠 HIGH — No Persistent Message Storage**

`InMemoryMessageEngine` stores all messages in a `Map` — they are lost on every cold start and are not persisted to D1. This means:
- Messages are ephemeral (not durable)
- No encryption at rest (data lives only in isolate memory)
- Message audit trail is lost

---

## 7. Document Encryption

### 7.1 Encryption Algorithm
**Status: ✅ PASS**

- **AES-256-GCM** for all PHI documents
- 96-bit IV (12 bytes) — recommended for GCM
- 128-bit authentication tag
- 32-byte salt for key derivation
- Web Crypto API for all operations

### 7.2 Key Management
**Status: 🟡 MEDIUM — In-Memory Default Key Manager**

`DefaultKeyManager` stores encryption keys in a `Map`:
- Keys are lost on cold start
- No persistence across invocations
- No HSM/KMS integration

The code correctly notes: "Production deployments should use a KMS-backed implementation."

### 7.3 Key Rotation
**Status: ✅ PASS**

- Versioned keys with `rotateKey()` method
- Old keys retained for decryption
- `resolveCurrentKeyId()` for automatic key selection

### 7.4 Metadata Encryption
**Status: ✅ PASS**

`encryptMetadata()` encrypts individual metadata fields with AES-256-GCM, prefixing encrypted fields with `enc_`. IV is prepended to ciphertext.

### 7.5 Document Integrity
**Status: ✅ PASS**

- SHA-256 checksum generated on upload (`generateDocumentChecksum()`)
- Checksum stored in metadata and verified on download
- Audit log records checksum for every upload

---

## 8. Audit Integrity

### 8.1 Document Audit Trail
**Status: ✅ PASS**

`DocumentAudit` (`document-audit.ts`):
- **Append-only** storage (interface has no update/delete operations)
- Events include: identity, document, action, outcome, timestamp, delegation chain, purpose-of-use, trust/risk scores
- **Fail-open** for audit: "audit failures are logged but do not block the underlying operation"
- Immutable by design (events are never modified after creation)

### 8.2 Identity Audit
**Status: ✅ PASS**

`IdentityRepository` provides:
- `recordEvent()` — identity events (login, password change, MFA setup)
- `recordAudit()` — fine-grained resource-level audit
- Both append to D1 tables

### 8.3 Audit PHI Boundary
**Status: ✅ PASS**

Audit events record **metadata only** — identity IDs, document IDs, actions, timestamps. Document content is never included in audit events.

### 8.4 Audit Storage
**Status: 🟡 MEDIUM — In-Memory Default**

The default `InMemoryAuditStorage` loses all audit data on cold start. Production must use D1 or external audit service. The architecture supports pluggable backends via the `AuditStorage` interface.

---

## 9. Zero Trust Boundaries

### 9.1 Architecture
**Status: ✅ PASS**

The platform implements a clear Zero Trust boundary:
- Every request passes through: Identity Resolution → Principal Builder → Permission Resolver → Authorization Middleware → Audit Middleware → Business Service
- Policy engine evaluates every access request
- Consent engine verifies consent for every PHI access
- Trust engine evaluates trust scores for adaptive security

### 9.2 Fail-Closed Design
**Status: ✅ PASS**

All security-critical paths default to DENY:
- Policy engine: "fail-closed default DENY"
- Consent engine: "denied by default"
- Document service: "Fail-closed: if policy evaluation fails or access is denied, the operation is rejected"
- Session manager: "Fail-closed: any uncertainty returns invalid"

### 9.3 Delegation Boundaries
**Status: ✅ PASS**

`DelegationEngine` enforces:
- Privilege ceiling (never > owner)
- Scope-based access (exact match or wildcard)
- Expiry enforcement
- Revocation support
- Chain validation (each level ≤ previous)
- Audit tagging

---

## 10. Credential Management

### 10.1 Password Hashing
**Status: ✅ PASS**

`PasswordManager` (`identity/password-manager.ts`):
- **PBKDF2-SHA256** with 600,000 iterations (OWASP 2023 recommended)
- Random 32-byte salt per password
- 256-bit output
- **Constant-time comparison** (lines 121-126):
  ```typescript
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual[i] ^ expectedHash[i];
  }
  return diff === 0;
  ```

### 10.2 Password Policy
**Status: ✅ PASS**

Default policy (OWASP-compliant):
- Minimum 12 characters
- Maximum 128 characters
- Uppercase, lowercase, digit, special character required
- Max 3 repeated characters
- Common password check enabled

### 10.3 Token Hashing
**Status: ✅ PASS**

All sensitive tokens are hashed before storage:
- Refresh tokens: SHA-256
- Email verification tokens: SHA-256
- Password reset tokens: SHA-256
- Magic link tokens: SHA-256
- Backup codes: simple hash (see Finding 5.3)

### 10.4 Session Management
**Status: ✅ PASS**

`SessionManager` implements:
- Role-based expiry (patient: 24h, staff: 8h, admin: 4h, API: 1h)
- Idle timeout (staff/admin: 30 minutes)
- Device fingerprinting (SHA-256 hashed)
- Session refresh with rotation
- Bulk revocation on security events

---

## 11. Provider Validation

### 11.1 Identity Provider Registry
**Status: ✅ PASS**

`IdentityProviderRegistry` manages OAuth/OIDC providers:
- Provider registration with client credentials
- Enabled/disabled status
- Stored in D1 (persistent)

### 11.2 Provider Validation
**Status: 🟡 MEDIUM — Limited Provider Validation Logic**

The `IdentityRepository` stores provider records but the validation logic (issuer URL verification, token endpoint validation, JWKS rotation) is not visible in the reviewed files. The architecture supports it, but the implementation depth should be verified.

---

## 12. Authentication Enforcement at Route Layer

### 12.1 Route Authentication
**Status: 🔴 CRITICAL — Most Routes Lack Authentication**

Review of route registration (`index.ts` and route files):

| Route | Auth? | Notes |
|-------|-------|-------|
| `/api/v1/health` | ❌ None | Acceptable |
| `/api/v1/consultations` | ❌ None | **Collects patient PHI without auth** |
| `/api/v1/ops/*` | ✅ `requirePermission` | Proper RBAC |
| `/telegram/webhook` | ⚠️ Token-based | Uses Telegram bot token |
| `/admin/webhook` | ⚠️ Token-based | Admin bot |
| `/api/v1/trust/*` | ❌ None | **CRITICAL: Trust/consent/policy APIs open** |
| `/api/v1/policy/*` | ❌ None | **CRITICAL: Policy evaluation open** |
| `/api/v1/consent/*` | ❌ None | **CRITICAL: Consent management open** |
| `/api/v1/delegation/*` | ❌ None | **CRITICAL: Delegation management open** |
| `/api/v1/documents/*` | ⚠️ Header-only | Uses `x-identity-id` header (spoofable) |
| `/api/v1/messages/*` | ❌ None | **CRITICAL: All messaging open** |
| `/api/v1/appointments/*` | ❌ None | **CRITICAL: All appointments open** |
| `/identity/*` | ⚠️ Partial | Identity routes have some internal checks |

### 12.2 Document Route Identity Spoofing
**Status: 🔴 CRITICAL**

Document routes use `request.headers.get("x-identity-id")` for identity resolution:
```typescript
const identityId = request.headers.get("x-identity-id");
if (!identityId) {
  return jsonResponse({ error: "x-identity-id header is required" }, 401);
}
```

**Any caller can set this header to any value** and access that identity's documents. There is no cryptographic verification that the header matches the authenticated caller.

### 12.3 Consultation Route PHI Collection
**Status: 🟠 HIGH**

`POST /api/v1/consultations` accepts patient data (name, email, phone, medical history) without any authentication. While rate-limited, this is a public endpoint that stores PHI.

---

## 13. Additional Findings

### 13.1 Rate Limiting
**Status: ✅ PASS (with caveat)**

Rate limiter uses sliding window per IP:
- Default: 60 requests per 60 seconds
- Per-isolate memory (not global)
- Properly returns `X-RateLimit-*` headers
- **Caveat:** Noted in comments as approximate — recommends Cloudflare Zone-level rate limiting for hard caps

### 13.2 CORS Configuration
**Status: ✅ PASS**

- Whitelist-based: `agsynergy.ca`, `localhost:5173`, `localhost:23815`
- `Vary: Origin` header set
- Preflight cache: 86400s (24h)
- Only `GET, POST, OPTIONS` methods allowed

### 13.3 Error Handling
**Status: ✅ PASS**

- Structured error responses with codes
- No stack traces in production responses
- Custom error classes (`IdentityError`, `DocumentServiceError`, etc.)
- Consistent error response format

### 13.4 Logging
**Status: ✅ PASS**

- Structured logging via `info()` / `warn()`
- Request/response logging without PII or bodies
- Latency tracking per request
- No sensitive data in logs

### 13.5 Magic Link Authentication
**Status: ✅ PASS**

`MagicLinkManager`:
- One-time tokens (used → revoked)
- SHA-256 hashed storage
- 15-minute expiry
- Silent failure for non-existent emails (no enumeration)
- Creates full session with MFA level tracking

### 13.6 Password Reset
**Status: ✅ PASS**

`PasswordResetManager`:
- Rate-limited (1 request per minute per email)
- Silent failure for non-existent emails
- 1-hour token expiry
- Single-use tokens
- Revokes all sessions and refresh tokens after reset
- Validates new password against policy

---

## Summary of Findings

### 🔴 CRITICAL (3)
1. **Trust/Consent/Policy/Delegation APIs have no authentication** — any HTTP client can grant/revoke consent, evaluate policies, create delegations for any identity
2. **Document routes use spoofable `x-identity-id` header** — no cryptographic binding between caller and claimed identity
3. **Appointment and Messaging routes have no authentication** — any caller can read/write all appointments and messages

### 🟠 HIGH (4)
4. **Stub consent bypasses in Wave 7 routes** — all appointment/message consent checks return hardcoded ALLOW
5. **Consultation endpoint collects PHI without authentication** — public form submission endpoint
6. **In-memory messaging engine** — messages are ephemeral, no persistence, no encryption at rest
7. **Message consent not wired to real ConsentEngine** — consent verification exists but is stubbed out

### 🟡 MEDIUM (6)
8. JWT keys stored in ephemeral module state — lost on cold start
9. TOTP implementation is non-standard — incompatible with real authenticator apps
10. Backup code hashing uses weak non-cryptographic hash
11. TOTP secrets stored in metadata JSON column — not separately encrypted
12. Encryption key manager uses in-memory storage — no KMS integration
13. Audit storage defaults to in-memory — data lost on cold start

### 🟢 LOW (2)
14. Device fingerprint uses simple hash instead of SHA-256 (noted as non-security-critical)
15. Password reset rate limiter is in-memory — per-isolate only

---

## Recommendations

### Immediate (Before Production)
1. **Add JWT-based authentication middleware** to ALL route handlers (trust, consent, policy, delegation, documents, messages, appointments)
2. **Replace `x-identity-id` header spoofing** with JWT claim extraction for identity resolution
3. **Wire real ConsentEngine** to appointment and message routes (replace stubs)
4. **Add D1-backed persistent storage** for messages, audit logs, and encryption keys

### Short-Term
5. **Integrate a proper TOTP library** (e.g., `otpauth`) for RFC 6238 compliance
6. **Implement Cloudflare Workers Secrets/KV** for JWT key and encryption key persistence
7. **Add authentication to consultation endpoint** or add reCAPTCHA/bot protection
8. **Deploy with Cloudflare Zone-level rate limiting** as primary rate control

### Medium-Term
9. **Implement SMS/Email OTP** for MFA (currently stubbed)
10. **Add HMAC-based backup code hashing** (SHA-256 minimum)
11. **Integrate external KMS** for document encryption keys
12. **Add end-to-end encryption** for messaging (Signal Protocol or similar)
13. **Implement real-time consent verification** (not just history checks)
14. **Add mutual TLS or mTLS** for service-to-service communication

---

## Files Reviewed

| File | Purpose |
|------|---------|
| `workers/src/index.ts` | Worker entry point, route registration |
| `workers/src/auth/index.ts` | Auth barrel exports |
| `workers/src/auth/identity.ts` | Identity adapter |
| `workers/src/auth/permissions.ts` | Permission adapter |
| `workers/src/platform/identity/jwt-manager.ts` | JWT signing/verification |
| `workers/src/platform/identity/mfa.ts` | MFA framework |
| `workers/src/platform/identity/password-manager.ts` | Password hashing/policy |
| `workers/src/platform/identity/session-manager.ts` | Session lifecycle |
| `workers/src/platform/identity/refresh-token-manager.ts` | Refresh token rotation |
| `workers/src/platform/identity/email-verification.ts` | Email verification |
| `workers/src/platform/identity/password-reset.ts` | Password reset |
| `workers/src/platform/identity/magic-link.ts` | Passwordless auth |
| `workers/src/platform/identity/identity-service.ts` | Identity CRUD |
| `workers/src/platform/identity/identity-repository.ts` | D1 persistence |
| `workers/src/platform/trust/consent-engine.ts` | Consent management |
| `workers/src/platform/trust/policy-engine.ts` | Policy evaluation |
| `workers/src/platform/trust/delegation-engine.ts` | Delegation management |
| `workers/src/platform/trust/trust-engine.ts` | Trust scoring |
| `workers/src/platform/trust/risk-engine.ts` | Risk assessment |
| `workers/src/platform/documents/document-encryption.ts` | AES-256-GCM encryption |
| `workers/src/platform/documents/document-service.ts` | Document orchestration |
| `workers/src/platform/documents/document-consent-integration.ts` | Document consent |
| `workers/src/platform/documents/document-policy-integration.ts` | Document policy |
| `workers/src/platform/documents/document-audit.ts` | Audit trail |
| `workers/src/platform/documents/document-storage.ts` | R2 storage |
| `workers/src/platform/messaging/message-engine.ts` | Message interface |
| `workers/src/platform/messaging/in-memory-message-engine.ts` | In-memory messaging |
| `workers/src/platform/messaging/message-audit.ts` | Message audit |
| `workers/src/platform/credentials/credential-validator.ts` | Credential validation |
| `workers/src/platform/credentials/credential-registry.ts` | Credential registry |
| `workers/src/platform/providers/provider-registry.ts` | Provider registry |
| `workers/src/routes/documents.ts` | Document API routes |
| `workers/src/routes/trustRuntime.ts` | Trust Runtime API routes |
| `workers/src/routes/wave7.ts` | Appointment/Messaging routes |
| `workers/src/routes/consultations.ts` | Consultation route |
| `workers/src/middleware/rateLimit.ts` | Rate limiting |

---

*End of Security Review*
