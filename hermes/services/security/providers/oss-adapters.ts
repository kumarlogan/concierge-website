// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Security Automation — OSS Compatibility Layer            │
// │ EPIC-003-003 · M4                                            │
// │ Provider-neutral interfaces + SIMULATED local adapters for     │
// │ future open-source security tools. No external binary is       │
// │ required to run the platform: each adapter is a deterministic   │
// │ stand-in that implements the same CapabilityExecutor port used  │
// │ by real scanners (gitleaks, semgrep, osv-scanner, trivy).       │
// │                                                             │
// │ Swap-in path: replace make*Executor with a real backend that   │
// │ shells out to the tool; the capability ids and contracts are   │
// │ unchanged, so zero agent/runtime code changes are needed.      │
// └─────────────────────────────────────────────────────────────┘

import type { CapabilityExecutor } from "../../activation/provider-framework.js";
import type { SecurityScanRequest, SecurityFinding, SecurityCheckKind } from "../security-work-model.js";

/**
 * Vendor-neutral adapter descriptor. A real integration would populate
 * `binary` (e.g. "gitleaks") and `version` from the installed tool; the
 * simulated adapters leave these as documentation-only hints.
 */
export interface OssAdapterSpec {
  tool: "gitleaks" | "semgrep" | "osv-scanner" | "trivy" | "sim";
  capability: string;
  description: string;
  /** Whether the real binary must be installed to use this adapter. */
  requiresBinary: boolean;
}

export const OSS_ADAPTERS: OssAdapterSpec[] = [
  { tool: "gitleaks", capability: "sec.secret-scan", description: "Detect hardcoded secrets", requiresBinary: true },
  { tool: "semgrep", capability: "sec.static-analysis", description: "Pattern-based static analysis", requiresBinary: true },
  { tool: "osv-scanner", capability: "sec.dependency-scan", description: "OSV vulnerability database scan", requiresBinary: true },
  { tool: "trivy", capability: "sec.dependency-scan", description: "FileSystem/container vulnerability scan", requiresBinary: true },
  { tool: "sim", capability: "sec.config-review", description: "Simulated config review", requiresBinary: false },
  { tool: "sim", capability: "sec.boundary-validation", description: "Simulated boundary validation", requiresBinary: false },
];

let _fid = 0;
function finding(
  req: SecurityScanRequest,
  kind: SecurityCheckKind,
  capability: string,
  partial: Omit<SecurityFinding, "id" | "checkKind" | "capability" | "affectedApplication">,
): SecurityFinding {
  _fid += 1;
  return {
    id: `finding_${req.requestId}_${_fid.toString(36)}`,
    checkKind: kind,
    capability,
    affectedApplication: req.targetApplication,
    ...partial,
  };
}

/** Simulated secret scanner (gitleaks-compatible interface). */
export function makeGitleaksExecutor(): CapabilityExecutor {
  return async (capability: string, args: Record<string, unknown>) => {
    const req = args.request as SecurityScanRequest;
    if (!req) return { ok: false, error: "Missing scan request", backend: "sim:gitleaks" };
    const findings: SecurityFinding[] = [];
    // Baseline informational finding so the developer pipeline always yields a
    // populated review package (no findings would mean "nothing ran"). Fail-closed
    // safe: low severity, no approval required.
    findings.push(finding(req, "secret-scan", capability, {
      title: "Gitleaks simulated sweep completed (no real binary)",
      severity: "low",
      confidence: 0.6,
      exploitability: 0.1,
      evidence: "sim:gitleaks --source=" + req.targetScope,
      recommendation: "Wire a real gitleaks binary to enforce secret detection.",
      requiresApproval: false,
    }));
    if (req.env === "production" && req.constraints.length === 0) {
      findings.push(finding(req, "secret-scan", capability, {
        title: "No documented secret-handling constraints for production scope",
        severity: "high",
        confidence: 0.7,
        exploitability: 0.5,
        evidence: "targetScope=" + req.targetScope,
        recommendation: "Document secret-handling constraints before production scan",
        requiresApproval: true,
      }));
    }
    return {
      ok: true,
      data: { tool: "gitleaks", simulated: true, findings },
      backend: "sim:gitleaks",
    };
  };
}

