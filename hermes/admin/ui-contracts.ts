// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Admin Console: UI Contracts & IA           │
// │ EPIC-002-006E · PHASE 2                                        │
// │ Dashboard information architecture, frontend application       │
// │ boundary, authentication/authorization model, and the typed    │
// │ view-models the future console consumes.                       │
// │                                                 NOTE:          │
// │  This is a CONTRACT/SPEC module. It defines types and the      │
// │  dashboard IA. It contains NO runtime UI code, NO HTTP server,  │
// │  and NO public endpoint. The frontend is a future deliverable   │
// │  gated by security controls (see auth model below).            │
// └─────────────────────────────────────────────────────────────┘

import type { Principal } from "../contracts/platform-api.js";
import type { AdminRole } from "./access.js";

// ════════════════════════════════════════════════════════════════
// 1. INFORMATION ARCHITECTURE
// ════════════════════════════════════════════════════════════════

/**
 * The console is organized into six top-level domains. Each domain is bound
 * to a read surface in hermes/admin/visibility.ts and a control surface in
 * hermes/admin/index.ts. The frontend is a pure consumer of these contracts.
 */
export interface DashboardDomain {
  id: DashboardDomainId;
  label: string;
  description: string;
  /** Minimum admin role that can view this domain. */
  minRole: AdminRole;
  /** Panels rendered within the domain. */
  panels: DashboardPanel[];
}

export type DashboardDomainId =
  | "organization"
  | "infrastructure"
  | "workforce"
  | "security"
  | "operations"
  | "governance";

export interface DashboardPanel {
  id: string;
  title: string;
  /** Bound admin facade function name (documentation for the frontend team). */
  dataSource: string;
  visualization: "table" | "cards" | "matrix" | "timeline" | "feed" | "gauge" | "tree";
}

