/**
 * Wave 8 — Workflow & Automation Engine
 * Decision Processor — Approval decision handling
 */

import type {
  ApprovalDecision,
  ApprovalGate,
  ApprovalDecisionRequest,
  Actor,
} from '../types';
import { approvalGateService } from './approval-gate';

export interface DecisionProcessorConfig {
  // approvalGate: ApprovalGateService;
  // notificationBridge: NotificationBridge;
  // workflowEngine: WorkflowEngine;
}

export class DecisionProcessor {
  // private approvalGate: ApprovalGateService;
  // private notificationBridge: NotificationBridge;
  // private workflowEngine: WorkflowEngine;

  constructor(config: DecisionProcessorConfig) {
    // this.approvalGate = config.approvalGate;
    // this.notificationBridge = config.notificationBridge;
    // this.workflowEngine = config.workflowEngine;
  }

  /**
   * Process an approval decision request
   */
  async processDecision(
    gateId: string,
    request: ApprovalDecisionRequest
  ): Promise<ApprovalDecision> {
    // Delegate to approval gate service
    const decision = await approvalGateService.processDecision(gateId, request);
    
    // Handle post-decision actions
    await this.handlePostDecision(gateId, decision, request);
    
    return decision;
  }

  /**
   * Handle post-decision workflow
   */
  private async handlePostDecision(
    gateId: string,
    decision: ApprovalDecision,
    request: ApprovalDecisionRequest
  ): Promise<void> {
    const gate = await approvalGateService.getGate(gateId);
    if (!gate) return;

    switch (decision.decision) {
      case 'approve':
        await this.handleApproval(gate, decision);
        break;
      case 'deny':
        await this.handleDenial(gate, decision);
        break;
      case 'escalate':
        await this.handleEscalation(gate, decision);
        break;
    }
  }

  /**
   * Handle approval - trigger workflow continuation
   */
  private async handleApproval(gate: ApprovalGate, decision: ApprovalDecision): Promise<void> {
    // Notify task assignee
    // await this.notificationBridge.onTaskApproved(gate.taskInstanceId, decision);
    
    // Trigger workflow engine to evaluate transitions
    // await this.workflowEngine.onApprovalApproved(gate);
    
    // If this was an override, log it
    if (decision.evidenceReviewed?.override === true) {
      // await this.auditBridge.logOverride(gate.taskInstanceId, decision);
    }
  }

  /**
   * Handle denial - stop workflow or request modification
   */
  private async handleDenial(gate: ApprovalGate, decision: ApprovalDecision): Promise<void> {
    // Notify task assignee
    // await this.notificationBridge.onTaskDenied(gate.taskInstanceId, decision);
    
    // If denial requires modification, create modification task
    // await this.workflowEngine.onTaskDenied(gate, decision);
  }

  /**
   * Handle escalation - route to backup approver
   */
  private async handleEscalation(gate: ApprovalGate, decision: ApprovalDecision): Promise<void> {
    // Find backup approvers
    // const backups = await this.getBackupApprovers(gate);
    
    // Notify backups
    // for (const backup of backups) {
    //   await this.notificationBridge.onEscalationNeeded(gate, backup);
    // }
    
    // Update gate status
    // gate.status = 'escalated';
    // await this.approvalGate.updateGate(gate);
  }

  /**
   * Get backup approvers for escalation
   */
  private async getBackupApprovers(gate: ApprovalGate): Promise<Actor[]> {
    // Would query user service for users with appropriate role
    // who are not the original approver
    return [];
  }

  /**
   * Batch process decisions (for efficiency)
   */
  async batchProcessDecisions(
    decisions: Array<{ gateId: string; request: ApprovalDecisionRequest }>
  ): Promise<ApprovalDecision[]> {
    const results: ApprovalDecision[] = [];
    
    for (const { gateId, request } of decisions) {
      try {
        const decision = await this.processDecision(gateId, request);
        results.push(decision);
      } catch (error) {
        // Log error but continue processing
        console.error(`Failed to process decision for gate ${gateId}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Auto-approve low-risk tasks (configurable)
   */
  async autoApproveIfLowRisk(gateId: string): Promise<boolean> {
    const gate = await approvalGateService.getGate(gateId);
    if (!gate || gate.status !== 'pending') return false;

    // Check if auto-approval is enabled for this task type
    // const task = await this.taskStore.getTask(gate.taskInstanceId);
    // if (!task) return false;
    
    // Auto-approve routine tasks with high-confidence rule recommendations
    // if (task.priority === 'routine' && gate.evidencePack.ruleEvaluation?.confidence === 'HIGH') {
    //   await this.processDecision(gateId, {
    //     decision: 'approve',
    //     approver: { type: 'system', id: 'auto-approval' },
    //     reason: 'Auto-approved: routine task with high-confidence rule recommendation',
    //   });
    //   return true;
    // }
    
    return false;
  }
}

export const decisionProcessor = new DecisionProcessor({});