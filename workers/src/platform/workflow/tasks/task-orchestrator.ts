/**
 * Wave 8 — Workflow & Automation Engine
 * Task Orchestrator — Task lifecycle management backed by D1 persistence
 */

import type {
  TaskInstance,
  TaskDefinition,
  WorkflowInstance,
  WorkflowContext,
  WorkflowDefinitionJSON,
  WorkflowEvent,
  TaskState,
  TaskPriority,
  TaskType,
  Actor,
  TaskQueueItem,
  DashboardQueueResponse,
  CoordinatorWorkload,
  TaskSearchRequest,
  EventType,
  JourneyState,
} from '../types';
import { stateMachine } from '../engine/state-machine';
import { transitionValidator } from '../engine/transition-validator';
import { EventStore } from '../events/event-store';
import { taskGenerator } from './task-generator';

export interface TaskOrchestratorConfig {
  db: D1Database;
  eventStore?: EventStore;
}

/**
 * The task_instances table row (migration 0010_workflow_engine.sql).
 * Column names mirror the D1 schema exactly.
 */
interface TaskRow {
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
  escalation_level: number | null;
  sla_deadline: number | null;
  sla_breached: number | null;
  context: string | null;
  outcome: string | null;
  created_at: number;
  updated_at: number;
}

/** A task row joined with the owning workflow instance for dashboard queue building. */
interface QueueRow extends TaskRow {
  patient_id: string | null;
  current_state: string | null;
}

const TERMINAL_STATES: ReadonlySet<TaskState> = new Set(['completed', 'cancelled', 'failed']);

export class TaskOrchestrator {
  private db: D1Database;
  private eventStore?: EventStore;

  constructor(config: TaskOrchestratorConfig) {
    this.db = config.db;
    this.eventStore = config.eventStore;
  }

  /**
   * Generate tasks for a workflow state.
   * Loads the workflow definition from workflow_templates, resolves the task
   * definitions for the entered state, and persists a TaskInstance per
   * definition (skipping any already created for this workflow instance).
   */
  async generateTasksForState(instance: WorkflowInstance, state: string): Promise<TaskInstance[]> {
    const definitions = await this.loadTaskDefinitions(instance);
    const phaseTaskIds = new Set<string>(
      definitions.phases.filter(p => p.id === state).flatMap(p => p.tasks)
    );

    const existingResult = await this.db
      .prepare('SELECT task_definition_id FROM task_instances WHERE workflow_instance_id = ?')
      .bind(instance.id)
      .all<{ task_definition_id: string }>();
    const existingIds = new Set(
      (existingResult.results || []).map(r => r.task_definition_id)
    );

    const systemActor: Actor = { type: 'system', id: instance.definitionId };
    const created: TaskInstance[] = [];

    for (const definition of definitions.tasks) {
      if (!phaseTaskIds.has(definition.id)) continue;
      if (existingIds.has(definition.id)) continue;

      const task = taskGenerator.createTask(definition, instance, instance.context);
      await this.insertTask(task);
      await this.enqueueTask(task);
      await this.emitEvent('task.created', task, systemActor);
      created.push(task);
    }

    return created;
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<TaskInstance | null> {
    const row = await this.db
      .prepare('SELECT * FROM task_instances WHERE id = ?')
      .bind(taskId)
      .first<TaskRow>();

    return row ? this.mapRowToTask(row) : null;
  }

  /**
   * Claim a task
   */
  async claimTask(taskId: string, assigneeId: string): Promise<TaskInstance> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const validation = await transitionValidator.validateTaskTransition(
      task,
      'claimed',
      { type: 'user', id: assigneeId },
      {} as WorkflowContext
    );

    if (!validation.valid) {
      throw new Error(validation.reason || 'Cannot claim task');
    }

    task.status = 'claimed';
    task.assigneeId = assigneeId;
    task.claimedAt = Date.now();
    task.updatedAt = Date.now();

    await this.updateTask(task);
    await this.db
      .prepare('UPDATE task_queue SET claimed_at = ? WHERE task_instance_id = ?')
      .bind(task.claimedAt, task.id)
      .run();
    await this.emitEvent('task.claimed', task, { type: 'user', id: assigneeId }, { assigneeId });

    return task;
  }

