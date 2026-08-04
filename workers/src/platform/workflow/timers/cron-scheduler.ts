/**
 * Wave 8 — Workflow & Automation Engine
 * Cron Scheduler — Scheduled workflow actions
 */

import type { WorkflowTimer, TimerAction } from '../types';
import { getTimerService } from './timer-service';

export interface CronJobConfig {
  name: string;
  cronExpression: string;
  timezone?: string;
  action: TimerAction;
  workflowInstanceId?: string;
  enabled: boolean;
}

export interface ScheduledJob {
  id: string;
  name: string;
  cronExpression: string;
  timezone?: string;
  action: TimerAction;
  workflowInstanceId?: string;
  enabled: boolean;
  nextRun: number;
  lastRun?: number;
  runCount: number;
}

export interface CronSchedulerConfig {
  // reserved for future persistence/queue dependencies
}

export class CronScheduler {
  private jobs: Map<string, ScheduledJob> = new Map();

  constructor(_config: CronSchedulerConfig) {}

  /**
   * Register a cron job
   */
  registerJob(job: CronJobConfig): ScheduledJob {
    const scheduledJob: ScheduledJob = {
      id: crypto.randomUUID(),
      name: job.name,
      cronExpression: job.cronExpression,
      timezone: job.timezone,
      action: job.action,
      workflowInstanceId: job.workflowInstanceId,
      enabled: job.enabled,
      nextRun: this.calculateNextRun(job.cronExpression, job.timezone),
      runCount: 0,
    };

    this.jobs.set(scheduledJob.id, scheduledJob);
    return scheduledJob;
  }

  /**
   * Unregister a cron job
   */
  unregisterJob(jobId: string): boolean {
    return this.jobs.delete(jobId);
  }

  /**
   * Enable/disable a job
   */
  setJobEnabled(jobId: string, enabled: boolean): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.enabled = enabled;
    }
  }

  /**
   * Get all jobs
   */
  getAllJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get jobs due to run
   */
  getDueJobs(): ScheduledJob[] {
    const now = Date.now();
    return Array.from(this.jobs.values()).filter(
      job => job.enabled && job.nextRun <= now
    );
  }

  /**
   * Process due jobs (called by cron trigger)
   */
  async processDueJobs(): Promise<number> {
    const dueJobs = this.getDueJobs();
    let processed = 0;

    for (const job of dueJobs) {
      try {
        await this.executeJob(job);
        job.lastRun = Date.now();
        job.runCount++;
        job.nextRun = this.calculateNextRun(job.cronExpression, job.timezone);
        processed++;
      } catch (error) {
        console.error(`Cron job ${job.name} failed:`, error);
        // Still update next run to avoid tight loop on failure
        job.nextRun = this.calculateNextRun(job.cronExpression, job.timezone);
      }
    }

    return processed;
  }

  /**
   * Execute a job
   */
  private async executeJob(job: ScheduledJob): Promise<void> {
    // Create a timer for immediate execution
    await getTimerService().scheduleTimer(
      job.workflowInstanceId || 'system',
      'delayed_action',
      Date.now(),
      job.action
    );
  }

  /**
   * Calculate next run time from cron expression
   */
  private calculateNextRun(cronExpression: string, timezone?: string): number {
    // Simple cron parser for common patterns
    // In production, use a proper cron library like croner or cron-parser
    
    const now = new Date();
    if (timezone) {
      // Would use timezone-aware calculation
    }

    // Parse common patterns
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) {
      // Default to 1 hour from now
      return now.getTime() + 60 * 60 * 1000;
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    // Handle common patterns
    if (minute === '0' && hour === '*') {
      // Every hour at minute 0
      const next = new Date(now);
      next.setMinutes(0, 0, 0);
      next.setHours(next.getHours() + 1);
      return next.getTime();
    }

    if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      // Daily at specific time
      const next = new Date(now);
      next.setHours(parseInt(hour), parseInt(minute), 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      return next.getTime();
    }

    if (minute === '0' && hour === '6' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      // Daily at 6 AM
      const next = new Date(now);
      next.setHours(6, 0, 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      return next.getTime();
    }

    if (minute === '0' && hour === '2' && dayOfMonth === '*' && month === '*' && dayOfWeek === '0') {
      // Weekly Sunday at 2 AM
      const next = new Date(now);
      next.setHours(2, 0, 0, 0);
      const daysUntilSunday = (7 - next.getDay()) % 7;
      if (daysUntilSunday === 0 && next <= now) {
        next.setDate(next.getDate() + 7);
      } else {
        next.setDate(next.getDate() + daysUntilSunday);
      }
      return next.getTime();
    }

    if (minute === '0' && hour === '3' && dayOfMonth === '1' && month === '*' && dayOfWeek === '*') {
      // Monthly 1st at 3 AM
      const next = new Date(now);
      next.setDate(1);
      next.setHours(3, 0, 0, 0);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      return next.getTime();
    }

    // Default fallback
    return now.getTime() + 60 * 60 * 1000;
  }

  /**
   * Register standard Wave 8 cron jobs
   */
  registerStandardJobs(): void {
    // Hourly: SLA evaluation
    this.registerJob({
      name: 'sla-evaluation-hourly',
      cronExpression: '0 * * * *',
      action: {
        type: 'evaluate_rules',
        config: { job: 'sla-evaluation' },
      },
      enabled: true,
    });

    // Daily 6 AM: Metrics rollup, queue refresh
    this.registerJob({
      name: 'metrics-rollup-daily',
      cronExpression: '0 6 * * *',
      action: {
        type: 'evaluate_rules',
        config: { job: 'metrics-rollup' },
      },
      enabled: true,
    });

    // Weekly Sunday 2 AM: Quality metrics, override review
    this.registerJob({
      name: 'quality-metrics-weekly',
      cronExpression: '0 2 * * 0',
      action: {
        type: 'evaluate_rules',
        config: { job: 'quality-metrics' },
      },
      enabled: true,
    });

    // Monthly 1st 3 AM: Storage expiry, disposition
    this.registerJob({
      name: 'storage-expiry-monthly',
      cronExpression: '0 3 1 * *',
      action: {
        type: 'evaluate_rules',
        config: { job: 'storage-expiry' },
      },
      enabled: true,
    });
  }
}

export const cronScheduler = new CronScheduler({});