/**
 * Wave 8 — Workflow & Automation Engine
 * Projection Engine — CQRS read model projections
 */

import type {
  WorkflowEvent,
  EventType,
  WorkflowInstance,
  TaskInstance,
  TaskState,
  TaskPriority,
  JourneyState,
  WorkflowStatus,
  DashboardQueueResponse,
  CoordinatorWorkload,
  OperationalMetrics,
  ClinicalMetrics,
  QualityMetrics,
} from '../types';
import { eventReader } from './event-reader';

export interface ProjectionEngineConfig {
  // db: D1Database;
}

export class ProjectionEngine {
  // private db: D1Database;

  constructor(config: ProjectionEngineConfig) {
    // this.db = config.db;
  }

  /**
   * Build WorkflowInstanceView from events
   */
  async buildWorkflowInstanceView(workflowInstanceId: string): Promise<WorkflowInstance | null> {
    const events = await eventReader.getWorkflowTimeline(workflowInstanceId);
    if (events.length === 0) return null;

    // Replay events to build current state
    let instance: Partial<WorkflowInstance> = {
      id: workflowInstanceId,
      currentState: 'pre_treatment.consultation',
      status: 'running',
      context: {} as any,
    };

    for (const event of events) {
      this.applyEventToInstance(instance, event);
    }

    return instance as WorkflowInstance;
  }

  /**
   * Apply single event to instance projection
   */
  private applyEventToInstance(instance: Partial<WorkflowInstance>, event: WorkflowEvent): void {
    switch (event.eventType) {
      case 'workflow.started':
        instance.definitionId = event.payload.definitionId as string;
        instance.patientId = event.payload.patientId as string;
        instance.createdAt = event.timestamp;
        break;
      case 'workflow.state_changed':
        instance.currentState = event.payload.toState as JourneyState;
        instance.updatedAt = event.timestamp;
        break;
      case 'workflow.paused':
        instance.status = 'paused';
        instance.pausedAt = event.timestamp;
        instance.pauseReason = event.payload.reason as string;
        break;
      case 'workflow.resumed':
        instance.status = 'running';
        instance.pausedAt = undefined;
        instance.pauseReason = undefined;
        instance.updatedAt = event.timestamp;
        break;
      case 'workflow.completed':
        instance.status = 'completed';
        instance.completedAt = event.timestamp;
        instance.currentState = 'completed';
        break;
      case 'workflow.cancelled':
        instance.status = 'cancelled';
        instance.completedAt = event.timestamp;
        instance.currentState = 'cancelled';
        break;
    }
  }

  /**
   * Build TaskQueueView for dashboard
   */
  async buildTaskQueueView(filters: {
    assigneeId?: string;
    assigneeRole?: string;
    status?: TaskState[];
    priority?: TaskPriority[];
  }): Promise<DashboardQueueResponse> {
    // Would query task_instances table with filters
    // For now, return empty structure
    return {
      myTasks: [],
      teamTasks: [],
      escalations: [],
      slaAtRisk: [],
      stats: {
        activeWorkflows: 0,
        tasksCompletedToday: 0,
        slaCompliance24h: 100,
        escalationsOpen: 0,
        avgResponseTimeHours: 0,
        workloadByCoordinator: [],
      },
    };
  }

  /**
   * Build PatientJourneyView for patient portal
   */
  async buildPatientJourneyView(workflowInstanceId: string): Promise<any> {
    const events = await eventReader.getWorkflowTimeline(workflowInstanceId);
    
    const milestones = events
      .filter(e => e.eventType === 'workflow.state_changed')
      .map(e => ({
        state: e.payload.toState,
        timestamp: e.timestamp,
        trigger: e.payload.trigger,
      }));

    const currentState = milestones[milestones.length - 1]?.state as JourneyState || 'pre_treatment.consultation';

    return {
      workflowInstanceId,
      currentState,
      milestones,
      progress: this.calculateProgress(currentState),
      nextSteps: this.getNextSteps(currentState),
    };
  }

