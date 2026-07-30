// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — In-Memory Timeline Engine                    │
// │ Concrete implementation of TimelineEngine interface.       │
// │ Wave 3 — Timeline Engine                                    │
// └─────────────────────────────────────────────────────────────┘
//
// D1-backed implementation replaces this for production.
// This implementation satisfies the engine contract and enables
// integration testing without external dependencies.

import { randomUUID } from "node:crypto";
import type { TimelineEngine } from "./timeline-engine.js";
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
import {
  IVF_STAGES,
  IVF_STAGE_LABELS,
  STAGE_TRANSITIONS,
  MILESTONE_TYPES,
} from "./timeline-types.js";

// ════════════════════════════════════════════════════════════
// Default durations per stage (in days)
// ════════════════════════════════════════════════════════════

const DEFAULT_STAGE_DURATIONS: Record<IvfStage, number> = {
  registration: 0,
  consultation: 14,
  treatment_plan: 7,
  ivf_cycle: 28,
  retrieval: 1,
  transfer: 14,
  follow_up: 14,
  success: 0,
};

// ════════════════════════════════════════════════════════════
// Milestone templates — auto-generated when a stage begins
// ════════════════════════════════════════════════════════════

const STAGE_MILESTONES: Record<IvfStage, { type: MilestoneType; title: string; description: string }[]> = {
  registration: [
    { type: "registration", title: "Account Created", description: "Patient registered and profile created." },
  ],
  consultation: [
    { type: "consultation", title: "Consultation Scheduled", description: "Initial consultation with fertility specialist." },
  ],
  treatment_plan: [
    { type: "treatment_plan", title: "Treatment Plan Created", description: "Personalized treatment plan developed." },
  ],
  ivf_cycle: [
    { type: "ivf_cycle_start", title: "IVF Cycle Started", description: "First day of ovarian stimulation for IVF cycle." },
  ],
  retrieval: [
    { type: "retrieval", title: "Egg Retrieval", description: "Oocyte retrieval procedure completed." },
  ],
  transfer: [
    { type: "transfer", title: "Embryo Transfer", description: "Embryo transfer procedure completed." },
  ],
  follow_up: [
    { type: "pregnancy_test", title: "Pregnancy Test", description: "Beta hCG blood test to determine outcome." },
    { type: "follow_up", title: "Follow-up Appointment", description: "Post-treatment follow-up with specialist." },
  ],
  success: [
    { type: "success", title: "Treatment Journey Complete", description: "Fertility treatment journey milestone achieved." },
  ],
};

// ════════════════════════════════════════════════════════════
// Per-Patient Store
// ════════════════════════════════════════════════════════════

interface PatientTimeline {
  patientId: string;
  stages: StageStatus[];
  milestones: Milestone[];
  events: TimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

// ════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function now(): string {
  return new Date().toISOString();
}

function recalculateProgress(patientTimeline: PatientTimeline): ProgressSummary {
  const stages = patientTimeline.stages;
  const completedStages = stages.filter((s) => s.status === "completed").length;
  const totalStages = stages.length;
  const overallPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  const milestones = patientTimeline.milestones;
  const achievedMilestones = milestones.filter((m) => m.achieved).length;
  const totalMilestones = milestones.length;

  const currentStage = stages.find((s) => s.status === "active");
  const activeIndex = currentStage ? stages.indexOf(currentStage) : -1;

  // Estimate remaining days: sum of typical durations for remaining stages
  let remainingDays = 0;
  if (activeIndex >= 0) {
    // Start from the next stage after current
    for (let i = activeIndex + 1; i < stages.length; i++) {
      remainingDays += DEFAULT_STAGE_DURATIONS[stages[i].stage] || 0;
    }
  } else if (completedStages < totalStages) {
    // No active stage but not all complete — sum from first pending
    const firstPending = stages.findIndex((s) => s.status === "pending");
    if (firstPending >= 0) {
      for (let i = firstPending; i < stages.length; i++) {
        remainingDays += DEFAULT_STAGE_DURATIONS[stages[i].stage] || 0;
      }
    }
  }

  return {
    overallPercent,
    stagesCompleted: completedStages,
    stagesTotal: totalStages,
    currentStage: currentStage?.label ?? null,
    milestonesAchieved: achievedMilestones,
    milestonesTotal: totalMilestones,
    estimatedRemainingDays: remainingDays > 0 ? remainingDays : null,
  };
}

