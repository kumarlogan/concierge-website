# OPERATOR_GUIDE.md

**EPIC-012 — Release Management & Multi-Mode Execution**
**Phase J: Final Certification — Operator Guide**
**Date:** 2026-08-01
**Product:** Hermes Platform (reusable by every future Hermes product)
**Wave:** EPIC-012
**Hermes Runtime:** v1.0 (Foundation frozen)

---

## Executive Summary

Operator Guide provides operational procedures for the Hermes Release Management system. It covers daily operations, monitoring, incident response, and maintenance tasks. This guide is for operators and the Product Owner who manage releases.

---

## 1. Daily Operations

### 1.1 Morning Check

| Step | Action | Command/Tool | Expected |
|------|--------|-------------|----------|
| 1 | Check Release Dashboard | RELEASE_DASHBOARD.md | All panels green |
| 2 | Check latest release status | ReleaseRegistry.getLatest() | Status: DEPLOYED |
| 3 | Check deployment history | DeploymentHistory.getAll() | Recent deploys successful |
| 4 | Check health status | DeploymentHealthFramework | All dependencies healthy |
| 5 | Check audit trail | hermes/audit/event.ts | No anomalies |

### 1.2 Pre-Deploy Check (Before Any Production Deploy)

| Step | Action | Command | Expected |
|------|--------|---------|----------|
| 1 | Verify git state | `git status --porcelain` | Empty |
| 2 | Verify branch | `git branch --show-current` | `main` |
| 3 | Verify no open PRs against main | GitHub PRs page | No open PRs |
| 4 | Verify JWT secrets | GitHub Settings → Secrets | All 4 JWT secrets present |
| 5 | Verify VITE_API_BASE | GitHub Settings → Secrets | Points to `https://api.agsynergy.ca` |
| 6 | Verify Cloudflare token | Check token age | < 30 days old |
| 7 | Verify CHANGELOG.md | Read latest version entry | Version matches planned release |
| 8 | Verify PO approval | ApprovalRef | Approved |

### 1.3 Post-Deploy Check (After Any Production Deploy)

| Step | Action | Tool | Expected |
|------|--------|------|----------|
| 1 | Verify deployment success | CI/CD log | Exit code 0 |
| 2 | Run health checks | DeploymentHealthFramework | All healthy |
| 3 | Run smoke tests | Smoke Test Framework | All pass |
| 4 | Verify production endpoints | curl agsynergy.ca | HTTP 200 |
| 5 | Verify API endpoints | curl api.agsynergy.ca | HTTP 200 |
| 6 | Collect evidence | deployment-summary.sh | Report generated |
| 7 | Generate release notes | CHANGELOG.md parsed | Notes published |
| 8 | Update ReleaseRegistry | ReleaseRuntime | Record created |
| 9 | Emit audit event | emitAudit() | Event recorded |

---

## 2. Incident Response

### 2.1 Deployment Failure

```
1. Check CI/CD log for failure reason
2. Identify failed gate or step
3. Check ReleaseRegistry for failure record
4. If production deploy:
   a. Check if rollback is available
   b. If yes → execute rollback (see Rollback Procedure)
   c. If no → fix root cause, redeploy
5. If preview deploy:
   a. Fix root cause
   b. Push fix to feature branch
   c. CI/CD re-triggers automatically
```

### 2.2 Post-Deploy Health Check Failure

```
1. Check DeploymentHealthFramework results
2. Identify failed health check(s)
3. Check DeploymentHistory for previous successful deploy
4. If production deploy and health check fails:
   a. Trigger Rollback Agent
   b. Rollback Agent executes rollback
   c. Verify rollback success
   d. Record rollback in ReleaseRegistry
   e. Emit audit event
5. Investigate root cause
6. Fix and redeploy
```

### 2.3 Smoke Test Failure

```
1. Check Smoke Test Framework results
2. Identify failed smoke test(s)
3. Check if previous production version is healthy
4. If yes → trigger rollback to previous version
5. If no → investigate smoke test failures
6. Fix root cause
7. Redeploy with fix
8. Re-run smoke tests
```

### 2.4 Rollback Procedure

