// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Admin Console — Frontend View-Models                   │
// │ EPIC-002-006F · PHASE 1                                        │
// │ Typed shapes the Admin Console SPA renders. These are PURE     │
// │ TYPE definitions — they carry no runtime logic and import NO   │
// │ platform service code. The BFF (hermes/admin/bff) produces     │
// │ plain JSON matching these shapes; the SPA consumes them.        │
// │                                                 BOUNDARY:      │
// │  • NO import from hermes/services/*, hermes/agents/*,           │
// │    hermes/workforce/* (implementation). Types only, from        │
// │    hermes/admin/ui-contracts.ts and hermes/admin/access.ts.    │
// └─────────────────────────────────────────────────────────────┘

import type { AdminRole, AdminPermission } from "../access.js";
import type { PrincipalView, ConsoleResponse } from "../ui-contracts.js";

// ════════════════════════════════════════════════════════════════
// 1. ORGANIZATION DOMAIN
// ════════════════════════════════════════════════════════════════

export interface OrgApplicationView {
  id: string;
  resources: number;
  environments: string[];
}

export interface OwnershipNode {
  id: string;
  label: string;
  children: OwnershipNode[];
}

// ════════════════════════════════════════════════════════════════
// 2. INFRASTRUCTURE DOMAIN
// ════════════════════════════════════════════════════════════════

export type LifecycleState =
  | "provisioned"
  | "active"
  | "paused"
  | "deprecated"
  | "retired";

export interface ResourceView {
  id: string;
  kind: string;
  owner: string;
  env: string;
  provider: string;
  region?: string;
  state: LifecycleState;
}

export interface ProviderCoverage {
  provider: string;
  resourceCount: number;
  byKind: Record<string, number>;
}

// ════════════════════════════════════════════════════════════════
// 3. AI WORKFORCE DOMAIN
// ════════════════════════════════════════════════════════════════

export type AgentActivationState =
  | "registered"
  | "assigned"
  | "approved"
  | "active"
  | "paused"
  | "retired"
  | "disabled";

export type MemoryScopeView = "isolated" | "shared" | "global";

/** A single agent as rendered in the console roster. */
export interface AgentCardView {
  id: string;
  name: string;
  kind: string;
  state: AgentActivationState;
  /** Hard invariant — rendered as a warning badge when true. */
  disabledByDefault: boolean;
  /** Hard invariant — rendered as a warning badge when true. */
  nonAutonomous: boolean;
  assignedApplications: string[];
  permissions: string[];
  toolGrants: string[];
  memoryScope: MemoryScopeView;
  registeredAt?: string;
}

/** Workforce rollup for the roster header. */
export interface WorkforceSummaryView {
  total: number;
  disabled: number;
  approved: number;
  active: number;
  assigned: number;
}

// ════════════════════════════════════════════════════════════════
// 4. SECURITY DOMAIN
// ════════════════════════════════════════════════════════════════

export interface AuditEntryView {
  type: string;
  actor: string;
  at: string;
  detail: Record<string, unknown>;
}

export interface PermissionMatrixRow {
  subject: string; // agent id or "human:<role>"
  permissions: string[];
}

// ════════════════════════════════════════════════════════════════
// 5. OPERATIONS DOMAIN
// ════════════════════════════════════════════════════════════════

export type TaskState =
  | "requested"
  | "assigned"
  | "approved"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface TaskView {
  id: string;
  agentId: string;
  applicationId: string;
  purpose: string;
  state: TaskState;
  requestedBy: string;
}

export interface ServiceHealthView {
  id: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  detail?: string;
}

// ════════════════════════════════════════════════════════════════
// 6. GOVERNANCE DOMAIN
// ════════════════════════════════════════════════════════════════

export interface AdrView {
  id: string;
  title: string;
  status: "proposed" | "accepted" | "deprecated" | "superseded";
  date?: string;
}

export interface PolicyView {
  id: string;
  name: string;
  enforced: boolean;
}

export interface ApprovalRequestView {
  id: string;
  kind: "agent-activate" | "agent-pause" | "agent-retire" | "task-create";
  target: string;
  requestedBy: string;
  state: "pending" | "approved" | "rejected";
}

// ════════════════════════════════════════════════════════════════
// AGGREGATE DASHBOARD PAYLOAD
// ════════════════════════════════════════════════════════════════

/** Shape returned by the BFF for the full console bootstrap. */
export interface ConsoleBootstrap {
  principal: PrincipalView;
  role: AdminRole;
  domains: Record<
    string,
    ConsoleResponse<unknown>
  >;
}

/** Re-export shared contract types the SPA also needs. */
export type { AdminRole, AdminPermission, PrincipalView, ConsoleResponse };
