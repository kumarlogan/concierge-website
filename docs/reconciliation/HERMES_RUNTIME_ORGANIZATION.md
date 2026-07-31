# HERMES Runtime Organization

> **EPIC-008 — Phase E**
> Defines the ten runtime layers of the Hermes Platform. Every component belongs to exactly one layer. Every layer has a clear owner, purpose, responsibilities, and lifecycle. The layers form a directed execution pipeline — no layer executes work it does not own.

---

## Layer Architecture

```
┌─────────────────────────────────────────────────────┐
│          10. GOVERNANCE LAYER                         │
│  Constitutional rules, compliance, audit trail        │
├─────────────────────────────────────────────────────┤
│          9. OBSERVABILITY LAYER                        │
│  Telemetry, events, metrics, dashboards               │
├─────────────────────────────────────────────────────┤
│          8. DEPLOYMENT LAYER                            │
│  Release pipeline, credential mgmt, health checks      │
├─────────────────────────────────────────────────────┤
│          7. OPERATIONS LAYER                            │
│  Memory, identity, permissions, security, scheduler    │
├─────────────────────────────────────────────────────┤
│          6. KNOWLEDGE LAYER                             │
│  Knowledge capture, skill management, learning          │
├─────────────────────────────────────────────────────┤
│          5. VERIFICATION LAYER                          │
│  Constitutional validation, gate checks, verification │
├─────────────────────────────────────────────────────┤
│          4. EXECUTION LAYER                             │
│  WEF — workforce execution, operational intelligence   │
├─────────────────────────────────────────────────────┤
│          3. ACTIVATION LAYER                            │
│  WAS — workforce activation service, state machine     │
├─────────────────────────────────────────────────────┤
│          2. PLANNING LAYER                              │
│  EPCL — roadmap, capability, discipline, budget        │
├───────────────┬─────────────────────────────────────┤
│    1. EXECUTIVE LAYER                                 │
│  Entry point, orchestration, executive reporting      │
└─────────────────────────────────────────────────────┘
```

---

## 1. Executive Layer

### Purpose
The Executive Layer is the single entry point for all platform execution. It receives approved objectives from the Product Owner, orchestrates the full execution lifecycle through the planning → activation → execution pipeline, and delivers executive reports on completion. No work reaches the platform without passing through this layer.

### Responsibilities
- Receive and validate approved Product Owner objectives
- Orchestrate the 12-stage EPCL Executive Planning Workflow
- Generate executive reports and summaries
- Coordinate recovery from failed executions
- Maintain active plan registry

### Owner
**Hermes Runtime — Executive Entry Point**
Implemented by: `ExecutivePlanningWorkflow` (`workers/src/platform/epcl/executive-workflow.ts`)

### Inputs
| Input | Source | Format |
|-------|--------|--------|
| Approved objective | Product Owner | Markdown roadmap / objective string |
| EPCL config | Platform configuration | `EPCLConfig` |
| Recovery state | Planning Layer | `RecoverySnapshot` |

### Outputs
| Output | Destination | Format |
|--------|-------------|--------|
| Execution plan | Activation Layer | `ExecutionPlan` |
| Executive report | Knowledge Layer / Product Owner | `ExecutiveReport` |
| Stage results | Observability Layer | `StageResult[]` |
| Recovery snapshots | Operations Layer | `RecoverySnapshot` |

### Dependencies
- Layer 2 (Planning) — for all planning, routing, and budget services
- Layer 3 (Activation) — for WAS activation pipeline
- Layer 9 (Observability) — for event emission
- Layer 10 (Governance) — for flag checks and compliance

### Failure Behaviour
- Any stage failure causes immediate fail-closed: the plan is NOT activated
- Recovery manager creates snapshots before each state transition
- On unrecoverable failure, plan status transitions to `FAILED` with a structured error
- The executive summary captures the point of failure for human review

### Activation Conditions
- `ENABLE_EXECUTIVE_WORKFLOW` feature flag must be enabled
- `ENABLE_AUTONOMOUS_EXECUTION` feature flag must be enabled for WAS delegation
- Product Owner must supply an approved objective or roadmap

