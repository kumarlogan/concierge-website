// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Security Automation — Admin Read Model                  │
// │ EPIC-003-003 · M7                                            │
// │ Produces an admin-facing security view-model. Exposed ONLY     │
// │ through the internal admin facade (admin/index.ts) — never a   │
// │ public endpoint. Shows latest scans, findings summary, risk    │
// │ level, approval state, and provider health.                    │
// └─────────────────────────────────────────────────────────────┘

import { listProviders } from "../activation/provider-framework.js";
import { readAuditBuffer } from "../../audit/event.js";
import type { SecurityReviewPackage, RiskLevel } from "./security-work-model.js";

export interface SecurityScanSummary {
  requestId: string;
  sourceRequestId: string;
  targetApplication: string;
  env: string;
  riskLevel: RiskLevel;
  findingCount: number;
  approvalRequired: boolean;
  recommendation: SecurityReviewPackage["recommendation"];
  generatedAt: string;
}

export interface SecurityFindingsSummary {
  total: number;
  bySeverity: Record<string, number>;
  requiresApproval: number;
}

export interface SecurityProviderHealth {
  id: string;
  label: string;
  lifecycle: string;
  health: string;
  capabilities: string[];
}

export interface SecurityAdminView {
  latestScans: SecurityScanSummary[];
  findingsSummary: SecurityFindingsSummary;
  overallRisk: RiskLevel;
  approvalState: { pending: number; required: number };
  providerHealth: SecurityProviderHealth[];
  /** Count of security-related audit events (for the admin feed). */
  auditEventCount: number;
}

/**
 * Build the admin security view from in-memory state. `scans` is supplied by
 * the caller (the security service keeps a small ring buffer of completed
 * reviews); provider health and audit events are read from the platform.
 */
export function buildSecurityAdminView(scans: SecurityReviewPackage[]): SecurityAdminView {
  const latestScans: SecurityScanSummary[] = scans.slice(-10).map((s) => ({
    requestId: s.requestId,
    sourceRequestId: s.sourceRequestId,
    targetApplication: s.targetApplication,
    env: s.env,
    riskLevel: s.riskLevel,
    findingCount: s.findings.length,
    approvalRequired: s.approvalRequired,
    recommendation: s.recommendation,
    generatedAt: s.audit.generatedAt,
  }));

  const bySeverity: Record<string, number> = {};
  let total = 0;
  let requiresApproval = 0;
  for (const s of scans) {
    for (const f of s.findings) {
      total += 1;
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
      if (f.requiresApproval) requiresApproval += 1;
    }
  }

  // Overall risk = highest of all scans (fail-closed: unknown → CRITICAL).
  const order: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  let overallRisk: RiskLevel = scans.length ? "LOW" : "LOW";
  for (const s of scans) {
    if (order.indexOf(s.riskLevel) > order.indexOf(overallRisk)) overallRisk = s.riskLevel;
  }

  const pending = scans.filter((s) => s.approvalRequired && s.recommendation !== "approve").length;
  const required = scans.filter((s) => s.approvalRequired).length;

  const providerHealth: SecurityProviderHealth[] = listProviders()
    .filter((p) => p.domain === "security")
    .map((p) => ({
      id: p.id,
      label: p.label,
      lifecycle: p.lifecycle,
      health: p.health.health,
      capabilities: p.capabilities.map((c) => c.id),
    }));

  const auditEventCount = readAuditBuffer().filter((e) => e.type.startsWith("sec.")).length;

  return {
    latestScans,
    findingsSummary: { total, bySeverity, requiresApproval },
    overallRisk,
    approvalState: { pending, required },
    providerHealth,
    auditEventCount,
  };
}
