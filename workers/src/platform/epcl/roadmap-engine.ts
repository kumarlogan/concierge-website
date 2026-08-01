// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL Roadmap Engine                          │
// │ Deterministic parsing of roadmap documents into structured │
// │ Roadmap objects. No LLM calls — pure functional parsing.   │
// └─────────────────────────────────────────────────────────────┘

import {
  FeatureFlag,
  type Roadmap,
  type RoadmapPhase,
  type RoadmapEpic,
  type RoadmapMilestone,
  type Dependency,
  DependencyType,
  PhaseStatus,
  EpicStatus,
  MilestoneStatus,
} from "./types.js";
import { isEnabled } from "./feature-flags.js";

// ── Errors ───────────────────────────────────────────────────

export class RoadmapParseError extends Error {
  constructor(
    message: string,
    public readonly source: string,
    public readonly line?: number
  ) {
    super(`RoadmapParseError: ${message} (source: ${source}${line !== undefined ? `, line: ${line}` : ""})`);
    this.name = "RoadmapParseError";
  }
}

export class RoadmapValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(`RoadmapValidationError: ${errors.join("; ")}`);
    this.name = "RoadmapValidationError";
  }
}

// ── Roadmap Engine ───────────────────────────────────────────

export class RoadmapEngine {
  private static instance: RoadmapEngine;
  private roadmaps: Map<string, Roadmap> = new Map();

  private constructor() {}

  static getInstance(): RoadmapEngine {
    if (!RoadmapEngine.instance) {
      RoadmapEngine.instance = new RoadmapEngine();
    }
    return RoadmapEngine.instance;
  }

  // ── Markdown Parsing ────────────────────────────────────