### Runtime Lifecycle
```
IDLE → PROCESSING (12 stages) → COMPLETED / FAILED → IDLE
```
The layer is stateless between activations. Active plans are tracked in `activeWorkflows: Map<string, ExecutionPlan>`.

---

## 2. Planning Layer

### Purpose
The Planning Layer provides all planning, analysis, routing, and budget management services consumed by the Executive Layer. It is a pure planning layer — it never executes work directly. It determines what needs to be done, by which discipline, using which capabilities, within which resource constraints.

### Sub-services

| Service | Module | Purpose |
|---------|--------|---------|
| `RoadmapEngine` | `epcl/roadmap-engine.ts` | Parse, register, and analyze roadmap markdown documents |
| `CapabilitySelector` | `epcl/capability-selector.ts` | Deterministic registry lookup for capabilities |
| `DisciplineSelector` | `epcl/discipline-selector.ts` | Deterministic discipline-to-epic mapping |
| `ExecutionPlanner` | `epcl/execution-planner.ts` | Create execution plans and batches from roadmaps |
| `ApprovalManager` | `epcl/approval-manager.ts` | Evaluate approval requirements for plans and batches |
| `ContextBudgetManager` | `epcl/context-budget-manager.ts` | Track and enforce context window budgets |
| `TokenBudgetManager` | `epcl/token-budget-manager.ts` | Track and enforce token budgets |
| `RecoveryManager` | `epcl/recovery-manager.ts` | Create snapshots, manage recovery checkpoints |

### Owner
**Hermes Runtime — Planning Layer**
Implementation domain: `workers/src/platform/epcl/`

### Inputs
| Input | Source | Format |
|-------|--------|--------|
| Roadmap / objective | Executive Layer | Markdown `string` |
| Capability registrations | Capability Registry | `CapabilityEntry[]` |
| Discipline mappings | Hardcoded mapping | `DISCIPLINE_CAPABILITY_MAP` |

### Outputs
| Output | Destination | Format |
|--------|-------------|--------|
| Execution plan | Activation Layer | `ExecutionPlan` |
| Capability selections | Activation Layer | `CapabilitySelection[]` |
| Discipline selections | Activation Layer | `DisciplineSelection[]` |
| Budget allocations | Activation Layer | `TokenBudget`, `ContextBudget` |
| Recovery snapshots | Operations Layer | `RecoverySnapshot` |

### Dependencies
- Feature flags (`epcl/feature-flags.ts`) — all services check flags before acting
- Layer 7 (Operations) — persistence for recovery snapshots
- Layer 10 (Governance) — approval rules

### Failure Behaviour
- Planning errors return structured `StageResult` with `ok: false`
- `ExecutionPlannerError`, `CapabilitySelectionError`, `DisciplineSelectionError` provide specific context
- Failures propagate up to Executive Layer for fail-closed handling
- Approval rejection throws immediately — no partial planning

### Activation Conditions
- Services are stateless singletons; active when Executive Layer calls them
- Feature flags may gate individual services

### Runtime Lifecycle
```
READY → (called by Executive Layer) → PROCESSING → (returns) → READY
```
Instantiated via singleton pattern. No persistent state between calls.

---

## 3. Activation Layer (WAS)

### Purpose
The Activation Layer implements the Workforce Activation Service (WAS) — the activation boundary between EPCL (planning) and WEF (execution). WAS enforces constitutional validation, manages the activation lifecycle state machine, delegates batches to WEF, routes verification, triggers knowledge capture, and generates executive status reports. No plan reaches execution without passing through WAS activation.

### Sub-services

| Service | Module | Purpose |
|---------|--------|---------|
| `WorkforceActivationService` | `was/workforce-activation-service.ts` | Main orchestrator — activate → delegate → complete |
| `ExecutionStateManager` | `was/execution-state-manager.ts` | Activation state machine transitions |
| `PlanConsumer` | `was/plan-consumer.ts` | Validate plan is APPROVED, check idempotency |
| `ConstitutionalValidator` | `was/constitutional-validator.ts` | Run constitutional validation gates |
| `WEFDelegator` | `was/wef-delegator.ts` | Delegate batches to WEF for execution |
| `VerificationRouter` | `was/verification-router.ts` | Route verification of delegation results |
| `KnowledgeCaptureTrigger` | `was/knowledge-capture-trigger.ts` | Trigger knowledge capture on batch completion |
| `ExecutiveStatusUpdater` | `was/executive-status-updater.ts` | Generate activation status reports |
| `WASObservability` | `was/was-observability.ts` | Emit WAS lifecycle events |
| `WASPersistence` | `was/was-persistence.ts` | Persist activation state to D1 |
| `WASRecovery` | `was/was-recovery.ts` | Recover activations after restart |
| `WASDuplicateProtection` | `was/was-duplicate-protection.ts` | Detect and block duplicate activations |
| `WASGracefulDegradation` | `was/was-graceful-degradation.ts` | Fall back to in-memory when D1 is unavailable |

