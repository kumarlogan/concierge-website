// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Security Automation — Risk Engine                        │
// │ EPIC-003-003 · M6                                            │
// │ Aggregates findings into a single risk level:                  │
// │   LOW · MEDIUM · HIGH · CRITICAL                               │
// │ Combines severity, confidence, affected capability, affected   │
// │ application, exploitability, and approval requirements.         │
// │ FAILS CLOSED: any unknown condition → CRITICAL (most cautious). │
// └─────────────────────────────────────────────────────────────┘

import type {
  SecurityFinding,
  SecurityScanRequest,
  RiskLevel,
  SeverityPolicy,
} from "./security-work-model.js";

const SEVERITY_RANK: Record<SeverityPolicy, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
  "block-all": 4,
};

const RISK_RANK: Record<RiskLevel, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function severityToRisk(sev: SeverityPolicy): RiskLevel {
  switch (sev) {
    case "low":
      return "LOW";
    case "medium":
      return "MEDIUM";
    case "high":
      return "HIGH";
    case "critical":
    case "block-all":
      return "CRITICAL";
    default:
      // FAIL CLOSED: unknown severity label → treat as critical.
      return "CRITICAL";
  }
}

/**
 * Score a single finding: blends severity, confidence, and exploitability.
 * Returns a 0..100 score. Unknown/missing fields fail closed (max weight).
 */
function scoreFinding(f: SecurityFinding): number {
  const sev = SEVERITY_RANK[f.severity] ?? 4; // unknown severity → worst
  const conf = typeof f.confidence === "number" && f.confidence >= 0 && f.confidence <= 1 ? f.confidence : 1;
  const exp = typeof f.exploitability === "number" && f.exploitability >= 0 && f.exploitability <= 1 ? f.exploitability : 1;
  // Weighted: severity 50%, exploitability 30%, confidence 20%.
  const score = sev / 4 * 50 + exp * 30 + conf * 20;
  return Math.round(score);
}

/**
 * Aggregate all findings into a single risk level.
 *  • No findings → LOW (unless the request itself requires approval).
 *  • Highest individual finding risk wins (conservative).
 *  • Any finding requiring approval bumps at least to HIGH.
 *  • CRITICAL severity or unknown condition → CRITICAL.
 *  • Any affected capability flagged in production → at least HIGH.
 */
export function aggregateRisk(findings: SecurityFinding[], req: SecurityScanRequest): RiskLevel {
  if (!Array.isArray(findings)) {
    // FAIL CLOSED: corrupted input → critical.
    return "CRITICAL";
  }
  if (findings.length === 0) {
    return req.approvalRequirement.required ? "MEDIUM" : "LOW";
  }

  let top: RiskLevel = "LOW";
  for (const f of findings) {
    let r: RiskLevel = severityToRisk(f.severity);
    if (f.requiresApproval && RISK_RANK[r] < RISK_RANK.HIGH) r = "HIGH";
    if (req.env === "production" && f.affectedCapability && RISK_RANK[r] < RISK_RANK.HIGH) {
      r = "HIGH";
    }
    if (RISK_RANK[r] > RISK_RANK[top]) top = r;
  }
  return top;
}

/** Detailed numeric scoring for the review package / admin view. */
export interface RiskScoreDetail {
  level: RiskLevel;
  score: number;
  findingCount: number;
  highestSeverity: SeverityPolicy | "none";
}

export function scoreRisk(findings: SecurityFinding[], req: SecurityScanRequest): RiskScoreDetail {
  const level = aggregateRisk(findings, req);
  let score = 0;
  let highest: SeverityPolicy | "none" = "none";
  for (const f of findings) {
    score = Math.max(score, scoreFinding(f));
    if (highest === "none" || SEVERITY_RANK[f.severity] > SEVERITY_RANK[highest]) highest = f.severity;
  }
  return { level, score, findingCount: findings.length, highestSeverity: highest };
}
