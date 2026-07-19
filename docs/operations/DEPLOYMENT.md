# Deployment Runbook

> AG Synergy Platform — Cloudflare Workers + D1 Deployment
> **Version:** 1.0 | **Last updated:** 2026-07-18

## Pre-Flight Checklist

Before deploying, verify:

- [ ] All tests pass: `cd workers && pnpm test`
- [ ] Migration files are in order (no gaps in numbering)
- [ ] `wrangler.jsonc` has correct environment configuration
- [ ] Secrets are configured (if any): `wrangler secret list --env production`
- [ ] No uncommitted changes: `git status` is clean

## Deployment Environments

| Environment | CLI Flag | URL | D1 Database |
|---|---|---|---|
| **Preview** (staging) | `--env preview` | `https://agsynergy-api.<subdomain>.workers.dev` | Preview D1 instance |
| **Production** | `--env production` | `https://agsynergy-api.kumarlogan.workers.dev` | `agsynergy-db` (`45f52102`) |
| **Local** | `--local` | `http://localhost:8787` | Miniflare D1 (in-memory) |

## Deploying the Worker

### One-Step Deploy (recommended)

```bash
cd workers && ./deploy.sh
```

The deploy script wraps `wrangler deploy` with pre-flight checks.

### Manual Deploy

```bash
# Production
cd workers && wrangler deploy --env production

# Preview (staging)
cd workers && wrangler deploy --env preview
```

### Verifying Deployment

```bash
# Health check
curl https://agsynergy-api.kumarlogan.workers.dev/api/v1/health

# Expected: {"status":"healthy","service":"agsynergy-api","version":"0.1.0","environment":"production","timestamp":"..."}
```

## Database Migrations

Migrations are **not applied automatically** during deploy. Apply them separately.

### Check Migration Status

```bash
# Production
cd workers && wrangler d1 migrations list agsynergy-db --env production

# Preview
cd workers && wrangler d1 migrations list agsynergy-db --env preview
```

### Apply Migrations

```bash
# Production
cd workers && wrangler d1 migrations apply agsynergy-db --env production

# Preview
cd workers && wrangler d1 migrations apply agsynergy-db --env preview
```

### Create a New Migration

```bash
cd workers && wrangler d1 migrations create agsynergy-db <descriptive_name>
```

Edit the generated SQL file in `workers/migrations/`, then apply as above.

**Migration Rules:**
- Forward-only — no rollback migrations
- Numbered sequentially: `0001_`, `0002_`, etc.
- Test locally first: `wrangler d1 migrations apply agsynergy-db --local`

Full strategy: [`docs/database/MIGRATION_STRATEGY.md`](../database/MIGRATION_STRATEGY.md)

## Rollback

### Worker Rollback

Cloudflare Workers support instant rollback via the dashboard or CLI:

```bash
# Roll back to the previous deployment
wrangler rollback agsynergy-api

# Roll back to a specific deployment ID
wrangler rollback agsynergy-api <deployment-id>
```

Deployment IDs are shown in the output of `wrangler deploy`.

### Database Rollback

**No direct rollback.** Migrations are forward-only per policy.

If a migration causes issues:
1. Create a **new forward migration** that corrects the problem
2. Apply it: `wrangler d1 migrations apply agsynergy-db --env production`
3. Document the correction in `CHANGELOG.md`

## Secrets Management

### Adding a Secret

```bash
wrangler secret put SECRET_NAME --env production
# Paste value at prompt
```

### Listing Secrets

```bash
wrangler secret list --env production
```

### Rotating Secrets

```bash
# 1. Create new secret
wrangler secret put SECRET_NAME --env production

# 2. Deploy the Worker (picks up new secret)
wrangler deploy --env production

# 3. Verify with health endpoint
curl https://agsynergy-api.kumarlogan.workers.dev/api/v1/health
```

## Troubleshooting

### Worker returns 500 Internal Server Error

1. Check Cloudflare Dashboard → Workers & Pages → agsynergy-api → Logs
2. Verify D1 binding is correct: `wrangler.jsonc` should have `"binding": "DB"`
3. Check migration status: `wrangler d1 migrations list agsynergy-db --env production`

### Migration fails with "Migration already applied"

Check applied migrations:
```bash
wrangler d1 migrations list agsynergy-db --env production
```

If a migration was partially applied, contact Cloudflare support or re-create the database: `wrangler d1 delete agsynergy-db && wrangler d1 create agsynergy-db` (destructive — data loss).

### CORS errors from frontend

1. Verify the origin is in the allowed list (`src/index.ts` line 55-60)
2. Check the request includes `Origin` header
3. For custom domains, verify `wrangler.jsonc` has `"pattern": "api.agsynergy.ca"` in the production env routes

### "wrangler: command not found"

```bash
npm install -g wrangler@4
# or
cd workers && pnpm add -D wrangler@4
```

## CI/CD Integration

Deployment can be automated via GitHub Actions. A sample workflow file:

```yaml
# .github/workflows/deploy.yml
name: Deploy Worker
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11.13.1
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
          cache-dependency-path: workers/pnpm-lock.yaml
      - run: cd workers && pnpm install --frozen-lockfile
      - run: cd workers && pnpm test
      - run: cd workers && pnpm run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## Monitoring

| What | Where |
|---|---|
| Worker logs | Cloudflare Dashboard → Workers → agsynergy-api → Logs |
| Error rates | Cloudflare Dashboard → Analytics |
| D1 usage | Cloudflare Dashboard → D1 → agsynergy-db → Metrics |
| Health endpoint | `curl https://agsynergy-api.kumarlogan.workers.dev/api/v1/health` |

## Emergency Contacts

| Scenario | Action |
|---|---|
| Production outage | Check Cloudflare status dashboard first |
| Worker errors | Check Worker logs in Cloudflare Dashboard |
| D1 issues | Check D1 metrics in Cloudflare Dashboard |
| Config/deploy issues | Hermes admin via Telegram |

## Related Documents

- [`ARCHITECTURE.md`](../../ARCHITECTURE.md) — System architecture
- [`API.md`](../../API.md) — API documentation
- [`DATABASE.md`](../../DATABASE.md) — Schema and migrations
- [`CHANGELOG.md`](../../CHANGELOG.md) — Deployment history
- [`CURRENT_SPRINT.md`](../../CURRENT_SPRINT.md) — Active sprint tracking