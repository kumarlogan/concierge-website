# RELEASE_OPERATIONS.md

**EPIC-012 — Release Management & Multi-Mode Execution**
**Phase C: Release Organization**
**Date:** 2026-08-01
**Product:** Hermes Platform (reusable by every future Hermes product)
**Wave:** EPIC-012
**Hermes Runtime:** v1.0 (Foundation frozen)

---

## Executive Summary

Release Organization establishes the operational structure for Hermes release management. It defines the Release Department, Release Agents, and the three governed execution modes (Development, Preview, Production) that replace the ad-hoc deployment process. All components reuse existing certified platform capabilities — no new code, no foundation modifications.

---

## 1. Release Organization Architecture

### 1.1 Organizational Structure

```
Hermes Platform
├── Release Department (new organizational unit)
│   ├── Release Coordinator (agent)
│   │   ├── Manages release lifecycle
│   │   ├── Coordinates across modes
│   │   └── Produces release evidence
│   ├── Deployment Agent (agent)
│   │   ├── Executes deployments per mode
│   │   ├── Validates pre-deploy gates
│   │   └── Reports deployment status
│   ├── Health Verification Agent (agent)
│   │   ├── Runs pre-deploy health checks
│   │   ├── Runs post-deploy smoke tests
│   │   └── Reports health status
│   ├── Rollback Agent (agent)
│   │   ├── Monitors deployment health
│   │   ├── Triggers rollback on failure
│   │   └── Records rollback metadata
│   └── Release Notes Agent (agent)
│       ├── Generates release notes from CHANGELOG.md
│       ├── Captures deployment evidence
│       └── Publishes release documentation
├── EPCL (governance)
│   ├── PlanningEngine → Release planning
│   ├── RoadmapEngine → Release roadmap
│   ├── DisciplineRouter → Routes to Release discipline
│   └── ExecutiveDashboard → Release dashboard
├── WAS (activation)
│   ├── PENDING → ACTIVATING → ACTIVE (per mode)
│   ├── ACTIVE → ROLLING_BACK (on failure)
│   └── ACTIVE → DEACTIVATED (on completion)
└── WEF (delegation)
    └── Delegates to Release Department for execution
```

### 1.2 Department Definition

| Field | Value |
|-------|-------|
| **Department ID** | `release` |
| **Department Name** | Release Management |
| **Parent** | Hermes Platform |
| **Discipline** | `devops` |
| **Capabilities** | Release Registry, Environment Resolution, Deployment, Health Verification, Rollback, Evidence Collection |
| **Governance Path** | EPCL → Department → Agent → Skill → Capability → Execution → Verification |
| **Activation** | WAS PENDING → ACTIVATING → ACTIVE |
| **Fail-Closed** | Yes — any gate failure blocks the release |

---

## 2. Three Governed Execution Modes

### 2.1 Mode Definitions

| Mode | Purpose | Trigger | Environment | Target | Approval Required |
|------|---------|---------|-------------|--------|-------------------|
| **Development** | Local development and testing | `wrangler dev` or `pnpm run dev` | Local/dev | `localhost` | None (local only) |
| **Preview** | Staging/preview deployment for validation | Push to `feat/*` or `preview` branch | Preview | `preview.workers.dev` | None (automated) |
| **Production** | Production deployment to live users | Push to `main` + Product Owner approval | Production | `agsynergy.ca`, `api.agsynergy.ca` | Yes (PO approval) |

### 2.2 Mode Transition Rules

```
Development ──▶ Preview ──▶ Production
    │              │              │
    │              │              │
    ▼              ▼              ▼
  Local        Automated      PO-Approved
  Only         Deploy         Deploy
  No Gates     Preview Gates  Production Gates
```

| Transition | Gate | Failure Action |
|-----------|------|----------------|
| Development → Preview | Build passes, no TS errors | Block transition |
| Preview → Production | All integrity gates pass, health checks pass, PO approval | Block transition |
| Production → Rollback | Health check fails post-deploy | Auto-rollback |

### 2.3 Mode-Specific Behaviors

#### Development Mode

| Aspect | Behavior |
|--------|----------|
| Build | `pnpm --filter @workspace/ags-fertility run build` |
| Deploy | `wrangler dev` (local, no Cloudflare deploy) |
| Health Checks | None (local only) |
| Evidence | None (local only) |
| Audit | Minimal (local execution log) |
| Rollback | N/A (local process) |

#### Preview Mode