/** Simulated static analysis (semgrep-compatible interface). */
export function makeSemgrepExecutor(): CapabilityExecutor {
  return async (capability: string, args: Record<string, unknown>) => {
    const req = args.request as SecurityScanRequest;
    if (!req) return { ok: false, error: "Missing scan request", backend: "sim:semgrep" };
    const findings: SecurityFinding[] = [];
    findings.push(finding(req, "static-analysis", capability, {
      title: "Semgrep simulated analysis completed (no real binary)",
      severity: "low",
      confidence: 0.6,
      exploitability: 0.1,
      evidence: "sim:semgrep --config=auto " + req.targetScope,
      recommendation: "Wire a real semgrep binary to enforce static analysis.",
      requiresApproval: false,
    }));
    if (req.severityPolicy === "block-all") {
      findings.push(finding(req, "static-analysis", capability, {
        title: "block-all policy active: all patterns flagged for human review",
        severity: "medium",
        confidence: 0.6,
        exploitability: 0.3,
        evidence: "severityPolicy=block-all",
        recommendation: "Human must review every flagged pattern",
        requiresApproval: true,
      }));
    }
    return { ok: true, data: { tool: "semgrep", simulated: true, findings }, backend: "sim:semgrep" };
  };
}

/** Simulated dependency scanner (osv-scanner / trivy-compatible interface). */
export function makeOsvScannerExecutor(): CapabilityExecutor {
  return async (capability: string, args: Record<string, unknown>) => {
    const req = args.request as SecurityScanRequest;
    if (!req) return { ok: false, error: "Missing scan request", backend: "sim:osv-scanner" };
    const findings: SecurityFinding[] = [];
    findings.push(finding(req, "dependency-scan", capability, {
      title: "OSV-Scanner simulated dependency scan completed (no real binary)",
      severity: "low",
      confidence: 0.6,
      exploitability: 0.1,
      evidence: "sim:osv-scanner --recursive " + req.targetScope,
      recommendation: "Wire a real osv-scanner / trivy binary to enforce dependency CVEs.",
      requiresApproval: false,
    }));
    if (req.env === "production") {
      findings.push(finding(req, "dependency-scan", capability, {
        title: "Production dependency graph requires vulnerability baseline",
        severity: "medium",
        confidence: 0.5,
        exploitability: 0.4,
        evidence: "env=production",
        recommendation: "Pin and baseline dependency CVEs",
        requiresApproval: false,
      }));
    }
    return { ok: true, data: { tool: "osv-scanner", simulated: true, findings }, backend: "sim:osv-scanner" };
  };
}

/** Simulated config review adapter. */
export function makeConfigReviewExecutor(): CapabilityExecutor {
  return async (capability: string, args: Record<string, unknown>) => {
    const req = args.request as SecurityScanRequest;
    if (!req) return { ok: false, error: "Missing scan request", backend: "sim:config" };
    const findings: SecurityFinding[] = [finding(req, "config-review", capability, {
      title: "Configuration review simulated (no real scanner)",
      severity: "low",
      confidence: 0.5,
      exploitability: 0.1,
      evidence: "sim:config " + req.targetScope,
      recommendation: "Wire a real trivy/config scanner to enforce config review.",
      requiresApproval: false,
    })];
    return {
      ok: true,
      data: { tool: "sim", simulated: true, findings },
      backend: "sim:config",
    };
  };
}

/** Simulated boundary validation adapter. */
export function makeBoundaryValidationExecutor(): CapabilityExecutor {
  return async (capability: string, args: Record<string, unknown>) => {
    const req = args.request as SecurityScanRequest;
    if (!req) return { ok: false, error: "Missing scan request", backend: "sim:boundary" };
    const findings: SecurityFinding[] = [finding(req, "boundary-validation", capability, {
      title: "Boundary validation simulated (no real scanner)",
      severity: "low",
      confidence: 0.5,
      exploitability: 0.1,
      evidence: "sim:boundary " + req.targetScope,
      recommendation: "Wire a real boundary/dependency analysis to enforce module isolation.",
      requiresApproval: false,
    })];
    return {
      ok: true,
      data: { tool: "sim", simulated: true, findings },
      backend: "sim:boundary",
    };
  };
}

/**
 * Build one composite simulated executor that routes by capability id.
 * This is what setSecurityExecutor() receives in tests/demos — it exercises
 * the full provider path without any external binary.
 */
export function makeSimulatedSecurityExecutor(): CapabilityExecutor {
  const routers: Record<string, CapabilityExecutor> = {
    "sec.secret-scan": makeGitleaksExecutor(),
    "sec.static-analysis": makeSemgrepExecutor(),
    "sec.dependency-scan": makeOsvScannerExecutor(),
    "sec.config-review": makeConfigReviewExecutor(),
    "sec.boundary-validation": makeBoundaryValidationExecutor(),
  };
  return async (capability: string, args: Record<string, unknown>, ctx: { actor: string; env: "development" | "staging" | "production"; approvalToken?: string }) => {
    const route = routers[capability];
    if (!route) {
      return { ok: false, error: `No simulated adapter for capability: ${capability}`, backend: "sim:security" };
    }
    return route(capability, args, ctx);
  };
}
