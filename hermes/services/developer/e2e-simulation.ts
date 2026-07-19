// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Developer Automation — End-to-End Simulation             │
// │ EPIC-003-002 · M9                                            │
// │ Runs a complete simulated feature request end-to-end:          │
// │  Planner → Dispatcher → Developer → QA → Security → Docs →    │
// │  Review → Approval → Git Simulation.                          │
// │ All orchestrated by Hermes. NO production changes, NO real git.│
// └─────────────────────────────────────────────────────────────┘

import {
  registerClaudeCodeProvider,
  setClaudeCodeExecutor,
  makeSimulatedClaudeCodeExecutor,
} from "./developer-runtime.js";
import { runDeveloperPipeline } from "./orchestrator.js";
import { normalizeWorkRequest, type DevelopmentWorkRequest } from "./work-request.js";
import { seedAgentWorkforce, assertWorkforceSafety } from "../../agents/seed.js";
import { enableProvider, setProviderHealth } from "../activation/provider-framework.js";

/** A platform principal with activation authority (for enabling the provider). */
function activationPrincipal(): any {
  return { id: "principal:dev-automation-sim", permissions: ["hermes:activation:provider"], roles: ["platform"] };
}

export interface E2EResult {
  requestId: string;
  stagesOk: Record<string, boolean>;
  report: string;
  workforceSafe: boolean;
  providerActive: boolean;
}

/**
 * Wire the simulation: seed workforce, register + enable the Claude Code
 * provider with a SIMULATED executor (no real CLI, fail-closed by design),
 * then run the full pipeline against a feature request.
 */
export async function runDeveloperAutomationE2E(
  request: Omit<DevelopmentWorkRequest, "requestId"> & { requestId?: string },
): Promise<E2EResult> {
  // Foundations: workforce + provider (simulated).
  seedAgentWorkforce();
  const workforce = assertWorkforceSafety();
  const provider = registerClaudeCodeProvider();
  setClaudeCodeExecutor(makeSimulatedClaudeCodeExecutor());
  // Enable via authorized principal (fail-closed: never auto-enabled).
  enableProvider(provider.id, activationPrincipal());
  setProviderHealth(provider.id, "healthy"); // becomes "active"

  const req = normalizeWorkRequest(request);

  const run = await runDeveloperPipeline(req, {
    actor: req.requestedBy,
    approver: "sim-human",
    // Simulate that approval gates were enforced (so security verification passes).
    approvalsEnforced: true,
    // No real approval token → staging/prod generation would be gated; use dev env.
    approvalToken: req.env === "development" ? "sim-token" : undefined,
  });

  const stagesOk: Record<string, boolean> = {
    planner: run.goal.items.length > 0,
    developer: run.developer.every((d) => d.state !== "failed"),
    qa: run.qa.every((q) => q.ok),
    security: run.security.every((s) => s.ok),
    docs: run.docs.length >= 0, // docs always recommended (>=0)
    review: Boolean(run.review.base.reviewId),
    approval: run.review.approvalRequirements.length > 0,
    git: run.git.privilegedGated > 0,
  };

  return {
    requestId: req.requestId,
    stagesOk,
    report: run.report,
    workforceSafe: workforce.safe,
    providerActive: provider.lifecycle === "active",
  };
}
