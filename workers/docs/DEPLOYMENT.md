# AG Synergy — Production Deployment Runbook

**Epic:** EPIC-002-003.5 (Production Readiness)
**Scope:** Worker deploy, D1 migrations, health verification, smoke tests, rollback.
**Owner:** KL · **Last updated:** 2026-07-18

---

## 0. ⚠️ Pre-flight — two blockers to clear BEFORE remote work

These are **not** bugs in the code — they are account/tooling gaps that must be
resolved by a human with Cloudflare access. The code changes in this epic are
complete and all 120 tests pass; only the *remote apply* is gated.

| # | Blocker | Why | Resolution |
|---|---------|-----|------------|
| B1 | `wrangler` is not authenticated in the deploy environment, and the stored **D1 token is D1-scoped only** — it returns `Authentication error [code: 10000]` on `wrangler d1 execute`/`migrations apply`. | A D1-scoped token cannot drive account-level `wrangler` operations. Remote migrations need a token with **Workers + D1** permissions (or `wrangler login`). | Export a full `CLOUDFLARE_API_TOKEN` (Account → My Profile → API Tokens → "Edit Cloudflare Workers" + D1) **or** run `wrangler login` on a machine you control, then run the migration commands in §2 from there. |
| B2 | `wrangler.jsonc` had `d1_databases` only at top level; `wrangler` warns it "is not inherited by environments" → a `wrangler deploy --env production` would **not bind the DB** in prod. | Environments don't inherit top-level `d1_databases`. | **FIXED in this epic** — `d1_databases` is now correctly declared inside `env.production`. Verified the file is structurally valid. |

> The D1 token value stored in memory (`CF_TOKEN_…f1`) is **D1 read/write scoped** and is fine for *direct D1 SQL* via the Cloudflare API, but it is NOT sufficient for `wrangler d1 migrations apply`. Do not attempt to use it for that.

---

## 1. Prerequisites

- Node 18+ and `wrangler` installed (`npx wrangler --version`).
- Authenticated to Cloudflare with a **Workers + D1** capable token (resolves B1).
- Account + DB identifiers (already in `wrangler.jsonc`):
  - Account: `d0a58133c1495fa5e42cbca0aebaa36b`
  - D1 DB: `agsynergy-db` (id `45f52102-74e1-4ba2-86ca-f4d5f88e16c4`)
  - Production route: `api.agsynergy.ca` (custom domain)

---

## 2. D1 Migrations (apply to remote)

Migrations are applied **idempotently** by wrangler via the `d1_migrations`
tracking table. Current canonical set (order matters — alphabetical):

```
migrations/
  0001_initial_schema.sql        # Epic 1: leads, consultations
  0002_rbac_foundation.sql       # RBAC tables + role/permission seed
  0003_ops_lead_fields.sql       # leads.assigned_to / priority / notes + indexes
  0004_role_permissions_seed.sql # role_permissions table + 16 grants
```

> NOTE: `0003_role_permissions.sql` was removed in this epic — it was a
> duplicate of `0004` (conflicting create + different seed UUIDs). The test
> suite references 0002/0003/0004 exactly as above.

### Steps (run from `workers/`)

```bash
# 1. Preview what wrangler will apply (non-destructive listing):
npx wrangler d1 migrations list agsynergy-db --env production

# 2. Apply pending migrations to the REMOTE production DB:
npx wrangler d1 migrations apply agsynergy-db --env production --remote

# 3. Verify applied history on remote:
npx wrangler d1 execute agsynergy-db --env production --remote \
  --command "SELECT name, version, status FROM d1_migrations ORDER BY version" --json
```

Expected: 4 rows, `status = 'applied'`, `version` 1→4.

### Verify schema matches local

The test `globalSetup` applies the same files to a local Miniflare D1 and the
120-test suite passes. To diff remote vs local schema explicitly:

```bash
npx wrangler d1 execute agsynergy-db --env production --remote \
  --command "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name" --json
```

Compare table list + `role_permissions` row count (`SELECT COUNT(*) FROM role_permissions` → **16**) against local.

---

## 3. Worker Deployment

```bash
# Deploy to production (binds DB via env.production.d1_databases — FIXED in B2)
npx wrangler deploy --env production

# Confirm the worker is live:
curl -s https://api.agsynergy.ca/api/v1/health
```

Expected health JSON (expanded contract, EPIC-002-003.5):
```json
{
  "status": "healthy",
  "service": "agsynergy-api",
  "version": "1.3.0",
  "environment": "production",
  "timestamp": "<ISO-8601>",
  "database": {
    "connected": true,
    "migrationVersion": 4,
    "migrationCount": 4
  }
}
```

