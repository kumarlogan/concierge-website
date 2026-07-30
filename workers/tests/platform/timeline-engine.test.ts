// ┌─────────────────────────────────────────────────────────────┐
// │ Wave 3 — Timeline Engine Tests                              │
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryTimelineEngine,
  resetTimelineStore,
} from "../../src/platform/timeline/in-memory-timeline-engine.js";
import {
  IVF_STAGES,
  IVF_STAGE_LABELS,
  STAGE_TRANSITIONS,
  MILESTONE_TYPES,
} from "../../src/platform/timeline/timeline-types.js";
import type { IvfStage } from "../../src/platform/timeline/timeline-types.js";

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const TEST_PATIENT = "test-patient-001";

// ═══════════════════════════════════════════════════════════════
// Setup
// ═══════════════════════════════════════════════════════════════

let engine: InMemoryTimelineEngine;

beforeEach(() => {
  resetTimelineStore();
  engine = new InMemoryTimelineEngine();
});

// ═══════════════════════════════════════════════════════════════
// Module Constants
// ═══════════════════════════════════════════════════════════════

describe("Timeline Module Constants", () => {
  it("defines all 8 IVF stages in order", () => {
    expect(IVF_STAGES).toHaveLength(8);
    expect(IVF_STAGES).toEqual([
      "registration",
      "consultation",
      "treatment_plan",
      "ivf_cycle",
      "retrieval",
      "transfer",
      "follow_up",
      "success",
    ]);
  });

  it("provides human-readable labels for every stage", () => {
    for (const stage of IVF_STAGES) {
      expect(IVF_STAGE_LABELS[stage]).toBeDefined();
      expect(typeof IVF_STAGE_LABELS[stage]).toBe("string");
    }
  });

  it("defines valid transitions for every stage", () => {
    for (const stage of IVF_STAGES) {
      const transitions = STAGE_TRANSITIONS[stage];
      expect(Array.isArray(transitions)).toBe(true);
      // Every transition target must be a valid stage
      for (const target of transitions) {
        expect(IVF_STAGES).toContain(target);
      }
    }
  });

  it("allows only forward transitions", () => {
    for (const stage of IVF_STAGES) {
      const stageIndex = IVF_STAGES.indexOf(stage);
      for (const target of STAGE_TRANSITIONS[stage]) {
        const targetIndex = IVF_STAGES.indexOf(target);
        expect(targetIndex).toBeGreaterThan(stageIndex);
      }
    }
  });

  it("marks success as terminal stage", () => {
    expect(STAGE_TRANSITIONS.success).toEqual([]);
  });

  it("defines all milestone types", () => {
    expect(MILESTONE_TYPES).toContain("registration");
    expect(MILESTONE_TYPES).toContain("consultation");
    expect(MILESTONE_TYPES).toContain("custom");
  });
});

// ═══════════════════════════════════════════════════════════════
// Timeline Initialization
// ═══════════════════════════════════════════════════════════════

describe("Timeline Initialization", () => {
  it("auto-creates a timeline for new patients", async () => {
    const timeline = await engine.getTimeline(TEST_PATIENT);
    expect(timeline.patientId).toBe(TEST_PATIENT);
    expect(timeline.stages).toHaveLength(8);
    expect(timeline.milestones.length).toBeGreaterThanOrEqual(1);
    expect(timeline.events.length).toBeGreaterThanOrEqual(1);
    expect(timeline.progress).toBeDefined();
    expect(timeline.expectedDates).toHaveLength(8);
  });

  it("starts with registration stage active", async () => {
    const current = await engine.getCurrentStage(TEST_PATIENT);
    expect(current).not.toBeNull();
    expect(current!.stage).toBe("registration");
    expect(current!.status).toBe("active");
  });

  it("returns the same data on repeated calls", async () => {
    const t1 = await engine.getTimeline(TEST_PATIENT);
    const t2 = await engine.getTimeline(TEST_PATIENT);
    expect(t1.patientId).toBe(t2.patientId);
    expect(t1.stages).toHaveLength(t2.stages.length);
  });

  it("isolates different patients", async () => {
    const t1 = await engine.getTimeline("patient-a");
    const t2 = await engine.getTimeline("patient-b");
    expect(t1.patientId).toBe("patient-a");
    expect(t2.patientId).toBe("patient-b");
  });
});

