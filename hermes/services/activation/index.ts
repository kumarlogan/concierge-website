// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Activation module barrel                    │
// │ EPIC-002-007 · M7                                            │
// │ Re-exports the capability provider framework, providers,      │
// │ orchestrator, git provider, developer agent, and approval      │
// │ gates so the platform can consume them via services.Activation.│
// └─────────────────────────────────────────────────────────────┘

export * from "./provider-framework.js";
export * from "./orchestrator.js";
export * from "./git-provider.js";
export * from "./approval-gates.js";
export * from "./developer-agent.js";
export * from "./providers/claude-code.js";