function recalculateExpectedDates(patientTimeline: PatientTimeline): ExpectedDateInfo[] {
  const stages = patientTimeline.stages;
  return stages.map((s, index) => {
    const isCompleted = s.status === "completed";
    const isActive = s.status === "active";
    const previousStage = index > 0 ? stages[index - 1] : null;

    let estimatedStart: string | null = null;
    let estimatedCompletion: string | null = null;
    let estimateType: "default" | "adjusted" = "default";

    if (isCompleted) {
      estimatedStart = s.enteredAt;
      estimatedCompletion = s.completedAt;
    } else if (isActive) {
      estimatedStart = s.enteredAt;
      if (s.expectedCompletionDate) {
        estimatedCompletion = s.expectedCompletionDate;
      }
    } else if (previousStage?.completedAt) {
      // Pending stage — estimate based on previous stage completion
      const prevEnd = new Date(previousStage.completedAt);
      prevEnd.setDate(prevEnd.getDate() + 1); // 1 day gap
      estimatedStart = prevEnd.toISOString();
      const comp = new Date(prevEnd);
      comp.setDate(comp.getDate() + s.expectedDurationDays);
      estimatedCompletion = comp.toISOString();
      estimateType = "adjusted";
    } else {
      // Far future — use defaults
      const daysFromNow = IVF_STAGES.indexOf(s.stage) * 30;
      const start = new Date();
      start.setDate(start.getDate() + daysFromNow);
      estimatedStart = start.toISOString();
      const comp = new Date(start);
      comp.setDate(comp.getDate() + s.expectedDurationDays);
      estimatedCompletion = comp.toISOString();
    }

    return {
      stage: s.stage,
      label: s.label,
      estimatedStartDate: estimatedStart,
      estimatedCompletionDate: estimatedCompletion,
      typicalDurationDays: s.expectedDurationDays,
      estimateType,
    };
  });
}

function autoGenerateMilestonesForStage(
  stage: IvfStage,
  patientTimeline: PatientTimeline,
): Milestone[] {
  const templates = STAGE_MILESTONES[stage] || [];
  const newMilestones: Milestone[] = [];

  for (const tpl of templates) {
    // Skip if this milestone already exists
    const exists = patientTimeline.milestones.some((m) => m.type === tpl.type);
    if (!exists) {
      const milestone: Milestone = {
        id: randomUUID(),
        type: tpl.type,
        title: tpl.title,
        description: tpl.description,
        stage,
        date: now(),
        achieved: false,
        achievedAt: null,
        expectedDate: daysFromNow(DEFAULT_STAGE_DURATIONS[stage] || 7),
        autoGenerated: true,
      };
      newMilestones.push(milestone);
    }
  }

  return newMilestones;
}

function createPatientZeroTimeline(patientId: string): PatientTimeline {
  const stages: StageStatus[] = IVF_STAGES.map((stage, index) => {
    const isFirst = index === 0;
    const isActive = isFirst;
    return {
      stage,
      label: IVF_STAGE_LABELS[stage],
      status: isActive ? "active" : "pending",
      enteredAt: isActive ? now() : null,
      completedAt: null,
      expectedDurationDays: DEFAULT_STAGE_DURATIONS[stage],
      expectedCompletionDate: isActive ? daysFromNow(DEFAULT_STAGE_DURATIONS[stage]) : null,
      actualDurationDays: null,
      notes: "",
    };
  });

  const milestones: Milestone[] = [
    {
      id: "ms-registration",
      type: "registration",
      title: "Account Created",
      description: "Welcome to AG Synergy. Your fertility journey has begun.",
      stage: "registration",
      date: now(),
      achieved: true,
      achievedAt: now(),
      expectedDate: now(),
      autoGenerated: true,
    },
  ];

  const events: TimelineEvent[] = [
    {
      id: randomUUID(),
      timestamp: now(),
      category: "stage_change",
      title: "Journey Started",
      description: "Patient registered and IVF journey timeline initialized.",
      refId: "registration",
      refType: "stage",
    },
  ];

  return {
    patientId,
    stages,
    milestones,
    events,
    createdAt: now(),
    updatedAt: now(),
  };
}

