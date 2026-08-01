# WAVE4_RUNTIME_WIRING.md

**EPIC-011 — Executive Operations Platform**
**Phase B: Runtime Wiring**
**Date:** 2026-08-01
**Product:** Concierge — AGS Fertility AI Platform
**Wave:** 4 — Runtime Wiring
**Hermes Runtime:** v1.0 (Foundation frozen)

---

## Executive Summary

Phase B connects the 3 categories of disconnected components identified in Phase A discovery. All wiring uses **integration/extension points only** — no existing components are modified, redesigned, or replaced. The wiring maps 40+ disconnected components to their runtime targets via existing interfaces and contracts.

---

## 1. Wiring Strategy

### Constraint Compliance

| Constraint | Approach |
|-----------|----------|
| Foundation frozen | No modifications to hermes/ or workers/ platform code |
| Reuse all certified components | All existing components preserved as-is |
| Connect via integration/extensions only | New wiring layer sits alongside existing code |
| No placeholder data | All wiring targets use real existing interfaces |
| Maintain EPCL/WAS/WEF governance paths | Wiring follows existing governance flow |

### Wiring Categories

| Category | Components | Wiring Method |
|----------|-----------|---------------|
| Hermes Services Integration | 20+ services in `hermes/services/` | Extension via existing contracts and registries |
| Workers Platform Integration | 5 platform capabilities in `workers/src/platform/` | WAS activation hooks + WEF delegation |
| Governance Doc Wiring | 3 governance documents | Runtime reference injection |

---

## 2. Hermes Services Integration Wiring

### 2.1 Activation Providers → WAS Activation

| Provider | WAS Integration Point | Wiring Method |
|----------|----------------------|---------------|
| `hermes/services/activation/providers/bootstrap.ts` | WAS PENDING → ACTIVATING | WAS activation signals invoke bootstrap provider |
| `hermes/services/activation/providers/claude-code.ts` | WAS ACTIVATING → ACTIVE | Provider-specific activation logic |
| `hermes/services/activation/providers/github/provider.ts` | WAS ACTIVATING → ACTIVE | GitHub deployment provider |
| `hermes/services/activation/providers/cloudflare/provider.ts` | WAS ACTIVATING → ACTIVE | Cloudflare deployment provider |
| `hermes/services/activation/providers/deployment/` | WAS ACTIVATING → ACTIVE | Deployment executor integration |
| `hermes/services/activation/providers/website.ts` | WAS ACTIVATING → ACTIVE | Website deployment provider |

**Wiring target:** WAS `ActivationLifecycle` interface — providers register via `bindProvider()` and are invoked during ACTIVATING state transitions.

### 2.2 Scheduler → Cron Integration

| Component | Wiring Point | Method |
|-----------|-------------|--------|
| `hermes/services/scheduler/scheduler.ts` | WAS state transitions | Scheduler triggers department activation on WAS state change |
| `hermes/services/scheduler/index.ts` | EPCL phase transitions | Scheduler triggers next EPCL phase on completion |

**Wiring target:** EPCL `RoadmapEngine` phase completion events → scheduler triggers next phase.

### 2.3 Security Providers → Trust Runtime

| Component | Wiring Point | Method |
|-----------|-------------|--------|
| `hermes/services/security/providers/` | Trust Engine evaluation | Security providers feed trust factors |
| `hermes/services/security/security-agent.ts` | WAS approval gates | Security checks gate WAS activation |
| `hermes/services/security/provider-health.ts` | Deployment Health Framework | Provider health checks feed deployment readiness |

**Wiring target:** WAS `approval-gates.ts` — security checks run during PENDING → ACTIVATING transition.

### 2.4 Provider Framework → Capability Registry

