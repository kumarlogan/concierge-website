// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Admin Console — Domain Renderer                        │
// │ EPIC-002-006G · PHASE 1                                        │
// │ Renders the six existing dashboard domains from the BFF        │
// │ bootstrap payload. Pure view layer: imports ONLY typed         │
// │ contracts (ConsoleBootstrap, view-models, ui-contracts) and    │
// │ the permission-aware rendering helpers. It NEVER imports       │
// │ hermes/services/*, hermes/agents/*, hermes/workforce/*. The    │
// │ data it renders arrived through the BFF (bffBootstrap), so the │
// │ console stays decoupled from platform internals.               │
// │                                                 BOUNDARY:      │
//  • No runtime service calls. No HTTP. No principal minting.       │
//  • Permission gating is OBSERVED here for UX only; the           │
//    authoritative gate is server-side (bff.ts + access.ts).       │
// └─────────────────────────────────────────────────────────────┘

import type { PrincipalView } from "../ui-contracts.js";
import type { ConsoleBootstrap } from "./viewmodels.js";
import type {
  AgentCardView,
  WorkforceSummaryView,
  ResourceView,
  OrgApplicationView,
  AuditEntryView,
  AdrView,
  PolicyView,
  ApprovalRequestView,
  ServiceHealthView,
  TaskView,
} from "./viewmodels.js";
import { canRenderDomain, canRenderPanel, denialReason } from "./permissions.js";
import { DASHBOARD_IA, type DashboardDomainId, type DashboardDomain } from "../ui-contracts.js";

// ─── small markdown helpers ────────────────────────────────────

function table(headers: string[], rows: Array<Array<string | number>>): string {
  const esc = (s: unknown) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  const h = `| ${headers.map(esc).join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.map(esc).join(" | ")} |`).join("\n");
  return `${h}\n${sep}\n${body}`;
}

function badge(on: boolean, yes = "✓", no = "✗"): string {
  return on ? yes : no;
}

// ─── domain renderers ──────────────────────────────────────────

function renderOrganization(p: PrincipalView, data: unknown): string {
  const apps = (data as OrgApplicationView[]) ?? [];
  return [
    `### Organization — Applications (${apps.length})`,
    apps.length
      ? table(["Application", "Resources", "Environments"], apps.map((a) => [a.id, a.resources, a.environments.join(", ")]))
      : "_No applications discovered._",
  ].join("\n");
}

function renderInfrastructure(p: PrincipalView, data: unknown): string {
  const res = (data as ResourceView[]) ?? [];
  const providers = new Map<string, number>();
  for (const r of res) providers.set(r.provider, (providers.get(r.provider) ?? 0) + 1);
  return [
    `### Infrastructure — Resource Inventory (${res.length})`,
    res.length
      ? table(["ID", "Kind", "Owner", "Env", "Provider", "State"], res.map((r) => [r.id, r.kind, r.owner, r.env, r.provider, r.state]))
      : "_No resources registered._",
    "",
    `### Provider Coverage`,
    table(["Provider", "Resources"], [...providers.entries()].map(([k, v]) => [k, v])),
  ].join("\n");
}

function renderWorkforce(p: PrincipalView, data: unknown): string {
  const payload = (data ?? {}) as { roster?: AgentCardView[]; summary?: WorkforceSummaryView };
  const roster = payload.roster ?? [];
  const summary = payload.summary;
  const head = summary
    ? `### AI Workforce — Roster (${summary.total}) · disabled ${summary.disabled} · approved ${summary.approved} · active ${summary.active} · assigned ${summary.assigned}`
    : `### AI Workforce — Roster (${roster.length})`;
  return [
    head,
    roster.length
      ? table(
          ["Agent", "Kind", "State", "Disabled★", "Non-Auto★", "Apps", "Mem"],
          roster.map((a) => [
            a.name,
            a.kind,
            a.state,
            badge(a.disabledByDefault),
            badge(a.nonAutonomous),
            a.assignedApplications.join(",") || "—",
            a.memoryScope,
          ]),
        )
      : "_No agents registered._",
    "",
    "_★ safety invariants — any ✗ is a violation alarm._",
  ].join("\n");
}

function renderOperations(p: PrincipalView, data: unknown): string {
  const tasks = (data as TaskView[]) ?? [];
  return [
    `### Operations — Task History (${tasks.length})`,
    tasks.length
      ? table(["ID", "Agent", "App", "Purpose", "State", "Requester"], tasks.map((t) => [t.id, t.agentId, t.applicationId, t.purpose, t.state, t.requestedBy]))
      : "_No tasks yet._",
  ].join("\n");
}

function renderSecurity(p: PrincipalView, data: unknown): string {
  const entries = (data as AuditEntryView[]) ?? [];
  return [
    `### Security — Authorization Denials (${entries.length})`,
    entries.length
      ? table(["Type", "Actor", "At", "Detail"], entries.map((e) => [e.type, e.actor, e.at, JSON.stringify(e.detail).slice(0, 80)]))
      : "_No authorization denials recorded._",
  ].join("\n");
}

