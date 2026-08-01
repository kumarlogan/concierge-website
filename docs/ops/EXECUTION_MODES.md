# EXECUTION_MODES.md

**EPIC-012 — Release Management & Multi-Mode Execution**
**Phase E: Execution Modes**
**Date:** 2026-08-01
**Product:** Hermes Platform (reusable by every future Hermes product)
**Wave:** EPIC-012
**Hermes Runtime:** v1.0 (Foundation frozen)

---

## Executive Summary

Execution Modes define three governed deployment environments — Development, Preview, and Production — that replace the current ad-hoc deployment process. Each mode has explicit gates, targets, and approval requirements. Modes are governed by the WAS activation state machine and connected via the EPCL workflow. No foundation code is modified.

---

## 1. Mode Definitions

### 1.1 Development Mode

| Aspect | Definition |
|--------|-----------|
| **Purpose** | Local development and testing |
| **Trigger** | `wrangler dev` or `pnpm run dev` |
| **Environment** | Local development |
| **Target** | `localhost` (no Cloudflare deployment) |
| **Approval Required** | None (local only) |
| **Governance** | EPCL → Department → Agent → Skill → Capability → Execution |
| **WAS State** | PENDING → ACTIVATING → ACTIVE (local) |
| **Rollback** | N/A (local process terminates) |

#### Development Mode Pipeline

```
1. Developer runs `wrangler dev` or `pnpm run dev`
2. Build: `pnpm --filter @workspace/ags-fertility run build`
3. Serve: wrangler dev serves locally
4. No health checks (local only)
5. No evidence collection (local only)
6. No audit trail (local execution log only)
```

#### Development Mode Gates

| Gate | Check | Failure Action |
|------|-------|----------------|
| Build | `pnpm build` exit code | Block serve |
| TypeScript | `tsc --noEmit` exit code | Block serve |
| Import resolution | All imports resolve | Block serve |

### 1.2 Preview Mode

| Aspect | Definition |
|--------|-----------|
| **Purpose** | Staging/preview deployment for validation before production |
| **Trigger** | Push to `feat/*` or `preview` branch (automated) |
| **Environment** | Preview (Cloudflare preview environment) |
| **Target** | `preview.workers.dev` |
| **Approval Required** | None (automated) |
| **Governance** | EPCL → Department → Agent → Skill → Capability → Execution → Verification |
| **WAS State** | PENDING → ACTIVATING → ACTIVE (preview) |
| **Rollback** | `wrangler rollback` to previous preview deployment |

#### Preview Mode Pipeline

```
1. Push to feat/* or preview branch
2. CI/CD triggers (GitHub Actions)
3. Gate 1: Repository Integrity (repo-integrity-check.sh)
4. Gate 2: Required Files (required-files-check.sh)
5. Gate 3: Import Resolution (import-integrity-check.py)
6. Build: `pnpm --filter @workspace/ags-fertility run build`
7. Deploy: `wrangler deploy` (preview environment)
8. Health Check: DeploymentHealthFramework.isDeployable()
9. Evidence: Preview URL captured, deployment recorded in ReleaseRegistry
10. Audit: Full audit trail via emitAudit()
```

#### Preview Mode Gates

| Gate | Check | Failure Action |
|------|-------|----------------|
| Repository Integrity | No untracked build artifacts, clean git state | Block deploy |
| Required Files | All required files present | Block deploy |
| Import Resolution | All imports resolve to tracked files | Block deploy |
| Build | `pnpm build` exit code 0 | Block deploy |
| Health Check | DeploymentHealthFramework.isDeployable() returns true | Block deploy |

### 1.3 Production Mode

| Aspect | Definition |
|--------|-----------|
| **Purpose** | Production deployment to live users |
| **Trigger** | Push to `main` + Product Owner approval |
| **Environment** | Production (Cloudflare production) |
| **Target** | `agsynergy.ca`, `www.agsynergy.ca` (frontend) + `api.agsynergy.ca` (API) |
| **Approval Required** | Yes (Product Owner approval via ApprovalRef) |
| **Governance** | EPCL → Department → Agent → Skill → Capability → Execution → Verification → Knowledge |
| **WAS State** | PENDING → ACTIVATING → ACTIVE (production) |
| **Rollback** | `wrangler deploy --env production --rollback` to previous release |

#### Production Mode Pipeline

```
1. Push to main branch
2. CI/CD triggers (GitHub Actions)
3. Gate 1: Repository Integrity (repo-integrity-check.sh)
4. Gate 2: Required Files (required-files-check.sh)
5. Gate 3: Import Resolution (import-integrity-check.py)
6. Gate 4: Production Bundle Guard (no dev/staging endpoints)
7. Build: `pnpm --filter @workspace/ags-fertility run build`
8. JWT Injection: Inject secrets from GitHub Secrets
9. Deploy API: `wrangler deploy --env production` (workers/)
10. Deploy Frontend: `wrangler deploy` (root)
11. Health Check: DeploymentHealthFramework.isDeployable()
12. Smoke Tests: Full smoke test suite execution
13. Evidence: Deployment summary, release notes, deployment report
14. Audit: Full audit trail via emitAudit() + durable audit store
15. Release Notes: Generated from CHANGELOG.md
16. Executive Report: Release summary for Product Owner
```