### Owner
**Hermes Runtime — Activation Layer**
Implementation domain: `workers/src/platform/was/`

### Inputs
| Input | Source | Format |
|-------|--------|--------|
| Execution plan | Planning Layer | `ExecutionPlan` |
| EPCL config | Executive Layer | `Partial<EPCLConfig>` |
| WEF delegation results | Execution Layer | `WEFDelegationResult` |

### Outputs
| Output | Destination | Format |
|--------|-------------|--------|
| Activation lifecycle | Executive Layer | `ActivationLifecycle` |
| Batch delegation requests | Execution Layer | `WEFDelegationRequest[]` |
| Verification results | Verification Layer | `VerificationResult` |
| Activation status report | Executive/Governance | `ActivationStatusReport` |
| Knowledge capture triggers | Knowledge Layer | (side effect) |

### Dependencies
- Layer 2 (Planning) — consumes EPCL plan types
- Layer 4 (Execution) — delegations go to WEF
- Layer 5 (Verification) — `VerificationRouter` validates results
- Layer 6 (Knowledge) — `KnowledgeCaptureTrigger` fires captures
- Layer 9 (Observability) — `WASObservability` emits events
- Layer 8 (Deployment) — persistence backend (D1)

### Failure Behaviour
- Fail-closed by default: constitutional validation gate failure → `REJECTED` terminal state
- State transition failures → `FAILED` terminal state with structured error
- Knowledge capture failure is non-fatal (logged as warning)
- Duplicate detection prevents same-plan re-activation
- Recovery marks in-progress activations as FAILED (safe default)

### Activation Conditions
- Plan status must be `APPROVED`
- Feature flags must enable autonomous execution
- Constitutional validation must pass all gates
- Max concurrent activations limit must not be exceeded

### Runtime Lifecycle
```
           ┌──────────────────────────────────────┐
           │              ACTIVATION                 │
           │                                        │
PENDING → VALIDATING → ACTIVATING → ACTIVE → DEACTIVATING → DEACTIVATED
  │                        │         │         │
  └────→ FAILED ←──────────┘         │         └────→ FAILED
                                      │
                                REJECTED ←─── (from VALIDATING)
```

---

## 4. Execution Layer (WEF)

### Purpose
The Execution Layer (WEF — Workforce Execution Framework) executes delegated batches from WAS. It provides operational intelligence for pre-deployment health checks, provider capability resolution, and workforce execution. WEF is the execution engine — the actual "doing" layer.

### Sub-services

| Service | Module | Purpose |
|---------|--------|---------|
| `WefOperationalIntelligence` | `wef/wef-operational-intelligence.ts` | Pre-deployment health & readiness reporting |
| `DeploymentHealthFramework` | `deployment/deployment-health.ts` | Health checks for all platform dependencies |
| `CredentialResolver` | `credentials/credential-resolver.ts` | Resolve and validate credentials |
| `DeploymentResolutionEngine` | `deployment/deployment-resolution-engine.ts` | Resolve deployment targets |
| `ProviderRegistry` | `providers/provider-registry.ts` | Register and resolve execution providers |

### Owner
**Hermes Runtime — Execution Layer**
Implementation domain: `workers/src/platform/wef/`, `workers/src/platform/deployment/`, `workers/src/platform/credentials/`, `workers/src/platform/providers/`

### Inputs
| Input | Source | Format |
|-------|--------|--------|
| Batch delegation requests | Activation Layer | `WEFDelegationRequest[]` |
| Deployment command | Operations Layer | Command trigger |
| Health check trigger | Observability Layer | Trigger event |

