# Environment Strategy — Concierge Patient Portal (v1.1.0 Instantiation)

> **Document:** CONCIERGE_ENVIRONMENT_STRATEGY.md
> **Implements:** `docs/platform/release-management/ENVIRONMENT_STRATEGY.md` (v1.0.0)
> **Product:** Concierge (Patient Portal)
> **Release:** v1.1.0
> **Date:** 2026-07-30

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        Concierge
Public Brand:   AG Synergy
Document:       Environment Strategy (Product Instantiation)
Framework:      WEF v1.0
```

## 1. Environment Tiers

| Tier | Name | Worker | Route | Database | Purpose |
|------|------|--------|-------|----------|---------|
| Tier 1 | Development | Local wrangler dev | `localhost:8787` | Local D1 (seeded) | Local dev + test |
| Tier 2 | Production (Single) | `agsynergy-api` | `api.agsynergy.ca` | `agsynergy-db` | Live service |

**Note:** Concierge currently operates as a single-environment deployment (production only). Preview/staging is achieved via Git branches and the `workers_dev` wrangler flag for ad-hoc testing. Multi-environment (preview + production) is planned for Phase 2.

## 2. Worker Configuration

### API Worker (`workers/wrangler.jsonc`)

```jsonc
{
  "name": "agsynergy-api",
  "main": "src/index.ts",
  "compatibility_date": "2025-09-01",
  "workers_dev": true,  // <-- enables *.workers.dev for ad-hoc preview
  "d1_databases": [{
    "binding": "DB",
    "database_name": "agsynergy-db",
    "database_id": "<production-db-id>"
  }],
  "r2_buckets": [{
    "binding": "R2",
    "bucket_name": "agsynergy-documents"
  }],
  "env": {
    "production": {
      "routes": [{ "pattern": "api.agsynergy.ca", "zone_id": "<zone-id>" }],
      "vars": {
        "ENVIRONMENT": "production",
        "RATE_LIMIT_WINDOW_MS": "60000",
        "RATE_LIMIT_LIMIT": "60"
      }
    }
  }
}
```

### Frontend Worker (`wrangler.jsonc` — root)

```jsonc
{
  "name": "hermes-website",
  "compatibility_date": "2026-07-22",
  "assets": { "directory": "artifacts/ags-fertility/dist/public/", "not_found_handling": "single-page-application" },
  "workers_dev": true,
  "routes": [
    { "pattern": "agsynergy.ca", "zone_id": "<zone-id>" },
    { "pattern": "www.agsynergy.ca", "zone_id": "<zone-id>" }
  ]
}
```

## 3. Secrets (Production)

| Secret | Source | Injection Method |
|--------|--------|-----------------|
| `CLOUDFLARE_API_TOKEN` | GitHub Secrets | `cloudflare/wrangler-action@v4` |
| `JWT_PRIVATE_KEY` | GitHub Secrets | Injected into wrangler vars at deploy time |
| `JWT_PUBLIC_KEY` | GitHub Secrets | Injected into wrangler vars at deploy time |
| `JWT_KID` | GitHub Secrets | Injected into wrangler vars at deploy time |
| `VITE_API_BASE` | GitHub Secrets | `VITE_API_BASE` env var during frontend build |
| `ADMIN_BOT_TOKEN` | Cloudflare Secrets | `wrangler secret put` (set once, persisted) |
| `SENTRY_DSN` | Cloudflare Secrets | `wrangler secret put` (set once, persisted) |
| `SENTRY_AUTH_TOKEN` | Cloudflare Secrets | `wrangler secret put` (set once, persisted) |
| `TURNSTILE_SECRET_KEY` | Cloudflare Secrets | `wrangler secret put` (set once, persisted) |

## 4. Frontend Environment Variables

| Variable | Production Value | Build Time |
|----------|-----------------|------------|
| `VITE_API_BASE` | `https://api.agsynergy.ca` | Build (`pnpm run build`) |
| `VITE_SENTRY_DSN` | Injected via env | Build |
| `VITE_TURNSTILE_SITE_KEY` | Injected via env | Build |

## 5. Deployment Pipeline

See `DEPLOYMENT_REPORT.md` (this release) for the exact pipeline execution.

| Step | Action | Location |
|------|--------|----------|
| 1 | `pnpm install --frozen-lockfile=false` | Root |
| 2 | `VITE_API_BASE=<value> pnpm --filter @workspace/ags-fertility run build` | Root |
| 3 | Bundle guard (no dev endpoints in prod bundle) | CI step |
| 4 | Inject JWT vars into wrangler.jsonc | `workers/` |
| 5 | `wrangler deploy --env production` | `workers/` |
| 6 | `wrangler deploy` | Root |

## 6. Rollback Procedure

```bash
# API Worker rollback to the previous version
cd workers && wrangler rollback --env production

# Frontend Worker rollback
cd /repo/root && wrangler rollback
```

Or redeploy from a specific tag via the CI/CD pipeline.

---

*Concierge Environment Strategy · v1.1.0 instantiation*
*Implements AI Platform ENVIRONMENT_STRATEGY.md v1.0.0*
*Last updated: 2026-07-30*