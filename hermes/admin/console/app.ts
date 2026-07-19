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
import { DASHBOARD_IA, toPrincipalView } from "../ui-contracts.js";
import {
  canRenderDomain,
  canRenderPanel,
  denialReason,
} from "./permissions.js";
import type {
  ConsoleBootstrap,
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
 */
export function renderDomain(
  principal: PrincipalView,
  domain: DashboardDomain,
  payload?: ConsoleBootstrap["domains"][string],
): string {
  if (!canRenderDomain(principal, domain.id)) {
    const reason = denialReason(principal, domain.id);
    return `[REDACTED: ${domain.label} — ${reason ?? "access denied"}]`;
  }
  const visiblePanels = domain.panels.filter((p) =>
    canRenderPanel(principal, domain.id),
  );
  const lines = [
    `## ${domain.label}`,
    domain.description,
    ...visiblePanels.map((p) => `- ${p.title} (${p.visualization})`),
  ];
  if (visiblePanels.length === 0) {
    lines.push("[no panels authorized for this principal]");
  }
  return lines.join("\n");
}

/** Render the full console for a principal (used by the BFF/SSR or client). */
export async function renderConsole(client: BffClient): Promise<string> {
  const bootstrap = await client.bootstrap();
  const out: string[] = [];
  out.push(`# Hermes Admin Console`);
  out.push(`Principal: ${bootstrap.principal.id} · Role: ${bootstrap.role}`);
  out.push("");
  for (const domain of DASHBOARD_IA) {
    out.push(renderDomain(bootstrap.principal, domain, bootstrap.domains[domain.id]));
    out.push("");
  }
  return out.join("\n");
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
