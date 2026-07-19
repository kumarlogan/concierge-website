// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Internal Workforce API Contracts             │
// │ EPIC-002-006D · PHASE 7                                        │
// │ Internal-only orchestration facade over the workforce modules  │
// │ (assignment, approval, task, permissions, memory, events).     │
// │                                                 SECURITY:      │
// │  • INTERNAL ONLY — never exposed via a public route.           │
// │  • Every operation is authenticated + authorized + audited.    │
// │  • No public exposure (no fetch/http handler exported).        │
// └─────────────────────────────────────────────────────────────┘

import type { Principal } from "../contracts/platform-api.js";
import { getAgent, listAgents } from "../agents/registry.js";
import { assignAgent, listAssignments, type AgentAssignment } from "../services/agents/assignment.js";
import {
  requestAgentApproval,
  approveAgent,
  pauseAgent,
  retireAgent,
  enableAgentForAssignment,
  disableAgentForAssignment,
  ActivationError,
  ApprovalError,
} from "../services/agents/approval.js";
import {
  createTask,
  assignTask,
  approveTask,
  startTask,
  completeTask,
  failTask,
  cancelTask,
  listTasks,
  getTask,
  type AgentTask,
  type TaskState,
} from "../services/agents/task.js";
import {
  resolveAgentPermissions,
  authorizeAgentAction,
  type AgentPermission,
} from "../services/agents/permissions.js";
import { evaluateMemoryAccess, type MemoryAccessRequest } from "../services/agents/memory.js";
import { emitWorkforceEvent, WORKFORCE_EVENTS } from "./events.js";

// ─── AGENTS ────────────────────────────────────────────────────────

export function apiListAgents(): ReturnType<typeof listAgents> {
  return listAgents();
}

export function apiAssignAgent(params: {
  agentId: string;
  applicationId: string;
  principal: Principal;
}): AgentAssignment {
  return assignAgent(params.agentId, params.applicationId, params.principal);
}

export function apiRequestApproval(agentId: string, principal: Principal): {
  agent: ReturnType<typeof getAgent>;
  assignment?: AgentAssignment;
} {
  return requestAgentApproval(agentId, principal);
}

export function apiApproveAgent(agentId: string, approver: Principal): {
  agent: ReturnType<typeof getAgent>;
  assignment?: AgentAssignment;
} {
  return approveAgent(agentId, approver);
}

export function apiPauseAgent(agentId: string, principal: Principal): {
  agent: ReturnType<typeof getAgent>;
  assignment?: AgentAssignment;
} {
  return pauseAgent(agentId, principal);
}

export function apiRetireAgent(agentId: string, principal: Principal): {
  agent: ReturnType<typeof getAgent>;
  assignment?: AgentAssignment;
} {
  return retireAgent(agentId, principal);
}

/** Enable an agent for assignment (operator-gated; flips disabled → enabled). */
export function apiEnableAgent(agentId: string, principal: Principal): ReturnType<typeof getAgent> {
  return enableAgentForAssignment(agentId, principal);
}

/** Disable an agent (operator-gated; flips enabled → disabled). */
export function apiDisableAgent(agentId: string, principal: Principal): ReturnType<typeof getAgent> {
  return disableAgentForAssignment(agentId, principal);
}

// ─── TASKS ─────────────────────────────────────────────────────────

export function apiCreateTask(params: {
  agentId: string;
  applicationId: string;
  purpose: string;
  requestedBy: string;
  permissionsScope?: string[];
}): AgentTask {
  return createTask(params);
}

export function apiAssignTask(taskId: string, actor: string): AgentTask {
  return assignTask(taskId, actor);
}

export function apiViewTaskStatus(taskId: string): AgentTask | undefined {
  return getTask(taskId);
}

export function apiListTasks(filter?: {
  agentId?: string;
  applicationId?: string;
  state?: TaskState;
}): AgentTask[] {
  return listTasks(filter);
}

// ─── SECURITY (internal boundary checks) ───────────────────────────

export function apiResolveAgentPermissions(agentId: string): AgentPermission[] {
  return [...resolveAgentPermissions(agentId)];
}

export function apiAuthorizeAgentAction(
  agentId: string,
  perm: AgentPermission,
  context?: { taskId?: string; applicationId?: string },
) {
  return authorizeAgentAction(agentId, perm, context);
}

export function apiEvaluateMemoryAccess(req: MemoryAccessRequest) {
  return evaluateMemoryAccess(req);
}

/** Re-export error types for callers. */
export { ActivationError, ApprovalError };

/** Re-export event catalog for the admin console. */
export { WORKFORCE_EVENTS, emitWorkforceEvent };

// NOTE: This module deliberately exports NO HTTP/fetch handler. It is callable
// only from inside the trusted worker runtime (gated by authentication +
// authorization upstream). External exposure is prohibited by EPIC rules.
