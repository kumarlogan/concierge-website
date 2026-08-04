# Deployment Plan — Concierge Production Readiness

**Project:** Concierge Production Readiness — Workforce Activation  
**Date:** 2026-08-04  
**Version:** 1.0  
**Repository:** kumarlogan/concierge-website

---

## 1. Merge Order (Dependency Resolution)

PRs must be merged in the following dependency order:

| Order | PR | Title | Rationale |
|-------|----|-------|-----------|
| 1 | #3 | Clinic identity guard | Foundation security fix — no dependencies on other PRs |
| 2 | #4 | IDOR fix + CI quality gate | Depends on PR #3's ClinicGuard pattern; adds authz middleware used by all other PRs |
| 3 | #5 | MFA + trust runtime fixes | Depends on PR #4's authz middleware (assertOwnership, assertParticipant) |
| 4 | #6 | Document upload + workflow persistence | Depends on PR #5's AUTHORIZATION_ENGINE wiring; adds workflow D1 persistence |
| 5 | #7 | D1 persistence (consent, timeline, clinic) | Depends on all prior PRs; final persistence layer |

### Merge Sequence

```
1. Merge PR #3 → ClinicGuard
2. Merge PR #4 → authz middleware + CI gate
3. Merge PR #5 → MFA + trust runtime
4. Merge PR #6 → Document upload + workflow persistence
5. Merge PR #7 → D1 engines + migrations 0012/0013
```

---

## 2. Migration Order

Migrations are applied in version order. PR #7 adds migrations 0012 and 0013.

| Version | File | Operation | Destructive? |
|---------|------|-----------|-------------|
| 0012 | `0012_consent_schema_reconciliation.sql` | ALTER TABLE consents ADD COLUMN updated_at; CREATE TABLE consent_registry | ❌ No |
| 0013 | `0013_timeline.sql` | CREATE TABLE patient_stages, patient_milestones, patient_timeline_events | ❌ No |

### Migration Safety Checks

