# Volume 08: Operations Manual

> **Version:** 1.0 | **Date:** 2026-08-03
> **Authority:** PMO — Operational runbooks for the Hermes Platform & AG Synergy
> **Status:** ⚡ RATIFIED

---

## 1. Deployment

### 1.1 Production Deployment

```
Manual Trigger: push to main
Human Gate:   Required before production deploy

Steps:
1. Push code to main branch
2. CI/CD automatically runs:
   a. TypeScript typecheck
   b. Full test suite
   c. Build frontend
   d. Deploy preview environment
3. Verify preview:
   - Health endpoint: GET https://agsynergy-api-preview.<domain>/api/v1/health
   - Manual smoke tests
4. Human approves production deploy (if auto-deploy enabled)
5. Production deploys:
   - wrangler deploy for workers
   - wrangler pages deploy for frontend
6. Verify production:
   - Health endpoint: GET https://api.agsynergy.ca/api/v1/health
   - Manual smoke tests
```

### 1.2 Manual Deployment

```bash
# Deploy frontend
cd concierge-website
pnpm run build

# Deploy Workers
cd workers
wrangler deploy

# Deploy Pages
wrangler pages deploy ../dist --project-name=concierge-website

# Verify
curl -s https://api.agsynergy.ca/api/v1/health
```

### 1.3 Preview Deployment

```bash
cd workers
wrangler deploy --env preview
```

---

## 2. Rollback

### 2.1 Worker Rollback

```bash
# View deployment versions
wrangler versions list

# Rollback to specific version
wrangler versions rollback --version-id <id>

# Quick rollback via last known good
wrangler deploy --from <last-good-commit-sha>.tar.gz
```

### 2.2 Frontend Rollback

```bash
# Pages automatically keeps deployment history
wrangler pages deployment list --project-name=concierge-website
wrangler pages rollback --project-name=concierge-website --id=<deployment-id>
```

### 2.3 D1 Rollback

D1 uses forward-only migrations. Rollback is via new migration:

```sql
-- Create a new migration that reverses the bad migration
-- Never alter or delete applied migrations
```

### 2.4 Rollback Triggers

| Condition | Action |
|-----------|--------|
| Tests fail post-deploy | Rollback immediately |
| Error rate > 1% | Rollback immediately |
| Security incident | Rollback + incident response |
| Data integrity issue | Rollback + restore from backup |
| Performance degradation > 2x | Rollback |

---

## 3. Secrets

### 3.1 Secret Inventory

| Secret | Location | Rotation | Current Status |
|--------|----------|----------|----------------|
| `CLOUDFLARE_API_TOKEN` | GitHub secret | Monthly | ⚠️ Needs rotation (53-char stale) |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub secret | Never | ✅ Set |
| `JWT_SECRET` | Worker secret | Quarterly | ✅ Set |
| `TELEGRAM_BOT_TOKEN` | Worker secret | On compromise | ✅ Set |
| `TELEGRAM_OPS_BOT_TOKEN` | Worker secret | On compromise | ✅ Set |
| `TELEGRAM_ADMIN_BOT_TOKEN` | Worker secret | On compromise | ✅ Set |
| `GITHUB_TOKEN` | GitHub secret | Quarterly | ✅ Set |
| `TURNSTILE_SITE_KEY` | Worker secret | Never | ✅ Set |
| `TURNSTILE_SECRET_KEY` | Worker secret | Never | ✅ Set |

### 3.2 Setting Secrets

```bash
# Worker secrets
echo "JWT_SECRET" | wrangler secret put JWT_SECRET

# GitHub secrets (via GitHub UI or CLI)
gh secret set CLOUDFLARE_API_TOKEN --body "your-token-here"
```

### 3.3 Secret Rotation Procedure

1. Generate new secret at source (Cloudflare, BotFather, etc.)
2. Update in GitHub secrets (for CI/CD) and Worker secrets (for runtime)
3. Verify all systems still authenticate
4. Revoke old secret after 24-hour cooldown

---

## 4. Environment Variables

### 4.1 Worker Variables (wrangler.toml)

```toml
[vars]
ENVIRONMENT = "production"
CORS_ORIGIN = "https://agsynergy.ca"
```

### 4.2 Frontend Variables (.env)

```
VITE_API_BASE=https://api.agsynergy.ca
VITE_TURNSTILE_SITE_KEY=0x4AAAAAAA...
```

---

## 5. Cloudflare Operations

### 5.1 DNS

| Record | Type | Value |
|--------|------|-------|
| agsynergy.ca | CNAME | Cloudflare Pages |
| www.agsynergy.ca | CNAME | Cloudflare Pages |
| api.agsynergy.ca | CNAME | Workers |

### 5.2 Workers Dashboard

- **Production:** agsynergy-api
- **Preview:** agsynergy-api-preview
- **Database:** agsynergy-db (D1)
- **Storage:** agsynergy-documents (R2)

### 5.3 D1 Management

```bash
# List databases
wrangler d1 list

# Execute SQL
wrangler d1 execute agsynergy-db --command "SELECT count(*) FROM leads"

# Apply migration
wrangler d1 migrations apply agsynergy-db

# Create migration
wrangler d1 migrations create agsynergy-db <migration-name>
```

