/**
 * Wave 8 — Workflow & Automation Engine
 * Event Store — Event sourcing write/read path backed by D1
 *
 * Single architectural owner for workflow event persistence.
 * Uses the `workflow_events` table defined in migration 0010_workflow_engine.sql.
 */

import type {
  WorkflowEvent,
  EventType,
  Actor,
} from '../types';

export interface EventStoreConfig {
  db: D1Database;
}

interface EventRow {
  id: string;
  workflow_instance_id: string;
  task_instance_id: string | null;
  event_type: string;
  event_json: string;
  actor_type: string;
  actor_id: string;
  correlation_id: string | null;
  causation_id: string | null;
  version: number;
  created_at: number;
}

export class EventStore {
  private db: D1Database;

  constructor(config: EventStoreConfig) {
    this.db = config.db;
  }

  /**
   * Append an event to the event store
   */
  async append(event: Omit<WorkflowEvent, 'id'>): Promise<WorkflowEvent> {
    const fullEvent: WorkflowEvent = {
      ...event,
      id: crypto.randomUUID(),
    };

    await this.db
      .prepare(
        `INSERT INTO workflow_events
           (id, workflow_instance_id, event_type, event_json, actor_type, actor_id,
            correlation_id, causation_id, version, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        fullEvent.id,
        fullEvent.workflowInstanceId,
        fullEvent.eventType,
        JSON.stringify(fullEvent.payload),
        fullEvent.actor.type,
        fullEvent.actor.id,
        fullEvent.correlationId,
        fullEvent.causationId || null,
        fullEvent.version,
        fullEvent.timestamp
      )
      .run();

    return fullEvent;
  }

  /**
   * Batch append events within a single D1 transaction
   */
  async appendBatch(events: Omit<WorkflowEvent, 'id'>[]): Promise<WorkflowEvent[]> {
    const fullEvents: WorkflowEvent[] = events.map(e => ({
      ...e,
      id: crypto.randomUUID(),
    }));

    const stmt = this.db.prepare(
      `INSERT INTO workflow_events
         (id, workflow_instance_id, event_type, event_json, actor_type, actor_id,
          correlation_id, causation_id, version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const batch = fullEvents.map(e =>
      stmt.bind(
        e.id,
        e.workflowInstanceId,
        e.eventType,
        JSON.stringify(e.payload),
        e.actor.type,
        e.actor.id,
        e.correlationId,
        e.causationId || null,
        e.version,
        e.timestamp
      )
    );
    await this.db.batch(batch);

    return fullEvents;
  }

  /**
   * Get events for a workflow instance
   */
  async getEventsForWorkflow(
    workflowInstanceId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<WorkflowEvent[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM workflow_events
         WHERE workflow_instance_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(workflowInstanceId, limit, offset)
      .all<EventRow>();

    return (result.results || []).map(row => this.mapRowToEvent(row));
  }

  /**
   * Get events by correlation ID (for distributed tracing)
   */
  async getEventsByCorrelationId(correlationId: string): Promise<WorkflowEvent[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM workflow_events
         WHERE correlation_id = ?
         ORDER BY created_at ASC`
      )
      .bind(correlationId)
      .all<EventRow>();

    return (result.results || []).map(row => this.mapRowToEvent(row));
  }

  /**
   * Get events by type
   */
  async getEventsByType(
    eventType: EventType,
    limit: number = 100,
    offset: number = 0
  ): Promise<WorkflowEvent[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM workflow_events
         WHERE event_type = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(eventType, limit, offset)
      .all<EventRow>();

    return (result.results || []).map(row => this.mapRowToEvent(row));
  }

  /**
   * Get events in time range
   */
  async getEventsInRange(
    startTime: number,
    endTime: number,
    limit: number = 1000
  ): Promise<WorkflowEvent[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM workflow_events
         WHERE created_at >= ? AND created_at <= ?
         ORDER BY created_at ASC
         LIMIT ?`
      )
      .bind(startTime, endTime, limit)
      .all<EventRow>();

    return (result.results || []).map(row => this.mapRowToEvent(row));
  }

  /**
   * Map a database row to a WorkflowEvent
   */
  private mapRowToEvent(row: EventRow): WorkflowEvent {
    const actor: Actor = {
      type: row.actor_type as Actor['type'],
      id: row.actor_id,
    };
    return {
      id: row.id,
      workflowInstanceId: row.workflow_instance_id,
      eventType: row.event_type as EventType,
      payload: JSON.parse(row.event_json),
      actor,
      correlationId: row.correlation_id || '',
      causationId: row.causation_id || undefined,
      timestamp: row.created_at,
      version: row.version,
    };
  }
}
