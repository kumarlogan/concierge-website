// Security Automation Platform — EPIC-003-003 tests
// Run with: npx vitest run hermes.security.003.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  SECURITY_PROVIDER_ID,
  SECURITY_CAPABILITIES,
  CHECK_CAPABILITY,
  registerSecurityProvider,
  bootstrapSecurityProvider,
  setSecurityExecutor,
  activateSecurityProvider,
  getSecurityProvider,
  validateScanRequest,
} from "../../hermes/services/security/providers/security-providers.js";
import {
  makeSimulatedSecurityExecutor,
  OSS_ADAPTERS,
} from "../../hermes/services/security/providers/oss-adapters.js";
import {
  registerSecurityAgent,
  approveSecurityAgent,
  activateSecurityAgent,
  disableSecurityAgent,
  getSecurityAgent,
  runSecurityReview,
  runSecurityScan,
} from "../../hermes/services/security/security-agent.js";
import {
  normalizeScanRequest,
  defaultChecks,
  type SecurityScanRequest,
  type SecurityCheckKind,
} from "../../hermes/services/security/security-work-model.js";
import { aggregateRisk, scoreRisk } from "../../hermes/services/security/risk-engine.js";
import {
  createSecurityReviewRequest,
  runSecurityForDeveloperTask,
} from "../../hermes/services/security/security-integration.js";
import {
  buildSecurityAdminView,
  type SecurityAdminView,
} from "../../hermes/services/security/admin-view.js";
import {
  listSecurityReviews,
  _clearSecurityReviews,
} from "../../hermes/services/security/security-store.js";
import { adminViewSecurity } from "../../hermes/admin/index.js";
import {
  _clearProviders,
  resolveProviderForCapability,
  executeCapability,
  capabilityApprovalRequirement,
} from "../../hermes/services/activation/provider-framework.js";
import { _clearAuditBuffer, readAuditBuffer } from "../../hermes/audit/event.js";

const PRINCIPAL: any = { id: "principal:admin", permissions: ["hermes:admin:read"], roles: ["admin"] };
const ACTIVATION_PRINCIPAL: any = {
  id: "principal:activation",
  permissions: ["hermes:activation:provider"],
  roles: ["platform"],
};

function scanReq(overrides: Partial<SecurityScanRequest> = {}): SecurityScanRequest {
  return normalizeScanRequest({
    title: "Sample security scan",
    targetApplication: "agsynergy-fertility",
    targetScope: "feature",
    env: "development",
    severityPolicy: "high",
    requiredChecks: defaultChecks("development"),
    approvalRequirement: {
      required: false,
      reason: "dev scan",
      appliesIn: ["production", "staging"],
    },
    constraints: [],
    requestedBy: "product:kl",
    ...overrides,
  });
}

beforeEach(() => {
  _clearProviders();
  _clearAuditBuffer();
  _clearSecurityReviews();
});

describe("M3 — Security Provider Framework", () => {
  it("registers the security provider with all capabilties", () => {
    registerSecurityProvider();
    const p = getSecurityProvider();
    expect(p?.id).toBe(SECURITY_PROVIDER_ID);
    expect(p?.domain).toBe("security");
    expect(p?.capabilities.map((c) => c.id).sort()).toEqual([...SECURITY_CAPABILITIES.map((c) => c.id)].sort());
  });

  it("resolveProviderForCapability returns undefined while inactive (fail-closed)", () => {
    registerSecurityProvider();
    expect(resolveProviderForCapability("sec.secret-scan")).toBeUndefined();
  });

  it("resolveProviderForCapability resolves after activateSecurityProvider", () => {
    registerSecurityProvider();
    activateSecurityProvider();
    const p = resolveProviderForCapability("sec.secret-scan");
    expect(p?.id).toBe(SECURITY_PROVIDER_ID);
  });

  it("security capabilities are NOT gated at capability level (approval is request-governed)", () => {
    for (const cap of SECURITY_CAPABILITIES) {
      // Security scan capabilities do not carry a capability-level approval gate;
      // approval is governed per-request via SecurityScanRequest.approvalRequirement
      // (see M5 integration tests) so scans never block silently in production.
      expect(capabilityApprovalRequirement(cap.id, "development")).toBe(false);
      expect(capabilityApprovalRequirement(cap.id, "production")).toBe(false);
    }
  });

  it("CHECK_CAPABILITY maps all check kinds", () => {
    const kinds: SecurityCheckKind[] = [
      "secret-scan",
      "static-analysis",
      "dependency-scan",
      "config-review",
      "boundary-validation",
    ];
    for (const k of kinds) expect(CHECK_CAPABILITY[k]).toBeTruthy();
  });

  it("validateScanRequest flags unknown capabilities", () => {
    registerSecurityProvider();
    const req = scanReq({
      requiredChecks: [...defaultChecks("development"), { kind: "secret-scan", capability: "sec.nope", minSeverity: "high" }],
    });
    const v = validateScanRequest(req);
    expect(v.ok).toBe(false);
    expect(v.missing).toContain("sec.nope");
  });
});

