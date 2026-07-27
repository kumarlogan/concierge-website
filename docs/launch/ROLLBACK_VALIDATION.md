# Rollback Validation

> **Concierge Launch Readiness — Workstream C**
> Documents the rollback plan, triggers, execution steps, data safety measures, communications plan, and post-rollback validation.
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
Capability:     Release Management Platform — Rollback Strategy
Framework:      WEF v1.0 (Workforce Execution Framework)
---

## 1. Rollback Triggers

### 1.1 Automated Detection Triggers

| # | Trigger | Detection Method | Threshold | Severity |
|---|---------|-----------------|-----------|----------|
| 1 | Health endpoint down | HTTP request timeout >5s | Any failure | P0 |
| 2 | Health endpoint returns 503 | DB connectivity lost | Any | P0 |
| 3 | Smoke test failure | Runtime assertion | Any failure | P0 |
| 4 | Error rate spike | Workers observability | >5% increase over 5min | P1 |
| 5 | API latency degradation | Workers observability | P95 >1s for 15min | P2 |

### 1.2 Manual Rollback Triggers

| # | Trigger | Source | Description |
|---|---------|--------|-------------|
| 1 | Broken auth flow | User reports / Operator observation | Users cannot log in or authenticate |
| 2 | Data corruption | Monitoring / Report | Incorrect data being written or returned |
| 3 | Security incident | Security scan / Report | Vulnerability introduced in deployment |
| 4 | Critical API broken | User reports / Monitoring | Core API functionality unavailable |
| 5 | Performance regression | Monitoring | Significant latency increase affecting UX |
| 6 | Unexpected behavior | User reports | Feature not working as expected |

### 1.3 Rollback Decision Matrix

| Scenario | Action | Priority | Rollback? |
|----------|--------|----------|-----------|
| Health endpoint down | Rollback | P0 | ✅ Yes |
| Critical API broken (ops, consultations, identity) | Rollback | P0 | ✅ Yes |
| Auth flow broken | Rollback | P0 | ✅ Yes |
| Data corruption on write | Rollback | P0 | ✅ Yes |
| Security vulnerability | Rollback | P0 | ✅ Yes |
| Non-critical page/feature broken | Fix forward | P2 | ❌ No |
| Cosmetic issue | Fix forward | P3 | ❌ No |
| Performance regression | Investigate first | P1 | ⚠️ Only if severe |
| Error rate spike (transient) | Monitor | P1 | ⚠️ Only if persistent |

---

## 2. Steps for Rollback

### 2.1 Pre-deployment Checkpoint (Created Before Every Deploy)

Every production deployment must create a rollback checkpoint first:

```typescript
interface RollbackCheckpoint {
  checkpoint_id: string;
  deployment_id: string;
  captured_at: string;
  current_version: string;
  current_git_commit: string;
  current_worker_deployment: string;
  current_pages_deployment: string;
  current_d1_migrations: number;
  d1_backup: boolean;
  product: "concierge";
  environment: "production";
  captured_by: string;
  reason: "Pre-deployment checkpoint";
}
```

### 2.2 Rollback Execution Steps

```
STEP 1: DETECT
  └─ Operator identifies issue (alert, report, monitoring)
  └─ Operator confirms rollback is needed

STEP 2: INITIATE
  └─ Operator opens rollback gate
  └─ Operator provides:
      - Rollback reason (required)
      - Target version (default: previous stable)
      - Verification plan
  └─ PSER records: rollback.requested

STEP 3: APPROVE
  └─ Rollback gate evaluates criteria:
      - Target version exists?
      - Checkpoint available?
      - No conflicting operations?
  └─ Operator confirms rollback

STEP 4: EXECUTE (Workers)
  └─ wrangler deploy --env production --version <previous-commit>
  └─ OR: redeploy previous wrangler.jsonc configuration
  └─ PSER records: rollback.started

STEP 5: EXECUTE (Pages)
  └─ Deploy previous Pages branch/commit
  └─ Or restore previous deployment via Cloudflare dashboard

STEP 6: EXECUTE (D1 — if applicable)
  └─ ⚠️ D1 migration rollback is manual
  └─ Analyze schema changes in the rolled-back deployment
  └─ Apply reversed migration if data integrity requires it
  └─ Note: D1 does not support automatic rollback

STEP 7: VERIFY
  └─ Health check: curl https://api.agsynergy.ca/api/v1/health → 200
  └─ Smoke tests: Run smoke test suite → all passing
  └─ Version check: response version matches target version
  └─ Auth check: Identity endpoints reachable

STEP 8: RECORD
  └─ PSER: deployment.rollback.completed
  └─ Resume point: "Root cause analysis needed"
  └─ Original deployment version archived for investigation
```

