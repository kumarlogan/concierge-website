# Secrets Verification

> **Concierge Launch Readiness — Workstream C**
> Documents required secrets, their status across environments, rotation schedule, and access control.
>
> **Date:** 2026-07-27
> **Status:** 📋 Assessment Complete (code-level analysis only — no secret values inspected)

---

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        Concierge
Public Brand:   AG Synergy
Framework:      WEF v1.0 (Workforce Execution Framework)
```

---

## 1. Required Secrets List

### 1.1 Worker Secrets (Set via `wrangler secret put`)

| # | Secret Name | Purpose | Used In | Required In |
|---|-------------|---------|---------|-------------|
| 1 | `JWT_SECRET` | JWT signing/verification | Identity Core (jwt-manager.ts) | All environments |
| 2 | `ENCRYPTION_KEY` | Document encryption/decryption | Document Service (document-encryption.ts) | All environments |
| 3 | `PLATFORM_JWT_PUBLIC_KEY` | JWT public key for verification | jwt-auth.ts middleware | All environments |
| 4 | `PLATFORM_JWT_KID` | Key identifier for JWT key pair | jwt-auth.ts middleware | All environments |
| 5 | `TELEGRAM_BOT_TOKEN` | Operations Telegram Bot authentication | telegram.ts route | Production (preview optional) |
| 6 | `ADMIN_BOT_TOKEN` | Hermes Admin Bot authentication | adminBot.ts route | Production (preview optional) |
| 7 | `OPENROUTER_API_KEY` | OpenRouter API access | Workforce orchestration | Production (preview optional) |
| 8 | `GITHUB_TOKEN` | GitHub API access (deployments, releases) | Deployment services | Production (preview optional) |

### 1.2 Pages Environment Variables (Set via Cloudflare Dashboard)

| # | Variable Name | Purpose | Required In |
|---|---------------|---------|-------------|
| 1 | `API_BASE_URL` | Backend API URL for frontend | Preview, Production |
| 2 | `SITE_URL` | Canonical site URL | Preview, Production |
| 3 | `PUBLIC_ENVIRONMENT` | Environment label for frontend | All environments |
| 4 | `GA_MEASUREMENT_ID` | Google Analytics tracking ID | Production only |

---

## 2. Secret Status Per Environment

### 2.1 Workers Secrets

| Secret | Development | Preview | Production | Notes |
|--------|-------------|---------|------------|-------|
| `JWT_SECRET` | ✅ Local .dev.vars | ⚠️ Check dashboard | ⚠️ Check dashboard | Shared or per-environment? |
| `ENCRYPTION_KEY` | ✅ Local .dev.vars | ⚠️ Check dashboard | ⚠️ Check dashboard | Must be unique per environment |
| `PLATFORM_JWT_PUBLIC_KEY` | ❌ Not set (dev uses defaults) | ⚠️ Check dashboard | ⚠️ Check dashboard | Used in jwt-auth middleware |
| `PLATFORM_JWT_KID` | ❌ Not set (dev uses "default") | ⚠️ Check dashboard | ⚠️ Check dashboard | Defaults to "default" in code |
| `TELEGRAM_BOT_TOKEN` | ❌ Not needed locally | ⚠️ Check dashboard | ⚠️ Check dashboard | Operations Bot |
| `ADMIN_BOT_TOKEN` | ❌ Not needed locally | ⚠️ Check dashboard | ⚠️ Check dashboard | Admin Bot |
| `OPENROUTER_API_KEY` | ❌ Not needed locally | ⚠️ Check dashboard | ⚠️ Check dashboard | Workforce orchestration |
| `GITHUB_TOKEN` | ❌ Not needed locally | ⚠️ Check dashboard | ⚠️ Check dashboard | Deployment services |

### 2.2 Pages Variables

| Variable | Development | Preview | Production | Notes |
|----------|-------------|---------|------------|-------|
| `API_BASE_URL` | `http://localhost:8787` | ⚠️ Check dashboard | ⚠️ Check dashboard | Points to Worker |
| `SITE_URL` | `http://localhost:5173` | ⚠️ Check dashboard | ⚠️ Check dashboard | Used for canonical URLs |
| `PUBLIC_ENVIRONMENT` | `development` | `preview` | `production` | Labels frontend |
| `GA_MEASUREMENT_ID` | — | — | ⚠️ Check dashboard | Production only |

---

## 3. Secret Rotation Schedule