---

## 4. Health Verification

`GET /api/v1/health` now reports:
- `database.connected` — live `SELECT 1` probe
- `database.migrationVersion` / `migrationCount` — from `d1_migrations`
- `environment`, `version`, `timestamp`

**Interpretation:**
- `200` + `status: "healthy"` → DB reachable, all good.
- `503` + `status: "degraded"` → DB unreachable. **The endpoint does NOT leak
  the error text or any secret.** Page on-call (see §7).

No secrets, tokens, DSNs, or internal IPs are ever returned by this endpoint.

---

## 5. Smoke Tests (post-deploy)

```bash
BASE=https://api.agsynergy.ca

# 1. Health
curl -s -o /dev/null -w "%{http_code}\n" $BASE/api/v1/health   # → 200

# 2. CORS preflight (website origin)
curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS \
  -H "Origin: https://agsynergy.ca" $BASE/api/v1/consultations   # → 204

# 3. Rate-limit header present
curl -s -D - -o /dev/null $BASE/api/v1/health | grep -i x-ratelimit   # → headers

# 4. Consultation happy path (Epic 1 unchanged)
curl -s -X POST $BASE/api/v1/consultations \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke","email":"smoke-<rand>@example.com","phone":"+1-555-000-1111","treatment_interest":"IVF"}' \
  | grep -o '"status":"new"'
```

Full automated suite (local, against Miniflare D1):
```bash
cd workers && npx vitest run   # → 120 passed (as of this epic)
```

---

## 6. Rollback

Workers keep the previous version; rollback is one command:

```bash
# List recent deployments and rollback to the prior one
npx wrangler deployments --env production
npx wrangler rollback --env production          # rolls back to previous version
# or to a specific deployment id:
npx wrangler rollback <deployment-id> --env production
```

**DB rollback:** migrations are NOT auto-reversible. If a migration must be
undone, write a **new forward migration** that undoes the change (do not edit
or delete already-applied migration files — that corrupts `d1_migrations`
history). Treat schema rollback as a planned data-migration, not an instant
revert.

---

## 7. Observability & Alert Thresholds (EPIC-002-003.5)

### Structured logging
All requests emit JSON-line logs via `src/middleware/logger.ts`:
- `request.start` (method, path) on ingress
- `request.complete` (method, path, status, latencyMs) on egress
- `rate_limit.exceeded` (path, limit, retryAfter) on throttle

Logs are ingested by Cloudflare Workers Observability (enabled in
`wrangler.jsonc`). **No request bodies, PII, tokens, or chat ids are logged.**

### Recommended alert thresholds (Cloudflare → Logpush / Workers Analytics)
| Signal | Threshold | Action |
|--------|-----------|--------|
| Health `status: degraded` (DB down) | 1 occurrence | **Page on-call immediately** |
| `5xx` rate | > 2% over 5 min | Investigate worker error logs |
| `rate_limit.exceeded` volume | > 50/min from one IP | Review for abuse / misconfigured client |
| p95 latency (`latencyMs`) | > 1000 ms | Check D1 query performance |
| Deploy failure | any | Block release, inspect build |

### Rate limiting
`src/middleware/rateLimit.ts` — per-IP sliding window, default **60 req / 60s**
(retry-tolerant for Telegram webhooks). Overridable via
`RATE_LIMIT_LIMIT` / `RATE_LIMIT_WINDOW_MS` (set in `wrangler.jsonc` vars).

> **Known limitation:** state is per-isolate (module-level Map). Under
> scale-out this is *approximate* — it throttles within an isolate but is not a
> hard global cap. For a guaranteed global cap, enable Cloudflare Zone →
> Speed → Rate Limiting in front of this Worker. This middleware is the first
> line of defense, not the only one.

---

## 8. Change Summary (this epic)

- ✅ Consolidated migrations: removed duplicate `0003_role_permissions.sql`;
  canonical order `0001→0002→0003_ops_lead_fields→0004_role_permissions_seed`.
- ✅ Fixed `wrangler.jsonc`: `d1_databases` now inside `env.production`
  (resolves B2 — DB will bind in prod).
- ✅ Expanded `/health` (db connectivity, migration version, env, version).
- ✅ Added lightweight per-IP rate limiting + `X-RateLimit-*` headers.
- ✅ Added structured JSON logging (request start/complete, rate-limit hits).
- ✅ Added `.gitignore` (excludes `.env`/`.dev.vars`/`.wrangler`); verified no
  secrets in source control.
- ✅ Updated stale health tests to the new contract; full suite 120/120.
- ⛔ Remote D1 migration + production deploy **blocked on B1** (token perms).
