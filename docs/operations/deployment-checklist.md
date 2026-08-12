# Deployment Checklist — AG Synergy

**Purpose:** Pre-deployment and post-deployment verification for email infrastructure changes.

**Last Updated:** 2026-08-05

---

## Pre-Deployment

- [ ] All typecheck errors resolved (`npx tsc --noEmit` in `workers/`)
- [ ] All tests passing (`pnpm vitest run` in `workers/`)
- [ ] No secrets hardcoded in source files
- [ ] `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` declared in `Env` interface
- [ ] `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` declared in `wrangler.jsonc` vars for all 3 environments
- [ ] `ResendProvider` imported only in `index.ts` (composition root)
- [ ] `EmailService` instantiated only in `index.ts`
- [ ] `EmailService` is optional (`undefined` when secrets absent)
- [ ] `getBaseUrl()` uses `APP_URL` env var with fallback
- [ ] `APP_URL` placeholder added to all `wrangler.jsonc` environments

## Deployment Steps

1. Push to `main` branch
2. CI runs: typecheck → test → build → gitleaks scan
3. CI deploys to preview environment automatically
4. Verify preview deployment: `wrangler deploy --env preview`
5. Run smoke test against preview URL
6. Merge PR to `main`
7. CI deploys to production automatically
8. Verify production deployment: `wrangler deploy --env production`

## Post-Deployment

- [ ] Health endpoint returns 200: `curl https://api.agsynergy.ca/health`
- [ ] Email service health check: `curl https://api.agsynergy.ca/identity/health`
- [ ] Verify `APP_URL` resolves correctly in production
- [ ] Send test verification email to known address
- [ ] Confirm email received in inbox (not spam)
- [ ] Check Resend dashboard for successful send
- [ ] Verify SPF/DKIM/DMARC pass in email headers
- [ ] Monitor error rate for 15 minutes post-deploy

## Rollback

If deployment causes issues:
1. Revert the commit on `main`
2. CI will redeploy the previous version automatically
3. Verify previous version is serving correctly
4. Investigate and fix in a new branch
5. Re-run deployment checklist