| # | Secret | Rotation Frequency | Last Rotated | Next Rotation | Owner |
|---|--------|-------------------|--------------|---------------|-------|
| 1 | `JWT_SECRET` | Every 90 days | Not tracked | — | Engineering Lead |
| 2 | `ENCRYPTION_KEY` | Every 180 days | Not tracked | — | Engineering Lead |
| 3 | `PLATFORM_JWT_KEY_PAIR` | Every 180 days | Not tracked | — | Engineering Lead |
| 4 | `TELEGRAM_BOT_TOKEN` | On compromise or every 365 days | Not tracked | — | Operations Lead |
| 5 | `ADMIN_BOT_TOKEN` | On compromise or every 365 days | Not tracked | — | Engineering Lead |
| 6 | `OPENROUTER_API_KEY` | Every 90 days | Not tracked | — | Engineering Lead |
| 7 | `GITHUB_TOKEN` | Every 90 days | Not tracked | — | Engineering Lead |

**Recommendation:** Establish a rotation schedule and track in PSER. Use a secrets management tool (1Password, Vault, Doppler) for auditable rotation.

---

## 4. Access Control

| # | Secret | Who Has Access | Access Method | Audit Trail |
|---|--------|---------------|--------------|-------------|
| 1 | `JWT_SECRET` | Operators, CI/CD | Wrangler secret, Cloudflare dashboard | Cloudflare audit log |
| 2 | `ENCRYPTION_KEY` | Operators, CI/CD | Wrangler secret, Cloudflare dashboard | Cloudflare audit log |
| 3 | `PLATFORM_JWT_PUBLIC_KEY` | Operators, CI/CD | Wrangler secret, Cloudflare dashboard | Cloudflare audit log |
| 4 | `PLATFORM_JWT_KID` | Operators, CI/CD | Wrangler secret, Cloudflare dashboard | Cloudflare audit log |
| 5 | `TELEGRAM_BOT_TOKEN` | Operators, CI/CD | Wrangler secret, Cloudflare dashboard | Cloudflare audit log |
| 6 | `ADMIN_BOT_TOKEN` | Operators, CI/CD | Wrangler secret, Cloudflare dashboard | Cloudflare audit log |
| 7 | `OPENROUTER_API_KEY` | Operators, CI/CD | Wrangler secret, Cloudflare dashboard | Cloudflare audit log |
| 8 | `GITHUB_TOKEN` | Operators, CI/CD | Wrangler secret, Cloudflare dashboard | Cloudflare audit log |

**Recommendation:**
- Restrict Cloudflare dashboard access to authorized operators only
- Use Cloudflare's API tokens with scoped permissions instead of global API keys
- Enable Cloudflare audit logging for all secret operations
- Consider using platform credential management (`credentials/` module) for runtime secret resolution

---

## 5. Credential Management Platform Code

The codebase includes a reusable credential management capability:

| Module | Purpose | Status |
|--------|---------|--------|
| `platform/credentials/credential-registry.ts` | In-memory credential registry | ✅ Implemented |
| `platform/credentials/credential-resolver.ts` | Resolves credentials for providers | ✅ Implemented |
| `platform/credentials/credential-validator.ts` | Validates credential format/validity | ✅ Implemented |
| `platform/credentials/credential-audit.ts` | Audit logging for credential operations | ✅ Implemented |
| `platform/credentials/credential-rotation.ts` | Automated credential rotation | ✅ Implemented |
| `platform/credentials/credential-health-checker.ts` | Health checking for credentials | ✅ Implemented |

These modules form the platform's credential management capability but are not yet wired into the CI/CD pipeline or Wrangler secret management.

---

## 6. Summary

| Category | Status |
|----------|--------|
| Required secrets identified | ✅ 8 worker secrets + 4 Pages variables documented |
| Secrets set in Workers (Preview) | ⚠️ Verify in Cloudflare dashboard |
| Secrets set in Workers (Production) | ⚠️ Verify in Cloudflare dashboard |
| Secrets set in Pages (Preview) | ⚠️ Verify in Cloudflare dashboard |
| Secrets set in Pages (Production) | ⚠️ Verify in Cloudflare dashboard |
| Rotation schedule defined | ⚠️ Recommended: 90-180 day rotation |
| Access control documented | ⚠️ Operators + CI/CD; recommend restricting dashboard access |
| Platform credential management | ✅ Implemented in code but not wired to CI/CD |

**Overall: ⚠️ CONDITIONAL PASS — Verify secrets are set in Cloudflare dashboard; establish rotation schedule and access control policy.**

---

*Concierge Launch Readiness — Workstream C*
*Secrets Verification — v1.0.0*
*Last updated: 2026-07-27*