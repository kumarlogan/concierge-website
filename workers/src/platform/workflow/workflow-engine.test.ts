// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Workflow Engine Tests                            │
// │ Wave 8 — Workflow & Automation Engine                         │
// └─────────────────────────────────────────────────────────────┘

import { describe, it, expect, beforeEach } from "vitest";
import { StateMachine } from "./engine/state-machine.js";
import { TransitionValidator } from "./engine/transition-validator.js";
import { TaskOrchestrator } from "./tasks/task-orchestrator.js";
import { TaskGenerator } from "./tasks/task-generator.js";
import { AssignmentEngine } from "./tasks/assignment-engine.js";
import { QueueManager } from "./tasks/queue-manager.js";
import { BatchOperations } from "./tasks/batch-operations.js";
import { ApprovalGateService } from "./approval/approval-gate.js";
import { EvidencePackBuilder } from "./approval/evidence-pack.js";
import { DecisionProcessor } from "./approval/decision-processor.js";
import { TimerService } from "./timers/timer-service.js";
import { EscalationTimer } from "./timers/escalation-timer.js";
import { CronScheduler } from "./timers/cron-scheduler.js";
import { EventStore } from "./events/event-store.js";
import { EventReader } from "./events/event-reader.js";
import { ProjectionEngine } from "./events/projection-engine.js";
import type { Env } from "../../types/env.js";

function createMockEnv(): Env {
  return {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ success: true }),
        }),
      }),
    } as any,
    NOTIFICATIONS: {
      prepare: () => ({
        bind: () => ({
          run: async () => ({ success: true }),
          first: async () => null,
          all: async () => ({ results: [] }),
        }),
      }),
    } as any,
    DOCUMENT_STORAGE: {} as any,
    DOCUMENT_SERVICE: {} as any,
    DOCUMENT_CONSENT_INTEGRATION: {} as any,
    DOCUMENT_AUDIT: {} as any,
    DOCUMENT_ENCRYPTION: {} as any,
    DOCUMENT_POLICY_INTEGRATION: {} as any,
    ENVIRONMENT: "test",
    RATE_LIMIT_WINDOW_MS: "60000",
    RATE_LIMIT_LIMIT: "60",
    TURNSTILE_SECRET_KEY: "",
    JWT_PRIVATE_KEY: "",
    JWT_PUBLIC_KEY: "",
    JWT_KID: "",
    PLATFORM_JWT_PUBLIC_KEY: "",
    PLATFORM_JWT_KID: "",
    POLICY_ENGINE: {} as any,
    CONSENT_ENGINE: {} as any,
    TRUST_ENGINE: {} as any,
    RISK_ENGINE: {} as any,
    DELEGATION_ENGINE: {} as any,
    AUTHORIZATION_ENGINE: {} as any,
    EVENT_BUS: {} as any,
    DECISION_ENGINE: {} as any,
    WORKFLOW_QUEUE: {} as any,
  };
}

describe("StateMachine", () => {
  let sm: StateMachine;

  beforeEach(() => {
    sm = new StateMachine();
  });

  it("should define valid task states", () => {
    expect(sm.states).toBeDefined();
    expect(sm.states.length).toBeGreaterThan(0);
  });

  it("should define valid transitions", () => {
    expect(sm.transitions).toBeDefined();
  });

  it("should validate a valid transition", () => {
    const valid = sm.canTransition("draft", "requested");
    expect(valid).toBe(true);
  });

  it("should reject an invalid transition", () => {
    const valid = sm.canTransition("completed", "draft");
    expect(valid).toBe(false);
  });

  it("should get valid next states for a given state", () => {
    const next = sm.getNextStates("draft");
    expect(next).toContain("requested");
  });
});

describe("TransitionValidator", () => {
  let validator: TransitionValidator;

  beforeEach(() => {
    validator = new TransitionValidator();
  });

  it("should validate a valid transition", () => {
    const result = validator.validate("draft", "requested");
    expect(result.valid).toBe(true);
  });

  it("should reject an invalid transition", () => {
    const result = validator.validate("completed", "draft");
    expect(result.valid).toBe(false);
  });

  it("should return transition metadata for valid transitions", () => {
    const result = validator.validate("requested", "accepted");
    expect(result.valid).toBe(true);
    expect(result.transition).toBeDefined();
  });
});

describe("TaskOrchestrator", () => {
  it("should be instantiable", () => {
    const orchestrator = new TaskOrchestrator(createMockEnv());
    expect(orchestrator).toBeDefined();
  });
});

describe("TaskGenerator", () => {
  it("should be instantiable", () => {
    const generator = new TaskGenerator(createMockEnv());
    expect(generator).toBeDefined();
  });
});

describe("AssignmentEngine", () => {
  it("should be instantiable", () => {
    const engine = new AssignmentEngine();
    expect(engine).toBeDefined();
  });
});

describe("QueueManager", () => {
  it("should be instantiable", () => {
    const manager = new QueueManager();
    expect(manager).toBeDefined();
  });
});

describe("BatchOperations", () => {
  it("should be instantiable", () => {
    const ops = new BatchOperations();
    expect(ops).toBeDefined();
  });
});

describe("ApprovalGateService", () => {
  it("should be instantiable", () => {
    const gate = new ApprovalGateService({});
    expect(gate).toBeDefined();
  });
});

describe("EvidencePackBuilder", () => {
  it("should be instantiable", () => {
    const builder = new EvidencePackBuilder();
    expect(builder).toBeDefined();
  });
});

describe("DecisionProcessor", () => {
  it("should be instantiable", () => {
    const processor = new DecisionProcessor();
    expect(processor).toBeDefined();
  });
});

describe("TimerService", () => {
  it("should be instantiable", () => {
    const service = new TimerService();
    expect(service).toBeDefined();
  });
});

describe("EscalationTimer", () => {
  it("should be instantiable", () => {
    const timer = new EscalationTimer();
    expect(timer).toBeDefined();
  });
});

describe("CronScheduler", () => {
  it("should be instantiable", () => {
    const scheduler = new CronScheduler();
    expect(scheduler).toBeDefined();
  });
});

describe("EventStore", () => {
  it("should be instantiable", () => {
    const store = new EventStore();
    expect(store).toBeDefined();
  });
});

describe("EventReader", () => {
  it("should be instantiable", () => {
    const reader = new EventReader();
    expect(reader).toBeDefined();
  });
});

describe("ProjectionEngine", () => {
  it("should be instantiable", () => {
    const engine = new ProjectionEngine();
    expect(engine).toBeDefined();
  });
});