// ════════════════════════════════════════════════════════════
// InMemoryTimelineEngine
// ════════════════════════════════════════════════════════════

export class InMemoryTimelineEngine implements TimelineEngine {
  private store = new Map<string, PatientTimeline>();

  // ── Lifecycle ────────────────────────────────────────────

  private getOrCreate(patientId: string): PatientTimeline {
    if (!this.store.has(patientId)) {
      this.store.set(patientId, createPatientZeroTimeline(patientId));
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.store.get(patientId)!;
  }

  private touch(patientTimeline: PatientTimeline): void {
    patientTimeline.updatedAt = now();
  }

  // ── Timeline ─────────────────────────────────────────────

  async getTimeline(patientId: string): Promise<TimelineData> {
    const pt = this.getOrCreate(patientId);
    return {
      patientId: pt.patientId,
      stages: pt.stages,
      milestones: pt.milestones,
      events: pt.events,
      progress: recalculateProgress(pt),
      expectedDates: recalculateExpectedDates(pt),
      updatedAt: pt.updatedAt,
      createdAt: pt.createdAt,
    };
  }

  // ── Stage Progression ────────────────────────────────────

  async advanceStage(patientId: string, notes?: string): Promise<StageStatus> {
    const pt = this.getOrCreate(patientId);
    const currentIndex = pt.stages.findIndex((s) => s.status === "active");

    if (currentIndex === -1) {
      // All stages completed or no active stage — throw
      throw new Error("No active stage to advance from");
    }

    const currentStage = pt.stages[currentIndex];
    const nextStage = IVF_STAGES[currentIndex + 1];

    if (!nextStage) {
      throw new Error("Already at final stage — no further advancement possible");
    }

    // Validate transition
    const allowedTransitions = STAGE_TRANSITIONS[currentStage.stage];
    if (!allowedTransitions.includes(nextStage)) {
      throw new Error(
        `Invalid transition from ${currentStage.stage} to ${nextStage}`,
      );
    }

    // Complete current stage
    currentStage.status = "completed";
    currentStage.completedAt = now();
    if (currentStage.enteredAt) {
      const start = new Date(currentStage.enteredAt).getTime();
      const end = new Date(currentStage.completedAt).getTime();
      currentStage.actualDurationDays = Math.round((end - start) / 86_400_000);
    }
    if (notes) currentStage.notes = notes;

    // Activate next stage
    const nextStageStatus = pt.stages[currentIndex + 1];
    nextStageStatus.status = "active";
    nextStageStatus.enteredAt = now();
    nextStageStatus.expectedCompletionDate = daysFromNow(nextStageStatus.expectedDurationDays);

    // Auto-generate milestones for this stage
    const newMilestones = autoGenerateMilestonesForStage(nextStageStatus.stage, pt);
    pt.milestones.push(...newMilestones);

    // Add event (newest first)
    pt.events.unshift({
      id: randomUUID(),
      timestamp: now(),
      category: "stage_change",
      title: `Stage Advanced: ${nextStageStatus.label}`,
      description: `Transitioned from ${currentStage.label} to ${nextStageStatus.label}.${notes ? ` Notes: ${notes}` : ""}`,
      refId: nextStageStatus.stage,
      refType: "stage",
    });

    this.touch(pt);
    return nextStageStatus;
  }

  async getCurrentStage(patientId: string): Promise<StageStatus | null> {
    const pt = this.getOrCreate(patientId);
    return pt.stages.find((s) => s.status === "active") ?? null;
  }

  async getStages(patientId: string): Promise<StageStatus[]> {
    const pt = this.getOrCreate(patientId);
    return [...pt.stages];
  }

  // ── Milestones ───────────────────────────────────────────

  async getMilestones(patientId: string, achieved?: boolean): Promise<Milestone[]> {
    const pt = this.getOrCreate(patientId);
    let milestones = [...pt.milestones];
    if (achieved !== undefined) {
      milestones = milestones.filter((m) => m.achieved === achieved);
    }
    return milestones;
  }

  async getMilestone(patientId: string, milestoneId: string): Promise<Milestone | null> {
    const pt = this.getOrCreate(patientId);
    return pt.milestones.find((m) => m.id === milestoneId) ?? null;
  }

  async createMilestone(
    patientId: string,
    type: MilestoneType,
    title: string,
    description: string,
    expectedDate?: string,
  ): Promise<Milestone> {
    const pt = this.getOrCreate(patientId);

    // Find which stage this milestone belongs to
    const stage = IVF_STAGES.find((s) => {
      const templates = STAGE_MILESTONES[s] || [];
      return templates.some((t) => t.type === type);
    }) ?? "registration";

    const milestone: Milestone = {
      id: randomUUID(),
      type,
      title,
      description,
      stage,
      date: now(),
      achieved: false,
      achievedAt: null,
      expectedDate: expectedDate ?? daysFromNow(7),
      autoGenerated: false,
    };

    pt.milestones.push(milestone);

    pt.events.unshift({
      id: randomUUID(),
      timestamp: now(),
      category: "milestone_achieved",
      title: `Milestone Created: ${title}`,
      description,
      refId: milestone.id,
      refType: "milestone",
    });

    this.touch(pt);
    return milestone;
  }

  async achieveMilestone(patientId: string, milestoneId: string): Promise<Milestone> {
    const pt = this.getOrCreate(patientId);
    const milestone = pt.milestones.find((m) => m.id === milestoneId);
    if (!milestone) {
      throw new Error(`Milestone not found: ${milestoneId}`);
    }

    milestone.achieved = true;
    milestone.achievedAt = now();

    pt.events.unshift({
      id: randomUUID(),
      timestamp: now(),
      category: "milestone_achieved",
      title: `Milestone Achieved: ${milestone.title}`,
      description: milestone.description,
      refId: milestone.id,
      refType: "milestone",
    });

    this.touch(pt);
    return milestone;
  }

  // ── Events ───────────────────────────────────────────────

  async getEvents(patientId: string, category?: EventCategory): Promise<TimelineEvent[]> {
    const pt = this.getOrCreate(patientId);
    let events = [...pt.events];
    if (category) {
      events = events.filter((e) => e.category === category);
    }
    return events.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  async addEvent(
    patientId: string,
    category: EventCategory,
    title: string,
    description: string,
    refId?: string,
    refType?: string,
  ): Promise<TimelineEvent> {
    const pt = this.getOrCreate(patientId);
    const event: TimelineEvent = {
      id: randomUUID(),
      timestamp: now(),
      category,
      title,
      description,
      refId: refId ?? null,
      refType: refType ?? null,
    };
    pt.events.push(event);
    this.touch(pt);
    return event;
  }

  // ── Progress ─────────────────────────────────────────────

  async getProgress(patientId: string): Promise<ProgressSummary> {
    const pt = this.getOrCreate(patientId);
    return recalculateProgress(pt);
  }

  async getExpectedDates(patientId: string): Promise<ExpectedDateInfo[]> {
    const pt = this.getOrCreate(patientId);
    return recalculateExpectedDates(pt);
  }
}

// ── Module-level singleton ─────────────────────────────────
// Export one shared instance so routes see the same data across requests.
export const timelineEngine = new InMemoryTimelineEngine();

// ── Test helper: reset all state ───────────────────────────
export function resetTimelineStore(): void {
  timelineEngine["store"] = new Map();
}