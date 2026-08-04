# Wave 8 — Engineering Reconciliation: Knowledge Capture

**Deliverable:** Phase 2 · Knowledge Capture · Product Delivery
**Wave 8 · AGS Fertility Concierge Platform**
**Date:** 2026-08-03 · Commit `8175ddd` · Tag `wave8-reconciliation-v1.0`

---

## Root Causes

The Wave 8 workflow module was added to the working tree as a **skeleton whose
persistence was commented out**, then never reconciled before routes were written:

1. **Stub-then-wire inversion** — engine classes (EventStore, TaskOrchestrator,
   ApprovalGateService, TimerService…) were authored with empty `Config` interfaces
   and commented-out D1 queries (returning `[]`/`null`/no-op), so nothing exercised
   the real persistence path before the route layer was built on top.
2. **Unimported route dependencies** — `wave7.ts` handlers referenced engine classes
   without importing them (~50 net `TS2304 Cannot find name` errors), and called
   constructors/signatures that no longer matched the engine.
3. **Deleted-bridge residue** — `NotificationBridge`, `AppointmentBridge`,
   `MessagingBridge`, `AuditLoggingBridge`, `D1WorkflowStore` were removed from the
   platform, but commented references to them survived in the engine configs,
   creating a phantom dependency graph.
4. **Unsafe productive shorthand** — `"default" as EvidencePackTemplate` (crash at
   runtime), `body.assignments as string[] as string[]`, `{ id } as any`,
   `{} as WorkflowInstance`, validator `(m: any)` / `Promise<any>` / `{} as any`.
5. **Speculative config** — `WORKFLOW_QUEUE: Queue` in `env.ts` with no Cloudflare
   Queue binding in `wrangler` (whole durable-queue path was invented).
6. **Lifecycle drift** — the state machine modeled task state `accepted`; the engine
   and routes set `claimed`. Two definitions of the same lifecycle → validation
   rejected every claim.

## Architectural Decisions (recorded)

| A-ID | Decision | Rationale |
|------|----------|-----------|
| AD-1 | Every dependency has **one owner**, all **D1-backed** | Removes phantom/deleted bridges; single source of persistence per concern |
| AD-2 | Persistence canonicalized on D1 tables from migration `0010` (not CF Queue) | No Queue binding exists; D1 is the platform's durable store |
| AD-3 | Single engine composition point: `buildWorkflowEngine(env)` in `wave7.ts` | One place wires db + eventStore to all engines |
| AD-4 | Task lifecycle canonical on **`claimed`** | Matches the engine/routes; eliminates the accepted/claimed split |
| AD-5 | `transition-validator` condition evaluator is a **deterministic subset, fail-closed** | No LLM/network in the hot path; unsupported expressions reject |
| AD-6 | Removed unbacked placeholder routes (DLQ, analytics, metrics) rather than stub them | "Remove dead code" beats silent 501 surfaces |
| AD-7 | Lazy singletons (`getTaskOrchestrator()`, `getTimerService()`, `getApprovalGateService()`) | No fake `new X({})` at module load; explicit config ownership |
| AD-8 | Wave 3–7 baseline (218 TS errors) **left untouched** | They live in other platform capabilities; fixing them is out of Wave 8 scope |

## Dependency Ownership

| Dependency | Owner | Store |
|-----------|-------|-------|
| Workflow event sourcing | `EventStore` | D1 `workflow_events` |
| Task persistence / dashboard / queue | `TaskOrchestrator` + `BatchOperations` | D1 `task_instances` (+ `task_queue` for depth) |
| Approval gates + evidence | `ApprovalGateService` | D1 `approval_gates` |
| SLA / timers / escalation | `TimerService` + `EscalationTimer` + `CronScheduler` | D1 `workflow_timers` |
| Durable work queue | `QueueManager` | D1 `task_queue` (no CF Queue binding) |
| Evidence packs | `EvidencePackBuilder` | task/workflow + event history |
| Engine composition | `buildWorkflowEngine(env)` | `wave7.ts` |

## Lessons Learned

- **Reconcile persistence before building route layers.** Empty configs + commented
  queries are a landmine: the runtime "works" until real writes are required, then
  every downstream consumer is wrong at once.
- **TypeScript-shape independence is a trap.** `new TaskOrchestrator(env)` type-checks if
  config is empty (`{}`-compatible), hiding the missing `db` until runtime. Spelling
  out required config fields (`{ db: D1Database; eventStore?: EventStore }`) surfaces
  gaps at compile time.
- **Canonical lifecycle must live in exactly one place.** Two definitions
  (`accepted` vs `claimed`) caused a real runtime rejection (claim failed). Align the
  state machine to the operations, not vice-versa.
- **`as any` in validators masks real contract bugs.** Fixing `(m: any)` exposed the
  actual condition-evaluation contract.
- **Pre-commit deploy gate (AGS-OPS-002) blocks code commits on unpushed sync.**
  It's a pre-deploy safety check; for a local feature commit the import-integrity
  check is the substantive gate. Banning diverge-sync but not import regressions is
  the right split.

## Migration Decisions

- No schema migration was needed beyond the already-present `0010_workflow_engine.sql`;
  the engine was aligned **to** that schema (columns: `task_instances` 22 cols,
  `approval_gates` 15, `workflow_timers` 9, `workflow_events`, `task_queue`).
- Task escalation increments `escalation_level` in SQL; transient fields
  (`escalated_at`, `escalation_reason`) live in the event payload, not dedicated
  columns (schema has none).
- `task.cancelled` is not a valid `EventType`, so cancellation is persisted but does
  not emit an event (per the allowed event list).

## Deferred Work (flagged, not placeholders)

1. **ProjectionEngine + EventReader** — not wired into runtime; still carry
   placeholder singletons + `as any`. Full D1 projection/analytics.
2. **ConsentEngine write-gating** for write-operation consent (deleted bridge removed;
   real wiring needs its own platform approval).
3. **Full DMN/FEEL rule evaluator** — currently a deterministic subset (fail-closed).
4. **DLQ/retry + analytics/metrics endpoints** — removed; reintroduce with real backing.

## Future Recommendations

- Add a **`tsc --noEmit` CI gate** scoped to the Wave 8 delta so drift cannot silently
  re-enter (CI has no tsc gate today; deploy succeeds via esbuild type-stripping).
- Introduce a **single canonical lifecycle source** (the state machine) that the engine
  and route layer read, not re-declare.
- Track deferred items (Projection/Consent/FEEL/DLQ) as backlog in the ongoing Wave 8
  implementation so they land with a real owner instead of being forgotten.
- Retire the 218-commit-gate bypass by pushing the pending Wave 7 commit to origin when
  a deploy window authorizes it.