### 2.3 Detailed Commands

```bash
# 1. Record rollback attempt
# (via API or manual entry)

# 2. Roll back Workers to previous version
cd workers
npx wrangler deploy --tsconfig tsconfig.json --env production \
  # Use previous version commit

# 3. Verify workers rollback
curl https://api.agsynergy.ca/api/v1/health

# 4. If Pages needs rollback
cd artifacts/ags-fertility
npx wrangler pages deploy --branch production \
  --commit-hash <previous-commit>

# 5. Run smoke tests
SMOKE_TEST_URL="https://api.agsynergy.ca" \
  SMOKE_TEST_ENV="production" \
  npx vitest run workers/tests/launch/smoke-tests.test.ts

# 6. Record completion
# PSER: deployment.rollback.completed
```

---

## 3. Data Safety During Rollback

### 3.1 Data Categories

| Data Store | Data Type | Rollback Safety | Notes |
|------------|-----------|----------------|-------|
| D1 (`agsynergy-db`) | Patient leads, user accounts, appointments, messages | ⚠️ **Partial** | D1 schema changes may not be safely reversible. Data written during the deployment is preserved (not rolled back). |
| R2 (`agsynergy-documents`) | Patient documents | ✅ **Safe** | R2 is content-addressable; documents are not deleted on rollback. |
| KV | Session data, cache | ✅ **Safe** | KV is ephemeral; sessions will be re-established. |
| Workers runtime | In-memory state | ✅ **Safe** | In-memory state (release registry, credential registry) is reset on redeploy. |

### 3.2 D1 Rollback Guidelines

| Scenario | Action | Safety |
|----------|--------|--------|
| Schema migration added (CREATE TABLE) | ✅ Safe — new table persists, old code ignores it | Low risk |
| Schema migration changed (ALTER TABLE) | ⚠️ Reversible only if down-migration exists | Medium risk |
| Data-only change (new records) | ✅ Safe — records persist, no rollback needed | Low risk |
| Destructive migration (DROP TABLE) | ❌ Irreversible — requires restore from backup | High risk |

**D1 Rollback Rules:**
- Always write down-migrations for schema changes
- D1 backups should be taken before production deployments
- Data written during deployment lifespan is NOT rolled back
- Rollback restores **code**, not **data**

### 3.3 Rollback Safety Checklist

| # | Check | Action |
|---|-------|--------|
| 1 | Is a rollback checkpoint available? | Verify before initiating |
| 2 | Does the deployment include D1 schema changes? | If yes, prepare migration rollback |
| 3 | Is there data written after deployment? | Assess impact — data is NOT rolled back |
| 4 | Are dependent services affected? | Notify Operations Bot |
| 5 | Is the previous version deployable? | Verify previous commit builds |

---

## 4. Communications Plan During Rollback

### 4.1 Notification Channels

| Audience | Channel | Timing | Message |
|----------|---------|--------|---------|
| Engineering team | Telegram (Operations Bot) | Immediate | Rollback initiated with reason |
| On-call operator | Telegram + Email | Immediate | Rollback requires approval |
| Team (post-recovery) | Email + CHANGELOG | After completion | Rollback completed, RCA initiated |

### 4.2 Communication Templates

#### Rollback Initiated

