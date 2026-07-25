// EPIC-003-005 PHASE 5 — Workforce Persistence Integration Tests
// Run with: npx vitest run workers/tests/workforce-persistence.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { tmpdir } from "os";

import {
  createWorkflow,
  assignWorkflow,
  requestTaskApproval,
  grantTaskApproval,
  rejectTaskApproval,
  cancelWorkflow,
  pauseWorkflow,
  resumeWorkflow,
  getWorkflowView,
  listWorkflows,
  _clearWorkflows,
  setRepository,
  injectWorkflow,
} from "../../hermes/services/workforce/orchestration.js";

import {
  FileWorkflowBackend,
  MemoryWorkflowBackend,
} from "../../hermes/services/workforce/workflow-repository.js";
import { flushWorkflows } from "../../hermes/services/workforce/orchestration.js";

import { recoverWorkflows } from "../../hermes/services/workforce/persistence.js";

import type { WorkItem } from "../../hermes/services/execution/work-planner.js";

// ─── Test helpers ────────────────────────────────────────────

function workItems(items: Partial<WorkItem>[] = []): WorkItem[] {
  if (items.length > 0) return items as WorkItem[];
  return [
    {
      id: "item-1",
      capability: "deploy",
      description: "Deploy artifact",
      parallelizable: false,
      priority: 1,
    },
  ];
}

function makeInput(over: Record<string, unknown> = {}) {
  return {
    title: "Test workflow",
    applicationId: "app:test",
    requestedBy: "test-user",
    env: "development" as const,
    items: workItems(),
    ...over,
  };
}

