# MVP Security Baseline — Concierge Production Hardening

## AGS Fertility — AI Platform

**Version:** 1.0
**Date:** 2026-07-29
**Framework:** WEF v1.0
**Certification Revision:** `864f213`

---

## Governance Header

| Field | Value |
|-------|-------|
| **Company** | AGS Fertility |
| **Platform** | AI Platform |
| **Product** | Concierge |
| **Public Brand** | AG Synergy |
| **Repository** | concierge-website |
| **Document Type** | Security Baseline Reference |
| **Effective From** | 2026-07-29 |

---

## 1. Purpose

This document defines the **minimum security baseline** for the Concierge MVP in production. It serves as:

- A hardening checklist for operations
- A reference for future security reviews
- A boundary document defining what is acceptable vs. what requires remediation
- A handoff document for Phase 3 security improvements

---

## 2. Active Security Controls

### 2.1 Authentication (AUTH Layer)

| Control | Implementation | Verification |
|---------|---------------|--------------|
| JWT-based route authentication | `withJwtAuth` middleware on 39 routes | All PHI-accessing routes require valid JWT |
| JWT signing | RS256 (asymmetric) via Web Crypto API | `JwtManager` — keypair from env vars |
| Token expiry | Access: 1h, Refresh: 30d, Magic link: 15min | Configurable via env |
| Refresh token rotation | SHA-256 hashed storage, rotation on use | `RefreshTokenManager` |
| Session management | Role-based expiry, idle timeout, bulk revocation | `SessionManager` |
| Password hashing | PBKDF2-SHA256, 100K iterations, 32-byte salt | `PasswordManager` (constant-time compare) |
| Password policy | Min 12 chars, upper/lower/digit/special, max 3 repeats | OWASP 2023 compliant |
| Email verification | Single-use tokens, SHA-256 hashed, 24h expiry | `EmailVerificationManager` |
| Magic link auth | 15-min expiry, one-time use, silent failure on unknown email | `MagicLinkManager` |
| RBAC enforcement | `requirePermission` on ops routes | `@hermes/permissions/middleware.js` |

### 2.2 Authorization (Trust Runtime)

| Control | Implementation | Verification |
|---------|---------------|--------------|
| Consent enforcement | `ConsentEngine.evaluate()` — fail-closed (deny if no consent) | All 9 consent-type enums supported |
| Policy evaluation | `PolicyEngine` — fail-closed, deny-wins | RBAC, ABAC, ReBAC, time/device/risk |
| Delegation | `DelegationEngine` — privilege ceiling, scope, expiry | Chain validation |
| Trust scoring | `TrustEngine` — adaptive risk scoring | Integrated with consent/policy |
| Audit trail | Append-only, identity metadata only, PHI-free | `DocumentAudit`, `IdentityRepository.recordEvent()` |

### 2.3 PHI Protection

| Control | Implementation | Verification |
|---------|---------------|--------------|
| PHI boundary markers | Explicit declarations in every engine module | All 12+ engine files |
| JWT PHI exclusion | `JwtPayload` has only identity metadata | No health data in claims |
| API response filtering | Metadata-only responses for documents, messages | Code review confirmed |
| Document encryption | AES-256-GCM for PHI documents, SHA-256 checksums | `DocumentEncryption` |
| Storage segregation | R2 bucket isolation (isPhi flag) | `resolveBucket()` |
| Key rotation | Versioned keys, old keys retained for decryption | `KeyManager.rotateKey()` |
| Consultation intake | Turnstile captcha + honeypot field | `verifyTurnstile()` middleware |
| Error responses | Structured errors, no stack traces, no internal paths | All route handlers |

### 2.4 Infrastructure Security

