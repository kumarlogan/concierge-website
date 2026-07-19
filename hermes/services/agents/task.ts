// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Agent Task Framework                         │
// │ EPIC-002-006D · PHASE 3                                        │
// │ Controlled task model. Orcheation FOUNDATION only — this       │
// │ module creates tasks, tracks state, and audits. It does NOT    │
// │ execute arbitrary agent actions. Execution is a separate,      │
// │ authorized runtime concern outside this EPIC's scope.          │
// │                                                 TASK STATES:   │
// │  created → assigned → approved → running → completed|failed|   │
// │  cancelled                                                 │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../audit/event.js";
import type { Principal } from "../../contracts/platform-api.js";

export type TaskState =
  | "created"
  | "assigned"
  | "approved"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/** Allowed task state transitions (orchestration foundation). */
const TASK_TRANSITIONS: Record<TaskState, TaskState[]> = {
  created: ["assigned", "cancelled"],
  assigned: ["approved", "cancelled"],
  approved: ["running", "cancelled"],
  running: ["completed", "failed", "cancelled"],
  completed: [],
  failed: ["assigned", "cancelled"],
  cancelled: [],
};

export function canTransitionTask(from: TaskState, to: TaskState): boolean {
  return TASK_TRANSITIONS[from]?.includes(to) ?? false;
}

/** A controlled task assigned to an agent within an application scope. */
export interface AgentTask {
  id: string;
  /** Agent the task is bound to. */
  agentId: string;
  /** Application the task operates within. */
  applicationId: string;
  /** Human-readable purpose. */
  purpose: string;
  /** Principal that requested the task. */
  requestedBy: string;
  /** Permission scope the task is allowed to exercise (subset of agent perms). */
  permissionsScope: string[];
  state: TaskState;
  /** Audit trail of task lifecycle changes. */
  auditTrail: Array<{
    at: string;
    actor: string;
    from: TaskState;
    to: TaskState;
    note?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

const STORE = new Map<string, AgentTask>();

function nowIso(): string {
  return new Date().toISOString();
}

function genId(): string {
  return `task_${Math.random().toString(36).slice(2, 10)}`;
}

/** Error thrown by the task framework. */
export class TaskError extends Error {}

/** Create a task. State starts at "created" (never auto-running). */
export function createTask(input: {
  agentId: string;
  applicationId: string;
  purpose: string;
  requestedBy: string;
  permissionsScope?: string[];
}): AgentTask {
  const ts = nowIso();
  const task: AgentTask = {
    id: genId(),
    agentId: input.agentId,
    applicationId: input.applicationId,
    purpose: input.purpose,
    requestedBy: input.requestedBy,
    permissionsScope: input.permissionsScope ?? [],
    state: "created",
    auditTrail: [],
    createdAt: ts,
    updatedAt: ts,
  };
  STORE.set(task.id, task);
  emitAudit("task.created", input.requestedBy, {
    taskId: task.id,
    agentId: input.agentId,
    applicationId: input.applicationId,
  });
  return task;
}

function transition(
  task: AgentTask,
  to: TaskState,
  actor: string,
  note?: string,
): AgentTask {
  if (!canTransitionTask(task.state, to)) {
    throw new TaskError(`Illegal task transition: ${task.state} -> ${to}`);
  }
  const from = task.state;
  task.state = to;
  task.updatedAt = nowIso();
  task.auditTrail.push({ at: task.updatedAt, actor, from, to, note });
  emitAudit(`task.${to}`, actor, { taskId: task.id, from, to });
  return task;
}

export function assignTask(taskId: string, actor: string): AgentTask {
  const task = STORE.get(taskId);
  if (!task) throw new TaskError(`Unknown task: ${taskId}`);
  return transition(task, "assigned", actor, "task assigned to agent");
}

export function approveTask(taskId: string, approver: string): AgentTask {
  const task = STORE.get(taskId);
  if (!task) throw new TaskError(`Unknown task: ${taskId}`);
  return transition(task, "approved", approver, "human task approval");
}

export function startTask(taskId: string, actor: string): AgentTask {
  const task = STORE.get(taskId);
  if (!task) throw new TaskError(`Unknown task: ${taskId}`);
  return transition(task, "running", actor, "task started");
}

export function completeTask(taskId: string, actor: string): AgentTask {
  const task = STORE.get(taskId);
  if (!task) throw new TaskError(`Unknown task: ${taskId}`);
  return transition(task, "completed", actor, "task completed");
}

export function failTask(taskId: string, actor: string, reason?: string): AgentTask {
  const task = STORE.get(taskId);
  if (!task) throw new TaskError(`Unknown task: ${taskId}`);
  return transition(task, "failed", actor, reason ?? "task failed");
}

export function cancelTask(taskId: string, actor: string): AgentTask {
  const task = STORE.get(taskId);
  if (!task) throw new TaskError(`Unknown task: ${taskId}`);
  return transition(task, "cancelled", actor, "task cancelled");
}

/** View task status (read-only). */
export function getTask(taskId: string): AgentTask | undefined {
  return STORE.get(taskId);
}

/** List tasks with optional filters. */
export function listTasks(filter?: {
  agentId?: string;
  applicationId?: string;
  state?: TaskState;
}): AgentTask[] {
  let items = [...STORE.values()];
  if (filter?.agentId) items = items.filter((t) => t.agentId === filter.agentId);
  if (filter?.applicationId)
    items = items.filter((t) => t.applicationId === filter.applicationId);
  if (filter?.state) items = items.filter((t) => t.state === filter.state);
  return items;
}

/** Test/reset helper. */
export function _clearTasks(): void {
  STORE.clear();
}
