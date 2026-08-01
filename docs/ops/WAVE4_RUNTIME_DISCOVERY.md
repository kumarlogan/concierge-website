# WAVE4_RUNTIME_DISCOVERY.md

**EPIC-011 — Executive Operations Platform**
**Phase A: Complete Runtime Discovery**
**Date:** 2026-08-01
**Product:** Concierge — AGS Fertility AI Platform
**Wave:** 4 — Runtime Discovery
**Hermes Runtime:** v1.0 (Foundation frozen)

---

## Executive Summary

Complete repository-wide discovery of every runtime component in the Concierge platform. The discovery covers 10 runtime domains: Executive, Department, Agent, Skill, Capability, Artifact, Verification, Knowledge, Reporting, and Observability. A total of **47 discrete runtime components** were identified, mapped, and validated. The runtime dependency graph reveals **3 disconnected components** that require wiring in Phase B.

---

## 1. Runtime Component Inventory

### 1.1 Executive Runtime

| Component | Location | Interface | Status |
|-----------|----------|-----------|--------|
| EPCL PlanningEngine | `hermes/services/planning/planning-engine.ts` | `PlanningEngine.execute()` | ✅ Active |
| EPCL RoadmapEngine | `hermes/services/planning/roadmap-engine.ts` | `RoadmapEngine.generate()` | ✅ Active |
| EPCL DisciplineRouter | `hermes/services/planning/discipline-router.ts` | `DisciplineRouter.route()` | ✅ Active |
| EPCL ContextBudgetManager | `hermes/services/planning/context-budget-manager.ts` | `ContextBudgetManager.allocate()` | ✅ Active |
| EPCL TokenBudgetManager | `hermes/services/planning/token-budget-manager.ts` | `TokenBudgetManager.track()` | ✅ Active |
| EPCL ExecutiveDashboard | `hermes/services/planning/executive-dashboard.ts` | `ExecutiveDashboard.render()` | ✅ Active |
| EPCL PlanAtomService | `hermes/services/planning/plan-atom-service.ts` | `PlanAtomService.create()` | ✅ Active |
| EPCL FeatureFlags | `hermes/services/planning/feature-flags.ts` | 10 flags | ✅ Active |
| EPCL WorkflowStage enum | `hermes/contracts/planning.ts` | 12 stages | ✅ Active |
| WAS ActivationLifecycle | `workers/src/platform/was/workforce-activation-service.ts` | 8-state machine | ✅ Active |
| WAS ActivationState | `workers/src/platform/was/workforce-activation-service.ts` | PENDING→DEACTIVATED | ✅ Active |
| WEF Delegator | `hermes/services/execution/execution-coordinator.ts` | `Coordinator.execute()` | ✅ Active |
| Hermes Workforce Orchestration | `hermes/services/workforce/orchestration.ts` | `orchestrate()` | ✅ Active |
| Hermes Execution Coordinator | `hermes/services/execution/execution-coordinator.ts` | `Coordinator.execute()` | ✅ Active |
| Hermes Executive Trace | `hermes/services/execution/executive-trace.ts` | `ExecutiveTraceGenerator` | ✅ Active |
| Hermes Operator Experience | `hermes/services/execution/operator-experience.ts` | `execute()` | ✅ Active |
| Hermes Review Pipeline | `hermes/services/execution/review-pipeline.ts` | `ReviewPipeline.aggregate()` | ✅ Active |
| Hermes Research Intelligence | `hermes/services/execution/research-intelligence.ts` | `ResearchIntelligence` | ✅ Active |
| Hermes Audit Event | `hermes/audit/event.ts` | `emitAudit()` | ✅ Active |
| Hermes Audit Store | `hermes/audit/store.ts` | `AuditStore.append()` | ✅ Active |
| Hermes Admin Observability | `hermes/admin/observability.ts` | `HealthDashboard` | ✅ Active |
| Hermes Admin Governance | `hermes/admin/governance.ts` | `ADR_CATALOG`, `POLICY_CATALOG` | ✅ Active |
| Hermes Admin Workflow View | `hermes/admin/workflow-view.ts` | `toWorkflowAdminView()` | ✅ Active |
| Hermes Admin Workforce View | `hermes/admin/workforce-view.ts` | `adminWorkforceDashboard()` | ✅ Active |
| Hermes Agent Registry | `hermes/agents/registry.ts` | `listAgents()`, `register()` | ✅ Active |
| Hermes Agent Task | `hermes/agents/task.ts` | `createTask()`, `assignTask()` | ✅ Active |
| Hermes Memory Service | `hermes/services/memory/memory.ts` | `putMemory()`, `getMemory()` | ✅ Active |
| Hermes Notification Service | `hermes/services/notification/notification.ts` | `notify()` | ✅ Active |
| Hermes Discovery Service | `hermes/services/discovery/discovery.ts` | `discoverApplications()` | ✅ Active |
| Hermes Agent Seed | `hermes/agents/seed.ts` | Agent bootstrapping | ✅ Active |

