// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — AI Agent Workforce Seed                      │
// │ EPIC-002-006C · PHASE 5                                        │
// │ Registers the AI workforce model. EVERY agent is registered    │
// │ DISABLED and NON-AUTONOMOUS. Activation is an explicit,         │
// │ human-authorized out-of-band operation — never automatic.      │
// └─────────────────────────────────────────────────────────────┘

import { registerAgent, listAgents } from "./registry.js";
import type { RegisteredAgent } from "./registry.js";

interface AgentSpec {
  id: string;
  name: string;
  domain: string;
  purpose: string;
  owner: string;
  capabilities: Array<{ id: string; description: string; autonomous: boolean }>;
  permissions: string[];
  applicationsAllowed: string[];
  environments: string[];
  memoryScope: "isolated" | "shared" | "global";
  principalId: string;
}

/**
 * The full planned AI workforce. All entries are seeded as registered,
 * disabled, non-autonomous — registration ALWAYS starts disabled (registry
 * safety invariant). No agent here is ever auto-activated. To make a
 * workforce agent assignable, an authorized operator must explicitly enable
 * it (human-governed `enableAgentForAssignment`), then walk it through
 * assigned → approved → active. The live operational agent
 * (ags-fertility-ops-agent) is never enabled.
 */
const WORKFORCE: AgentSpec[] = [
  {
    id: "ags-fertility-ops-agent",
    name: "AGS Fertility Ops Agent",
    domain: "ags-fertility",
    purpose: "Operational lead management and consultation orchestration for AGS Fertility.",
    owner: "platform",
    capabilities: [
      { id: "ops.lead.read", description: "Read lead records", autonomous: false },
      { id: "ops.lead.update", description: "Update lead assignment", autonomous: false },
      { id: "ops.consultation.read", description: "Read consultation state", autonomous: false },
    ],
    permissions: ["leads:read", "leads:write", "consultations:read"],
    applicationsAllowed: ["ags-fertility"],
    environments: ["production", "staging"],
    memoryScope: "isolated",
    principalId: "principal:ags-fertility-ops-agent",
  },
  {
    id: "qa-agent",
    name: "QA Agent",
    domain: "quality",
    purpose: "Run test suites and report regressions across Hermes platform services.",
    owner: "platform",
    capabilities: [{ id: "test.run", description: "Run test suites", autonomous: false }],
    permissions: ["tests:run"],
    applicationsAllowed: ["hermes-platform"],
    environments: ["staging", "development"],
    memoryScope: "shared",
    principalId: "principal:qa-agent",
  },
  {
    id: "security-agent",
    name: "Security Agent",
    domain: "security",
    purpose: "Monitor secrets, scan dependencies, and flag security posture drift.",
    owner: "platform",
    capabilities: [{ id: "security.scan", description: "Scan for vulnerabilities", autonomous: false }],
    permissions: ["security:scan", "audit:read"],
    applicationsAllowed: ["hermes-platform"],
    environments: ["production", "staging"],
    memoryScope: "isolated",
    principalId: "principal:security-agent",
  },
  {
    id: "documentation-agent",
    name: "Documentation Agent",
    domain: "docs",
    purpose: "Generate and maintain technical documentation and ADRs.",
    owner: "platform",
    capabilities: [{ id: "docs.write", description: "Author documentation", autonomous: false }],
    permissions: ["docs:write"],
    applicationsAllowed: ["hermes-platform"],
    environments: ["staging", "development"],
    memoryScope: "shared",
    principalId: "principal:documentation-agent",
  },
  {
    id: "deployment-agent",
    name: "Deployment Agent",
    domain: "devops",
    purpose: "Execute controlled deployment pipelines under explicit authorization.",
    owner: "platform",
    capabilities: [{ id: "deploy.run", description: "Run deployment pipeline", autonomous: false }],
    permissions: ["deploy:execute"],
    applicationsAllowed: ["hermes-platform", "ags-fertility"],
    environments: ["staging"],
    memoryScope: "isolated",
    principalId: "principal:deployment-agent",
  },
  {
    id: "research-agent",
    name: "Research Agent",
    domain: "research",
    purpose: "Conduct literature and market research with cited sources.",
    owner: "platform",
    capabilities: [{ id: "research.query", description: "Query knowledge sources", autonomous: false }],
    permissions: ["research:read"],
    applicationsAllowed: ["hermes-platform"],
    environments: ["development"],
    memoryScope: "global",
    principalId: "principal:research-agent",
  },
  {
    id: "finance-agent",
    name: "Finance Agent",
    domain: "finance",
    purpose: "Track spend, invoices, and budget posture for the organization.",
    owner: "platform",
    capabilities: [{ id: "finance.report", description: "Report financial state", autonomous: false }],
    permissions: ["finance:read"],
    applicationsAllowed: ["hermes-platform"],
    environments: ["production", "staging"],
    memoryScope: "isolated",
    principalId: "principal:finance-agent",
  },
  {
    id: "customer-support-agent",
    name: "Customer Support Agent",
    domain: "support",
    purpose: "Assist with customer inquiries under supervised, non-autonomous handling.",
    owner: "platform",
    capabilities: [{ id: "support.reply", description: "Draft support replies", autonomous: false }],
    permissions: ["support:read"],
    applicationsAllowed: ["ags-fertility"],
    environments: ["production"],
    memoryScope: "isolated",
    principalId: "principal:customer-support-agent",
  },
  {
    id: "developer-agent-claude-code",
    name: "Developer Agent (Claude Code-style)",
    domain: "engineering",
    purpose: "Plan and propose code changes via a Claude Code-style remote coding agent; execution requires human review of the diff.",
    owner: "platform",
    capabilities: [
      { id: "code.plan", description: "Produce implementation plans", autonomous: false },
      { id: "code.diff", description: "Generate code diffs for review", autonomous: false },
      { id: "code.test", description: "Run project test suites in sandbox", autonomous: false },
    ],
    permissions: ["read:code", "read:tests", "create:reports"],
    applicationsAllowed: ["hermes-platform"],
    environments: ["development", "staging"],
    memoryScope: "shared",
    principalId: "principal:developer-agent-claude-code",
  },
  {
    id: "developer-agent-local",
    name: "Developer Agent (Local Coding)",
    domain: "engineering",
    purpose: "Run local coding agents on operator-controlled infrastructure; sandboxed, no production access.",
    owner: "platform",
    capabilities: [
      { id: "code.local.edit", description: "Edit files in an isolated workspace", autonomous: false },
      { id: "code.local.run", description: "Run build/lint/test in sandbox", autonomous: false },
    ],
    permissions: ["read:code", "read:tests"],
    applicationsAllowed: ["hermes-platform"],
    environments: ["development"],
    memoryScope: "isolated",
    principalId: "principal:developer-agent-local",
  },
  {
    id: "security-tooling-agent",
    name: "Security Tooling Agent",
    domain: "security",
    purpose: "Integrate with security tooling (SAST/DAST/secret-scan) and surface findings for human triage.",
    owner: "platform",
    capabilities: [
      { id: "security.scan", description: "Run configured security scanners", autonomous: false },
      { id: "security.findings", description: "Collect and normalize findings", autonomous: false },
    ],
    permissions: ["read:security-config", "create:findings", "audit:read"],
    applicationsAllowed: ["hermes-platform", "ags-fertility"],
    environments: ["staging", "production"],
    memoryScope: "isolated",
    principalId: "principal:security-tooling-agent",
  },
  {
    id: "monitoring-agent",
    name: "Monitoring Agent",
    domain: "observability",
    purpose: "Collect platform health, metrics, and anomaly signals; alert on threshold breaches.",
    owner: "platform",
    capabilities: [
      { id: "monitor.health", description: "Read service health", autonomous: false },
      { id: "monitor.metrics", description: "Collect metrics", autonomous: false },
      { id: "monitor.alert", description: "Emit threshold alerts", autonomous: false },
    ],
    permissions: ["read:telemetry"],
    applicationsAllowed: ["hermes-platform", "ags-fertility"],
    environments: ["production", "staging", "development"],
    memoryScope: "isolated",
    principalId: "principal:monitoring-agent",
  },
];

