/**
 * Wave 8 — Workflow & Automation Engine
 * Main Workflow Engine — Orchestration entry point
 */

import type {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowContext,
  TaskInstance,
  TaskDefinition,
  JourneyState,
  WorkflowStatus,
  Actor,
  StartWorkflowRequest,
  TaskActionRequest,
  ApprovalDecisionRequest,
  WorkflowSearchRequest,
  TaskSearchRequest,
  DashboardQueueResponse,
  WorkflowEvent,
  RuleResult,
} from '../types';
import { stateMachine } from './state-machine';
import { contextManager } from './context-manager';
import { transitionValidator } from './transition-validator';
import { EventStore } from '../events/event-store';
import { TaskOrchestrator } from '../tasks/task-orchestrator';
import { ApprovalGateService } from '../approval/approval-gate';
import { TimerService } from '../timers/timer-service';

export interface WorkflowEngineConfig {
  eventStore: EventStore;
  taskOrchestrator: TaskOrchestrator;
  approvalGate: ApprovalGateService;
  timerService: TimerService;
}

export class WorkflowEngine {
  private eventStore: EventStore;
  private taskOrchestrator: TaskOrchestrator;
  private approvalGate: ApprovalGateService;
  private timerService: TimerService;

  constructor(config: WorkflowEngineConfig) {
    this.eventStore = config.eventStore;
    this.taskOrchestrator = config.taskOrchestrator;
    this.approvalGate = config.approvalGate;
    this.timerService = config.timerService;
  }

