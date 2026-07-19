// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Developer Automation — Service Barrel                    │
// │ EPIC-003-002 · Composition root for the Developer Automation    │
// │ pipeline. Re-exports M1–M9. Does NOT redesign foundations — it │
// │ composes identity → authorization → audit → activation →        │
// │ execution → agents, and adds the developer workflow on top.     │
// └─────────────────────────────────────────────────────────────┘

// M1 — Development Work Specification
export * from "./work-request.js";

// M2 — Engineering Planner
export * from "./engineering-planner.js";

// M3 — Developer Agent Runtime (composes canonical Claude Code provider)
export * from "./developer-runtime.js";

// M4 — QA Pipeline
export * from "./qa-pipeline.js";

// M5 — Security Pipeline
export * from "./security-pipeline.js";

// M6 — Documentation Pipeline
export * from "./docs-pipeline.js";

// M7 — Review Package
export * from "./review-package.js";

// M8 — Git Workflow (simulation)
export * from "./git-workflow.js";

// Orchestrator + M9 E2E
export * from "./orchestrator.js";
export * from "./e2e-simulation.js";