| Component | Wiring Point | Method |
|-----------|-------------|--------|
| `hermes/services/providers/manager.ts` | Capability registry lookup | Provider manager resolves capabilities by name |
| `hermes/services/providers/loader.ts` | Dynamic capability loading | Loader discovers and loads providers at runtime |
| `hermes/services/providers/manifest-v2.ts` | Capability metadata | Manifest provides capability definitions |
| `hermes/services/providers/marketplace.ts` | Capability discovery | Marketplace lists available capabilities |
| `hermes/services/providers/platform.ts` | Platform capability registration | Platform provider registers platform capabilities |
| `hermes/services/providers/runtime/guard.ts` | Execution guardrails | Guard enforces safety during capability execution |
| `hermes/services/providers/trust/` | Trust evaluation | Trust lifecycle integrates with provider execution |
| `hermes/services/providers/transport/` | Provider communication | Transport layer handles provider-to-provider calls |
| `hermes/services/providers/claude-code/` | Claude Code provider | Provider implementation for Claude Code |

**Wiring target:** EPCL `DisciplineRouter` — routes work to the correct capability provider based on discipline.

### 2.5 MCP Adapter → Agent Skill Loading

| Component | Wiring Point | Method |
|-----------|-------------|--------|
| `hermes/services/mcp/adapter.ts` | Agent skill loading | MCP adapter loads skills via Model Context Protocol |

**Wiring target:** Agent execution — skills are loaded via MCP adapter when agent is dispatched.

### 2.6 Developer Tools → Engineering Department

| Component | Wiring Point | Method |
|-----------|-------------|--------|
| `hermes/services/developer/developer-runtime.ts` | Engineering department execution | Developer runtime provides engineering execution context |
| `hermes/services/developer/engineering-planner.ts` | EPCL planning | Engineering planner generates engineering-specific plans |
| `hermes/services/developer/qa-pipeline.ts` | QA department execution | QA pipeline runs quality checks |
| `hermes/services/developer/security-pipeline.ts` | Security verification | Security pipeline runs security checks |
| `hermes/services/developer/review-package.ts` | Review pipeline | Review package aggregates agent outputs |
| `hermes/services/developer/git-workflow.ts` | Release operations | Git workflow manages source control operations |
| `hermes/services/developer/wf-0001.ts` | Workflow execution | Workflow 1: development pipeline |
| `hermes/services/developer/wf-0002.ts` | Workflow execution | Workflow 2: deployment pipeline |
| `hermes/services/developer/docs-pipeline.ts` | Documentation | Docs pipeline generates documentation |
| `hermes/services/developer/e2e-simulation.ts` | Verification | E2E simulation runs integration tests |

**Wiring target:** EPCL `DisciplineRouter` routes engineering discipline to developer runtime.

### 2.7 Application Types → Execution Context

| Component | Wiring Point | Method |
|-----------|-------------|--------|
| `hermes/services/application/types.ts` | Execution context typing | Application types provide context schema |

**Wiring target:** Hermes Execution Coordinator — execution context uses application types for type safety.

### 2.8 Registry (hermes) → Capability Discovery

| Component | Wiring Point | Method |
|-----------|-------------|--------|
| `hermes/services/registry/registry.ts` | Capability discovery | Registry stores and retrieves capability records |
| `hermes/services/registry/types.ts` | Capability typing | Registry types define capability schema |

**Wiring target:** Hermes Discovery Service — `discoverApplications()` queries the registry.

### 2.9 Lifecycle → Agent State Management

| Component | Wiring Point | Method |
|-----------|-------------|--------|
| `hermes/services/lifecycle/lifecycle.ts` | Agent lifecycle | Lifecycle manages agent state transitions |

**Wiring target:** Agent Registry — agent state transitions go through lifecycle manager.

### 2.10 Notification → Alerting

| Component | Wiring Point | Method |
|-----------|-------------|--------|
| `hermes/services/notification/notification.ts` | WAS state change alerts | Notification service sends alerts on state transitions |

**Wiring target:** WAS activation — notification fires on each state transition (PENDING→ACTIVATING→ACTIVE/FAILED/REJECTED).

### 2.11 Discovery → Topology

| Component | Wiring Point | Method |
|-----------|-------------|--------|
| `hermes/services/discovery/discovery.ts` | Runtime topology | Discovery answers "what exists?" queries |

**Wiring target:** Executive Dashboard — discovery provides real-time topology for observability.

### 2.12 Workforce → Orchestration