### Outputs
| Output | Destination | Format |
|--------|-------------|--------|
| Delegation results | Activation Layer | `WEFDelegationResult` |
| Pre-deployment health report | Observability Layer | `WefOperationalReport` |
| Credential status | Observability Layer | Status map |
| Provider status | Observability Layer | Provider health map |

### Dependencies
- Layer 3 (Activation) — receives batch delegation requests
- Layer 6 (Knowledge) — may capture knowledge from execution results
- Layer 7 (Operations) — identity, security, permissions for execution
- Layer 8 (Deployment) — deployment targets, credential resolution
- Layer 9 (Observability) — health reporting

### Failure Behaviour
- `preDeploymentReport()` returns structured failures — never throws
- `canDeploy()` returns `{ deployable: false, report }` with full context
- Each provider health check is isolated — one failure doesn't cascade
- Credential failures are independently reported

### Activation Conditions
- A batch delegation request from WAS
- Or an explicit pre-deployment health check trigger
- Feature flags may gate specific WEF capabilities

### Runtime Lifecycle
```
IDLE → (delegation received or health check triggered) → PROCESSING → IDLE
```
Stateless execution. Each delegation is independent.

---

## 5. Verification Layer

### Purpose
The Verification Layer validates execution results before they are accepted as complete. It ensures that every output satisfies the acceptance criteria defined in the execution plan. Verification is mandatory before any deployment or knowledge capture occurs.

### Sub-services

| Service | Module | Purpose |
|---------|--------|---------|
| `VerificationRouter` | `was/verification-router.ts` | Route and run verification checks |
| `ConstitutionalValidator` | `was/constitutional-validator.ts` | Validate against constitutional rules |
| Capability-specific verifiers | Distributed | Verification per capability type |

### Owner
**Hermes Runtime — Verification Layer**
Coordinated by `VerificationRouter` (`workers/src/platform/was/verification-router.ts`)

### Inputs
| Input | Source | Format |
|-------|--------|--------|
| Delegation results | Execution Layer | `WEFDelegationResult` |
| Acceptance criteria | Planning Layer | `ExecutionTask.acceptanceCriteria` |
| Plan verification needs | Activation Layer | `VerificationRequest` |

### Outputs
| Output | Destination | Format |
|--------|-------------|--------|
| Verification result | Activation Layer | `VerificationResult` |
| Verification checks | Governance Layer | `VerificationCheck[]` |
| Verification failure | Activation Layer | `ActivationFailure` |

### Dependencies
- Layer 4 (Execution) — verifies execution output
- Layer 10 (Governance) — constitutional rules
- Layer 2 (Planning) — acceptance criteria definitions

### Failure Behaviour
- Verification failure → `BATCH_VERIFICATION_FAILED` structured failure
- Batch is marked FAILED, not retried (configurable via maxRetries)
- Summary message captures what was verified and what failed
- Does NOT prevent other batches from continuing

### Activation Conditions
- Triggered by WAS `delegateBatch()` after WEF delegation completes
- Only runs when a batch has a `WEFDelegationResult`

### Runtime Lifecycle
```
IDLE → (verification request received) → VERIFY → (result returned) → IDLE
```

---

## 6. Knowledge Layer

### Purpose
The Knowledge Layer captures, stores, and manages knowledge generated during platform execution. Every execution cycle produces knowledge that is captured for future use. Skills, patterns, and learnings are preserved as reusable knowledge artifacts.

### Sub-services

| Service | Module | Purpose |
|---------|--------|---------|
| `KnowledgeCapturer` | `epcl/knowledge-capturer.ts` | Capture knowledge from planning and execution |
| `KnowledgeCaptureTrigger` | `was/knowledge-capture-trigger.ts` | Trigger knowledge capture from WAS lifecycle |
| Skill management | Hermes skills | Create, update, patch skills via `skill_manage` |
| Memory management | Hermes memory | Persist durable facts across sessions |

### Owner
**Hermes Runtime — Knowledge Layer**
EPCL: `workers/src/platform/epcl/knowledge-capturer.ts`
WAS: `workers/src/platform/was/knowledge-capture-trigger.ts`
Hermes: `hermes/services/memory/`

