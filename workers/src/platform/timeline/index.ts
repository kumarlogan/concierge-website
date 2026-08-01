// ┌─────────────────────────────────────────────────────────────┐
// │ Timeline Engine — Barrel Exports                                │
// │ Wave 3 — Patient Journey Timeline                            │
// └─────────────────────────────────────────────────────────────┘

export { InMemoryTimelineEngine } from "./in-memory-timeline-engine.js";
export type { TimelineEngine } from "./timeline-types.js";
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
export {
  DEFAULT_STAGE_DURATIONS,
  STAGE_LABELS,
  STAGE_TRANSITIONS,
  STAGE_MILESTONE_TEMPLATES,
} from "./timeline-types.js";
