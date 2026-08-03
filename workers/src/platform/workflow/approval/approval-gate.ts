/**
 * Wave 8 — Workflow & Automation Engine
 * Approval Gate — Human-in-the-loop approval logic backed by D1
 *
 * Uses the `approval_gates` table defined in migration 0010_workflow_engine.sql.
 * If an EventStore is provided, approval.requested / approval.decided events
 * are appended with correlationId = workflow_instance_id.
 */

import type {
  ApprovalGate as ApprovalGateType,
  ApprovalDecision,
  ApprovalStatus,
  EvidencePack,
  TaskInstance,
  Actor,
  WorkflowInstance,
  WorkflowEvent,
  EventType,
  RuleResult,
  ApprovalDecisionRequest,
} from '../types';
import { EventStore } from '../events/event-store';

export interface ApprovalGateConfig {
  db: D1Database;
  eventStore?: EventStore;
}

interface ApprovalGateRow {
  id: string;
  workflow_instance_id: string;
  task_instance_id: string | null;
  gate_definition_id: string;
  status: string;
  required_approvers: number;
  approved_by: string;
  denied_by: string;
  evidence_pack: string;
  decision: string | null;
  decision_reason: string | null;
  decided_at: number | null;
  decided_by: string | null;
  created_at: number;
  updated_at: number;
}

export class ApprovalGateService {
  private db: D1Database;
  private eventStore?: EventStore;

  constructor(config: ApprovalGateConfig) {
    this.db = config.db;
    this.eventStore = config.eventStore;
  }