---

## 6. GitHub Operations

### 6.1 Repository

| Attribute | Value |
|-----------|-------|
| URL | `github.com/kumarlogan/concierge-website` |
| Default branch | `main` |
| CI/CD | `.github/workflows/deploy.yml` |
| Secret scanning | Gitleaks via `.gitleaks.toml` |

### 6.2 CI/CD Pipeline

```yaml
# Simplified pipeline
on: push to main
steps:
  - Checkout
  - Setup Node + pnpm
  - pnpm install
  - pnpm typecheck
  - pnpm test
  - pnpm build
  - wrangler deploy (preview)
  - # Human gate
  - wrangler deploy (production)
```

---

## 7. Telegram Operations

### 7.1 Bots

| Bot | Endpoint | Purpose |
|-----|----------|---------|
| Operations Bot | `/telegram/webhook` | Lead management, dashboard, RBAC |
| Admin Bot | `/admin/webhook` | Admin console, governance, configuration |

### 7.2 Bot Commands (Operations Bot)

| Command | Action |
|---------|--------|
| `/leads` | List leads (filterable: `/leads new, /leads mine`) |
| `/lead <id>` | Lead detail |
| `/assign <id> <user>` | Assign lead |
| `/dashboard` | Show dashboard |
| `/timeline` | Show timeline |
| `/help` | Show help |

### 7.3 Bot Commands (Admin Bot)

| Command | Action |
|---------|--------|
| `/admin/approvals` | Pending approvals |
| `/admin/console` | Admin console |
| `/admin/config` | Configuration |

### 7.4 Webhook Setup

```bash
# Set Ops Bot webhook
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://api.agsynergy.ca/telegram/webhook"

# Set Admin Bot webhook
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://api.agsynergy.ca/admin/webhook"
```

---

## 8. Email Operations

| Provider | Service | Purpose |
|----------|---------|---------|
| Cloudflare Email Routing | Email delivery | Notification emails |

Email is routed through Cloudflare Workers to Cloudflare Email Routing.

---

## 9. Monitoring

### 9.1 Health Check

```bash
# Simple health check
curl -s https://api.agsynergy.ca/api/v1/health
# Response: { "status": "ok", "version": "...", "timestamp": "..." }
```

### 9.2 Monitoring Points

| What | How | Frequency |
|------|-----|-----------|
| API availability | Health endpoint | Every 5 minutes |
| Test suite | CI/CD | On every push |
| Error rate | Cloudflare dashboard | Real-time |
| D1 performance | D1 dashboard | Real-time |
| Worker CPU/Duration | Cloudflare dashboard | Real-time |

---

## 10. Incident Response

### 10.1 Incident Severity

| Severity | Definition | Response Time |
|----------|-----------|--------------|
| S0 | Production down, data loss | < 15 minutes |
| S1 | Major feature broken | < 1 hour |
| S2 | Minor feature degraded | < 4 hours |
| S3 | Cosmetic/performance | < 1 day |

### 10.2 Incident Response Procedure

1. **Detect** — Alert (monitoring or user report)
2. **Triage** — Determine severity and affected scope
3. **Contain** — If S0/S1, rollback immediately
4. **Investigate** — Review logs, audit events, recent changes
5. **Fix** — Implement fix through normal PR process
6. **Verify** — Run tests, deploy to preview
7. **Deploy** — Human-approved production deploy
8. **Post-mortem** — Document root cause and prevention

### 10.3 Communication

| Severity | Notify |
|----------|--------|
| S0 | Product Owner immediately via Telegram |
| S1 | Product Owner within 1 hour |
| S2 | Product Owner within end of day |
| S3 | Normal reporting |

---

## 11. Maintenance

### 11.1 Routine Tasks

| Task | Frequency | Action |
|------|-----------|--------|
| Token rotation | Monthly | Refresh Cloudflare API token |
| Secret audit | Quarterly | Review all secrets for expiry |
| Test suite review | Monthly | Audit test coverage, fix flakes |
| Dependency update | Quarterly | Update pnpm dependencies |
| Documentation sync | Per release | Verify docs match code |

### 11.2 Backup

| Component | Backup Method | Recovery |
|-----------|---------------|----------|
| D1 database | Periodic SQL dump | Restore via D1 console |
| Frontend | Git history + Pages history | Rollback to deployment |
| Workers | Git history + Worker versions | Rollback to version |

---

## 12. Runbooks

### 12.1 Quick Reference

| Situation | Action | Command |
|-----------|--------|---------|
| Worker not responding | Check health | `curl https://api.agsynergy.ca/api/v1/health` |
| Deploy failed | Check CI/CD logs | GitHub Actions |
| Token expired | Generate new token | Cloudflare dashboard → API Tokens |
| Test failure | Check test output | `pnpm test 2>&1` |
| D1 query slow | Check D1 dashboard | Cloudflare dashboard → D1 |
| Bot not responding | Check webhook | `curl <TG webhook info>` |

---

*End of Volume 08*