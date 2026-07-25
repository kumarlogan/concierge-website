// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Workflow Repository                        │
// │ EPIC-003-005 · PHASE 5                                      |
// │ Provider-neutral persistence layer for workflow state.       │
// │ Supports in-memory and file-backed backends.                  │
// └─────────────────────────────────────────────────────────────┘

import type {
  ApprovalRequest,
} from "../../agents/tool-contracts.js";
import type {
  Workflow,
  WorkflowTaskRef,
  WorkflowState,
} from "./orchestration.js";

// ─── Repository Interfaces ────────────────────────────────────

/**
 * Workflow-level persistence repository.
 * Each operation is idempotent.
 */
export interface WorkflowRepository {
  createWorkflow(workflow: Workflow): Promise<void>;
  updateWorkflow(workflow: Workflow): Promise<void>;
  deleteWorkflow(id: string): Promise<void>;
  getWorkflow(id: string): Promise<Workflow | undefined>;
  listWorkflows(filter?: { state?: WorkflowState }): Promise<Workflow[]>;

  saveApproval(
    workflowId: string,
    queueId: string,
    approval: ApprovalRequest,
  ): Promise<void>;
  getApproval(
    workflowId: string,
    queueId: string,
  ): Promise<ApprovalRequest | undefined>;
  removeApproval(workflowId: string, queueId: string): Promise<void>;

  saveTask(
    workflowId: string,
    task: WorkflowTaskRef,
  ): Promise<void>;
  updateTask(
    workflowId: string,
    itemId: string,
    updates: Partial<WorkflowTaskRef>,
  ): Promise<void>;
  listTasks(workflowId: string): Promise<WorkflowTaskRef[]>;

  addGrantedApproval(
    workflowId: string,
    queueId: string,
    approver: string,
  ): Promise<void>;
  hasGrantedApproval(
    workflowId: string,
    queueId: string,
  ): Promise<boolean>;
  clearGrantedApprovals(workflowId: string): Promise<void>;
}

// ─── In-Memory Backend ────────────────────────────────────────

export class MemoryWorkflowBackend implements WorkflowRepository {
  protected workflows = new Map<string, Workflow>();
  protected tasks = new Map<string, WorkflowTaskRef[]>();
  protected approvals = new Map<string, ApprovalRequest>();
  protected grantedApprovals = new Map<string, Set<string>>();

  private wfKey(id: string, qId: string): string {
    return id + ":" + qId;
  }

  async createWorkflow(workflow: Workflow): Promise<void> {
    this.workflows.set(workflow.id, { ...workflow });
  }

  async updateWorkflow(workflow: Workflow): Promise<void> {
    this.workflows.set(workflow.id, { ...workflow });
    // Sync nested collections into their separate maps for listTasks() / getApproval() / hasGrantedApproval()
    if (workflow.tasks.length > 0) {
      this.tasks.set(workflow.id, [...workflow.tasks]);
    }
    // Sync approvals map
    const prefix = workflow.id + ":";
    // Remove existing approvals for this workflow
    for (const key of this.approvals.keys()) {
      if (key.startsWith(prefix)) this.approvals.delete(key);
    }
    for (const [qId, req] of workflow.approvals) {
      this.approvals.set(prefix + qId, { ...req });
    }
    // Sync granted approvals
    if (workflow.grantedApprovals.size > 0) {
      this.grantedApprovals.set(workflow.id, new Set(workflow.grantedApprovals));
    } else {
      this.grantedApprovals.delete(workflow.id);
    }
  }

  async deleteWorkflow(id: string): Promise<void> {
    this.workflows.delete(id);
    this.tasks.delete(id);
    this.grantedApprovals.delete(id);
    for (const key of this.approvals.keys()) {
      if (key.startsWith(id + ":")) this.approvals.delete(key);
    }
  }

  async getWorkflow(id: string): Promise<Workflow | undefined> {
    const wf = this.workflows.get(id);
    if (!wf) return undefined;
    const tasks = this.tasks.get(id) ?? [];
    const approvalsMap = new Map<string, ApprovalRequest>();
    const grantedSet = this.grantedApprovals.get(id) ?? new Set();
    for (const [key, req] of this.approvals) {
      if (key.startsWith(id + ":")) {
        const qId = key.slice(id.length + 1);
        approvalsMap.set(qId, req);
      }
    }
    return { ...wf, tasks, approvals: approvalsMap, grantedApprovals: grantedSet };
  }

  async listWorkflows(filter?: { state?: WorkflowState }): Promise<Workflow[]> {
    const results: Workflow[] = [];
    for (const [id] of this.workflows) {
      const wf = await this.getWorkflow(id);
      if (wf) {
        if (filter?.state && wf.state !== filter.state) continue;
        results.push(wf);
      }
    }
    return results;
  }

  async saveApproval(
    workflowId: string,
    queueId: string,
    approval: ApprovalRequest,
  ): Promise<void> {
    this.approvals.set(this.wfKey(workflowId, queueId), { ...approval });
  }

  async getApproval(
    workflowId: string,
    queueId: string,
  ): Promise<ApprovalRequest | undefined> {
    return this.approvals.get(this.wfKey(workflowId, queueId));
  }

  async removeApproval(workflowId: string, queueId: string): Promise<void> {
    this.approvals.delete(this.wfKey(workflowId, queueId));
  }

  async saveTask(
    workflowId: string,
    task: WorkflowTaskRef,
  ): Promise<void> {
    const existing = this.tasks.get(workflowId) ?? [];
    const idx = existing.findIndex((t) => t.itemId === task.itemId);
    if (idx >= 0) {
      existing[idx] = task;
    } else {
      existing.push(task);
    }
    this.tasks.set(workflowId, existing);
  }

