// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Execution Platform — Service Barrel                     │
// │ EPIC-003-001 · Composition root for the execution plane.       │
// │ Re-exports the seven deliverables and wires them through the   │
// │ existing activation + agents foundations (no redesign).        │
// └─────────────────────────────────────────────────────────────┘

export * from "./work-planner.js";
export * from "./workforce-dispatch.js";
export * from "./execution-queue.js";
export * from "./review-pipeline.js";
export * from "./simulation.js";

// Re-export the activation building blocks this plane composes, so callers
// have a single import surface for the execution platform.
export {
  resolveProviderForCapability,
  listActiveProviders,
  registerProvider,
  enableProvider,
  disableProvider,
} from "../activation/provider-framework.js";
export { orchestrate, DEFAULT_ORCHESTRATION } from "../activation/orchestrator.js";
export { gateForApproval, enforceGate, decideGate } from "../activation/approval-gates.js";
export { runDeveloperAgent } from "../activation/developer-agent.js";
export { registerGitProvider, GIT_PROVIDER_ID } from "../activation/git-provider.js";
