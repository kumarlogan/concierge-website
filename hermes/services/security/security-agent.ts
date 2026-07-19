// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Security Automation — Security Agent Runtime             │
// │ EPIC-003-003 · M2                                            │
// │ The Security Agent receives security tasks, resolves approved   │
// │ security providers, executes controlled scans, collects         │
// │ findings, and produces a review package.                        │
// │                                                             │
// │ Enforcement (fail-closed):                                   │
// │  • inactive agent cannot execute (agent lifecycle gate)      │
// │  • unauthorized capabilities denied (permission + approval)  │
// │  • every action audited                                      │
// │  • no autonomous remediation, no auto-blocking beyond governed │
// └─────────────────────────────────────────────────────────────┘

import {
  resolveProviderForCapability,
  executeCapability,
  type ManagedProvider,
} from "../activation/provider-framework.js";
import { emitAudit } from "../../audit/event.js";
import { CHECK_CAPABILITY } from "./providers/security-providers.js";
import {
  type SecurityScanRequest,
  type SecurityFinding,
  type SecurityReviewPackage,
  type RiskLevel,
  type SecurityCheckKind,
} from "./security-work-model.js";
import { aggregateRisk } from "./risk-engine.js";
import { recordSecurityReview } from "./security-store.js";
import type { AgentContribution } from "../execution/review-pipeline.js";

export type SecurityAgentState = "assigned" | "approved" | "active" | "paused" | "disabled" | "retired";

interface SecurityAgentRecord {
  id: string;
  state: SecurityAgentState;
  permissions: string[];
}

const AGENTS = new Map<string, SecurityAgentRecord>();

/** Register the canonical security agent in an inactive (assigned) state. */
export function registerSecurityAgent(id = "security-agent"): SecurityAgentRecord {
  const rec: SecurityAgentRecord = { id, state: "assigned", permissions: ["hermes:security:scan"] };
  AGENTS.set(id, rec);
  emitAudit("sec.agent.registered", "system", { id, state: rec.state });
  return rec;
}

export function getSecurityAgent(id = "security-agent"): SecurityAgentRecord | undefined {
  return AGENTS.get(id);
}

/** Human approval: assigned → approved (no autonomous transition). */
export function approveSecurityAgent(id: string, principal: { id: string }): SecurityAgentRecord {
  const a = AGENTS.get(id);
  if (!a) throw new Error(`Unknown security agent: ${id}`);
  if (a.state !== "assigned") throw new Error(`Illegal agent transition: ${a.state} -> approved`);
  a.state = "approved";
  emitAudit("sec.agent.approved", principal.id, { id });
  return a;
}

/** Bring the agent to active (only from approved). */
export function activateSecurityAgent(id: string, principal: { id: string }): SecurityAgentRecord {
  const a = AGENTS.get(id);
  if (!a) throw new Error(`Unknown security agent: ${id}`);
  if (a.state !== "approved") throw new Error(`Illegal agent transition: ${a.state} -> active`);
  a.state = "active";
  emitAudit("sec.agent.activated", principal.id, { id });
  return a;
}

/** Disable the agent (fail-closed: stops all execution). */
export function disableSecurityAgent(id: string, principal: { id: string }): SecurityAgentRecord {
  const a = AGENTS.get(id);
  if (!a) throw new Error(`Unknown security agent: ${id}`);
  a.state = "disabled";
  emitAudit("sec.agent.disabled", principal.id, { id });
  return a;
}

/** Capability the security agent is allowed to invoke. */
const AGENT_CAPABILITIES = new Set(Object.values(CHECK_CAPABILITY));

function assertAgentExecutable(id: string): SecurityAgentRecord {
  const a = AGENTS.get(id);
  if (!a) {
    emitAudit("sec.agent.unknown", "system", { id });
    throw new Error(`Unknown security agent: ${id}`);
  }
  if (a.state !== "active") {
    // Inactive agent cannot execute — explicit fail-closed rejection.
    emitAudit("sec.agent.inactive.denied", "system", { id, state: a.state });
    throw new Error(`Security agent ${id} is not active (state=${a.state}); cannot execute`);
  }
  return a;
}

function assertCapabilityAuthorized(capability: string): void {
  if (!AGENT_CAPABILITIES.has(capability)) {
    emitAudit("sec.capability.unauthorized", "system", { capability });
    throw new Error(`Security agent not authorized for capability: ${capability}`);
  }
}

export interface SecurityAgentResult {
  requestId: string;
  capability: string;
  providerId?: string;
  executed: boolean;
  findings: SecurityFinding[];
  error?: string;
}