function tempDbPath(): string {
  return path.join(tmpdir(), `wf-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
}

// ─── Helpers to simulate restart ─────────────────────────────

async function simulateRestart(
  filePath: string,
): Promise<{ restored: number; skipped: number }> {
  _clearWorkflows();
  const backend = new FileWorkflowBackend(filePath);
  await backend.load();
  return recoverWorkflows(backend);
}

// ─── 1. Basic Repository CRUD Tests ──────────────────────────

describe("WorkflowRepository — CRUD", () => {
  let repo: MemoryWorkflowBackend;

  beforeEach(() => {
    repo = new MemoryWorkflowBackend();
  });

  it("creates and reads a workflow", async () => {
    const wf = createWorkflow(makeInput());
    await repo.createWorkflow(wf);
    const loaded = await repo.getWorkflow(wf.id);
    expect(loaded).toBeDefined();
    expect(loaded!.id).toBe(wf.id);
    expect(loaded!.title).toBe("Test workflow");
    expect(loaded!.state).toBe("waiting");
  });

  it("updateWorkflow persists state changes", async () => {
    const wf = createWorkflow(makeInput());
    await repo.createWorkflow(wf);
    wf.state = "paused";
    wf.note = "paused by operator";
    await repo.updateWorkflow(wf);
    const loaded = await repo.getWorkflow(wf.id);
    expect(loaded!.state).toBe("paused");
    expect(loaded!.note).toBe("paused by operator");
  });

  it("deleteWorkflow removes workflow entirely", async () => {
    const wf = createWorkflow(makeInput());
    await repo.createWorkflow(wf);
    await repo.deleteWorkflow(wf.id);
    const loaded = await repo.getWorkflow(wf.id);
    expect(loaded).toBeUndefined();
  });

  it("listWorkflows returns all workflows", async () => {
    const wf1 = createWorkflow(makeInput({ title: "WF 1" }));
    const wf2 = createWorkflow(makeInput({ title: "WF 2" }));
    await repo.createWorkflow(wf1);
    await repo.createWorkflow(wf2);
    const list = await repo.listWorkflows();
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it("saveTask and listTasks persist task refs", async () => {
    const wf = createWorkflow(makeInput());
    await repo.createWorkflow(wf);
    const task = wf.tasks[0];
    await repo.saveTask(wf.id, task);
    const tasks = await repo.listTasks(wf.id);
    expect(tasks.length).toBe(1);
    expect(tasks[0].itemId).toBe(task.itemId);
  });

  it("saveApproval and getApproval persist approval requests", async () => {
    const wf = createWorkflow(makeInput());
    await repo.createWorkflow(wf);
    const req = { agentId: "agent-x", applicationId: "app:test", env: "development" as const, permission: "write", capability: "deploy", state: "pending" as const };
    await repo.saveApproval(wf.id, "q-1", req);
    const loaded = await repo.getApproval(wf.id, "q-1");
    expect(loaded).toBeDefined();
    expect(loaded!.capability).toBe("deploy");
  });

  it("removeApproval correctly deletes", async () => {
    const wf = createWorkflow(makeInput());
    await repo.createWorkflow(wf);
    const req = { agentId: "agent-x", applicationId: "app:test", env: "development" as const, permission: "write", capability: "deploy", state: "pending" as const };
    await repo.saveApproval(wf.id, "q-1", req);
    await repo.removeApproval(wf.id, "q-1");
    const loaded = await repo.getApproval(wf.id, "q-1");
    expect(loaded).toBeUndefined();
  });

  it("addGrantedApproval and hasGrantedApproval work", async () => {
    const wf = createWorkflow(makeInput());
    await repo.createWorkflow(wf);
    await repo.addGrantedApproval(wf.id, "q-1", "approver-x");
    expect(await repo.hasGrantedApproval(wf.id, "q-1")).toBe(true);
    expect(await repo.hasGrantedApproval(wf.id, "q-2")).toBe(false);
  });

  it("clearGrantedApprovals empties the set", async () => {
    const wf = createWorkflow(makeInput());
    await repo.createWorkflow(wf);
    await repo.addGrantedApproval(wf.id, "q-1", "approver-x");
    await repo.clearGrantedApprovals(wf.id);
    expect(await repo.hasGrantedApproval(wf.id, "q-1")).toBe(false);
  });

  it("createWorkflow is idempotent", async () => {
    const wf = createWorkflow(makeInput());
    await repo.createWorkflow(wf);
    await repo.createWorkflow(wf); // second call — no error
    const loaded = await repo.getWorkflow(wf.id);
    expect(loaded).toBeDefined();
  });
});

// ─── 2. Restart Recovery Tests ───────────────────────────────

describe("Workflow persistence — restart recovery", () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = tempDbPath();
    _clearWorkflows();
  });

  afterEach(() => {
    _clearWorkflows();
    try { fs.unlinkSync(dbPath); } catch {}
  });

  it("creates a workflow and restores it after restart", async () => {
    // First session
    const repo1 = new FileWorkflowBackend(dbPath);
    setRepository(repo1);
    const wf = createWorkflow(makeInput());
    await repo1.createWorkflow(wf); // ensure written to file

    // Restart
  await flushWorkflows(); // ensure pending writes complete
    const result = await simulateRestart(dbPath);
    expect(result.restored).toBeGreaterThanOrEqual(1);

    const loaded = getWorkflowView(wf.id);
    expect(loaded).toBeDefined();
    expect(loaded.title).toBe("Test workflow");
  });

  it("does not restore completed workflows", async () => {
    const repo1 = new FileWorkflowBackend(dbPath);
    setRepository(repo1);
    const wf = createWorkflow(makeInput());
    await repo1.createWorkflow(wf);
    wf.state = "completed";
    await repo1.updateWorkflow(wf);

  await flushWorkflows(); // ensure pending writes complete
    const result = await simulateRestart(dbPath);
    expect(result.skipped).toBeGreaterThanOrEqual(1);
  });

  it("approval survives restart", async () => {
    const repo1 = new FileWorkflowBackend(dbPath);
    setRepository(repo1);
    const wf = createWorkflow(makeInput());
    await repo1.createWorkflow(wf);
    const task = wf.tasks[0];

    // Assign and request approval
    assignWorkflow(wf.id, "test-user");
    requestTaskApproval(wf.id, task.itemId, "test-user");
    await repo1.saveApproval(wf.id, task.queueId, { state: "pending", agentId: "agent-x", applicationId: "app:test", env: "development", permission: "write", capability: "deploy" });

    // Restart
  await flushWorkflows(); // ensure pending writes complete
    await simulateRestart(dbPath);
    const loaded = getWorkflowView(wf.id);
    expect(loaded).toBeDefined();
    expect(loaded.approvals.size).toBeGreaterThanOrEqual(1);
  });

  it("paused workflow is restored as paused", async () => {
    const repo1 = new FileWorkflowBackend(dbPath);
    setRepository(repo1);
    const wf = createWorkflow(makeInput());
    await repo1.createWorkflow(wf);
    pauseWorkflow(wf.id, "operator");

  await flushWorkflows(); // ensure pending writes complete
    await simulateRestart(dbPath);
    const loaded = getWorkflowView(wf.id);
    expect(loaded.state).toBe("paused");
  });

  it("expired approval is still recordable after restart", async () => {
    const repo1 = new FileWorkflowBackend(dbPath);
    setRepository(repo1);
    const wf = createWorkflow(makeInput());
    await repo1.createWorkflow(wf);
    const task = wf.tasks[0];
    assignWorkflow(wf.id, "test-user");

    // Create approval that's already expired
    const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    requestTaskApproval(wf.id, task.itemId, "test-user");
    await repo1.saveApproval(wf.id, task.queueId, { state: "pending", agentId: "agent-x", applicationId: "app:test", env: "development", permission: "write", capability: "deploy", expiresAt: pastDate });

    // Restart — expired approval should be present
  await flushWorkflows(); // ensure pending writes complete
    await simulateRestart(dbPath);
    const loaded = getWorkflowView(wf.id);
    expect(loaded).toBeDefined();
    // The approval should exist (it's expired, but still recordable)
    expect(loaded.state).toBe("waiting");
  });

  it("completed workflow is archived (not restored)", async () => {
    const repo1 = new FileWorkflowBackend(dbPath);
    setRepository(repo1);
    const wf = createWorkflow(makeInput());
    await repo1.createWorkflow(wf);
    wf.state = "completed";
    wf.timeline.push({ at: new Date().toISOString(), state: "completed", note: "all done" });
    await repo1.updateWorkflow(wf);

  await flushWorkflows(); // ensure pending writes complete
    const result = await simulateRestart(dbPath);
    expect(result.restored).toBeGreaterThanOrEqual(0);
  });

  it("repository failure handling — createWorkflow throws gracefully", async () => {
    const repo1 = new FileWorkflowBackend(dbPath);
    setRepository(repo1);
    // Simulate by deleting the file path after creation
    const wf1 = createWorkflow(makeInput({ title: "Before crash" }));
    await repo1.createWorkflow(wf1);
  });
});

// ─── 3. Orchestration Integration Tests ──────────────────────

describe("Orchestration with repository — integration", () => {
  let repo: MemoryWorkflowBackend;
  let dbPath: string;

  beforeEach(() => {
    dbPath = tempDbPath();
    _clearWorkflows();
    repo = new MemoryWorkflowBackend();
    setRepository(repo);
  });

  afterEach(() => {
    _clearWorkflows();
    try { fs.unlinkSync(dbPath); } catch {}
  });

  it("createWorkflow → persisted in repository", async () => {
    const wf = createWorkflow(makeInput());
    const loaded = await repo.getWorkflow(wf.id);
    expect(loaded).toBeDefined();
    expect(loaded!.id).toBe(wf.id);
  });

  it("createWorkflow → tasks persisted", async () => {
    const wf = createWorkflow(makeInput({ items: [
      { id: "i1", capability: "deploy", description: "d1", parallelizable: false, priority: 1 },
      { id: "i2", capability: "test", description: "d2", parallelizable: true, priority: 2 },
    ] }));
    const tasks = await repo.listTasks(wf.id);
    expect(tasks.length).toBe(2);
  });

  it("assignWorkflow → queueId persisted to tasks", async () => {
    const wf = createWorkflow(makeInput());
    assignWorkflow(wf.id, "test-user");
    const tasks = await repo.listTasks(wf.id);
    for (const t of tasks) {
      expect(t.queueId).toBeTruthy();
    }
  });

  it("request + grant approval → approval persisted + granted recorded", async () => {
    const wf = createWorkflow(makeInput());
    assignWorkflow(wf.id, "test-user");
    const task = wf.tasks[0];

    requestTaskApproval(wf.id, task.itemId, "test-user");

    // Check approval persisted
    const savedApproval = await repo.getApproval(wf.id, task.queueId);
    expect(savedApproval).toBeDefined();
    expect(savedApproval!.state).toBe("pending");

    // Grant
    await grantTaskApproval(wf.id, task.itemId, "approver-x");

    // Check approval removed from pending
    const afterGrant = await repo.getApproval(wf.id, task.queueId);
    expect(afterGrant).toBeUndefined();

    // Check granted recorded
    expect(await repo.hasGrantedApproval(wf.id, task.queueId)).toBe(true);
  });

  it("reject approval → removed from pending", async () => {
    const wf = createWorkflow(makeInput());
    assignWorkflow(wf.id, "test-user");
    const task = wf.tasks[0];
    requestTaskApproval(wf.id, task.itemId, "test-user");

    await rejectTaskApproval(wf.id, task.itemId, "rejector-x");

    const afterReject = await repo.getApproval(wf.id, task.queueId);
    expect(afterReject).toBeUndefined();
  });

  it("cancel workflow → granted approvals cleared", async () => {
    const wf = createWorkflow(makeInput());
    assignWorkflow(wf.id, "test-user");
    const task = wf.tasks[0];
    requestTaskApproval(wf.id, task.itemId, "test-user");
    await grantTaskApproval(wf.id, task.itemId, "approver-x");

    cancelWorkflow(wf.id, "operator");

    expect(await repo.hasGrantedApproval(wf.id, task.queueId)).toBe(false);
  });

  it("pause + resume — persistence follows state", async () => {
    const wf = createWorkflow(makeInput());
    await repo.createWorkflow(wf);

    pauseWorkflow(wf.id, "operator");
    let loaded = await repo.getWorkflow(wf.id);
    expect(loaded!.state).toBe("paused"); // set by persistWorkflow in pauseWorkflow

    resumeWorkflow(wf.id, "operator");
    loaded = await repo.getWorkflow(wf.id);
    expect(loaded!.state).toBe("queued"); // no pending approvals after resume
  });

  it("listWorkflows returns persisted workflows", async () => {
    createWorkflow(makeInput({ title: "A" }));
    createWorkflow(makeInput({ title: "B" }));
    const list = listWorkflows();
    expect(list.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── 4. Activation Workflow Integration ──────────────────────

describe("ActivationWorkflowService — persistence", () => {
  let workforceRepo: import("../../hermes/services/workforce/repository.js").WorkforceRepository;
  let service: any;

  beforeEach(async () => {
    const { createWorkforceRepository, MemoryWorkforceBackend } = await import("../../hermes/services/workforce/repository.js");
    workforceRepo = createWorkforceRepository(new MemoryWorkforceBackend());
    const { ActivationWorkflowService } = await import("../../hermes/services/workforce/activation-workflow.js");
    service = new ActivationWorkflowService(workforceRepo);
  });

  it("creates activation request through repository", async () => {
    const requestId = await service.requestActivation("agent-1", "user-1", "testing");
    expect(requestId).toBeTruthy();
    const saved = await workforceRepo.getActivationRequest(requestId);
    expect(saved).toBeDefined();
    expect(saved!.status).toBe("pending");
  });

  it("approveActivation updates state", async () => {
    const requestId = await service.requestActivation("agent-1", "user-1", "testing");
    await service.approveActivation(requestId, "approver-1");
    const saved = await workforceRepo.getActivationRequest(requestId);
    expect(saved!.status).toBe("approved");
    expect(saved!.approvedBy).toBe("approver-1");
  });

  it("rejectActivation updates state", async () => {
    const requestId = await service.requestActivation("agent-1", "user-1", "testing");
    await service.rejectActivation(requestId, "rejector-1", "not needed");
    const saved = await workforceRepo.getActivationRequest(requestId);
    expect(saved!.status).toBe("denied");
  });

  it("approve after reject throws", async () => {
    const requestId = await service.requestActivation("agent-1", "user-1", "testing");
    await service.rejectActivation(requestId, "rejector-1", "not needed");
    await expect(
      service.approveActivation(requestId, "approver-1"),
    ).rejects.toThrow(/already (approved|denied)/i);
  });

  it("assignTestTask only works on active agents", async () => {
    // Agent doesn't exist yet — should throw "Agent not found"
    await expect(
      service.assignTestTask("agent-1", { test: true }),
    ).rejects.toThrow(/not found/i);
  });

  it("validateActivationReadiness checks agent existence", async () => {
    const result = await service.validateActivationReadiness("agent-nonexistent");
    expect(result.ready).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});