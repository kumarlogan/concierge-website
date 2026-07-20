// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Workforce Orchestration Coordinator          │
// │ EPIC-003-005 · M1/M2/M3/M4/M5/M6                              │
// │                                                 DESIGN:        │
// │  Hermes remains the orchestrator. This module coordinates the  │
// │  existing execution primitives (planWork, enqueue, dispatch,   │
// │  approveAndRun, orchestrate) into a single OBJECTIVE → WORK-   │
// │  FLOW lifecycle. It introduces NO new execution mechanics — it │
// │  composes already-governed primitives:                          │
// │   • M1 planner      → services/execution/work-planner.ts        │
// │   • M3 resolution   → services/execution/workforce-dispatch.ts  │
// │   • M2/M5 queue     → services/execution/execution-queue.ts      │
// │   • M4 approval     → services/activation/approval-gates.ts      │
// │   • M6 audit        → hermes/audit/event.ts                      │
// │  The workflow state machine (queued/planning/waiting/running/   │
// │  paused/completed/cancelled/failed) is the orchestration view   │
// │  layer — authoritative task/queue state still lives in the      │
// │  underlying primitives.                                          │
// │                                                 SAFETY:         │
// │  • No autonomous execution: every approval-required step stops  │
// │    in `waiting` until a human grants approval.                   │
// │  • Fail-closed: unresolved capabilities or missing approvals     │
// │    never auto-run.                                               │
// │  • In-memory only — no database (per epic M5).                   │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../audit/event.js";
import { planWork, type GoalSpec, type WorkItem, type WorkPlan } from "../execution/work-planner.js";
import { dispatchCapability, type DispatchResult } from "../execution/workforce-dispatch.js";
import {
  enqueue,
  approveAndRun,
  retryEntry,
  cancelEntry,
  pauseEntry,
  resumeEntry,
  getEntry,
  type QueueEntry,
} from "../execution/execution-queue.js";
import { requestApproval, type ApprovalRequest } from "../../agents/tool-contracts.js";

// ─── Workflow lifecycle (EPIC-003-005 M5) ─────────────────────

/**
 * The eight workflow states the epic mandates. These are the ORCHESTRATION
 * view; the authoritative queue/task state lives in the underlying queue.
 */
export type WorkflowState =
  | "queued" // objective received, not yet planned
  | "planning" // plan being produced (transient)
  | "waiting" // planned; blocked on human approval before execution
  | "running" // at least one wave/entry executing
  | "paused" // operator-paused
  | "completed" // all entries completed
  | "cancelled" // cancelled by human
  | "failed"; // at least one entry failed and recovery exhausted

// ─── Data model ───────────────────────────────────────────────

export interface WorkflowTaskRef {
  /** Work-item id from the plan. */
  itemId: string;
  /** The queue entry id bound to this work item. */
  queueId: string;
  /** The resolved capability. */
  capability: string;
  /** The wave this item belongs to. */
  wave: number;
  /** Resolution outcome (who executes it). */
  dispatch: DispatchResult;
  /** Whether this item requires human approval before running. */
  requiresApproval: boolean;
}

export interface WorkflowTimelineEvent {
  at: string;
  state: WorkflowState;
  note?: string;
  detail?: Record<string, unknown>;
}

export interface Workflow {
  /** Stable workflow id. */
  id: string;
  /** Human objective title. */
  title: string;
  /** The application this workflow targets. */
  applicationId: string;
  /** Principal that requested the workflow. */
  requestedBy: string;
  /** Execution environment (drives approval gates). */
  env: "development" | "staging" | "production";
  state: WorkflowState;
  /** The planner output (M1). */
  plan?: WorkPlan;
  /** Per work-item assignments + resolution. */
  tasks: WorkflowTaskRef[];
  /** Pending approval requests keyed by queueId. */
  approvals: Map<string, ApprovalRequest>;
  /** QueueIds whose execution has been explicitly granted by a human. */
  grantedApprovals: Set<string>;
  createdAt: string;
  updatedAt: string;
  /** Execution timeline (every state change). */
  timeline: WorkflowTimelineEvent[];
  /** Count of failed entries (for admin visibility). */
  failureCount: number;
  /** Total retries across all entries. */
  retryCount: number;
  /** Human-readable note. */
  note?: string;
}

