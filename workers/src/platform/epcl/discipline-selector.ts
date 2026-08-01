// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL Discipline Selector                     │
// │ Deterministic activation of disciplines based on the       │
// │ capabilities required by an execution plan. Each           │
// │ activation includes a justification for auditability.      │
// └─────────────────────────────────────────────────────────────┘

import {
  type DisciplineSelection,
  type DisciplineActivation,
  Discipline,
  DISCIPLINE_LABELS,
  type RoadmapEpic,
  type CapabilitySelection,
  type ExecutionBatch,
} from "./types.js";

// ── Error ────────────────────────────────────────────────────

export class DisciplineSelectionError extends Error {
  constructor(message: string) {
    super(`DisciplineSelectionError: ${message}`);
    this.name = "DisciplineSelectionError";
  }
}

// ── Discipline-to-Capability Mapping ─────────────────────────
// Built-in mapping of disciplines to the capabilities they serve.

const DISCIPLINE_CAPABILITY_MAP: Record<Discipline, string[]> = {
  [Discipline.RESEARCH_INTELLIGENCE]: [
    "research.analyze",
    "research.synthesize",
    "research.investigate",
  ],
  [Discipline.ARCHITECTURE_STRATEGY]: [
    "architecture.design",
    "architecture.review",
    "code.review",
    "research.analyze",
  ],
  [Discipline.EXPERIENCE_DESIGN]: [
    "experience.design",
    "experience.review",
    "experience.prototype",
  ],
  [Discipline.ENGINEERING_QUALITY]: [
    "code.generate",
    "code.review",
    "deploy.pages",
    "deploy.workers",
    "db.migrate",
    "db.rollback",
    "test.run",
    "test.verify",
  ],
  [Discipline.BUSINESS_GROWTH]: [
    "business.analyze",
    "business.plan",
    "business.report",
  ],
  [Discipline.PLATFORM_INTELLIGENCE]: [
    "platform.learn",
    "platform.observe",
    "deploy.pages",
    "deploy.workers",
  ],
};

// ── Discipline Selector ──────────────────────────────────────

export class DisciplineSelector {
  private static instance: DisciplineSelector;
  private activations: Map<Discipline, DisciplineActivation> = new Map();

  private constructor() {}

  static getInstance(): DisciplineSelector {
    if (!DisciplineSelector.instance) {
      DisciplineSelector.instance = new DisciplineSelector();
    }
    return DisciplineSelector.instance;
  }

  // ── Selection Logic ─────────────────────────────────────

  /**
   * Determine which disciplines are needed for a set of epics.
   * Deterministic: match epic's assigned disciplines + capabilities → disciplines.
   */
  selectForEpic(epic: RoadmapEpic): DisciplineSelection[] {
    const selections: DisciplineSelection[] = [];
    const matchedDisciplines = new Set<Discipline>();

    // 1. Direct match from epic's assigned disciplines
    for (const assigned of epic.assignedDisciplines) {
      const discipline = this.resolveDiscipline(assigned);
      if (discipline && !matchedDisciplines.has(discipline)) {
        matchedDisciplines.add(discipline);
        selections.push(this.buildSelection(discipline, epic));
      }
    }

    // 2. Infer from required capabilities
    for (const cap of epic.requiredCapabilities) {
      const discipline = this.inferDiscipline(cap);
      if (discipline && !matchedDisciplines.has(discipline)) {
        matchedDisciplines.add(discipline);
        selections.push(this.buildSelection(discipline, epic, `inferred from capability "${cap}"`));
      }
    }

    // 3. If nothing matched, assign a default based on epic content
    if (selections.length === 0) {
      const defaultDiscipline = this.guessDiscipline(epic);
      if (defaultDiscipline) {
        matchedDisciplines.add(defaultDiscipline);
        selections.push(this.buildSelection(defaultDiscipline, epic, "default assignment based on epic content analysis"));
      }
    }

    // Track utilization for each matched discipline
    for (const discipline of matchedDisciplines) {
      this.updateUtilization(discipline);
    }

    return selections;
  }

  /**
   * Select disciplines for a set of capability selections.
   */
  selectForCapabilities(capabilities: CapabilitySelection[]): DisciplineSelection[] {
    const selections: DisciplineSelection[] = [];
    const matched = new Set<Discipline>();

    for (const cap of capabilities) {
      for (const [discipline, caps] of Object.entries(DISCIPLINE_CAPABILITY_MAP)) {
        if (caps.includes(cap.capabilityId) && !matched.has(discipline as Discipline)) {
          matched.add(discipline as Discipline);
          selections.push({
            discipline: discipline as Discipline,
            justification: `Capability "${cap.capabilityId}" is registered under ${DISCIPLINE_LABELS[discipline as Discipline]}`,
            requiredCapabilities: [cap.capabilityId],
            activationScope: cap.capabilityId,
            estimatedLoad: "medium",
          });
        }
      }
    }

    return selections;
  }

  // ── Activation Management ───────────────────────────────

  /**
   * Activate a discipline for a specific scope.
   */
  activate(discipline: Discipline, scope: string, capabilities: string[]): DisciplineActivation {
    const activation: DisciplineActivation = {
      discipline,
      active: true,
      activatedAt: new Date().toISOString(),
      scope,
      capabilities,
      batches: [],
      completedTasks: 0,
      failedTasks: 0,
      utilization: 0,
    };
    this.activations.set(discipline, activation);
    return activation;
  }

