// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Workforce Observability Service            │
// │ EPIC-005 · PHASE 5                                          │
// │ Operational visibility for the workforce platform.           │
// └─────────────────────────────────────────────────────────────┘

import type { D1Database } from "@cloudflare/workers-types";

/**
 * Types of workforce metrics tracked for observability.
 */
export type WorkforceMetricType =
  | "agent.lifecycle.transition"     // Agent lifecycle state changes
  | "agent.activation.request"       // Activation requests
  | "agent.activation.approved"      // Approved activations
  | "agent.activation.denied"        // Denied activations
  | "agent.execution.attempt"        // Execution attempts
  | "agent.execution.success"        // Successful executions
  | "agent.execution.failure"        // Failed executions
  | "agent.suspension"               // Agent suspensions
  | "agent.capability.used"          // Capability usage
  | "agent.capability.unauthorized"  // Unauthorized capability attempts
  | "agent.disabled.execution"       // Disabled agent execution attempts
  | "workforce.error"                // General workforce errors
  | "workforce.warning";             // General workforce warnings

/**
 * Workforce metric record for observability.
 */
export interface WorkforceMetric {
  metricId: string;
  agentId: string;
  metricType: WorkforceMetricType;
  value: number;
  metadata?: Record<string, unknown>; // JSON-serializable
  timestamp: string; // ISO 8601 UTC
}

/**
 * Health status for an agent.
 */
export interface AgentHealth {
  agentId: string;
  status: "healthy" | "degraded" | "unhealthy" | "disabled";
  lastSeen: string; // ISO 8601 UTC
  recentFailures: number;
  totalExecutions: number;
  lastExecution?: string; // ISO 8601 UTC
  capabilitiesUsed: string[];
}

/**
 * Summary of workforce activity.
 */
export interface WorkforceSummary {
  totalAgents: number;
  activeAgents: number;
  suspendedAgents: number;
  totalExecutions: number;
  failedExecutions: number;
  pendingActivations: number;
  recentErrors: number;
}

/**
 * Recent activity record.
 */
export interface RecentActivity {
  metricId: string;
  agentId: string;
  metricType: WorkforceMetricType;
  description: string;
  timestamp: string; // ISO 8601 UTC
}

/**
 * Failed operation record.
 */
export interface FailedOperation {
  metricId: string;
  agentId: string;
  errorType: string;
  errorMessage: string;
  timestamp: string; // ISO 8601 UTC
  context?: Record<string, unknown>;
}

/**
 * D1-backed workforce observability service.
 */
