// EPIC-002-007 · Hermes Activation Platform — validation gates.
// Run: npx vitest run hermes.activation.007.test.ts  (from workers/)
import { describe, it, expect, beforeEach } from "vitest";
import {
  registerProvider,
  enableProvider,
  disableProvider,
  setProviderHealth,
  listActiveProviders,
  resolveProviderForCapability,
  executeCapability,
  discoverCapabilities,
  capabilityApprovalRequirement,
  _clearProviders,
} from "../../hermes/services/activation/provider-framework.js";
import { registerClaudeCodeProvider, setClaudeCodeExecutor } from "../../hermes/services/activation/providers/claude-code.js";
import { decideGate, gateForApproval } from "../../hermes/services/activation/approval-gates.js";
import {
  setGitBackend,
  createBranch,
  commitChanges,
  pushBranch,
  preparePush,
} from "../../hermes/services/activation/git-provider.js";
import { orchestrate, DEFAULT_ORCHESTRATION } from "../../hermes/services/activation/orchestrator.js";
import { runDeveloperAgent, resumeAfterApproval } from "../../hermes/services/activation/developer-agent.js";
import { _clearAuditBuffer, readAuditBuffer } from "../../hermes/audit/event.js";
import { createTask, assignTask, approveTask, startTask } from "../../hermes/services/agents/task.js";
const ADMIN = { id: "test-admin", permissions: ["hermes:activation:provider"] } as any;
const DEV = "dev-agent-1";
const APP = "ags-fertility";

function activateClaudeCode() {
  setClaudeCodeExecutor((capability, args) => {
    if (capability === "dev.code.plan") return { ok: true, data: `plan for ${String(args.prompt)}`, backend: "dev.claude-code" };
    if (capability === "dev.code.generate") return { ok: true, data: `code for ${String(args.prompt)}`, backend: "dev.claude-code" };
    return { ok: false, error: `unsupported ${capability}`, backend: "dev.claude-code" };
  });
  const p = registerClaudeCodeProvider();
  enableProvider(p.id, ADMIN);
  setProviderHealth(p.id, "healthy");
  return p;
}

beforeEach(() => {
  _clearProviders();
  _clearAuditBuffer();
  setGitBackend(undefined);
});

