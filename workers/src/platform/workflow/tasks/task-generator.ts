/**
 * Wave 8 — Workflow & Automation Engine
 * Task Generator — Task creation from templates
 */

import type {
  TaskDefinition,
  TaskInstance,
  WorkflowInstance,
  WorkflowContext,
  TaskPriority,
  TaskType,
  SLATarget,
} from '../types';

export interface TaskGeneratorConfig {
  defaultSlaTargets?: Record<TaskPriority, number>;
}

export class TaskGenerator {
  private defaultSlaTargets: Record<TaskPriority, number> = {
    critical: 60 * 60 * 1000,      // 1 hour
    urgent: 4 * 60 * 60 * 1000,    // 4 hours
    high: 8 * 60 * 60 * 1000,      // 8 hours
    routine: 24 * 60 * 60 * 1000,  // 24 hours
  };

  constructor(config: TaskGeneratorConfig = {}) {
    if (config.defaultSlaTargets) {
      this.defaultSlaTargets = config.defaultSlaTargets;
    }
  }

  /**
   * Create a task instance from a definition
   */
  createTask(
    definition: TaskDefinition,
    workflowInstance: WorkflowInstance,
    context: WorkflowContext,
    overrides?: Partial<TaskInstance>
  ): TaskInstance {
    const now = Date.now();
    const slaDeadline = now + (this.defaultSlaTargets[definition.priority] || this.defaultSlaTargets.routine);

    const task: TaskInstance = {
      id: crypto.randomUUID(),
      workflowInstanceId: workflowInstance.id,
      taskDefinitionId: definition.id,
      name: definition.name,
      type: definition.type,
      assigneeRole: definition.assigneeRole,
      assigneeId: undefined,
      priority: definition.priority,
      status: 'draft',
      slaDeadline,
      input: definition.inputSchema ? this.initializeInput(definition.inputSchema, context) : undefined,
      output: undefined,
      createdAt: now,
      updatedAt: now,
      claimedAt: undefined,
      completedAt: undefined,
      escalatedAt: undefined,
      escalationReason: undefined,
      retryCount: 0,
      lastError: undefined,
      ...overrides,
    };

    return task;
  }

  /**
   * Initialize task input from context using schema
   */
  private initializeInput(schema: Record<string, unknown>, context: WorkflowContext): Record<string, unknown> {
    const input: Record<string, unknown> = {};
    const contextObj = context as unknown as Record<string, unknown>;
    
    // Map common context fields to input
    for (const [key, value] of Object.entries(schema)) {
      if (typeof value === 'string' && value.startsWith('context.')) {
        const path = value.replace('context.', '');
        input[key] = this.getNestedValue(contextObj, path);
      } else {
        input[key] = value;
      }
    }

    return input;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: any, key: string) => current?.[key], obj);
  }

  /**
   * Generate multiple tasks from definitions
   */
  generateTasks(
    definitions: TaskDefinition[],
    workflowInstance: WorkflowInstance,
    context: WorkflowContext
  ): TaskInstance[] {
    return definitions.map(def => this.createTask(def, workflowInstance, context));
  }

  /**
   * Create task with computed SLA based on priority and business hours
   */
  createTaskWithBusinessHoursSla(
    definition: TaskDefinition,
    workflowInstance: WorkflowInstance,
    context: WorkflowContext,
    businessHoursOnly: boolean = true
  ): TaskInstance {
    let slaMs = this.defaultSlaTargets[definition.priority];
    
    if (businessHoursOnly) {
      // Extend SLA to account for non-business hours
      // Simple approximation: 8 business hours per 24 hours
      slaMs = slaMs * 3;
    }

    const now = Date.now();
    const task: TaskInstance = {
      id: crypto.randomUUID(),
      workflowInstanceId: workflowInstance.id,
      taskDefinitionId: definition.id,
      name: definition.name,
      type: definition.type,
      assigneeRole: definition.assigneeRole,
      assigneeId: undefined,
      priority: definition.priority,
      status: 'draft',
      slaDeadline: now + slaMs,
      input: definition.inputSchema ? this.initializeInput(definition.inputSchema, context) : undefined,
      output: undefined,
      createdAt: now,
      updatedAt: now,
      claimedAt: undefined,
      completedAt: undefined,
      escalatedAt: undefined,
      escalationReason: undefined,
      retryCount: 0,
      lastError: undefined,
    };

    return task;
  }
}

export const taskGenerator = new TaskGenerator();