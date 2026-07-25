// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Workflow D1 Store                         │
// │ EPIC-003-005 · PHASE 5                                      │
// │ D1-backed workflow repository using the 0005 migration      │
// │ workflow tables.                                              │
// └─────────────────────────────────────────────────────────────┘

import type { D1Database } from "@cloudflare/workers-types";
import type { ApprovalRequest } from "../../agents/tool-contracts.js";
import type {
  Workflow,
  WorkflowState,
  WorkflowTaskRef,
  WorkflowTimelineEvent,
} from "./orchestration.js";
import type { WorkflowRepository } from "./workflow-repository.js";

// ─── Helpers ──────────────────────────────────────────────────

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function approvalToRow(
  workflowId: string,
  queueId: string,
  req: ApprovalRequest,
) {
  return {
    approval_id: newId("apr"),
    workflow_id: workflowId,
    queue_id: queueId,
    agent_id: req.agentId ?? "",
    application_id: req.applicationId ?? "",
    env: req.env ?? "development",
    permission: req.permission ?? "read",
    capability: req.capability ?? "",
    expires_at: req.expiresAt ?? null,
    state: req.state ?? "pending",
    approved_by: req.approver ?? null,
    rejected_by: null as string | null,
    created_at: req.createdAt ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function rowToApproval(row: {
  queue_id: string;
  agent_id: string | null;
  application_id: string | null;
  env: string | null;
  permission: string | null;
  capability: string | null;
  expires_at: string | null;
  state: string | null;
  approved_by: string | null;
  created_at: string | null;
}): ApprovalRequest {
  return {
    agentId: row.agent_id ?? undefined,
    applicationId: row.application_id ?? undefined,
    env: (row.env ?? "development") as "development" | "staging" | "production",
    permission: row.permission ?? "read",
    capability: row.capability ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    state: row.state as "pending" | "approved" | "rejected" | undefined,
    approver: row.approved_by ?? undefined,
    createdAt: row.created_at ?? new Date().toISOString(),
    requestId: undefined,
  };
}

function taskToRow(workflowId: string, task: WorkflowTaskRef) {
  return {
    task_id: newId("tsk"),
    workflow_id: workflowId,
    item_id: task.itemId,
    queue_id: task.queueId,
    capability: task.capability,
    wave: task.wave,
    dispatch_json: JSON.stringify(task.dispatch),
    requires_approval: task.requiresApproval ? 1 : 0,
    created_at: new Date().toISOString(),
  };
}

function rowToTask(row: {
  item_id: string;
  queue_id: string;
  capability: string;
  wave: number;
  dispatch_json: string;
  requires_approval: number;
}): WorkflowTaskRef {
  return {
    itemId: row.item_id,
    queueId: row.queue_id,
    capability: row.capability,
    wave: row.wave,
    dispatch: JSON.parse(row.dispatch_json),
    requiresApproval: row.requires_approval === 1,
  };
}

function workflowToTimeline(json: string): WorkflowTimelineEvent[] {
  try {
    return JSON.parse(json) as WorkflowTimelineEvent[];
  } catch {
    return [];
  }
}

// ─── D1 Workflow Store ────────────────────────────────────────

export class D1WorkflowStore implements WorkflowRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async createWorkflow(wf: Workflow): Promise<void> {
    await this.db
      .prepare(
        `INSERT OR IGNORE INTO workflows (
          workflow_id, title, application_id, requested_by, env, state,
          plan_json, failure_count, retry_count, note, created_at, updated_at, timeline_json
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
      )
      .bind(
        wf.id,
        wf.title,
        wf.applicationId,
        wf.requestedBy,
        wf.env,
        wf.state,
        wf.plan ? JSON.stringify(wf.plan) : null,
        wf.failureCount,
        wf.retryCount,
        wf.note ?? null,
        wf.createdAt,
        wf.updatedAt,
        JSON.stringify(wf.timeline),
      )
      .run();
  }

  async updateWorkflow(wf: Workflow): Promise<void> {
    await this.db
      .prepare(
        `UPDATE workflows SET
          state = ?2, plan_json = ?3, failure_count = ?4, retry_count = ?5,
          note = ?6, updated_at = ?7, timeline_json = ?8
        WHERE workflow_id = ?1`,
      )
      .bind(
        wf.id,
        wf.state,
        wf.plan ? JSON.stringify(wf.plan) : null,
        wf.failureCount,
        wf.retryCount,
        wf.note ?? null,
        wf.updatedAt,
        JSON.stringify(wf.timeline),
      )
      .run();
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.db.prepare("DELETE FROM workflow_granted_approvals WHERE workflow_id = ?1").bind(id).run();
    await this.db.prepare("DELETE FROM workflow_approvals WHERE workflow_id = ?1").bind(id).run();
    await this.db.prepare("DELETE FROM workflow_tasks WHERE workflow_id = ?1").bind(id).run();
    await this.db.prepare("DELETE FROM workforce_workflow_metrics WHERE workflow_id = ?1").bind(id).run();
    await this.db.prepare("DELETE FROM workflows WHERE workflow_id = ?1").bind(id).run();
  }

  async getWorkflow(id: string): Promise<Workflow | undefined> {
    const row = await this.db
      .prepare(
        `SELECT workflow_id, title, application_id, requested_by, env, state,
                plan_json, failure_count, retry_count, note, created_at, updated_at, timeline_json
         FROM workflows WHERE workflow_id = ?1`,
      )
      .bind(id)
      .first<{
        workflow_id: string;
        title: string;
        application_id: string;
        requested_by: string;
        env: string;
        state: string;
        plan_json: string | null;
        failure_count: number;
        retry_count: number;
        note: string | null;
        created_at: string;
        updated_at: string;
        timeline_json: string;
      }>();

    if (!row) return undefined;

    const [tasks, approvalRows, grantedRows] = await Promise.all([
      this.db
        .prepare(
          `SELECT item_id, queue_id, capability, wave, dispatch_json, requires_approval
           FROM workflow_tasks WHERE workflow_id = ?1 ORDER BY wave, item_id`,
        )
        .bind(id)
        .all<{
          item_id: string;
          queue_id: string;
          capability: string;
          wave: number;
          dispatch_json: string;
          requires_approval: number;
        }>(),
      this.db
        .prepare(
          `SELECT queue_id, agent_id, application_id, env, permission, capability,
                  expires_at, state, approved_by, created_at
           FROM workflow_approvals WHERE workflow_id = ?1`,
        )
        .bind(id)
        .all<{
          queue_id: string;
          agent_id: string | null;
          application_id: string | null;
          env: string | null;
          permission: string | null;
          capability: string | null;
          expires_at: string | null;
          state: string | null;
          approved_by: string | null;
          created_at: string | null;
        }>(),
      this.db
        .prepare(
          `SELECT queue_id FROM workflow_granted_approvals WHERE workflow_id = ?1`,
        )
        .bind(id)
        .all<{ queue_id: string }>(),
    ]);

    const approvalsMap = new Map<string, ApprovalRequest>();
    for (const r of approvalRows.results ?? []) {
      approvalsMap.set(r.queue_id, rowToApproval(r));
    }

    const grantedSet = new Set((grantedRows.results ?? []).map((r) => r.queue_id));

    return {
      id: row.workflow_id,
      title: row.title,
      applicationId: row.application_id,
      requestedBy: row.requested_by,
      env: row.env as "development" | "staging" | "production",
      state: row.state as WorkflowState,
      plan: row.plan_json ? JSON.parse(row.plan_json) : undefined,
      tasks: (tasks.results ?? []).map(rowToTask),
      approvals: approvalsMap,
      grantedApprovals: grantedSet,
      failureCount: row.failure_count,
      retryCount: row.retry_count,
      note: row.note ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      timeline: workflowToTimeline(row.timeline_json),
    };
  }

  async listWorkflows(filter?: { state?: WorkflowState }): Promise<Workflow[]> {
    let sql = "SELECT workflow_id FROM workflows";
    const params: string[] = [];
    if (filter?.state) {
      sql += " WHERE state = ?1";
      params.push(filter.state);
    }
    sql += " ORDER BY created_at DESC";

    const rows = await this.db.prepare(sql).bind(...params).all<{ workflow_id: string }>();
    const results: Workflow[] = [];
    for (const row of rows.results ?? []) {
      const wf = await this.getWorkflow(row.workflow_id);
      if (wf) results.push(wf);
    }
    return results;
  }

  async saveApproval(workflowId: string, queueId: string, req: ApprovalRequest): Promise<void> {
    const row = approvalToRow(workflowId, queueId, req);
    await this.db
      .prepare(
        `INSERT OR REPLACE INTO workflow_approvals (
          approval_id, workflow_id, queue_id, agent_id, application_id, env,
          permission, capability, expires_at, state, approved_by, rejected_by, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
      )
      .bind(
        row.approval_id, row.workflow_id, row.queue_id, row.agent_id,
        row.application_id, row.env, row.permission, row.capability,
        row.expires_at, row.state, row.approved_by, row.rejected_by,
        row.created_at, row.updated_at,
      )
      .run();
  }

  async getApproval(workflowId: string, queueId: string): Promise<ApprovalRequest | undefined> {
    const row = await this.db
      .prepare(
        `SELECT queue_id, agent_id, application_id, env, permission, capability,
                expires_at, state, approved_by, created_at
         FROM workflow_approvals
         WHERE workflow_id = ?1 AND queue_id = ?2`,
      )
      .bind(workflowId, queueId)
      .first<{
        queue_id: string;
        agent_id: string | null;
        application_id: string | null;
        env: string | null;
        permission: string | null;
        capability: string | null;
        expires_at: string | null;
        state: string | null;
        approved_by: string | null;
        created_at: string | null;
      }>();

    return row ? rowToApproval(row) : undefined;
  }

  async removeApproval(workflowId: string, queueId: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM workflow_approvals WHERE workflow_id = ?1 AND queue_id = ?2")
      .bind(workflowId, queueId)
      .run();
  }

  async saveTask(workflowId: string, task: WorkflowTaskRef): Promise<void> {
    const row = taskToRow(workflowId, task);
    await this.db
      .prepare(
        `INSERT OR REPLACE INTO workflow_tasks (
          task_id, workflow_id, item_id, queue_id, capability, wave, dispatch_json, requires_approval, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      )
      .bind(
        row.task_id, row.workflow_id, row.item_id, row.queue_id,
        row.capability, row.wave, row.dispatch_json, row.requires_approval, row.created_at,
      )
      .run();
  }

  async updateTask(workflowId: string, itemId: string, update: Partial<WorkflowTaskRef>): Promise<void> {
    const sets: string[] = [];
    const params: (string | number)[] = [];
    if (update.queueId !== undefined) { sets.push("queue_id = ?"); params.push(update.queueId); }
    if (update.capability !== undefined) { sets.push("capability = ?"); params.push(update.capability); }
    if (update.wave !== undefined) { sets.push("wave = ?"); params.push(update.wave); }
    if (update.requiresApproval !== undefined) { sets.push("requires_approval = ?"); params.push(update.requiresApproval ? 1 : 0); }
    if (update.dispatch !== undefined) { sets.push("dispatch_json = ?"); params.push(JSON.stringify(update.dispatch)); }
    if (sets.length === 0) return;
    params.push(workflowId, itemId);
    await this.db
      .prepare(
        `UPDATE workflow_tasks SET ${sets.join(", ")} WHERE workflow_id = ? AND item_id = ?`,
      )
      .bind(...params)
      .run();
  }

  async listTasks(workflowId: string): Promise<WorkflowTaskRef[]> {
    const rows = await this.db
      .prepare(
        `SELECT item_id, queue_id, capability, wave, dispatch_json, requires_approval
         FROM workflow_tasks WHERE workflow_id = ?1 ORDER BY wave, item_id`,
      )
      .bind(workflowId)
      .all<{
        item_id: string;
        queue_id: string;
        capability: string;
        wave: number;
        dispatch_json: string;
        requires_approval: number;
      }>();

    return (rows.results ?? []).map(rowToTask);
  }

  async addGrantedApproval(workflowId: string, queueId: string, grantedBy: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT OR IGNORE INTO workflow_granted_approvals (workflow_id, queue_id, granted_by, granted_at)
         VALUES (?1, ?2, ?3, ?4)`,
      )
      .bind(workflowId, queueId, grantedBy, new Date().toISOString())
      .run();
  }

  async hasGrantedApproval(workflowId: string, queueId: string): Promise<boolean> {
    const row = await this.db
      .prepare(
        "SELECT 1 as present FROM workflow_granted_approvals WHERE workflow_id = ?1 AND queue_id = ?2",
      )
      .bind(workflowId, queueId)
      .first<{ present: number }>();

    return !!row;
  }

  async clearGrantedApprovals(workflowId: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM workflow_granted_approvals WHERE workflow_id = ?1")
      .bind(workflowId)
      .run();
  }
}