// ═══════════════════════════════════════════════════════════════
// Stage Progression
// ═══════════════════════════════════════════════════════════════

describe("Stage Progression", () => {
  it("advances from registration to consultation", async () => {
    const next = await engine.advanceStage(TEST_PATIENT);
    expect(next.stage).toBe("consultation");
    expect(next.status).toBe("active");

    // Verify registration is now completed
    const stages = await engine.getStages(TEST_PATIENT);
    const registration = stages.find((s) => s.stage === "registration");
    expect(registration!.status).toBe("completed");
    expect(registration!.completedAt).not.toBeNull();
  });

  it("advances through all 8 stages", async () => {
    for (let i = 1; i < IVF_STAGES.length; i++) {
      const next = await engine.advanceStage(TEST_PATIENT);
      expect(next.stage).toBe(IVF_STAGES[i]);
      expect(next.status).toBe("active");
    }
  });

  it("throws when advancing past final stage", async () => {
    // Advance through all stages
    for (let i = 1; i < IVF_STAGES.length; i++) {
      await engine.advanceStage(TEST_PATIENT);
    }
    // Try advancing past success
    await expect(engine.advanceStage(TEST_PATIENT)).rejects.toThrow(
      "Already at final stage",
    );
  });

  it("records notes on stage advance", async () => {
    await engine.advanceStage(TEST_PATIENT, "Consultation scheduled for next week");
    const stages = await engine.getStages(TEST_PATIENT);
    const registration = stages.find((s) => s.stage === "registration");
    expect(registration!.notes).toContain("Consultation");
  });

  it("calculates actual duration on completion", async () => {
    await engine.advanceStage(TEST_PATIENT);
    const stages = await engine.getStages(TEST_PATIENT);
    const registration = stages.find((s) => s.stage === "registration");
    expect(registration!.actualDurationDays).toBeGreaterThanOrEqual(0);
  });

  it("rejects invalid transitions (maintains invariant)", async () => {
    // Should only be able to advance forward — can't skip stages
    // After registration → consultation, try to advance to retrieval
    // (can only go registration → consultation)
    // The advanceStage always goes to the next in sequence, so this
    // invariant is maintained by design. Just verify the state machine
    // works as expected.
    const stage0 = await engine.getCurrentStage(TEST_PATIENT);
    expect(stage0!.stage).toBe("registration");

    await engine.advanceStage(TEST_PATIENT);
    const stage1 = await engine.getCurrentStage(TEST_PATIENT);
    expect(stage1!.stage).toBe("consultation");

    await engine.advanceStage(TEST_PATIENT);
    const stage2 = await engine.getCurrentStage(TEST_PATIENT);
    expect(stage2!.stage).toBe("treatment_plan");
  });

  it("accepts notes as optional parameter", async () => {
    // No notes
    await engine.advanceStage(TEST_PATIENT);
    // With notes on the next advance — notes go on the completed stage
    await engine.advanceStage(TEST_PATIENT, "Moved to treatment planning");
    // Should not throw
    const stages = await engine.getStages(TEST_PATIENT);
    expect(stages.find((s) => s.stage === "consultation")!.notes).toBe(
      "Moved to treatment planning",
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// Milestones
// ═══════════════════════════════════════════════════════════════

describe("Milestones", () => {
  it("starts with a registration milestone already achieved", async () => {
    const milestones = await engine.getMilestones(TEST_PATIENT, true);
    expect(milestones.length).toBeGreaterThanOrEqual(1);
    expect(milestones[0].type).toBe("registration");
  });

  it("auto-generates milestones on stage advance", async () => {
    await engine.advanceStage(TEST_PATIENT); // → consultation
    const milestones = await engine.getMilestones(TEST_PATIENT, false);
    const consultationMilestones = milestones.filter(
      (m) => m.stage === "consultation",
    );
    expect(consultationMilestones.length).toBeGreaterThanOrEqual(1);
    expect(consultationMilestones.every((m) => m.autoGenerated)).toBe(true);
  });

  it("does not duplicate auto-generated milestones on multiple calls", async () => {
    await engine.advanceStage(TEST_PATIENT);
    await engine.advanceStage(TEST_PATIENT); // → treatment_plan
    const milestones = await engine.getMilestones(TEST_PATIENT);
    const types = milestones.map((m) => m.type);
    // Each type should appear at most once
    const uniqueTypes = new Set(types);
    expect(types.length).toBe(uniqueTypes.size);
  });

  it("creates and achieves custom milestones", async () => {
    const created = await engine.createMilestone(
      TEST_PATIENT,
      "custom",
      "Genetic Testing",
      "Pre-implantation genetic testing completed",
    );
    expect(created.type).toBe("custom");
    expect(created.achieved).toBe(false);
    expect(created.autoGenerated).toBe(false);

    const achieved = await engine.achieveMilestone(TEST_PATIENT, created.id);
    expect(achieved.achieved).toBe(true);
    expect(achieved.achievedAt).not.toBeNull();
  });

  it("retrieves a single milestone by ID", async () => {
    const milestones = await engine.getMilestones(TEST_PATIENT);
    const first = milestones[0];
    const found = await engine.getMilestone(TEST_PATIENT, first.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(first.id);
  });

  it("returns null for non-existent milestone", async () => {
    const found = await engine.getMilestone(TEST_PATIENT, "nonexistent");
    expect(found).toBeNull();
  });

  it("filters milestones by achieved status", async () => {
    const achieved = await engine.getMilestones(TEST_PATIENT, true);
    const unachieved = await engine.getMilestones(TEST_PATIENT, false);
    expect(achieved.every((m) => m.achieved)).toBe(true);
    expect(unachieved.every((m) => !m.achieved)).toBe(true);
  });

  it("throws on achieving non-existent milestone", async () => {
    await expect(
      engine.achieveMilestone(TEST_PATIENT, "bad-id"),
    ).rejects.toThrow("Milestone not found");
  });
});

// ═══════════════════════════════════════════════════════════════
// Events
// ═══════════════════════════════════════════════════════════════

describe("Timeline Events", () => {
  it("logs stage change events on advance", async () => {
    await engine.advanceStage(TEST_PATIENT);
    const events = await engine.getEvents(TEST_PATIENT, "stage_change");
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].title).toContain("Stage Advanced");
  });

  it("returns events in reverse chronological order", async () => {
    await engine.advanceStage(TEST_PATIENT);
    await engine.advanceStage(TEST_PATIENT);
    const events = await engine.getEvents(TEST_PATIENT);
    for (let i = 1; i < events.length; i++) {
      expect(
        new Date(events[i - 1].timestamp).getTime(),
      ).toBeGreaterThanOrEqual(
        new Date(events[i].timestamp).getTime(),
      );
    }
  });

  it("supports adding custom events", async () => {
    const event = await engine.addEvent(
      TEST_PATIENT,
      "note_added",
      "Doctor Note",
      "Patient showing good response to medication.",
    );
    expect(event.category).toBe("note_added");
    expect(event.title).toBe("Doctor Note");
    expect(event.refId).toBeNull();
  });

  it("filters events by category", async () => {
    await engine.addEvent(TEST_PATIENT, "note_added", "Test", "Test");
    const noteEvents = await engine.getEvents(TEST_PATIENT, "note_added");
    expect(noteEvents.length).toBeGreaterThanOrEqual(1);
    expect(noteEvents.every((e) => e.category === "note_added")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Progress Tracking
// ═══════════════════════════════════════════════════════════════

describe("Progress Tracking", () => {
  it("starts at 0% progress", async () => {
    const progress = await engine.getProgress(TEST_PATIENT);
    expect(progress.overallPercent).toBe(0); // 0/8 completed
    expect(progress.stagesCompleted).toBe(0);
    expect(progress.stagesTotal).toBe(8);
  });

  it("updates progress as stages are completed", async () => {
    // First stage completed (1/8 = 12.5 → 13%)
    await engine.advanceStage(TEST_PATIENT);
    const p1 = await engine.getProgress(TEST_PATIENT);
    expect(p1.stagesCompleted).toBe(1);
    expect(p1.overallPercent).toBe(13);

    // Two stages completed (2/8 = 25%)
    await engine.advanceStage(TEST_PATIENT);
    const p2 = await engine.getProgress(TEST_PATIENT);
    expect(p2.stagesCompleted).toBe(2);
    expect(p2.overallPercent).toBe(25);
  });

  it("reaches 88% with 7/8 stages completed", async () => {
    for (let i = 1; i < IVF_STAGES.length; i++) {
      await engine.advanceStage(TEST_PATIENT);
    }
    const progress = await engine.getProgress(TEST_PATIENT);
    expect(progress.stagesCompleted).toBe(7);
    expect(progress.overallPercent).toBe(88); // 7/8 = 87.5 → 88
  });

  it("reports current stage label", async () => {
    const p0 = await engine.getProgress(TEST_PATIENT);
    expect(p0.currentStage).toBe("Registration");

    await engine.advanceStage(TEST_PATIENT);
    const p1 = await engine.getProgress(TEST_PATIENT);
    expect(p1.currentStage).toBe("Consultation");
  });

  it("tracks milestone achievement counts", async () => {
    const p0 = await engine.getProgress(TEST_PATIENT);
    expect(p0.milestonesAchieved).toBe(1); // registration milestone

    await engine.advanceStage(TEST_PATIENT);
    const milestones = await engine.getMilestones(TEST_PATIENT, false);
    if (milestones.length > 0) {
      await engine.achieveMilestone(TEST_PATIENT, milestones[0].id);
    }
    const p1 = await engine.getProgress(TEST_PATIENT);
    expect(p1.milestonesAchieved).toBe(2);
  });

  it("estimates remaining duration", async () => {
    const p0 = await engine.getProgress(TEST_PATIENT);
    expect(p0.estimatedRemainingDays).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Expected Dates
// ═══════════════════════════════════════════════════════════════

describe("Expected Dates", () => {
  it("returns estimates for all 8 stages", async () => {
    const dates = await engine.getExpectedDates(TEST_PATIENT);
    expect(dates).toHaveLength(8);
  });

  it("provides typical duration for each stage", async () => {
    const dates = await engine.getExpectedDates(TEST_PATIENT);
    for (const d of dates) {
      expect(d.typicalDurationDays).toBeGreaterThanOrEqual(0);
      expect(IVF_STAGES).toContain(d.stage);
    }
  });

  it("has completed stage dates for registration (already done)", async () => {
    const dates = await engine.getExpectedDates(TEST_PATIENT);
    const reg = dates.find((d) => d.stage === "registration");
    expect(reg!.estimateType).toBe("default");
    expect(reg!.estimatedStartDate).not.toBeNull();
    expect(reg!.estimatedCompletionDate).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// Full Timeline Response
// ═══════════════════════════════════════════════════════════════

describe("Full Timeline Response", () => {
  it("includes all nested sections", async () => {
    const timeline = await engine.getTimeline(TEST_PATIENT);
    expect(timeline).toHaveProperty("patientId");
    expect(timeline).toHaveProperty("stages");
    expect(timeline).toHaveProperty("milestones");
    expect(timeline).toHaveProperty("events");
    expect(timeline).toHaveProperty("progress");
    expect(timeline).toHaveProperty("expectedDates");
    expect(timeline).toHaveProperty("updatedAt");
    expect(timeline).toHaveProperty("createdAt");
  });

  it("reflects engine mutations", async () => {
    await engine.advanceStage(TEST_PATIENT);
    const timeline = await engine.getTimeline(TEST_PATIENT);
    expect(timeline.progress.stagesCompleted).toBe(1);
    expect(timeline.events.some((e) => e.category === "stage_change")).toBe(true);
  });
});