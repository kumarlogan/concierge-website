// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Seed Agent Registrations                    │
// │ EPIC-002-006B · PHASE 7                                       │
// └─────────────────────────────────────────────────────────────┘
//
// Registers the FIRST agent on the Hermes Platform: the AGS Fertility
// Operations Agent. Per EPIC-002-006B safety posture, it is registered
// DISABLED — no autonomous actions, activation requires explicit operator
// authorization (see registry.activateAgent, called only by an authorized
// flow, never automatically here).

import { registerAgent, type RegisteredAgent } from "./registry.js";

export const AGS_FERTILITY_OPS_AGENT: RegisteredAgent = registerAgent({
  id: "ags-fertility-ops-agent",
  name: "AGS Fertility Operations Agent",
  domain: "ags-fertility",
  state: "registered",
  activation: "disabled", // safety: never auto-enabled
  principalId: "agent:ags-fertility-ops",
  registeredAt: new Date().toISOString(),
  capabilities: [
    {
      id: "ops.lead.read",
      description: "Read operations lead records and dashboard summaries.",
      autonomous: false,
    },
    {
      id: "ops.lead.notify",
      description: "Send notifications about lead status changes to operators.",
      autonomous: false,
    },
  ],
  notes:
    "First AI agent on the Hermes Platform. Registered disabled per " +
    "EPIC-002-006B. No autonomous actions until explicitly activated by an " +
    "authorized operator.",
});