```bash
# Step 1: Identify previous release
# Check ReleaseRegistry for previous releaseId

# Step 2: Execute rollback
cd /home/ubuntu/concierge-website/workers
npx wrangler@4 deploy --env production --rollback

# Step 3: Verify rollback
# Check that previous version is serving correctly
curl https://agsynergy.ca
curl https://api.agsynergy.ca

# Step 4: Run health checks
# Verify all dependencies are healthy

# Step 5: Run smoke tests
# Verify all smoke tests pass

# Step 6: Record rollback
# Update ReleaseRegistry with rollback metadata
# Emit audit event

# Step 7: Notify Product Owner
# Send rollback notification with details
```

### 2.5 Incident Severity Levels

| Severity | Description | Response |
|----------|-------------|----------|
| **P0 — Critical** | Production outage, data loss, security breach | Immediate rollback, notify PO, incident report |
| **P1 — High** | Partial outage, degraded performance | Rollback within 1 hour, investigate |
| **P2 — Medium** | Feature broken but no outage | Fix in next deploy, no rollback needed |
| **P3 — Low** | Minor issue, cosmetic | Fix in next release cycle |

---

## 3. Monitoring

### 3.1 Key Metrics

| Metric | Source | Alert Threshold |
|--------|--------|----------------|
| Deploy success rate | ReleaseRegistry | < 90% triggers alert |
| Health check pass rate | DeploymentHealthFramework | < 95% triggers alert |
| Smoke test pass rate | Smoke Test Framework | < 95% triggers alert |
| Integrity gate pass rate | CI/CD pipeline | < 100% triggers alert |
| Rollback frequency | ReleaseRegistry | > 2 rollbacks/month triggers review |
| Mean time to rollback | RollbackMetadata | > 30 minutes triggers review |
| Mean time to recovery | DeploymentHistory | > 1 hour triggers review |

### 3.2 Dashboard Panels (Release Dashboard)

| Panel | Refresh | Alert Condition |
|-------|---------|-----------------|
| Release Status | On change | Failed release |
| Deployment History | On deploy | Failed deploy |
| Health Checks | Per check | Failed check |
| Mode Transitions | On transition | Failed transition |
| Integrity Gates | On deploy | Failed gate |
| Evidence Collection | On deploy | Missing evidence |
| Rollback Status | On rollback | Rollback triggered |
| Approval Gates | On approval | Pending approval > 24h |

---

## 4. Maintenance

### 4.1 Regular Maintenance Tasks

| Task | Frequency | Owner |
|------|-----------|-------|
| Review Release Dashboard | Daily | Operator |
| Review deployment history | Weekly | Operator |
| Review health check trends | Weekly | Operator |
| Review rollback records | Monthly | Operator + PO |
| Update CHANGELOG.md | Per release | Release Notes Agent |
| Rotate Cloudflare API token | Every 30 days | Operator |
| Rotate JWT secrets | Every 90 days | Operator |
| Review Release Backlog | Monthly | PO |
| Update Execution Guide | Per process change | Operator |
| Update Operator Guide | Per process change | Operator |

### 4.2 Token Rotation

```bash
# Step 1: Generate new Cloudflare API token
# Cloudflare Dashboard → My Profile → API Tokens → Create Token
# Scope: Workers Edit + D1

# Step 2: Delete old token
# GitHub Settings → Secrets → Delete CLOUDFLARE_API_TOKEN

# Step 3: Add new token
# GitHub Settings → Secrets → Add CLOUDFLARE_API_TOKEN

# Step 4: Verify new token
# npx wrangler@4 deploy --dry-run
```

### 4.3 Credential Management

| Credential | Rotation Period | Storage |
|------------|----------------|---------|
| CLOUDFLARE_API_TOKEN | 30 days | GitHub Secrets |
| JWT_PRIVATE_KEY | 90 days | GitHub Secrets |
| JWT_PUBLIC_KEY | 90 days | GitHub Secrets |
| JWT_KID | 90 days | GitHub Secrets |
| VITE_API_BASE | As needed | GitHub Secrets |

---

## 5. Phase J Completion Criteria

| # | Deliverable | Status |
|---|------------|--------|
| 1 | Operator Guide produced | ✅ Complete |
| 2 | Daily operations documented | ✅ Complete |
| 3 | Incident response procedures documented | ✅ Complete |
| 4 | Rollback procedure documented | ✅ Complete |
| 5 | Monitoring metrics defined | ✅ Complete |
| 6 | Maintenance tasks defined | ✅ Complete |

---

*End of OPERATOR_GUIDE.md*
