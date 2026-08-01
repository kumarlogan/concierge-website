# Release Gates — EPIC-013 Phase C

**EPIC-013 — Product Owner Review & Release Gates**
**Phase C: Release Gates**
**Date**: 2026-08-01
**Product**: Hermes Platform (reusable by every future Hermes product)
**Hermes Runtime**: v1.0 (Foundation frozen)

---

## Executive Summary

This document defines the 8 formal release gates that govern every Hermes deployment from Development through Production. Each gate includes an owner, entry criteria, exit criteria, blocking conditions, and required artifacts. Gates are enforced by the Hermes execution runtime — no gate can be bypassed without explicit Product Owner override.

---

## Gate Lifecycle

```
Development → Preview Building → Preview Ready → Preview Certified → Awaiting Product Owner → Approved For Production → Production Deploying → Production Live → Release Closed
```

---

## Gate 1: Development

| Field | Value |
|-------|-------|
| **Gate ID** | `GATE-01` |
| **Owner** | Engineering Lead |
| **Description** | Active development work. Code is being written and tested locally. |

### Entry Criteria
- [ ] Feature branch created from `main`
- [ ] EPIC milestone assigned
- [ ] Department routing completed (EPCL)
- [ ] Execution plan approved by Executive Office

### Exit Criteria
- [ ] Code changes committed to feature branch
- [ ] Unit tests passing locally
- [ ] Typecheck clean (`npx tsc --noEmit`)
- [ ] No breaking changes to Foundation

### Blocking Conditions
- [ ] Foundation code modifications detected
- [ ] Breaking changes introduced without ADR
- [ ] Missing test coverage for new functionality

### Artifacts
- Feature branch commit history
- Local test results
- Typecheck output

---

## Gate 2: Preview Building

| Field | Value |
|-------|-------|
| **Gate ID** | `GATE-02` |
| **Owner** | DevOps / Build Engineer |
| **Description** | Code is being built for the Preview environment. |

### Entry Criteria
- [ ] Gate 1 (Development) passed
- [ ] Feature branch ready for integration
- [ ] All imports resolve correctly (import integrity check)
- [ ] No test file false positives in CI gate

### Exit Criteria
- [ ] Frontend build succeeds (`npm run build`)
- [ ] API Worker build succeeds (`wrangler deploy --env preview`)
- [ ] Typecheck clean across all workspace projects
- [ ] Import integrity check passes (0 errors)
- [ ] Required deployment files present (wrangler.jsonc, deploy.yml, etc.)

### Blocking Conditions
- [ ] Build failure (frontend or API worker)
- [ ] Import integrity errors (non-test files)
- [ ] Missing required deployment files
- [ ] TypeScript errors in production code

### Artifacts
- Build logs (frontend + API worker)
- Typecheck output
- Import integrity report
- Required files verification report

---

## Gate 3: Preview Ready

| Field | Value |
|-------|-------|
| **Gate ID** | `GATE-03` |
| **Owner** | DevOps / Release Coordinator |
| **Description** | Preview deployment is ready and accessible. |

### Entry Criteria
- [ ] Gate 2 (Preview Building) passed
- [ ] Preview deployment triggered via CI/CD (`workflow_dispatch`)
- [ ] Preview URL assigned (`https://agsynergy-api-preview.kumarlogan.workers.dev`)

### Exit Criteria
- [ ] Preview API endpoint responding (HTTP 200 on `/api/v1/health`)
- [ ] Preview frontend serving correctly (HTTP 200 on `https://agsynergy.ca`)
- [ ] Preview environment configured (`ENVIRONMENT=preview`)
- [ ] All preview bindings active (D1, R2 via top-level preview_bucket_name)

### Blocking Conditions
- [ ] Preview API not responding
- [ ] Preview frontend not serving
- [ ] Missing preview bindings
- [ ] Preview deployment failed

### Artifacts
- Preview URL
- Health check results
- Deployment confirmation (CI/CD run ID)

---

## Gate 4: Preview Certified

| Field | Value |
|-------|-------|
| **Gate ID** | `GATE-04` |
| **Owner** | QA Lead / Certification Team |
| **Description** | Preview has passed all certification checks. |

### Entry Criteria
- [ ] Gate 3 (Preview Ready) passed
- [ ] Preview deployment accessible

### Exit Criteria
- [ ] **Smoke Tests**: All endpoints healthy (API health, frontend serving)
- [ ] **Browser Compatibility**: Vite build uses ES5 transpilation; no modern JS in HTML
- [ ] **UX Certification**: Loading indicators, responsive design, consistent branding present
- [ ] **Accessibility**: WCAG 2.1 AA checks (may have known gaps documented)
- [ ] **Performance**: Preview response times within acceptable thresholds
- [ ] **Security**: No exposed secrets, no dev/staging endpoints in production bundle

### Blocking Conditions
- [ ] Any smoke test failure
- [ ] Security vulnerability in preview bundle
- [ ] Exposed secrets or dev endpoints
- [ ] Critical accessibility failure (blocks production)

### Artifacts
- Smoke test results
- Certification report (`WAVE4_CERTIFICATION.md`)
- Accessibility audit results
- Browser compatibility report
- Performance summary

---

## Gate 5: Awaiting Product Owner

| Field | Value |
|-------|-------|
| **Gate ID** | `GATE-05` |
| **Owner** | Product Owner |
| **Description** | Preview is certified and ready for Product Owner review. |

### Entry Criteria
- [ ] Gate 4 (Preview Certified) passed
- [ ] `PRODUCT_OWNER_REVIEW_PACKAGE.md` generated automatically
- [ ] All artifacts attached to the review package

