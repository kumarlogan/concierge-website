# EPIC-003-005 — Workforce Orchestration Platform · Completion Report

**Status:** ✅ Complete (2026-07-20)
**Owner:** Hermes Agent (autonomous build, human-accepted)
**Provider-neutral:** Yes — no vendor lock-in, no production touch beyond governed gates
**Persistence:** In-memory only (per EPIC M5 — no database)

---

## Objective

Coordinate multiple agents to deliver an objective as a governed, auditable
workflow — reusing the existing Hermes execution foundations (Work Planner,
Execution Queue, Workforce Dispatcher, Provider Registry, Audit) without
redesigning them. Hermes remains the **orchestrator**: it plans, dispatches,
assigns, and waits at human approval gates. It never autonomously executes
approval-required work.

## Deliverables (M1–M9)

| Milestone | Description | Status |
|---|---|---|
| M1 + M5 | Workforce-orchestration coordinator: `createWorkflow` (objective → plan → dispatch → assign) with the 8 lifecycle states (`queued → planning → waiting → running → paused → completed → cancelled → failed`), in-memory store | ✅ |
| M2 | Coordination ops: assign, monitor, wait-for-approval, retry, cancel, completion, failure recovery (thin wrappers over existing queue/provider primitives) | ✅ |
| M3 | Capability resolution: dynamic dispatch via `dispatchCapability` (registry → workforce-agent → fail-closed); no hardcoded backends | ✅ |
| M4 | Human approval: every approval-required workflow stops at a gate; env-driven fail-closed (production always requires a human grant) | ✅ |
| M6 | Audit every orchestration event (`workflow.created/state/approval.requested/granted/assigned/completed/failed`) via `emitAudit` | ✅ |
| M7 | Admin Platform integration: read-only `adminViewWorkflows` (status, stage, agents, approvals, timeline, retries, failures); no public HTTP route | ✅ |
| M8 | Orchestration test suite (planning, dependency graphs, provider resolution, approval waits, retries, cancel, resume, parallel, fail-recovery, audit, fail-closed) | ✅ |
| M9 | Completion report, validation report, roadmap update | ✅ |

## Architecture

The coordinator is a **view/orchestration layer** over authoritative primitives:

- **Planning** → `execution/work-planner.ts` (`planWork`) — pure, topological,
  cycle fail-closed.
- **Resolution** → `execution/workforce-dispatch.ts` (`dispatchCapability`) —
  registry → workforce-agent → `hermes.fail-closed`, never hardcoded.
- **Execution** → `execution/execution-queue.ts` (`enqueue`, `approveAndRun`,
  `retryEntry`, `cancelEntry`, `pauseEntry`, `resumeEntry`) — the authoritative
  task/queue state lives here; the workflow tracks a binding `queueId` per item.
- **Approval** → `agents/tool-contracts.ts` (`requestApproval`) — append-only,
  human-driven. The workflow records a grant in `grantedApprovals` so `runTask`
  can verify it was satisfied (fail-closed).
- **Audit** → `audit/event.ts` (`emitAudit`) — every lifecycle transition and
  approval event is emitted.

### Fail-closed design (M4, hardened during validation)

Two independent gates in `runTask`:
1. A **pending** (requested, not-yet-granted) approval always blocks execution,
   regardless of environment.
2. Any task flagged `requiresApproval` (env-driven: `production` → true; or
   capability-flagged) **must** have an explicit human grant on record in
   `grantedApprovals` before it may run. No grant → refused.

`requiresApproval` is computed at plan time as
`dispatch.via === "unresolved" || env === "production"`, so a resolved
workforce-agent in production still requires a human grant.

## Files delivered (EPIC-003-005 scope only)

| File | Type | Role |
|---|---|---|
| `hermes/services/workforce/orchestration.ts` | new | Core coordinator (M1–M7) |
| `hermes/services/workforce/index.ts` | new | Workforce barrel |
| `hermes/admin/workflow-view.ts` | new | M7 admin read model |
| `hermes/admin/index.ts` | modified | Adds `adminViewWorkflows` (M7) — +18 lines, 1 import, 003-005-only hunk |
| `workers/tests/hermes.workforce.orchestration.test.ts` | new | M8 test suite (12 tests) |

## Validation summary

- Orchestration suite: **12/12 passing**.
- Full workers suite: **375/375 passing** (no regressions across 26 files).
- In-scope `tsc --noEmit`: **0 errors** in `services/workforce/` or any
  003-005 file.
- See `EPIC-003-005_VALIDATION_REPORT.md` for the detailed gate evidence.

## Out of scope (intentionally not touched)

- No database persistence (in-memory per M5).
- No autonomous execution (Hermes remains orchestrator).
- No Cloudflare / Worker / migration / secret changes.
- No repair or absorption of parallel EPIC-003-004 / security-004 / admin-console
  work present in the working tree (those carry the repo's only `tsc` errors and
  are tracked separately).

## Reversibility

The commit is a pure addition of new files plus one additive hunk in
`admin/index.ts`. It is logically reversible via `git revert` with no impact on
parallel EPIC working trees (those files are not staged).
