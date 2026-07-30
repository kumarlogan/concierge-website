// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Timeline Engine Interface                    │
// │ IVF journey stage progression, milestones, events, dates.  │
// │ Wave 3 — Timeline Engine                                    │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: This capability stores timeline metadata only.
// No PHI payloads — patient references are opaque identity IDs.

import type {
  IvfStage,
  StageStatus,
  Milestone,
  MilestoneType,
  TimelineEvent,
  EventCategory,
  ProgressSummary,
  ExpectedDateInfo,
  TimelineData,
} from "./timeline-types.js";

// ════════════════════════════════════════════════════════════
// Timeline Engine
// ════════════════════════════════════════════════════════════

export interface TimelineEngine {
  /** Get full timeline for a patient */
  getTimeline(patientId: string): Promise<TimelineData>;

  /** Advance a patient's stage to the next valid stage */
  advanceStage(patientId: string, notes?: string): Promise<StageStatus>;

  /** Get current stage status */
  getCurrentStage(patientId: string): Promise<StageStatus | null>;

  /** Get all stages for a patient */
  getStages(patientId: string): Promise<StageStatus[]>;

  /** Get all milestones for a patient */
  getMilestones(patientId: string, achieved?: boolean): Promise<Milestone[]>;

  /** Get a specific milestone */
  getMilestone(patientId: string, milestoneId: string): Promise<Milestone | null>;

  /** Manually create a milestone */
  createMilestone(
    patientId: string,
    type: MilestoneType,
    title: string,
    description: string,
    expectedDate?: string,
  ): Promise<Milestone>;

  /** Mark a milestone as achieved */
  achieveMilestone(patientId: string, milestoneId: string): Promise<Milestone>;

  /** Get all events for a patient */
  getEvents(patientId: string, category?: EventCategory): Promise<TimelineEvent[]>;

  /** Add a custom event to the timeline */
  addEvent(
    patientId: string,
    category: EventCategory,
    title: string,
    description: string,
    refId?: string,
    refType?: string,
  ): Promise<TimelineEvent>;

  /** Get progress summary for a patient */
  getProgress(patientId: string): Promise<ProgressSummary>;

  /** Get expected dates for all upcoming stages */
  getExpectedDates(patientId: string): Promise<ExpectedDateInfo[]>;
}