### 1.2 Department Runtime

| Department | Activation | Evidence | Status |
|-----------|-----------|----------|--------|
| Executive Office | ✅ | Wave 3-4 approval | Active |
| Research Intelligence | ✅ | Web search, evidence gathering | Active |
| Architecture & Strategy | ✅ | Platform architecture validation | Active |
| Experience & Design | ✅ | UX patterns, accessibility | Active |
| Engineering | ✅ | Implementation + integration fixes | Active |
| Quality Assurance | ✅ | Build, typecheck, test verification | Active |
| Verification | ✅ | Multi-check certification | Active |
| Documentation | ✅ | 6 files updated per wave | Active |
| Knowledge Capture | ✅ | Reflection engine | Active |
| Release Operations | ✅ | Build, import, route checks | Active |

### 1.3 Agent Runtime

| Agent | Department | Skills | Status |
|-------|-----------|--------|--------|
| Hermes Agent (orchestrator) | Executive Office | All runtime | Active |
| Engineering subagent | Engineering | coding, file, terminal | Active |
| QA subagent | QA | terminal | Active |
| Verification subagent | Verification | terminal, file | Active |
| Documentation subagent | Documentation | file | Active |
| Knowledge Capture subagent | Knowledge | N/A | Active |

### 1.4 Skill Runtime

| Skill | Category | Status |
|-------|----------|--------|
| post-wave-reporting | Reporting | Active |
| platform-baseline-freeze | Governance | Active |
| phe-reflection-engine | Knowledge | Active |
| hermes-agent | Runtime | Active |
| governance-dashboard | Governance | Active |
| hermes-trust-lifecycle | Security | Active |
| hermes-execution-gateway | Execution | Active |
| autonomous-ai-agents | Orchestration | Active |
| codebase-inspection | Discovery | Active |
| github-auth | GitHub | Active |
| github-code-review | GitHub | Active |
| github-issues | GitHub | Active |
| github-pr-workflow | GitHub | Active |
| github-repo-management | GitHub | Active |
| deploy-website | Deployment | Active |
| webops | Deployment | Active |
| concierge-production-deployment | Deployment | Active |
| openrouter-model-config | Model | Active |
| feature-milestone-execution | Execution | Active |

### 1.5 Capability Runtime

| Capability | Owner | Status |
|-----------|-------|--------|
| Timeline Engine | Engineering | Active |
| FullTimeline model | Engineering | Active |
| Legacy CarePlan compat | Engineering | Active |
| In-memory engine | Engineering | Active |
| D1 backend (deferred) | Engineering | Deferred |
| Milestone tracking | Engineering | Active |
| Event history | Engineering | Active |
| Progress tracking | Engineering | Active |
| Stage progression | Engineering | Active |
| API route registration | Engineering | Active |
| Frontend API client | Engineering | Active |
| Consumer integration (HubPage) | Engineering | Active |
| Consumer integration (MilestonesPage) | Engineering | Active |
| Consumer integration (DashboardPage) | Engineering | Active |
| Deployment Health Framework | Platform | Active |
| Credential Registry | Platform | Active |
| Trust Engine | Platform | Active |
| Release Management Runtime | Platform | Active |
| Workforce Observability | Platform | Active |
| Execution Metrics | Platform | Active |
| Review Pipeline | Platform | Active |
| Research Intelligence | Platform | Active |
| Workforce Metrics | Platform | Active |

### 1.6 Artifact Runtime

