# Engineering Deployment Standard — Concierge Platform

> **Document:** CONCIERGE_ENGINEERING_DEPLOYMENT_STANDARD.md
> **Establishes:** Reusable deployment conventions for the Concierge product line.
> **Date:** 2026-07-30
> **Version:** 1.0.0

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        Concierge
Public Brand:   AG Synergy
Document:       Engineering Deployment Standard
Framework:      WEF v1.0
```

## 1. Scope

This standard governs all deployments of the Concierge product to Cloudflare Workers. It applies to:

- `agsynergy-api` — Backend API Worker
- `hermes-website` — Frontend static assets Worker
- Any future Concierge Workers or Pages projects

## 2. Branch Strategy

| Branch | Purpose | Deploys to |
|--------|---------|------------|
| `main` | Production | `api.agsynergy.ca`, `agsynergy.ca` |
| `feat/*` | Feature branches | Dev only (local wrangler dev) |
| `fix/*` | Hotfix branches | Dev only (local wrangler dev) |

**Rule:** Only `main` triggers production deployment. All other branches are local development.

## 3. Versioning

- **Format:** `v<major>.<minor>.<patch>` (SemVer)
- **Source of truth:** `CHANGELOG.md` — topmost `## [version]` header
- **Auto-generated:** `workers/src/version.ts` via `scripts/extract-version.sh`
- **Tagged:** Every production deployment gets a Git tag matching the CHANGELOG version
- **Release cadence:** Per-sprint (no fixed schedule)

### Version Assignment

| Bump | When | Example |
|------|------|---------|
| Major | Breaking API changes, data migration required | v2.0.0 |
| Minor | New features, non-breaking changes | v1.1.0, v1.2.0 |
| Patch | Bug fixes, security patches, hotfixes | v1.1.1, v1.1.2 |

## 4. Pre-Deployment Gates

All gates must pass before a deployment is considered valid:

### 4.1 Build Gate
```bash
pnpm install --frozen-lockfile=false
VITE_API_BASE="https://api.agsynergy.ca" pnpm --filter @workspace/ags-fertility run build
```

### 4.2 Bundle Guard
The production bundle MUST NOT reference any dev/staging hostname:
```bash
# Negative check
BAD=$(grep -rEl 'kumarlogan\.workers\.dev|localhost:[0-9]+' artifacts/ags-fertility/dist/public/assets/*.js)
[ -n "$BAD" ] && exit 1

# Positive check
grep -rqF "https://api.agsynergy.ca" artifacts/ags-fertility/dist/public/assets/*.js
```

### 4.3 API Health Gate
After deploy, the API health endpoint must respond healthy:
```bash
curl -s https://api.agsynergy.ca/api/v1/health | grep '"status": "healthy"'
curl -s https://api.agsynergy.ca/api/v1/health | grep '"version": "1.1.0"'
```

### 4.4 Secret Injection
JWT signing keys must be injected before API Worker deployment:
- `JWT_PRIVATE_KEY` — RSA private key (PEM)
- `JWT_PUBLIC_KEY` — RSA public key (PEM)
- `JWT_KID` — Key ID string

These are GitHub Secrets, NOT committed to the repo.

## 5. Deployment Steps

### 5.1 Automated (CI/CD — Default)

The GitHub Actions workflow `.github/workflows/deploy.yml` handles all steps:

1. Checkout code at the pushed commit
2. Install pnpm and dependencies
3. Build frontend with `VITE_API_BASE`
4. Run bundle guard
5. Inject JWT config into API worker wrangler.jsonc
6. Deploy API Worker: `wrangler deploy --env production`
7. Deploy Frontend Worker: `wrangler deploy`

### 5.2 Manual (Emergency)

For emergency hotfixes direct from CLI:
```bash
# Set JWT env vars first (from 1Password or GitHub Secrets)
export JWT_PRIVATE_KEY="..."
export JWT_PUBLIC_KEY="..."
export JWT_KID="..."

# Build and deploy
VITE_API_BASE="https://api.agsynergy.ca" pnpm --filter @workspace/ags-fertility run build
cd workers && node -e '...inject JWT...' && wrangler deploy --env production
cd /repo/root && wrangler deploy
```

## 6. Post-Deployment Verification

After every deployment, verify:

| Check | Command | Expected |
|-------|---------|----------|
| API health | `curl https://api.agsynergy.ca/api/v1/health` | `{"status":"healthy","version":"1.1.0",...}` |
| Frontend HTTP | `curl -sI https://agsynergy.ca` | `HTTP/2 200` |
| Frontend TLS | `curl -sI https://agsynergy.ca` | Valid TLS certificate |
| API route | `curl -sI https://api.agsynergy.ca/api/v1/timeline` | `HTTP/2 401` (unauthenticated) or `200` (authenticated) |

## 7. Rollback

### 7.1 Quick Rollback (CLI)
```bash
cd workers && wrangler rollback --env production  # API Worker
cd /repo/root && wrangler rollback                  # Frontend Worker
```

### 7.2 Full Redeploy (Git)
```bash
git checkout <previous-stable-tag>
git push origin HEAD:main --force  # triggers CI/CD
```

## 8. Release Artifacts

Every release MUST produce:
- `DEPLOYMENT_REPORT.md` — What was deployed, how, and verification results
- `ENVIRONMENT_STRATEGY.md` — Current environment configuration
- `PREVIEW_VALIDATION_CHECKLIST.md` — What was checked before production
- `PRODUCTION_SMOKE_TEST.md` — What was verified after deployment
- Git tag in `v<major>.<minor>.<patch>` format
- CHANGELOG entry documenting the release

## 9. Monitoring

Post-deployment monitoring:
- **API health:** `https://api.agsynergy.ca/api/v1/health` (automated check)
- **Sentry:** Error tracking for both API and frontend
- **Cloudflare:** Worker logs in Cloudflare Dashboard
- **D1:** Database connection status in health endpoint

---

*Engineering Deployment Standard — Concierge Platform v1.0.0*
*Establishes reusable conventions for all Concierge deployments*
*Last updated: 2026-07-30*