### Inputs
| Input | Source | Format |
|-------|--------|--------|
| Execution results | Activation Layer | Plan state, batch results |
| Verification results | Verification Layer | `VerificationResult` |
| Executive reports | Executive Layer | `ExecutiveReport` |
| User corrections | Product Owner | Runtime corrections |

### Outputs
| Output | Destination | Format |
|--------|-------------|--------|
| Knowledge entries | Knowledge Store | `KnowledgeEntry[]` |
| Skill definitions | Skill Store | SKILL.md files |
| Memory entries | Memory Store | Persistent facts |

### Dependencies
- Layer 5 (Verification) — knowledge capture follows verification
- Layer 4 (Execution) — execution results provide raw knowledge
- Layer 1 (Executive) — executive reports provide summary knowledge
- Layer 7 (Operations) — persistence for knowledge store

### Failure Behaviour
- Knowledge capture failure is non-fatal (logged as warning in WAS)
- Knowledge is captured opportunistically — a failure does not roll back execution
- Skill creation is explicit (user-validated before committing)

### Activation Conditions
- `ENABLE_KNOWLEDGE_CAPTURE` feature flag enables automatic capture
- Always runs during EPCL Stage 11 (KNOWLEDGE_CAPTURE)
- Triggered per-batch by WAS `KnowledgeCaptureTrigger`

### Runtime Lifecycle
```
IDLE → (capture triggered) → CAPTURE → STORE → IDLE
```

---

## 7. Operations Layer

### Purpose
The Operations Layer provides the shared infrastructure services — memory, identity, permissions, security, scheduling, and agent management — that all other layers depend on. It is the runtime foundation of the platform.

### Sub-services

| Service | Module | Purpose |
|---------|--------|---------|
| Identity Runtime | `hermes/identity/` | User identity, authentication, tenants |
| Permissions | `hermes/permissions/` | RBAC, permission grants |
| Security | `hermes/services/security/` | Security providers, threat detection |
| Memory | `hermes/services/memory/` | Persistent memory across sessions |
| Scheduler | `hermes/services/scheduler/` | Cron job scheduling |
| Agent Registry | `hermes/agents/` | Agent registration and lifecycle |
| Workforce Registry | `hermes/workforce/` | Workforce agent management |
| Execution Gateway | `hermes/services/execution/gateway/` | `hermes-execution-gateway.ts` — auth'd execution |

### Owner
**Hermes Runtime — Operations Layer**
Implementation domain: `hermes/`

### Inputs
| Input | Source | Format |
|-------|--------|--------|
| Identity requests | All layers | Auth tokens, session IDs |
| Permission checks | All layers | Permission requests |
| Scheduler requests | All layers | Cron job definitions |
| Memory queries | All layers | Query strings |
| Security events | All layers | Event notifications |

### Outputs
| Output | Destination | Format |
|--------|-------------|--------|
| Auth results | All layers | Auth grants/denials |
| Permission decisions | All layers | Permission results |
| Scheduled triggers | Activation Layer | Event triggers |
| Memory content | All layers | Retrieved content |

### Dependencies
- Layer 10 (Governance) — permission policies, security rules
- Layer 8 (Deployment) — credential resolution for identity providers
- Layer 9 (Observability) — event/audit logging

### Failure Behaviour
- Auth failure → 401/403 — granular, per-request
- Permission failure → access denied — logged to audit
- Scheduler failure → missed tick — retry on next tick
- Memory failure → degraded retrieval — fall back to session content

### Activation Conditions
- Always active. Services are long-running or session-scoped singletons.

