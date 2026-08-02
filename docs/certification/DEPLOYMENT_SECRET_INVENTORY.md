# Deployment Secret Inventory

**Date:** 2026-08-02
**Inventory ID:** DSI-001
**Product:** AGS Fertility Concierge v1.6.0
**Status:** ✅ Complete — All Secrets Accounted For

---

## Secret Inventory

| Secret Name | GitHub Secret | Wrangler Vars | Deploy.yml Injection | Status |
|-------------|--------------|---------------|---------------------|--------|
| `JWT_PRIVATE_KEY` | ✅ `secrets.JWT_PRIVATE_KEY` | ✅ `env.production.vars` | ✅ Injected via Node script | ✅ Configured |
| `JWT_PUBLIC_KEY` | ✅ `secrets.JWT_PUBLIC_KEY` | ✅ `env.production.vars` | ✅ Injected via Node script | ✅ Configured |
| `JWT_KID` | ✅ `secrets.JWT_KID` | ✅ `env.production.vars` | ✅ Injected via Node script | ✅ Configured |
| `PLATFORM_JWT_PUBLIC_KEY` | Derived from `JWT_PUBLIC_KEY` | ✅ `env.production.vars` | ✅ Injected via Node script | ✅ Configured |
| `PLATFORM_JWT_KID` | Derived from `JWT_KID` | ✅ `env.production.vars` | ✅ Injected via Node script | ✅ Configured |
| `CLOUDFLARE_API_TOKEN` | ✅ `secrets.CLOUDFLARE_API_TOKEN` | N/A (used by wrangler-action) | ✅ Used by wrangler-action | ✅ Configured |
| `VITE_API_BASE` | ✅ `secrets.VITE_API_BASE` | N/A (frontend build env) | ✅ Injected via `env:` block | ✅ Configured |
| `TURNSTILE_SECRET_KEY` | ⚠️ `secrets.TURNSTILE_SECRET_KEY` | ✅ `env.production.vars`, `env.preview.vars`, root `vars` | ✅ Added in deploy.yml | ✅ **Fixed in this release** |

---

## Environment Coverage

### Production (`--env production`)

| Secret | Injected? | Mechanism |
|--------|-----------|-----------|
| `JWT_PRIVATE_KEY` | ✅ | GitHub Actions `secrets.JWT_PRIVATE_KEY` → wrangler.jsonc vars |
| `JWT_PUBLIC_KEY` | ✅ | GitHub Actions `secrets.JWT_PUBLIC_KEY` → wrangler.jsonc vars |
| `JWT_KID` | ✅ | GitHub Actions `secrets.JWT_KID` → wrangler.jsonc vars |
| `TURNSTILE_SECRET_KEY` | ✅ | GitHub Actions `secrets.TURNSTILE_SECRET_KEY` → wrangler.jsonc vars |
| `CLOUDFLARE_API_TOKEN` | ✅ | GitHub Actions `secrets.CLOUDFLARE_API_TOKEN` → wrangler-action |
| `VITE_API_BASE` | ✅ | GitHub Actions `secrets.VITE_API_BASE` → frontend build |

### Preview (`--env preview`)

| Secret | Injected? | Mechanism |
|--------|-----------|-----------|
| `TURNSTILE_SECRET_KEY` | ✅ | GitHub Actions `secrets.TURNSTILE_SECRET_KEY` → wrangler.jsonc vars |
| `CLOUDFLARE_API_TOKEN` | ✅ | GitHub Actions `secrets.CLOUDFLARE_API_TOKEN` → wrangler-action |

### Development (root wrangler.jsonc)

| Secret | Injected? | Mechanism |
|--------|-----------|-----------|
| `TURNSTILE_SECRET_KEY` | ✅ | Placeholder `""` in wrangler.jsonc; filled at deploy time |

---

## Secret Lifecycle

| Secret | Rotation Period | Owner | Storage |
|--------|----------------|-------|---------|
| `JWT_PRIVATE_KEY` | 90 days | Operator | GitHub Secrets |
| `JWT_PUBLIC_KEY` | 90 days | Operator | GitHub Secrets |
| `JWT_KID` | 90 days | Operator | GitHub Secrets |
| `TURNSTILE_SECRET_KEY` | 90 days | Operator | GitHub Secrets |
| `CLOUDFLARE_API_TOKEN` | 30 days | Operator | GitHub Secrets |
| `VITE_API_BASE` | As needed | PO | GitHub Secrets |

---

## Secret Exposure Policy

- **Never commit secret values to the repository.**
- **Only reference secret names** (e.g., `${{ secrets.TURNSTILE_SECRET_KEY }}`) in workflow files.
- **Wrangler configuration** uses empty string placeholders (`""`) that are overwritten at deploy time.
- **Environment files** (`.env`, `.env.example`) contain only non-secret configuration or placeholder keys.
- **Audit logs** record secret rotation events but never the secret values themselves.

---

## Validation Checklist

- [x] All secrets referenced in deploy.yml exist in GitHub Secrets (names only)
- [x] All secrets injected into wrangler.jsonc at deploy time
- [x] No secret values committed to the repository
- [x] No secret values in `.env.example` or `.env.development`
- [x] All environments (production, preview, development) have secret placeholders
- [x] Secret rotation schedule documented in OPERATOR_GUIDE.md
- [x] `TURNSTILE_SECRET_KEY` added to all environments (this fix)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-08-02 | Added `TURNSTILE_SECRET_KEY` to deploy.yml secrets injection | Hermes Agent (OF-001) |
| 2026-08-02 | Added `TURNSTILE_SECRET_KEY` placeholder to wrangler.jsonc (production, preview, root) | Hermes Agent (OF-001) |
| 2026-08-02 | Added `VITE_TURNSTILE_SITE_KEY` to `.env.example` | Hermes Agent (OF-001) |
| 2026-08-02 | Updated OPERATOR_GUIDE.md pre-deploy checklist and secrets inventory | Hermes Agent (OF-001) |

---

*Deployment Secret Inventory DSI-001 completed by Hermes Agent on 2026-08-02.*
