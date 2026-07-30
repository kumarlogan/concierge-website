# WAS — Workforce Activation Service

> **AI Platform Capability — Architecture**
> Activation boundary between EPCL (strategic planning) and WEF (autonomous execution). Fail-closed by default — no autonomous execution without explicit feature flags, validation, and deterministic state transitions.
>
> **Version:** 1.0.0 — Architecture
> **Status:** Implementation Complete
> **Last Updated:** 2026-07-30

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        <consumer> (first: Concierge)
Public Brand:   AG Synergy
Repository:     concierge-website
Document:       WAS Architecture
Capability:     Workforce Activation Service
Capability #:   17
Framework:      WEF v1.1 (AGS Enterprise Execution Framework)
```

---

## 1. Purpose

WAS is the **activation boundary** that enforces constitutional constraints between plan creation (EPCL) and autonomous execution (WEF). It answers one question:

> *"Is this plan safe to execute, and is the platform ready for autonomous execution?"*

WAS does not plan. WAS does not execute. WAS validates, gates, and orchestrates the transition from a planned state to an executing state — and back to completion.

### Core Responsibilities

| Responsibility | Description |
|---------------|-------------|
| **Constitutional Gating** | Validate every plan against feature flags, plan integrity, and before it reaches WEF |
| **State Machine Enforcement** | Deterministic lifecycle from PENDING → DEACTIVATED with no skippable transitions |
| **Idempotent Activation** | One plan, one activation — duplicate consumption is safely rejected |
| **WEF Delegation** | Bridge activation context to WEF for batch execution |
| **Verification** | Verify WEF delegation results against integrity checks |
| **Knowledge Capture** | Capture execution evidence, reusable patterns, and capability improvements |
| **Executive Reporting** | Generate activation status reports with batch-level breakdown |
| **Recovery** | Handle restarts with fail-closed recovery (all in-progress → FAILED by default) |

### Non-Responsibilities

| Not WAS's Job | Owned By |
|--------------|----------|
| Planning / roadmap parsing | EPCL — RoadmapEngine |
| Execution plan creation | EPCL — ExecutionPlanner |
| Approval evaluation | EPCL — ApprovalManager |
| Batch execution | WEF — Worker Delegation |
| Provider orchestration | WEF — Provider Layer |
| Long-term state persistence | PSER (Project State & Execution Registry) |
| User identity & auth | Identity Core |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EPCL (Planning Layer)                               │
│  RoadmapEngine · ExecutionPlanner · ApprovalManager · CapabilitySelector    │
│                                                                             │
│  Output: ExecutionPlan (PlanStatus.APPROVED)                                │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌─ WAS: Workforce Activation Service ──────────────────────────────────┐   │
│  │                                                                       │   │
│  │  ┌──────────────┐   ┌──────────────────┐   ┌────────────────────┐   │   │
│  │  │ PlanConsumer  │──▶│ Constitutional  │──▶│ ExecutionState    │   │   │
│  │  │ (consume)     │   │ Validator       │   │ Manager (state)   │   │   │
│  │  └──────────────┘   │ (validate)       │   └────────┬───────────┘   │   │
│  │                     └──────────────────┘            │                │   │
│  │                                                      ▼                │   │
│  │  ┌──────────────┐   ┌──────────────────┐   ┌────────────────────┐   │   │
│  │  │ WEFDelegator │──▶│ Verification    │   │ KnowledgeCapture   │   │   │
│  │  │ (delegate)   │   │ Router (verify)  │   │ Trigger (capture)  │   │   │
│  │  └──────────────┘   └──────────────────┘   └────────────────────┘   │   │
│  │                                                                       │   │
│  │  ┌────────────────────────────────────────────────────────────┐      │   │
│  │  │ ExecutiveStatusUpdater (report) ──→ ActivationStatusReport │      │   │
│  │  └────────────────────────────────────────────────────────────┘      │   │
│  │                                                                       │   │
│  │  ┌────────────────────────────────────────────────────────────┐      │   │
│  │  │ WASObservability (events, metrics, logging)                 │      │   │
│  │  └────────────────────────────────────────────────────────────┘      │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          WEF (Execution Layer)                              │
│  Worker Delegation · Provider Routing · Dispatcher · Executor              │
│                                                                             │
│  Output: DelegationResult (worker-completed batch)                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Service Layer

All services are singletons, obtained via `getInstance()`:

| Service | File | Role |
|---------|------|------|
| `WorkforceActivationService` | `workforce-activation-service.ts` | Main orchestrator |
| `PlanConsumer` | `plan-consumer.ts` | Consume approved plans |
| `ConstitutionalValidator` | `constitutional-validator.ts` | Run validation gates |
| `ExecutionStateManager` | `execution-state-manager.ts` | State machine + persistence |
| `WEFDelegator` | `wef-delegator.ts` | Delegate batches to WEF |
| `VerificationRouter` | `verification-router.ts` | Verify delegation results |
| `KnowledgeCaptureTrigger` | `knowledge-capture-trigger.ts` | Capture execution knowledge |
| `ExecutiveStatusUpdater` | `executive-status-updater.ts` | Generate status reports |
| `WASObservability` | `was-observability.ts` | Events, metrics, logging |

### 2.2 Configuration Propagation

All sub-services receive configuration via `configure()` on the orchestrator, which cascades to every child service. Example:

```typescript
const was = WorkforceActivationService.getInstance();
was.configure({ maxConcurrentActivations: 3, autoResume: false });
```

---

## 3. Relationship to EPCL

EPCL and WAS are **peer capabilities** in the activation pipeline:

| Aspect | EPCL | WAS |
|--------|------|-----|
| Domain | Strategic planning | Operational gating |
| Input | Roadmap markdown | Approved ExecutionPlan |
| Output | ExecutionPlan (APPROVED) | ActivationLifecycle + StatusReport |
| State | PlanStatus enum (7 states) | ActivationState enum (8 states) |
| Persistence | RecoveryManager checkpoints | ExecutionStateManager in-memory |
| Flags | 10 EPCL feature flags | 7 WAS feature flags (synced from EPCL) |

### Activation Flow

```
EPCL: Roadmap → Plan (APPROVED)
        │
        ▼
