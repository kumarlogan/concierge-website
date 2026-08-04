/**
 * Wave 8 — Workflow & Automation Engine
 * Queue Manager — Durable work queue operations
 *
 * Architectural decision: no Cloudflare `Queue` binding exists in wrangler
 * config (a queue was never provisioned), so the durable work queue owner is
 * the D1 `task_queue` table (migration 0010). Real persistence, single owner.
 *
 * Only operations with a real backing and a caller are surfaced here; the
 * original placeholder enqueue* methods (SLA/timer/metrics/notification/audit
 * batches) referenced a non-existent queue and had no callers, so they are
 * removed as dead code per the reconciliation rules.
 */

import type { TaskInstance, TaskPriority } from '../types';

export interface QueueManagerConfig {
  db: D1Database;
}

export class QueueManager {
  private db: D1Database;

  constructor(config: QueueManagerConfig) {
    this.db = config.db;
  }

  /**
   * Enqueue a task for processing (durable outbox row)
   */
  async enqueueTask(task: TaskInstance, action: 'execute' | 'retry' = 'execute'): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO task_queue
           (id, task_instance_id, queue_type, priority_score, due_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        task.id,
        `task.${action}`,
        this.priorityScoreFor(task.priority),
        task.slaDeadline ?? null,
        Date.now()
      )
      .run();
  }

  /**
   * Get queue depth (count of unprocessed rows) for monitoring
   */
  async getQueueDepth(queueName: string): Promise<number> {
    const result = await this.db
      .prepare(
        `SELECT COUNT(*) AS depth FROM task_queue
         WHERE queue_type = ? AND completed_at IS NULL`
      )
      .bind(queueName)
      .first<{ depth: number }>();
    return result?.depth ?? 0;
  }

  private priorityScoreFor(priority: TaskPriority): number {
    switch (priority) {
      case 'critical': return 100;
      case 'urgent': return 75;
      case 'high': return 50;
      case 'routine': return 25;
      default: return 0;
    }
  }
}
