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

// Identity capability is extracted to Hermes (EPIC-002-006B) — re-export via adapters.
export * from "./identity.js";
export * from "./permissions.js"; // includes permissions + authorization middleware
export * from "./audit.js";
