/**
 * Wave 8 — Workflow & Automation Engine
 * Transition Validator — Deterministic guard evaluation
 */

import type {
  WorkflowInstance,
  WorkflowContext,
  TaskInstance,
  JourneyState,
  TaskState,
  Actor,
  RuleResult,
} from '../types';
import { stateMachine } from './state-machine';

export interface TransitionCheckResult {
  valid: boolean;
  reason?: string;
  requiredActions?: string[];
}

export interface GuardEvaluationContext {
  workflowInstance: WorkflowInstance;
  workflowContext: WorkflowContext;
  completedTaskIds: string[];
  approvedGateIds: string[];
  ruleResults: RuleResult[];
  actor: Actor;
}

export class TransitionValidator {
  /**
   * Validate a journey state transition with all guards
   */
  async validateJourneyTransition(
    context: GuardEvaluationContext,
    targetState: JourneyState
  ): Promise<TransitionCheckResult> {
    // 1. Check state machine transition exists
    const smResult = stateMachine.canTransitionJourney(
      context.workflowInstance,
      targetState,
      context.workflowContext,
      context.completedTaskIds,
      context.approvedGateIds
    );

    if (!smResult.valid) {
      return { valid: false, reason: smResult.reason };
    }

    // 2. Evaluate FEEL condition if present
    if (smResult.transition?.condition) {
      const conditionResult = await this.evaluateCondition(
        smResult.transition.condition,
        context
      );
      if (!conditionResult.valid) {
        return conditionResult;
      }
    }

    // 3. Check for any blocking conditions
    const blockingChecks = await this.checkBlockingConditions(context, targetState);
    if (!blockingChecks.valid) {
      return blockingChecks;
    }

    return { valid: true };
  }

  /**
   * Validate a task state transition with all guards
   */
  async validateTaskTransition(
    task: TaskInstance,
    targetState: TaskState,
    actor: Actor,
    workflowContext: WorkflowContext
  ): Promise<TransitionCheckResult> {
    // 1. Check state machine transition exists
    const smResult = stateMachine.canTransitionTask(task, targetState, actor);

    if (!smResult.valid) {
      return { valid: false, reason: smResult.reason };
    }

    // 2. Additional guards for specific transitions
    switch (targetState) {
      case 'claimed':
        return this.validateClaim(task, actor);
      case 'in_progress':
        return this.validateStart(task, actor);
      case 'completed':
        return this.validateComplete(task, actor, workflowContext);
      case 'escalated':
        return this.validateEscalate(task, actor);
      case 'received':
        return this.validateReassign(task, actor);
    }

    return { valid: true };
  }

  /**
   * Evaluate a workflow condition expression.
   *
   * Supports the deterministic FEEL subset actually used by workflow
   * transitions (boolean equality/inequality against workflow context):
   *   context.<var> === <bool|string|number>
   *   context.<var> !== <bool|string|number>
   *
   * Unsupported expressions fail closed (valid=false) rather than silently
   * passing — a placeholder-free guard. Full DMN/FEEL rule evaluation remains
   * a deferred Wave 8 capability (see ARCHITECTURAL_DECISIONS.md).
   */
  private async evaluateCondition(
    expression: string,
    context: GuardEvaluationContext
  ): Promise<TransitionCheckResult> {
    const result = evaluateSimpleCondition(expression, context.workflowContext);
    if (result === null) {
      return { valid: false, reason: `Unsupported condition expression: ${expression}` };
    }
    return result ? { valid: true } : { valid: false, reason: `Condition not satisfied: ${expression}` };
  }

  /**
   * Check for blocking conditions (safety rules for clinical transitions).
   *
   * NOTE: Patient-consent gating for write operations is intentionally not
   * enforced here — the deleted bridge was removed and ConsentEngine
   * integration is a deferred Wave 8 item requiring separate platform
   * approval (see ARCHITECTURAL_DECISIONS.md). No silent pass-through is left
   * in place; the consent gate will be re-introduced when wired to a real
   * consent owner.
   */
  private async checkBlockingConditions(
    context: GuardEvaluationContext,
    targetState: JourneyState
  ): Promise<TransitionCheckResult> {
    // Check safety rules for clinical transitions
    if (this.isClinicalTransition(targetState)) {
      const safetyCheck = await this.checkSafetyRules(context, targetState);
      if (!safetyCheck.valid) {
        return safetyCheck;
      }
    }

    return { valid: true };
  }

  /**
   * Validate task claim
   */
  private validateClaim(task: TaskInstance, actor: Actor): TransitionCheckResult {
    if (task.assigneeId && task.assigneeId !== actor.id) {
      return { valid: false, reason: 'Task already claimed' };
    }
    if (task.status !== 'requested' && task.status !== 'received') {
      return { valid: false, reason: 'Task not in claimable state' };
    }
    return { valid: true };
  }

