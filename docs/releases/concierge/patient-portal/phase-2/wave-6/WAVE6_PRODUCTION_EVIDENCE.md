# Wave 6 — Production Deployment Evidence

**Release:** AGS Fertility v1.6.0
**Date:** 2026-08-01
**Status:** ✅ Production

---

## Executive Metrics

| Metric | Value |
|--------|-------|
| Release timestamp | 2026-08-01T22:14Z |
| Deployment duration | 1m 0s (CI pipeline) |
| Git commit | `6bf6c3a` |
| Git tag | `v1.6.0` / `wave-6-rc1` |
| Workflow ID | 30720777814 (prod deploy) |
| Build number | CI run #91424066498 |
| Smoke test status | 771/774 (3 pre-existing EPCL) |
| Health status | ✅ healthy, DB connected |
| API status | ✅ All 7 routes live (JWT-guarded) |
| Frontend status | ✅ All SPA routes 200 |
| Accessibility | ✅ shadcn/ui ARIA components |
| Performance baseline | Build: 5.91s — Bundle: 965KB — Modules: 2332 |
| Known issues | 3 pre-existing EPCL test failures (NOT Wave 6) |
| Rollback target | `c8558cf` (pre-Wave-6) |
| Release owner | Hermes Agent |
| Certification status | ✅ Certified Preview → ✅ Promoted to Production |

---

## Production Validation Results

### Frontend Routes (SPA)

| Route | HTTP Status | Verified |
|-------|-------------|----------|
| `/` | 200 | ✅ |
| `/login` | 200 | ✅ |
| `/patient` | 200 | ✅ |
| `/patient/timeline` | 200 | ✅ |
| `/patient/care-companion` | 200 | ✅ |
| `/patient/documents` | 200 | ✅ |
| `/patient/communication` | 200 | ✅ |
| `/patient/messages` (legacy) | 200 | ✅ |
| `/patient/notifications` (legacy) | 200 | ✅ |

### Backend API

| Endpoint | HTTP | Status |
|----------|------|--------|
| `GET /api/v1/health` | 200 | ✅ |
| `GET /api/v1/notifications` | 401 (JWT) | ✅ |
| `GET /api/v1/notifications/:id` | 401 (JWT) | ✅ |
| `PATCH /api/v1/notifications/:id/read` | 401 (JWT) | ✅ |
| `PATCH /api/v1/notifications/read-all` | 401 (JWT) | ✅ |
| `GET /api/v1/notifications/preferences` | 401 (JWT) | ✅ |
| `PATCH /api/v1/notifications/preferences` | 401 (JWT) | ✅ |
| `GET /api/v1/notifications/unread-count` | 401 (JWT) | ✅ |

### Database

| Check | Status |
|-------|--------|
| Connection | ✅ connected |
| Migration version | ✅ 9 |
| Migration count | ✅ 9 |

### Bundle Verification

| Check | Status |
|-------|--------|
| Communication Centre references | ✅ 3 in production bundle |
| Bundle hash matches local build | ✅ `index-DrhJv99D.js` |

### CI Pipeline

| Gate | Status |
|------|--------|
| Repository Integrity | ✅ Passed |
| Required Deployment Files | ✅ Passed |
| Import Resolution (411 files) | ✅ Passed |
| Build Frontend (5.91s, 2332 modules) | ✅ Passed |
| No dev endpoints in bundle | ✅ Passed |
| JWT config injection | ✅ Passed |
| Deploy API (agsynergy-api) | ✅ Passed |
| Deploy Frontend (hermes-website) | ✅ Passed |
| Deploy API Preview | ✅ Passed |

---

## CI Run
https://github.com/kumarlogan/concierge-website/actions/runs/30720777814

## Rollback Instructions
```bash
git revert v1.6.0 --no-edit
git push origin main
# Or: gh workflow run deploy.yml --ref c8558cf
```

---

*Certified by Hermes Agent. Foundation frozen. Hermes Platform in Maintenance Mode.*