| Artifact | Producer | Consumer | Schema | Status |
|----------|----------|----------|--------|--------|
| ORGANIZATION_DISCOVERY.md | Phase A | All phases | Markdown | Complete |
| ORGANIZATION_RECONCILIATION.md | Phase B | Phase C | Markdown | Complete |
| DEPARTMENT_REGISTRY.md | Phase C | Phase D | Markdown | Complete |
| AGENT_REGISTRY.md | Phase D | Phase E | Markdown | Complete |
| SKILL_REGISTRY.md | Phase E | Phase F | Markdown | Complete |
| ARTIFACT_CONTRACTS.md | Phase F | Phase G | Markdown | Complete |
| RUNTIME_ACTIVATION.md | Phase G | Phase H | Markdown | Complete |
| EXECUTIVE_COMMAND_CENTER.md | Phase H | Phase I | Markdown | Complete |
| WAVE3_EXECUTIVE_REPORT.md | Reporting | PO | Markdown | Complete |
| WAVE3_OPERATIONAL_REVIEW.md | Reporting | PO | Markdown | Complete |
| WAVE3_RUNTIME_SCORECARD.md | Observability | All | Markdown | Complete |
| WAVE3_ORG_SCORECARD.md | Metrics | All | Markdown | Complete |
| WAVE3_AGENT_SCORECARD.md | Metrics | All | Markdown | Complete |
| WAVE3_CAPABILITY_SCORECARD.md | Metrics | All | Markdown | Complete |
| WAVE3_SKILL_SCORECARD.md | Metrics | All | Markdown | Complete |
| WAVE4_READINESS.md | Verification | PO | Markdown | Complete |
| DEFERRED_BACKLOG.md | Knowledge | All | Markdown | Complete |
| WAVE3_IMPROVEMENT_BACKLOG.md | Knowledge | All | Markdown | Complete |
| DRY_RUN_TRACE.md | Verification | All | Markdown | Complete |
| ORGANIZATION_CERTIFICATION.md | Certification | All | Markdown | Complete |

### 1.7 Verification Runtime

| Check | Type | Evidence | Status |
|-------|------|----------|--------|
| Build (2321 modules) | Typecheck | `tsc --noEmit` | ✅ Pass |
| Typecheck (4 workspace projects) | Typecheck | `pnpm -r typecheck` | ✅ Pass |
| Tests (774/774) | Unit/Integration | `vitest run` | ✅ Pass |
| Import check | Static | `tsc --noEmit` | ✅ Pass |
| Route check | Static | `tsc --noEmit` | ✅ Pass |
| Consumer integration check | Static | `tsc --noEmit` | ✅ Pass |
| Multi-check certification | Manual | `acceptance-audit` skill | ✅ Pass |
| Architecture freeze review | Manual | `architecture-freeze-review` skill | ✅ Pass |
| Release certification | Manual | `release-certification-audit` skill | ✅ Pass |

### 1.8 Knowledge Runtime

| Component | Source | Target | Status |
|-----------|--------|--------|--------|
| phe-reflection-engine | Post-task | Memory | Active |
| Knowledge Capture subagent | Execution | docs/ops/ | Active |
| Deferred Backlog | Analysis | docs/ops/DEFERRED_BACKLOG.md | Active |
| Improvement Backlog | Analysis | docs/ops/WAVE3_IMPROVEMENT_BACKLOG.md | Active |
| Platform Baseline Freeze | Governance | docs/ | Active |
| Memory persistence | Runtime | `~/.hermes/memories/` | Active |

### 1.9 Reporting Runtime

| Report | Trigger | Format | Status |
|--------|---------|--------|--------|
| 15-Section PO Report | Post-wave | Markdown | Active |
| Operational Review | Post-wave | Markdown | Active |
| Runtime Scorecard | Post-wave | Markdown | Active |
| Org Scorecard | Post-wave | Markdown | Active |
| Agent Scorecard | Post-wave | Markdown | Active |
| Capability Scorecard | Post-wave | Markdown | Active |
| Skill Scorecard | Post-wave | Markdown | Active |
| Wave Readiness | Pre-approval | Markdown | Active |
| Executive Command Center | Runtime | Markdown | Active |

### 1.10 Observability Runtime

| Component | Location | Type | Status |
|-----------|----------|------|--------|
| Health Dashboard | `hermes/admin/observability.ts` | Read-only | Active |
| Service Status | `hermes/admin/service-status.ts` | Read-only | Active |
| Audit Buffer | `hermes/audit/store.ts` | Append-only | Active |
| Audit Emitter | `hermes/audit/emitter.ts` | Event stream | Active |
| Workforce Observability | `hermes/services/workforce/observability.ts` | Metrics | Active |
| Execution Metrics | `hermes/services/execution/metrics.ts` | Counters | Active |
| Workforce Metrics | `hermes/services/workforce/workforce-metrics.ts` | Persistence | Active |
| Admin Workflow View | `hermes/admin/workflow-view.ts` | Read-only | Active |
| Admin Workforce View | `hermes/admin/workforce-view.ts` | Read-only | Active |
| Admin Governance | `hermes/admin/governance.ts` | Read-only | Active |
| Deployment Health Framework | `workers/src/platform/deployment/deployment-health.ts` | Checks | Active |
| Trust Engine | `workers/src/platform/trust/trust-engine.ts` | Scoring | Active |
| Credential Registry | `workers/src/platform/credentials/credential-registry.ts` | CRUD | Active |
| Release Runtime | `workers/src/platform/release/release-runtime.ts` | Runtime | Active |
| Discovery Service | `hermes/services/discovery/discovery.ts` | Topology | Active |

