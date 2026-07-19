// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Identity & Authorization Engine        │
// │ EPIC-002-002: Identity & Authorization Engine                │
// └─────────────────────────────────────────────────────────────┘
//
// Public surface of the reusable security pipeline.
//
//   Identity Resolver → Principal Builder → Permission Resolver
//     → Authorization Middleware → Audit Middleware → Business Service
//
// Every interface (Hermes Admin, Operations Bot, future Dashboard, Mobile,
// Clinic Portal) imports from here and uses the SAME pipeline. No Telegram,
// dashboard, or mobile logic leaks into business services.

export * from "./types.js";
export * from "./providers.js";
export * from "./principal.js";
export * from "./permissions.js";
export * from "./audit.js";
export * from "./middleware.js";
