// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Admin Console — SPA Shell (framework-agnostic)          │
// │ EPIC-002-006F · PHASE 1                                        │
// │ A minimal, dependency-free skeleton of the Admin Console SPA.  │
// │ It renders domains/panels from the IA using the permission-     │
// │ aware helpers, pulling data through a BffClient interface.      │
// │                                                 BOUNDARY:      │
// │  • Imports ONLY types + constants from hermes/admin contracts. │
// │  • Never imports hermes/services/*, hermes/agents/*,            │
// │    hermes/workforce/* implementation files.                     │
// │  • Fails closed: unknown domain / missing permission => hidden. │
// └─────────────────────────────────────────────────────────────┘

import type { DashboardDomain, PrincipalView } from "../ui-contracts.js";
import type { Principal } from "../../contracts/platform-api.js";
import { DASHBOARD_IA, toPrincipalView } from "../ui-contracts.js";
import { deriveRoleHint } from "./session.js";
import { canRenderDomain, canRenderPanel, denialReason } from "./permissions.js";
import {
  renderConsole as renderConsoleFull,
  renderDomain as renderDomainFull,
  consoleNavigation,
} from "./render.js";
import type { ConsoleBootstrap } from "./viewmodels.js";
import type {
  OrgApplicationView,
  ResourceView,
  AgentCardView,
  WorkforceSummaryView,
  AuditEntryView,
  TaskView,
  ServiceHealthView,
  AdrView,
  PolicyView,
  ApprovalRequestView,
} from "./viewmodels.js";

/**
 * The only runtime contact the SPA has with the platform. The BFF
 * implementation lives in hermes/admin/bff.ts (server side) and is the
 * single choke point that injects a verified HUMAN Principal. The SPA
 * never sees credentials and cannot call platform services directly.
 */
export interface BffClient {
  /** Bootstrap: returns the verified principal + role + domain payloads. */
  bootstrap(): Promise<ConsoleBootstrap>;
  /** Fetch a single domain payload by id. */
  domain(id: string): Promise<ConsoleBootstrap["domains"][string]>;
}

/**
 * Render a single domain. Fail-closed: if the principal may not view the
 * domain, returns a redacted placeholder and records the denial reason.
 * Delegates to the real domain renderer (render.ts) which builds markdown
 * tables/cards from the BFF payload.
 */
export function renderDomain(
  principal: Principal,
  domain: DashboardDomain,
  payload?: ConsoleBootstrap["domains"][string],
): string {
  const role = deriveRoleHint(principal.permissions);
  const view = toPrincipalView(principal, role);
  if (!canRenderDomain(view, domain.id)) {
    const reason = denialReason(view, domain.id);
    return `[REDACTED: ${domain.label} — ${reason ?? "access denied"}]`;
  }
  // Build a minimal bootstrap slice so the real renderer can format the payload.
  // role is derived from the verified principal's permissions (single source of truth).
  const slice: ConsoleBootstrap = {
    principal: view,
    role,
    domains: payload ? { [domain.id]: payload } : {},
  };
  return renderDomainFull(slice, domain.id);
}

/** Render the full console for a principal (used by the BFF/SSR or client). */
export async function renderConsole(client: BffClient): Promise<string> {
  const bootstrap = await client.bootstrap();
  return renderConsoleFull(bootstrap);
}

/** Expose navigation model for the SPA shell. */
export function getConsoleNavigation(bootstrap: ConsoleBootstrap) {
  return consoleNavigation(bootstrap);
}

// ─── Typed panel payload contracts (document the BFF response shapes) ──

export interface DomainPayloads {
  organization: OrgApplicationView[];
  infrastructure: ResourceView[];
  workforce: { summary: WorkforceSummaryView; agents: AgentCardView[] };
  security: AuditEntryView[];
  operations: { tasks: TaskView[]; health: ServiceHealthView[] };
  governance: {
    adrs: AdrView[];
    policies: PolicyView[];
    approvals: ApprovalRequestView[];
  };
}

export { toPrincipalView, DASHBOARD_IA };
export type { DashboardDomain, PrincipalView, ConsoleBootstrap };