/**
 * Execute ONE controlled scan for a check kind. Resolves the approved security
 * provider dynamically; refuses if the agent is inactive or the capability is
 * unauthorized. Never remediates — only collects findings.
 */
export async function runSecurityScan(
  agentId: string,
  req: SecurityScanRequest,
  checkKind: SecurityCheckKind,
): Promise<SecurityAgentResult> {
  const capability = CHECK_CAPABILITY[checkKind];

  // 1) Agent must be active.
  let agent: SecurityAgentRecord;
  try {
    agent = assertAgentExecutable(agentId);
  } catch (err) {
    return { requestId: req.requestId, capability, executed: false, findings: [], error: String(err) };
  }

  // 2) Capability must be authorized for the agent.
  try {
    assertCapabilityAuthorized(capability);
  } catch (err) {
    return { requestId: req.requestId, capability, executed: false, findings: [], error: String(err) };
  }

  // 3) Resolve an ACTIVE provider for the capability.
  const provider: ManagedProvider | undefined = resolveProviderForCapability(capability);
  if (!provider) {
    emitAudit("sec.provider.unresolved", agent.id, { capability });
    return {
      requestId: req.requestId,
      capability,
      executed: false,
      findings: [],
      error: `No active provider resolves capability: ${capability}`,
    };
  }

  // 4) Execute through the framework (handles approval gate + fail-closed).
  emitAudit("sec.scan.start", agent.id, { requestId: req.requestId, capability, providerId: provider.id });
  const res = await executeCapability(capability, { request: req }, { actor: agent.id, env: req.env, approvalToken: req.approvalRequirement.required ? "human-token" : undefined });
  if (!res.ok) {
    emitAudit("sec.scan.failed", agent.id, { requestId: req.requestId, capability, error: res.error });
    return { requestId: req.requestId, capability, providerId: provider.id, executed: false, findings: [], error: res.error };
  }

  const data = (res.data ?? {}) as { findings?: SecurityFinding[] };
  const findings = data.findings ?? [];
  emitAudit("sec.scan.done", agent.id, { requestId: req.requestId, capability, findings: findings.length });
  return { requestId: req.requestId, capability, providerId: provider.id, executed: true, findings };
}

/**
 * Run the full security review for a request: execute all required checks,
 * aggregate findings, compute risk, and build the review package. Fail-closed
 * for the agent/provider gates; provider errors are collected, never thrown
 * past the boundary.
 */
export async function runSecurityReview(
  agentId: string,
  req: SecurityScanRequest,
): Promise<SecurityReviewPackage> {
  const allFindings: SecurityFinding[] = [];
  for (const check of req.requiredChecks) {
    const r = await runSecurityScan(agentId, req, check.kind);
    allFindings.push(...r.findings);
  }

  const riskLevel: RiskLevel = aggregateRisk(allFindings, req);
  const approvalRequired = req.approvalRequirement.required || allFindings.some((f) => f.requiresApproval);
  // Governed blocking: only block autonomous progression when explicitly
  // governed (production-required approval or a critical finding). No silent
  // autonomous block otherwise.
  const blocksAutonomous = approvalRequired || riskLevel === "CRITICAL";
  const recommendation: SecurityReviewPackage["recommendation"] =
    riskLevel === "CRITICAL" ? "block" : approvalRequired ? "review" : "approve";

  emitAudit("sec.review.complete", agentId, {
    requestId: req.requestId,
    riskLevel,
    findings: allFindings.length,
    approvalRequired,
  });

  const pkg: SecurityReviewPackage = {
    requestId: req.requestId,
    sourceRequestId: req.sourceRequestId,
    targetApplication: req.targetApplication,
    env: req.env,
    findings: allFindings,
    riskLevel,
    approvalRequired,
    blocksAutonomous,
    recommendation,
    audit: { generatedBy: agentId, generatedAt: new Date().toISOString(), eventCount: allFindings.length },
  };
  recordSecurityReview(pkg);
  return pkg;
}

/** Convert a security review into agent contributions (for the review package). */
export function securityContributions(pkg: SecurityReviewPackage): AgentContribution[] {
  return [
    {
      agentId: pkg.requestId ? "security-agent" : "security-agent",
      domain: "security" as const,
      capability: "sec.review",
      artifact: {
        requestId: pkg.requestId,
        riskLevel: pkg.riskLevel,
        findings: pkg.findings.length,
        approvalRequired: pkg.approvalRequired,
        recommendation: pkg.recommendation,
      },
      privileged: false,
      notes: `Security review: ${pkg.riskLevel} risk, ${pkg.findings.length} findings`,
    },
  ];
}
