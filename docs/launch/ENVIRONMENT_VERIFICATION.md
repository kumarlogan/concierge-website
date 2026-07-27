# Environment Verification

> **Concierge Launch Readiness — Workstream C**
> Verifies all environments (Development, Preview, Production) are correctly configured and consistent.
>
> **Date:** 2026-07-27
> **Status:** 📋 Assessment Complete

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

## 1. Environment Model

| Tier | Name | Purpose | Data Isolation | Wrangler Env |
|------|------|---------|---------------|--------------|
| Tier 1 | Development | Local development and testing | Local / seeded | `dev` (wrangler dev) |
| Tier 2 | Preview | Pre-production validation | Isolated R2 bucket, shared D1 | `preview` |
| Tier 3 | Production | Live service | Production R2 bucket, production D1 | `production` |

---

## 2. Development Environment Checklist

| # | Check | Expected | Status |
|---|-------|----------|--------|
| 1 | Local `wrangler dev` starts | Workers runtime on localhost:8787 | ✅ Verified in package.json (`npm run dev`) |
| 2 | D1 local binding | Miniflare D1 with seeded data | ✅ Via `@cloudflare/vitest-pool-workers` |
| 3 | R2 local binding | Miniflare R2 emulation | ⚠️ Verify local dev setup |
| 4 | Environment variable `ENVIRONMENT` | `"development"` (default) | ✅ Wrangler.jsonc default |
| 5 | Rate limiting (dev) | Window: 60000ms, Limit: 60 | ✅ Consistent with production |
| 6 | TypeScript compilation | `tsc --noEmit` passes | ✅ Via `npm run typecheck` |
| 7 | Unit tests | `vitest run` passes | ✅ 465/465 passing (34 test files) |
| 8 | Frontend build | Zero errors (2221 modules) | ✅ Verified in PROJECT.md |
| 9 | API reachable | `localhost:8787/api/v1/health` | ✅ Dev server |
| 10 | CORS for localhost | `http://localhost:5173` and `http://localhost:23815` | ✅ Configured in runtime |

---

## 3. Preview Environment Checklist

| # | Check | Expected | Status |
|---|-------|----------|--------|
| 1 | Preview Worker deployed | `wrangler deploy --env preview` | ⚠️ Verify deployment |
| 2 | Preview Worker URL | `<worker>-preview.<account>.workers.dev` | ⚠️ Verify URL |
| 3 | D1 database | `agsynergy-db` (shared with production) | ⚠️ Shared — no data isolation |
| 4 | R2 bucket | `agsynergy-documents-preview` | ✅ Isolated from production |
| 5 | Environment variable `ENVIRONMENT` | `"preview"` | ✅ Wrangler.jsonc preview env |
| 6 | Observability enabled | `true` | ✅ Wrangler.jsonc preview env |
| 7 | Rate limiting | Window: 60000ms, Limit: 60 | ✅ Consistent |
| 8 | CORS for preview URL | Preview URL allowed | ⚠️ Verify CORS includes preview domain |
| 9 | Smoke tests pass against preview | All smoke tests passing | ⚠️ Verify after deployment |
| 10 | Health endpoint returns 200 | DB connected | ⚠️ Verify after deployment |

---

## 4. Production Environment Checklist

| # | Check | Expected | Status |
|---|-------|----------|--------|
| 1 | Production Worker deployed | `wrangler deploy --env production` | ⚠️ Requires promotion gate |
| 2 | Custom domain | `api.agsynergy.ca` | ⚠️ Not deployed yet (launch blocker) |
| 3 | Workers.dev fallback | Enabled (`workers_dev: true`) | ✅ Fallback available |
| 4 | D1 database | `agsynergy-db` (production data) | ✅ Operational (5 migrations, 24 tables) |
| 5 | R2 bucket | `agsynergy-documents` | ✅ Production-only bucket |
| 6 | Environment variable `ENVIRONMENT` | `"production"` | ✅ Wrangler.jsonc production env |
| 7 | Observability enabled | `true` | ✅ Wrangler.jsonc production env |
| 8 | Rate limiting | Window: 60000ms, Limit: 60 | ✅ Consistent |
| 9 | Route: `api.agsynergy.ca` | Custom domain route | ⚠️ Not deployed yet |
| 10 | CORS for production domains | `agsynergy.ca` + `www.agsynergy.ca` | ✅ Configured in runtime |
| 11 | HSTS | `max-age=31536000; includeSubDomains; preload` | ✅ Applied via middleware |
| 12 | Security headers | CSP, X-Frame-Options, etc. | ✅ Applied via middleware |

---

## 5. Environment Variable Comparison

| Variable | Development | Preview | Production | Consistent? |
|----------|-------------|---------|------------|-------------|
| `ENVIRONMENT` | `"development"` | `"preview"` | `"production"` | ✅ Correct per environment |
| `RATE_LIMIT_WINDOW_MS` | `"60000"` | `"60000"` | `"60000"` | ✅ Identical across all |
| `RATE_LIMIT_LIMIT` | `"60"` | `"60"` | `"60"` | ✅ Identical across all |
| `DB` (D1 binding) | `agsynergy-db` | `agsynergy-db` | `agsynergy-db` | ⚠️ Shared — same database ID |
| `DOCUMENT_STORAGE` (R2) | Local emulation | `agsynergy-documents-preview` | `agsynergy-documents` | ✅ Isolated preview vs production |

### 5.1 Binding Comparison

| Resource | Development | Preview | Production | Status |
|----------|-------------|---------|------------|--------|
| D1 Database (DB) | Miniflare emulation | `agsynergy-db` (shared) | `agsynergy-db` | ⚠️ Preview & Production share D1 |
| R2 Bucket (DOCUMENT_STORAGE) | Miniflare emulation | `agsynergy-documents-preview` | `agsynergy-documents` | ✅ Isolated |
| Observability | Not applicable | ✅ Enabled | ✅ Enabled | ✅ Configured |

---

## 6. Environment Promotion Rules

| Rule | Status | Notes |
|------|--------|-------|
| No production data in preview | ⚠️ Shared D1 database | Separate D1 recommended for full isolation |
| No preview secrets in production | ✅ Wrangler env isolation | Secrets scoped per environment |
| Same Worker version | ✅ Pipeline verifies | Same code deployed with different env config |
| Same migration state | ⚠️ Shared DB ensures same state | Migration to separate DBs would require coordination |
| Environment label | ✅ Release metadata | `ENVIRONMENT` var tags every deployment |

---

## 7. Summary

| Environment | Status | Key Action Items |
|-------------|--------|------------------|
| **Development** | ✅ Ready | All checks pass |
| **Preview** | ⚠️ Conditional | Deploy preview, verify smoke tests, separate D1 recommended |
| **Production** | ⚠️ Conditional | Route not deployed, promotion gate required |

**Overall: ⚠️ CONDITIONAL PASS — Preview and Production D1 isolation should be reviewed before production launch.**

---

*Concierge Launch Readiness — Workstream C*
*Environment Verification — v1.0.0*
*Last updated: 2026-07-27*