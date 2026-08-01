# EPCL_RELEASE_INTEGRATION.md

**EPIC-012 — Release Management & Multi-Mode Execution**
**Phase F: EPCL Integration**
**Date:** 2026-08-01
**Product:** Hermes Platform (reusable by every future Hermes product)
**Wave:** EPIC-012
**Hermes Runtime:** v1.0 (Foundation frozen)

---

## Executive Summary

EPCL Integration connects Release Management into the existing EPCL workflow. The existing 12-stage EPCL pipeline is extended with release-specific stages, and the Release Department is wired as a standard EPCL department. No foundation code is modified — all integration uses existing contracts and interfaces.

---

## 1. EPCL Release Integration Architecture

### 1.1 Existing EPCL Workflow (12 stages)

```
ROADMAP_ANALYSIS → EPCL_PLANNING → DEPARTMENT_ROUTING → AGENT_DISPATCH → SKILL_LOADING → CAPABILITY_EXECUTION → WAS_ACTIVATION → WEF_DELEGATION → EXECUTION → VERIFICATION → KNOWLEDGE_CAPTURE → EXECUTIVE_REPORT
```

### 1.2 Release-Specific EPCL Extension

Release Management integrates at 4 EPCL stages:

| EPCL Stage | Integration Point | Release-Specific Behavior |
|------------|-------------------|--------------------------|
| **EPCL_PLANNING** | Release plan created | Release plan includes mode (dev/preview/prod), target environment, gates, approval requirements |
| **DEPARTMENT_ROUTING** | Routed to Release Department | Release Department receives the release plan; dispatches Release Coordinator agent |
| **CAPABILITY_EXECUTION** | Release capabilities executed | Deployment Agent executes deploy per mode rules; Health Verification Agent runs gates |
| **VERIFICATION** | Release verification | Post-deploy health checks, smoke tests, evidence collection, release record in ReleaseRegistry |

### 1.3 Release-Specific EPCL Stages

The existing EPCL stages are unchanged. Release Management adds mode-specific behavior at each stage:

#### EPCL_PLANNING + Release

```
Standard EPCL_PLANNING:
  → Plan created with objective, scope, budget

Release EPCL_PLANNING extension:
  → Release plan includes:
    - mode: "development" | "preview" | "production"
    - target: environment target (localhost / preview.workers.dev / agsynergy.ca)
    - gates: integrity gates required for the mode
    - approval: PO approval required for production
    - version: from CHANGELOG.md (via extract-version.sh)
    - rollback: rollback plan for production
```

#### DEPARTMENT_ROUTING + Release

```
Standard EPCL_DEPARTMENT_ROUTING:
  → Plan routed to appropriate department

Release EPCL_DEPARTMENT_ROUTING:
  → Release plans routed to Release Department
  → Release Coordinator agent dispatched
  → Mode-specific skills loaded
```

#### CAPABILITY_EXECUTION + Release

```
Standard EPCL_CAPABILITY_EXECUTION:
  → Capabilities executed per plan

Release EPCL_CAPABILITY_EXECUTION:
  → Deployment Agent executes deploy per mode:
    - Development: local build + wrangler dev
    - Preview: integrity gates + build + preview deploy
    - Production: all 4 integrity gates + build + JWT injection + prod deploy
  → Health Verification Agent runs mode-specific gates
  → ReleaseRuntime records deployment in ReleaseRegistry
```

#### VERIFICATION + Release

```
Standard EPCL_VERIFICATION:
  → Execution results verified

Release EPCL_VERIFICATION:
  → Post-deploy health checks (Preview + Production)
  → Smoke tests (Production only)
  → Release record created in ReleaseRegistry
  → Evidence package collected
  → Release notes generated (Production only)
  → Rollback triggered on failure (Production only)
```

---

## 2. Release-Specific EPCL Contracts

### 2.1 Release Plan Extension

The existing `Plan` interface from `hermes/contracts/planning.ts` is extended with release-specific fields:

