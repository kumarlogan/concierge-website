// ┌─────────────────────────────────────────────────────────────┐
// │ Timeline Engine — Interface Contract                          │
// │ Wave 3 — Patient Journey Timeline                            │
// └─────────────────────────────────────────────────────────────┘

import type { TimelineEngine, IvfStage, StageStatus, Milestone, TimelineEvent, ProgressSummary, ExpectedDateInfo, FullTimeline } from "./timeline-types.js";

// Re-export types for consumers
export type {
  IvfStage,
  StageStatus,
  Milestone,
  TimelineEvent,
  ProgressSummary,
  ExpectedDateInfo,
  FullTimeline,
  StageStatusValue,
  MilestoneType,
  EventCategory,
  StageTransition,
  MilestoneTemplate,
  AdvanceStageRequest,
} from "./timeline-types.js";

export { DEFAULT_STAGE_DURATIONS, STAGE_LABELS, STAGE_TRANSITIONS, STAGE_MILESTONE_TEMPLATES } from "./timeline-types.js";

// Interface is already exported from timeline-types.ts
// This file serves as the barrel for the interface contract
