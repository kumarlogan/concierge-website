/**
 * Wave 8 — Workflow & Automation Engine — D1-backed integration tests.
 *
 * Exercises the real D1 persistence mapping (EventStore, TaskOrchestrator,
 * engine start/reconstruct) against an in-memory D1 double that actually
 * stores and returns rows — so append→query roundtrips are genuine.
 */

import { describe, it, expect } from "vitest";
import { InMemoryD1 } from "../helpers/in-memory-d1";
import { EventStore } from "../../src/platform/workflow/events/event-store";
import { WorkflowEngine } from "../../src/platform/workflow/engine/workflow-engine";
import { TaskOrchestrator } from "../../src/platform/workflow/tasks/task-orchestrator";
import { ApprovalGateService } from "../../src/platform/workflow/approval/approval-gate";
import { TimerService } from "../../src/platform/workflow/timers/timer-service";

interface Build {
  db: InMemoryD1;
  eventStore: EventStore;
  taskOrchestrator: TaskOrchestrator;
  engine: WorkflowEngine;
}

function build(): Build {
  const db = new InMemoryD1();
  const eventStore = new EventStore({ db: db as unknown as D1Database });
  const taskOrchestrator = new TaskOrchestrator({ db: db as unknown as D1Database, eventStore });
  const approvalGate = new ApprovalGateService({ db: db as unknown as D1Database, eventStore });
  const timerService = new TimerService({ db: db as unknown as D1Database, eventStore });
  const engine = new WorkflowEngine({ eventStore, taskOrchestrator, approvalGate, timerService });
  return { db, eventStore, taskOrchestrator, engine };
}

describe("Wave 8 Workflow & Automation Engine (D1-backed)", () => {
  it("persists and reconstructs a workflow event via the EventStore", async () => {
    const { eventStore } = build();
    const appended = await eventStore.append({
      workflowInstanceId: "wf-1",
      eventType: "workflow.started",
      payload: { definitionId: "standard", patientId: "p1" },
      actor: { type: "user", id: "u1" },
      correlationId: "wf-1",
      timestamp: 1000,
      version: 1,
    });
    expect(appended.id).toBeTruthy();

    const events = await eventStore.getEventsForWorkflow("wf-1");
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe("workflow.started");
    expect(events[0].payload).toEqual({ definitionId: "standard", patientId: "p1" });
    expect(events[0].actor).toEqual({ type: "user", id: "u1" });
  });

  it("correlation-id lookup returns the traced event", async () => {
    const { eventStore } = build();
    await eventStore.append({
      workflowInstanceId: "wf-2",
      eventType: "workflow.cancelled",
      payload: { reason: "withdrawn" },
      actor: { type: "external", id: "portal" },
      correlationId: "trace-9",
      timestamp: 2000,
      version: 1,
    });
    const events = await eventStore.getEventsByCorrelationId("trace-9");
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe("workflow.cancelled");
  });

  it("starts a workflow, persists the started event, and reconstructs the instance", async () => {
    const { engine } = build();
    const instance = await engine.startWorkflow(
      { definitionId: "ivf-standard", patientId: "pt-42", initialContext: { language: "en-CA" } },
      { type: "user", id: "u1" }
    );

    expect(instance.id).toBeTruthy();
    expect(instance.status).toBe("running");
    expect(instance.currentState).toBe("pre_treatment.consultation");

    const reconstructed = await engine.getInstance(instance.id);
    expect(reconstructed).not.toBeNull();
    expect(reconstructed!.id).toBe(instance.id);
    expect(reconstructed!.patientId).toBe("pt-42");
    expect(reconstructed!.status).toBe("running");
  });

  it("claims a seeded receivable task through the orchestrator D1 path", async () => {
    const { db, taskOrchestrator, eventStore } = build();
    const taskId = "task-claim-1";
    db.tables["task_instances"].set(taskId, {
      id: taskId,
      workflow_instance_id: "wf-claim",
      task_definition_id: "initial_consultation",
      name: "Initial Consultation",
      type: "consultation",
      priority: "routine",
      state: "requested",
      assignee_id: null,
      assignee_role: null,
      claimed_by: null,
      claimed_at: null,
      started_at: null,
      completed_at: null,
      failed_at: null,
      failure_reason: null,
      escalation_level: 0,
      sla_deadline: Date.now() + 86400000,
      sla_breached: 0,
      context: "{}",
      outcome: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    const claimed = await taskOrchestrator.claimTask(taskId, "user-7");
    expect(claimed.status).toBe("claimed");
    expect(claimed.assigneeId).toBe("user-7");

    const persisted = await taskOrchestrator.getTask(taskId);
    expect(persisted!.status).toBe("claimed");
    expect(persisted!.assigneeId).toBe("user-7");

    const claimEvents = await eventStore.getEventsByCorrelationId("wf-claim");
    expect(claimEvents.some((e) => e.eventType === "task.claimed")).toBe(true);
  });
});
