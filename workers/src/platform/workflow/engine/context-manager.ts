/**
 * Wave 8 — Workflow & Automation Engine
 * Context Manager — Workflow context/variable management
 */

import type { WorkflowContext, WorkflowInstance, WorkflowDefinition } from '../types';

export interface ContextSnapshot {
  context: WorkflowContext;
  timestamp: number;
  version: number;
}

export class ContextManager {
  private contextHistory: Map<string, ContextSnapshot[]> = new Map();

  /**
   * Create initial context for a new workflow instance
   */
  createInitialContext(
    definition: WorkflowDefinition,
    patientId: string,
    initialOverrides?: Partial<WorkflowContext>
  ): WorkflowContext {
    const baseContext: WorkflowContext = {
      patientRef: patientId,
      cycleNumber: 1,
      variables: {},
      language: 'en-CA',
      notificationPreferences: {
        push: true,
        email: true,
        sms: false,
        categories: ['clinical', 'scheduling', 'results'],
      },
      ...initialOverrides,
    };

    // Initialize with definition defaults if present
    // Note: WorkflowDefinitionJSON doesn't have variables field in current schema
    // This would be added in a future schema version

    return baseContext;
  }

  /**
   * Update context with new values (immutable update)
   */
  updateContext(
    instanceId: string,
    currentContext: WorkflowContext,
    updates: Partial<WorkflowContext>
  ): WorkflowContext {
    const newContext: WorkflowContext = {
      ...currentContext,
      ...updates,
      variables: {
        ...currentContext.variables,
        ...(updates.variables || {}),
      },
    };

    // Save snapshot for audit/rollback
    this.saveSnapshot(instanceId, newContext);

    return newContext;
  }

  /**
   * Set a single variable in context
   */
  setVariable(
    instanceId: string,
    currentContext: WorkflowContext,
    key: string,
    value: unknown
  ): WorkflowContext {
    return this.updateContext(instanceId, currentContext, {
      variables: { ...currentContext.variables, [key]: value },
    });
  }

  /**
   * Get a variable from context
   */
  getVariable(context: WorkflowContext, key: string): unknown {
    return context.variables[key];
  }

  /**
   * Merge clinical data into context (from external systems)
   */
  mergeClinicalData(
    instanceId: string,
    currentContext: WorkflowContext,
    clinicalData: Partial<WorkflowContext>
  ): WorkflowContext {
    return this.updateContext(instanceId, currentContext, clinicalData);
  }

  /**
   * Save context snapshot for audit trail
   */
  private saveSnapshot(instanceId: string, context: WorkflowContext): void {
    const history = this.contextHistory.get(instanceId) || [];
    const version = history.length + 1;
    
    history.push({
      context: { ...context },
      timestamp: Date.now(),
      version,
    });

    // Keep last 100 snapshots
    if (history.length > 100) {
      history.shift();
    }

    this.contextHistory.set(instanceId, history);
  }

  /**
   * Get context history for audit
   */
  getHistory(instanceId: string): ContextSnapshot[] {
    return this.contextHistory.get(instanceId) || [];
  }

  /**
   * Rollback to a previous context version
   */
  rollback(instanceId: string, version: number): WorkflowContext | null {
    const history = this.contextHistory.get(instanceId);
    if (!history) return null;

    const snapshot = history.find(s => s.version === version);
    if (!snapshot) return null;

    return snapshot.context;
  }

  /**
   * Compute derived values for rule evaluation
   */
  computeDerivedValues(context: WorkflowContext): WorkflowContext {
    const derived: Partial<WorkflowContext> = {};

    // Current stimulation day
    if (context.monitoringData && context.monitoringData.length > 0) {
      const sorted = [...context.monitoringData].sort((a, b) => a.date - b.date);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const dayDiff = Math.floor((last.date - first.date) / (1000 * 60 * 60 * 24));
      derived.currentDay = dayDiff + 1;
      derived.leadFollicleMm = last.leadFollicleMm;
      derived.estradiolPgml = last.estradiolPgml;
    }

    // PGT indication flag
    if (context.patientRef) {
      // Would be set based on patient age, history, etc.
      // derived.pgtIndicated = computePGTIndication(context);
    }

    return this.updateContext('temp', context, derived);
  }
}

export const contextManager = new ContextManager();