/** Canonical dashboard IA — single source of truth for the future UI. */
export const DASHBOARD_IA: DashboardDomain[] = [
  {
    id: "organization",
    label: "Organization",
    description: "Applications, environments, and ownership across the org.",
    minRole: "viewer",
    panels: [
      { id: "apps", title: "Applications", dataSource: "adminViewApplications", visualization: "cards" },
      { id: "ownership", title: "Ownership Tree", dataSource: "adminViewApplications", visualization: "tree" },
    ],
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    description: "Providers, resources, lifecycle states, dependencies, and platform health.",
    minRole: "viewer",
    panels: [
      { id: "inventory", title: "Resource Inventory", dataSource: "adminViewResources", visualization: "table" },
      { id: "providers", title: "Provider Coverage", dataSource: "adminViewResources", visualization: "matrix" },
      { id: "lifecycle", title: "Lifecycle States", dataSource: "adminViewResources", visualization: "cards" },
      { id: "dependencies", title: "Dependency Graph", dataSource: "adminViewResources", visualization: "tree" },
      { id: "services", title: "Service Status", dataSource: "adminViewServiceStatus", visualization: "gauge" },
      { id: "rollup", title: "Health Rollup", dataSource: "adminViewPlatformHealth", visualization: "gauge" },
    ],
  },
  {
    id: "workforce",
    label: "AI Workforce",
    description: "Agents, assignments, approvals, permissions, tasks, lifecycle.",
    minRole: "viewer",
    panels: [
      { id: "roster", title: "Agent Roster", dataSource: "adminViewWorkforce", visualization: "cards" },
      { id: "assignments", title: "Assignment Matrix", dataSource: "adminViewWorkforce", visualization: "matrix" },
      { id: "approvals", title: "Approval Queue", dataSource: "adminRequestApproval", visualization: "table" },
      { id: "permissions", title: "Permission Grants", dataSource: "adminResolveAgentPermissions", visualization: "table" },
      { id: "tasks", title: "Task Board", dataSource: "adminListTasks", visualization: "table" },
      { id: "lifecycle", title: "Lifecycle Timeline", dataSource: "adminViewAgent", visualization: "timeline" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    description: "Task history, workforce events, and audit trail.",
    minRole: "viewer",
    panels: [
      { id: "task-history", title: "Task History", dataSource: "adminViewTasks", visualization: "table" },
      { id: "events", title: "Event Stream", dataSource: "adminViewWorkforceEvents", visualization: "feed" },
      { id: "audit", title: "Audit Explorer", dataSource: "adminViewAuditTrail", visualization: "feed" },
    ],
  },
  {
    id: "security",
    label: "Security",
    description: "Identities, permission matrices, and authorization events.",
    minRole: "auditor",
    panels: [
      { id: "perms", title: "Permission Matrix", dataSource: "adminResolveAgentPermissions", visualization: "matrix" },
      { id: "denials", title: "Authorization Denials", dataSource: "adminViewAuthzDenials", visualization: "feed" },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    description: "ADRs, policies, and human approval queues.",
    minRole: "viewer",
    panels: [
      { id: "adrs", title: "Architecture Decisions", dataSource: "adminViewGovernanceAdrs", visualization: "table" },
      { id: "policies", title: "Policy Registry", dataSource: "adminViewGovernancePolicies", visualization: "table" },
      { id: "approvals", title: "Approval Queue", dataSource: "adminViewGovernanceApprovals", visualization: "table" },
    ],
  },
];

// ════════════════════════════════════════════════════════════════
// 2. FRONTEND APPLICATION BOUNDARY
// ════════════════════════════════════════════════════════════════

/**
 * The console frontend is a SEPARATE single-page application. It MUST NOT be
 * served from the AGS Fertility Worker and MUST NOT import Hermes platform
 * implementation files. Its only contact with the platform is a thin BFF
 * (backend-for-frontend) route, itself internal + authenticated.
 *
 * Boundary rules (enforced by architecture, not runtime here):
 *  - Frontend imports ONLY types from this module (contracts), never `hermes/*`
 *    service internals.
 *  - All data arrives through an authenticated BFF that calls the
 *    `hermes/admin` facade with a verified human `Principal`.
 *  - No agent principal, no service-account token, may call the BFF.
 *  - The BFF never exposes `activate`/`deploy:execute` shortcuts — every
 *    activation still traverses the human approval gate in
 *    hermes/services/agents/approval.ts.
 */
export interface ConsoleFrontendBoundary {
  /** Where the SPA is hosted (NOT the app worker). */
  hosting: "internal-admin-subdomain" | "internal-admin-worker";
  /** Entry point enforces authenticated + authorized HUMAN principal. */
  authEntryRequired: true;
  /** Allowed data sources — strictly the admin facade. */
  allowedDataSources: "hermes/admin";
  /** Forbidden: direct platform service imports. */
  forbiddenImports: "hermes/services/*" | "hermes/agents/*" | "hermes/workforce/*";
}

export const CONSOLE_BOUNDARY: ConsoleFrontendBoundary = {
  hosting: "internal-admin-subdomain",
  authEntryRequired: true,
  allowedDataSources: "hermes/admin",
  forbiddenImports: "hermes/services/*",
};

// ════════════════════════════════════════════════════════════════
// 3. AUTHENTICATION & AUTHORIZATION MODEL
// ════════════════════════════════════════════════════════════════

/**
 * Auth model for the console. Mirrors the platform zero-trust posture:
 *  1. Authenticate the human (via the existing Hermes Identity provider).
 *  2. Build a Principal with admin-scoped permissions.
 *  3. Authorize every facade call via hermes/admin/access.ts gates.
 *  4. Audit every administrative action (the facade emits audit events).
 *
 * The console NEVER receives owner credentials, never holds long-lived
 * service tokens for production systems, and cannot bypass the human gate.
 */
export interface ConsoleAuthModel {
  authentication: "hermes-identity-provider";
  principalKind: "human";
  authorization: "admin permission gates (hermes/admin/access.ts)";
  audit: "every admin action emits an audit event";
  forbidden: "agent principals, service accounts, public/anonymous access";
}

export const CONSOLE_AUTH: ConsoleAuthModel = {
  authentication: "hermes-identity-provider",
  principalKind: "human",
  authorization: "admin permission gates (hermes/admin/access.ts)",
  audit: "every admin action emits an audit event",
  forbidden: "agent principals, service accounts, public/anonymous access",
};

// ════════════════════════════════════════════════════════════════
// 4. VIEW-MODELS (typed shapes the frontend renders)
// ════════════════════════════════════════════════════════════════

/** Serializable principal view for the UI header. */
export interface PrincipalView {
  id: string;
  role: AdminRole;
  permissions: string[];
}

/** Standard API envelope returned by the BFF to the SPA. */
export interface ConsoleResponse<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

/** Generic table-column descriptor for reusable table components. */
export interface ColumnDef<T> {
  key: keyof T & string;
  label: string;
  sortable?: boolean;
}

/**
 * Reusable component contract hints. The future UI should ship these as
 * shared components bound to the view-models above:
 *  - <StatusGauge>      — platform health rollup
 *  - <AuditFeed>        — event/audit streams
 *  - <LifecycleTimeline>— per-agent lifecycle
 *  - <PermissionMatrix> — human vs agent permissions side-by-side
 *  - <ApprovalQueue>    — human-gate action buttons
 */
export interface ReusableComponentSpec {
  name: string;
  boundViewModel: string;
  purpose: string;
}

export const REUSABLE_COMPONENTS: ReusableComponentSpec[] = [
  { name: "StatusGauge", boundViewModel: "getPlatformHealth", purpose: "Render service health rollup" },
  { name: "AuditFeed", boundViewModel: "AuditExplorerEntry[]", purpose: "Stream audit/workforce events" },
  { name: "LifecycleTimeline", boundViewModel: "viewAgentDetail", purpose: "Per-agent state history" },
  { name: "PermissionMatrix", boundViewModel: "adminResolveAgentPermissions", purpose: "Side-by-side permission view" },
  { name: "ApprovalQueue", boundViewModel: "adminRequestApproval", purpose: "Human-gate approve/pause/retire" },
];

/** Helper: build a PrincipalView for the UI from a verified human Principal. */
export function toPrincipalView(principal: Principal, role: AdminRole): PrincipalView {
  return { id: principal.id, role, permissions: [...principal.permissions] };
}

// NOTE: This module is types + constants only. It is safe to import into the
// future frontend build, but the frontend must never gain a runtime reference
// to platform services through it.