| Aspect | Behavior |
|--------|----------|
| Build | `pnpm --filter @workspace/ags-fertility run build` |
| Deploy | `wrangler deploy` (preview environment) |
| Health Checks | Deployment Health Framework `isDeployable()` |
| Evidence | Preview URL captured, deployment recorded in Release Registry |
| Audit | Full audit trail via `emitAudit()` |
| Rollback | `wrangler rollback` to previous preview deployment |
| Gate | Import integrity, required files, build success |

#### Production Mode

| Aspect | Behavior |
|--------|----------|
| Build | `pnpm --filter @workspace/ags-fertility run build` |
| Deploy | `wrangler deploy --env production` (API) + `wrangler deploy` (frontend) |
| Health Checks | Full Deployment Health Framework + post-deploy smoke tests |
| Evidence | Deployment summary, release notes, deployment report |
| Audit | Full audit trail via `emitAudit()` + durable audit store |
| Rollback | `wrangler deploy --env production --rollback` to previous release |
| Gate | All 4 integrity gates + PO approval + JWT injection |

---

## 3. Release Department Agents

### 3.1 Release Coordinator Agent

| Field | Value |
|-------|-------|
| **Agent ID** | `release-coordinator` |
| **Capability** | Release Management |
| **Responsibilities** | Orchestrates release lifecycle across modes; coordinates deployment agents; produces release evidence |
| **Governance** | EPCL → Department → Agent |
| **Activation** | WAS PENDING → ACTIVATING → ACTIVE |
| **Skills** | `release-planning`, `release-execution`, `release-verification` |

### 3.2 Deployment Agent

| Field | Value |
|-------|-------|
| **Agent ID** | `deployment-agent` |
| **Capability** | Cloudflare Deployment |
| **Responsibilities** | Executes deployments per mode; validates pre-deploy gates; reports deployment status |
| **Governance** | EPCL → Department → Agent |
| **Activation** | WAS PENDING → ACTIVATING → ACTIVE |
| **Skills** | `wrangler-deploy`, `integrity-gates`, `credential-resolution` |

### 3.3 Health Verification Agent

| Field | Value |
|-------|-------|
| **Agent ID** | `health-verifier` |
| **Capability** | Deployment Health |
| **Responsibilities** | Runs pre-deploy health checks; runs post-deploy smoke tests; reports health status |
| **Governance** | EPCL → Department → Agent |
| **Activation** | WAS PENDING → ACTIVATING → ACTIVE |
| **Skills** | `health-check`, `smoke-test`, `dependency-verify` |

### 3.4 Rollback Agent

| Field | Value |
|-------|-------|
| **Agent ID** | `rollback-agent` |
| **Capability** | Rollback Management |
| **Responsibilities** | Monitors deployment health; triggers rollback on failure; records rollback metadata |
| **Governance** | EPCL → Department → Agent |
| **Activation** | WAS PENDING → ACTIVATING → ACTIVE |
| **Skills** | `rollback-execute`, `rollback-verify`, `rollback-audit` |

### 3.5 Release Notes Agent

| Field | Value |
|-------|-------|
| **Agent ID** | `release-notes-agent` |
| **Capability** | Release Documentation |
| **Responsibilities** | Generates release notes from CHANGELOG.md; captures deployment evidence; publishes release documentation |
| **Governance** | EPCL → Department → Agent |
| **Activation** | WAS PENDING → ACTIVATING → ACTIVE |
| **Skills** | `changelog-parse`, `release-notes-generate`, `evidence-collect` |

---

## 4. Release Workflow (EPCL Integration)

### 4.1 EPCL Stages for Release Management

```
ROADMAP_ANALYSIS → EPCL_PLANNING → DEPARTMENT_ROUTING → AGENT_DISPATCH → SKILL_LOADING → CAPABILITY_EXECUTION → WAS_ACTIVATION → WEF_DELEGATION → EXECUTION → VERIFICATION → KNOWLEDGE_CAPTURE → EXECUTIVE_REPORT
```

### 4.2 Release-Specific EPCL Flow

```
1. ROADMAP_ANALYSIS
   └── Release roadmap entry created in RoadmapEngine

2. EPCL_PLANNING
   └── Release plan created with mode (dev/preview/prod), target, gates

3. DEPARTMENT_ROUTING
   └── Routed to Release Department

4. AGENT_DISPATCH
   └── Release Coordinator dispatched

5. SKILL_LOADING
   └── Mode-specific skills loaded (wrangler-deploy, health-check, etc.)

6. CAPABILITY_EXECUTION
   └── Deployment Agent executes deploy per mode rules

7. WAS_ACTIVATION
   └── WAS state machine governs activation lifecycle

8. WEF_DELEGATION
   └── WEF delegates to Release Department for execution

9. EXECUTION
   └── Deploy, verify, record

10. VERIFICATION
    └── Health Verification Agent runs post-deploy checks

11. KNOWLEDGE_CAPTURE
    └── Release Notes Agent captures evidence and lessons

12. EXECUTIVE_REPORT
    └── Release summary produced for Product Owner
```