function renderGovernance(p: PrincipalView, data: unknown): string {
  const payload = (data ?? {}) as { adrs?: AdrView[]; policies?: PolicyView[]; approvals?: ApprovalRequestView[] };
  const adrs = payload.adrs ?? [];
  const policies = payload.policies ?? [];
  const approvals = payload.approvals ?? [];
  return [
    `### Governance — Architecture Decisions (${adrs.length})`,
    adrs.length ? table(["ADR", "Title", "Status"], adrs.map((a) => [a.id, a.title, a.status])) : "_No ADRs._",
    "",
    `### Policies (${policies.length})`,
    policies.length ? table(["ID", "Name", "Enforced"], policies.map((p2) => [p2.id, p2.name, badge(p2.enforced)])) : "_No policies._",
    "",
    `### Pending Human Approvals (${approvals.length})`,
    approvals.length
      ? table(["ID", "Kind", "Target", "By", "State"], approvals.map((a) => [a.id, a.kind, a.target, a.requestedBy, a.state]))
      : "_No pending approvals._",
  ].join("\n");
}

/** Map a domain id to its renderer. */
const RENDERERS: Record<DashboardDomainId, (p: PrincipalView, data: unknown) => string> = {
  organization: renderOrganization,
  infrastructure: renderInfrastructure,
  workforce: renderWorkforce,
  operations: renderOperations,
  security: renderSecurity,
  governance: renderGovernance,
};

// ─── public API ────────────────────────────────────────────────

export interface ConsoleRenderOptions {
  /** If set, render only this domain. Otherwise render all visible domains. */
  only?: DashboardDomainId;
  /** Include the navigation shell header. Default true. */
  shell?: boolean;
}

/**
 * Render the full console from a BFF bootstrap payload. Permission gating is
 * applied fail-closed: a domain the principal may not see is replaced with a
 * redacted placeholder (never silently shown).
 */
export function renderConsole(boot: ConsoleBootstrap, opts: ConsoleRenderOptions = {}): string {
  const principal = boot.principal;
  const sections: string[] = [];

  if (opts.shell !== false) {
    sections.push(
      [
        "# Hermes Admin Console",
        `Principal: \`${principal.id}\` · Role: **${boot.role}**`,
        `Permissions: ${principal.permissions.join(", ") || "_(none)_"}`,
        "",
      ].join("\n"),
    );
  }

  const domains = DASHBOARD_IA.filter((d): d is DashboardDomain => !opts.only || d.id === opts.only);
  for (const domain of domains) {
    const visible = canRenderDomain(principal, domain.id);
    if (!visible) {
      sections.push(
        [
          `## ${domain.label}`,
          `> 🔒 REDACTED — ${denialReason(principal, domain.id) ?? "access denied"}`,
        ].join("\n"),
      );
      continue;
    }
    const payload = boot.domains[domain.id]?.data;
    sections.push(RENDERERS[domain.id](principal, payload));
    sections.push("");
  }

  return sections.join("\n").trimEnd();
}

/** Render a single domain's panels (used by the SPA router). */
export function renderDomain(
  boot: ConsoleBootstrap,
  domain: DashboardDomainId,
  requiredPermissions: string[] = [],
): string {
  const principal = boot.principal;
  if (!canRenderPanel(principal, domain, requiredPermissions)) {
    return `> 🔒 REDACTED — ${denialReason(principal, domain) ?? "access denied"}`;
  }
  const payload = boot.domains[domain]?.data;
  const renderer = RENDERERS[domain];
  if (!renderer) {
    return `_Domain '${domain}' has no registered renderer._`;
  }
  return renderer(principal, payload);
}

/** Navigation model for the SPA shell (labels + visibility). */
export function consoleNavigation(boot: ConsoleBootstrap): Array<{ id: DashboardDomainId; label: string; visible: boolean }> {
  const principal = boot.principal;
  return DASHBOARD_IA.map((d) => ({
    id: d.id,
    label: d.label,
    visible: canRenderDomain(principal, d.id),
  }));
}

/** Service health gauge (operations rollup helper). */
export function renderServiceHealth(services: ServiceHealthView[]): string {
  const rollup = { healthy: 0, degraded: 0, down: 0, unknown: 0 };
  for (const s of services) {
    if (s.status === "healthy") rollup.healthy++;
    else if (s.status === "degraded") rollup.degraded++;
    else if (s.status === "down") rollup.down++;
    else rollup.unknown++;
  }
  return [
    `### Platform Service Health`,
    table(["Status", "Count"], [
      ["healthy", rollup.healthy],
      ["degraded", rollup.degraded],
      ["down", rollup.down],
      ["unknown", rollup.unknown],
    ]),
  ].join("\n");
}

// NOTE: This module imports NO platform service code. It is a pure consumer of
// the BFF payload + contract types, satisfying the console boundary.