export class WorkforceObservabilityService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Record a workforce metric.
   */
  async recordMetric(metric: Omit<WorkforceMetric, "metricId" | "timestamp">): Promise<void> {
    const metricId = this.generateId();
    const timestamp = new Date().toISOString();
    
    const stmt = this.db.prepare(
      `INSERT INTO workforce_metrics (
        metric_id, agent_id, metric_type, value, metadata, timestamp
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    );
    
    await stmt
      .bind(
        metricId,
        metric.agentId,
        metric.metricType,
        metric.value,
        metric.metadata ? JSON.stringify(metric.metadata) : null,
        timestamp
      )
      .run();
  }

  /**
   * Get health status for a specific agent.
   */
  async getAgentHealth(agentId: string): Promise<AgentHealth> {
    // Get recent metrics for this agent
    const stmt = this.db.prepare(
      `SELECT metric_type, timestamp, metadata
       FROM workforce_metrics
       WHERE agent_id = ?1
       ORDER BY timestamp DESC
       LIMIT 50`
    );
    
    const results = await stmt.bind(agentId).all<{
      metric_type: string;
      timestamp: string;
      metadata: string | null;
    }>();
    
    const metrics = results.results ?? [];
    
    // Calculate health metrics
    const recentFailures = metrics.filter(m => 
      m.metric_type === "agent.execution.failure" && 
      new Date(m.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    ).length;
    
    const totalExecutions = metrics.filter(m => 
      m.metric_type === "agent.execution.attempt"
    ).length;
    
    const lastExecution = metrics.find(m => 
      m.metric_type === "agent.execution.attempt"
    )?.timestamp;
    
    const capabilitiesUsed = Array.from(
      new Set(
        metrics
          .filter(m => m.metric_type === "agent.capability.used")
          .map(m => m.metadata ? JSON.parse(m.metadata).capability : null)
          .filter(Boolean) as string[]
      )
    );
    
    // Determine status based on recent failures
    let status: AgentHealth["status"] = "healthy";
    if (recentFailures > 5) {
      status = "unhealthy";
    } else if (recentFailures > 0) {
      status = "degraded";
    }
    
    // Check if agent is disabled (would need to integrate with agent state)
    // For now, we'll assume it's enabled unless we see a suspension
    const isSuspended = metrics.some(m => m.metric_type === "agent.suspension");
    if (isSuspended) {
      status = "disabled";
    }
    
    const lastSeen = metrics[0]?.timestamp ?? new Date().toISOString();
    
    return {
      agentId,
      status,
      lastSeen,
      recentFailures,
      totalExecutions,
      lastExecution,
      capabilitiesUsed
    };
  }

  /**
   * Get workforce summary statistics.
   */
  async getWorkforceSummary(): Promise<WorkforceSummary> {
    // Get counts of different metrics
    const agentCountStmt = this.db.prepare(
      `SELECT COUNT(DISTINCT agent_id) as count FROM workforce_metrics`
    );
    
    const executionStmt = this.db.prepare(
      `SELECT COUNT(*) as count FROM workforce_metrics WHERE metric_type = ?1`
    );
    
    const failureStmt = this.db.prepare(
      `SELECT COUNT(*) as count FROM workforce_metrics WHERE metric_type = ?1`
    );
    
    const pendingStmt = this.db.prepare(
      `SELECT COUNT(*) as count FROM workforce_metrics 
       WHERE metric_type = ?1 AND metadata LIKE ?2`
    );
    
    const errorStmt = this.db.prepare(
      `SELECT COUNT(*) as count FROM workforce_metrics 
       WHERE metric_type IN (?1, ?2) AND timestamp > ?3`
    );
    
    const agentCountResult = await agentCountStmt.first<{ count: number }>();
    const executionResult = await executionStmt.bind("agent.execution.attempt").first<{ count: number }>();
    const failureResult = await failureStmt.bind("agent.execution.failure").first<{ count: number }>();
    const pendingResult = await pendingStmt.bind("agent.activation.request", "%status%pending%").first<{ count: number }>();
    const errorResult = await errorStmt.bind("workforce.error", "workforce.warning", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).first<{ count: number }>();
    
    // For active/suspended agents, we would need to integrate with the agent state
    // For now, we'll use placeholder values
    const totalAgents = agentCountResult?.count ?? 0;
    const activeAgents = Math.max(0, totalAgents - 2); // Placeholder
    const suspendedAgents = Math.min(2, totalAgents); // Placeholder
    
    return {
      totalAgents,
      activeAgents,
      suspendedAgents,
      totalExecutions: executionResult?.count ?? 0,
      failedExecutions: failureResult?.count ?? 0,
      pendingActivations: pendingResult?.count ?? 0,
      recentErrors: errorResult?.count ?? 0
    };
  }

  /**
   * Get recent workforce activity.
   */
  async getRecentActivity(limit: number = 20): Promise<RecentActivity[]> {
    const stmt = this.db.prepare(
      `SELECT metric_id, agent_id, metric_type, metadata, timestamp
       FROM workforce_metrics
       ORDER BY timestamp DESC
       LIMIT ?1`
    );
    
    const results = await stmt.bind(limit).all<{
      metric_id: string;
      agent_id: string;
      metric_type: string;
      metadata: string | null;
      timestamp: string;
    }>();
    
    const metrics = results.results ?? [];
    
    return metrics.map(metric => {
      let description = metric.metric_type;
      
      // Generate human-readable descriptions based on metric type and metadata
      if (metric.metadata) {
        try {
          const metadata = JSON.parse(metric.metadata);
          switch (metric.metric_type) {
            case "agent.capability.used":
              description = `Used capability: ${metadata.capability}`;
              break;
            case "agent.execution.failure":
              description = `Execution failed: ${metadata.error || 'Unknown error'}`;
              break;
            case "agent.activation.request":
              description = `Activation requested for workflow: ${metadata.workflowId || 'Unknown'}`;
              break;
            case "agent.lifecycle.transition":
              description = `State changed to: ${metadata.toState || 'Unknown'}`;
              break;
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
      }
      
      return {
        metricId: metric.metric_id,
        agentId: metric.agent_id,
        metricType: metric.metric_type as WorkforceMetricType,
        description,
        timestamp: metric.timestamp
      };
    });
  }

  /**
   * Get recent failed operations.
   */
  async getFailedOperations(limit: number = 20): Promise<FailedOperation[]> {
    const stmt = this.db.prepare(
      `SELECT metric_id, agent_id, metadata, timestamp
       FROM workforce_metrics
       WHERE metric_type IN (?1, ?2, ?3)
       ORDER BY timestamp DESC
       LIMIT ?4`
    );
    
    const results = await stmt.bind(
      "agent.execution.failure",
      "agent.capability.unauthorized",
      "agent.disabled.execution",
      limit
    ).all<{
      metric_id: string;
      agent_id: string;
      metadata: string | null;
      timestamp: string;
    }>();
    
    const metrics = results.results ?? [];
    
    return metrics.map(metric => {
      let errorType = "Unknown";
      let errorMessage = "Unknown error";
      let context: Record<string, unknown> | undefined;
      
      if (metric.metadata) {
        try {
          const metadata = JSON.parse(metric.metadata);
          errorType = metadata.errorType || errorType;
          errorMessage = metadata.errorMessage || metadata.error || errorMessage;
          context = metadata.context;
        } catch (e) {
          // Ignore JSON parsing errors
        }
      }
      
      return {
        metricId: metric.metric_id,
        agentId: metric.agent_id,
        errorType,
        errorMessage,
        timestamp: metric.timestamp,
        context
      };
    });
  }

  /**
   * Detect safety violations and anomalies.
   */
  async detectSafetyViolations(): Promise<Array<{
    violationType: string;
    agentId: string;
    description: string;
    timestamp: string;
  }>> {
    const violations: Array<{
      violationType: string;
      agentId: string;
      description: string;
      timestamp: string;
    }> = [];
    
    // Check for repeated failures (more than 5 in 1 hour)
    const repeatedFailuresStmt = this.db.prepare(
      `SELECT agent_id, COUNT(*) as failure_count, MAX(timestamp) as last_failure
       FROM workforce_metrics
       WHERE metric_type = ?1 AND timestamp > ?2
       GROUP BY agent_id
       HAVING failure_count > 5`
    );
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const repeatedResults = await repeatedFailuresStmt.bind(
      "agent.execution.failure",
      oneHourAgo
    ).all<{ agent_id: string; failure_count: number; last_failure: string }>();
    
    for (const result of repeatedResults.results ?? []) {
      violations.push({
        violationType: "repeated_failures",
        agentId: result.agent_id,
        description: `Agent has failed ${result.failure_count} times in the last hour`,
        timestamp: result.last_failure
      });
    }
    
    // Check for unauthorized execution attempts
    const unauthorizedStmt = this.db.prepare(
      `SELECT agent_id, timestamp, metadata
       FROM workforce_metrics
       WHERE metric_type = ?1
       ORDER BY timestamp DESC
       LIMIT 10`
    );
    
    const unauthorizedResults = await unauthorizedStmt.bind(
      "agent.capability.unauthorized"
    ).all<{ agent_id: string; timestamp: string; metadata: string | null }>();
    
    for (const result of unauthorizedResults.results ?? []) {
      let capability = "unknown";
      if (result.metadata) {
        try {
          const metadata = JSON.parse(result.metadata);
          capability = metadata.capability || capability;
        } catch (e) {
          // Ignore JSON parsing errors
        }
      }
      
      violations.push({
        violationType: "unauthorized_execution",
        agentId: result.agent_id,
        description: `Unauthorized attempt to use capability: ${capability}`,
        timestamp: result.timestamp
      });
    }
    
    // Check for disabled agent execution attempts
    const disabledStmt = this.db.prepare(
      `SELECT agent_id, timestamp, metadata
       FROM workforce_metrics
       WHERE metric_type = ?1
       ORDER BY timestamp DESC
       LIMIT 10`
    );
    
    const disabledResults = await disabledStmt.bind(
      "agent.disabled.execution"
    ).all<{ agent_id: string; timestamp: string; metadata: string | null }>();
    
    for (const result of disabledResults.results ?? []) {
      violations.push({
        violationType: "disabled_agent_execution",
        agentId: result.agent_id,
        description: "Attempted execution by disabled agent",
        timestamp: result.timestamp
      });
    }
    
    return violations;
  }

  /**
   * Generate a unique ID for metrics.
   */
  private generateId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}