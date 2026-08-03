/**
 * Wave 8 — Workflow & Automation Engine
 * Batch Operations — Multi-task operations
 *
 * The deleted `TaskStore` dependency is replaced by the D1 owner (the
 * `task_instances` table from migration 0010). Each bulk operation performs
 * atomic per-task updates with an optional event emission (single owner:
 * EventStore when provided).
 */

import type { TaskInstance, TaskState, TaskPriority, TaskType, Actor, EventType } from '../types';
import { EventStore } from '../events/event-store';

/**
 * Row shape of the `task_instances` table (migration 0010).
 * Mirrors the workflow TaskInstance domain type.
 */
export interface TaskInstanceRow {
  id: string;
  workflow_instance_id: string;
  task_definition_id: string;
  name: string;
  type: string;
  priority: string;
  state: string;
  assignee_id: string | null;
  assignee_role: string | null;
  claimed_by: string | null;
  claimed_at: number | null;
  started_at: number | null;
  completed_at: number | null;
  failed_at: number | null;
  failure_reason: string | null;
  escalation_level: number;
  sla_deadline: number | null;
  sla_breached: number;
  context: string;
  outcome: string | null;
  created_at: number;
  updated_at: number;
}

export interface BatchOperationResult {
  success: string[];
  failed: Array<{ taskId: string; error: string }>;
}

export interface BatchOperationConfig {
  db: D1Database;
  eventStore?: EventStore;
}

export class BatchOperations {
  private db: D1Database;
  private eventStore?: EventStore;

  constructor(config: BatchOperationConfig) {
    this.db = config.db;
    this.eventStore = config.eventStore;
  }

  /**
   * Bulk claim tasks (shift handoff)
   */
  async bulkClaim(taskIds: string[], assignee: Actor): Promise<BatchOperationResult> {
    const result: BatchOperationResult = { success: [], failed: [] };
    for (const taskId of taskIds) {
      try {
        const row = await this.getTaskRow(taskId);
        if (!row) {
          result.failed.push({ taskId, error: 'Task not found' });
          continue;
        }
        if (row.state !== 'requested' && row.state !== 'received') {
          result.failed.push({ taskId, error: `Task not claimable (status: ${row.state})` });
          continue;
        }
        if (row.assignee_id && row.assignee_id !== assignee.id) {
          result.failed.push({ taskId, error: 'Task already claimed by another user' });
          continue;
        }

        const now = Date.now();
        await this.db
          .prepare(
            `UPDATE task_instances
             SET state = 'claimed', assignee_id = ?, claimed_at = ?, updated_at = ?
             WHERE id = ?`
          )
          .bind(assignee.id, now, now, taskId)
          .run();

        await this.emitIfPresent('task.claimed', taskId, assignee, { assigneeId: assignee.id });
        result.success.push(taskId);
      } catch (error) {
        result.failed.push({ taskId, error: String(error) });
      }
    }
    return result;
  }

  /**
   * Bulk complete tasks (routine tasks)
   */
  async bulkComplete(
    taskIds: string[],
    actor: Actor,
    defaultOutput?: Record<string, unknown>
  ): Promise<BatchOperationResult> {
    const result: BatchOperationResult = { success: [], failed: [] };
    for (const taskId of taskIds) {
      try {
        const row = await this.getTaskRow(taskId);
        if (!row) {
          result.failed.push({ taskId, error: 'Task not found' });
          continue;
        }
        if (row.state !== 'in_progress') {
          result.failed.push({ taskId, error: `Task not in progress (status: ${row.state})` });
          continue;
        }
        if (row.assignee_id && row.assignee_id !== actor.id && actor.type !== 'system') {
          result.failed.push({ taskId, error: 'Task assigned to another user' });
          continue;
        }

        const now = Date.now();
        await this.db
          .prepare(
            `UPDATE task_instances
             SET state = 'completed', completed_at = ?, outcome = ?, updated_at = ?
             WHERE id = ?`
          )
          .bind(now, JSON.stringify(defaultOutput || {}), now, taskId)
          .run();

        await this.emitIfPresent('task.completed', taskId, actor, { outcome: defaultOutput || {} });
        result.success.push(taskId);
      } catch (error) {
        result.failed.push({ taskId, error: String(error) });
      }
    }
    return result;
  }

  /**
   * Bulk reassign tasks (coordinator out, handoff)
   */
  async bulkReassign(
    taskIds: string[],
    newAssigneeId: string,
    actor: Actor,
    reason: string
  ): Promise<BatchOperationResult> {
    const result: BatchOperationResult = { success: [], failed: [] };
    for (const taskId of taskIds) {
      try {
        const row = await this.getTaskRow(taskId);
        if (!row) {
          result.failed.push({ taskId, error: 'Task not found' });
          continue;
        }
        if (row.state === 'completed' || row.state === 'cancelled' || row.state === 'failed') {
          result.failed.push({ taskId, error: 'Cannot reassign terminal task' });
          continue;
        }

        const now = Date.now();
        await this.db
          .prepare(
            `UPDATE task_instances
             SET state = 'received', assignee_id = ?, claimed_at = NULL, updated_at = ?
             WHERE id = ?`
          )
          .bind(newAssigneeId, now, taskId)
          .run();

        await this.emitIfPresent('task.reassigned', taskId, actor, { reason, newAssigneeId });
        result.success.push(taskId);
      } catch (error) {
        result.failed.push({ taskId, error: String(error) });
      }
    }
    return result;
  }