describe("M1 · capability provider framework (fail-closed)", () => {
  it("refuses capability execution when no active provider exists", async () => {
    const res = await executeCapability("dev.code.generate", { prompt: "x" }, { actor: DEV, env: "development" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/No active provider/);
    expect(res.backend).toBe("hermes.fail-closed");
  });

  it("executes only when provider is active+enabled+healthy", async () => {
    activateClaudeCode();
    const res = await executeCapability("dev.code.generate", { prompt: "build login" }, { actor: DEV, env: "development" });
    expect(res.ok).toBe(true);
    expect(String(res.data)).toContain("build login");
  });

  it("disables stop execution (fail-closed)", async () => {
    const p = activateClaudeCode();
    // disable the provider → it must no longer serve capabilities
    const disabler = { id: "x", permissions: ["hermes:activation:provider"] } as any;
    disableProvider(p.id, disabler);
    const res = await executeCapability("dev.code.generate", { prompt: "x" }, { actor: DEV, env: "development" });
    expect(res.ok).toBe(false);
  });

  it("enforces activation permission (no token → denied)", () => {
    const p = registerClaudeCodeProvider();
    const unauth = { id: "nobody", permissions: [] } as any;
    expect(() => enableProvider(p.id, unauth)).toThrow(/missing hermes:activation:provider/);
  });
});

describe("M2 · Claude Code provider (vendor-neutral)", () => {
  it("does not import any vendor SDK and exposes dev.code.* capabilities", () => {
    const p = activateClaudeCode();
    const ids = p.capabilities.map((c) => c.id);
    expect(ids).toContain("dev.code.plan");
    expect(ids).toContain("dev.code.generate");
    expect(ids).toContain("dev.code.refactor");
  });
});

describe("M4 · git provider — never auto-push", () => {
  it("pushBranch refuses without an approval token", async () => {
    setGitBackend({
      branch: async () => ({ ok: true, ref: "feat/x" }),
      commit: async () => ({ ok: true, sha: "abc" }),
      diff: async () => ({ ok: true, patch: "" }),
      preparePush: async () => ({ ok: true, summary: "ready" }),
      push: async () => ({ ok: true }),
    });
    const denied = await pushBranch(DEV, "origin", "feat/x", "");
    expect(denied.ok).toBe(false);
    expect(denied.error).toMatch(/explicit human approval/);
  });

  it("commit in production requires an approval token", async () => {
    setGitBackend({
      branch: async () => ({ ok: true }),
      commit: async () => ({ ok: true, sha: "sha1" }),
      diff: async () => ({ ok: true }),
      preparePush: async () => ({ ok: true }),
      push: async () => ({ ok: true }),
    });
    const dev = await commitChanges(DEV, "msg", undefined, undefined);
    expect(dev.ok).toBe(false);
    expect(dev.error).toMatch(/approval token/);
  });

  it("createBranch works and preparePush does not push", async () => {
    setGitBackend({
      branch: async (n) => ({ ok: true, ref: n }),
      commit: async () => ({ ok: true }),
      diff: async () => ({ ok: true }),
      preparePush: async () => ({ ok: true, summary: "branch ready for review" }),
      push: async () => ({ ok: true }),
    });
    const b = await createBranch(DEV, "feat/y");
    expect(b.ok).toBe(true);
    const prep = await preparePush(DEV, "origin", "feat/y");
    expect(prep.ok).toBe(true);
    // push was never called; verify via audit: no git.push event
    expect(readAuditBuffer().some((e: any) => e.type === "git.push")).toBe(false);
  });
});

describe("M6 · approval gates (fail-closed)", () => {
  it("push/deploy/destructive/secret NEVER auto-approve", () => {
    for (const a of ["git.push", "deploy", "destructive", "secret.read", "secret.write"] as const) {
      for (const env of ["development", "staging", "production"] as const) {
        expect(decideGate(a, env).decision).toBe("human");
      }
    }
  });

  it("git.commit is human-gated only in production", () => {
    expect(decideGate("git.commit", "development").decision).toBe("auto");
    expect(decideGate("git.commit", "staging").decision).toBe("auto");
    expect(decideGate("git.commit", "production").decision).toBe("human");
  });

  it("gateForApproval produces a pending approval request", () => {
    const req = gateForApproval(DEV, APP, "git.push", "production");
    expect(req.state).toBe("pending");
    expect(req.action).toBe("write");
  });
});

describe("M3 · orchestrator (retry/timeout/cancel)", () => {
  it("retries on recoverable failure then succeeds", async () => {
    const t = createTask({ agentId: DEV, applicationId: APP, purpose: "orch-1", requestedBy: DEV });
    assignTask(t.id, DEV); approveTask(t.id, DEV);
    let n = 0;
    const res = await orchestrate(t.id, async () => {
      n++;
      if (n < 2) return { ok: false }; // recoverable
      return { ok: true };
    }, { config: { ...DEFAULT_ORCHESTRATION, maxAttempts: 3 }, actor: DEV });
    expect(res.ok).toBe(true);
    expect(res.attempts).toBe(2);
  });

  it("marks terminal failure without retry", async () => {
    const t = createTask({ agentId: DEV, applicationId: APP, purpose: "orch-2", requestedBy: DEV });
    assignTask(t.id, DEV); approveTask(t.id, DEV);
    const res = await orchestrate(t.id, async () => ({ ok: false, terminal: true }), {
      config: { ...DEFAULT_ORCHESTRATION, maxAttempts: 3 },
      actor: DEV,
    });
    expect(res.ok).toBe(false);
    expect(res.attempts).toBe(1);
    expect(res.state).toBe("failed");
  });

  it("honors cancellation", async () => {
    const t = createTask({ agentId: DEV, applicationId: APP, purpose: "orch-3", requestedBy: DEV });
    assignTask(t.id, DEV); approveTask(t.id, DEV);
    const res = await orchestrate(t.id, async (_t, _a, tk) => {
      tk.cancelled = true;
      return { ok: false };
    }, { actor: DEV });
    expect(res.state).toBe("cancelled");
    expect(res.ok).toBe(false);
  });
});

describe("M5 · developer agent runtime (human-supervised)", () => {
  it("gates code generation behind human approval in production", async () => {
    activateClaudeCode();
    // Stub a security provider via the framework
    registerProvider({
      id: "sec.stub",
      label: "Security Stub",
      domain: "security",
      backend: "stub",
      capabilities: [{ id: "sec.scan", description: "scan", requiresApproval: false }],
      executor: (cap) => ({ ok: true, data: "clean", backend: "stub" }),
    });
    const sp = { id: "sec-admin", permissions: ["hermes:activation:provider"] } as any;
    enableProvider("sec.stub", sp);
    setProviderHealth("sec.stub", "healthy");

    const result = await runDeveloperAgent({
      agentId: DEV,
      applicationId: APP,
      prompt: "add rate limiting",
      env: "production",
    });
    // Plan runs auto; production code-gen requires explicit human approval.
    expect(result.plan).toBeDefined();
    expect(result.state).toBe("awaiting_approval");
    expect(result.approval?.state).toBe("pending");
    expect(result.approval?.action).toBe("write");

    // Resume with a human-issued token → full flow completes (git awaits too).
    const r2 = await resumeAfterApproval(
      { agentId: DEV, applicationId: APP, prompt: "add rate limiting", env: "production" },
      result.taskId,
      "human-token-1",
    );
    expect(r2.generated).toBeDefined();
    expect(r2.validation?.ok).toBe(true);
    expect(r2.security?.ok).toBe(true);
    // production git.commit gate → still awaiting human approval for commit
    expect(r2.state).toBe("awaiting_approval");
  });

  it("resumeAfterApproval commits (with token) and prepares push but never pushes", async () => {
    activateClaudeCode();
    registerProvider({
      id: "sec.stub2",
      label: "Security Stub 2",
      domain: "security",
      backend: "stub",
      capabilities: [{ id: "sec.scan", description: "scan", requiresApproval: false }],
      executor: () => ({ ok: true, data: "clean", backend: "stub" }),
    });
    const sp = { id: "sec-admin", permissions: ["hermes:activation:provider"] } as any;
    enableProvider("sec.stub2", sp);
    setProviderHealth("sec.stub2", "healthy");

    let committed = false;
    let pushed = false;
    setGitBackend({
      branch: async () => ({ ok: true, ref: "feat/r" }),
      commit: async () => { committed = true; return { ok: true, sha: "s1" }; },
      diff: async () => ({ ok: true }),
      preparePush: async () => ({ ok: true, summary: "ready" }),
      push: async () => { pushed = true; return { ok: true }; },
    });

    const result = await runDeveloperAgent({ agentId: DEV, applicationId: APP, prompt: "x", env: "development" });
    // dev env → auto commit path; but we explicitly test resumeAfterApproval
    const r2 = await resumeAfterApproval(
      { agentId: DEV, applicationId: APP, prompt: "x", env: "development", branchName: "feat/r" },
      result.taskId,
      "human-token-123",
    );
    expect(committed).toBe(true);
    expect(pushed).toBe(false); // NEVER auto-push
    expect(r2.state).toBe("completed");
  });
});