#### Production Mode Gates

| Gate | Check | Failure Action |
|------|-------|----------------|
| Repository Integrity | No untracked build artifacts, clean git state | Block deploy |
| Required Files | All required files present | Block deploy |
| Import Resolution | All imports resolve to tracked files | Block deploy |
| Production Bundle Guard | No dev/staging endpoints in bundle, production host present | Block deploy |
| Build | `pnpm build` exit code 0 | Block deploy |
| JWT Injection | Secrets available and injected | Block deploy |
| Health Check | DeploymentHealthFramework.isDeployable() returns true | Block deploy |
| Smoke Tests | All smoke tests pass | Block deploy (or trigger rollback) |
| PO Approval | Product Owner approval via ApprovalRef | Block deploy |

---

## 2. Mode Transition Rules

### 2.1 Transition Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Development │────▶│   Preview   │────▶│ Production  │
│   (local)   │     │  (automated)│     │ (PO-approved)│
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                    │
      │                   │                    │
      ▼                   ▼                    ▼
   No gates          Preview gates        Production gates
   Local only        Automated deploy     PO approval required
   No evidence       Preview URL          Full evidence
   No audit          Preview audit        Full audit + durable
```

### 2.2 Transition Rules

| Transition | Required Conditions | Failure Action |
|-----------|---------------------|----------------|
| Development → Preview | Build passes, no TS errors | Block transition; fix locally |
| Preview → Production | All integrity gates pass, health checks pass, PO approval | Block transition; fix preview issues |
| Production → Rollback | Health check fails post-deploy | Auto-rollback to previous release |
| Production → Production | Same version re-deploy | Allowed (idempotent) |

### 2.3 Mode-Specific Credential Resolution

| Mode | Credential Source | Token Scope |
|------|-------------------|-------------|
| Development | `wrangler login` session | N/A (local only) |
| Preview | `secrets.CLOUDFLARE_API_TOKEN` (GitHub Actions) | Workers edit |
| Production | `secrets.CLOUDFLARE_API_TOKEN` (GitHub Actions) | Workers edit + D1 |
| Production (API) | `secrets.CLOUDFLARE_API_TOKEN` + `secrets.JWT_PRIVATE_KEY` | Workers edit + D1 + JWT signing |

### 2.4 Mode-Specific Environment Config

| Mode | wrangler.jsonc env | Worker Name | Routes |
|------|-------------------|-------------|--------|
| Development | (none — local) | `concierge-website-dev` | `localhost:[port]` |
| Preview | `env.preview` in workers/wrangler.jsonc | `concierge-website-preview` | `preview.workers.dev` |
| Production | `env.production` in workers/wrangler.jsonc | `hermes-website` | `agsynergy.ca`, `www.agsynergy.ca` |
| Production (API) | `env.production` in workers/wrangler.jsonc | `agsynergy-api` | `api.agsynergy.ca` |

---

## 3. WAS Integration

### 3.1 Mode-to-WAS State Mapping

| Mode | WAS PENDING → ACTIVATING | WAS ACTIVATING → ACTIVE | WAS ACTIVE → DEACTIVATED | WAS PENDING → FAILED |
|------|--------------------------|-------------------------|--------------------------|---------------------|
| Development | Local build starts | Local serve starts | Local process exits | Build fails |
| Preview | Preview deploy starts | Preview URL available | Preview deployment expires | Deploy fails |
| Production | Production deploy starts | Production endpoints live | Production deployment rolled back | Deploy fails |

### 3.2 Mode-Specific WAS Transitions

#### Development Mode

```
PENDING → ACTIVATING: Developer runs wrangler dev
ACTIVATING → ACTIVE: Build succeeds, local server running
ACTIVE → DEACTIVATED: Developer stops wrangler dev
PENDING → FAILED: Build fails or TS errors
```

#### Preview Mode

```
PENDING → ACTIVATING: CI/CD triggers on push to feat/*
ACTIVATING → ACTIVE: Preview deploy succeeds, URL available
ACTIVE → DEACTIVATED: Preview deployment expires (24h TTL)
PENDING → FAILED: Any gate fails (integrity, build, health)
```

#### Production Mode

```
PENDING → ACTIVATING: Push to main + PO approval received
ACTIVATING → ACTIVE: All gates pass, deploy succeeds
ACTIVE → DEACTIVATED: Production deployment rolled back
ACTIVE → ROLLING_BACK: Post-deploy health check fails
PENDING → FAILED: Any gate fails (integrity, build, health, PO approval)
```

---

## 4. EPCL Integration for Execution Modes

### 4.1 EPCL Stage Mapping

```
ROADMAP_ANALYSIS → EPCL_PLANNING → DEPARTMENT_ROUTING → AGENT_DISPATCH → SKILL_LOADING → CAPABILITY_EXECUTION → WAS_ACTIVATION → WEF_DELEGATION → EXECUTION → VERIFICATION → KNOWLEDGE_CAPTURE → EXECUTIVE_REPORT
```

Each mode maps to specific EPCL stages:

| EPCL Stage | Development | Preview | Production |
|-----------|-------------|---------|------------|
| ROADMAP_ANALYSIS | Feature branch created | Feature branch created | `main` branch target |
| EPCL_PLANNING | Local plan | Preview plan | Production plan |
| DEPARTMENT_ROUTING | → Release Dept | → Release Dept | → Release Dept |
| AGENT_DISPATCH | → Deployment Agent | → Deployment Agent | → Deployment Agent |
| SKILL_LOADING | Dev skills | Preview skills | Production skills |
| CAPABILITY_EXECUTION | Local build + serve | Preview deploy | Production deploy |
| WAS_ACTIVATION | Local activation | Preview activation | Production activation |
| WEF_DELEGATION | Local delegation | Preview delegation | Production delegation |
| EXECUTION | Local execution | Preview execution | Production execution |
| VERIFICATION | Build verification | Health check + URL capture | Full health + smoke tests |
| KNOWLEDGE_CAPTURE | Local log | Preview evidence | Release notes + report |
| EXECUTIVE_REPORT | N/A (local) | Preview summary | Production release summary |

### 4.2 Mode-Specific WEF Delegation

| Mode | WEF Delegation Target | Execution Context |
|------|----------------------|-------------------|
| Development | Local execution context | No Cloudflare, no credentials |
| Preview | Preview deployment context | Preview credentials, preview target |
| Production | Production deployment context | Production credentials, production target, PO approval |

---

## 5. Mode-Specific Skills

### 5.1 Development Skills

| Skill | Source | Purpose |
|-------|--------|---------|
| `local-build` | Existing (`pnpm build`) | Build frontend locally |
| `local-serve` | Existing (`wrangler dev`) | Serve locally via wrangler |
| `typecheck` | Existing (`tsc --noEmit`) | Type check the codebase |

### 5.2 Preview Skills

| Skill | Source | Purpose |
|-------|--------|---------|
| `preview-deploy` | New (EPIC-012) | Deploy to preview environment |
| `preview-health-check` | New (EPIC-012) | Run health checks on preview |
| `preview-url-capture` | New (EPIC-012) | Capture and record preview URL |
| `preview-gates` | Existing (3 integrity gates) | Run pre-deploy integrity gates |

### 5.3 Production Skills

| Skill | Source | Purpose |
|-------|--------|---------|
| `prod-deploy` | Existing (`wrangler deploy --env production`) | Deploy to production |
| `prod-health-check` | Existing (DeploymentHealthFramework) | Run full health checks |
| `prod-smoke-test` | Existing (Smoke Test Framework) | Execute smoke test suite |
| `prod-gates` | Existing (4 integrity gates + Production Bundle Guard) | Run all production gates |
| `po-approval` | New (EPIC-012) | Product Owner approval gate |
| `rollback` | New (EPIC-012) | Execute production rollback |
| `release-notes` | New (EPIC-012) | Generate production release notes |

---

## 6. Mode-Specific Evidence Collection

| Evidence Type | Development | Preview | Production |
|---------------|-------------|---------|------------|
| Build output | Local log | CI log | CI log |
| Test results | Local output | CI output | CI output |
| Deploy log | N/A | CI log | CI log |
| Integrity gates | N/A | 3 gates | 4 gates |
| Health checks | N/A | DeploymentHealthFramework | DeploymentHealthFramework + smoke tests |
| Preview URL | N/A | Captured | N/A |
| Production URL | N/A | N/A | `agsynergy.ca`, `api.agsynergy.ca` |
| Release notes | N/A | N/A | Generated from CHANGELOG.md |
| Deployment report | N/A | N/A | Generated by deployment-summary.sh |
| Audit trail | Local log only | emitAudit() | emitAudit() + durable audit store |
| Rollback record | N/A | N/A | On failure only |

---

## 7. Phase E Completion Criteria

| # | Deliverable | Status |
|---|------------|--------|
| 1 | Three execution modes defined (Development, Preview, Production) | ✅ Complete |
| 2 | Mode-specific pipelines documented | ✅ Complete |
| 3 | Mode-specific gates documented | ✅ Complete |
| 4 | Mode transition rules documented | ✅ Complete |
| 5 | WAS integration mapped | ✅ Complete |
| 6 | EPCL integration mapped | ✅ Complete |
| 7 | Mode-specific skills defined | ✅ Complete |
| 8 | Mode-specific evidence collection defined | ✅ Complete |
| 9 | EXECUTION_MODES.md produced | ✅ Complete |

---

*End of Phase E — Execution Modes*
