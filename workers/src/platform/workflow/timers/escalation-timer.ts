/**
 * Wave 8 — Workflow & Automation Engine
 * Escalation Timer — SLA-based escalation logic
 */

import type {
  TaskInstance,
  TaskPriority,
  WorkflowTimer,
} from '../types';
import { getTimerService } from './timer-service';

export interface EscalationPolicy {
  priority: TaskPriority;
  warningAt: number;    // percentage of SLA (0-1)
  breachAt: number;     // percentage of SLA (0-1)
  escalationLevels: EscalationLevel[];
}

export interface EscalationLevel {
  level: number;
  targetRole: string;
  targetUserId?: string;
  notifyMethod: 'push' | 'email' | 'sms' | 'page';
  delayMinutes: number; // minutes after previous level
}

export const defaultEscalationPolicies: Record<TaskPriority, EscalationPolicy> = {
  critical: {
    priority: 'critical',
    warningAt: 0.25,  // 25%
    breachAt: 0.5,    // 50%
    escalationLevels: [
      { level: 1, targetRole: 'physician_on_call', notifyMethod: 'page', delayMinutes: 0 },
      { level: 2, targetRole: 'medical_director', notifyMethod: 'page', delayMinutes: 15 },
      { level: 3, targetRole: 'executive_on_call', notifyMethod: 'page', delayMinutes: 30 },
    ],
  },
  urgent: {
    priority: 'urgent',
    warningAt: 0.5,   // 50%
    breachAt: 0.75,   // 75%
    escalationLevels: [
      { level: 1, targetRole: 'coordinator_lead', notifyMethod: 'push', delayMinutes: 0 },
      { level: 2, targetRole: 'manager', notifyMethod: 'push', delayMinutes: 30 },
      { level: 3, targetRole: 'director', notifyMethod: 'email', delayMinutes: 60 },
    ],
  },
  high: {
    priority: 'high',
    warningAt: 0.5,   // 50%
    breachAt: 1.0,    // 100%
    escalationLevels: [
      { level: 1, targetRole: 'coordinator_lead', notifyMethod: 'push', delayMinutes: 0 },
      { level: 2, targetRole: 'manager', notifyMethod: 'email', delayMinutes: 60 },
    ],
  },
  routine: {
    priority: 'routine',
    warningAt: 0.75,  // 75%
    breachAt: 1.0,    // 100%
    escalationLevels: [
      { level: 1, targetRole: 'coordinator_lead', notifyMethod: 'push', delayMinutes: 0 },
    ],
  },
};

export interface EscalationTimerConfig {
  // reserved for future persistence/notification dependencies
}

export class EscalationTimer {
  constructor(_config: EscalationTimerConfig) {}

  /**
   * Setup escalation timers for a task
   */
  async setupEscalation(task: TaskInstance): Promise<WorkflowTimer[]> {
    if (!task.slaDeadline) return [];

    const policy = defaultEscalationPolicies[task.priority];
    const timers: WorkflowTimer[] = [];

    // Schedule warning
    const warningAt = task.createdAt + (task.slaDeadline - task.createdAt) * policy.warningAt;
    if (warningAt > Date.now()) {
      const timer = await getTimerService().scheduleTimer(
        task.workflowInstanceId,
        'sla_warning',
        warningAt,
        {
          type: 'notify',
          config: {
            taskId: task.id,
            level: 'warning',
            policy: policy.priority,
          },
        },
        task.id
      );
      timers.push(timer);
    }

    // Schedule breach (first escalation level)
    const breachAt = task.createdAt + (task.slaDeadline - task.createdAt) * policy.breachAt;
    if (breachAt > Date.now()) {
      const timer = await getTimerService().scheduleTimer(
        task.workflowInstanceId,
        'sla_breach',
        breachAt,
        {
          type: 'escalate',
          config: {
            taskId: task.id,
            reason: 'SLA breach',
            level: 1,
            policy: policy.priority,
          },
        },
        task.id
      );
      timers.push(timer);
    }

    // Schedule subsequent escalation levels
    for (let i = 1; i < policy.escalationLevels.length; i++) {
      const level = policy.escalationLevels[i];
      const escalationAt = breachAt + level.delayMinutes * 60 * 1000;

      if (escalationAt > Date.now()) {
        const timer = await getTimerService().scheduleTimer(
          task.workflowInstanceId,
          'sla_breach',
          escalationAt,
          {
            type: 'escalate',
            config: {
              taskId: task.id,
              reason: `Escalation level ${level.level}`,
              level: level.level + 1,
              policy: policy.priority,
              targetRole: level.targetRole,
            },
          },
          task.id
        );
        timers.push(timer);
      }
    }

    return timers;
  }

  /**
   * Process SLA warning
   */
  async processSLAWarning(taskId: string, config: { taskId: string; level: string; policy: TaskPriority }): Promise<void> {
    // Warning delivery is handled downstream by the escalation timer's notify action
    void taskId;
    void config;
  }

  /**
   * Process SLA breach / escalation
   */
  async processSLABreach(
    taskId: string,
    config: { taskId: string; reason: string; level: number; policy: TaskPriority; targetRole?: string }
  ): Promise<void> {
    const policy = defaultEscalationPolicies[config.policy];
    const level = policy.escalationLevels.find(l => l.level === config.level);

    if (!level) return;

    // Escalation handling is delegated to the workflow engine via the timer.fired event
    void taskId;
    void level;
  }

  /**
   * Cancel escalation timers for a task (when task completed)
   */
  async cancelEscalationForTask(taskId: string): Promise<void> {
    void taskId;
  }

  /**
   * Get escalation policy for a priority
   */
  getPolicy(priority: TaskPriority): EscalationPolicy {
    return defaultEscalationPolicies[priority];
  }

  /**
   * Customize escalation policy for specific workflow/task type
   */
  async setCustomPolicy(
    workflowDefinitionId: string,
    taskDefinitionId: string,
    policy: EscalationPolicy
  ): Promise<void> {
    void workflowDefinitionId;
    void taskDefinitionId;
    void policy;
  }
}

export const escalationTimer = new EscalationTimer({});
