// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Workforce Orchestration Admin Read Model     │
// │ EPIC-003-005 · M7                                            │
// │ Produces an admin-facing, READ-ONLY view of orchestration     │
// │ workflows: status, current stage, assigned agents, pending    │
// │ approvals, execution timeline, retries, and failures.          │
// │ Exposed ONLY through the internal admin facade — never a       │
// │ public endpoint.                                              │
// └─────────────────────────────────────────────────────────────┘

import type { Workflow, WorkflowState, WorkflowTimelineEvent } from "../services/workforce/orchestration.js";
import { listWorkflows } from "../services/workforce/orchestration.js";

export interface WorkflowTaskAdminView {
  itemId: string;
  queueId: string;
  capability: string;
  wave: number;
  resolvedVia: "capability-provider" | "workforce-agent" | "unresolved" | "n/a";
  resolvedBackend: string;
  requiresApproval: boolean;
}

export interface WorkflowAdminView {
  id: string;
  title: string;
  applicationId: string;
  requestedBy: string;
  env: string;
  /** Current orchestration state (queued/planning/waiting/running/paused/completed/cancelled/failed). */
  state: WorkflowState;
  /** Current stage = the state plus the latest timeline note. */
  currentStage: string;
  createdAt: string;
  updatedAt: string;
  /** Tasks assigned to agents/providers. */
  tasks: WorkflowTaskAdminView[];
  /** Queue ids currently awaiting human approval. */
  waitingApprovals: string[];
  /** Execution timeline (state changes). */
  timeline: WorkflowTimelineEvent[];
  /** Total retries across all tasks. */
  retryCount: number;
  /** Count of failed tasks. */
  failureCount: number;
}

/** Build a read-only admin view of a single workflow. */
export function toWorkflowAdminView(wf: Workflow): WorkflowAdminView {
  return {
    id: wf.id,
    title: wf.title,
    applicationId: wf.applicationId,
    requestedBy: wf.requestedBy,
    env: wf.env,
    state: wf.state,
    currentStage: wf.timeline.length ? wf.timeline[wf.timeline.length - 1].note ?? wf.state : wf.state,
    createdAt: wf.createdAt,
    updatedAt: wf.updatedAt,
    tasks: wf.tasks.map((t) => ({
      itemId: t.itemId,
      queueId: t.queueId,
      capability: t.capability,
      wave: t.wave,
      resolvedVia: t.dispatch.via,
      resolvedBackend: t.dispatch.backend,
      requiresApproval: t.requiresApproval,
    })),
    waitingApprovals: [...wf.approvals.keys()],
    timeline: wf.timeline,
    retryCount: wf.retryCount,
    failureCount: wf.failureCount,
  };
}

/** Build read-only admin views for all workflows (optionally filtered by state). */
export function buildWorkflowAdminViews(filter?: { state?: WorkflowState }): WorkflowAdminView[] {
  return listWorkflows(filter).map(toWorkflowAdminView);
}
