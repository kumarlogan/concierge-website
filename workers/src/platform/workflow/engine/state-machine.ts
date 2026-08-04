/**
 * Wave 8 — Workflow & Automation Engine
 * State Machine Implementation
 */

import type {
  JourneyState,
  TaskState,
  WorkflowInstance,
  TaskInstance,
  WorkflowContext,
  WorkflowDefinition,
  TransitionDefinition,
  WorkflowEvent,
  Actor,
} from '../types';

export interface StateTransition {
  from: JourneyState | TaskState;
  to: JourneyState | TaskState;
  trigger: string;
  condition?: string; // FEEL expression
  requiredTasks?: string[];
  requiredApprovals?: string[];
}

export interface StateMachineConfig {
  journeyTransitions: StateTransition[];
  taskTransitions: StateTransition[];
}

export class StateMachine {
  private journeyTransitions: Map<string, StateTransition[]> = new Map();
  private taskTransitions: Map<string, StateTransition[]> = new Map();

  constructor(config: StateMachineConfig) {
    for (const t of config.journeyTransitions) {
      if (!this.journeyTransitions.has(t.from)) {
        this.journeyTransitions.set(t.from, []);
      }
      this.journeyTransitions.get(t.from)!.push(t);
    }
    for (const t of config.taskTransitions) {
      if (!this.taskTransitions.has(t.from)) {
        this.taskTransitions.set(t.from, []);
      }
      this.taskTransitions.get(t.from)!.push(t);
    }
  }

  /**
   * Get valid next states for a journey state
   */
  getValidJourneyTransitions(currentState: JourneyState): StateTransition[] {
    return this.journeyTransitions.get(currentState) || [];
  }

  /**
   * Get valid next states for a task state
   */
  getValidTaskTransitions(currentState: TaskState): StateTransition[] {
    return this.taskTransitions.get(currentState) || [];
  }

  /**
   * Check if a journey transition is valid
   */
  canTransitionJourney(
    instance: WorkflowInstance,
    targetState: JourneyState,
    context: WorkflowContext,
    completedTaskIds: string[],
    approvedGateIds: string[]
  ): { valid: boolean; reason?: string; transition?: StateTransition } {
    const transitions = this.getValidJourneyTransitions(instance.currentState);
    const transition = transitions.find(t => t.to === targetState);

    if (!transition) {
      return { valid: false, reason: `No transition defined from ${instance.currentState} to ${targetState}` };
    }

    // Check required tasks
    if (transition.requiredTasks) {
      const missing = transition.requiredTasks.filter(id => !completedTaskIds.includes(id));
      if (missing.length > 0) {
        return { valid: false, reason: `Required tasks not completed: ${missing.join(', ')}` };
      }
    }

    // Check required approvals
    if (transition.requiredApprovals) {
      const missing = transition.requiredApprovals.filter(id => !approvedGateIds.includes(id));
      if (missing.length > 0) {
        return { valid: false, reason: `Required approvals not granted: ${missing.join(', ')}` };
      }
    }

    // Transition conditions are owned by TransitionValidator (single owner) —
    // this method only performs structural/actor-rule checks.
    return { valid: true, transition };
  }

  /**
   * Check if a task transition is valid
   */
  canTransitionTask(
    task: TaskInstance,
    targetState: TaskState,
    actor: Actor
  ): { valid: boolean; reason?: string; transition?: StateTransition } {
    const transitions = this.getValidTaskTransitions(task.status);
    const transition = transitions.find(t => t.to === targetState);

    if (!transition) {
      return { valid: false, reason: `No transition defined from ${task.status} to ${targetState}` };
    }

    // Validate actor permissions for specific transitions
    if (targetState === 'claimed' && task.assigneeId && task.assigneeId !== actor.id) {
      return { valid: false, reason: 'Task already claimed by another user' };
    }

    if (targetState === 'in_progress' && task.status !== 'accepted' && task.status !== 'claimed') {
      return { valid: false, reason: 'Task must be accepted or claimed to start' };
    }

    if (targetState === 'completed' && task.status !== 'in_progress') {
      return { valid: false, reason: 'Task must be in progress to complete' };
    }

    return { valid: true, transition };
  }

  /**
   * Get all possible journey states
   */
  getAllJourneyStates(): JourneyState[] {
    const states = new Set<JourneyState>();
    for (const [from, transitions] of this.journeyTransitions) {
      states.add(from as JourneyState);
      for (const t of transitions) {
        states.add(t.to as JourneyState);
      }
    }
    return Array.from(states);
  }

  /**
   * Get all possible task states
   */
  getAllTaskStates(): TaskState[] {
    const states = new Set<TaskState>();
    for (const [from, transitions] of this.taskTransitions) {
      states.add(from as TaskState);
      for (const t of transitions) {
        states.add(t.to as TaskState);
      }
    }
    return Array.from(states);
  }
}