  /**
   * Complete a task
   */
  async completeTask(
    taskId: string,
    output: Record<string, unknown>,
    actor: Actor
  ): Promise<TaskInstance> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const validation = await transitionValidator.validateTaskTransition(
      task,
      'completed',
      actor,
      {} as WorkflowContext
    );

    if (!validation.valid) {
      throw new Error(validation.reason || 'Cannot complete task');
    }

    task.status = 'completed';
    task.output = output;
    task.completedAt = Date.now();
    task.updatedAt = Date.now();

    await this.updateTask(task);
    await this.db
      .prepare('UPDATE task_queue SET completed_at = ? WHERE task_instance_id = ?')
      .bind(task.completedAt, task.id)
      .run();
    await this.emitEvent('task.completed', task, actor, { output });

    return task;
  }

  /**
   * Reassign a task
   */
  async reassignTask(
    taskId: string,
    newAssigneeId: string,
    actor: Actor
  ): Promise<TaskInstance> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (task.status !== 'escalated') {
      throw new Error('Can only reassign escalated tasks');
    }

    task.status = 'received';
    task.assigneeId = newAssigneeId;
    task.claimedAt = undefined;
    task.updatedAt = Date.now();

    await this.updateTask(task);
    await this.db
      .prepare('UPDATE task_queue SET assigned_at = ?, claimed_at = NULL WHERE task_instance_id = ?')
      .bind(task.updatedAt, task.id)
      .run();
    await this.emitEvent('task.reassigned', task, actor, { newAssigneeId });

    return task;
  }

  /**
   * Escalate a task
   */
  async escalateTask(taskId: string, reason: string, actor: Actor): Promise<TaskInstance> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const validation = await transitionValidator.validateTaskTransition(
      task,
      'escalated',
      actor,
      {} as WorkflowContext
    );

    if (!validation.valid) {
      throw new Error(validation.reason || 'Cannot escalate task');
    }

    task.status = 'escalated';
    task.escalatedAt = Date.now();
    task.escalationReason = reason;
    task.updatedAt = Date.now();

    await this.db
      .prepare(
        `UPDATE task_instances
         SET state = 'escalated', escalation_level = escalation_level + 1, updated_at = ?
         WHERE id = ?`
      )
      .bind(task.updatedAt, task.id)
      .run();
    await this.emitEvent('task.escalated', task, actor, { reason });

    return task;
  }

  /**
   * Cancel all tasks for a workflow
   */
  async cancelAllTasksForWorkflow(workflowId: string, reason: string): Promise<void> {
    const result = await this.db
      .prepare('SELECT id, state FROM task_instances WHERE workflow_instance_id = ?')
      .bind(workflowId)
      .all<{ id: string; state: string }>();

    const cancellable = (result.results || []).filter(
      r => !TERMINAL_STATES.has(r.state as TaskState)
    );
    if (cancellable.length === 0) return;

    const now = Date.now();
    const stmt = this.db.prepare(
      'UPDATE task_instances SET state = ?, updated_at = ? WHERE id = ?'
    );
    const batch = cancellable.map(r => stmt.bind('cancelled', now, r.id));
    await this.db.batch(batch);
  }

  /**
   * Get completed tasks for a workflow
   */
  async getCompletedTasksForWorkflow(workflowId: string): Promise<TaskInstance[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM task_instances
         WHERE workflow_instance_id = ? AND state = 'completed'
         ORDER BY completed_at ASC`
      )
      .bind(workflowId)
      .all<TaskRow>();

    return (result.results || []).map(row => this.mapRowToTask(row));
  }

  /**
   * Get dashboard queue for a coordinator
   */
  async getDashboardQueue(actor: Actor): Promise<DashboardQueueResponse> {
    const baseSelect = `
      SELECT t.*, w.patient_id, w.current_state
      FROM task_instances t
      LEFT JOIN workflow_instances w ON w.id = t.workflow_instance_id
    `;

    const myTasks = await this.fetchQueueItems(
      `${baseSelect} WHERE t.assignee_id = ? AND t.state NOT IN ('completed', 'cancelled', 'failed')
       ORDER BY CASE t.priority WHEN 'critical' THEN 0 WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END`,
      [actor.id]
    );

    const teamTasks = actor.role
      ? await this.fetchQueueItems(
          `${baseSelect} WHERE t.assignee_role = ? AND t.state NOT IN ('completed', 'cancelled', 'failed')
           ORDER BY CASE t.priority WHEN 'critical' THEN 0 WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END`,
          [actor.role]
        )
      : [];

    const escalations = await this.fetchQueueItems(
      `${baseSelect} WHERE t.state = 'escalated' ORDER BY t.updated_at ASC`,
      []
    );

    const slaAtRisk = await this.fetchQueueItems(
      `${baseSelect} WHERE t.state NOT IN ('completed', 'cancelled', 'failed')
       AND t.sla_deadline IS NOT NULL AND t.sla_deadline < ?
       ORDER BY t.sla_deadline ASC`,
      [Date.now()]
    );

    const stats = await this.collectQueueStats();

    return { myTasks, teamTasks, escalations, slaAtRisk, stats };
  }

  /**
   * Search tasks
   */
  async searchTasks(request: TaskSearchRequest): Promise<{ items: TaskInstance[]; total: number }> {
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (request.assigneeId) {
      where.push('t.assignee_id = ?');
      params.push(request.assigneeId);
    }
    if (request.assigneeRole) {
      where.push('t.assignee_role = ?');
      params.push(request.assigneeRole);
    }
    if (request.status && request.status.length > 0) {
      where.push(`t.state IN (${request.status.map(() => '?').join(', ')})`);
      params.push(...request.status);
    }
    if (request.priority && request.priority.length > 0) {
      where.push(`t.priority IN (${request.priority.map(() => '?').join(', ')})`);
      params.push(...request.priority);
    }
    if (request.workflowInstanceId) {
      where.push('t.workflow_instance_id = ?');
      params.push(request.workflowInstanceId);
    }
    if (request.patientId) {
      where.push('w.patient_id = ?');
      params.push(request.patientId);
    }
    if (request.slaBefore) {
      where.push('t.sla_deadline IS NOT NULL AND t.sla_deadline <= ?');
      params.push(request.slaBefore);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const base = `
      FROM task_instances t
      LEFT JOIN workflow_instances w ON w.id = t.workflow_instance_id
      ${whereSql}
    `;

    const countRow = await this.db
      .prepare(`SELECT COUNT(*) AS cnt ${base}`)
      .bind(...params)
      .first<{ cnt: number }>();
    const total = countRow?.cnt ?? 0;

    const limit = request.limit ?? 50;
    const offset = request.offset ?? 0;
    const itemsResult = await this.db
      .prepare(
        `SELECT t.* ${base} ORDER BY t.updated_at DESC LIMIT ? OFFSET ?`
      )
      .bind(...params, limit, offset)
      .all<TaskRow>();

    return {
      items: (itemsResult.results || []).map(row => this.mapRowToTask(row)),
      total,
    };
  }

  /**
   * Build task queue item for dashboard
   */
  buildQueueItem(task: TaskInstance, instance: WorkflowInstance): TaskQueueItem {
    return {
      id: task.id,
      name: task.name,
      workflowInstanceId: task.workflowInstanceId,
      patientRef: instance.patientId,
      priority: task.priority,
      status: task.status,
      slaDeadline: task.slaDeadline,
      timeRemaining: task.slaDeadline ? task.slaDeadline - Date.now() : undefined,
      assigneeId: task.assigneeId,
      journeyState: instance.currentState,
    };
  }

  // ==========================================================================
  // Private persistence helpers
  // ==========================================================================

  private async loadTaskDefinitions(instance: WorkflowInstance): Promise<WorkflowDefinitionJSON> {
    const row = await this.db
      .prepare('SELECT definition FROM workflow_templates WHERE id = ?')
      .bind(instance.definitionId)
      .first<{ definition: string | null }>();

    if (!row || !row.definition) {
      return { phases: [], tasks: [], rules: [], approvalGates: [], timers: [], transitions: [] };
    }

    try {
      return JSON.parse(row.definition) as WorkflowDefinitionJSON;
    } catch {
      return { phases: [], tasks: [], rules: [], approvalGates: [], timers: [], transitions: [] };
    }
  }

  private async insertTask(task: TaskInstance): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO task_instances
           (id, workflow_instance_id, task_definition_id, name, type, priority, state,
            assignee_id, assignee_role, claimed_by, claimed_at, started_at, completed_at,
            failed_at, failure_reason, escalation_level, sla_deadline, sla_breached,
            context, outcome, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        task.id,
        task.workflowInstanceId,
        task.taskDefinitionId,
        task.name,
        task.type,
        task.priority,
        task.status,
        task.assigneeId || null,
        task.assigneeRole || null,
        task.assigneeId || null,
        task.claimedAt || null,
        task.completedAt || null, // started_at
        task.completedAt || null,
        null,                      // failed_at
        task.lastError || null,    // failure_reason
        task.status === 'escalated' ? 1 : 0,
        task.slaDeadline || null,
        task.status === 'failed' ? 1 : 0,
        JSON.stringify(task.input ?? {}),
        task.output ? JSON.stringify(task.output) : null,
        task.createdAt,
        task.updatedAt
      )
      .run();
  }

  private async updateTask(task: TaskInstance): Promise<void> {
    await this.db
      .prepare(
        `UPDATE task_instances SET
           name = ?, type = ?, priority = ?, state = ?,
           assignee_id = ?, assignee_role = ?, claimed_by = ?, claimed_at = ?,
           started_at = ?, completed_at = ?, failed_at = ?, failure_reason = ?,
           sla_deadline = ?, sla_breached = ?, context = ?, outcome = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(
        task.name,
        task.type,
        task.priority,
        task.status,
        task.assigneeId || null,
        task.assigneeRole || null,
        task.assigneeId || null,
        task.claimedAt || null,
        task.completedAt || null, // started_at
        task.completedAt || null,
        null,                     // failed_at
        task.lastError || null,   // failure_reason
        task.slaDeadline || null,
        task.status === 'failed' ? 1 : 0,
        JSON.stringify(task.input ?? {}),
        task.output ? JSON.stringify(task.output) : null,
        task.updatedAt,
        task.id
      )
      .run();
  }

  private async enqueueTask(task: TaskInstance): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO task_queue
           (id, task_instance_id, queue_type, priority_score, due_at, assigned_at,
            claimed_at, completed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        task.id,
        'general',
        this.priorityScore(task.priority),
        task.slaDeadline || null,
        task.createdAt,
        task.claimedAt || null,
        task.completedAt || null,
        Date.now()
      )
      .run();
  }

  private async emitEvent(
    eventType: EventType,
    task: TaskInstance,
    actor: Actor,
    extraPayload: Record<string, unknown> = {}
  ): Promise<void> {
    if (!this.eventStore) return;
    const event: Omit<WorkflowEvent, 'id'> = {
      workflowInstanceId: task.workflowInstanceId,
      eventType,
      payload: { taskId: task.id, taskName: task.name, ...extraPayload },
      actor,
      correlationId: task.workflowInstanceId,
      causationId: task.taskDefinitionId,
      timestamp: Date.now(),
      version: 1,
    };
    await this.eventStore.append(event);
  }

  private async fetchQueueItems(sql: string, params: unknown[]): Promise<TaskQueueItem[]> {
    const result = await this.db.prepare(sql).bind(...params).all<QueueRow>();
    return (result.results || []).map(row => {
      const task = this.mapRowToTask(row);
      const instance = {
        patientId: row.patient_id || '',
        currentState: (row.current_state || 'pre_treatment.consultation') as JourneyState,
      } as WorkflowInstance;
      return this.buildQueueItem(task, instance);
    });
  }

  private async collectQueueStats(): Promise<DashboardQueueResponse['stats']> {
    const now = Date.now();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const dayStart = startOfDay.getTime();
    const dayAgo = now - 24 * 60 * 60 * 1000;

    const activeWorkflows = await this.count(
      `SELECT COUNT(*) AS cnt FROM workflow_instances WHERE status = 'running'`,
      []
    );

    const tasksCompletedToday = await this.count(
      `SELECT COUNT(*) AS cnt FROM task_instances
       WHERE state = 'completed' AND completed_at IS NOT NULL AND completed_at >= ?`,
      [dayStart]
    );

    const escalationsOpen = await this.count(
      `SELECT COUNT(*) AS cnt FROM task_instances WHERE state = 'escalated'`,
      []
    );

    const completed24h = await this.count(
      `SELECT COUNT(*) AS cnt FROM task_instances
       WHERE state = 'completed' AND completed_at IS NOT NULL AND completed_at >= ?`,
      [dayAgo]
    );
    const compliant24h = await this.count(
      `SELECT COUNT(*) AS cnt FROM task_instances
       WHERE state = 'completed' AND completed_at IS NOT NULL AND completed_at >= ?
         AND (sla_deadline IS NULL OR completed_at <= sla_deadline)`,
      [dayAgo]
    );
    const slaCompliance24h =
      completed24h === 0 ? 100 : Math.round((compliant24h / completed24h) * 100);

    const avgRow = await this.db
      .prepare(
        `SELECT AVG(claimed_at - created_at) AS avg_ms FROM task_instances
         WHERE claimed_at IS NOT NULL AND claimed_at >= created_at`
      )
      .first<{ avg_ms: number | null }>();
    const avgResponseTimeHours =
      avgRow && avgRow.avg_ms !== null ? Math.round((avgRow.avg_ms / 3600000) * 10) / 10 : 0;

    const workloadResult = await this.db
      .prepare(
        `SELECT assignee_id, COUNT(*) AS open_tasks FROM task_instances
         WHERE assignee_id IS NOT NULL AND state NOT IN ('completed', 'cancelled', 'failed')
         GROUP BY assignee_id ORDER BY open_tasks DESC`
      )
      .all<{ assignee_id: string; open_tasks: number }>();

    const workloadByCoordinator: CoordinatorWorkload[] = (workloadResult.results || []).map(
      r => ({
        coordinatorId: r.assignee_id,
        coordinatorName: r.assignee_id,
        openTasks: r.open_tasks,
        capacityPct: 0,
      })
    );

    return {
      activeWorkflows,
      tasksCompletedToday,
      slaCompliance24h,
      escalationsOpen,
      avgResponseTimeHours,
      workloadByCoordinator,
    };
  }

  private async count(sql: string, params: unknown[]): Promise<number> {
    const row = await this.db.prepare(sql).bind(...params).first<{ cnt: number }>();
    return row?.cnt ?? 0;
  }

  private priorityScore(priority: TaskPriority): number {
    switch (priority) {
      case 'critical':
        return 4000;
      case 'urgent':
        return 3000;
      case 'high':
        return 2000;
      default:
        return 1000;
    }
  }

  private mapRowToTask(row: TaskRow): TaskInstance {
    return {
      id: row.id,
      workflowInstanceId: row.workflow_instance_id,
      taskDefinitionId: row.task_definition_id,
      name: row.name,
      type: row.type as TaskType,
      assigneeRole: row.assignee_role || '',
      assigneeId: row.assignee_id || undefined,
      priority: row.priority as TaskPriority,
      status: row.state as TaskState,
      slaDeadline: row.sla_deadline ?? undefined,
      input: row.context ? (JSON.parse(row.context) as Record<string, unknown>) : undefined,
      output: row.outcome ? (JSON.parse(row.outcome) as Record<string, unknown>) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      claimedAt: row.claimed_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
      escalatedAt: undefined,
      escalationReason: undefined,
      retryCount: 0,
      lastError: row.failure_reason || undefined,
    };
  }
}

let _instance: TaskOrchestrator | null = null;

export function initTaskOrchestrator(config: TaskOrchestratorConfig): TaskOrchestrator {
  if (!_instance) _instance = new TaskOrchestrator(config);
  return _instance;
}

export function getTaskOrchestrator(): TaskOrchestrator {
  if (!_instance) throw new Error('TaskOrchestrator not initialized');
  return _instance;
}
