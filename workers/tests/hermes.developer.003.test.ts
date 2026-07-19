// Developer Automation Pipeline — EPIC-003-002 tests
// Run with: npx vitest run hermes.developer.003.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeWorkRequest,
  type DevelopmentWorkRequest,
} from "../../hermes/services/developer/work-request.js";
import { planEngineering } from "../../hermes/services/developer/engineering-planner.js";
import {
  registerClaudeCodeProvider,
  setClaudeCodeExecutor,
  makeSimulatedClaudeCodeExecutor,
  CLAUDE_CODE_PROVIDER_ID,
} from "../../hermes/services/developer/developer-runtime.js";
import { runQa } from "../../hermes/services/developer/qa-pipeline.js";
import { runSecurity, securityBlocks } from "../../hermes/services/developer/security-pipeline.js";
import { recommendDocs } from "../../hermes/services/developer/docs-pipeline.js";
import { buildDeveloperReview } from "../../hermes/services/developer/review-package.js";
import { buildSimGitPlan, simRollback } from "../../hermes/services/developer/git-workflow.js";
import { runDeveloperPipeline } from "../../hermes/services/developer/orchestrator.js";
import { runDeveloperAutomationE2E } from "../../hermes/services/developer/e2e-simulation.js";
import {
  seedAgentWorkforce,
  assertWorkforceSafety,
} from "../../hermes/agents/seed.js";
import {
  enableProvider,
  disableProvider,
  setProviderHealth,
  resolveProviderForCapability,
  capabilityApprovalRequirement,
  _clearProviders,
} from "../../hermes/services/activation/provider-framework.js";
import { _clearAuditBuffer, readAuditBuffer } from "../../hermes/audit/event.js";

const ACTIVATION_PRINCIPAL: any = {
  id: "principal:test",
  permissions: ["hermes:activation:provider"],
  roles: ["platform"],
};

function ac(id: string, description: string, automatable = true) {
  return { id, description, automatable };
}

function sampleReq(overrides: Partial<DevelopmentWorkRequest> = {}): DevelopmentWorkRequest {
  return normalizeWorkRequest({
    kind: "feature",
    title: "Improve AGS Fertility consultation workflow",
    objective: "Add a guided intake step before the consultation booking",
    scope: "worker:consultation",
    targetApplication: "agsynergy-fertility",
    requestedBy: "product:kl",
    priority: 2,
    acceptanceCriteria: [ac("ac1", "Intake form renders"), ac("ac2", "Booking created on submit")],
    affectedModules: ["worker:consultation"],
    constraints: [],
    estimatedRisk: "medium",
    env: "development",
    ...overrides,
  });
}

beforeEach(() => {
  _clearProviders();
  _clearAuditBuffer();
});

describe("M1 — DevelopmentWorkRequest spec", () => {
  it("normalizes defaults and validates kind", () => {
    const r = sampleReq();
    expect(r.requestId).toMatch(/^devreq_/);
    expect(r.kind).toBe("feature");
    expect(r.constraints).toEqual([]);
  });

  it("rejects an unknown work kind", () => {
    expect(() => normalizeWorkRequest({ kind: "nonsense" } as any)).toThrow();
  });
});

describe("M2 — Engineering Planner", () => {
  it("produces a GoalSpec with plan + implement + verify/secure tasks", () => {
    const r = sampleReq();
    const { goal, tasks } = planEngineering(r);
    expect(goal.items.length).toBeGreaterThan(0);
    expect(tasks.some((t) => t.stage === "plan")).toBe(true);
    expect(tasks.some((t) => t.stage === "implement")).toBe(true);
    expect(tasks.some((t) => t.stage === "verify")).toBe(true);
    expect(tasks.some((t) => t.stage === "secure")).toBe(true);
  });

  it("tags ownership correctly (developer/qa/security/docs)", () => {
    const r = sampleReq();
    const { tasks } = planEngineering(r);
    expect(tasks.find((t) => t.stage === "implement")!.owner).toBe("developer-agent");
    expect(tasks.find((t) => t.stage === "verify")!.owner).toBe("qa-agent");
    expect(tasks.find((t) => t.stage === "secure")!.owner).toBe("security-agent");
  });

  it("enforces dependencies (implement after plan; verify/secure after implement)", () => {
    const r = sampleReq();
    const { tasks } = planEngineering(r);
    const impl = tasks.find((t) => t.stage === "implement")!;
    const plan = tasks.find((t) => t.stage === "plan")!;
    const verify = tasks.find((t) => t.stage === "verify")!;
    expect(impl.dependsOn).toContain(plan.id);
    expect(verify.dependsOn).toContain(impl.id);
  });
});