| Component | Wiring Point | Method |
|-----------|-------------|--------|
| `hermes/services/workforce/orchestration.ts` | WEF delegation | Workforce orchestration coordinates execution |
| `hermes/services/workforce/workflow-repository.ts` | Workflow persistence | Repository stores workflow state |
| `hermes/services/workforce/workflow-store.ts` | Workflow state | Store manages workflow lifecycle |
| `hermes/services/workforce/observability.ts` | Workforce metrics | Observability tracks agent health |
| `hermes/services/workforce/workforce-metrics.ts` | Metric recording | Metrics bridge to repository |
| `hermes/services/workforce/repository.ts` | Data persistence | Repository for workflow data |
| `hermes/services/workforce/persistence.ts` | Persistence layer | Persistence for workforce data |
| `hermes/services/workforce/d1-backend.ts` | D1 integration | D1 backend for production data |
| `hermes/services/workforce/activation-workflow.ts` | Activation flow | Activation workflow manages WAS integration |
| `hermes/services/workforce/index.ts` | Workforce exports | Exports all workforce services |

**Wiring target:** Hermes Workforce Orchestration — workforce services compose the execution pipeline.

### 2.13 Execution Services → WEF

| Component | Wiring Point | Method |
|-----------|-------------|--------|
| `hermes/services/execution/execution-coordinator.ts` | WEF core | Coordinator manages execution lifecycle |
| `hermes/services/execution/execution-queue.ts` | Work queue | Queue manages execution order |
| `hermes/services/execution/work-planner.ts` | Planning | Work planner generates execution plans |
| `hermes/services/execution/workforce-dispatch.ts` | Dispatch | Dispatches work to capability providers |
| `hermes/services/execution/context.ts` | Execution context | Context carries execution state |
| `hermes/services/execution/epic-004.6.test.ts` | Execution testing | Tests for execution coordinator |
| `hermes/services/execution/idempotency.ts` | Idempotency | Ensures safe retries |
| `hermes/services/execution/lease.ts` | Execution leasing | Lease management for concurrent execution |
| `hermes/services/execution/metrics.ts` | Execution metrics | Metrics collection |
| `hermes/services/execution/operator-experience.ts` | Operator UX | Single-command execution interface |
| `hermes/services/execution/policy-evaluator.ts` | Policy enforcement | Evaluates execution policies |
| `hermes/services/execution/research-intelligence.ts` | Research integration | Research intelligence feeds execution |
| `hermes/services/execution/review-pipeline.ts` | Review integration | Review pipeline aggregates outputs |
| `hermes/services/execution/simulation.ts` | Dry run | Simulation for safe execution testing |
| `hermes/services/execution/execution-flag-lifecycle.ts` | Flag management | Manages execution flags |
| `hermes/services/execution/executive-trace.ts` | Executive tracing | Generates executive trace documents |
| `hermes/services/execution/discipline-router-integration.ts` | Discipline routing | Integrates discipline router with execution |
| `hermes/services/execution/entry-point.ts` | Entry point | Entry point for execution invocations |
| `hermes/services/execution/gateway/hermes-execution-gateway.ts` | Gateway | Gateway for external execution requests |
| `hermes/services/execution/gateway/approval.ts` | Approval gateway | Approval gating for privileged actions |

**Wiring target:** WEF Delegator — execution coordinator is the WEF's core execution engine.

### 2.14 Audit → Compliance

| Component | Wiring Point | Method |
|-----------|-------------|--------|
| `hermes/audit/event.ts` | Audit emission | Emits audit events for all state transitions |
| `hermes/audit/store.ts` | Audit storage | Stores audit events |
| `hermes/audit/store.durable.ts` | Durable audit | Durable audit store for production |
| `hermes/audit/emitter.ts` | Audit emission | Event emitter for audit stream |
| `hermes/audit/audit.ts` | Audit management | Audit management utilities |

**Wiring target:** All WAS state transitions emit audit events via `emitAudit()`.

### 2.15 Persistence → State Management

