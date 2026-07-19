// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Permission Capability Adapter          │
// │ EPIC-002-006B: re-exports the extracted Hermes permission     │
// │ capability so the ./auth barrel keeps its public surface.    │
// └─────────────────────────────────────────────────────────────┘
//
// Implementation now lives in hermes/permissions/ (extracted from
// workers/src/auth during EPIC-002-006B). Preserves the original import
// path `./auth/permissions.js`. Behavior, interfaces, and tests UNCHANGED.

export * from "@hermes/permissions/permissions.js";
export * from "@hermes/permissions/middleware.js";
