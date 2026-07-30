# Deployment Report — v1.1.0 Patient Zero Experience

> **Release:** v1.1.0
> **Sprint:** AGS-PZE-001 (Patient Zero Experience)
> **Date:** 2026-07-30
> **Deployed By:** Hermes Agent (CI/CD — GitHub Actions)

## What Was Deployed

### API Worker (`agsynergy-api`)
- **Route:** `api.agsynergy.ca`
- **Version:** 1.1.0
- **Commit:** `fd03575`
- **JWT:** Enabled (production signing key injected via GitHub Secrets)
- **D1:** `agsynergy-db` (migration v9)
- **R2:** `agsynergy-documents`

### Frontend Worker (`hermes-website`)
- **Route:** `agsynergy.ca` / `www.agsynergy.ca`
- **Built from:** `fd03575`
- **VITE_API_BASE:** `https://api.agsynergy.ca` (production)

## Changes Since v1.0.1

| Area | Change |
|------|--------|
| Timeline API | Removed all Patient Zero mock data; per-user JWT-isolated timeline queries |
| Dashboard | Real empty state for new patients instead of fake appointments/data |
| Frontend API clients | Auth header propagation, JWT-based per-user isolation |
| Error handling | Proper 401/403 handling for unauthenticated/unauthenticated access |
| Consultations | Turnstile CAPTCHA integration for public forms |
| Backend infrastructure | Identity service consolidation, env type alignments |
| Sentry scopes | Per-user identity scoping in error reporting |
| Booking dialog | New component for self-serve appointment booking |

## Deployment Pipeline

The deployment was executed via GitHub Actions (`cloudflare/wrangler-action@v4`):

1. **Build Frontend** — `pnpm --filter @workspace/ags-fertility run build`
2. **Bundle Guard** — Verify no dev/staging endpoints in production bundle
3. **Inject JWT** — Inject `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `JWT_KID` into API worker config
4. **Deploy API** — `wrangler deploy --env production` (workers/)
5. **Deploy Frontend** — `wrangler deploy` (root)

## Verification

| Check | Status |
|-------|--------|
| Frontend Build | ✅ Passed (CI) |
| Bundle Guard | ✅ Passed (CI) |
| API Deploy | ✅ Passed (CI) |
| Frontend Deploy | ✅ Passed (CI) |
| API Health (`/api/v1/health`) | ✅ healthy (v1.1.0, db connected) |
| Frontend HTTP 200 | ✅ agsynergy.ca |
| JWT keys injected | ✅ 1703-char private key |

## Rollback

To roll back to v1.0.1:
```bash
cd workers && wrangler rollback --env production   # API
cd /repo/root && wrangler rollback                  # Frontend
```

Or redeploy the v1.0.1 commit:
```bash
git checkout 864f213
git tag v1.0.1-stable
git push origin v1.0.1-stable
# GitHub Actions will deploy from this tag
```