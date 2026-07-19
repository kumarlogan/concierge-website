// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Admin: AI Workforce Dashboard View          │
// │ EPIC-002-006F · PHASE 3                                        │
// │ Builds the console's AI Workforce view-model from the existing  │
// │ roster. Enforces the safety invariants the dashboard must       │
// │ surface: agents are DISABLED BY DEFAULT and NON-AUTONOMOUS.     │
// │ Any agent violating these invariants is flagged (never hidden   │
// │ — visibility is the control, but the console must alarm).       │
// └─────────────────────────────────────────────────────────────┘

import type { Principal } from "../contracts/platform-api.js";
import { requireDomainRead } from "./access.js";
import { viewAgentRoster } from "./visibility.js";
import { resolveMemoryScope } from "../agents/tool-contracts.js";
import type { RegisteredAgent } from "../agents/registry.js";
import type {
  AgentCardView,
  AgentActivationState,
  WorkforceSummaryView,
} from "./console/viewmodels.js";

/** Map a registered agent's lifecycle flags to a dashboard state. */
function toState(agent: RegisteredAgent): AgentActivationState {
  if (agent.activation === "disabled") return "disabled";
  switch (agent.state) {
    case "active":
      return "active";
    case "approved":
      return "approved";
    case "assigned":
      return "assigned";
    case "retired":
      return "retired";
    case "paused":
      return "paused";
    default:
      return "registered";
  }
}

/**
 * Build the AI Workforce dashboard payload. Permission-gated; every agent
 * carries its invariant flags so the UI can render the safety posture.
 */
export function adminWorkforceDashboard(principal: Principal): {
  summary: WorkforceSummaryView;
  agents: AgentCardView[];
} {
  requireDomainRead(principal, "workforce");
  const roster = viewAgentRoster();

  const agents: AgentCardView[] = roster.map((entry) => {
    const a = entry.agent;
    const memoryScope = resolveMemoryScope(a);
    return {
      id: a.id,
      name: a.name,
      kind: a.domain,
      state: toState(a),
      disabledByDefault: a.activation === "disabled",
      nonAutonomous: (a.capabilities ?? []).every((c) => c.autonomous === false),
      assignedApplications: entry.assignments.map((as) => as.applicationId),
      permissions: a.permissions ?? [],
      toolGrants: (a.capabilities ?? []).map((c) => c.id),
      memoryScope,
      registeredAt: a.registeredAt,
    };
  });

  const summary: WorkforceSummaryView = {
    total: agents.length,
    disabled: agents.filter((x) => x.disabledByDefault).length,
    approved: agents.filter((x) => x.state === "approved" || x.state === "active").length,
    active: agents.filter((x) => x.state === "active").length,
    assigned: agents.filter((x) => x.assignedApplications.length > 0).length,
  };

  return { summary, agents };
}