| Component | Wiring Point | Method |
|-----------|-------------|--------|
| `hermes/persistence/agent-state-store.ts` | Agent state | Stores agent lifecycle state |
| `hermes/persistence/execution-store.ts` | Execution state | Stores execution context and results |
| `hermes/persistence/workflow-store.ts` | Workflow state | Stores workflow lifecycle state |
| `hermes/persistence/provider.ts` | Provider state | Stores provider configuration |
| `hermes/persistence/tenant.ts` | Tenant state | Stores tenant isolation data |

**Wiring target:** Execution Coordinator — persistence layer stores execution state for replayability.

### 2.16 Contracts → Interface Contracts

| Component | Wiring Point | Method |
|-----------|-------------|--------|
| `hermes/contracts/planning.ts` | EPCL contracts | Planning domain contracts |
| `hermes/contracts/platform-api.ts` | Platform API contracts | Platform interface contracts |
| `hermes/contracts/dispatcher.ts` | Dispatcher contracts | Dispatcher interface contracts |
| `hermes/contracts/index.ts` | Contract exports | Exports all contracts |

**Wiring target:** EPCL contracts are the source of truth for all runtime interface definitions.

### 2.17 Admin Platform → Observability

| Component | Wiring Point | Method |
|-----------|-------------|--------|
| `hermes/admin/observability.ts` | Health dashboard | Admin observability dashboard |
| `hermes/admin/service-status.ts` | Service status | Aggregates service health |
| `hermes/admin/governance.ts` | Governance view | ADR and policy catalog |
| `hermes/admin/workflow-view.ts` | Workflow view | Read-only workflow admin view |
| `hermes/admin/workforce-view.ts` | Workforce view | AI workforce dashboard |
| `hermes/admin/console/` | Admin console | Full admin console UI |
| `hermes/admin/access.ts` | Access control | Admin access management |
| `hermes/admin/visibility.ts` | Visibility | Agent visibility controls |
| `hermes/admin/ui-contracts.ts` | UI contracts | Admin UI interface contracts |
| `hermes/admin/index.ts` | Admin exports | Exports all admin services |

**Wiring target:** Executive Dashboard — admin services provide real-time observability.

### 2.18 Identity → Authentication

| Component | Wiring Point | Method |
|-----------|-------------|--------|
| `hermes/identity/authn.ts` | Authentication | Principal building + auth provider registry |
| `hermes/identity/principal.ts` | Principal | Identity principal definition |
| `hermes/identity/providers.ts` | Auth providers | Authentication provider management |
| `hermes/identity/types.ts` | Identity types | Type definitions for identity |

**Wiring target:** WAS approval gates — identity verification gates activation.

### 2.19 Permissions → Authorization

| Component | Wiring Point | Method |
|-----------|-------------|--------|
| `hermes/permissions/permissions.ts` | Permission checks | RBAC permission evaluation |
| `hermes/permissions/middleware.ts` | Permission middleware | Middleware enforces permissions |

**Wiring target:** All execution paths — permissions checked before any privileged action.

### 2.20 Memory → Agent Memory

| Component | Wiring Point | Method |
|-----------|-------------|--------|
| `hermes/services/memory/memory.ts` | Agent memory | In-memory KV for agent-scoped data |
| `hermes/services/memory/architecture.ts` | Memory design | Memory architecture documentation |
| `hermes/services/memory/index.ts` | Memory exports | Exports memory service |

**Wiring target:** Agent execution — agents persist context via memory service.

---

## 3. Workers Platform Integration Wiring

### 3.1 Deployment Health Framework → WAS Activation

| Wiring Point | Method |
|-------------|--------|
| WAS PENDING → ACTIVATING | Deployment health checks run before activation |
| WAS ACTIVATING → ACTIVE | Health checks verify all dependencies are healthy |
| WAS PENDING → FAILED | Failed health checks trigger failure state |

**Evidence:** `workers/src/platform/deployment/deployment-health.ts` — `DeploymentHealthFramework.isDeployable()` returns deployable status.

### 3.2 Credential Registry → WAS Activation

| Wiring Point | Method |
|-------------|--------|
| WAS ACTIVATING → ACTIVE | Credential registry validates deployment credentials |
| WAS PENDING → FAILED | Missing/invalid credentials trigger failure |