### 4.3 Mode-Specific EPCL Flows

| Mode | Additional Gates | Additional Steps |
|------|-----------------|------------------|
| Development | None | Local build + dev server |
| Preview | Import integrity, build success | Preview deploy + URL capture |
| Production | All 4 integrity gates + PO approval | Full deploy + health check + smoke test + evidence collection |

---

## 5. Release Registry (Runtime)

### 5.1 Release Record Schema

```typescript
interface ReleaseRecord {
  releaseId: string;           // Unique release identifier
  version: string;             // SemVer version from CHANGELOG.md
  mode: "development" | "preview" | "production";
  environment: "development" | "preview" | "production";
  commitSha: string;           // Git commit SHA
  buildHash: string;           // Build hash from deployment-summary.sh
  deployedBy: string;          // Agent or operator who triggered deploy
  deployedAt: string;          // ISO 8601 timestamp
  status: "pending" | "deploying" | "deployed" | "failed" | "rolled_back";
  workerName: string;          // Target worker name
  metadata: ReleaseMetadata;   // Commit message, branch, PR, changes, smoke tests, rollback
}
```

### 5.2 Release Registry Operations

| Operation | Description | Mode Support |
|-----------|-------------|-------------|
| `create(record)` | Create new release record | All modes |
| `get(releaseId)` | Get release record by ID | All modes |
| `updateStatus(releaseId, status)` | Update release status | All modes |
| `listByEnvironment(env)` | List releases by environment | All modes |
| `listByMode(mode)` | List releases by execution mode | All modes |
| `listAll()` | List all releases | All modes |
| `getLatest(version)` | Get latest release for version | All modes |
| `getHistory(limit)` | Get deployment history | All modes |

### 5.3 Environment Resolution

| Mode | Worker Name | Target Host | Routes |
|------|------------|-------------|--------|
| Development | `concierge-website-dev` | `localhost` | `localhost:[port]` |
| Preview | `concierge-website-preview` | `preview.workers.dev` | (none) |
| Production | `hermes-website` | `agsynergy.ca` | `agsynergy.ca`, `www.agsynergy.ca` |
| Production (API) | `agsynergy-api` | `api.agsynergy.ca` | `api.agsynergy.ca` |

---

## 6. Release Evidence Collection

### 6.1 Evidence Types

| Evidence Type | Source | Collected By | Mode |
|---------------|--------|-------------|------|
| Build output | `pnpm build` stdout | Deployment Agent | All |
| Test results | Test framework output | Deployment Agent | All |
| Deploy logs | wrangler deploy output | Deployment Agent | All |
| Integrity gate results | 3 integrity scripts | Deployment Agent | Preview + Production |
| Health check results | DeploymentHealthFramework | Health Verification Agent | Preview + Production |
| Smoke test results | Smoke test framework | Health Verification Agent | Production |
| Deployment summary | `scripts/deployment-summary.sh` | Release Notes Agent | Production |
| Release notes | CHANGELOG.md + deploy report | Release Notes Agent | Production |
| Rollback record | RollbackMetadata | Rollback Agent | On failure |
| Audit trail | `hermes/audit/event.ts` | All agents | All |

### 6.2 Evidence Package Structure

```
release-evidence/
├── build/
│   ├── output.log
│   ├── test-results.json
│   └── bundle-hash.txt
├── deploy/
│   ├── deploy-log.txt
│   ├── integrity-gate-results.json
│   └── health-check-results.json
├── verify/
│   ├── smoke-test-results.json
│   └── post-deploy-checks.json
├── record/
│   ├── release-record.json
│   └── deployment-history-entry.json
└── report/
    ├── release-notes.md
    ├── deployment-report.md
    └── executive-summary.md
```

---

## 7. Phase C Completion Criteria

| # | Deliverable | Status |
|---|------------|--------|
| 1 | Release Department defined | ✅ Complete |
| 2 | Three execution modes defined (Development, Preview, Production) | ✅ Complete |
| 3 | Mode transition rules documented | ✅ Complete |
| 4 | Release Agents defined (5 agents) | ✅ Complete |
| 5 | Release workflow mapped to EPCL stages | ✅ Complete |
| 6 | Release Registry interface defined | ✅ Complete |
| 7 | Environment resolution table defined | ✅ Complete |
| 8 | Evidence collection structure defined | ✅ Complete |
| 9 | RELEASE_OPERATIONS.md produced | ✅ Complete |

---

*End of Phase C — Release Organization*