  /**
   * Create an approval gate for a task
   */
  async createApprovalGate(
    task: TaskInstance,
    workflowInstance: WorkflowInstance,
    evidencePack: EvidencePack,
    requiredApprovers: number = 1,
    approvalRule?: string,
    timeoutMs: number = 24 * 60 * 60 * 1000 // 24 hours default
  ): Promise<ApprovalGateType> {
    const now = Date.now();
    const id = crypto.randomUUID();
    const gateDefinitionId = task.taskDefinitionId;

    await this.db
      .prepare(
        `INSERT INTO approval_gates
          (id, workflow_instance_id, task_instance_id, gate_definition_id, status,
           required_approvers, approved_by, denied_by, evidence_pack, decision,
           decision_reason, decided_at, decided_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        workflowInstance.id,
        task.id,
        gateDefinitionId,
        'pending',
        requiredApprovers,
        '[]',
        '[]',
        JSON.stringify(evidencePack),
        null,
        null,
        null,
        null,
        now,
        now
      )
      .run();

    const gate: ApprovalGateType = {
      id,
      taskInstanceId: task.id,
      requiredApprovers,
      approvalRule,
      evidencePack,
      status: 'pending',
      decidedAt: undefined,
      decidedBy: undefined,
      decisionReason: undefined,
    };

    // Append approval.requested event if an event store is configured
    if (this.eventStore) {
      await this.appendApprovalEvent(
        'approval.requested',
        workflowInstance.id,
        { type: 'system', id: 'system' },
        { gateId: id, taskInstanceId: task.id, workflowInstanceId: workflowInstance.id }
      );
    }

    return gate;
  }

  /**
   * Get approval gate by ID
   */
  async getGate(gateId: string): Promise<ApprovalGateType | null> {
    const result = await this.db
      .prepare(`SELECT * FROM approval_gates WHERE id = ?`)
      .bind(gateId)
      .all<ApprovalGateRow>();

    const row = (result.results || [])[0];
    return row ? this.mapRowToApprovalGate(row) : null;
  }

  /**
   * Process an approval decision
   */
  async processDecision(gateId: string, request: ApprovalDecisionRequest): Promise<ApprovalDecision> {
    const gate = await this.getGate(gateId);
    if (!gate) {
      throw new Error(`Approval gate not found: ${gateId}`);
    }

    if (gate.status !== 'pending') {
      throw new Error(`Gate already decided: ${gate.status}`);
    }

    const decision: ApprovalDecision = {
      id: crypto.randomUUID(),
      approvalGateId: gateId,
      approverId: request.approver.id,
      decision: request.decision,
      reason: request.reason,
      evidenceReviewed: request.evidenceReviewed,
      createdAt: Date.now(),
    };

    let newStatus: ApprovalStatus = 'pending';
    if (request.decision === 'approve') {
      newStatus = 'approved';
    } else if (request.decision === 'deny') {
      newStatus = 'denied';
    } else if (request.decision === 'escalate') {
      newStatus = 'escalated';
    }

    const row = await this.getGateRow(gateId);

    // Track who approved / denied
    let approvedBy: string[] = [];
    let deniedBy: string[] = [];
    if (row) {
      try {
        approvedBy = JSON.parse(row.approved_by);
        deniedBy = JSON.parse(row.denied_by);
      } catch {
        // Malformed JSON defaults to empty arrays
      }
    }
    if (request.decision === 'approve') {
      if (!approvedBy.includes(request.approver.id)) approvedBy.push(request.approver.id);
    } else if (request.decision === 'deny') {
      if (!deniedBy.includes(request.approver.id)) deniedBy.push(request.approver.id);
    }

    const now = Date.now();
    await this.db
      .prepare(
        `UPDATE approval_gates
         SET status = ?, approved_by = ?, denied_by = ?, decision = ?, decision_reason = ?,
             decided_at = ?, decided_by = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(
        newStatus,
        JSON.stringify(approvedBy),
        JSON.stringify(deniedBy),
        request.decision,
        request.reason || null,
        now,
        request.approver.id,
        now,
        gateId
      )
      .run();

    gate.status = newStatus;
    gate.decidedAt = now;
    gate.decidedBy = request.approver.id;
    gate.decisionReason = request.reason;

    // Append approval.decided event if an event store is configured
    if (this.eventStore && row) {
      await this.appendApprovalEvent(
        'approval.decided',
        row.workflow_instance_id,
        request.approver,
        { gateId, decision: request.decision, reason: request.reason, approverId: request.approver.id }
      );
    }

    return decision;
  }

  /**
   * Handle approval timeout (escalation)
   */
  async handleTimeout(gateId: string): Promise<void> {
    const gate = await this.getGate(gateId);
    if (!gate || gate.status !== 'pending') return;

    const row = await this.getGateRow(gateId);
    const now = Date.now();
    await this.db
      .prepare(
        `UPDATE approval_gates
         SET status = ?, decision = ?, decision_reason = ?, decided_at = ?, decided_by = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind('escalated', 'escalate', 'Approval timed out', now, 'system', now, gateId)
      .run();

    if (this.eventStore && row) {
      await this.appendApprovalEvent(
        'approval.decided',
        row.workflow_instance_id,
        { type: 'system', id: 'system' },
        { gateId, decision: 'escalate', reason: 'Approval timed out', approverId: 'system' }
      );
    }
  }

  /**
   * Get approved gates for a workflow
   */
  async getApprovedGatesForWorkflow(workflowInstanceId: string): Promise<ApprovalGateType[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM approval_gates
         WHERE workflow_instance_id = ? AND status = 'approved'
         ORDER BY decided_at ASC`
      )
      .bind(workflowInstanceId)
      .all<ApprovalGateRow>();

    return (result.results || []).map(row => this.mapRowToApprovalGate(row));
  }

  /**
   * Get pending gates for an approver
   */
  async getPendingGatesForApprover(approverId: string): Promise<ApprovalGateType[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM approval_gates
         WHERE status = 'pending' AND denied_by != ?
         ORDER BY created_at ASC`
      )
      .bind('[]')
      .all<ApprovalGateRow>();

    // Approver has not yet recorded a decision on any pending gate
    return (result.results || [])
      .filter(row => {
        let approvedBy: string[] = [];
        let deniedBy: string[] = [];
        try {
          approvedBy = JSON.parse(row.approved_by);
          deniedBy = JSON.parse(row.denied_by);
        } catch {
          // Ignore malformed JSON
        }
        return !approvedBy.includes(approverId) && !deniedBy.includes(approverId);
      })
      .map(row => this.mapRowToApprovalGate(row));
  }

  /**
   * Build evidence pack from task and context
   */
  buildEvidencePack(
    task: TaskInstance,
    workflowInstance: WorkflowInstance,
    clinicalContext: Record<string, unknown>,
    ruleResult?: RuleResult
  ): EvidencePack {
    return {
      taskSummary: {
        id: task.id,
        name: task.name,
        type: task.type,
        priority: task.priority,
        createdAt: task.createdAt,
        slaDeadline: task.slaDeadline,
      },
      clinicalContext: {
        patientRef: workflowInstance.patientId,
        journeyState: workflowInstance.currentState,
        currentDay: workflowInstance.context.currentDay,
        keyMetrics: {
          leadFollicleMm: workflowInstance.context.leadFollicleMm,
          estradiolPgml: workflowInstance.context.estradiolPgml,
        },
        recentEvents: [],
      },
      ruleEvaluation: ruleResult,
      patientPreferences: {
        language: workflowInstance.context.language || 'en-CA',
        communicationMethod: 'portal',
        decisionMakingStyle: 'shared',
      },
      riskAssessment: this.assessRisk(task),
      alternatives: this.generateAlternatives(),
      requiredApprovers: 1,
      deadline: task.slaDeadline || Date.now() + 24 * 60 * 60 * 1000,
    };
  }

  /**
   * Assess risk level for approval
   */
  private assessRisk(task: TaskInstance): 'low' | 'medium' | 'high' | 'critical' {
    if (task.priority === 'critical') return 'critical';
    if (task.priority === 'urgent') return 'high';

    // Clinical decisions are higher risk
    const clinicalTasks = ['trigger', 'transfer', 'retrieval', 'pgt', 'protocol'];
    if (clinicalTasks.some(t => task.name.toLowerCase().includes(t))) {
      return 'high';
    }

    return 'medium';
  }

  /**
   * Generate alternatives for approval decision
   */
  private generateAlternatives(): Array<{
    id: string;
    description: string;
    pros: string[];
    cons: string[];
    recommended: boolean;
  }> {
    return [
      {
        id: 'proceed',
        description: 'Proceed as recommended',
        pros: ['Evidence-based', 'Standard protocol'],
        cons: ['Standard risks apply'],
        recommended: true,
      },
      {
        id: 'modify',
        description: 'Modify parameters',
        pros: ['Personalized', 'Addresses concerns'],
        cons: ['Requires additional review'],
        recommended: false,
      },
      {
        id: 'defer',
        description: 'Defer decision',
        pros: ['More data', 'Second opinion'],
        cons: ['Delays treatment', 'May miss window'],
        recommended: false,
      },
    ];
  }

  /**
   * Fetch a raw approval_gates row by ID
   */
  private async getGateRow(gateId: string): Promise<ApprovalGateRow | null> {
    const result = await this.db
      .prepare(`SELECT * FROM approval_gates WHERE id = ?`)
      .bind(gateId)
      .all<ApprovalGateRow>();
    return (result.results || [])[0] || null;
  }

  /**
   * Map a database row to an ApprovalGate
   */
  private mapRowToApprovalGate(row: ApprovalGateRow): ApprovalGateType {
    let evidencePack: EvidencePack;
    try {
      evidencePack = JSON.parse(row.evidence_pack);
    } catch {
      evidencePack = this.defaultEvidencePack();
    }

    return {
      id: row.id,
      taskInstanceId: row.task_instance_id || '',
      requiredApprovers: row.required_approvers,
      evidencePack,
      status: row.status as ApprovalStatus,
      decidedAt: row.decided_at === null ? undefined : row.decided_at,
      decidedBy: row.decided_by === null ? undefined : row.decided_by,
      decisionReason: row.decision_reason === null ? undefined : row.decision_reason,
    };
  }

  private defaultEvidencePack(): EvidencePack {
    return {
      taskSummary: {
        id: '',
        name: '',
        type: 'manual',
        priority: 'routine',
        createdAt: 0,
      },
      clinicalContext: {
        patientRef: '',
        journeyState: 'pre_treatment.consultation',
        keyMetrics: {},
        recentEvents: [],
      },
      riskAssessment: 'medium',
      alternatives: [],
      requiredApprovers: 1,
      deadline: Date.now(),
    };
  }

  /**
   * Append an approval event scoped to the workflow instance
   */
  private async appendApprovalEvent(
    eventType: EventType,
    workflowInstanceId: string,
    actor: Actor,
    payload: Record<string, unknown>
  ): Promise<void> {
    if (!this.eventStore) return;

    const event: Omit<WorkflowEvent, 'id'> = {
      workflowInstanceId,
      eventType,
      payload,
      actor,
      correlationId: workflowInstanceId,
      causationId: undefined,
      timestamp: Date.now(),
      version: 1,
    };

    await this.eventStore.append(event);
  }
}

let approvalGateServiceInstance: ApprovalGateService | null = null;

/**
 * Lazy singleton accessor for the ApprovalGateService.
 * Must be initialised once with a configured instance before first use.
 */
export function getApprovalGateService(): ApprovalGateService {
  if (!approvalGateServiceInstance) {
    throw new Error(
      'ApprovalGateService has not been initialised. Call setApprovalGateService(config) first.'
    );
  }
  return approvalGateServiceInstance;
}

/**
 * Initialise the ApprovalGateService singleton with a D1-backed config.
 * Calling this again replaces the existing instance.
 */
export function setApprovalGateService(config: ApprovalGateConfig): ApprovalGateService {
  approvalGateServiceInstance = new ApprovalGateService(config);
  return approvalGateServiceInstance;
}

/**
 * Lazily-initialised singleton instance. Methods delegate to getApprovalGateService()
 * so downstream consumers can keep their existing call sites. Initialise via
 * setApprovalGateService(config) before first use.
 */
export const approvalGateService: ApprovalGateService = new Proxy({} as ApprovalGateService, {
  get(_target, prop: keyof ApprovalGateService) {
    const instance = getApprovalGateService();
    const value = Reflect.get(instance, prop);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

