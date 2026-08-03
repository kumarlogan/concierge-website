/**
 * Wave 8 — Workflow & Automation Engine
 * Timer Service — Delayed actions, SLA timers, escalation timers
 *
 * Persistence layer: D1 `workflow_timers` table (migration 0010_workflow_engine.sql).
 * Fired actions are emitted to the optional EventStore as `timer.fired` events.
 */

import type {
  WorkflowTimer,
  TimerType,
  TimerStatus,
  TimerAction,
  TaskInstance,
} from '../types';
import { EventStore } from '../events/event-store';

export interface TimerServiceConfig {
  db: D1Database;
  eventStore?: EventStore;
}

interface TimerRow {
  id: string;
  workflow_instance_id: string;
  task_instance_id: string | null;
  timer_type: string;
  fire_at: number;
  action: string;
  status: string;
  fired_at: number | null;
  cancelled_at: number | null;
  created_at: number;
}

export class TimerService {
  private db: D1Database;
  private eventStore?: EventStore;

  constructor(config: TimerServiceConfig) {
    this.db = config.db;
    this.eventStore = config.eventStore;
  }

  /**
   * Schedule a timer — persists a row in workflow_timers
   */
  async scheduleTimer(
    workflowInstanceId: string,
    timerType: TimerType,
    fireAt: number,
    action: TimerAction,
    taskInstanceId?: string
  ): Promise<WorkflowTimer> {
    const timer: WorkflowTimer = {
      id: crypto.randomUUID(),
      workflowInstanceId,
      taskInstanceId,
      timerType,
      fireAt,
      action,
      status: 'scheduled',
      createdAt: Date.now(),
      firedAt: undefined,
    };

    await this.db
      .prepare(
        `INSERT INTO workflow_timers
           (id, workflow_instance_id, task_instance_id, timer_type, fire_at, action, status, fired_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        timer.id,
        timer.workflowInstanceId,
        timer.taskInstanceId || null,
        timer.timerType,
        timer.fireAt,
        JSON.stringify(timer.action),
        timer.status,
        null,
        timer.createdAt
      )
      .run();

    return timer;
  }

  /**
   * Schedule SLA warning timer (50% of SLA)
   */
  async scheduleSLAWarning(task: TaskInstance): Promise<WorkflowTimer | null> {
    if (!task.slaDeadline) return null;

    const warningAt = task.createdAt + (task.slaDeadline - task.createdAt) * 0.5;

    return this.scheduleTimer(
      task.workflowInstanceId,
      'sla_warning',
      warningAt,
      {
        type: 'notify',
        config: { taskId: task.id, level: 'warning' },
      },
      task.id
    );
  }

  /**
   * Schedule SLA breach timer (100% of SLA)
   */
  async scheduleSLABreach(task: TaskInstance): Promise<WorkflowTimer | null> {
    if (!task.slaDeadline) return null;

    return this.scheduleTimer(
      task.workflowInstanceId,
      'sla_breach',
      task.slaDeadline,
      {
        type: 'escalate',
        config: { taskId: task.id, reason: 'SLA breach' },
      },
      task.id
    );
  }

  /**
   * Schedule approval timeout timer (75% of timeout)
   */
  async scheduleApprovalTimeout(gateId: string, workflowInstanceId: string, timeoutAt: number): Promise<WorkflowTimer> {
    const warningAt = timeoutAt - (timeoutAt - Date.now()) * 0.25; // 75% elapsed

    return this.scheduleTimer(
      workflowInstanceId,
      'approval_timeout',
      warningAt,
      {
        type: 'escalate',
        config: { gateId, reason: 'Approval timeout' },
      }
    );
  }

  /**
   * Schedule delayed action (e.g., beta scheduling after transfer)
   */
  async scheduleDelayedAction(
    workflowInstanceId: string,
    fireAt: number,
    action: TimerAction,
    description: string
  ): Promise<WorkflowTimer> {
    return this.scheduleTimer(
      workflowInstanceId,
      'delayed_action',
      fireAt,
      action
    );
  }

  /**
   * Schedule recurring monitoring reminders
   */
  async scheduleRecurringMonitoring(
    workflowInstanceId: string,
    startAt: number,
    intervalMs: number,
    action: TimerAction,
    endAt?: number
  ): Promise<WorkflowTimer[]> {
    const timers: WorkflowTimer[] = [];
    let fireAt = startAt;
    const now = Date.now();

    // Don't schedule past events
    if (fireAt < now) fireAt = now + 60000; // 1 minute from now

    while (!endAt || fireAt < endAt) {
      const timer = await this.scheduleTimer(
        workflowInstanceId,
        'recurring_monitoring',
        fireAt,
        action
      );
      timers.push(timer);
      fireAt += intervalMs;

      // Safety limit
      if (timers.length > 100) break;
    }

    return timers;
  }

  /**
   * Schedule beta hCG after transfer
   */
  async scheduleBetaHCG(workflowInstanceId: string, transferDate: number): Promise<WorkflowTimer[]> {
    const timers: WorkflowTimer[] = [];

    // Day 9 post-transfer
    const day9 = transferDate + 9 * 24 * 60 * 60 * 1000;
    timers.push(await this.scheduleTimer(
      workflowInstanceId,
      'beta_scheduling',
      day9,
      {
        type: 'create_task',
        config: { taskDefinitionId: 'task.pregnancy.beta', day: 9 },
      }
    ));

    // Day 11 post-transfer (backup)
    const day11 = transferDate + 11 * 24 * 60 * 60 * 1000;
    timers.push(await this.scheduleTimer(
      workflowInstanceId,
      'beta_scheduling',
      day11,
      {
        type: 'create_task',
        config: { taskDefinitionId: 'task.pregnancy.beta', day: 11 },
      }
    ));

    return timers;
  }

  /**
   * Schedule follow-up series after positive beta
   */
  async scheduleFollowUpSeries(workflowInstanceId: string, firstBetaDate: number): Promise<WorkflowTimer[]> {
    const timers: WorkflowTimer[] = [];

    // Serial betas every 2 days for 2 weeks
    for (let i = 0; i < 7; i++) {
      const fireAt = firstBetaDate + i * 2 * 24 * 60 * 60 * 1000;
      timers.push(await this.scheduleTimer(
        workflowInstanceId,
        'follow_up_series',
        fireAt,
        {
          type: 'create_task',
          config: { taskDefinitionId: 'task.pregnancy.serial_beta', sequence: i + 1 },
        }
      ));
    }

    // Viability ultrasound at ~6 weeks
    const usDate = firstBetaDate + 42 * 24 * 60 * 60 * 1000;
    timers.push(await this.scheduleTimer(
      workflowInstanceId,
      'follow_up_series',
      usDate,
      {
        type: 'create_task',
        config: { taskDefinitionId: 'task.pregnancy.ultrasound', type: 'viability' },
      }
    ));

    return timers;
  }

  /**
   * Schedule storage expiry notification
   */
  async scheduleStorageExpiry(workflowInstanceId: string, expiryDate: number): Promise<WorkflowTimer> {
    // 30 days before expiry
    const warningAt = expiryDate - 30 * 24 * 60 * 60 * 1000;

    return this.scheduleTimer(
      workflowInstanceId,
      'storage_expiry',
      warningAt,
      {
        type: 'notify',
        config: { type: 'storage_expiry_warning', daysUntilExpiry: 30 },
      }
    );
  }

  /**
   * Cancel all scheduled timers for a workflow
   */
  async cancelTimersForWorkflow(workflowInstanceId: string): Promise<void> {
    const now = Date.now();
    await this.db
      .prepare(
        `UPDATE workflow_timers
         SET status = 'cancelled', cancelled_at = ?
         WHERE workflow_instance_id = ? AND status = 'scheduled'`
      )
      .bind(now, workflowInstanceId)
      .run();
  }

  /**
   * Suspend timers for a paused workflow — store resume metadata, then cancel the rows
   */
  async suspendTimersForWorkflow(workflowInstanceId: string): Promise<void> {
    const now = Date.now();
    const scheduled = await this.getTimersByWorkflow(workflowInstanceId, 'scheduled');

    for (const timer of scheduled) {
      const suspendedConfig = {
        ...timer.action.config,
        suspendedAt: now,
        originalFireAt: timer.fireAt,
      };
      await this.db
        .prepare(
          `UPDATE workflow_timers
           SET status = 'cancelled', cancelled_at = ?, action = ?
           WHERE id = ?`
        )
        .bind(
          now,
          JSON.stringify({ ...timer.action, config: suspendedConfig }),
          timer.id
        )
        .run();
    }
  }

  /**
   * Resume timers for a workflow — reschedule suspended timers adjusted for pause duration
   */
  async resumeTimersForWorkflow(workflowInstanceId: string): Promise<void> {
    const now = Date.now();
    const cancelled = await this.getTimersByWorkflow(workflowInstanceId, 'cancelled');

    for (const timer of cancelled) {
      const suspendedAt = timer.action.config.suspendedAt;
      const originalFireAt = timer.action.config.originalFireAt;
      if (typeof suspendedAt !== 'number' || typeof originalFireAt !== 'number') {
        continue;
      }

      const pauseDuration = now - suspendedAt;
      const newFireAt = originalFireAt + pauseDuration;

      if (newFireAt > now) {
        const resumeConfig = { ...timer.action.config };
        delete resumeConfig.suspendedAt;
        delete resumeConfig.originalFireAt;

        await this.scheduleTimer(
          timer.workflowInstanceId || workflowInstanceId,
          timer.timerType,
          newFireAt,
          { ...timer.action, config: resumeConfig },
          timer.taskInstanceId
        );
      }
    }
  }

  /**
   * Process due timers (called by queue consumer / cron tick)
   */
  async processDueTimers(limit: number = 20): Promise<number> {
    const now = Date.now();
    const result = await this.db
      .prepare(
        `SELECT * FROM workflow_timers
         WHERE fire_at <= ? AND status = 'scheduled'
         ORDER BY fire_at ASC
         LIMIT ?`
      )
      .bind(now, limit)
      .all<TimerRow>();

    const rows = result.results || [];
    let processed = 0;

    for (const row of rows) {
      const timer = this.mapRowToTimer(row);
      try {
        await this.executeTimerAction(timer);
        await this.db
          .prepare(
            `UPDATE workflow_timers SET status = 'fired', fired_at = ? WHERE id = ?`
          )
          .bind(now, timer.id)
          .run();
        processed++;
      } catch (error) {
        console.error(`Timer ${timer.id} failed:`, error);
        await this.db
          .prepare(
            `UPDATE workflow_timers SET status = 'failed' WHERE id = ?`
          )
          .bind(timer.id)
          .run();
      }
    }

    return processed;
  }

  /**
   * Execute timer action — emits a `timer.fired` event carrying the config when an EventStore is present
   */
  private async executeTimerAction(timer: WorkflowTimer): Promise<void> {
    switch (timer.action.type) {
      case 'notify':
        await this.emitTimerFired(timer);
        break;
      case 'escalate':
        await this.emitTimerFired(timer);
        break;
      case 'transition':
        await this.emitTimerFired(timer);
        break;
      case 'create_task':
        await this.emitTimerFired(timer);
        break;
      case 'complete_task':
        await this.emitTimerFired(timer);
        break;
      case 'evaluate_rules':
        await this.emitTimerFired(timer);
        break;
    }
  }

  /**
   * Emit a `timer.fired` event with the timer's action config when an EventStore is configured
   */
  private async emitTimerFired(timer: WorkflowTimer): Promise<void> {
    if (!this.eventStore) return;

    const correlationId = timer.workflowInstanceId || timer.id;
    await this.eventStore.append({
      workflowInstanceId: correlationId,
      eventType: 'timer.fired',
      payload: {
        timerId: timer.id,
        timerType: timer.timerType,
        taskInstanceId: timer.taskInstanceId,
        config: timer.action.config,
      },
      actor: { type: 'system', id: 'timer-service' },
      correlationId,
      timestamp: Date.now(),
      version: 1,
    });
  }

  /**
   * Load timers for a workflow, optionally filtered by status
   */
  private async getTimersByWorkflow(
    workflowInstanceId: string,
    status?: TimerStatus
  ): Promise<WorkflowTimer[]> {
    let sql = `SELECT * FROM workflow_timers WHERE workflow_instance_id = ?`;
    const params: (string | number)[] = [workflowInstanceId];
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY fire_at ASC`;

    const result = await this.db.prepare(sql).bind(...params).all<TimerRow>();
    return (result.results || []).map(row => this.mapRowToTimer(row));
  }

  /**
   * Map a database row to a WorkflowTimer
   */
  private mapRowToTimer(row: TimerRow): WorkflowTimer {
    const action = JSON.parse(row.action) as TimerAction;
    return {
      id: row.id,
      workflowInstanceId: row.workflow_instance_id,
      taskInstanceId: row.task_instance_id || undefined,
      timerType: row.timer_type as TimerType,
      fireAt: row.fire_at,
      action,
      status: row.status as TimerStatus,
      createdAt: row.created_at,
      firedAt: row.fired_at ?? undefined,
    };
  }
}

let _instance: TimerService | null = null;

export function initTimerService(config: TimerServiceConfig): TimerService {
  if (!_instance) _instance = new TimerService(config);
  return _instance;
}

export function getTimerService(): TimerService {
  if (!_instance) throw new Error('TimerService not initialized');
  return _instance;
}