// Default configuration matching the workflow blueprint
export const defaultStateMachineConfig: StateMachineConfig = {
  journeyTransitions: [
    // Pre-treatment phase
    { from: 'pre_treatment.consultation', to: 'pre_treatment.testing', trigger: 'consultation_complete' },
    { from: 'pre_treatment.testing', to: 'pre_treatment.authorization', trigger: 'testing_complete' },
    { from: 'pre_treatment.authorization', to: 'stimulation.monitoring', trigger: 'authorized' },
    
    // Stimulation phase
    { from: 'stimulation.monitoring', to: 'stimulation.trigger', trigger: 'trigger_decided' },
    { from: 'stimulation.trigger', to: 'retrieval', trigger: 'trigger_administered' },
    
    // Retrieval
    { from: 'retrieval', to: 'laboratory.fertilization', trigger: 'retrieval_complete' },
    
    // Laboratory phase (parallel paths converge)
    { from: 'laboratory.fertilization', to: 'laboratory.culture', trigger: 'fertilization_complete' },
    { from: 'laboratory.culture', to: 'laboratory.pgt', trigger: 'pgt_indicated', condition: 'context.pgtIndicated === true' },
    { from: 'laboratory.culture', to: 'transfer.preparation', trigger: 'culture_complete', condition: 'context.pgtIndicated !== true' },
    { from: 'laboratory.pgt', to: 'transfer.preparation', trigger: 'pgt_results_available' },
    
    // Transfer phase
    { from: 'transfer.preparation', to: 'transfer.transfer_day', trigger: 'endometrium_ready' },
    { from: 'transfer.transfer_day', to: 'transfer.luteal_support', trigger: 'transfer_complete' },
    { from: 'transfer.luteal_support', to: 'pregnancy_test', trigger: 'luteal_phase_start' },
    
    // Pregnancy test
    { from: 'pregnancy_test', to: 'follow_up.early_pregnancy', trigger: 'beta_positive' },
    { from: 'pregnancy_test', to: 'follow_up.graduation', trigger: 'beta_negative' }, // Cycle review then graduation
    
    // Follow-up
    { from: 'follow_up.early_pregnancy', to: 'follow_up.graduation', trigger: 'viability_confirmed' },
    { from: 'follow_up.graduation', to: 'completed', trigger: 'handoff_complete' },
    
    // Cancellation paths (from any state)
    { from: 'pre_treatment.consultation', to: 'cancelled', trigger: 'cancel' },
    { from: 'pre_treatment.testing', to: 'cancelled', trigger: 'cancel' },
    { from: 'pre_treatment.authorization', to: 'cancelled', trigger: 'cancel' },
    { from: 'stimulation.monitoring', to: 'cancelled', trigger: 'cancel' },
    { from: 'stimulation.trigger', to: 'cancelled', trigger: 'cancel' },
    { from: 'retrieval', to: 'cancelled', trigger: 'cancel' },
    { from: 'laboratory.fertilization', to: 'cancelled', trigger: 'cancel' },
    { from: 'laboratory.culture', to: 'cancelled', trigger: 'cancel' },
    { from: 'laboratory.pgt', to: 'cancelled', trigger: 'cancel' },
    { from: 'transfer.preparation', to: 'cancelled', trigger: 'cancel' },
    { from: 'transfer.transfer_day', to: 'cancelled', trigger: 'cancel' },
    { from: 'transfer.luteal_support', to: 'cancelled', trigger: 'cancel' },
    { from: 'pregnancy_test', to: 'cancelled', trigger: 'cancel' },
    { from: 'follow_up.early_pregnancy', to: 'cancelled', trigger: 'cancel' },
    { from: 'follow_up.graduation', to: 'cancelled', trigger: 'cancel' },
  ] as StateTransition[],
  taskTransitions: [
    // Canonical task lifecycle — the engine (TaskOrchestrator / WorkflowEngine)
    // sets `claimed` on claim, so the state machine models the same lifecycle.
    { from: 'draft', to: 'requested', trigger: 'activate' },
    { from: 'requested', to: 'received', trigger: 'assign' },
    { from: 'requested', to: 'claimed', trigger: 'claim' },
    { from: 'received', to: 'claimed', trigger: 'claim' },
    { from: 'claimed', to: 'in_progress', trigger: 'start' },
    { from: 'claimed', to: 'completed', trigger: 'complete' },
    { from: 'in_progress', to: 'completed', trigger: 'complete' },

    // Failure/cancellation from any active state
    { from: 'draft', to: 'cancelled', trigger: 'cancel' },
    { from: 'requested', to: 'cancelled', trigger: 'cancel' },
    { from: 'received', to: 'cancelled', trigger: 'cancel' },
    { from: 'claimed', to: 'cancelled', trigger: 'cancel' },
    { from: 'in_progress', to: 'cancelled', trigger: 'cancel' },
    { from: 'in_progress', to: 'failed', trigger: 'fail' },

    // Escalation
    { from: 'requested', to: 'escalated', trigger: 'escalate' },
    { from: 'received', to: 'escalated', trigger: 'escalate' },
    { from: 'claimed', to: 'escalated', trigger: 'escalate' },
    { from: 'in_progress', to: 'escalated', trigger: 'escalate' },
    { from: 'escalated', to: 'received', trigger: 'reassign' },
  ] as StateTransition[],
};

export const stateMachine = new StateMachine(defaultStateMachineConfig);