  /**
   * Bulk escalate tasks
   */
  async bulkEscalate(
    taskIds: string[],
    reason: string,
    actor: Actor
  ): Promise<BatchOperationResult> {
    const result: BatchOperationResult = { success: [], failed: [] };
    for (const taskId of taskIds) {
      try {
        const row = await this.getTaskRow(taskId);
        if (!row) {
          result.failed.push({ taskId, error: 'Task not found' });
          continue;
        }
        if (row.state === 'completed' || row.state === 'cancelled' || row.state === 'failed') {
          result.failed.push({ taskId, error: 'Cannot escalate terminal task' });
          continue;
        }

        const now = Date.now();
        await this.db
          .prepare(
            `UPDATE task_instances
             SET state = 'escalated', escalation_level = escalation_level + 1, failure_reason = ?, updated_at = ?
             WHERE id = ?`
          )
          .bind(reason, now, taskId)
          .run();

        await this.emitIfPresent('task.escalated', taskId, actor, { reason });
        result.success.push(taskId);
      } catch (error) {
        result.failed.push({ taskId, error: String(error) });
      }
    }
    return result;
  }

  /**
   * Get tasks for batch operation (with filters)
   */
  async getTasksForBatch(filters: {
    assigneeId?: string;
    assigneeRole?: string;
    status?: TaskState[];
    priority?: TaskPriority[];
    workflowInstanceId?: string;
    patientId?: string;
    slaBefore?: number;
    limit?: number;
  }): Promise<TaskInstance[]> {
    const conditions: string[] = [];
    const binds: unknown[] = [];

    if (filters.assigneeId) { conditions.push('assignee_id = ?'); binds.push(filters.assigneeId); }
    if (filters.assigneeRole) { conditions.push('assignee_role = ?'); binds.push(filters.assigneeRole); }
    if (filters.status && filters.status.length) {
      conditions.push(`state IN (${filters.status.map(() => '?').join(',')})`);
      binds.push(...filters.status);
    }
    if (filters.priority && filters.priority.length) {
      conditions.push(`priority IN (${filters.priority.map(() => '?').join(',')})`);
      binds.push(...filters.priority);
    }
    if (filters.workflowInstanceId) { conditions.push('workflow_instance_id = ?'); binds.push(filters.workflowInstanceId); }
    if (filters.slaBefore !== undefined) { conditions.push('sla_deadline <= ?'); binds.push(filters.slaBefore); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(filters.limit ?? 100, 500);
    const rows = await this.db
      .prepare(`SELECT * FROM task_instances ${where} ORDER BY created_at ASC LIMIT ?`)
      .bind(...binds, limit)
      .all<TaskInstanceRow>();

    return (rows.results || []).map(this.mapRowToTask);
  }

  /**
   * Print queue (paper backup)
   */
  async generatePrintQueue(filters: {
    assigneeRole?: string;
    status?: TaskState[];
    priority?: TaskPriority[];
  }): Promise<string> {
    const tasks = await this.getTasksForBatch(filters);

    let output = 'AGS FERTILITY CONCIERGE — TASK QUEUE\n';
    output += `Generated: ${new Date().toISOString()}\n`;
    output += '='.repeat(80) + '\n\n';

    for (const task of tasks) {
      output += `[${task.priority.toUpperCase()}] ${task.name}\n`;
      output += `  ID: ${task.id}\n`;
      output += `  Patient: ${task.workflowInstanceId}\n`;
      output += `  Status: ${task.status}\n`;
      if (task.slaDeadline) {
        output += `  Due: ${new Date(task.slaDeadline).toISOString()}\n`;
      }
      if (task.assigneeId) {
        output += `  Assignee: ${task.assigneeId}\n`;
      }
      output += '\n';
    }

    return output;
  }

  private async getTaskRow(taskId: string): Promise<TaskInstanceRow | null> {
    const row = await this.db
      .prepare('SELECT * FROM task_instances WHERE id = ?')
      .bind(taskId)
      .first<TaskInstanceRow>();
    return row ?? null;
  }

  private async emitIfPresent(
    eventType: EventType,
    taskId: string,
    actor: Actor,
    payload: Record<string, unknown>
  ): Promise<void> {
    if (!this.eventStore) return;
    const row = await this.getTaskRow(taskId);
    await this.eventStore.append({
      workflowInstanceId: row?.workflow_instance_id ?? '',
      eventType,
      payload,
      actor,
      correlationId: row?.workflow_instance_id ?? taskId,
      timestamp: Date.now(),
      version: 1,
    });
  }

  private mapRowToTask(row: TaskInstanceRow): TaskInstance {
    return {
      id: row.id,
      workflowInstanceId: row.workflow_instance_id,
      taskDefinitionId: row.task_definition_id,
      name: row.name,
      type: row.type as TaskType,
      assigneeRole: row.assignee_role ?? '',
      assigneeId: row.assignee_id ?? undefined,
      priority: row.priority as TaskPriority,
      status: row.state as TaskState,
      slaDeadline: row.sla_deadline ?? undefined,
      input: row.context ? JSON.parse(row.context) : undefined,
      output: row.outcome ? (JSON.parse(row.outcome) as Record<string, unknown>) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      claimedAt: row.claimed_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
      escalationReason: row.failure_reason ?? undefined,
      retryCount: 0,
      lastError: row.failure_reason ?? undefined,
    };
  }
}