  /**
   * Parse a markdown roadmap document into a structured Roadmap object.
   * Supports a simple document format with sections for phases, epics, milestones.
   *
   * Expected format:
   *   # Roadmap Title
   *   Description line
   *   ## Phase: Name
   *   - description
   *   ### Epic: Name
   *   - description
   *   - dependency: id
   *   - effort: 3d
   *   - priority: 1
   *   #### Milestone: Name
   *   - description
   *   - due: 2026-08-15
   *   - deliverable: thing
   *   - verify: criteria
   */
  parseMarkdown(id: string, content: string, source: string): Roadmap {
    if (!isEnabled(FeatureFlag.ENABLE_ROADMAP_INGESTION)) {
      throw new RoadmapParseError(
        "Roadmap ingestion is disabled. Enable FeatureFlag.ENABLE_ROADMAP_INGESTION.",
        source
      );
    }

    const lines = content.split("\n");
    const title = this.extractTitle(lines);
    const description = this.extractDescription(lines, title);
    const phases = this.extractPhases(lines);
    const dependencies = this.extractDependencies(phases);

    return {
      id,
      title,
      description,
      phases,
      dependencies,
      metadata: {
        source,
        version: "1.0",
        author: "epcl-roadmap-engine",
        approved: false,
        tags: [],
        references: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private extractTitle(lines: string[]): string {
    for (const line of lines) {
      const match = line.match(/^#\s+(.+)$/);
      if (match) return match[1].trim();
    }
    throw new RoadmapParseError("No title found (expected # Title)", "markdown");
  }

  private extractDescription(lines: string[], title: string): string {
    const titleLine = lines.findIndex((l) => l.match(/^#\s+/));
    if (titleLine < 0) return "";
    // Grab the next non-empty line after the title
    for (let i = titleLine + 1; i < Math.min(titleLine + 5, lines.length); i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith("#")) return line;
    }
    return "";
  }

  private extractPhases(lines: string[]): RoadmapPhase[] {
    const phases: RoadmapPhase[] = [];
    let currentPhase: Partial<RoadmapPhase> | null = null;
    let currentEpic: Partial<RoadmapEpic> | null = null;
    let currentMilestone: Partial<RoadmapMilestone> | null = null;
    let phaseOrder = 0;
    let epicOrder = 0;
    let milestoneOrder = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Phase: ## Phase: Name
      const phaseMatch = line.match(/^##\s+Phase:\s+(.+)$/i);
      if (phaseMatch) {
        if (currentEpic && currentMilestone) {
          this.finalizeMilestone(currentMilestone, milestoneOrder);
          currentEpic.milestones = currentEpic.milestones || [];
          currentEpic.milestones.push(currentMilestone as RoadmapMilestone);
          currentMilestone = null;
        }
        if (currentEpic) {
          if (!currentPhase) currentPhase = phases[phases.length - 1] ?? { id: "", title: "", epics: [], milestones: [] };
          currentPhase.epics = currentPhase.epics || [];
          currentPhase.epics.push(currentEpic as RoadmapEpic);
          currentEpic = null;
        }
        if (currentPhase) {
          phases.push(currentPhase as RoadmapPhase);
        }
        currentPhase = {
          id: `phase-${phaseOrder}`,
          name: phaseMatch[1].trim(),
          description: "",
          order: phaseOrder++,
          epics: [],
          status: PhaseStatus.PLANNED,
        };
        currentEpic = null;
        currentMilestone = null;
        epicOrder = 0;
        milestoneOrder = 0;
        continue;
      }

      // Epic: ### Epic: Name
      const epicMatch = line.match(/^###\s+Epic:\s+(.+)$/i);
      if (epicMatch && currentPhase) {
        // Push previous epic to phase before creating a new one
        if (currentEpic) {
          currentPhase.epics = currentPhase.epics || [];
          currentPhase.epics.push(currentEpic as RoadmapEpic);
        }

        if (currentMilestone) {
          this.finalizeMilestone(currentMilestone, milestoneOrder);
          currentEpic = currentEpic || {};
          currentEpic.milestones = currentEpic.milestones || [];
          currentEpic.milestones.push(currentMilestone as RoadmapMilestone);
          currentMilestone = null;
        }

        currentEpic = {
          id: `epic-${currentPhase.order}-${epicOrder}`,
          name: epicMatch[1].trim(),
          description: "",
          milestones: [],
          dependencies: [],
          parallelizable: false,
          estimatedEffort: "",
          priority: epicOrder,
          status: EpicStatus.BACKLOG,
          assignedDisciplines: [],
          requiredCapabilities: [],
          acceptanceCriteria: [],
          blockedBy: [],
          blocking: [],
        };
        epicOrder++;
        milestoneOrder = 0;
        continue;
      }

      // Milestone: #### Milestone: Name
      const milestoneMatch = line.match(/^####\s+Milestone:\s+(.+)$/i);
      if (milestoneMatch && currentEpic) {
        if (currentMilestone) {
          this.finalizeMilestone(currentMilestone, milestoneOrder);
          currentEpic.milestones = currentEpic.milestones || [];
          currentEpic.milestones.push(currentMilestone as RoadmapMilestone);
        }
        currentMilestone = {
          id: `milestone-${currentEpic.id}-${milestoneOrder}`,
          name: milestoneMatch[1].trim(),
          description: "",
          order: milestoneOrder++,
          deliverables: [],
          verificationCriteria: [],
          status: MilestoneStatus.PENDING,
        };
        continue;
      }

      // Description lines
      if (line.startsWith("- description:")) {
        const desc = line.replace(/^- description:\s*/, "").trim();
        if (currentMilestone) currentMilestone.description = desc;
        else if (currentEpic) currentEpic.description = desc;
        else if (currentPhase) currentPhase.description = desc;
      } else if (line.startsWith("- dependency:")) {
        const dep = line.replace(/^- dependency:\s*/, "").trim();
        if (currentEpic) {
          currentEpic.dependencies = currentEpic.dependencies || [];
          currentEpic.dependencies.push(dep);
        }
      } else if (line.startsWith("- effort:")) {
        const effort = line.replace(/^- effort:\s*/, "").trim();
        if (currentEpic) currentEpic.estimatedEffort = effort;
      } else if (line.startsWith("- priority:")) {
        const priority = parseInt(line.replace(/^- priority:\s*/, "").trim(), 10);
        if (currentEpic && !isNaN(priority)) currentEpic.priority = priority;
      } else if (line.startsWith("- parallel:")) {
        const val = line.replace(/^- parallel:\s*/, "").trim().toLowerCase();
        if (currentEpic) currentEpic.parallelizable = val === "true" || val === "yes";
      } else if (line.startsWith("- discipline:")) {
        const disc = line.replace(/^- discipline:\s*/, "").trim();
        if (currentEpic) {
          currentEpic.assignedDisciplines = currentEpic.assignedDisciplines || [];
          disc.split(",").map((d) => d.trim()).forEach((d) => {
            if (d && !currentEpic!.assignedDisciplines!.includes(d)) {
              currentEpic!.assignedDisciplines!.push(d);
            }
          });
        }
      } else if (line.startsWith("- capability:")) {
        const cap = line.replace(/^- capability:\s*/, "").trim();
        if (currentEpic) {
          currentEpic.requiredCapabilities = currentEpic.requiredCapabilities || [];
          cap.split(",").map((c) => c.trim()).forEach((c) => {
            if (c && !currentEpic!.requiredCapabilities!.includes(c)) {
              currentEpic!.requiredCapabilities!.push(c);
            }
          });
        }
      } else if (line.startsWith("- deliverable:")) {
        const del = line.replace(/^- deliverable:\s*/, "").trim();
        if (currentMilestone && del) {
          currentMilestone.deliverables = currentMilestone.deliverables || [];
          currentMilestone.deliverables.push(del);
        }
      } else if (line.startsWith("- verify:")) {
        const crit = line.replace(/^- verify:\s*/, "").trim();
        if (currentMilestone && crit) {
          currentMilestone.verificationCriteria = currentMilestone.verificationCriteria || [];
          currentMilestone.verificationCriteria.push(crit);
        }
      } else if (line.startsWith("- due:")) {
        const due = line.replace(/^- due:\s*/, "").trim();
        if (currentMilestone && due) {
          currentMilestone.dueDate = due;
        }
      }
    }

    // Finalize remaining
    if (currentMilestone && currentEpic) {
      this.finalizeMilestone(currentMilestone, milestoneOrder);
      currentEpic.milestones = currentEpic.milestones || [];
      currentEpic.milestones.push(currentMilestone as RoadmapMilestone);
    }
    if (currentEpic && currentPhase) {
      currentPhase.epics = currentPhase.epics || [];
      currentPhase.epics.push(currentEpic as RoadmapEpic);
    }
    if (currentPhase) {
      phases.push(currentPhase as RoadmapPhase);
    }

    // Ensure every phase has a populated epics array
    for (const phase of phases) {
      phase.epics = phase.epics || [];
    }

    return phases;
  }

  private finalizeMilestone(milestone: Partial<RoadmapMilestone>, order: number): void {
    milestone.order = order;
    milestone.status = milestone.status || MilestoneStatus.PENDING;
    milestone.deliverables = milestone.deliverables || [];
    milestone.verificationCriteria = milestone.verificationCriteria || [];
  }

  private extractDependencies(phases: RoadmapPhase[]): Dependency[] {
    const deps: Dependency[] = [];
    const allEpics = phases.flatMap((p) => p.epics);

    // Collect all epic-level dependencies
    for (const epic of allEpics) {
      for (const depTarget of epic.dependencies) {
        deps.push({
          id: `dep-${epic.id}-${depTarget}`,
          sourceId: epic.id,
          targetId: depTarget,
          type: DependencyType.BLOCKS,
          description: `Phase ${epic.name} depends on ${depTarget}`,
          satisfied: false,
        });
      }
    }

    return deps;
  }

  // ── CRUD ─────────────────────────────────────────────────

  register(roadmap: Roadmap): void {
    this.roadmaps.set(roadmap.id, roadmap);
  }

  get(id: string): Roadmap | undefined {
    return this.roadmaps.get(id);
  }

  list(): Roadmap[] {
    return Array.from(this.roadmaps.values());
  }

  remove(id: string): boolean {
    return this.roadmaps.delete(id);
  }

  // ── Analysis ─────────────────────────────────────────────

  /**
   * Analyze a roadmap to identify key characteristics.
   * Deterministic — no LLM calls.
   */
  analyze(roadmapId: string): RoadmapAnalysis {
    const roadmap = this.roadmaps.get(roadmapId);
    if (!roadmap) {
      throw new RoadmapParseError(`Roadmap ${roadmapId} not found`, roadmapId);
    }

    const allEpics = roadmap.phases.flatMap((p) => p.epics);
    const allMilestones = allEpics.flatMap((e) => e.milestones);
    const totalDependencies = roadmap.dependencies.length;
    const satisfiedDependencies = roadmap.dependencies.filter((d) => d.satisfied).length;
    const blockedEpics = allEpics.filter((e) => e.status === EpicStatus.BLOCKED);
    const readyEpics = allEpics.filter((e) => e.status === EpicStatus.READY);
    const disciplines = new Set(allEpics.flatMap((e) => e.assignedDisciplines));
    const capabilities = new Set(allEpics.flatMap((e) => e.requiredCapabilities));

    return {
      totalPhases: roadmap.phases.length,
      totalEpics: allEpics.length,
      totalMilestones: allMilestones.length,
      totalDependencies,
      satisfiedDependencies,
      blockedEpics: blockedEpics.length,
      readyEpics: readyEpics.length,
      disciplines: Array.from(disciplines),
      capabilities: Array.from(capabilities),
      hasCircularDependencies: this.detectCircularDependencies(roadmap),
      estimatedEffort: this.estimateTotalEffort(allEpics),
      dependencyCoverage: totalDependencies > 0
        ? satisfiedDependencies / totalDependencies
        : 1,
      phases: roadmap.phases.map((p) => ({
        id: p.id,
        name: p.name,
        epicCount: p.epics.length,
        status: p.status,
      })),
    };
  }

  private detectCircularDependencies(roadmap: Roadmap): boolean {
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const dfs = (epicId: string): boolean => {
      if (inStack.has(epicId)) return true;
      if (visited.has(epicId)) return false;
      visited.add(epicId);
      inStack.add(epicId);

      const deps = roadmap.dependencies.filter((d) => d.sourceId === epicId);
      for (const dep of deps) {
        if (dfs(dep.targetId)) return true;
      }

      inStack.delete(epicId);
      return false;
    };

    const allEpicIds = roadmap.phases.flatMap((p) => p.epics.map((e) => e.id));
    for (const id of allEpicIds) {
      if (dfs(id)) return true;
    }
    return false;
  }

  private estimateTotalEffort(epics: RoadmapEpic[]): string {
    // Simple heuristic: sum effort strings
    let totalDays = 0;
    for (const epic of epics) {
      const effort = epic.estimatedEffort.toLowerCase();
      const numMatch = effort.match(/(\d+)/);
      if (!numMatch) continue;
      const num = parseInt(numMatch[1], 10);
      if (effort.includes("w")) totalDays += num * 5;
      else if (effort.includes("m")) totalDays += num * 20;
      else if (effort.includes("h")) totalDays += Math.ceil(num / 8);
      else totalDays += num; // days
    }
    if (totalDays === 0) return "unknown";
    if (totalDays >= 20) return `${Math.ceil(totalDays / 20)}m`;
    if (totalDays >= 5) return `${Math.ceil(totalDays / 5)}w`;
    return `${totalDays}d`;
  }

  /** Reset engine state. For testing. */
  reset(): void {
    this.roadmaps.clear();
  }
}

// ── Analysis Result ──────────────────────────────────────────

export interface RoadmapAnalysis {
  totalPhases: number;
  totalEpics: number;
  totalMilestones: number;
  totalDependencies: number;
  satisfiedDependencies: number;
  blockedEpics: number;
  readyEpics: number;
  disciplines: string[];
  capabilities: string[];
  hasCircularDependencies: boolean;
  estimatedEffort: string;
  dependencyCoverage: number;
  phases: PhaseAnalysis[];
}

export interface PhaseAnalysis {
  id: string;
  name: string;
  epicCount: number;
  status: PhaseStatus;
}