### Exit Criteria
- [ ] Product Owner has reviewed the review package
- [ ] Product Owner has made a decision (Approve / Request Changes / Reject)
- [ ] If Approved: approval recorded with timestamp and PO identity
- [ ] If Changes Requested: feedback captured and assigned to engineering

### Blocking Conditions
- [ ] Product Owner has not reviewed within 48 hours (escalation)
- [ ] PO requests changes that affect Foundation (requires ADR)
- [ ] PO rejects without providing actionable feedback

### Artifacts
- `PRODUCT_OWNER_REVIEW_PACKAGE.md`
- PO decision record (approve/change/reject)
- PO feedback (if changes requested)
- Approval timestamp

---

## Gate 6: Approved For Production

| Field | Value |
|-------|-------|
| **Gate ID** | `GATE-06` |
| **Owner** | Release Coordinator |
| **Description** | Product Owner has approved the Preview for Production promotion. |

### Entry Criteria
- [ ] Gate 5 (Awaiting Product Owner) passed with "Approve" decision
- [ ] No outstanding PO feedback requiring engineering changes
- [ ] Preview deployment evidence captured

### Exit Criteria
- [ ] Production deployment plan finalized
- [ ] Rollback plan documented
- [ ] Production deployment scheduled or triggered
- [ ] No rebuild required (same commit promoted)

### Blocking Conditions
- [ ] PO approval not recorded
- [ ] Outstanding PO feedback not addressed
- [ ] Missing rollback plan
- [ ] Production deployment would require Foundation modification

### Artifacts
- Production deployment plan
- Rollback plan
- Promotion approval record
- CI/CD run reference

---

## Gate 7: Production Deploying

| Field | Value |
|-------|-------|
| **Gate ID** | `GATE-07` |
| **Owner** | DevOps / Release Coordinator |
| **Description** | Production deployment is in progress. |

### Entry Criteria
- [ ] Gate 6 (Approved For Production) passed
- [ ] Production deployment triggered via CI/CD

### Exit Criteria
- [ ] Production API deployed (`https://agsynergy-api-production.kumarlogan.workers.dev`)
- [ ] Production frontend deployed (`https://agsynergy.ca`)
- [ ] Production smoke tests passing
- [ ] Production health checks healthy
- [ ] Deployment evidence captured (commit, build ID, deployment ID, timestamps)

### Blocking Conditions
- [ ] Production deployment failure
- [ ] Production smoke test failure
- [ ] Health check failures post-deployment
- [ ] Missing deployment evidence

### Artifacts
- Production deployment logs
- Production smoke test results
- Health check results
- Deployment evidence (`WAVE3_RELEASE.md` or equivalent)
- CI/CD run ID

---

## Gate 8: Production Live

| Field | Value |
|-------|-------|
| **Gate ID** | `GATE-08` |
| **Owner** | Release Coordinator + Product Owner |
| **Description** | Production deployment is live and verified. |

### Entry Criteria
- [ ] Gate 7 (Production Deploying) passed
- [ ] All production health checks passing
- [ ] All production smoke tests passing

### Exit Criteria
- [ ] Release Notes generated (`WAVE3_RELEASE_NOTES.md` or equivalent)
- [ ] Knowledge Capture completed (`WAVE3_KNOWLEDGE_CAPTURE.md` or equivalent)
- [ ] Executive Release Report generated (`WAVE3_EXECUTIVE_REPORT.md` or equivalent)
- [ ] Release marked as RELEASED in governance documents
- [ ] Wave status updated to RELEASED

### Blocking Conditions
- [ ] Missing release notes
- [ ] Missing knowledge capture
- [ ] Missing executive report
- [ ] Governance documents not updated

### Artifacts
- Release Notes
- Knowledge Capture document
- Executive Release Report
- Governance status update
- Release closure record

---

## Gate Transition Rules

### Automatic Transitions
| From | To | Trigger |
|------|----|---------|
| GATE-01 → GATE-02 | Feature branch ready for build | Engineering completes development |
| GATE-02 → GATE-03 | Build succeeds, preview deploy triggered | CI/CD pipeline completes |
| GATE-04 → GATE-05 | All certifications pass | QA Lead confirms certification |
| GATE-06 → GATE-07 | PO approval recorded | Release Coordinator triggers deploy |
| GATE-07 → GATE-08 | Production smoke tests pass | DevOps confirms deployment |

### Manual Transitions (Require PO Action)
| From | To | Trigger |
|------|----|---------|
| GATE-05 → GATE-06 | PO approves | Product Owner decision |
| GATE-05 → GATE-01 | PO requests changes | PO feedback to engineering |
| GATE-05 → REJECTED | PO rejects | PO rejection with reason |

### Reverse Transitions (Rollback)
| From | To | Trigger |
|------|----|---------|
| GATE-07 → GATE-03 | Production health check fails | Automatic rollback trigger |
| GATE-08 → GATE-07 | Post-release issue detected | Manual rollback initiated |

---

## Governance Compliance

| Rule | Enforcement |
|------|-------------|
| No gate bypasses | All transitions require explicit criteria satisfaction |
| No Foundation modifications | Checked at GATE-01 and GATE-06 |
| No production deploy without PO approval | GATE-05 → GATE-06 requires PO decision |
| Complete evidence chain | Every gate produces artifacts |
| Rollback available at every stage | Rollback plan required at GATE-06 |

---

## Next Phase

→ **Phase D**: Extend the Executive Command Center with PO Review and Gate panels