describe("M3 — Claude Code ToolProvider", () => {
  it("registers as a ManagedProvider and fails closed without an executor", async () => {
    const p = registerClaudeCodeProvider();
    expect(p.id).toBe(CLAUDE_CODE_PROVIDER_ID);
    expect(p.lifecycle).toBe("registered"); // fail-closed: not active
    // A registered (not enabled) provider is NOT resolvable — fail-closed.
    const beforeEnable = resolveProviderForCapability("dev.code.plan");
    expect(beforeEnable).toBeUndefined();
    // Enable + health-probe to active (never auto-active).
    enableProvider(p.id, ACTIVATION_PRINCIPAL);
    setProviderHealth(p.id, "healthy");
    expect(p.lifecycle).toBe("active");
    expect(p.enabled).toBe(true);
    const resolved = resolveProviderForCapability("dev.code.plan");
    expect(resolved).toBeDefined();
    // execution with no executor injected must fail closed
    const res = await (
      await import("../../hermes/services/activation/provider-framework.js")
    ).executeCapability(
      "dev.code.plan",
      { prompt: "x" },
      { actor: "tester", env: "development" },
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/failing closed|not wired/i);
  });

  it("execution works once a SIMULATED executor is injected (no real CLI)", async () => {
    registerClaudeCodeProvider();
    setClaudeCodeExecutor(makeSimulatedClaudeCodeExecutor());
    enableProvider(CLAUDE_CODE_PROVIDER_ID, ACTIVATION_PRINCIPAL);
    setProviderHealth(CLAUDE_CODE_PROVIDER_ID, "healthy");
    const pf = await import("../../hermes/services/activation/provider-framework.js");
    const res = await pf.executeCapability(
      "dev.code.plan",
      { prompt: "build intake" },
      { actor: "tester", env: "development" },
    );
    expect(res.ok).toBe(true);
    expect(String(res.data)).toMatch(/SIM PLAN/);
  });

  it("dev.code.generate is approval-gated in production (per canonical provider)", () => {
    const p = registerClaudeCodeProvider();
    enableProvider(p.id, ACTIVATION_PRINCIPAL);
    setProviderHealth(p.id, "healthy");
    expect(capabilityApprovalRequirement("dev.code.generate", "development")).toBe(false);
    expect(capabilityApprovalRequirement("dev.code.generate", "staging")).toBe(false);
    expect(capabilityApprovalRequirement("dev.code.generate", "production")).toBe(true);
  });

  it("enable requires an authorized principal (never auto-active)", () => {
    const p = registerClaudeCodeProvider();
    const unauthorized = { id: "x", permissions: [], roles: [] } as any;
    expect(() => enableProvider(p.id, unauthorized)).toThrow();
    expect(p.lifecycle).toBe("registered");
    enableProvider(p.id, ACTIVATION_PRINCIPAL);
    expect(p.lifecycle).toBe("enabled");
    disableProvider(p.id, ACTIVATION_PRINCIPAL);
    expect(p.lifecycle).toBe("disabled");
  });
});

describe("M4 — QA Pipeline", () => {
  it("runs 5 QA suites and fails boundary when no acceptance criteria on risky work", () => {
    const safe = runQa(sampleReq({ acceptanceCriteria: [ac("ok","ok")], estimatedRisk: "high" }));
    expect(safe.every((q) => q.ok)).toBe(true);
    const risky = runQa(sampleReq({ acceptanceCriteria: [], estimatedRisk: "high" }));
    const boundary = risky.find((q) => q.kind === "boundary")!;
    expect(boundary.ok).toBe(false);
  });
});

