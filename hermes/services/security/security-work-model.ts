// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Security Automation — Security Work Model                │
// │ EPIC-003-003 · M1                                            │
// │ Canonical, provider-neutral security work contracts.          │
// │ Supports scan requests, targets, severity policy, required    │
// │ checks, approval requirements, findings, evidence, and audit │
// │ metadata. No vendor concepts leak into these types.           │
// └─────────────────────────────────────────────────────────────┘

import type { Environment } from "../activation/approval-gates.js";

export type SecurityCheckKind =
  | "secret-scan"
  | "dependency-scan"
  | "static-analysis"
  | "config-review"
  | "boundary-validation";

/** Severity policy the requester expects the scan to honor. */
export type SeverityPolicy = "low" | "medium" | "high" | "critical" | "block-all";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** A check the security work MUST run (provider-neutral capability id). */
export interface RequiredCheck {
  kind: SecurityCheckKind;
  /** Capability id advertised by a security provider (e.g. "sec.secret-scan"). */
  capability: string;
  /** Minimum severity that must be reported for this check to be considered. */
  minSeverity: SeverityPolicy;
}

export interface ApprovalRequirement {
  /** Whether a human approval token is required before running. */
  required: boolean;
  /** Justification recorded for the audit trail. */
  reason: string;
  /** Environments this requirement applies to. */
  appliesIn: Environment[];
}

/** Canonical security scan request — provider-neutral. */
export interface SecurityScanRequest {
  requestId: string;
  /** Source development request this scan is validating (absent for a direct scan). */
  sourceRequestId?: string;
  title: string;
  targetApplication: string;
  /** Scope under test: module paths, artifact ids, or "full". */
  targetScope: string;
  env: Environment;
  severityPolicy: SeverityPolicy;
  requiredChecks: RequiredCheck[];
  approvalRequirement: ApprovalRequirement;
  /** Free-form constraints (permissions, boundaries) carried from dev request. */
  constraints: string[];
  requestedBy: string;
}

export interface SecurityFinding {
  id: string;
  checkKind: SecurityCheckKind;
  capability: string;
  title: string;
  severity: SeverityPolicy;
  confidence: number; // 0..1
  affectedCapability?: string;
  affectedApplication: string;
  /** Exploitability score 0..1 (higher = easier to exploit). */
  exploitability: number;
  evidence: string;
  recommendation: string;
  requiresApproval: boolean;
}

export interface SecurityReviewPackage {
  requestId: string;
  sourceRequestId: string;
  targetApplication: string;
  env: Environment;
  findings: SecurityFinding[];
  riskLevel: RiskLevel;
  /** Whether human approval is required before any remediation/deploy. */
  approvalRequired: boolean;
  /** Whether the package blocks autonomous progression (governed, not auto). */
  blocksAutonomous: boolean;
  recommendation: "approve" | "review" | "block";
  audit: { generatedBy: string; generatedAt: string; eventCount: number };
}

let _seq = 0;
function nextId(prefix: string): string {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq.toString(36)}`;
}

/** Build a normalized scan request with safe defaults. */
export function normalizeScanRequest(
  r: Omit<SecurityScanRequest, "requestId"> & { requestId?: string },
): SecurityScanRequest {
  return {
    ...r,
    requestId: r.requestId ?? nextId("secscan"),
    sourceRequestId: r.sourceRequestId,
    requiredChecks: r.requiredChecks.length ? r.requiredChecks : defaultChecks(r.env),
    constraints: r.constraints ?? [],
  };
}

/** Default required checks when the requester supplies none. */
export function defaultChecks(env: Environment): RequiredCheck[] {
  const all: SecurityCheckKind[] = [
    "secret-scan",
    "dependency-scan",
    "static-analysis",
    "config-review",
    "boundary-validation",
  ];
  const cap: Record<SecurityCheckKind, string> = {
    "secret-scan": "sec.secret-scan",
    "dependency-scan": "sec.dependency-scan",
    "static-analysis": "sec.static-analysis",
    "config-review": "sec.config-review",
    "boundary-validation": "sec.boundary-validation",
  };
  return all.map((kind) => ({
    kind,
    capability: cap[kind],
    // Production is stricter: anything medium+ must be reported.
    minSeverity: env === "production" ? "medium" : "high",
  }));
}