WAS:   Consume → Validate → Activate → Delegate → Verify → Report
        │
        ▼
EPCL: Knowledge Capture → Executive Report (COMPLETED)
```

### Stage Handoff (EPCL Stages 8-10)

EPCL reserves stages 8-10 in its 12-stage workflow for WAS integration. When EPCL reaches stage 8, it delegates the approved plan to WAS:

1. **Stage 8:** WAS.activate(plan) — hands off the approved plan
2. **Stage 9:** WAS.delegateBatch() — called per batch for WEF delegation
3. **Stage 10:** WAS.complete() — activation concluded, report generated

---

## 4. Relationship to Intent Engine

The Intent Engine produces high-level objective statements that EPCL parses into roadmaps. WAS is not directly invoked by the Intent Engine — all activation flows through EPCL:

```
Intent Engine → roadmap markdown → EPCL → ExecutionPlan → WAS → WEF
```

---

## 5. Relationship to WEF

WAS and WEF form a **strict producer-consumer** relationship:

| Component | Produces | Consumes |
|-----------|----------|----------|
| WAS (WEFDelegator) | WEFDelegationRequest | — |
| WEF | — | WEFDelegationRequest |
| WEF | WEFDelegationResult | — |
| WAS (VerificationRouter) | — | WEFDelegationResult |

WAS never bypasses WEF. Batches are delegated through WEF's worker allocation, execution, and routing infrastructure.

---

## 6. Activation Lifecycle

### 6.1 Full Lifecycle

```
PENDING ──→ VALIDATING ──→ ACTIVATING ──→ ACTIVE ──→ DEACTIVATING ──→ DEACTIVATED
   │            │              │                                  │
   │            │              │                                  │
   ▼            ▼              ▼                                  ▼
 FAILED      REJECTED        FAILED                            FAILED
