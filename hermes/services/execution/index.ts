// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Execution module barrel                  │
// │ EPIC-003-001 · Execution Platform                         │
// │ Re-exports the execution queue, planner, and dispatcher so  │
// │ the platform can consume them via services.Execution.       │
// └─────────────────────────────────────────────────────────────┘

export * from "./execution-queue.js";
export * from "./work-planner.js";
export * from "./workforce-dispatch.js";
export * from "./execution-coordinator.js";
// EPIC-004.6 — Platform trust hardening (provider-neutral boundaries).
export * from "./policy-evaluator.js";
export * from "./idempotency.js";
export * from "./lease.js";
export * from "./metrics.js";