describe("M4 — OSS Compatibility Layer", () => {
  it("advertises vendor-neutral adapter specs without requiring binaries", () => {
    expect(OSS_ADAPTERS.length).toBeGreaterThan(0);
    const sim = OSS_ADAPTERS.find((a) => a.tool === "sim");
    expect(sim?.requiresBinary).toBe(false);
  });

  it("simulated executor routes every capability and returns findings shape", async () => {
    const exec = makeSimulatedSecurityExecutor();
    const req = scanReq();
    for (const cap of SECURITY_CAPABILITIES) {
      const res = await exec(cap.id, { request: req }, { actor: "security-agent", env: "development" });
      expect(res.ok).toBe(true);
      expect(Array.isArray((res.data as any).findings)).toBe(true);
    }
  });

  it("simulated executor rejects unknown capability", async () => {
    const exec = makeSimulatedSecurityExecutor();
    const res = await exec("sec.unknown", { request: scanReq() }, { actor: "security-agent", env: "development" });
    expect(res.ok).toBe(false);
  });
});

describe("M2 — Security Agent Runtime", () => {
  it("inactive agent cannot execute (fail-closed)", async () => {
    bootstrapSecurityProvider();
    activateSecurityProvider();
    registerSecurityAgent();
    const res = await runSecurityScan("security-agent", scanReq(), "secret-scan");
    expect(res.executed).toBe(false);
    expect(res.error).toMatch(/not active/);
  });

  it("active agent executes an authorized capability (executed:true)", async () => {
    bootstrapSecurityProvider();
    activateSecurityProvider();
    const a = registerSecurityAgent();
    approveSecurityAgent(a.id, ACTIVATION_PRINCIPAL);
    activateSecurityAgent(a.id, ACTIVATION_PRINCIPAL);
    const r = await runSecurityScan("security-agent", scanReq(), "secret-scan");
    expect(r.executed).toBe(true);
  });

  it("framework refuses an unadvertised capability (fail-closed)", async () => {
    bootstrapSecurityProvider();
    activateSecurityProvider();
    const res = await executeCapability("sec.unknown", { request: scanReq() }, { actor: "security-agent", env: "development" });
    expect(res.ok).toBe(false);
  });

  it("full review produces a package with findings + risk + recommendation", async () => {
    bootstrapSecurityProvider();
    activateSecurityProvider();
    const a = registerSecurityAgent();
    approveSecurityAgent(a.id, ACTIVATION_PRINCIPAL);
    activateSecurityAgent(a.id, ACTIVATION_PRINCIPAL);
    const pkg = await runSecurityReview("security-agent", scanReq());
    expect(pkg.requestId).toBeTruthy();
    expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(pkg.riskLevel);
    expect(pkg.recommendation).toBeTruthy();
    expect(pkg.audit.generatedBy).toBe("security-agent");
  });

  it("no active provider → scan reports unresolved, does not throw", async () => {
    registerSecurityProvider(); // not activated
    const a = registerSecurityAgent();
    approveSecurityAgent(a.id, ACTIVATION_PRINCIPAL);
    activateSecurityAgent(a.id, ACTIVATION_PRINCIPAL);
    const res = await runSecurityScan("security-agent", scanReq(), "secret-scan");
    expect(res.executed).toBe(false);
    expect(res.error).toMatch(/No active provider/);
  });

  it("disableSecurityAgent stops execution", async () => {
    bootstrapSecurityProvider();
    activateSecurityProvider();
    const a = registerSecurityAgent();
    approveSecurityAgent(a.id, ACTIVATION_PRINCIPAL);
    activateSecurityAgent(a.id, ACTIVATION_PRINCIPAL);
    disableSecurityAgent(a.id, PRINCIPAL);
    const res = await runSecurityScan("security-agent", scanReq(), "secret-scan");
    expect(res.executed).toBe(false);
    expect(res.error).toMatch(/not active/);
  });
});

describe("M1 — Security Work Model", () => {
  it("normalizeScanRequest fills defaults", () => {
    const r = scanReq();
    expect(r.requestId).toBeTruthy();
    expect(r.requiredChecks.length).toBeGreaterThan(0);
  });

  it("defaultChecks differs by environment", () => {
    const dev = defaultChecks("development").map((c) => c.capability);
    const prod = defaultChecks("production").map((c) => c.capability);
    expect(prod.length).toBeGreaterThanOrEqual(dev.length);
  });
});