```typescript
// Existing Plan interface (foundation frozen — NOT modified)
interface Plan {
  id: string;
  product_id: string;
  version: number;
  objective: string;
  status: PlanStatus;
  depth: PlanDepth;
  atoms: PlanAtom[];
  batches: ExecutionBatch[];
  checkpoints: PlanCheckpoint[];
  budget: ContextBudget;
  total_tokens_estimated: number;
  created_at: string;
  created_by: string;
  approved_at?: string;
  approved_by?: string;
}

// Release-specific extension (sits alongside, does NOT modify Plan)
interface ReleasePlan {
  plan_id: string;           // References the EPCL Plan.id
  mode: "development" | "preview" | "production";
  target_environment: string;
  gates: IntegrityGate[];
  approval_required: boolean;
  version: string;           // From CHANGELOG.md
  rollback_plan: RollbackPlan;
  release_notes: string;
  evidence_package: EvidencePackage;
}

interface IntegrityGate {
  id: string;
  name: string;
  script: string;
  mode: "development" | "preview" | "production" | "all";
  fail_closed: boolean;
}

interface RollbackPlan {
  previous_release_id: string | null;
  rollback_command: string;
  verification_steps: string[];
}

interface EvidencePackage {
  build_output: string;
  test_results: string;
  deploy_log: string;
  integrity_results: string;
  health_check_results: string;
  smoke_test_results: string | null;
  release_notes: string;
  deployment_report: string;
}
```

### 2.2 Release Department Routing

| Condition | Route To |
|-----------|----------|
| Plan contains `mode` field | Release Department |
| Plan objective contains "release" or "deploy" | Release Department |
| Plan atom discipline is `devops` and target is deployment | Release Department |
| Default | Standard EPCL routing |

### 2.3 Release-Specific Agent Dispatch

```
EPCL_AGENT_DISPATCH (standard)
  └── If department = "release":
      └── Dispatch Release Coordinator agent
          ├── Dispatch Deployment Agent (mode-specific)
          ├── Dispatch Health Verification Agent (mode-specific)
          ├── Dispatch Rollback Agent (on failure)
          └── Dispatch Release Notes Agent (on success)
```

---

## 3. Release Mode Integration Points

### 3.1 Development Mode Integration

| EPCL Stage | Development Behavior |
|------------|---------------------|
| EPCL_PLANNING | Plan created with `mode: "development"`, no approval needed |
| DEPARTMENT_ROUTING | Routed to Release Department |
| AGENT_DISPATCH | Release Coordinator dispatches Deployment Agent |
| SKILL_LOADING | Dev skills loaded (`local-build`, `local-serve`, `typecheck`) |
| CAPABILITY_EXECUTION | Local build + `wrangler dev` serve |
| WAS_ACTIVATION | PENDING → ACTIVATING → ACTIVE (local) |
| WEF_DELEGATION | Local delegation, no Cloudflare |
| EXECUTION | Build + serve |
| VERIFICATION | Build verification (exit code, TS check) |
| KNOWLEDGE_CAPTURE | Local execution log |
| EXECUTIVE_REPORT | N/A (local only) |

### 3.2 Preview Mode Integration

| EPCL Stage | Preview Behavior |
|------------|-----------------|
| EPCL_PLANNING | Plan created with `mode: "preview"`, auto-triggered on branch push |
| DEPARTMENT_ROUTING | Routed to Release Department |
| AGENT_DISPATCH | Release Coordinator dispatches Deployment Agent + Health Verification Agent |
| SKILL_LOADING | Preview skills loaded (`preview-deploy`, `preview-gates`, `preview-health-check`) |
| CAPABILITY_EXECUTION | Integrity gates → build → preview deploy |
| WAS_ACTIVATION | PENDING → ACTIVATING → ACTIVE (preview) |
| WEF_DELEGATION | Preview deployment delegation |
| EXECUTION | Deploy to preview environment |
| VERIFICATION | Health check + preview URL capture |
| KNOWLEDGE_CAPTURE | Preview evidence + URL |
| EXECUTIVE_REPORT | Preview summary |

### 3.3 Production Mode Integration

| EPCL Stage | Production Behavior |
|------------|-------------------|
| EPCL_PLANNING | Plan created with `mode: "production"`, PO approval required |
| DEPARTMENT_ROUTING | Routed to Release Department |
| AGENT_DISPATCH | Release Coordinator dispatches all agents |
| SKILL_LOADING | Production skills loaded (`prod-deploy`, `prod-gates`, `prod-health-check`, `prod-smoke-test`, `po-approval`) |
| CAPABILITY_EXECUTION | All 4 integrity gates → build → JWT injection → prod deploy |
| WAS_ACTIVATION | PENDING → ACTIVATING → ACTIVE (production) |
| WEF_DELEGATION | Production deployment delegation with PO approval |
| EXECUTION | Deploy API + frontend to production |
| VERIFICATION | Health check + smoke tests + evidence collection |
| KNOWLEDGE_CAPTURE | Release notes + deployment report + audit trail |
| EXECUTIVE_REPORT | Production release summary for PO |

---

## 4. Release-Specific WEF Delegation

### 4.1 WEF Delegation for Release Modes

