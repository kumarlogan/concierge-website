// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Admin Console BFF (Backend-for-Frontend)     │
// │ EPIC-002-006F · PHASE 2                                        │
// │ The SINGLE internal, authenticated boundary between the Admin   │
// │ Console SPA and the platform. Hard rules:                        │
// │  • Receives a VERIFIED HUMAN Principal — never mint one here.   │
// │  • Reuses hermes/admin/access.ts authorization (fail closed).   │
// │  • Every read/action is audited.                                │
// │  • Exposes NO public route; this module exports pure functions  │
// │    invoked only by an upstream authenticated handler.           │
// │  • Never calls hermes/services/* directly — only the facade.    │
// └─────────────────────────────────────────────────────────────┘

import type { Principal } from "../contracts/platform-api.js";
import { assertHumanPrincipal, requireDomainRead, deriveAdminRole } from "./access.js";
import { emitAudit } from "../audit/event.js";
import {
  adminViewApplications,
  adminViewResources,
  adminViewWorkforce,
  adminViewAgent,
  adminViewTasks,
  adminViewWorkforceEvents,
  adminViewAuditTrail,
  adminViewAuthzDenials,
  adminViewServiceStatus,
  adminViewPlatformHealth,
} from "./index.js";
import { adminWorkforceDashboard } from "./workforce-view.js";
import {
  viewGovernanceAdrs,
  viewGovernancePolicies,
  viewGovernanceApprovals,
} from "./governance.js";
import { toPrincipalView } from "./ui-contracts.js";
import type { ConsoleBootstrap } from "./console/viewmodels.js";

/** Bootstrap payload the SPA renders. */
export function bffBootstrap(principal: Principal): ConsoleBootstrap {
  assertHumanPrincipal(principal); // fail closed
  emitAudit("admin.bff.bootstrap", principal.id, {});
  const role = deriveAdminRole(principal);
  return {
    principal: toPrincipalView(principal, role),
    role,
    domains: {
      organization: { ok: true, data: adminViewApplications(principal) },
      infrastructure: { ok: true, data: adminViewResources(principal) },
      workforce: {
        ok: true,
        data: adminWorkforceDashboard(principal),
      },
      security: { ok: true, data: adminViewAuthzDenials(principal) },
      operations: { ok: true, data: adminViewTasks(principal) },
      governance: {
        ok: true,
        data: {
          adrs: viewGovernanceAdrs(),
          policies: viewGovernancePolicies(),
          approvals: viewGovernanceApprovals(),
        },
      },
    },
  };
}

/** Fetch a single domain by id. Fail-closed via requireDomainRead. */
export function bffDomain(principal: Principal, id: string): unknown {
  assertHumanPrincipal(principal);
  emitAudit("admin.bff.domain", principal.id, { id });
  switch (id) {
    case "organization":
      requireDomainRead(principal, "organization");
      return adminViewApplications(principal);
    case "infrastructure":
      requireDomainRead(principal, "infrastructure");
      return adminViewResources(principal);
    case "workforce":
      requireDomainRead(principal, "workforce");
      return adminViewWorkforce(principal);
    case "security":
      requireDomainRead(principal, "security");
      return {
        denials: adminViewAuthzDenials(principal),
        audit: adminViewAuditTrail(principal),
      };
    case "operations":
      requireDomainRead(principal, "operations");
      return {
        tasks: adminViewTasks(principal),
        events: adminViewWorkforceEvents(principal),
        serviceStatus: adminViewServiceStatus(principal),
        platformHealth: adminViewPlatformHealth(principal),
      };
    case "governance":
      requireDomainRead(principal, "governance");
      return {
        adrs: viewGovernanceAdrs(),
        policies: viewGovernancePolicies(),
        approvals: viewGovernanceApprovals(),
      };
    default:
      emitAudit("admin.bff.denied", principal.id, { reason: "unknown domain", id });
      throw new Error(`Unknown or unauthorized domain: ${id}`);
  }
}