describe("M6 — Risk Engine", () => {
  it("no findings → LOW (non-prod)", () => {
    expect(aggregateRisk([], scanReq({ env: "development" }))).toBe("LOW");
  });

  it("critical finding → CRITICAL", () => {
    const r = aggregateRisk(
      [{ id: "f1", checkKind: "secret-scan", capability: "sec.secret-scan", affectedApplication: "x", title: "t", severity: "critical", confidence: 1, exploitability: 1, evidence: "", recommendation: "", requiresApproval: true } as any],
      scanReq(),
    );
    expect(r).toBe("CRITICAL");
  });

  it("fails closed on corrupted input → CRITICAL", () => {
    expect(aggregateRisk(undefined as any, scanReq())).toBe("CRITICAL");
  });

  it("scoreRisk returns numeric detail", () => {
    const d = scoreRisk([], scanReq());
    expect(d.score).toBe(0);
    expect(d.findingCount).toBe(0);
    expect(d.highestSeverity).toBe("none");
  });
});

describe("M5 — Developer → Security Integration", () => {
  const devReq: any = {
    requestId: "devreq_1",
    title: "Add feature",
    kind: "feature",
    objective: "x",
    priority: 2,
    scope: "worker",
    targetApplication: "agsynergy-fertility",
    affectedModules: ["worker"],
    acceptanceCriteria: [],
    constraints: [{ id: "c1", description: "no secrets in code", kind: "policy" }],
    estimatedRisk: "medium",
    requestedBy: "product:kl",
    env: "development",
  };

  it("creates a security review request from a dev request", () => {
    const req = createSecurityReviewRequest(devReq, { requestId: "devreq_1", recommendation: "approve" });
    expect(req.sourceRequestId).toBe("devreq_1");
    expect(req.constraints).toContain("no secrets in code");
    expect(req.approvalRequirement.required).toBe(false); // dev env
  });

  it("production dev request requires approval", () => {
    const req = createSecurityReviewRequest({ ...devReq, env: "production" }, { requestId: "devreq_1", recommendation: "approve" });
    expect(req.approvalRequirement.required).toBe(true);
  });

  it("runs a full security review for a completed dev task (agent active)", async () => {
    bootstrapSecurityProvider();
    activateSecurityProvider();
    const a = registerSecurityAgent();
    approveSecurityAgent(a.id, ACTIVATION_PRINCIPAL);
    activateSecurityAgent(a.id, ACTIVATION_PRINCIPAL);
    const pkg = await runSecurityForDeveloperTask("security-agent", devReq, { requestId: "devreq_1", recommendation: "approve" });
    expect(pkg.sourceRequestId).toBe("devreq_1");
    expect(pkg.audit.generatedBy).toBe("security-agent");
  });
});

describe("M7 — Admin Visibility", () => {
  it("buildSecurityAdminView aggregates reviews", async () => {
    bootstrapSecurityProvider();
    activateSecurityProvider();
    const a = registerSecurityAgent();
    approveSecurityAgent(a.id, ACTIVATION_PRINCIPAL);
    activateSecurityAgent(a.id, ACTIVATION_PRINCIPAL);
    await runSecurityReview("security-agent", scanReq());
    const view: SecurityAdminView = buildSecurityAdminView(listSecurityReviews());
    expect(view.latestScans.length).toBe(1);
    expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(view.overallRisk);
    expect(view.providerHealth.length).toBe(1);
    expect(view.providerHealth[0].id).toBe(SECURITY_PROVIDER_ID);
  });

  it("adminViewSecurity requires human principal with security read", () => {
    expect(() => adminViewSecurity({ id: "x" } as any)).toThrow();
  });

  it("adminViewSecurity returns view for authorized principal", () => {
    const view = adminViewSecurity(PRINCIPAL);
    expect(view).toBeTruthy();
    expect(Array.isArray(view.latestScans)).toBe(true);
  });
});

describe("Audit — every security action is audited", () => {
  it("emits sec.* audit events on scan", async () => {
    bootstrapSecurityProvider();
    activateSecurityProvider();
    const a = registerSecurityAgent();
    approveSecurityAgent(a.id, ACTIVATION_PRINCIPAL);
    activateSecurityAgent(a.id, ACTIVATION_PRINCIPAL);
    await runSecurityScan("security-agent", scanReq(), "secret-scan");
    const types = readAuditBuffer().map((e) => e.type);
    expect(types.some((t) => t.startsWith("sec."))).toBe(true);
    expect(types).toContain("sec.scan.start");
  });
});