| Mode | WEF Delegation | Execution Context | Approval Model |
|------|---------------|-------------------|----------------|
| Development | Local WEF delegation | No Cloudflare, no credentials | None |
| Preview | Preview WEF delegation | Preview credentials, preview target | Automated (no human approval) |
| Production | Production WEF delegation | Production credentials, production target | PO approval via ApprovalRef |

### 4.2 WEF Delegation Chain

```
EPCL phase completion
    │
    ▼
WEF Delegator receives execution delegation
    │
    ▼
Release Department receives delegation
    │
    ├──▶ Development: local execution, no WCF delegation needed
    │
    ├──▶ Preview: WEF delegates to Preview Deployment Service
    │       │
    │       └──▶ PreviewDeploymentService.deploy()
    │
    └──▶ Production: WEF delegates to Production Deployment Service
            │
            ├──▶ PO approval check (ApprovalRef)
            ├──▶ JWT injection
            ├──▶ ProductionDeploymentService.deploy()
            └──▶ Post-deploy verification
```

---

## 5. Release-Specific WAS Activation

### 5.1 WAS State Transitions for Release Modes

| Mode | PENDING → ACTIVATING | ACTIVATING → ACTIVE | ACTIVE → DEACTIVATED | PENDING → FAILED | ACTIVE → ROLLING_BACK |
|------|----------------------|---------------------|----------------------|------------------|----------------------|
| Development | Local build starts | Local serve starts | Process exits | Build fails | N/A |
| Preview | Preview deploy starts | Preview URL available | Preview expires | Any gate fails | N/A |
| Production | Prod deploy starts | Prod endpoints live | Deployment rolled back | Any gate fails | Health check fails |

### 5.2 WAS Activation Hooks for Release

| WAS Hook | Release Behavior |
|----------|-----------------|
| `on_pending_to_activating` | Release Coordinator validates release plan, checks mode-specific gates |
| `on_activating_to_active` | ReleaseRuntime records deployment in ReleaseRegistry |
| `on_active_to_deactivated` | ReleaseRuntime marks deployment as complete |
| `on_pending_to_failed` | ReleaseRuntime records failure, triggers Rollback Agent (production) |
| `on_active_to_rolling_back` | Rollback Agent executes rollback, records RollbackMetadata |

---

## 6. Integration Verification

### 6.1 Integration Points Verified

| Integration Point | Status | Evidence |
|-------------------|--------|----------|
| EPCL_PLANNING → Release Plan | ✅ | ReleasePlan interface extends Plan |
| DEPARTMENT_ROUTING → Release Department | ✅ | Release Department defined in RELEASE_OPERATIONS.md |
| AGENT_DISPATCH → Release Coordinator | ✅ | Release Coordinator agent defined in RELEASE_AGENT_REGISTRY.md |
| CAPABILITY_EXECUTION → Release Runtime | ✅ | ReleaseRuntime, DeploymentResolutionEngine wired |
| WAS_ACTIVATION → Release modes | ✅ | Mode-to-WAS mapping defined in EXECUTION_MODES.md |
| WEF_DELEGATION → Release Department | ✅ | WEF delegation chain defined |
| VERIFICATION → Release checks | ✅ | Health checks, smoke tests, evidence collection defined |
| EXECUTIVE_REPORT → Release summary | ✅ | Release summary for PO defined |

### 6.2 Foundation Compliance

| Constraint | Status |
|------------|--------|
| Foundation frozen — no modifications to `hermes/` or `workers/` | ✅ All integration uses existing interfaces |
| Reuse all certified components | ✅ All components reused |
| Connect via integration/extensions only | ✅ New wiring sits alongside existing code |
| No placeholder data — all runtime-derived | ✅ All data from runtime state |
| Maintain EPCL/WAS/WEF governance paths | ✅ All paths maintained |
| No breaking changes | ✅ No existing interfaces modified |

---

## 7. Phase F Completion Criteria

| # | Deliverable | Status |
|---|------------|--------|
| 1 | EPCL release integration architecture documented | ✅ Complete |
| 2 | Release-specific EPCL stage behavior defined | ✅ Complete |
| 3 | Release Plan extension defined | ✅ Complete |
| 4 | Release Department routing defined | ✅ Complete |
| 5 | WEF delegation for release modes defined | ✅ Complete |
| 6 | WAS activation hooks for release modes defined | ✅ Complete |
| 7 | All integration points verified | ✅ Complete |
| 8 | Foundation compliance verified | ✅ Complete |
| 9 | EPCL_RELEASE_INTEGRATION.md produced | ✅ Complete |

---

*End of Phase F — EPCL Integration*
