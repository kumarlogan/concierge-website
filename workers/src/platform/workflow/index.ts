/**
 * Wave 8 — Workflow & Automation Engine
 * Public exports
 */

// Types
export * from './types';

// Engine
export { WorkflowEngine } from './engine/workflow-engine';
export { StateMachine } from './engine/state-machine';
export { TransitionValidator } from './engine/transition-validator';
export { ContextManager } from './engine/context-manager';

// Tasks
export { TaskOrchestrator } from './tasks/task-orchestrator';
export { TaskGenerator } from './tasks/task-generator';
export { AssignmentEngine } from './tasks/assignment-engine';
export { QueueManager } from './tasks/queue-manager';
export { BatchOperations } from './tasks/batch-operations';

// Approval
export { ApprovalGateService } from './approval/approval-gate';
export { EvidencePackBuilder } from './approval/evidence-pack';
export { DecisionProcessor } from './approval/decision-processor';

// Timers
export { TimerService } from './timers/timer-service';
export { EscalationTimer } from './timers/escalation-timer';
export { CronScheduler } from './timers/cron-scheduler';

// Events
export { EventStore } from './events/event-store';
export { EventReader } from './events/event-reader';
export { ProjectionEngine } from './events/projection-engine';