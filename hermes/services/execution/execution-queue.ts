// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Execution Platform — Execution Queue                     │
// │ EPIC-003-001 · DELIVERABLE 3                                   │
// │ Queue, pause, retry, cancel, resume. Full audit trail. Human   │
// │ visibility. Built on the existing task.ts state machine + the  │
// │ activation orchestrator (retry/timeout/cancel). Never bypasses │
// │ Hermes governance.                                             │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../audit/event.js";
import { createTask, assignTask, approveTask, startTask, cancelTask, getTask, listTasks, type AgentTask, type TaskState } from "../agents/task.js";
import { orchestrate, DEFAULT_ORCHESTRATION, type OrchestrationConfig } from "../activation/orchestrator.js";

/** Queue-level status (superset of task state — adds paused/queued). */
export type QueueStatus =
  | "queued"
  | "assigned"
  | "approved"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

/** An enqueued work item bound to a Hermes task. */
export interface QueueEntry {
  /** Enqueue id (stable handle for queue ops). */
  queueId: string;
  /** The underlying Hermes task id. */
  taskId: string;
  /** The capability this entry will execute. */
  capability: string;
  /** Resolved executor backend (from the dispatcher). */
  backend: string;
  /** Wave this entry belongs to (parallel grouping). */
  wave: number;
  /** Queue status. */
  status: QueueStatus;
  /** Whether the entry is parallelizable within its wave. */
  parallelizable: boolean;
  /** Retry count. */
  attempts: number;
  /** Whether the entry is paused (operator-visible). */
  paused: boolean;
  /** Enqueue timestamp. */
  enqueuedAt: string;
  /** Last status change. */
  updatedAt: string;
  /** Human-readable note. */
  note?: string;
}

export class QueueError extends Error {}

const ENTRIES = new Map<string, QueueEntry>();
let seq = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function genQueueId(): string {
  seq += 1;
  return `qx_${seq}_${Math.random().toString(36).slice(2, 8)}`;
}

function mapTaskState(task: AgentTask, paused: boolean): QueueStatus {
  if (paused && task.state === "running") return "paused";
  return task.state as QueueStatus;
}

/**
 * Enqueue a planned work item. Creates a Hermes task (state: created) and
 * records a queue entry. Enqueueing NEVER starts execution — human approval
 * is required before running (see `approveAndRun`).
 */
export function enqueue(item: {
  agentId: string;
  applicationId: string;
  capability: string;
  backend: string;
  wave: number;
  parallelizable: boolean;
  requestedBy: string;
  purpose: string;
  permissionsScope?: string[];
}): QueueEntry {
  const task = createTask({
    agentId: item.agentId,
    applicationId: item.applicationId,
    purpose: item.purpose,
    requestedBy: item.requestedBy,
    permissionsScope: item.permissionsScope ?? [],
  });
  const entry: QueueEntry = {
    queueId: genQueueId(),
    taskId: task.id,
    capability: item.capability,
    backend: item.backend,
    wave: item.wave,
    status: "queued",
    parallelizable: item.parallelizable,
    attempts: 0,
    paused: false,
    enqueuedAt: nowIso(),
    updatedAt: task.updatedAt,
  };
  ENTRIES.set(entry.queueId, entry);
  emitAudit("execution.queue.enqueued", item.requestedBy, {
    queueId: entry.queueId,
    taskId: task.id,
    capability: item.capability,
    wave: item.wave,
  });
  return entry;
}

/** List queue entries, optionally filtered by status. */
export function listQueue(filter?: { status?: QueueStatus; wave?: number }): QueueEntry[] {
  let items = [...ENTRIES.values()];
  if (filter?.status) items = items.filter((e) => e.status === filter.status);
  if (filter?.wave !== undefined) items = items.filter((e) => e.wave === filter.wave);
  return items;
}

export function getEntry(queueId: string): QueueEntry | undefined {
  return ENTRIES.get(queueId);
}

/**
 * Pause a running entry. Operator-visible; the underlying task remains in
 * `running` but the queue marks it paused so dispatch stops scheduling more
 * waves. Never auto-resumes.
 */
export function pauseEntry(queueId: string, actor: string): QueueEntry {
  const e = ENTRIES.get(queueId);
  if (!e) throw new QueueError(`Unknown queue entry: ${queueId}`);
  e.paused = true;
  e.status = "paused";
  e.updatedAt = nowIso();
  emitAudit("execution.queue.paused", actor, { queueId, taskId: e.taskId });
  return e;
}

