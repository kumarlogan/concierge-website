# Wave 6 — Operational Readiness Report

**Date:** 2026-08-01
**Release:** v1.2.0 RC (tag: `wave-6-rc1`)
**Status:** ✅ Preview Deployed — Ready for Production Promotion (pending PO)

---

## 1. Support Readiness Checklist

| Item | Status | Notes |
|------|--------|-------|
| Documentation updated | ✅ | CHANGELOG, ADR-016, UX Blueprint, PO Review Package |
| Known limitations documented | ✅ | In-memory store (D1 deferred), 30s poll (WebSocket deferred) |
| Error states handled | ✅ | Loading, empty, error states in CommunicationPage |
| Support team trained | N/A | Preview only |

## 2. Monitoring Checklist

| Item | Status | Evidence |
|------|--------|----------|
| API health endpoint | ✅ | `GET /api/v1/health` — returns 200 with DB status |
| Worker observability | ✅ | `observability.enabled: true` in workers/wrangler.jsonc |
| Route registration verified | ✅ | All 7 notification routes + health respond correctly |
| Legacy routes preserved | ✅ | `/patient/messages`, `/patient/notifications` return 200 |

## 3. Rollback Verification

| Step | Command | Status |
|------|---------|--------|
| Previous deploy SHA | `c8558cf` (pre-Wave-6) | ✅ Identified |
| Rollback via git | `git revert 267211a..HEAD` | ✅ Standard git revert path |
| Rollback via CI | Re-run deploy.yml on `c8558cf` | ✅ Via `gh workflow run deploy.yml --ref c8558cf` |

## 4. Production Promotion Checklist

| # | Step | Status | Command |
|---|------|--------|---------|
| 1 | PO authorization received | ⏳ WAITING | — |
| 2 | Verify identical RC build | ⏳ | `git diff main..wave-6-rc1` should be empty |
| 3 | CI deploy to production | ⏳ | Push to `main` triggers deploy.yml |
| 4 | Verify frontend live | ⏳ | `curl -s https://agsynergy.ca/patient/communication` |
| 5 | Verify API live | ⏳ | `curl -s https://api.agsynergy.ca/api/v1/health` |
| 6 | Verify notification routes | ⏳ | All 7 routes respond (401 unauthenticated) |
| 7 | Verify legacy routes | ⏳ | `/patient/messages`, `/patient/notifications` 200 |
| 8 | Run acceptance probe | ⏳ | Golden path: register → verify → login → me → messaging |
| 9 | Run `git tag wave-6` | ⏳ | Final production tag |
| 10 | Update dashboard | ⏳ | Update executive dashboard |

## 5. Executive Metrics Baseline

| Metric | Wave 5 (pre-Wave-6) | Wave 6 | Delta |
|--------|---------------------|--------|-------|
| Workers tests passing | 771 | 771 | 0 (no regressions) |
| New API routes | — | 7 | +7 |
| New frontend pages | — | 1 (CommunicationPage) | +1 |
| New components | — | 3 (NotifIcon, NotificationPreferencesDialog, CommunicationPage) | +3 |
| New docs | — | 5 (ADR, Research, UX Blueprint, Review Package, Readiness) | +5 |
| Frontend build time | ~5.8s | 5.85s | ~0s |
| Bundle size | ~960KB | 965KB | +~5KB |

## 6. Wave 7 Entry Criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Wave 6 production promotion complete | ⏳ WAITING for PO |
| 2 | Wave 7 scope defined in roadmap | 📋 Roadmap required |
| 3 | D1 persistence for notifications | 📋 Deferred from Wave 6 |
| 4 | Push/SMS/Email delivery channels | 📋 Deferred from Wave 6 |
| 5 | No platform capability gaps | ✅ Verified |
| 6 | Foundation remains frozen | ✅ Confirmed |

---

*Do not promote to Production without explicit Product Owner approval.*