```

### 6.2 Stage Breakdown

| Stage | Description | Duration |
|-------|-------------|----------|
| **PENDING** | Activation created. Plan not yet processed. | Instant (creation) |
| **VALIDATING** | Constitutional validation running. Feature flags, plan integrity, policy checks. | Synchronous |
| **ACTIVATING** | Validation passed. Batches being activated and prepared for WEF. | Per-batch |
| **ACTIVE** | Plan is actively delegating batches through WEF. | Variable (multi-batch) |
| **DEACTIVATING** | Graceful shutdown in progress. Status report being generated. | Synchronous |
| **DEACTIVATED** | Terminal — activation completed successfully. | Final |
| **FAILED** | Terminal — activation failed at any stage. | Final |
| **REJECTED** | Terminal — plan rejected by constitutional validation. | Final |

### 6.3 Idempotency

Each plan produces exactly one activation. The `PlanConsumer` enforces idempotency by checking for an existing activation before creating a new one:

```
consume(plan):
  if existsActiveActivation(plan.id) → return existing lifecycle (idempotent)
  else → create new activation in PENDING state
```

---

## 7. Feature Flag Interaction

### 7.1 Two-Layer Flag System

WAS checks flags at two layers:

```
EPCL Layer (master switch):
  ENABLE_AUTONOMOUS_EXECUTION  ← MUST be true for WAS to activate
  ENABLE_EXECUTIVE_WORKFLOW    ← MUST be true for WAS to activate

WAS Layer (operational flags):
  ENABLE_AUTONOMOUS_EXECUTION       ← WAS master switch
  ENABLE_EXECUTIVE_WORKFLOW         ← WAS workflow enabled
  ENABLE_BATCH_GENERATION           ← Batch activation permitted
  ENABLE_EXECUTIVE_REPORTING        ← Status reports generated
  ENABLE_CONSTITUTIONAL_VALIDATION  ← Constitutional gates enforced
  ENABLE_AUTO_RECOVERY              ← Automatic recovery on restart (experimental)
  ENABLE_PARALLEL_BATCH_DELEGATION  ← Parallel batch delegation
```

### 7.2 Default States

All flags are **disabled by default** (fail-closed). The single exception is `ENABLE_CONSTITUTIONAL_VALIDATION` which is enabled by default.

### 7.3 Synchronization

`syncWASFlagsFromEPCL()` reads the EPCL `ENABLE_AUTONOMOUS_EXECUTION` flag and forces the WAS flag to `false` when the EPCL master switch is off:

```
if (!epclIsEnabled(EPCL.ENABLE_AUTONOMOUS_EXECUTION)):
  set WAS.ENABLE_AUTONOMOUS_EXECUTION = false
```

This prevents WAS from being activated when the EPCL-level autonomy switch is off, regardless of WAS-level configuration.

### 7.4 Validation Gate

The `validateFeatureFlags()` gate checks (in order):

1. **Config override:** If `requireFeatureFlagValidation` is `false`, skip all flag checks
2. **Sync EPCL flags:** Call `syncWASFlagsFromEPCL()`
3. **WAS ENABLE_AUTONOMOUS_EXECUTION:** Must be `true`
4. **EPCL ENABLE_EXECUTIVE_WORKFLOW:** Must be `true`
5. **WAS ENABLE_BATCH_GENERATION:** Must be `true`

Any failure produces a `ValidationGateResult` with `severity: "error"`, which blocks activation.

---

## 8. Failure Modes

| Failure Mode | Cause | Behavior | Recovery |
|-------------|-------|----------|----------|
| **Plan consumption failure** | Plan not APPROVED, null, or empty | Throws `WorkforceActivationError` | Fix plan and retry |
| **Flag validation failure** | Required flags disabled | Rejected with `ValidationGateResult` | Enable flags |
| **Constitutional validation failure** | Plan fails integrity/constraint checks | Rejected with gate details | Fix flagged issues |
| **State transition failure** | Invalid transition attempted | Throws `StateTransitionError` | Check current state |
| **WEF delegation failure** | WEF returns error | Batch marked FAILED | Retry delegation |
| **Verification failure** | Delegation result fails checks | Batch marked FAILED | Investigate WEF |
| **Knowledge capture failure** | Capturer throws | Non-fatal warning, activation continues | Logged only |
| **Restart recovery** | Worker restarts mid-activation | All in-progress → FAILED (safe default) | Set autoResume=true |
| **Duplicate activation** | Same plan consumed twice | Returns existing activation (idempotent) | No action needed |

---

## 9. Recovery Model

### 9.1 Default Recovery (Fail-Safe)

```
Worker restart → WAS.recover()
  For each in-progress activation:
    if autoResume = false (default):
      → Mark as FAILED, emit recovery.rejected event
    if autoResume = true (experimental):
      → Transition back to PENDING for re-validation