  /**
   * Deactivate a discipline.
   */
  deactivate(discipline: Discipline): void {
    const existing = this.activations.get(discipline);
    if (existing) {
      existing.active = false;
    }
  }

  /**
   * Get the current activation state of a discipline.
   */
  getActivation(discipline: Discipline): DisciplineActivation | undefined {
    return this.activations.get(discipline);
  }

  /**
   * Get all active discipline activations.
   */
  getActiveActivations(): DisciplineActivation[] {
    return Array.from(this.activations.values()).filter((a) => a.active);
  }

  /**
   * Record batch assignment for a discipline.
   */
  assignBatch(discipline: Discipline, batchId: string): void {
    const activation = this.activations.get(discipline);
    if (activation) {
      activation.batches.push(batchId);
    }
  }

  /**
   * Record task completion for a discipline.
   */
  recordTaskComplete(discipline: Discipline): void {
    const activation = this.activations.get(discipline);
    if (activation) {
      activation.completedTasks++;
      this.updateUtilization(discipline);
    }
  }

  /**
   * Record task failure for a discipline.
   */
  recordTaskFailed(discipline: Discipline): void {
    const activation = this.activations.get(discipline);
    if (activation) {
      activation.failedTasks++;
      this.updateUtilization(discipline);
    }
  }

  /**
   * Get utilization summary for all disciplines.
   */
  getUtilizationSummary(): Record<Discipline, number> {
    const summary: Record<string, number> = {};
    for (const [discipline, activation] of this.activations) {
      summary[discipline] = activation.utilization;
    }
    return summary as Record<Discipline, number>;
  }

  // ── Private Helpers ─────────────────────────────────────

  private resolveDiscipline(label: string): Discipline | null {
    const normalized = label.toLowerCase().replace(/[^a-z_]/g, "");

    // Direct match
    if (Object.values(Discipline).includes(normalized as Discipline)) {
      return normalized as Discipline;
    }

    // Partial match against labels
    for (const [key, value] of Object.entries(DISCIPLINE_LABELS)) {
      if (value.toLowerCase().includes(normalized) || normalized.includes(key)) {
        return key as Discipline;
      }
    }

    return null;
  }

  private inferDiscipline(capabilityId: string): Discipline | null {
    for (const [discipline, caps] of Object.entries(DISCIPLINE_CAPABILITY_MAP)) {
      if (caps.includes(capabilityId)) {
        return discipline as Discipline;
      }
    }
    return null;
  }

  private guessDiscipline(epic: RoadmapEpic): Discipline | null {
    const text = `${epic.name} ${epic.description}`.toLowerCase();

    if (text.includes("research") || text.includes("investigat") || text.includes("study")) {
      return Discipline.RESEARCH_INTELLIGENCE;
    }
    if (text.includes("architect") || text.includes("design") || text.includes("strategy")) {
      return Discipline.ARCHITECTURE_STRATEGY;
    }
    if (text.includes("ux") || text.includes("ui") || text.includes("experience") || text.includes("interface")) {
      return Discipline.EXPERIENCE_DESIGN;
    }
    if (text.includes("code") || text.includes("test") || text.includes("deploy") || text.includes("build")) {
      return Discipline.ENGINEERING_QUALITY;
    }
    if (text.includes("business") || text.includes("market") || text.includes("growth") || text.includes("revenue")) {
      return Discipline.BUSINESS_GROWTH;
    }
    if (text.includes("platform") || text.includes("learn") || text.includes("knowledge") || text.includes("observe")) {
      return Discipline.PLATFORM_INTELLIGENCE;
    }

    return Discipline.ENGINEERING_QUALITY; // safest default
  }

  private buildSelection(
    discipline: Discipline,
    epic: RoadmapEpic,
    overrideJustification?: string
  ): DisciplineSelection {
    const capabilities = DISCIPLINE_CAPABILITY_MAP[discipline] || [];
    const matchedCaps = capabilities.filter((c) =>
      epic.requiredCapabilities.some((rc) => rc === c || rc.includes(c) || c.includes(rc))
    );

    return {
      discipline,
      justification: overrideJustification ||
        `Epic "${epic.name}" explicitly assigned to ${DISCIPLINE_LABELS[discipline]}`,
      requiredCapabilities: matchedCaps.length > 0 ? matchedCaps : capabilities.slice(0, 3),
      activationScope: epic.id,
      estimatedLoad: this.estimateLoad(epic),
    };
  }

  private estimateLoad(epic: RoadmapEpic): string {
    const milestoneCount = epic.milestones.length;
    const criteriaCount = epic.acceptanceCriteria.length;
    const total = milestoneCount + criteriaCount;
    if (total <= 3) return "low";
    if (total <= 8) return "medium";
    return "high";
  }

  private updateUtilization(discipline: Discipline): void {
    let activation = this.activations.get(discipline);
    if (!activation) {
      // Create initial activation if none exists
      activation = {
        discipline,
        active: true,
        activatedAt: new Date().toISOString(),
        scope: "epic",
        capabilities: [],
        batches: [],
        completedTasks: 1,
        failedTasks: 0,
        utilization: 1.0, // 100% utilization for new activation
      };
      this.activations.set(discipline, activation);
      return;
    }
    const total = activation.completedTasks + activation.failedTasks;
    if (total === 0) {
      activation.utilization = 0;
      return;
    }
    // Utilization = completed / total (simple metric)
    activation.utilization = activation.completedTasks / total;
  }

  // ── Reset for testing ───────────────────────────────────

  reset(): void {
    this.activations.clear();
  }
}