| Control | Implementation | Verification |
|---------|---------------|--------------|
| Transport security | TLS at Cloudflare edge, HSTS enabled | Response headers confirmed |
| CORS | Whitelist-based (agsynergy.ca, localhost dev), `Vary: Origin` | `cors.ts` middleware |
| CSP | `default-src 'self'`, restrictive policy | Production headers verified |
| Secrets management | GitHub secrets → wrangler env vars (no committed secrets) | `deploy.yml`, `.gitleaks.toml` |
| Rate limiting | Sliding window per-IP, 60 req/60s | `rateLimit.ts` |
| Security headers | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy | `security-headers.ts` |
| D1 access | Workers only; no external database access | Architecture boundary |
| R2 access | Pre-signed URLs; no public buckets | Architecture boundary |

---

## 3. Deployment Security

### 3.1 CI/CD Pipeline

| Stage | Security Control | Verification |
|-------|-----------------|--------------|
| Pre-commit | `gitleaks` secrets detection | `.gitleaks.toml` configured |
| Build | TypeScript compilation (`tsc --noEmit`) | Blocks type errors |
| Test | `vitest run` — all 614 tests | Blocks regressions |
| Deploy | `wrangler deploy --env production` | JWT secrets injected as env vars |
| Workers | Two workers deployed (`agsynergy-api`, `hermes-website`) | Separate scopes |

### 3.2 Environment Variables (Production)

| Variable | Source | Type | Notes |
|----------|--------|------|-------|
| `JWT_PRIVATE_KEY` | GitHub secret | Sensitive | NEVER committed |
| `JWT_PUBLIC_KEY` | GitHub secret | Public | Shared with verification |
| `JWT_KID` | GitHub secret | Public | Key identifier |
| `PLATFORM_JWT_PUBLIC_KEY` | GitHub secret | Public | Cross-worker verification |
| `PLATFORM_JWT_KID` | GitHub secret | Public | Cross-worker verification |
| `TURNSTILE_SECRET_KEY` | GitHub secret | Sensitive | For captcha verification |
| `DB` | wrangler binding | Internal | D1 database binding |

### 3.3 Wrangler Configuration

```jsonc
// wrangler.jsonc — production keys
{
  "vars": {
    "JWT_PUBLIC_KEY": "<from GH secret>",
    "JWT_KID": "<from GH secret>",
    "PLATFORM_JWT_PUBLIC_KEY": "<from GH secret>",
    "PLATFORM_JWT_KID": "<from GH secret>",
    // PRIVATE_KEY is injected via GH secret → wrangler deploy --var
  }
}
```

**Note:** `JWT_PRIVATE_KEY` is injected at deploy time via GitHub Actions (`--var` flag) — it is NEVER set in `wrangler.jsonc`.

---

## 4. Accepted Residual Risks

These risks are **accepted** for MVP launch and tracked for phased remediation.

| # | Risk | Severity | Planned Fix | Target |
|---|------|----------|-------------|--------|
| R1 | Message engine in-memory — data lost on cold start | 🟡 MEDIUM | D1-backed `MessageEngine` | Phase 3 |
| R2 | TOTP non-standard — incompatible with authenticator apps | 🟡 MEDIUM | Integrate `otpauth` library | Phase 3 |
| R3 | Backup code hash (djb2) — weak entropy for 6-digit codes | 🟡 MEDIUM | SHA-256 hashing | Phase 3 |
| R4 | TOTP secrets in metadata JSON — not separately encrypted | 🟡 MEDIUM | Separate encryption key | Phase 3 |
| R5 | Encryption keys in memory — lost on cold start | 🟡 MEDIUM | KMS integration | Phase 3 |
| R6 | Document audit in-memory — lost on cold start | 🟡 MEDIUM | D1-backed `AuditStorage` | Phase 3 |
| R7 | Rate limiting per-isolate (not global) | 🟢 LOW | Cloudflare Zone rate limiting | Phase 3 |
| R8 | `wirePlatformEngines` type safety bypass | 🟢 LOW | Proper `Env` type | Phase 4 |
| R9 | Magic link schema abusage (`session_id: ""`) | 🟢 LOW | Schema normalization | Phase 4 |

---

## 5. Production Security Checklist

Use this checklist before every production deployment or configuration change.

### Pre-Deploy