describe("M5 — Security Pipeline", () => {
  it("fails permission-validation for production work with no constraints", () => {
    const res = runSecurity(sampleReq({ env: "production", constraints: [] }), { approvalsEnforced: true });
    expect(securityBlocks(res)).toBe(true);
  });
  it("fails approval-verification when gates not enforced", () => {
    const res = runSecurity(sampleReq(), { approvalsEnforced: false });
    expect(securityBlocks(res)).toBe(true);
  });
});

describe("M6 — Documentation Pipeline", () => {
  it("recommends an ADR only when justified (refactor / boundary touch)", () => {
    const feat = recommendDocs(sampleReq({ kind: "feature" }));
    expect(feat.some((d) => d.kind === "adr")).toBe(false);
    const refactor = recommendDocs(sampleReq({ kind: "refactor" }));
    expect(refactor.some((d) => d.kind === "adr" && d.justified)).toBe(true);
    const boundary = recommendDocs(sampleReq({ affectedModules: ["worker:auth-provider"] }));
    expect(boundary.some((d) => d.kind === "adr")).toBe(true);
  });
});

describe("M7 — Review Package", () => {
  it("aggregates contributions and blocks when security fails", () => {
    const r = sampleReq({ env: "production", constraints: [] });
    const { tasks } = planEngineering(r);
    const developer = [
      { taskId: "t1", capability: "dev.code.plan", owner: "developer-agent" as const, state: "planned" as const, approvalRequired: false },
      { taskId: "t2", capability: "dev.code.generate", owner: "developer-agent" as const, state: "generated" as const, approvalRequired: true, generated: { diffRef: "d", filesTouched: ["a.ts"] } },
    ];
    const qa = runQa(r);
    const security = runSecurity(r, { approvalsEnforced: true });
    const docs = recommendDocs(r);
    const pkg = buildDeveloperReview({ req: r, developer: developer as any, qa, security, docs });
    expect(pkg.recommendation).toBe("blocked");
    expect(pkg.security.ok).toBe(false);
    expect(pkg.approvalRequirements.length).toBeGreaterThan(0);
  });
});

describe("M8 — Git Workflow (simulation only)", () => {
  it("never executes for real; push is always gated", () => {
    const r = sampleReq();
    const plan = buildSimGitPlan(r, {});
    expect(plan.events.every((e) => e.executedForReal === false)).toBe(true);
    const push = plan.events.find((e) => e.action === "push")!;
    expect(push.approvalRequired).toBe(true);
    expect(push.approved).toBe(false);
    const rollback = simRollback(plan, "tester");
    expect(rollback.executedForReal).toBe(false);
  });
});

describe("M9 — End-to-End Simulation", () => {
  it("runs the full pipeline for a feature request without real side effects", async () => {
    const r = sampleReq({ env: "development" });
    const result = await runDeveloperAutomationE2E(r);
    expect(result.workforceSafe).toBe(true);
    expect(result.providerActive).toBe(true);
    expect(Object.values(result.stagesOk).every(Boolean)).toBe(true);
    // No real git/push happened — audit must record sim-git events, not real ones.
    const buf = readAuditBuffer();
    expect(buf.some((e: any) => e.type === "dev.git.sim-plan")).toBe(true);
    expect(buf.some((e: any) => e.type === "git.push")).toBe(false);
  });
});

describe("Orchestrator integration", () => {
  it("completes a development pipeline and produces a review + sim git plan", async () => {
    registerClaudeCodeProvider();
    setClaudeCodeExecutor(makeSimulatedClaudeCodeExecutor());
    enableProvider(CLAUDE_CODE_PROVIDER_ID, ACTIVATION_PRINCIPAL);
    seedAgentWorkforce();
    assertWorkforceSafety();
    const r = sampleReq({ env: "development", acceptanceCriteria: [ac("x","x"), ac("y","y")] });
    const run = await runDeveloperPipeline(r, { actor: "product:kl", approvalToken: "sim-token" });
    expect(run.review.base.reviewId).toBeDefined();
    expect(run.git.events.length).toBeGreaterThan(0);
    expect(run.report).toMatch(/Developer Automation Pipeline/);
  });
});
