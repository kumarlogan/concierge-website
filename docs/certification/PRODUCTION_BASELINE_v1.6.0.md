# Production Baseline — AGS Fertility Concierge v1.6.0

**Date:** 2026-08-02
**Baseline Type:** Certified Operational Production Baseline
**Version:** v1.6.0
**Wave:** 6 — Communication Centre
**Status:** ✅ Established

---

## Baseline Metadata

| Field | Value |
|-------|-------|
| Product | AG Synergy — Concierge Patient Portal |
| Version | v1.6.0 |
| Release Date | 2026-08-01 |
| Wave | 6 — Communication Centre |
| Epic | EPIC-2.3 |
| Certification Date | 2026-08-02 |
| Certification Status | ✅ All 5 Gates Certified |
| Foundation Status | Frozen |
| Platform Mode | Maintenance |

---

## Certified Gates

| Gate | Certification Document | Status |
|------|----------------------|--------|
| Gate 1 — Experience | `docs/certification/UX_CERTIFICATION.md` | ✅ Certified |
| Gate 2 — Performance | `docs/certification/PERFORMANCE_CERTIFICATION.md` | ✅ Certified |
| Gate 3 — Security | `docs/certification/SECURITY_CERTIFICATION.md` | ✅ Certified |
| Gate 4 — Operations | `docs/certification/OPERATIONS_CERTIFICATION.md` | ✅ Certified |
| Gate 5 — Technical Debt | `docs/certification/TECHNICAL_DEBT_CERTIFICATION.md` | ✅ Certified |

---

## Technical Baseline

### Frontend

| Metric | Value |
|--------|-------|
| Framework | React + TypeScript |
| Build Tool | Vite |
| Build Time | 5.91s |
| Bundle Modules | 2,332 |
| Routing | wouter |
| UI Components | shadcn/ui |
| Styling | Tailwind CSS |
| Toast Library | sonner (not shadcn wrapper — known issue) |
| Auth | JWT + `AuthGuard` + `ClinicLayout` |
| API Base | `https://api.agsynergy.ca` |

### Backend (Cloudflare Workers)

| Metric | Value |
|--------|-------|
| Runtime | Cloudflare Workers (wrangler@4) |
| Language | TypeScript |
| Auth | JWT RS256, fail-closed |
| Rate Limiting | Sliding window, 60 req/min |
| Bot Protection | Cloudflare Turnstile + honeypot |
| Security Headers | 8 headers applied |
| Database | D1 (migration v9) |
| Storage | R2 (preview + production buckets) |
| Observability | Workers observability enabled |

### API Routes

| Route | Method | Auth | Status |
|-------|--------|------|--------|
| `/api/v1/health` | GET | None | ✅ Public |
| `/api/v1/notifications/*` | GET/PATCH | JWT | ✅ Guarded |
| `/api/v1/consultations` | POST | JWT + Turnstile | ✅ Guarded |
| `/api/v1/contact` | POST | JWT + Turnstile | ✅ Guarded |
| `/api/v1/messages/threads` | POST | JWT | ✅ Guarded |
| `/api/v1/documents` | POST | JWT | ✅ Guarded |
| `/api/v1/trust/evaluate` | POST | JWT | ✅ Guarded |
| `/api/v1/trust/policy-evaluation` | POST | JWT | ✅ Guarded |
| `/api/v1/trust/trust-runtime/evaluate` | POST | JWT | ✅ Guarded |
| `/api/v1/coordination` | POST | JWT | ✅ Guarded |
| `/api/v1/clinic-messages` | POST | JWT | ✅ Guarded |

### Test Results

| Suite | Result |
|-------|--------|
| TypeScript (frontend) | ✅ No errors |
| TypeScript (workers) | ✅ No errors |
| Vitest (workers) | 771/774 (3 pre-existing EPCL failures) |
| Vite build | ✅ 5.91s, 2332 modules |
| Production routes (8) | ✅ All HTTP 200 |
| Notification API routes (7) | ✅ All JWT-guarded (401) |
| Legacy compatibility | ✅ Both legacy routes preserved |
| CI integrity gates (3) | ✅ All passed |
| CI deploy jobs (6) | ✅ All passed |

---

## Security Baseline

| Control | Status |
|---------|--------|
| JWT Authentication (RS256, fail-closed) | ✅ Implemented |
| Authorization (requirePermission middleware) | ✅ Implemented |
| Input Validation (type guards + required fields) | ✅ Implemented |
| Route Protection (JWT middleware on all API routes) | ✅ Implemented |
| Security Headers (HSTS, CSP, XFO, XCTO, etc.) | ✅ Applied |
| Bot Protection (Turnstile + honeypot) | ✅ Implemented |
| Rate Limiting (60 req/min sliding window) | ✅ Implemented |
| Secrets Management (GitHub Secrets → deploy.yml) | ✅ Implemented |
| PHI Protection (no PHI in logs/headers/JWT) | ✅ Implemented |
| Error Handling (generic messages, no stack traces) | ✅ Implemented |

---

## Operational Baseline

| Area | Status |
|------|--------|
| Structured Logging | ✅ JSON events, no PHI/secrets/PII |
| Health Monitoring | ✅ `/api/v1/health` endpoint |
| Rollback Procedure | ✅ Documented in `docs/launch/ROLLBACK_VALIDATION.md` |
| Incident Response | ✅ Defined in `docs/ops/OPERATOR_GUIDE.md` §2 |
| Deployment Pipeline | ✅ GitHub Actions → wrangler deploy |
| Release Notes | ✅ CHANGELOG.md + WAVE6_RELEASE_CLOSURE.md |
| Operator Guide | ✅ `docs/ops/OPERATOR_GUIDE.md` |
| Release Certification | ✅ `docs/ops/RELEASE_CERTIFICATION.md` |
| Release Gates | ✅ `docs/ops/RELEASE_GATES.md` |
| Release Operations | ✅ `docs/ops/RELEASE_OPERATIONS.md` |

---

## Known Issues (Non-Blocking)

| # | Issue | Severity | Resolution |
|---|-------|----------|------------|
| 1 | `sonner` not a shadcn wrapper | Low | Wave 8 — wrap with shadcn component |
| 2 | `TURNSTILE_SECRET_KEY` not in deploy.yml secrets | Medium | Wave 7 — add to GitHub Actions secrets |
| 3 | `body as any` casts in route handlers | Low | Wave 8 — replace with type guards |
| 4 | `WORKAROUND` value in TrustLevel enum | Low | Wave 8 — remove if confirmed unused |
| 5 | WEF delegator TODO placeholder | Low | Future — when WEF integration available |
| 6 | D1 migration rollback is manual | Low | Wave 8 — automate rollback |
| 7 | No canary deployment strategy | Low | Wave 8 — add canary deploy |
| 8 | 3 pre-existing EPCL test failures | Info | Not introduced in this sprint |

---

## Baseline Integrity

| Check | Result |
|-------|--------|
| All 5 certification gates passed | ✅ |
| No critical or high findings | ✅ |
| TypeScript compilation clean | ✅ |
| Workers tests passing (771/774) | ✅ |
| Frontend build successful | ✅ |
| All production routes HTTP 200 | ✅ |
| All API routes JWT-guarded | ✅ |
| Security headers applied | ✅ |
| Secrets not committed to repo | ✅ |
| CHANGELOG updated | ✅ |
| Release closure documented | ✅ |
| Wave 7 readiness assessed | ✅ |

---

*Production Baseline v1.6.0 established 2026-08-02. Valid until next version release or Foundation modification.*