  async updateTask(
    workflowId: string,
    itemId: string,
    updates: Partial<WorkflowTaskRef>,
  ): Promise<void> {
    const existing = this.tasks.get(workflowId) ?? [];
    const idx = existing.findIndex((t) => t.itemId === itemId);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...updates };
      this.tasks.set(workflowId, existing);
    }
  }

  async listTasks(workflowId: string): Promise<WorkflowTaskRef[]> {
    return this.tasks.get(workflowId) ?? [];
  }

  async addGrantedApproval(
    workflowId: string,
    queueId: string,
    _approver: string,
  ): Promise<void> {
    const set = this.grantedApprovals.get(workflowId) ?? new Set();
    set.add(queueId);
    this.grantedApprovals.set(workflowId, set);
  }

  async hasGrantedApproval(
    workflowId: string,
    queueId: string,
  ): Promise<boolean> {
    return this.grantedApprovals.get(workflowId)?.has(queueId) ?? false;
  }

  async clearGrantedApprovals(workflowId: string): Promise<void> {
    this.grantedApprovals.delete(workflowId);
  }
}

// ─── File-Backed Backend (for restart simulation tests) ──────

import * as fs from "fs";

/**
 * File-backed workflow repository for testing restart recovery.
 * Serializes workflows to a JSON file between "restarts".
 * Each "restart" creates a fresh instance that loads from the file.
 */
export class FileWorkflowBackend extends MemoryWorkflowBackend {
  private filePath: string;
  private dirty = false;

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
  }

  /** Load state from the file (simulates restart recovery). */
  async load(): Promise<void> {
    if (!fs.existsSync(this.filePath)) {
      this.workflows.clear();
      this.tasks.clear();
      this.approvals.clear();
      this.grantedApprovals.clear();
      return;
    }
    const raw = fs.readFileSync(this.filePath, "utf-8");
    const data = JSON.parse(raw) as {
      workflows: Record<string, Workflow>;
      tasks: Record<string, WorkflowTaskRef[]>;
      approvals: Record<string, [string, ApprovalRequest]>;
      grantedApprovals: Record<string, string[]>;
    };
    this.workflows.clear();
    this.tasks.clear();
    this.approvals.clear();
    this.grantedApprovals.clear();
    for (const [id, wf] of Object.entries(data.workflows)) {
      this.workflows.set(id, wf);
    }
    for (const [id, taskList] of Object.entries(data.tasks)) {
      this.tasks.set(id, taskList);
    }
    for (const [key, val] of Object.entries(data.approvals)) {
      // val is [string, ApprovalRequest]; set the ApprovalRequest value
      this.approvals.set(key, val[1]);
    }
    for (const [id, granted] of Object.entries(data.grantedApprovals)) {
      this.grantedApprovals.set(id, new Set(granted));
    }
  }

  private schedulePersist(): void {
    this.dirty = true;
    this.writeToFileSync();
  }

  private writeToFileSync(): void {
    if (!this.dirty) return;
    this.dirty = false;
    const workflowsOut: Record<string, Workflow> = {};
    const tasksOut: Record<string, WorkflowTaskRef[]> = {};
    const approvalsOut: Record<string, [string, ApprovalRequest]> = {};
    const grantedOut: Record<string, string[]> = {};
    for (const [id, wf] of this.workflows) {
      const { tasks: _t, approvals: _a, grantedApprovals: _g, ...wfData } = wf;
      workflowsOut[id] = wfData;
    }
    for (const [id, taskList] of this.tasks) {
      tasksOut[id] = taskList;
    }
    for (const [key, req] of this.approvals) {
      approvalsOut[key] = [key, req];
    }
    for (const [id, set] of this.grantedApprovals) {
      grantedOut[id] = Array.from(set);
    }
    const tmpPath = this.filePath + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify({ workflows: workflowsOut, tasks: tasksOut, approvals: approvalsOut, grantedApprovals: grantedOut }));
    fs.renameSync(tmpPath, this.filePath);
  }
  // ─── Override mutating methods to persist to file ──────

  async createWorkflow(workflow: Workflow): Promise<void> {
    await super.createWorkflow(workflow);
    this.schedulePersist();
  }

  async updateWorkflow(workflow: Workflow): Promise<void> {
    await super.updateWorkflow(workflow);
    this.schedulePersist();
  }

  async deleteWorkflow(id: string): Promise<void> {
    await super.deleteWorkflow(id);
    this.schedulePersist();
  }

  async saveApproval(
    workflowId: string,
    queueId: string,
    approval: ApprovalRequest,
  ): Promise<void> {
    await super.saveApproval(workflowId, queueId, approval);
    this.schedulePersist();
  }

  async removeApproval(workflowId: string, queueId: string): Promise<void> {
    await super.removeApproval(workflowId, queueId);
    this.schedulePersist();
  }

  async saveTask(workflowId: string, task: WorkflowTaskRef): Promise<void> {
    await super.saveTask(workflowId, task);
    this.schedulePersist();
  }

  async updateTask(
    workflowId: string,
    itemId: string,
    updates: Partial<WorkflowTaskRef>,
  ): Promise<void> {
    await super.updateTask(workflowId, itemId, updates);
    this.schedulePersist();
  }

  async addGrantedApproval(
    workflowId: string,
    queueId: string,
    approver: string,
  ): Promise<void> {
    await super.addGrantedApproval(workflowId, queueId, approver);
    this.schedulePersist();
  }

  async clearGrantedApprovals(workflowId: string): Promise<void> {
    await super.clearGrantedApprovals(workflowId);
    this.schedulePersist();
  }
}