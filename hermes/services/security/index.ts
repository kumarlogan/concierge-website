// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Security module barrel                   │
// │ EPIC-003-004 · M1 (workspace exports)                      │
// │ Re-exports the Security Automation surface so the platform  │
// │ can consume it via services.Security without deep imports.  │
// └─────────────────────────────────────────────────────────────┘

export * from "./security-work-model.js";
export * from "./risk-engine.js";
export * from "./security-store.js";
export * from "./security-agent.js";
export * from "./security-integration.js";
export * from "./admin-view.js";
export * from "./finding-aggregator.js";
export * from "./provider-health.js";
export * from "./providers/security-providers.js";
export * from "./providers/oss-adapters.js";
export * from "./providers/real-adapters.js";
export * from "./providers/provider-discovery.js";
export * from "./providers/local-tool-detection.js";