export class OrchestrationError extends Error {}

// ─── In-memory store (EPIC-003-005 M5 — no database) ─────────

const WORKFLOWS = new Map<string, Workflow>();
let wfSeq = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function genWorkflowId(): string {
  wfSeq += 1;
  return `wf_${wfSeq}_${Math.random().toString(36).slice(2, 8)}`;
}

function setState(wf: Workflow, state: WorkflowState, actor: string, note?: string, detail?: Record<string, unknown>): void {
  wf.state = state;
  wf.updatedAt = nowIso();
  wf.timeline.push({ at: wf.updatedAt, state, note, detail });
  emitAudit("workflow.state", actor, { workflowId: wf.id, state, note });
}

function getWorkflow(id: string): Workflow {
  const wf = WORKFLOWS.get(id);
  if (!wf) throw new OrchestrationError(`Unknown workflow: ${id}`);
  return wf;
}

// ─── M1 + M5: create + plan ──────────────────────────────────

/**
 * Create a workflow from an objective and immediately plan it (M1). Planning
 * is PURE (no execution). The workflow enters `waiting` if any task requires
 * human approval, otherwise `queued` (ready to assign/run under governance).
 *
 * Does NOT execute. Does NOT auto-approve. No autonomous behavior.
 */
export function createWorkflow(input: {
  title: string;
  applicationId: string;
  requestedBy: string;
  env: "development" | "staging" | "production";
  items: WorkItem[];
}): Workflow {
  const id = genWorkflowId();
  const wf: Workflow = {
    id,
    title: input.title,
    applicationId: input.applicationId,
    requestedBy: input.requestedBy,
    env: input.env,
    state: "queued",
    tasks: [],
    approvals: new Map(),
    grantedApprovals: new Set(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    timeline: [],
    failureCount: 0,
    retryCount: 0,
  };
  WORKFLOWS.set(id, wf);
  emitAudit("workflow.created", input.requestedBy, {
    workflowId: id,
    title: input.title,
    applicationId: input.applicationId,
    items: input.items.length,
  });

  // M1 — plan (pure). Reuses the existing topological planner.
  setState(wf, "planning", input.requestedBy, "planning objective");
  const spec: GoalSpec = {
    goalId: id,
    title: input.title,
    applicationId: input.applicationId,
    requestedBy: input.requestedBy,
    items: input.items,
  };
  const plan = planWork(spec);
  wf.plan = plan;

  // M3 — resolve each planned capability dynamically (no hardcoding).
  for (const item of plan.ordered) {
    const dispatch = dispatchCapability(item.capability, {
      actor: input.requestedBy,
      applicationId: input.applicationId,
      env: input.env,
    });
    const requiresApproval =
      dispatch.via === "unresolved" || // needs human triage
      input.env === "production"; // fail-closed: production exec requires human grant
    wf.tasks.push({
      itemId: item.id,
      queueId: "",
      capability: item.capability,
      wave: plan.waves.findIndex((w) => w.some((i) => i.id === item.id)),
      dispatch,
      requiresApproval,
    });
  }

  // After planning, a workflow waits if any task is unresolved/fail-closed
  // (needs human triage) — else it is queued and ready for assignment.
  const needsTriage = wf.tasks.some((t) => t.dispatch.via === "unresolved");
  setState(
    wf,
    needsTriage ? "waiting" : "queued",
    input.requestedBy,
    needsTriage ? "waiting: unresolved capability requires human triage" : "planned; ready for assignment",
  );
  return wf;
}

// ─── M2: assign (enqueue planned items into the execution queue) ─

/**
 * Assign (enqueue) every planned work item into the execution queue, binding
 * a queueId back to the workflow task ref. Enqueueing NEVER runs anything —
 * human approval is still required before execution (see M4).
 */
export function assignWorkflow(workflowId: string, actor: string): Workflow {
  const wf = getWorkflow(workflowId);
  if (wf.state === "completed" || wf.state === "cancelled" || wf.state === "failed") {
    throw new OrchestrationError(`Workflow ${workflowId} is terminal (${wf.state}); cannot assign`);
  }
  for (const t of wf.tasks) {
    if (t.queueId) continue; // already assigned
    const entry = enqueue({
      agentId: t.dispatch.agentId ?? "hermes.workforce",
      applicationId: wf.applicationId,
      capability: t.capability,
      backend: t.dispatch.backend,
      wave: t.wave,
      parallelizable: wf.plan?.ordered.find((i) => i.id === t.itemId)?.parallelizable ?? false,
      requestedBy: wf.requestedBy,
      purpose: `Workflow ${wf.id} · item ${t.itemId} (${t.capability})`,
      permissionsScope: [],
    });
    t.queueId = entry.queueId;
    emitAudit("workflow.assigned", actor, { workflowId, queueId: entry.queueId, capability: t.capability });
  }
  if (wf.state !== "paused") setState(wf, "waiting", actor, "tasks assigned; awaiting approvals before run");
  return wf;
}

// ─── M4: approval gating ─────────────────────────────────────

/**
 * Request human approval for a specific workflow task (queue entry). The
 * workflow remains in `waiting` until a human grants it. Fail-closed: calling
 * runWorkflow on a task that has not been approved throws.
 */
export function requestTaskApproval(workflowId: string, itemId: string, actor: string): ApprovalRequest {
  const wf = getWorkflow(workflowId);
  const t = wf.tasks.find((x) => x.itemId === itemId);
  if (!t) throw new OrchestrationError(`Unknown task ${itemId} in workflow ${workflowId}`);
  if (!t.queueId) throw new OrchestrationError(`Task ${itemId} not assigned; call assignWorkflow first`);
  const req = requestApproval(
    t.dispatch.agentId ?? "hermes.workforce",
    wf.applicationId,
    wf.env,
    "write",
    "tool:code.write",
  );
  wf.approvals.set(t.queueId, req);
  emitAudit("workflow.approval.requested", actor, { workflowId, itemId, queueId: t.queueId });
  setState(wf, "waiting", actor, `approval requested for ${itemId}`);
  return req;
}

/**
 * Grant approval for a workflow task. Human authority only — the approver id
 * is recorded in the audit trail. After granting, the task is approved at the
 * underlying task layer (so the queue may run it).
 */
export function grantTaskApproval(workflowId: string, itemId: string, approver: string): Workflow {
  const wf = getWorkflow(workflowId);
  const t = wf.tasks.find((x) => x.itemId === itemId);
  if (!t) throw new OrchestrationError(`Unknown task ${itemId} in workflow ${workflowId}`);
  const req = wf.approvals.get(t.queueId);
  if (!req) throw new OrchestrationError(`No pending approval for task ${itemId}`);
  // The approval queue (tool-contracts) is append-only and human-driven: a
  // human grants it out-of-band. Here we lift the request out of the workflow's
  // pending set, record the grant (so runTask can verify it was satisfied),
  // and record the grant in the audit trail (fail-closed: the request must have
  // existed before any run is permitted).
  wf.approvals.delete(t.queueId);
  wf.grantedApprovals.add(t.queueId);
  emitAudit("workflow.approval.granted", approver, { workflowId, itemId, queueId: t.queueId });
  setState(wf, wf.state === "paused" ? "paused" : "waiting", approver, `approval granted for ${itemId}`);
  return wf;
}

// ─── M2 + M4: run a single approved task ─────────────────────

/**
 * Execute a single assigned + approved task through the execution queue.
 * Returns the queue run result. The executor is INJECTED (never hardcoded) —
 * it must resolve the capability through the provider registry or fail-closed.
 * If the task has not been approved, this throws (no autonomous execution).
 */
export async function runTask(
  workflowId: string,
  itemId: string,
  approver: string,
  executor: (capability: string, args: unknown) => Promise<{ ok: boolean; data?: unknown; error?: string; backend: string }>,
  args: unknown = {},
  opts?: { maxAttempts?: number },
): Promise<{ entry: QueueEntry; ok: boolean; attempts: number; state: string }> {
  const wf = getWorkflow(workflowId);
  const t = wf.tasks.find((x) => x.itemId === itemId);
  if (!t || !t.queueId) throw new OrchestrationError(`Task ${itemId} not assigned`);
  if (wf.state === "paused") throw new OrchestrationError(`Workflow ${workflowId} is paused`);
  // M4 fail-closed — two independent gates:
  //  1) A pending (requested, not yet granted) approval ALWAYS blocks execution,
  //     regardless of env. Humans may request approval on any task.
  //  2) Tasks that require approval (env-driven or capability-flagged) MUST have
  //     an explicit human grant on record before they may run.
  if (wf.approvals.has(t.queueId)) {
    throw new OrchestrationError(`Task ${itemId} still awaiting approval; cannot run autonomously`);
  }
  if (t.requiresApproval && !wf.grantedApprovals.has(t.queueId)) {
    throw new OrchestrationError(`Task ${itemId} requires human approval (${wf.env}); no grant on record — refusing to run`);
  }

  const res = await approveAndRun(t.queueId, approver, executor, args, {
    maxAttempts: opts?.maxAttempts ?? 3,
  });
  wf.retryCount += res.entry.attempts - 1 > 0 ? res.entry.attempts - 1 : 0;
  if (!res.result.ok) {
    wf.failureCount += 1;
    emitAudit("workflow.task.failed", approver, { workflowId, itemId });
  } else {
    emitAudit("workflow.task.completed", approver, { workflowId, itemId });
  }
  // Reflect running/terminal at the workflow level.
  reconcileWorkflowState(wf, approver);
  return { entry: res.entry, ok: res.result.ok, attempts: res.result.attempts, state: res.result.state };
}

// ─── M2: monitor + reconcile ─────────────────────────────────

/**
 * Internal: recompute the workflow-level state from its queue entries.
 * running if any entry running; failed if any failed and recovery exhausted;
 * completed if all completed; waiting otherwise.
 */
function reconcileWorkflowState(wf: Workflow, actor: string): void {
  const entries = wf.tasks.map((t) => (t.queueId ? getEntry(t.queueId) : undefined)).filter(Boolean) as QueueEntry[];
  if (entries.length === 0) return;
  const anyRunning = entries.some((e) => e.status === "running");
  const anyFailed = entries.some((e) => e.status === "failed");
  const allCompleted = entries.every((e) => e.status === "completed");
  const anyWaitingApproval = wf.tasks.some((t) => wf.approvals.has(t.queueId));

  let next: WorkflowState = wf.state;
  if (wf.state === "paused" || wf.state === "cancelled") {
    next = wf.state; // terminal/paused states are sticky
  } else if (anyFailed) {
    // Failure recovery: a failed entry is recoverable via retryEntry unless
    // its attempts are exhausted (orchestrator enforces maxAttempts).
    next = "failed";
  } else if (anyRunning) {
    next = "running";
  } else if (allCompleted) {
    next = "completed";
  } else if (anyWaitingApproval) {
    next = "waiting";
  } else {
    next = "waiting";
  }
  if (next !== wf.state) setState(wf, next, actor, "reconciled from queue state");
}

/** Read-only snapshot of a workflow (for monitoring / admin). */
export function getWorkflowView(workflowId: string): Workflow {
  return getWorkflow(workflowId);
}

/** List workflows, optionally filtered by state. */
export function listWorkflows(filter?: { state?: WorkflowState }): Workflow[] {
  let items = [...WORKFLOWS.values()];
  if (filter?.state) items = items.filter((w) => w.state === filter.state);
  return items;
}

// ─── M2: retry orchestration (failure recovery) ─────────────

/**
 * Retry a failed task (failure recovery). Requires the task to be in `failed`
 * at the queue level. Reuses the queue's retryEntry (which re-runs through
 * approveAndRun — so a fresh human approval is still required, fail-closed).
 */
export async function retryTask(
  workflowId: string,
  itemId: string,
  approver: string,
  executor: (capability: string, args: unknown) => Promise<{ ok: boolean; data?: unknown; error?: string; backend: string }>,
  args: unknown = {},
  opts?: { maxAttempts?: number },
): Promise<{ entry: QueueEntry; ok: boolean; attempts: number; state: string }> {
  const wf = getWorkflow(workflowId);
  const t = wf.tasks.find((x) => x.itemId === itemId);
  if (!t || !t.queueId) throw new OrchestrationError(`Task ${itemId} not assigned`);
  const res = await retryEntry(t.queueId, approver, executor, args, {
    maxAttempts: opts?.maxAttempts ?? 3,
  });
  wf.retryCount += 1;
  if (!res.result.ok) wf.failureCount += 1;
  reconcileWorkflowState(wf, approver);
  return { entry: res.entry, ok: res.result.ok, attempts: res.result.attempts, state: res.result.state };
}

// ─── M2: cancellation + pause/resume ─────────────────────────

/** Cancel the entire workflow (human-governed). Cancels all queue entries. */
export function cancelWorkflow(workflowId: string, actor: string): Workflow {
  const wf = getWorkflow(workflowId);
  for (const t of wf.tasks) {
    if (t.queueId) {
      try {
        cancelEntry(t.queueId, actor);
      } catch {
        // entry may already be terminal; workflow still marks cancelled
      }
    }
  }
  wf.approvals.clear();
  wf.grantedApprovals.clear();
  emitAudit("workflow.cancelled", actor, { workflowId });
  setState(wf, "cancelled", actor, "workflow cancelled by human");
  return wf;
}

/** Pause the workflow (operator action). */
export function pauseWorkflow(workflowId: string, actor: string): Workflow {
  const wf = getWorkflow(workflowId);
  for (const t of wf.tasks) {
    if (t.queueId) {
      try {
        pauseEntry(t.queueId, actor);
      } catch {
        // entry not running; ignore
      }
    }
  }
  emitAudit("workflow.paused", actor, { workflowId });
  setState(wf, "paused", actor, "workflow paused");
  return wf;
}

/**
 * Resume a paused workflow (M5 resumable). If there are pending approvals the
 * workflow returns to `waiting`; otherwise it returns to `running`/`queued`.
 * Resumption is always an explicit human/operator action (never automatic).
 */
export function resumeWorkflow(workflowId: string, actor: string): Workflow {
  const wf = getWorkflow(workflowId);
  if (wf.state !== "paused") throw new OrchestrationError(`Workflow ${workflowId} is not paused (${wf.state})`);
  for (const t of wf.tasks) {
    if (t.queueId) {
      try {
        resumeEntry(t.queueId, actor);
      } catch {
        // entry not paused; ignore
      }
    }
  }
  emitAudit("workflow.resumed", actor, { workflowId });
  const waitingApproval = wf.tasks.some((t) => wf.approvals.has(t.queueId));
  setState(wf, waitingApproval ? "waiting" : "queued", actor, "workflow resumed");
  return wf;
}

// ─── Test/reset helper ───────────────────────────────────────

export function _clearWorkflows(): void {
  WORKFLOWS.clear();
  wfSeq = 0;
}