```
🚨 ROLLBACK INITIATED

Product:    Concierge
Version:    <current-version> → <target-version>
Reason:     <brief reason>
Trigger:    <automated/manual>
Initiated:  <operator>
Timestamp:  <ISO 8601>

Status:     Rollback in progress
ETA:        <5 minutes>

Channel:    #engineering-alerts
```

#### Rollback Completed

```
✅ ROLLBACK COMPLETED

Product:    Concierge
From:       <failed-version>
To:         <previous-version>
Duration:   <elapsed-time>
Status:     ✅ Success / ❌ Failed
Health:     ✅ Healthy
Smoke Tests: ✅ All passing (<n>/<n>)

Next steps:
1. Root cause analysis
2. Fix identified issue
3. Re-deploy through promotion gate

Channel:    #engineering-alerts
```

### 4.3 Escalation Path

| Level | Role | Contact Method | Response Time |
|-------|------|----------------|---------------|
| L1 | On-call operator | Telegram | 15 min |
| L2 | Engineering Lead | Phone | 30 min |
| L3 | Product Manager | Email | 1 hour |

---

## 5. Post-Rollback Validation

### 5.1 Immediate Verification (First 5 Minutes)

| # | Check | Method | Success Criteria |
|---|-------|--------|-----------------|
| 1 | Health endpoint | `curl <url>/api/v1/health` | 200 + `healthy` + correct version |
| 2 | Smoke tests | `npx vitest run workers/tests/launch/smoke-tests.test.ts` | All passing |
| 3 | Authentication | Test login flow | Auth endpoints reachable |
| 4 | CORS | Test allowed origins | CORS headers correct |
| 5 | Error rate | Workers dashboard | <0.1% error rate |

### 5.2 Extended Monitoring (First 15 Minutes)

| # | Metric | Target | Alert If |
|---|--------|--------|----------|
| 1 | P95 latency | <300ms | >1s |
| 2 | Error rate | <0.1% | >1% |
| 3 | D1 query failures | 0/min | >5/min |
| 4 | R2 operation failures | 0/min | >3/min |
| 5 | Rate limit hits | Normal pattern | Spike >200% |

### 5.3 Post-Recovery Tasks

| # | Task | Owner | Timeline |
|---|------|-------|----------|
| 1 | Root cause analysis | Engineering Lead | Within 24 hours |
| 2 | Fix documented in CHANGELOG | Developer | With fix PR |
| 3 | PSER rollback record finalized | System | Immediate |
| 4 | Rollback checkpoint cleared | System | After next successful deploy |
| 5 | Resume point set: "RCA needed" | System | Immediate |

---

## 6. Rollback Test Plan

| # | Test Scenario | Expected Result | Frequency |
|---|--------------|----------------|-----------|
| 1 | Deploy Workers, then rollback to previous version | Previous version serves traffic | Every major release |
| 2 | Deploy Pages, then restore previous deployment | Previous content served | Every major release |
| 3 | Run smoke tests after rollback | All tests passing | Every rollback |
| 4 | Verify health endpoint after rollback | Version matches rolled-back version | Every rollback |
| 5 | Verify D1 data integrity after rollback | No data loss | After D1 schema change rollback |

---

## 7. Summary

| Area | Status | Key Action Items |
|------|--------|------------------|
| Rollback Triggers | ✅ Documented | 5 automated + 5 manual triggers defined |
| Rollback Execution Steps | ✅ Documented | 8-step process with detailed commands |
| Data Safety | ✅ Assessed | D1 rollback risks documented |
| Communications Plan | ✅ Documented | Templates, channels, escalation |
| Post-Rollback Validation | ✅ Documented | Immediate + extended monitoring |
| Rollback Test Plan | ✅ Documented | 5 test scenarios defined |

**Overall: ✅ PASS — Rollback validation plan is comprehensive and launch-ready.**

---

*Concierge Launch Readiness — Workstream C*
*Rollback Validation — v1.0.0*
*Last updated: 2026-07-27*