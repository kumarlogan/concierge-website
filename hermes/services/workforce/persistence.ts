// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Workforce Persistence Startup Recovery     │
// │ EPIC-003-005 · PHASE 5                                      │
// │ Reloads active workflows from the repository on startup.     │
// └─────────────────────────────────────────────────────────────┘

import type { WorkflowRepository } from "./workflow-repository.js";
import { setRepository, injectWorkflow } from "./orchestration.js";

/**
 * Restore workflows from the repository into the in-memory orchestration
 * state after a restart. This is the bridge between durable D1 storage and
 * the runtime orchestration in-memory Map.
 *
 * Only non-terminal workflows (queued, planning, waiting, running, paused) are
 * reloaded. Terminal workflows (completed, cancelled, failed) remain in the DB
 * for archival but are not loaded into memory.
 */
export async function recoverWorkflows(repo: WorkflowRepository): Promise<{
  restored: number;
  skipped: number;
}> {
  const all = await repo.listWorkflows();
  const nonTerminal = all.filter(
    (wf) =>
      wf.state !== "completed" &&
      wf.state !== "cancelled" &&
      wf.state !== "failed",
  );
  const terminal = all.length - nonTerminal.length;

  // Wire the repository into orchestration
  setRepository(repo);

  // Load workflows into the in-memory runtime
  for (const wf of nonTerminal) {
    injectWorkflow(wf);
  }

  return { restored: nonTerminal.length, skipped: terminal };
}

// ─── Re-exports ───────────────────────────────────────────────

export type { WorkflowRepository } from "./workflow-repository.js";
export {
  MemoryWorkflowBackend,
  FileWorkflowBackend,
} from "./workflow-repository.js";
export { D1WorkflowStore } from "./workflow-store.js";