  /**
   * Validate task start
   */
  private validateStart(task: TaskInstance, actor: Actor): TransitionCheckResult {
    if (task.assigneeId && task.assigneeId !== actor.id) {
      return { valid: false, reason: 'Task assigned to another user' };
    }
    if (task.status !== 'accepted' && task.status !== 'claimed') {
      return { valid: false, reason: 'Task must be accepted or claimed first' };
    }
    return { valid: true };
  }

  /**
   * Validate task completion
   */
  private validateComplete(
    task: TaskInstance, 
    actor: Actor, 
    workflowContext: WorkflowContext
  ): TransitionCheckResult {
    if (task.assigneeId && task.assigneeId !== actor.id && actor.type !== 'system') {
      return { valid: false, reason: 'Task assigned to another user' };
    }
    if (task.status !== 'in_progress') {
      return { valid: false, reason: 'Task not in progress' };
    }
    
    // Check required output fields based on task definition
    // This would be driven by the task definition's outputSchema
    return { valid: true };
  }

  /**
   * Validate task escalation
   */
  private validateEscalate(task: TaskInstance, actor: Actor): TransitionCheckResult {
    if (task.status === 'completed' || task.status === 'cancelled' || task.status === 'failed') {
      return { valid: false, reason: 'Cannot escalate completed or terminal task' };
    }
    return { valid: true };
  }

  /**
   * Validate task reassignment
   */
  private validateReassign(task: TaskInstance, actor: Actor): TransitionCheckResult {
    if (task.status !== 'escalated') {
      return { valid: false, reason: 'Can only reassign escalated tasks' };
    }
    return { valid: true };
  }

  /**
   * Check if transition is clinical (requires safety validation)
   */
  private isClinicalTransition(state: JourneyState): boolean {
    const clinicalStates: JourneyState[] = [
      'stimulation.trigger',
      'retrieval',
      'laboratory.fertilization',
      'transfer.transfer_day',
      'pregnancy_test',
    ];
    return clinicalStates.includes(state);
  }

  /**
   * Check safety rules for clinical transitions
   */
  private async checkSafetyRules(
    context: GuardEvaluationContext,
    targetState: JourneyState
  ): Promise<TransitionCheckResult> {
    // Safety rules that must pass for clinical transitions
    const safetyRules: Partial<Record<JourneyState, (ctx: GuardEvaluationContext) => Promise<boolean>>> = {
      'stimulation.trigger': async (ctx) => {
        // OHSS risk check
        const estradiol = ctx.workflowContext.estradiolPgml || 0;
        const cohort = (ctx.workflowContext.monitoringData || []).filter(m => m.cohortCount > 0).length;
        if (estradiol > 5000 && cohort > 10) {
          return false; // High OHSS risk - requires physician override
        }
        return true;
      },
      'retrieval': async (ctx) => {
        // Must have trigger administered
        return true; // Placeholder
      },
      'transfer.transfer_day': async (ctx) => {
        // Endometrial thickness check
        const lining = ctx.workflowContext.monitoringData?.[0]?.endometrialMm || 0;
        if (lining < 7) {
          return false; // Thin lining - requires physician decision
        }
        return true;
      },
      'pregnancy_test': async () => true,
      'laboratory.fertilization': async () => true,
    };

    const check = safetyRules[targetState];
    if (check) {
      const safe = await check(context);
      if (!safe) {
        return { 
          valid: false, 
          reason: `Safety check failed for ${targetState}`,
          requiredActions: ['physician_override', 'document_reason']
        };
      }
    }

    return { valid: true };
  }
}

export const transitionValidator = new TransitionValidator();

/**
 * Deterministic subset evaluator for workflow transition conditions.
 *
 * Supported grammar (FEEL subset):
 *   context.<name> === <literal>     |  context.<name> !== <literal>
 *   <name> === <literal>             |  <name> !== <literal>
 * where <literal> is a boolean, quoted string, or number, and <name>
 * resolves against the workflow's variable set (top-level context fields
 * take precedence over the `variables` map).
 *
 * Returns true/false on success, or null when the expression is not
 * supported (caller must fail closed).
 */
function evaluateSimpleCondition(expression: string, context: WorkflowContext): boolean | null {
  const trimmed = expression.trim();
  const match = /^(?:context\.)?([A-Za-z_][A-Za-z0-9_]*)\s*(===|!==)\s*(.+)$/.exec(trimmed);
  if (!match) return null;

  const [, name, op, rawValue] = match;
  const value = parseLiteral(rawValue.trim());
  if (value === undefined) return null;

  const actual = resolveContextValue(context, name);
  const equal = actual === value;

  return op === '===' ? equal : !equal;
}

function parseLiteral(raw: string): string | number | boolean | undefined {
  if (raw === 'true' || raw === 'false') return raw === 'true';
  if (/^['"].*['"]$/.test(raw)) return raw.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return undefined;
}

function resolveContextValue(context: WorkflowContext, name: string): unknown {
  const self = context as unknown as Record<string, unknown>;
  if (name in self && self[name] !== undefined) return self[name];
  const vars = self['variables'] as Record<string, unknown> | undefined;
  if (vars && name in vars) return vars[name];
  return undefined;
}