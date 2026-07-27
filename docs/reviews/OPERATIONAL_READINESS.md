# Operational Readiness Review

**Sprint:** PLS-001 — Production Launch Sprint
**Date:** 2026-07-27
**Version:** v1.0.0
**Status:** ✅ Operational

---

## Observability

| Check | Status | Detail |
|-------|--------|--------|
| Wrangler Observability | ✅ Enabled | Both default & production environments |
| Health Endpoint | ✅ Operational | `/api/v1/health` returns status, version, DB state |
| Worker Logs | ✅ Available | Via Cloudflare Dashboard → Workers & Pages → agsynergy-api → Logs |
| Frontend Logs | ✅ Available | Cloudflare Pages → agsynergy-website → Logs |

## Monitoring

| Check | Status | Detail |
|-------|--------|--------|
| Health Check URL | `https://api.agsynergy.ca/api/v1/health` | Returns: status, version, environment, DB, timestamp |
| Uptime Monitoring | ⚠️ Recommended | Consider UptimeRobot, BetterUptime, or Cloudflare Health Checks |
| Error Tracking | ⚠️ Recommended | Consider Sentry or similar for frontend error tracking |

## Rollback Procedure

### Workers
```
# Option 1: Wrangler rollback to previous version
wrangler rollback --env production

# Option 2: Re-deploy previous commit
git checkout 7a5b751
cd workers && wrangler deploy --env production
git checkout main
```

### Frontend (Pages)
```
# Rollback via Cloudflare Dashboard
# Workers & Pages → agsynergy-website → Deployments → Select previous → Deploy
```

### Database (D1)
```
# Migration rollback requires a forward migration that reverses changes
# Current version: 8/8 migrations applied
# Rollback target: Create new migration that DROPS tables added in 0006/0007
```

### Git Rollback
```bash
git revert v1.0.0  # Creates a revert commit
git push origin main
# Then re-deploy Workers + Pages
```

## Deployment Metadata

| Item | Value |
|------|-------|
| Commit | `3d1e434` |
| Tag | `v1.0.0` |
| Worker Version ID | `54db75c6-4ba6-4cd2-a825-cea6690e8036` |
| DB Migration | 8/8 |
| Deployment Time | 2026-07-27 23:13 UTC |

## Backup Status

| Item | Status | Detail |
|------|--------|--------|
| Git Repository | ✅ Versioned | GitHub: kumarlogan/concierge-website |
| Git Tag | ✅ Created | `v1.0.0` |
| D1 Database | ⚠️ Manual Export | Cloudflare Dashboard → D1 → agsynergy-db → Export |
| Frontend Build | ✅ Artifact | `artifacts/ags-fertility/dist/public/` (10 files) |

## Post-MVP Items

- [ ] Enable R2 for document storage
- [ ] Add uptime monitoring (UptimeRobot / BetterUptime / CF Health Checks)
- [ ] Add frontend error tracking (Sentry)
- [ ] Schedule automated D1 backups
- [ ] Configure Pages custom domain (in progress — Cloudflare auto-provisioning)