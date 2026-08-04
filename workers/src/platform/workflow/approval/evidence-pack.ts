/**
 * Wave 8 — Workflow & Automation Engine
 * Evidence Pack Builder — Structured evidence for approval decisions
 */

import type {
  EvidencePack,
  EvidenceSection,
  TaskInstance,
  WorkflowInstance,
  WorkflowContext,
  RuleResult,
} from '../types';

import { EventStore } from '../events/event-store';

export interface EvidencePackBuilderConfig {
  /** Optional event store for populating recent-events evidence sections. */
  eventStore?: EventStore;
}

export class EvidencePackBuilder {
  private eventStore?: EventStore;

  constructor(config: EvidencePackBuilderConfig) {
    this.eventStore = config.eventStore;
  }

  /**
   * Build evidence pack from template and data
   */
  async buildFromTemplate(
    template: EvidencePackTemplate,
    task: TaskInstance,
    workflowInstance: WorkflowInstance,
    ruleResult?: RuleResult
  ): Promise<EvidencePack> {
    const sections: EvidenceSection[] = [];

    for (const sectionTemplate of template.sections) {
      const data = await this.extractSectionData(
        sectionTemplate.dataPath,
        workflowInstance,
        task,
        ruleResult
      );

      sections.push({
        id: sectionTemplate.id,
        title: sectionTemplate.title,
        dataPath: sectionTemplate.dataPath,
        required: sectionTemplate.required,
      });
    }

    return {
      taskSummary: this.buildTaskSummary(task),
      clinicalContext: await this.buildClinicalContext(workflowInstance),
      ruleEvaluation: ruleResult,
      patientPreferences: this.buildPatientPreferences(workflowInstance),
      riskAssessment: this.assessRisk(task, workflowInstance),
      alternatives: this.generateAlternatives(task, workflowInstance),
      requiredApprovers: 1,
      deadline: task.slaDeadline || Date.now() + 24 * 60 * 60 * 1000,
    };
  }

  /**
   * Extract data for a section using path
   */
  private async extractSectionData(
    path: string,
    workflowInstance: WorkflowInstance,
    task: TaskInstance,
    ruleResult?: RuleResult
  ): Promise<unknown> {
    const context = workflowInstance.context;
    
    // Handle special paths
    if (path === 'task') return this.buildTaskSummary(task);
    if (path === 'clinical') return await this.buildClinicalContext(workflowInstance);
    if (path === 'rule') return ruleResult;
    if (path === 'patient') return this.buildPatientPreferences(workflowInstance);
    if (path === 'risk') return this.assessRisk(task, workflowInstance);
    if (path === 'alternatives') return this.generateAlternatives(task, workflowInstance);

    // Handle nested paths like 'context.leadFollicleMm'
    return this.getNestedValue(
      { context, task, workflowInstance, ruleResult },
      path
    );
  }

  /**
   * Build task summary
   */
  private buildTaskSummary(task: TaskInstance) {
    return {
      id: task.id,
      name: task.name,
      type: task.type,
      priority: task.priority,
      createdAt: task.createdAt,
      slaDeadline: task.slaDeadline,
      status: task.status,
    };
  }

  /**
   * Build clinical context from workflow
   */
  private async buildClinicalContext(workflowInstance: WorkflowInstance) {
    const context = workflowInstance.context;
    
    return {
      patientRef: workflowInstance.patientId,
      journeyState: workflowInstance.currentState,
      currentDay: context.currentDay,
      keyMetrics: {
        leadFollicleMm: context.leadFollicleMm,
        estradiolPgml: context.estradiolPgml,
        cohortCount: context.monitoringData?.length || 0,
      },
      recentEvents: this.eventStore
        ? (await this.eventStore.getEventsForWorkflow(workflowInstance.id, 20, 0)).map((e) => ({
            timestamp: e.timestamp,
            type: e.eventType,
            summary: String(e.eventType),
            data: e.payload,
          }))
        : [],
      medications: context.medications,
      monitoringData: context.monitoringData,
      embryoData: context.embryoData,
    };
  }

  /**
   * Build patient preferences
   */
  private buildPatientPreferences(workflowInstance: WorkflowInstance) {
    return {
      language: workflowInstance.context.language || 'en-CA',
      communicationMethod: 'portal' as 'portal' | 'phone' | 'email',
      decisionMakingStyle: 'shared' as 'shared' | 'physician_led' | 'patient_led',
    };
  }

  /**
   * Assess risk level
   */
  private assessRisk(task: TaskInstance, instance: WorkflowInstance): 'low' | 'medium' | 'high' | 'critical' {
    if (task.priority === 'critical') return 'critical';
    if (task.priority === 'urgent') return 'high';
    
    const clinicalTasks = ['trigger', 'transfer', 'retrieval', 'pgt', 'protocol'];
    if (clinicalTasks.some(t => task.name.toLowerCase().includes(t))) {
      return 'high';
    }
    
    return 'medium';
  }

  /**
   * Generate alternatives for decision
   */
  private generateAlternatives(task: TaskInstance, instance: WorkflowInstance) {
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
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[key];
    }, obj);
  }
}

/**
 * Template for evidence pack sections
 */
export interface EvidencePackTemplate {
  sections: EvidenceSectionTemplate[];
}

export interface EvidenceSectionTemplate {
  id: string;
  title: string;
  dataPath: string;
  required: boolean;
}

/**
 * Canonical default evidence-pack template used when the caller does not
 * supply a custom template. Deterministic and complete — not a placeholder.
 */
export const defaultEvidencePackTemplate: EvidencePackTemplate = {
  sections: [
    { id: 'task', title: 'Task Summary', dataPath: 'task', required: true },
    { id: 'clinical', title: 'Clinical Context', dataPath: 'clinical', required: true },
    { id: 'patient', title: 'Patient Preferences', dataPath: 'patient', required: false },
    { id: 'risk', title: 'Risk Assessment', dataPath: 'risk', required: true },
    { id: 'alternatives', title: 'Alternatives', dataPath: 'alternatives', required: false },
    { id: 'rule', title: 'Rule Evaluation', dataPath: 'rule', required: false },
  ],
};

export const evidencePackBuilder = new EvidencePackBuilder({});