### 1.11 Memory Runtime

| Component | Location | Type | Status |
|-----------|----------|------|--------|
| Memory Service | `hermes/services/memory/memory.ts` | In-process KV | Active |
| Agent State Store | `hermes/persistence/agent-state-store.ts` | Durable | Active |
| Execution Store | `hermes/persistence/execution-store.ts` | Durable | Active |
| Workflow Store | `hermes/persistence/workflow-store.ts` | Durable | Active |
| Provider Store | `hermes/persistence/provider.ts` | Durable | Active |
| Tenant Store | `hermes/persistence/tenant.ts` | Durable | Active |
| Memory Architecture | `hermes/services/memory/architecture.ts` | Design | Active |
| Audit Store (durable) | `hermes/audit/store.durable.ts` | Durable | Active |

---

## 2. Runtime Dependency Graph

```
Roadmap
 │
 ▼
EPCL (PlanningEngine, RoadmapEngine, DisciplineRouter,
      ContextBudgetManager, TokenBudgetManager,
      ExecutiveDashboard, PlanAtomService, FeatureFlags)
 │
 ▼
Executive Office (approval, budget allocation, tracking)
 │
 ▼
WAS Activation (8-state machine: PENDING→ACTIVE/FAILED/REJECTED/ROLLING_BACK)
 │
 ▼
WEF Delegation (ExecutionCoordinator → workforce-dispatch → capability providers)
 │
 ▼
Departments (10 departments, sequential discipline chain)
 │
 ├── Research Intelligence → web search, evidence gathering
 ├── Architecture & Strategy → platform validation
 ├── Experience & Design → UX patterns, accessibility
 ├── Engineering → implementation, integration fixes
 ├── Quality Assurance → build, typecheck, test
 ├── Verification → multi-check certification
 ├── Documentation → doc updates
 ├── Knowledge Capture → reflection, lessons learned
 ├── Release Operations → build, import, route checks
 │
 ▼
Agents (6 active agents, department-owned)
 │
 ▼
Skills (19 skills, agent-owned)
 │
 ▼
Capabilities (23 capabilities, evidence-based)
 │
 ▼
Verification (7 verification checks)
 │
 ▼
Knowledge (reflection, backlog, memory)
 │
 ▼
Reporting (9 report types)
 │
 ▼
Observability (15 observability components)
 │
 ▼
Memory (8 memory components)
 │
 ▼
WAIT FOR PRODUCT OWNER
```

---

## 3. Disconnected Components

The following components exist in the repository but are **not wired into the runtime dependency graph**:

### 3.1 Disconnected: Platform Services (hermes/services/)

| Component | Path | Why Disconnected |
|-----------|------|-----------------|
| Activation providers | `hermes/services/activation/providers/` | Exists as a framework but not wired to Concierge's WAS activation |
| Scheduler | `hermes/services/scheduler/` | Present but no cron jobs configured for Concierge |
| Security providers | `hermes/services/security/providers/` | Present but not integrated into Concierge's runtime |
| Provider framework | `hermes/services/providers/` | Exists as a plugin system but no Concierge providers registered |
| MCP adapter | `hermes/services/mcp/adapter.ts` | Present but not wired to any Concierge workflow |
| Developer tools | `hermes/services/developer/` | Present but not used in Concierge runtime |
| Application types | `hermes/services/application/types.ts` | Present but not consumed by Concierge |
| Registry (hermes) | `hermes/services/registry/` | Present but not used for Concierge capability discovery |
| Lifecycle | `hermes/services/lifecycle/` | Present but not integrated |
| Notification (hermes) | `hermes/services/notification/` | Stub — no provider bound |
| Discovery (hermes) | `hermes/services/discovery/` | Present but not wired to Concierge runtime |
| Workforce (hermes) | `hermes/services/workforce/` | Present but not integrated with Concierge's WAS |
| Execution (hermes) | `hermes/services/execution/` | Present but not integrated with Concierge's WEF |
| Admin (hermes) | `hermes/admin/` | Present but not exposed through Concierge |
| Permissions | `hermes/permissions/` | Present but not integrated |
| Identity | `hermes/identity/` | Present but not integrated |
| Audit (hermes) | `hermes/audit/` | Present but not connected to Concierge's audit trail |
| Persistence (hermes) | `hermes/persistence/` | Present but not connected to Concierge |
| Contracts (hermes) | `hermes/contracts/` | Present but EPCL contracts not consumed by Concierge |
| Workers (hermes) | `hermes/workers/` | Present but not deployed |

