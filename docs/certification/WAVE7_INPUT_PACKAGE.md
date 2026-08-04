# Wave 7 Input Package — AGS Fertility Concierge v1.6.0

**Date:** 2026-08-02
**Purpose:** Input for Wave 7 planning and execution
**Version:** v1.6.0 (certified baseline)
**Status:** ✅ Ready for Wave 7 planning

---

## 1. Wave 7 Context

### Preceding Release

| Field | Value |
|-------|-------|
| Release | AGS Fertility v1.6.0 |
| Wave | 6 — Communication Centre |
| Date | 2026-08-01 |
| Status | ✅ Released to Production |
| Certification | ✅ All 5 Gates Certified |

### Wave 7 Scope

Wave 7 is the next development wave following the Communication Centre (Wave 6). The scope needs definition by the Product Owner.

---

## 2. Certified Baseline State

### What Is Certified

- ✅ All 5 operational hardening certification gates passed
- ✅ Production baseline v1.6.0 established
- ✅ Security posture strong (0 critical, 0 high findings)
- ✅ Performance baseline measured
- ✅ Operational procedures documented
- ✅ Technical debt catalogued and prioritized

### What Is NOT Yet Done (Carried Forward)

| Item | Priority | Phase | Gate |
|------|----------|-------|------|
| Add `TURNSTILE_SECRET_KEY` to deploy.yml secrets | Medium | Wave 7 | Security, Operations |
| Create `docs/playbooks/` directory | Low | Wave 7 | Operations |
| Replace `body as any` casts with type guards | Low | Wave 8 | Security, Technical Debt |
| Add explicit CORS configuration | Low | Wave 8 | Security |
| Add request body size limits | Low | Wave 8 | Security |
| Add Cloudflare Analytics dashboard | Low | Wave 8 | Operations |
| Automate D1 migration rollback | Low | Wave 8 | Operations |
| Add canary deployment strategy | Low | Wave 8 | Operations |
| Remove `WORKAROUND` from TrustLevel enum | Low | Wave 8 | Technical Debt |
| Resolve WEF delegator TODO | Low | Future | Technical Debt |
| Wrap `sonner` with shadcn component | Low | Wave 8 | Experience |
| Add `DOCUMENT_SERVICE` type bindings | Low | Wave 8 | Security |

---

## 3. Deferred Items from Wave 6

These items were identified during Wave 6 and deferred to future waves:

| # | Item | Description | Status |
|---|------|-------------|--------|
| D1 | Notification persistence | In-memory → D1 migration | Path designed, not implemented |
| D2 | Delivery channels | Push/SMS/Email delivery infra | Channel model exists, infra pending |
| D3 | WebSocket real-time updates | 30s polling → SignalR/WS | Pending |
| D4 | `TURNSTILE_SECRET_KEY` in secrets | Not yet in deploy.yml | Medium priority |
| D5 | `sonner` shadcn wrapper | Toast component not wrapped | Low priority |

---

## 4. Platform Constraints

| Constraint | Status |
|------------|--------|
| Hermes Platform in Maintenance Mode | ✅ Active |
| Foundation frozen | ✅ Active |
| No new platform capabilities | ✅ Enforced |
| wrangler@4 | ✅ Current |
| D1 migration v9 | ✅ Current |
| R2 buckets | ✅ Connected |
| JWT keys via GitHub Secrets | ✅ Managed |
| `VITE_API_BASE=https://api.agsynergy.ca` | ✅ Set |

---

## 5. Available Skills & Resources

| Skill | Status |
|-------|--------|
| `feature-milestone-execution` | ✅ Available |
| `post-wave-reporting` | ✅ Available |
| `communication-centre-wave` | ✅ Available (Wave 6) |
| `deploy-website` | ✅ Available |
| `github-pr-workflow` | ✅ Available |
| `platform-baseline-freeze` | ✅ Available |
| `platform-capability-design` | ✅ Available (not used — Foundation frozen) |

---

## 6. Risk Register (Carried Forward)

| Risk | Severity | Mitigation | Wave |
|------|----------|-----------|------|
| TURNSTILE_SECRET_KEY not in secrets | Medium | Add to deploy.yml | Wave 7 |
| `body as any` type casts | Low | Replace with type guards | Wave 8 |
| No canary deployment | Low | Add canary strategy | Wave 8 |
| D1 manual rollback | Low | Automate rollback | Wave 8 |
| sonner not shadcn wrapper | Low | Wrap with shadcn component | Wave 8 |
| 3 pre-existing EPCL failures | Info | Not introduced in this sprint | N/A |

---

## 7. Recommended Wave 7 Priorities

Based on the certification findings, the following items are recommended for Wave 7:

### High Priority

1. **Add `TURNSTILE_SECRET_KEY` to deploy.yml secrets** — Single medium-severity finding across 3 gates
2. **Create `docs/playbooks/` directory** — Organize operational documentation
3. **Define Wave 7 scope** — PO approval needed

### Medium Priority

4. **Replace `body as any` casts with type guards** — Type safety improvement
5. **Add explicit CORS configuration** — API hardening
6. **Add request body size limits** — API hardening

### Low Priority

7. **Add Cloudflare Analytics dashboard** — Observability
8. **Automate D1 migration rollback** — Operations
9. **Add canary deployment strategy** — Deployment safety

---

## 8. Acceptance Criteria for Wave 7

Wave 7 should produce:

- [ ] All Wave 7 items implemented and tested
- [ ] TypeScript compilation clean (frontend + workers)
- [ ] Workers tests passing (maintain 99%+ pass rate)
- [ ] Frontend build successful
- [ ] All production routes HTTP 200
- [ ] All API routes JWT-guarded
- [ ] Security headers still applied
- [ ] No new critical or high findings
- [ ] Updated CHANGELOG.md
- [ ] Updated WAVE7_RELEASE_CLOSURE.md
- [ ] New certification gate results (if applicable)

---

## 9. Evidence Links

| Document | Location |
|----------|----------|
| Executive Scorecard | `docs/certification/EXECUTIVE_SCORECARD.md` |
| Production Baseline | `docs/certification/PRODUCTION_BASELINE_v1.6.0.md` |
| Hardening Certification | `docs/certification/OPERATIONAL_HARDENING_CERTIFICATION.md` |
| UX Certification | `docs/certification/UX_CERTIFICATION.md` |
| Performance Certification | `docs/certification/PERFORMANCE_CERTIFICATION.md` |
| Security Certification | `docs/certification/SECURITY_CERTIFICATION.md` |
| Security Scorecard | `docs/certification/SECURITY_SCORECARD.md` |
| Operations Certification | `docs/certification/OPERATIONS_CERTIFICATION.md` |
| Technical Debt Certification | `docs/certification/TECHNICAL_DEBT_CERTIFICATION.md` |
| Wave 6 Release Closure | `docs/releases/concierge/patient-portal/phase-2/wave-6/WAVE6_RELEASE_CLOSURE.md` |
| Wave 7 Readiness | `docs/releases/concierge/patient-portal/phase-2/wave-6/WAVE7_READINESS.md` |
| Operator Guide | `docs/ops/OPERATOR_GUIDE.md` |
| Rollback Validation | `docs/launch/ROLLBACK_VALIDATION.md` |
| CHANGELOG | `CHANGELOG.md` |

---

*Wave 7 Input Package valid for AGS Fertility v1.6.0. Ready for PO review and Wave 7 planning.*