  /**
   * Start a new workflow instance
   */
  async startWorkflow(request: StartWorkflowRequest, actor: Actor): Promise<WorkflowInstance> {
    // 1. Create initial context
    const definition = { id: request.definitionId, status: 'active' as const, name: request.definitionId } as const;
    const context = contextManager.createInitialContext(definition as unknown as Parameters<typeof contextManager.createInitialContext>[0], request.patientId, request.initialContext);

    // 2. Create workflow instance
    const instance: WorkflowInstance = {
      id: crypto.randomUUID(),
      definitionId: request.definitionId,
      patientId: request.patientId,
      currentState: 'pre_treatment.consultation',
      context,
      status: 'running',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 3. Persist instance via event store
    await this.emitEvent({
      workflowInstanceId: instance.id,
      eventType: 'workflow.started',
      payload: { definitionId: request.definitionId, patientId: request.patientId },
      actor,
      correlationId: instance.id,
      timestamp: Date.now(),
      version: 1,
    });

    // 4. Generate initial tasks for the starting state
    await this.taskOrchestrator.generateTasksForState(instance, 'pre_treatment.consultation' as JourneyState);

    return instance;
  }

  /**
   * Get workflow instance by ID
   */
  async getInstance(id: string): Promise<WorkflowInstance | null> {
    const events = await this.eventStore.getEventsForWorkflow(id);
    if (events.length === 0) return null;
    return this.reconstructInstance(events);
  }

  /**
   * Get workflow instances with filters
   */
  async searchInstances(request: WorkflowSearchRequest): Promise<{ items: WorkflowInstance[]; total: number }> {
    const events = await this.eventStore.getEventsByType('workflow.started', 1000);
    const instances = this.reconstructInstances(events);
    return { items: instances, total: instances.length };
  }

  /**
   * Pause a workflow
   */
  async pauseWorkflow(id: string, reason: string, actor: Actor): Promise<void> {
    const instance = await this.getInstance(id);
    if (!instance) {
      throw new Error(`Workflow not found: ${id}`);
    }
    if (instance.status !== 'running') {
      throw new Error(`Cannot pause workflow in status: ${instance.status}`);
    }

    // Suspend all timers for this workflow
    await this.timerService.suspendTimersForWorkflow(id);

    // Emit event
    await this.emitEvent({
      workflowInstanceId: id,
      eventType: 'workflow.paused',
      payload: { reason },
      actor,
      correlationId: id,
      timestamp: Date.now(),
      version: 1,
    });
  }

  /**
   * Resume a paused workflow
   */
  async resumeWorkflow(id: string, actor: Actor): Promise<void> {
    const instance = await this.getInstance(id);
    if (!instance) {
      throw new Error(`Workflow not found: ${id}`);
    }
    if (instance.status !== 'paused') {
      throw new Error(`Cannot resume workflow in status: ${instance.status}`);
    }

    // Resume timers
    await this.timerService.resumeTimersForWorkflow(id);

    // Emit event
    await this.emitEvent({
      workflowInstanceId: id,
      eventType: 'workflow.resumed',
      payload: {},
      actor,
      correlationId: id,
      timestamp: Date.now(),
      version: 1,
    });
  }

  /**
   * Cancel a workflow
   */
  async cancelWorkflow(id: string, reason: string, actor: Actor): Promise<void> {
    const instance = await this.getInstance(id);
    if (!instance) {
      throw new Error(`Workflow not found: ${id}`);
    }
    if (instance.status === 'completed' || instance.status === 'cancelled') {
      throw new Error(`Cannot cancel workflow in status: ${instance.status}`);
    }

    // Cancel all pending tasks
    await this.taskOrchestrator.cancelAllTasksForWorkflow(id, reason);

    // Cancel all timers
    await this.timerService.cancelTimersForWorkflow(id);

    // Emit event
    await this.emitEvent({
      workflowInstanceId: id,
      eventType: 'workflow.cancelled',
      payload: { reason },
      actor,
      correlationId: id,
      timestamp: Date.now(),
      version: 1,
    });
  }

  /**
   * Process a task action (claim, complete, reassign, escalate)
   */
  async processTaskAction(taskId: string, request: TaskActionRequest): Promise<TaskInstance> {
    const task = await this.taskOrchestrator.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const instance = await this.getInstance(task.workflowInstanceId);
    if (!instance) {
      throw new Error(`Workflow instance not found: ${task.workflowInstanceId}`);
    }

    // Validate transition
    const validation = await transitionValidator.validateTaskTransition(
      task,
      this.mapActionToTargetState(request.action),
      request.actor,
      instance.context
    );

    if (!validation.valid) {
      throw new Error(validation.reason || 'Invalid task transition');
    }

    // Execute action
    let updatedTask: TaskInstance;
    switch (request.action) {
      case 'claim':
        updatedTask = await this.taskOrchestrator.claimTask(taskId, request.actor.id);
        break;
      case 'complete':
        updatedTask = await this.taskOrchestrator.completeTask(taskId, request.payload || {}, request.actor);
        break;
      case 'reassign':
        updatedTask = await this.taskOrchestrator.reassignTask(taskId, request.payload?.newAssigneeId as string, request.actor);
        break;
      case 'escalate':
        updatedTask = await this.taskOrchestrator.escalateTask(taskId, request.payload?.reason as string, request.actor);
        break;
      default:
        throw new Error(`Unknown action: ${request.action}`);
    }

    // Check for workflow state transitions after task completion
    if (request.action === 'complete') {
      await this.evaluateWorkflowTransitions(instance);
    }

    return updatedTask;
  }

  /**
   * Process an approval decision
   */
  async processApprovalDecision(gateId: string, request: ApprovalDecisionRequest): Promise<void> {
    const decision = await this.approvalGate.processDecision(gateId, request);

    // If approved, check for workflow transitions
    if (request.decision === 'approve') {
      // Find the workflow instance from events
      const events = await this.eventStore.getEventsForWorkflow(gateId);
      if (events.length > 0) {
        const instance = this.reconstructInstance(events);
        await this.evaluateWorkflowTransitions(instance as WorkflowInstance);
      }
    }
  }

  /**
   * Evaluate and execute workflow state transitions
   */
  private async evaluateWorkflowTransitions(instance: WorkflowInstance): Promise<void> {
    // Get completed task IDs for this workflow
    const completedTasks = await this.taskOrchestrator.getCompletedTasksForWorkflow(instance.id);
    const completedTaskIds = completedTasks.map(t => t.taskDefinitionId);

    // Get approved gate IDs
    const approvedGates = await this.approvalGate.getApprovedGatesForWorkflow(instance.id);
    const approvedGateIds = approvedGates.map(g => g.id);

    // Get rule results
    const ruleResults: RuleResult[] = []; // Would be fetched from event store

    // Check each possible transition from current state
    const validTransitions = stateMachine.getValidJourneyTransitions(instance.currentState);
    
    for (const transition of validTransitions) {
      const validation = await transitionValidator.validateJourneyTransition({
        workflowInstance: instance,
        workflowContext: instance.context,
        completedTaskIds,
        approvedGateIds,
        ruleResults,
        actor: { type: 'system', id: 'workflow-engine' },
      }, transition.to as JourneyState);

      if (validation.valid) {
        // Execute transition
        await this.executeStateTransition(instance, transition.to as JourneyState, transition);
        break; // Only one transition at a time
      }
    }
  }

  /**
   * Execute a workflow state transition
   */
  private async executeStateTransition(
    instance: WorkflowInstance,
    newState: JourneyState,
    transition: { trigger: string; requiredTasks?: string[] }
  ): Promise<void> {
    const oldState = instance.currentState;
    instance.currentState = newState;
    instance.updatedAt = Date.now();

    // Check if workflow is complete
    if (newState === 'completed') {
      instance.status = 'completed';
      instance.completedAt = Date.now();
    }

    // Emit state change event
    await this.emitEvent({
      workflowInstanceId: instance.id,
      eventType: 'workflow.state_changed',
      payload: { fromState: oldState, toState: newState, trigger: transition.trigger },
      actor: { type: 'system', id: 'workflow-engine' },
      correlationId: instance.id,
      timestamp: Date.now(),
      version: 1,
    });

    // Generate tasks for new state
    await this.taskOrchestrator.generateTasksForState(instance, newState);
  }

  /**
   * Map task action to target task state
   */
  private mapActionToTargetState(action: TaskActionRequest['action']): TaskInstance['status'] {
    switch (action) {
      case 'claim': return 'claimed';
      case 'complete': return 'completed';
      case 'reassign': return 'received'; // Goes back to received for new assignee
      case 'escalate': return 'escalated';
      default: return 'in_progress';
    }
  }

  /**
   * Emit a workflow event
   */
  private async emitEvent(event: Omit<WorkflowEvent, 'id'>): Promise<void> {
    const fullEvent: WorkflowEvent = {
      ...event,
      id: crypto.randomUUID(),
    };
    await this.eventStore.append(fullEvent);
  }

  /**
   * Reconstruct a WorkflowInstance from event history
   */
  private reconstructInstance(events: WorkflowEvent[]): WorkflowInstance {
    let instance: WorkflowInstance | null = null;
    for (const event of events) {
      switch (event.eventType) {
        case 'workflow.started':
          instance = {
            id: event.workflowInstanceId,
            definitionId: (event.payload as { definitionId: string }).definitionId,
            patientId: (event.payload as { patientId: string }).patientId,
            currentState: 'pre_treatment.consultation',
            context: {} as WorkflowContext,
            status: 'running',
            createdAt: event.timestamp,
            updatedAt: event.timestamp,
          };
          break;
        case 'workflow.paused':
          if (instance) {
            instance.status = 'paused';
            instance.updatedAt = event.timestamp;
          }
          break;
        case 'workflow.resumed':
          if (instance) {
            instance.status = 'running';
            instance.updatedAt = event.timestamp;
          }
          break;
        case 'workflow.cancelled':
          if (instance) {
            instance.status = 'cancelled';
            instance.completedAt = event.timestamp;
            instance.updatedAt = event.timestamp;
          }
          break;
        case 'workflow.state_changed':
          if (instance) {
            instance.currentState = (event.payload as { toState: JourneyState }).toState;
            instance.updatedAt = event.timestamp;
          }
          break;
      }
    }
    if (!instance) {
      throw new Error('Cannot reconstruct workflow instance from events');
    }
    return instance;
  }

  /**
   * Reconstruct multiple WorkflowInstances from event history
   */
  private reconstructInstances(events: WorkflowEvent[]): WorkflowInstance[] {
    const instances = new Map<string, WorkflowInstance>();
    for (const event of events) {
      const wid = event.workflowInstanceId;
      let instance = instances.get(wid);
      if (!instance) {
        instance = this.reconstructInstance([event]);
        instances.set(wid, instance);
      } else {
        switch (event.eventType) {
          case 'workflow.paused':
            instance.status = 'paused';
            instance.updatedAt = event.timestamp;
            break;
          case 'workflow.resumed':
            instance.status = 'running';
            instance.updatedAt = event.timestamp;
            break;
          case 'workflow.cancelled':
            instance.status = 'cancelled';
            instance.completedAt = event.timestamp;
            instance.updatedAt = event.timestamp;
            break;
          case 'workflow.state_changed':
            instance.currentState = (event.payload as { toState: JourneyState }).toState;
            instance.updatedAt = event.timestamp;
            break;
        }
      }
    }
    return Array.from(instances.values());
  }

  /**
   * Get dashboard queue data
   */
  async getDashboardQueue(actor: Actor): Promise<DashboardQueueResponse> {
    return this.taskOrchestrator.getDashboardQueue(actor);
  }
}