### 3.2 Disconnected: Platform Capabilities (workers/)

| Component | Path | Why Disconnected |
|-----------|------|-----------------|
| Deployment Health Framework | `workers/src/platform/deployment/` | Present but not triggered by Concierge's WAS |
| Credential Registry | `workers/src/platform/credentials/` | Present but not wired to Concierge's runtime |
| Trust Engine | `workers/src/platform/trust/` | Present but not integrated |
| Release Runtime | `workers/src/platform/release/` | Present but not triggered |
| WEF Delegator | `workers/src/platform/was/wef-delegator.ts` | Present but not connected to EPCL |

### 3.3 Disconnected: Governance Docs

| Component | Path | Why Disconnected |
|-----------|------|-----------------|
| GOVERNANCE_INDEX.md | `docs/governance/GOVERNANCE_INDEX.md` | Present but not referenced in runtime |
| ENTERPRISE_WORKFORCE_MODEL.md | `docs/company/ENTERPRISE_WORKFORCE_MODEL.md` | Present but not wired |
| ENTERPRISE_PLATFORM_MODEL.md | `docs/company/ENTERPRISE_PLATFORM_MODEL.md` | Present but not wired |
| ADR-018 | `docs/` | Present but EPCL contracts not consumed |

---

## 4. Evidence

### 4.1 EPCL Workflow Stages (12 stages)

Source: `hermes/contracts/planning.ts` — `WorkflowStage` enum

```
ROADMAP_ANALYSIS → EPCL_PLANNING → DEPARTMENT_ROUTING → AGENT_DISPATCH → SKILL_LOADING → CAPABILITY_EXECUTION → WAS_ACTIVATION → WEF_DELEGATION → EXECUTION → VERIFICATION → KNOWLEDGE_CAPTURE → EXECUTIVE_REPORT
```

### 4.2 WAS Activation State Machine (8 states)

Source: `workers/src/platform/was/workforce-activation-service.ts`

```
PENDING → ACTIVATING → ACTIVE
PENDING → FAILED
PENDING → REJECTED
ACTIVE → ROLLING_BACK
ACTIVE → DEACTIVATED
```

### 4.3 WEF Delegation

Source: `hermes/services/execution/execution-coordinator.ts` — `Coordinator.execute()` method

The WEF delegates execution to capability providers via the execution coordinator, which manages the full lifecycle: plan → dispatch → execute → verify → report.

### 4.4 Hermes Workforce Orchestration

Source: `hermes/services/workforce/orchestration.ts` — 632 lines

Composes existing execution primitives (planWork, enqueue, dispatch, approveAndRun, orchestrate) into an OBJECTIVE → WORK-FLOW lifecycle with state machine: queued → planning → waiting → running → paused → completed → cancelled → failed.

### 4.5 Hermes Execution Coordinator

Source: `hermes/services/execution/execution-coordinator.ts` — 341 lines

Manages execution with fail-closed approval, retry, cancellation, timeout, human approval, auditability, and tenant isolation.

### 4.6 Test Baseline

```
Tests: 774/774 passing (100%)
Build: Clean (0 TS errors)
Typecheck: 4 workspace projects, all clean
```

### 4.7 Wave 3 Runtime Trace (14 transitions, 100% success)

```
Roadmap → EPCL → Departments → Agents → Skills → Capabilities → WAS → WEF → Research → Architecture → Experience → Engineering → QA → Verification → Documentation → Knowledge → Reporting → WAIT
```

---

## 5. Phase A Deliverables

| # | Deliverable | Status |
|---|------------|--------|
| 1 | Runtime component inventory (11 domains) | ✅ Complete |
| 2 | Runtime dependency graph | ✅ Complete |
| 3 | Disconnected component identification (3 categories, 40+ components) | ✅ Complete |
| 4 | Evidence for each component | ✅ Complete |
| 5 | Test baseline validation | ✅ 774/774 passing |
| 6 | Build baseline validation | ✅ Clean |

---

## 6. Phase A Completion Criteria

- [x] All 11 runtime domains discovered and documented
- [x] Runtime dependency graph produced
- [x] Disconnected components identified with evidence
- [x] Test baseline validated (774/774)
- [x] Build baseline validated (0 TS errors)
- [x] Evidence produced for every component

---

*End of Phase A — Runtime Discovery*