/** Resume a paused entry (operator action). */
export function resumeEntry(queueId: string, actor: string): QueueEntry {
  const e = ENTRIES.get(queueId);
  if (!e) throw new QueueError(`Unknown queue entry: ${queueId}`);
  e.paused = false;
  const task = getTask(e.taskId);
  e.status = task ? mapTaskState(task, false) : "queued";
  e.updatedAt = nowIso();
  emitAudit("execution.queue.resumed", actor, { queueId, taskId: e.taskId });
  return e;
}

/** Cancel an entry and its underlying task (human-governed). */
export function cancelEntry(queueId: string, actor: string): QueueEntry {
  const e = ENTRIES.get(queueId);
  if (!e) throw new QueueError(`Unknown queue entry: ${queueId}`);
  try {
    cancelTask(e.taskId, actor);
  } catch {
    // Task may already be in a terminal state — still mark queue cancelled.
  }
  e.status = "cancelled";
  e.paused = false;
  e.updatedAt = nowIso();
  emitAudit("execution.queue.cancelled", actor, { queueId, taskId: e.taskId });
  return e;
}

/**
 * Approve + run an entry. Requires an explicit human approver (fail-closed —
 * no approver = no run). Runs through the orchestrator (retry/timeout/cancel)
 * against the resolved backend. The executor is injected (never a hardcoded
 * provider); if none is supplied the entry fails closed.
 */
export async function approveAndRun(
  queueId: string,
  approver: string,
  executor: (capability: string, args: unknown) => Promise<{ ok: boolean; data?: unknown; error?: string; backend: string }>,
  args: unknown,
  opts?: { config?: Partial<OrchestrationConfig>; maxAttempts?: number },
): Promise<{ entry: QueueEntry; task: AgentTask; result: { ok: boolean; data?: unknown; error?: string; attempts: number; state: TaskState } }> {
  const e = ENTRIES.get(queueId);
  if (!e) throw new QueueError(`Unknown queue entry: ${queueId}`);
  if (e.paused) throw new QueueError(`Entry ${queueId} is paused; resume before running`);

  // Human approval gate (fail-closed). Drive the task toward approved only if
  // it hasn't already been (e.g. on retry the task is already approved and
  // re-transitioning would be an illegal task-state move).
  const t0 = getTask(e.taskId)!;
  if (t0.state === "created") {
    assignTask(e.taskId, approver);
    approveTask(e.taskId, approver);
  }
  e.status = "running";
  e.updatedAt = nowIso();
  emitAudit("execution.queue.approved", approver, { queueId, taskId: e.taskId });

  let lastResult: { ok: boolean; data?: unknown; error?: string; backend: string } | undefined;
  const outcome = await orchestrate(
    e.taskId,
    async () => {
      const r = await executor(e.capability, args);
      if (!r.ok) return { ok: false, error: r.error };
      lastResult = r;
      return { ok: true, data: r.data };
    },
    {
      actor: approver,
      config: { ...DEFAULT_ORCHESTRATION, maxAttempts: opts?.maxAttempts ?? 3, ...opts?.config },
    },
  );

  e.attempts = outcome.attempts;
  const task = getTask(e.taskId)!;
  // The orchestrator reports state but does not mutate the task (by design);
  // the queue reflects the authoritative execution outcome itself.
  e.status = (outcome.state === "completed"
    ? "completed"
    : outcome.state === "cancelled"
      ? "cancelled"
      : "failed") as QueueStatus;
  e.updatedAt = nowIso();

  emitAudit("execution.queue.run", approver, {
    queueId,
    taskId: e.taskId,
    capability: e.capability,
    ok: outcome.ok,
    attempts: outcome.attempts,
    state: task.state,
  });

  return { entry: e, task, result: { ok: outcome.ok, data: lastResult?.data, error: outcome.error, attempts: outcome.attempts, state: outcome.state } };
}

/** Retry a failed entry (operator action). Re-runs through approveAndRun. */
export async function retryEntry(
  queueId: string,
  approver: string,
  executor: (capability: string, args: unknown) => Promise<{ ok: boolean; data?: unknown; error?: string; backend: string }>,
  args: unknown,
  opts?: { config?: Partial<OrchestrationConfig>; maxAttempts?: number },
): Promise<{ entry: QueueEntry; task: AgentTask; result: { ok: boolean; data?: unknown; error?: string; attempts: number; state: TaskState } }> {
  const e = ENTRIES.get(queueId);
  if (!e) throw new QueueError(`Unknown queue entry: ${queueId}`);
  if (e.status !== "failed") throw new QueueError(`Entry ${queueId} is not in failed state (${e.status})`);
  return approveAndRun(queueId, approver, executor, args, opts);
}

/** Test/reset helper. */
export function _clearQueue(): void {
  ENTRIES.clear();
  seq = 0;
}
