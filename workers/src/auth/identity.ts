// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Identity Capability Adapter            │
// │ EPIC-002-006B: re-exports the extracted Hermes identity      │
// │ capability so the ./auth barrel keeps its public surface.    │
// └─────────────────────────────────────────────────────────────┘
//
// The implementation now lives in hermes/identity/ (extracted from
// workers/src/auth during EPIC-002-006B). This adapter preserves the
// original import path `./auth/identity.js` for any direct consumers and
// keeps `./auth/index.ts` re-exporting the same symbols unchanged.
//
// Behavior, interfaces, and tests are UNCHANGED (see EPIC-002-006B plan).

export * from "@hermes/identity/types.js";
export * from "@hermes/identity/providers.js";
export * from "@hermes/identity/principal.js";
