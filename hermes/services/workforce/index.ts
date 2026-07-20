// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Workforce Orchestration module barrel       │
// │ EPIC-003-005 · M1–M7                                         │
// │ Re-exports the Workforce Orchestration Coordinator so the     │
// │ platform (admin facade, tests) can consume it via             │
// │ services.Workforce.                                          │
// └─────────────────────────────────────────────────────────────┘

export * from "./orchestration.js";
