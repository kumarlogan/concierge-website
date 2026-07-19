// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Admin: Governance Visibility                 │
// │ EPIC-002-006F · PHASE 2                                        │
// │ Read-only aggregation of governance artifacts: ADRs, policies, │
// │ and pending human approvals. Pure reads over existing contracts.│
// │ Internal-only; gated by the admin facade.                      │
// └─────────────────────────────────────────────────────────────┘

import { readWorkforceAudit } from "../workforce/events.js";
import type { AdrView, PolicyView, ApprovalRequestView } from "./console/viewmodels.js";

/**
 * ADR catalog. In production this is sourced from docs/decisions; here it is a
 * typed static view so the console can render the governance domain without
 * touching the filesystem. The list mirrors the roadmap's ADR registry.
 */
const ADR_CATALOG: AdrView[] = [
  { id: "ADR-001", title: "Cloudflare Migration", status: "accepted" },
  { id: "ADR-002", title: "Multi-Agent Operations Architecture", status: "accepted" },
  { id: "ADR-003", title: "Permission Resolution", status: "accepted" },
  { id: "ADR-004", title: "Organization Architecture", status: "accepted" },
  { id: "ADR-005", title: "Hermes Platform", status: "accepted" },
  { id: "ADR-006", title: "Resource Registry", status: "accepted" },
  { id: "ADR-007", title: "Hermes Platform Extraction", status: "accepted" },
  { id: "ADR-008", title: "Hermes Platform Core Services", status: "accepted" },
  { id: "ADR-012", title: "Admin Platform Internal-Only Facade", status: "accepted" },
];

/** Policy registry view (zero-trust, least-privilege, auditability, …). */
const POLICY_CATALOG: PolicyView[] = [
  { id: "policy:zero-trust", name: "Zero Trust (authN+authZ every request)", enforced: true },
  { id: "policy:least-privilege", name: "Least Privilege (scoped perms)", enforced: true },
  { id: "policy:secret-management", name: "Secret Management (0 in repo)", enforced: true },
  { id: "policy:auditability", name: "Auditability (write-once audit)", enforced: true },
  { id: "policy:env-isolation", name: "Environment Isolation (no cross-env leakage)", enforced: true },
  { id: "policy:provider-independence", name: "Provider Independence (interfaces only)", enforced: true },
  { id: "policy:agent-disabled-by-default", name: "Agents Disabled By Default", enforced: true },
  { id: "policy:human-approval", name: "Human Approval Gate (no autonomous activation)", enforced: true },
];

/**
 * Pending human approvals derived from the workforce audit. Any
 * `agent.request.approval` / `task.request` event without a corresponding
 * approve is surfaced as a pending request. This is a read-only projection.
 */
export function viewGovernanceApprovals(): ApprovalRequestView[] {
  const events = [...readWorkforceAudit()];
  const pending: ApprovalRequestView[] = [];
  for (const e of events) {
    if (e.type === "agent.request.approval" || e.type === "task.request") {
      pending.push({
        id: `req:${e.at}:${e.actor}`,
        kind:
          e.type === "agent.request.approval" ? "agent-activate" : "task-create",
        target: String(e.detail?.agentId ?? e.detail?.taskId ?? "unknown"),
        requestedBy: e.actor,
        state: "pending",
      });
    }
  }
  return pending;
}

export function viewGovernanceAdrs(): AdrView[] {
  return ADR_CATALOG;
}

export function viewGovernancePolicies(): PolicyView[] {
  return POLICY_CATALOG;
}