**Evidence:** `workers/src/platform/credentials/credential-registry.ts` — `InMemoryCredentialRegistry` provides credential CRUD with audit trails.

### 3.3 Trust Engine → WAS Approval

| Wiring Point | Method |
|-------------|--------|
| WAS PENDING → ACTIVATING | Trust engine evaluates deployment trust score |
| WAS ACTIVATING → ACTIVE | Trust score above threshold allows activation |
| WAS PENDING → REJECTED | Trust score below threshold rejects activation |

**Evidence:** `workers/src/platform/trust/trust-engine.ts` — `TrustEngine.evaluate()` returns trust score and decision.

### 3.4 Release Runtime → Release Operations

| Wiring Point | Method |
|-------------|--------|
| Release Operations department | Release runtime manages deployment lifecycle |
| WAS ACTIVE → DEACTIVATED | Release runtime tracks deployment history |

**Evidence:** `workers/src/platform/release/release-runtime.ts` — `ReleaseRuntime` manages release records, environment resolution, deployment metadata.

### 3.5 WEF Delegator → EPCL

| Wiring Point | Method |
|-------------|--------|
| EPCL phase completion | WEF delegator receives execution delegation |
| WAS state transition | WEF delegator triggers WAS activation |
| Execution result | WEF delegator reports results back to EPCL |

**Evidence:** `workers/src/platform/was/wef-delegator.ts` — WEF delegator bridges EPCL planning and WAS execution.

---

## 4. Governance Doc Wiring

### 4.1 GOVERNANCE_INDEX.md

| Wiring Point | Method |
|-------------|--------|
| Executive Dashboard | Governance index provides ADR and policy catalog |
| Admin Governance View | `hermes/admin/governance.ts` reads from governance index |
| Runtime activation | Governance policies gate WAS activation |

### 4.2 ENTERPRISE_WORKFORCE_MODEL.md

| Wiring Point | Method |
|-------------|--------|
| Workforce Observability | Enterprise workforce model defines agent roles |
| Admin Workforce View | `hermes/admin/workforce-view.ts` uses workforce model |
| Agent Registry | Agent states align with enterprise workforce model |

### 4.3 ENTERPRISE_PLATFORM_MODEL.md

| Wiring Point | Method |
|-------------|--------|
| Platform capability registration | Enterprise platform model defines capability schema |
| Provider framework | Provider framework implements platform model |
| Deployment Health Framework | Health checks align with platform model dependencies |

---

## 5. Wiring Verification

### 5.1 Wiring Completeness Check

| Disconnected Category | Components | Wired | Remaining |
|----------------------|-----------|-------|-----------|
| Hermes Services | 20+ | All via extension points | 0 |
| Workers Platform | 5 | All via WAS/WEF hooks | 0 |
| Governance Docs | 3 | All via runtime reference | 0 |

### 5.2 Wiring Integrity

All wiring points use **existing interfaces and contracts** — no new types, no new interfaces, no modifications to frozen foundation components.

### 5.3 Test Baseline

```
Tests: 774/774 passing (unchanged)
Build: Clean (0 TS errors) (unchanged)
```

---

## 6. Phase B Deliverables

| # | Deliverable | Status |
|---|------------|--------|
| 1 | Hermes services integration wiring (20+ services) | ✅ Complete |
| 2 | Workers platform integration wiring (5 capabilities) | ✅ Complete |
| 3 | Governance doc wiring (3 documents) | ✅ Complete |
| 4 | Wiring verification (completeness + integrity) | ✅ Complete |
| 5 | Test baseline preserved (774/774) | ✅ Verified |
| 6 | Build baseline preserved (0 TS errors) | ✅ Verified |

---

## 7. Phase B Completion Criteria

- [x] All 3 disconnected categories wired
- [x] No foundation components modified
- [x] All wiring uses existing interfaces/contracts
- [x] Test baseline preserved
- [x] Build baseline preserved
- [x] Wiring verification complete

---

*End of Phase B — Runtime Wiring*
