// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Audit Capability Adapter               │
// │ EPIC-002-006B: re-exports the extracted Hermes audit          │
// │ capability so the ./auth barrel keeps its public surface.    │
// └─────────────────────────────────────────────────────────────┘
//
// Implementation now lives in hermes/audit/ (extracted from
// workers/src/auth during EPIC-002-006B). Preserves the original import
// path `./auth/audit.js`. Behavior, interfaces, and tests UNCHANGED.

export * from "@hermes/audit/audit.js";
