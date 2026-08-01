# EPIC-007: Executive Execution Entry Point

**Objective:** Bridge product objectives (EPCL) with Hermes execution architecture (WAS/WEF), integrating existing services without redesign.

**Key principle:** Integration-first. No redesign of EPCL, WAS, or WEF. Fail-closed by default.

---

## Implementation Order (dependency-respected)

### Phase 1 — Foundation
| # | Item | File | Description |
|---|------|------|-------------|
| 02 | ExecutionContext | `hermes/services/execution/context.ts` | Foundation data object wrapping every execution with metadata, provenance, and trace context. Pure data + factory. |

### Phase 2 — Core Pipeline
| # | Item | File | Description |
|---|------|------|-------------|
| 03 | ExecutiveExecutionEntryPoint | `hermes/services/execution/entry-point.ts` | Orchestrates EPCL→WAS→WEF pipeline. Single class: takes a plan, activates via WAS, delegates through WEF, returns results. |
| 04 | DisciplineRouter integration | `hermes/services/execution/discipline-integration.ts` | Wraps existing `DisciplineRouter` to auto-select disciplines based on execution context. |

### Phase 3 — Intelligence & Observability
| # | Item | File | Description |
|---|------|------|-------------|
| 05 | ExecutiveTrace | `hermes/services/execution/executive-trace.ts` | Generates trace objects at each pipeline stage for post-execution analysis. |
| 06 | EvidencePackage | `hermes/services/execution/evidence-package.ts` | Collects and packages evidence from execution for Research Intelligence. |

### Phase 4 — Runtime Control
| # | Item | File | Description |
|---|------|------|-------------|
| 07 | ExecutionScopedFlags | `hermes/services/execution/execution-flags.ts` | Runtime flag evaluation scoped to an execution context (distinct from global EPCL flags). |
| 08 | OperatorExperience | `hermes/services/execution/operator-experience.ts` | Single-command `execute()` wrapping the entire pipeline end-to-end for operators. |

### Phase 5 — Wiring & Verification
| # | Item | File | Description |
|---|------|------|-------------|
| — | Barrel export | `hermes/services/execution/index.ts` | Add exports for all new modules. |
| 09 | Verification tests | `workers/tests/hermes.execution.007.test.ts` | Runtime path exercise and test results. |
| 10 | Executive Summary | — | Produce summary + documentation. |

---

## Key Design Decisions

1. **Location**: All new code in `hermes/services/execution/` (already exists with execution-coordinator, execution-queue, etc.)
2. **No redesign**: Integrates EPCL (planning), WAS (activation), WEF (delegation/orchestration) as-is.
3. **Fail-closed**: Matches existing WAS/WEF patterns — no autonomous execution without explicit state transitions.
4. **TypeScript**: Consistent with the rest of the codebase.
5. **Vitest**: Colocated tests under `workers/tests/`.
6. **Uses existing interfaces**: `PlanAtom`, `ExecutionBatch` from `hermes/contracts/planning.ts`; `ExecutionCoordinator`, `ExecutionStore` from existing execution module.
7. **Singleton pattern**: Consistent with WAS/EPCL (`getInstance()`) where shared state is needed.
8. **Barrel exports**: Added to `hermes/services/execution/index.ts` (already exists, extended in EPIC-004.6).

---

## Interface Dependencies

- **EPCL**: `ExecutivePlanningWorkflow`, `ExecutionPlanner`, `PlanningEngine` (from `workers/src/platform/epcl/`)
- **WAS**: `WorkforceActivationService`, `ExecutionStateManager`, `WEFDelegator` (from `workers/src/platform/was/`)
- **Planning contracts**: `PlanAtom`, `ExecutionBatch`, `PlanStatus`, `BatchStatus` (from `hermes/contracts/planning.ts`)
- **Existing Hermes execution**: `ExecutionCoordinator`, `ExecutionStore`, `ExecutionIdempotencyTracker` (from `hermes/services/execution/`)
- **DisciplineRouter**: `DisciplineRouter` (from `hermes/services/planning/discipline-router.ts`)
- **Feature flags**: EPCL feature flags (from `workers/src/platform/epcl/feature-flags.ts`) + WAS feature flags (from `workers/src/platform/was/was-feature-flags.ts`)