```

### 9.2 Recovery Event Types

| Event | When |
|-------|------|
| `was.recovery.attempted` | Recovery begins |
| `was.recovery.succeeded` | Auto-resume succeeded |
| `was.recovery.failed` | Auto-resume or fail-safe failed |

### 9.3 Checkpoints

The `ExecutionStateManager` maintains in-memory activation state. On restart, all in-memory activations are lost. The recovery model provides:
- **Fail-closed default:** Activations are marked FAILED (safe — no orphaned batches)
- **Experimental auto-resume:** Activations revert to PENDING for re-validation and re-execution

---

## 10. Extension Points

| Extension | Mechanism | Status |
|-----------|-----------|--------|
| **Custom validation gates** | Add gates to `ConstitutionalValidator.validate()` | Ready |
| **Custom verification checks** | Extend `VerificationRouter` check list | Ready |
| **Alternative knowledge capture** | Implement new `captureEvidence()` strategies in trigger | Ready |
| **Parallel batch delegation** | Enable `ENABLE_PARALLEL_BATCH_DELEGATION` flag | Feature flag |
| **Auto-recovery** | Enable `ENABLE_AUTO_RECOVERY` flag + `autoResume` config | Experimental |
| **External persistence** | Add storage adapter to `ExecutionStateManager` | Future capability |
| **Provider-specific routing** | Extend WEF delegator with provider awareness | WEF scope |

---

## 11. Source Files

| File | Lines | Exports | Description |
|------|-------|---------|-------------|
| `types.ts` | 394 | All interfaces, enums, type definitions | Shared WAS types |
| `was-feature-flags.ts` | 185 | Flag functions, validation gate | Feature flag system |
| `execution-state-manager.ts` | ~250 | `ExecutionStateManager`, `ExecutionStateError`, `StateTransitionError` | State machine |
| `was-observability.ts` | ~200 | `WASObservability` | Events and metrics |
| `plan-consumer.ts` | ~100 | `PlanConsumer`, `PlanConsumptionError` | Plan consumption |
| `constitutional-validator.ts` | ~100 | `ConstitutionalValidator` | Validation gates |
| `wef-delegator.ts` | ~100 | `WEFDelegator`, `WEFDelegationError` | WEF delegation |
| `verification-router.ts` | ~120 | `VerificationRouter`, `VerificationError` | Result verification |
| `knowledge-capture-trigger.ts` | 204 | `KnowledgeCaptureTrigger`, `KnowledgeCaptureTriggerError` | Knowledge capture |
| `executive-status-updater.ts` | ~130 | `ExecutiveStatusUpdater`, `StatusUpdateError` | Status reporting |
| `workforce-activation-service.ts` | 519 | `WorkforceActivationService`, `WorkforceActivationError` | Main orchestrator |
| `index.ts` | 64 | Barrel export | All WAS exports |

### Test File

| File | Tests | Description |
|------|-------|-------------|
| `was.integration.test.ts` | 68 | Full WAS integration tests |

---

## 12. Feature Flag Reference

| Flag (WAS) | Default | Required for Activation |
|------------|---------|----------------------|
| `ENABLE_AUTONOMOUS_EXECUTION` | `false` | Yes |
| `ENABLE_EXECUTIVE_WORKFLOW` | `false` | No (EPCL-level check) |
| `ENABLE_BATCH_GENERATION` | `false` | Yes |
| `ENABLE_EXECUTIVE_REPORTING` | `false` | No (warning only) |
| `ENABLE_CONSTITUTIONAL_VALIDATION` | `true` | Yes (unless config override) |
| `ENABLE_AUTO_RECOVERY` | `false` | No |
| `ENABLE_PARALLEL_BATCH_DELEGATION` | `false` | No |

### Activation Requirements

To activate a plan through WAS, these flags **must** be `true`:

1. `ENABLE_AUTONOMOUS_EXECUTION` (WAS)
2. `ENABLE_BATCH_GENERATION` (WAS)
3. `ENABLE_AUTONOMOUS_EXECUTION` (EPCL)
4. `ENABLE_EXECUTIVE_WORKFLOW` (EPCL)