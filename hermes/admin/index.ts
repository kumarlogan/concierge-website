// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Admin Platform Facade                       │
// │ EPIC-002-006E · PHASE 1                                        │
// │ Single internal entry point for the future Hermes Admin       │
// │ Console. Aggregates visibility (read) + control (mutating)    │
// │ over the six dashboard domains.                                │
// │                                                 SECURITY:      │
// │  • INTERNAL ONLY — never exposed via a public HTTP route.     │
// │  • Every mutating op requires a human principal + permission  │
// │    gate (see ./access.ts). Reads require an admin read perm.  │
// │  • No public exposure (no fetch/http handler exported).       │
// └─────────────────────────────────────────────────────────────┘

import type { Principal } from "../contracts/platform-api.js";
import { requireDomainRead, requireAdminPermission } from "./access.js";
import {
  viewApplications,
  viewResources,
  viewAgentRoster,
  viewAgentDetail,
  viewTasks,
  viewWorkforceEvents,
  viewAuditTrail,
  viewAuthzDenials,
  getServiceStatuses,
  getPlatformHealth,
} from "./visibility.js";
import {
  apiRequestApproval,
  apiApproveAgent,
  apiPauseAgent,
  apiRetireAgent,
  apiEnableAgent,
  apiDisableAgent,
  apiCreateTask,
  apiAssignTask,
  apiListTasks,
  apiResolveAgentPermissions,
  apiAuthorizeAgentAction,
  ApprovalError,
} from "../workforce/api.js";
import { buildSecurityAdminView } from "../services/security/admin-view.js";
import { listSecurityReviews } from "../services/security/security-store.js";

// ─── READ DOMAIN: ORGANIZATION ──────────────────────────────────

export function adminViewApplications(principal: Principal) {
  requireDomainRead(principal, "organization");
  return viewApplications();
}

// ─── READ DOMAIN: INFRASTRUCTURE ───────────────────────────────

export function adminViewResources(principal: Principal, filter?: Parameters<typeof viewResources>[0]) {
  requireDomainRead(principal, "infrastructure");
  return viewResources(filter);
}

// ─── READ DOMAIN: AI WORKFORCE ─────────────────────────────────

export function adminViewWorkforce(principal: Principal) {
  requireDomainRead(principal, "workforce");
  return viewAgentRoster();
}

export function adminViewAgent(principal: Principal, agentId: string) {
  requireDomainRead(principal, "workforce");
  return viewAgentDetail(agentId);
}

// ─── READ DOMAIN: OPERATIONS ───────────────────────────────────

export function adminViewTasks(principal: Principal, filter?: Parameters<typeof viewTasks>[0]) {
  requireDomainRead(principal, "operations");
  return viewTasks(filter);
}

export function adminViewWorkforceEvents(principal: Principal) {
  requireDomainRead(principal, "operations");
  return viewWorkforceEvents();
}

// ─── READ DOMAIN: SECURITY ─────────────────────────────────────

export function adminViewAuditTrail(principal: Principal, filter?: Parameters<typeof viewAuditTrail>[0]) {
  requireAdminPermission(principal, "hermes:admin:audit-read");
  return viewAuditTrail(filter);
}

export function adminViewAuthzDenials(principal: Principal) {
  requireAdminPermission(principal, "hermes:admin:audit-read");
  return viewAuthzDenials();
}

// ─── READ DOMAIN: INFRASTRUCTURE (service status / health) ─────

export function adminViewServiceStatus(principal: Principal) {
  requireDomainRead(principal, "infrastructure");
  return getServiceStatuses();
}

export function adminViewPlatformHealth(principal: Principal) {
  requireDomainRead(principal, "infrastructure");
  return getPlatformHealth();
}

// ─── CONTROL: AGENT LIFECYCLE (human-gated) ───────────────────

/** Request approval to bring an assigned agent toward activation. */
export function adminRequestApproval(principal: Principal, agentId: string) {
  requireAdminPermission(principal, "hermes:admin:workforce-write");
  return apiRequestApproval(agentId, principal);
}

/** Approve an agent (assigned → approved). Human authority required. */
export function adminApproveAgent(principal: Principal, agentId: string) {
  requireAdminPermission(principal, "hermes:admin:workforce-write");
  return apiApproveAgent(agentId, principal);
}

/** Pause an active agent. */
export function adminPauseAgent(principal: Principal, agentId: string) {
  requireAdminPermission(principal, "hermes:admin:workforce-write");
  return apiPauseAgent(agentId, principal);
}

/** Retire an agent (terminal). */
export function adminRetireAgent(principal: Principal, agentId: string) {
  requireAdminPermission(principal, "hermes:admin:workforce-write");
  return apiRetireAgent(agentId, principal);
}

/** Enable an agent for assignment (operator-gated; flips disabled → enabled). */
export function adminEnableAgent(principal: Principal, agentId: string) {
  requireAdminPermission(principal, "hermes:admin:workforce-write");
  return apiEnableAgent(agentId, principal);
}

/** Disable an agent. */
export function adminDisableAgent(principal: Principal, agentId: string) {
  requireAdminPermission(principal, "hermes:admin:workforce-write");
  return apiDisableAgent(agentId, principal);
}

// ─── CONTROL: TASKS ────────────────────────────────────────────

/** Create a controlled task (requires explicit human requester). */
export function adminCreateTask(
  principal: Principal,
  params: { agentId: string; applicationId: string; purpose: string; permissionsScope?: string[] },
) {
  requireAdminPermission(principal, "hermes:admin:task-write");
  return apiCreateTask({
    ...params,
    requestedBy: principal.id,
  });
}

export function adminAssignTask(principal: Principal, taskId: string) {
  requireAdminPermission(principal, "hermes:admin:task-write");
  return apiAssignTask(taskId, principal.id);
}

export function adminListTasks(principal: Principal, filter?: Parameters<typeof apiListTasks>[0]) {
  requireDomainRead(principal, "operations");
  return apiListTasks(filter);
}

// ─── SECURITY BOUNDARY CHECKS (read-only introspection) ───────

export function adminResolveAgentPermissions(principal: Principal, agentId: string) {
  requireDomainRead(principal, "security");
  return apiResolveAgentPermissions(agentId);
}

export function adminAuthorizeAgentAction(
  principal: Principal,
  agentId: string,
  perm: Parameters<typeof apiAuthorizeAgentAction>[1],
  context?: Parameters<typeof apiAuthorizeAgentAction>[2],
) {
  requireDomainRead(principal, "security");
  return apiAuthorizeAgentAction(agentId, perm, context);
}

// ─── READ DOMAIN: SECURITY (Security Automation visibility) ─────

/**
 * Admin-only view of the Security Automation platform. Requires the
 * `security` domain read permission (human principal). Exposes latest scans,
 * findings summary, overall risk, approval state, and provider health.
 * INTERNAL ONLY — no public HTTP route, consistent with the admin facade.
 */
export function adminViewSecurity(principal: Principal) {
  requireDomainRead(principal, "security");
  return buildSecurityAdminView(listSecurityReviews());
}

/** Re-export error + access surface for callers. */
export { ApprovalError };
export * from "./access.js";

// NOTE: This module deliberately exports NO HTTP/fetch handler. It is callable
// only from inside the trusted worker runtime (gated by authentication +
// authorization upstream). External exposure is prohibited by EPIC rules and
// the access gate in ./access.ts.