### Runtime Lifecycle
```
┌─────────────────────────────────────────────────────────┐
│  ALWAYS ACTIVE — services run continuously               │
│  Identity, Permissions, Memory: available at all times   │
│  Scheduler: runs on configured intervals                  │
│  Execution Gateway: available per execution context       │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Deployment Layer

### Purpose
The Deployment Layer manages the release pipeline — from health checks and credential resolution through to actual deployment execution. No deployment proceeds without passing pre-deployment checks. It owns the relationship between the platform and deployment targets (Cloudflare Workers, Pages, etc.).

### Sub-services

| Service | Module | Purpose |
|---------|--------|---------|
| `DeploymentHealthFramework` | `deployment/deployment-health.ts` | Run health checks on all dependencies |
| `CredentialResolver` | `credentials/credential-resolver.ts` | Resolve and validate deployment credentials |
| `DeploymentResolutionEngine` | `deployment/deployment-resolution-engine.ts` | Determine deployment target |
| `ProviderRegistry` | `providers/provider-registry.ts` | Register and manage deployment providers |
| Release management | `release/` | Release lifecycle management |

### Owner
**Hermes Runtime — Deployment Layer**
Implementation domain: `workers/src/platform/deployment/`, `workers/src/platform/credentials/`, `workers/src/platform/providers/`, `workers/src/platform/release/`

### Inputs
| Input | Source | Format |
|-------|--------|--------|
| Deployment trigger | Activation/Executive Layer | Deployment command |
| Credential requests | Execution Layer | Provider ID |
| Health check requests | Observability Layer | Trigger event |

### Outputs
| Output | Destination | Format |
|--------|-------------|--------|
| Health report | Observability Layer | `WefOperationalReport` |
| Credential status | Execution/Observability | Credential map |
| Deployment readiness | Governance Layer | Boolean + report |
| Deployment outcome | Observability Layer | Deployment result |

### Dependencies
- Layer 4 (Execution) — WEF uses deployment services
- Layer 9 (Observability) — reports are observational
- Layer 10 (Governance) — deployment approval gates

### Failure Behaviour
- Health check failure → `canDeploy: false` — blocks deployment
- Credential failure → reported as critical — blocks deployment
- Individual check failures do NOT cascade to unrelated checks
- `overallHealth` is `red` when any critical failure exists

### Activation Conditions
- Triggered by deployment commands or credential resolution requests
- `preDeploymentReport()` is always safe to call

### Runtime Lifecycle
```
IDLE → (check requested) → CHECK ALL → REPORT → IDLE
```

---

## 9. Observability Layer

### Purpose
The Observability Layer provides telemetry, event emission, metrics, and status dashboards for all platform activity. Every layer emits events that are captured, structured, and reported. Executive reports, WAS lifecycle events, and deployment health reports all flow through this layer.

### Sub-services

| Service | Module | Purpose |
|---------|--------|---------|
| `WASObservability` | `was/was-observability.ts` | WAS lifecycle event emission |
| `ExecutiveReporter` | `epcl/executive-reporter.ts` | Executive report generation |
| `ExecutiveStatusUpdater` | `was/executive-status-updater.ts` | Activation status reports |
| `WefOperationalIntelligence` | `wef/wef-operational-intelligence.ts` | Deployment health reporting |
| Governance dashboards | Skills | Dashboard generation |

### Owner
**Hermes Runtime — Observability Layer**
Distributed across EPCL, WAS, WEF modules

### Inputs
| Input | Source | Format |
|-------|--------|--------|
| Stage results | All layers | `StageResult` |
| Lifecycle events | Activation Layer | `WASEvent` |
| Health check results | Deployment Layer | `DependencyReport[]` |
| Plan state | Executive/Planning | `PlanState` |

### Outputs
| Output | Destination | Format |
|--------|-------------|--------|
| Executive reports | Product Owner | `ExecutiveReport` |
| Activation status reports | Product Owner | `ActivationStatusReport` |
| Stage results | Governance Layer | `StageResult[]` |
| WAS events | Operations Layer | `WASEvent[]` |
| Deployment health reports | Deployment Layer | `WefOperationalReport` |
| Governance dashboards | Product Owner | Markdown reports |

### Dependencies
- All layers emit events into this layer
- Layer 7 (Operations) — persistence for event store
- Layer 10 (Governance) — compliance audit from events

### Failure Behaviour
- Event emission failure is non-fatal (logged, never breaks execution)
- Report generation failure is a warning (execution still complete)
- Observability is best-effort — execution never blocks on it

### Activation Conditions
- Events emitted at each stage of every lifecycle
- Reports generated at lifecycle completion
- Health checks run pre-deployment

### Runtime Lifecycle
```
ALWAYS ACTIVE (event listener)
REPORTING → (generated on demand or at lifecycle completion)
```

---

## 10. Governance Layer

### Purpose
The Governance Layer enforces constitutional rules, manages feature flags, maintains audit trails, and ensures compliance across all platform execution. It is the outermost layer — all execution happens within its constraints. Feature-flag-first deployment ensures all capabilities are disabled by default.

### Sub-services

| Service | Module | Purpose |
|---------|--------|---------|
| Feature Flags | `epcl/feature-flags.ts` | Gate all platform capabilities |
| `ConstitutionalValidator` | `was/constitutional-validator.ts` | Validate plans against constitutional rules |
| `ApprovalManager` | `epcl/approval-manager.ts` | Evaluate plan/batch approval requirements |
| Audit trail | Distributed | Append-only event logs |
| Certification | Docs | Security and compliance certifications |

### Owner
**Hermes Runtime — Governance Layer**
Distributed: EPCL, WAS, platform constitution

### Inputs
| Input | Source | Format |
|-------|--------|--------|
| Feature flag config | Platform configuration | `EPCLConfig.flags` |
| Constitutional rules | Platform Constitution | Document |
| Approval rules | Governance Layer | `ApprovalEvaluation` |
| Execution events | All layers | Event records |

### Outputs
| Output | Destination | Format |
|--------|-------------|--------|
| Flag states | All layers | Boolean per flag |
| Validation results | Activation Layer | `ValidationResult` |
| Approval decisions | Executive Layer | `ApprovalEvaluation` |
| Audit events | Operations Layer | Event records |
| Governance dashboards | Product Owner | Markdown reports |

### Dependencies
- All layers — governance rules apply universally
- Layer 9 (Observability) — audit from events
- No runtime dependencies on other layers (can always say "no")

### Failure Behaviour
- Flag disabled → capability blocked with clear error message
- Validation failure → `REJECTED` — plan cannot proceed
- Approval required → gates until human approval is given
- Fail-closed: any governance failure means "no" by default

### Activation Conditions
- Always active — feature flags are checked before every action
- Validation gates run on every plan activation
- Approval checks run on every plan and batch

### Runtime Lifecycle
```
ALWAYS ACTIVE — governance rules are always in effect
┌─────────────────────────────────────────────────────────┐
│  Feature flags: checked before every gated operation     │
│  Constitutional validation: runs at activation boundary  │
│  Approval checks: run at planning stage                  │
│  Audit: append-only, always collecting                    │
└─────────────────────────────────────────────────────────┘
```

---

## Layer Interaction Matrix

| From Layer | To Layer | Flow |
|-----------|----------|------|
| Executive (1) | Planning (2) | Roadmap input → Plan |
| Executive (1) | Activation (3) | Plan → Activation |
| Executive (1) | Knowledge (6) | Executive report → Knowledge capture |
| Executive (1) | Observability (9) | Stage results → Telemetry |
| Planning (2) | Activation (3) | Plan + budgets → WAS |
| Activation (3) | Execution (4) | Batch delegation → WEF |
| Activation (3) | Verification (5) | Delegation results → Verify |
| Activation (3) | Knowledge (6) | Batch results → Knowledge capture |
| Activation (3) | Observability (9) | Lifecycle events → Telemetry |
| Activation (3) | Governance (10) | Validation gates → Compliance |
| Execution (4) | Activation (3) | Delegation results ← |
| Execution (4) | Deployment (8) | Health checks → |
| Verification (5) | Activation (3) | Verification results ← |
| Knowledge (6) | Operations (7) | Persist → Store |
| Operations (7) | All | Identity, permissions, memory, security |
| Deployment (8) | Observability (9) | Health reports → |
| Observability (9) | Governance (10) | Event audit → |
| Governance (10) | All | Feature flags, rules, approval |

---

## Key Design Principles

1. **Fail-closed**: Every layer defaults to "no" — no autonomous execution without explicit enabling
2. **Feature-flag-first**: All capabilities disabled by default, opt-in per environment
3. **Deterministic selection**: Capability and discipline selection are pure registry lookups with fallback chains — no LLM calls
4. **Singleton services**: Every major service uses a `getInstance()` singleton pattern
5. **No cross-layer execution**: Planning never executes. Activation never plans. Execution never validates.
6. **Knowledge capture is mandatory**: Every execution cycle produces knowledge
7. **Verification is mandatory**: Every batch must be verified before acceptance
8. **Executive reporting is automatic**: Every cycle produces a structured report