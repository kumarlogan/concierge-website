// EPIC-002-006C PHASE 5 — AI Registry workforce seed + safety invariant.
import { describe, it, expect, beforeEach } from "vitest";
import { seedAgentWorkforce, assertWorkforceSafety } from "../../hermes/agents/seed.js";
import { listAgents, _clearAgents, getAgent } from "../../hermes/agents/registry.js";

beforeEach(() => {
  _clearAgents();
});

describe("EPIC-002-006C Phase 5 — AI workforce", () => {
  it("seeds all 12+ agents (existing ops + domain placeholders + expansion)", () => {
    seedAgentWorkforce();
    const ids = listAgents().map((a) => a.id).sort();
    expect(ids).toEqual([
      "ags-fertility-ops-agent",
      "customer-support-agent",
      "deployment-agent",
      "developer-agent-claude-code",
      "developer-agent-local",
      "documentation-agent",
      "finance-agent",
      "monitoring-agent",
      "qa-agent",
      "research-agent",
      "security-agent",
      "security-tooling-agent",
    ].sort());
  });

  it("EVERY agent is registered + disabled + non-autonomous", () => {
    seedAgentWorkforce();
    const { safe, violations } = assertWorkforceSafety();
    expect(safe, violations.join("; ")).toBe(true);
  });

  it("ags-fertility-ops-agent retains disabled/registered from 006B", () => {
    seedAgentWorkforce();
    const a = getAgent("ags-fertility-ops-agent");
    expect(a?.activation).toBe("disabled");
    expect(a?.state).toBe("registered");
    expect(a?.auditHistory?.some((h) => h.action === "registered")).toBe(true);
  });

  it("no agent has autonomous capabilities", () => {
    seedAgentWorkforce();
    for (const a of listAgents()) {
      expect(a.capabilities.every((c) => c.autonomous === false)).toBe(true);
    }
  });
});