/** Seed the workforce. Idempotent: re-registration throws and is caught. */
export function seedAgentWorkforce(): RegisteredAgent[] {
  const registered: RegisteredAgent[] = [];
  for (const spec of WORKFORCE) {
    try {
      registered.push(
        registerAgent({
          id: spec.id,
          name: spec.name,
          domain: spec.domain,
          state: "registered",
          registeredAt: new Date().toISOString(),
          capabilities: spec.capabilities,
          principalId: spec.principalId,
          notes: "EPIC-002-006C Phase 5 seed",
          purpose: spec.purpose,
          owner: spec.owner,
          permissions: spec.permissions,
          applicationsAllowed: spec.applicationsAllowed,
          environments: spec.environments,
          memoryScope: spec.memoryScope,
        }),
      );
    } catch (err) {
      // Already registered (e.g. 006B seed) — skip silently.
      if (!(err instanceof Error && err.message.startsWith("Agent already registered"))) {
        throw err;
      }
    }
  }
  return registered;
}

/**
 * Validate the safety invariant. The guarantees we enforce:
 *  - No agent is in `active` state (activation requires explicit human approval).
 *  - No capability is autonomous (agents never self-initiate).
 *  - The live operational agent (ags-fertility-ops-agent) is permanently
 *    `disabled` and therefore never assignable/activatable.
 * Note: other workforce agents are `enabled` (available for the human-governed
 * assignment pipeline) but that is NOT the same as `active`.
 */
export function assertWorkforceSafety(): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const a of listAgents()) {
    if (a.state === "active") violations.push(`${a.id}: state=active (must not be active without approval)`);
    if (a.capabilities.some((c) => c.autonomous)) violations.push(`${a.id}: has autonomous capability`);
    if (a.id === "ags-fertility-ops-agent" && a.activation !== "disabled")
      violations.push(`${a.id}: must remain disabled`);
  }
  return { safe: violations.length === 0, violations };
}