  /**
   * Calculate journey progress percentage
   */
  private calculateProgress(state: JourneyState): number {
    const stateOrder: JourneyState[] = [
      'pre_treatment.consultation',
      'pre_treatment.testing',
      'pre_treatment.authorization',
      'stimulation.monitoring',
      'stimulation.trigger',
      'retrieval',
      'laboratory.fertilization',
      'laboratory.culture',
      'laboratory.pgt',
      'transfer.preparation',
      'transfer.transfer_day',
      'transfer.luteal_support',
      'pregnancy_test',
      'follow_up.early_pregnancy',
      'follow_up.graduation',
      'completed',
    ];

    const index = stateOrder.indexOf(state);
    if (index === -1) return 0;
    return Math.round((index / (stateOrder.length - 1)) * 100);
  }

  /**
   * Get next steps for patient
   */
  private getNextSteps(state: JourneyState): string[] {
    const nextSteps: Record<JourneyState, string[]> = {
      'pre_treatment.consultation': ['Complete initial consultation', 'Schedule testing'],
      'pre_treatment.testing': ['Complete all tests', 'Review results with physician'],
      'pre_treatment.authorization': ['Insurance authorization', 'Schedule cycle start'],
      'stimulation.monitoring': ['Daily monitoring appointments', 'Medication adjustments'],
      'stimulation.trigger': ['Trigger medication administration', 'Egg retrieval scheduling'],
      'retrieval': ['Egg retrieval procedure', 'Recovery'],
      'laboratory.fertilization': ['Fertilization check', 'Embryo culture updates'],
      'laboratory.culture': ['Embryo development updates', 'Day 5 blastocyst grading'],
      'laboratory.pgt': ['PGT biopsy', 'Genetic results'],
      'transfer.preparation': ['Endometrial preparation', 'Transfer scheduling'],
      'transfer.transfer_day': ['Embryo transfer procedure', 'Luteal support start'],
      'transfer.luteal_support': ['Medication adherence', 'Pregnancy test scheduling'],
      'pregnancy_test': ['Beta hCG blood test', 'Result review'],
      'follow_up.early_pregnancy': ['Serial beta hCG tests', 'Viability ultrasound'],
      'follow_up.graduation': ['OB handoff', 'Discharge from fertility clinic'],
      'completed': [],
      'cancelled': ['Discuss next steps with care team'],
    };

    return nextSteps[state] || [];
  }

  /**
   * Build OperationalMetricsView (daily rollup)
   */
  async buildOperationalMetrics(date: string): Promise<OperationalMetrics> {
    // Would aggregate from workflow_events and task_instances
    return {
      date,
      workflowsStarted: 0,
      workflowsCompleted: 0,
      workflowsFailed: 0,
      tasksCreated: 0,
      tasksCompleted: 0,
      tasksEscalated: 0,
      slaComplianceRate: 100,
      avgTaskDurationMs: {
        critical: 0,
        urgent: 0,
        high: 0,
        routine: 0,
      },
      queueDepthByPriority: {
        critical: 0,
        urgent: 0,
        high: 0,
        routine: 0,
      },
    };
  }

  /**
   * Build ClinicalMetricsView (daily rollup)
   */
  async buildClinicalMetrics(date: string): Promise<ClinicalMetrics> {
    return {
      date,
      cyclesStarted: 0,
      cyclesCompleted: 0,
      cancellations: 0,
      cancellationReasons: {},
      protocolDistribution: {},
      pregnancyRates: {},
      timeToTreatmentDays: 0,
    };
  }

  /**
   * Build QualityMetricsView (weekly rollup)
   */
  async buildQualityMetrics(week: string): Promise<QualityMetrics> {
    return {
      week,
      overrideCount: 0,
      overrideReasons: {},
      ruleDeviations: 0,
      approvalTurnaroundHours: 0,
      communicationResponseHours: 0,
    };
  }

  /**
   * Rebuild all projections for a workflow instance
   */
  async rebuildProjections(workflowInstanceId: string): Promise<void> {
    // Rebuild all views for this workflow
    await this.buildWorkflowInstanceView(workflowInstanceId);
    // Would also rebuild task queue, patient journey, etc.
  }

  /**
   * Rebuild all projections (full rebuild)
   */
  async rebuildAll(): Promise<void> {
    // Would iterate all workflow instances and rebuild
    // Used for schema migrations or corruption recovery
  }
}

export const projectionEngine = new ProjectionEngine({});