- [ ] `npx vitest run` — all 614 tests pass
- [ ] `npx tsc --noEmit` — clean compilation
- [ ] `gitleaks detect` — no secrets in source
- [ ] Git working tree clean (no uncommitted changes)
- [ ] JWT secrets present in GitHub Actions secrets
- [ ] `deploy.yml` injects `JWT_PRIVATE_KEY` as `--var` (not hardcoded)
- [ ] No `console.log`, debug code, or TODO stubs in committed code

### Post-Deploy

- [ ] `GET /api/v1/health` returns 200 with DB connected
- [ ] `POST /api/v1/health/db` returns migration version 9+
- [ ] JWT login flow works end-to-end (register → verify → login → protected route)
- [ ] Unauthenticated requests to protected routes return 401
- [ ] Consultation endpoint returns 403 without Turnstile token
- [ ] Consent: revoke consent → verify access denied
- [ ] Password change: verify old password rejected, new policy enforced
- [ ] All `withJwtAuth` routes return 200 with valid token, 401 without

### Monitoring

- [ ] Structured logging active on all Workers
- [ ] Audit events logged for identity operations
- [ ] Rate limit headers visible in responses
- [ ] CORS errors visible in browser dev tools (if frontend issues)

---

## 6. Incident Response Quick Reference

### Suspected Security Incident

1. **Stop deployment** — Halt any in-progress wrangler deploy
2. **Check health** — `GET /api/v1/health` for DB connectivity
3. **Verify auth** — Attempt a protected route without token (should 401)
4. **Review logs** — Check Worker `wrangler tail` for anomalies
5. **Rotate keys** — If JWT keys compromised:
   - Generate new keypair: `openssl genrsa -out private.pem 2048 && openssl rsa -in private.pem -pubout -out public.pem`
   - Update GitHub secrets (`JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`)
   - Redeploy (all existing JWTs become invalid — forces re-login)
6. **Revoke sessions** — All active sessions invalidated on password/key change

### Key Contacts

| Role | Contact |
|------|---------|
| Operations | Hermes Agent (Telegram) |
| Code owner | GitHub: `kumarlogan` |
| Deploy pipeline | GitHub Actions |

---

## 7. Future Hardening Roadmap

### Phase 3 (Short-Term)

| Item | Effort | Impact |
|------|--------|--------|
| D1-backed MessageEngine | Medium | Data durability for messaging |
| TOTP compliance (otpauth) | Small | MFA works with standard apps |
| SHA-256 backup codes | Small | Better hash integrity |
| Key Manager KMS integration | Medium | Production key management |
| D1-backed audit storage | Medium | Persistent audit trail |
| Cloudflare Zone rate limiting | Small (config) | Global rate enforcement |
| Turnstile on all public forms | Small | Bot protection everywhere |
| Real-time security alerting | Medium | Incident detection |

### Phase 4 (Medium-Term)

| Item | Effort | Impact |
|------|--------|--------|
| Proper Env type for platform engines | Medium | Type safety |
| Magic link schema normalization | Small | Schema integrity |
| End-to-end message encryption | Large | Message privacy |
| Mutual TLS for service-to-service | Large | Internal security |
| Penetration testing | Medium | External validation |

---

## 8. Compliance References

| Standard | Applicability | Current Status |
|----------|--------------|----------------|
| WEF v1.0 | Internal framework | ✅ 87% compliance (26/30 controls) |
| OWASP API Security Top 10 | API security | ✅ 7/10 passing |
| OWASP Password Policy | Credential management | ✅ Compliant (12-char, PBKDF2) |
| RFC 6238 (TOTP) | MFA | ⚠️ Non-compliant (deferred to Phase 3) |
| RFC 7519 (JWT) | Token auth | ✅ Compliant (RS256, claims) |
| RFC 6749 (OAuth2 refresh tokens) | Token rotation | ✅ Compliant (rotation, hashing) |
| NIST SP 800-63B (AAL2) | Identity assurance | ⚠️ Partial (MFA deferred) |

---

## 9. Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-29 | Hermes Agent | Initial baseline after certification |

---

*End of MVP Security Baseline — July 29, 2026*