- ✅ All migrations are forward-only (ALTER TABLE ADD COLUMN, CREATE TABLE IF NOT EXISTS)
- ✅ No DROP TABLE, DROP COLUMN, or RENAME operations
- ✅ No data deletion operations
- ✅ Backfill of `updated_at` from `created_at` is safe
- ✅ All new tables have appropriate indexes
- ✅ UNIQUE constraints prevent duplicates (consent_registry, patient_stages)
- ⚠️ **Verify** `audit_logs` table exists (referenced by PR #5 and PR #7 audit helpers)
- ⚠️ **Verify** `workflow_instances` table exists (referenced by PR #6 workflow engine)

---

## 3. Worker Deployment Order

Workers are deployed in dependency order. The Concierge project uses a single worker (`hermes-website`) with multiple internal services.

| Step | Component | Action | Notes |
|------|-----------|--------|-------|
| 1 | `hermes-website` worker | Deploy to staging | Validate build passes |
| 2 | `hermes-website` worker | Run smoke tests against staging | Verify all routes respond |
| 3 | `hermes-website` worker | Deploy to production | Use `wrangler deploy --env production` |
| 4 | D1 database (`agsynergy-db`) | Apply migrations 0012, 0013 | Run via `wrangler d1 execute` |
| 5 | `hermes-website` worker | Post-deploy health check | Verify D1 connectivity |

### Deployment Commands

```bash
# Deploy to staging first
cd /home/ubuntu/concierge-website/workers
wrangler deploy --env staging

# Run smoke tests (see Section 6)

# Deploy to production
wrangler deploy --env production

# Apply migrations
wrangler d1 execute agsynergy-db --command "SELECT 1;" --env production
wrangler d1 execute agsynergy-db --command "$(cat migrations/0012_consent_schema_reconciliation.sql)" --env production
wrangler d1 execute agsynergy-db --command "$(cat migrations/0013_timeline.sql)" --env production
```

---

## 4. Rollback Plan

### Rollback Triggers

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Error rate increase | >5% above baseline for 5 min | Rollback worker |
| D1 query failures | Any migration failure | Rollback migration |
| Smoke test failure | Any critical test fails | Rollback worker |
| Data inconsistency | Any data loss detected | Rollback migration + restore from backup |

### Rollback Steps

1. **Worker rollback:** `wrangler deploy --env production --rollback` (or redeploy previous commit)
2. **Migration rollback:** Migrations 0012 and 0013 are forward-only. To rollback:
   - 0013: Drop tables in reverse order (patient_timeline_events → patient_milestones → patient_stages)
   - 0012: DROP TABLE consent_registry; ALTER TABLE consents DROP COLUMN updated_at
3. **Database backup:** Ensure D1 automated backups are enabled before migration
4. **DNS/Traffic:** If worker rollback is insufficient, revert Cloudflare Workers route to previous deployment

### Rollback Commands

```bash
# Rollback worker to previous deployment
wrangler deploy --env production --rollback

# Rollback migration 0013 (drop new tables)
wrangler d1 execute agsynergy-db --command "DROP TABLE IF EXISTS patient_timeline_events; DROP TABLE IF EXISTS patient_milestones; DROP TABLE IF EXISTS patient_stages;" --env production

# Rollback migration 0012
wrangler d1 execute agsynergy-db --command "DROP TABLE IF EXISTS consent_registry; ALTER TABLE consents DROP COLUMN updated_at;" --env production
```

---

## 5. Compatibility Analysis

### Breaking Changes

| PR | Change | Impact | Mitigation |
|----|--------|--------|-----------|
| #4 | `withJwtAuth` → `protectedRoute`/`staffRoute` | Route handler signature change | All handlers updated consistently |
| #5 | MFA now required for enrolled patients | Patients without MFA cannot access dashboard | MFA page added to router; auto-redirect for non-MFA users |
| #5 | Email verification no longer auto-completes | New users must click email link | Registration flow updated with clear messaging |
| #7 | D1 engines replace in-memory singletons | Consent evaluation now async (must `await`) | Known limitation documented in index.ts |

### Backward Compatibility

- ✅ API routes maintain same request/response shapes
- ✅ D1 engines implement same interfaces as predecessors
- ✅ Migration 0012 adds column with default (nullable)
- ✅ Migration 0013 creates new tables only
- ⚠️ `decisionEngine` still uses in-memory consentEngine (known limitation, tracked separately)

### Dependency Graph

```
PR #3 (ClinicGuard)
  └── PR #4 (authz middleware)
        └── PR #5 (MFA + trust runtime)
              └── PR #6 (document upload + workflow)
                    └── PR #7 (D1 persistence)
```

---

## 6. Smoke Test Checklist

### Pre-Deployment (Staging)

- [ ] Workers build passes
- [ ] gitleaks scan passes
- [ ] Typecheck (ratchet) passes
- [ ] All worker tests pass (614 tests)
- [ ] Frontend build passes
- [ ] `ClinicGuard` renders correctly for clinic identity types
- [ ] `ClinicGuard` blocks patients from clinic routes
- [ ] `assertOwnership` denies cross-identity access
- [ ] `assertParticipant` denies non-participants from threads
- [ ] MFA page renders and redirects correctly
- [ ] Email verification page accessible without auth
- [ ] Document upload flow works end-to-end
- [ ] Workflow state persists to D1
- [ ] Consent engine CRUD operations work via D1
- [ ] Timeline engine stages advance correctly
- [ ] Clinic messages show real patient data (not mocks)
- [ ] Clinic patient list shows real data with pagination

### Post-Deployment (Production)

- [ ] Worker responds to health check
- [ ] D1 database connection verified
- [ ] Migrations 0012 and 0013 applied successfully
- [ ] `consents` table has `updated_at` column
- [ ] `consent_registry` table exists with indexes
- [ ] `patient_stages`, `patient_milestones`, `patient_timeline_events` tables exist
- [ ] Consent grant/withdraw/snapshot/evaluate work via D1
- [ ] Timeline stages advance and persist
- [ ] Clinic routes show real data
- [ ] Error rate within baseline
- [ ] No new gitleaks findings

---

## 7. Post-Deployment Verification Checklist

### Database Verification

- [ ] Migration 0012 applied: `SELECT updated_at FROM consents LIMIT 1` returns rows
- [ ] Migration 0013 applied: `SELECT COUNT(*) FROM patient_stages` returns 0 (no data yet)
- [ ] `consent_registry` table queryable
- [ ] No orphaned tables from failed migrations

### API Verification

- [ ] `GET /api/v1/clinic/messages/triage` returns real patient data (not mocks)
- [ ] `GET /api/v1/clinic/patients` returns paginated real data
- [ ] `GET /api/v1/trust/consents/history` enforces patient ownership
- [ ] `POST /api/v1/trust/consents/grant` persists to D1
- [ ] `GET /api/v1/timeline/stages` returns persisted stages
- [ ] `POST /api/v1/timeline/advance` persists stage change

### Security Verification

- [ ] Clinic routes blocked for patient identity type
- [ ] Notification endpoints enforce ownership
- [ ] Thread messages enforce participant check
- [ ] Consent history enforces patient ownership
- [ ] Permissions listing enforces patient scope

---

## 8. Success Criteria

1. **All 5 PRs merged** in dependency order without conflicts
2. **All migrations applied** successfully (0012, 0013)
3. **Worker deployed** to production with zero downtime
4. **All smoke tests pass** (pre-deployment and post-deployment)
5. **No data loss** — all existing data preserved through migrations
6. **No breaking changes** to API contract
7. **CI pipeline green** — all checks pass on main branch
8. **Error rate** within baseline (±2% of pre-deployment)
9. **D1 connectivity** verified — consent and timeline engines operational
10. **Rollback plan** tested and documented

---

## 9. Rollback Triggers (Summary)

| Condition | Threshold | Response Time |
|-----------|-----------|---------------|
| Error rate spike | >5% above baseline | Immediate |
| Migration failure | Any SQL error | Immediate |
| Smoke test failure | Any critical test | Within 15 min |
| Data inconsistency | Any detected loss | Immediate |
| D1 connection failure | Cannot connect to DB | Within 5 min |
| gitleaks secrets leak | Any new finding | Immediate |
