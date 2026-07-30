// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL RoadmapEngine                             │
// │ ADR-018 · Capability #14 · Ingestion & Validation            │
// │ Ingests unstructured roadmap docs → structured hierarchy.    │
// └─────────────────────────────────────────────────────────────┘

import type { RoadmapHierarchy, PhaseDef, WaveDef, EpicDef } from "../../contracts/planning.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  phases_found: number;
  waves_found: number;
  epics_found: number;
}

export interface RoadmapDiff {
  added_phases: PhaseDef[];
  removed_phases: string[];
  added_waves: WaveDef[];
  removed_waves: string[];
  added_epics: EpicDef[];
  removed_epics: string[];
  changed_items: string[];
}

/**
 * RoadmapEngine: Ingests unstructured roadmap documentation and
 * produces a structured, validated roadmap hierarchy.
 *
 * This is the entry point for EPCL planning — all planning begins
 * with a structured roadmap.
 *
 * Design decisions:
 * - Deterministic parsing from structured markdown sections
 * - Validation enforces hierarchy completeness (no orphaned waves/epics)
 * - Diff enables incremental planning across sessions
 */
export class RoadmapEngine {
  private currentHierarchy: RoadmapHierarchy | null = null;

  /**
   * Ingest roadmap documentation paths and produce a structured hierarchy.
   * In v1.0, this reads from markdown files with known section headers.
   * Future: reads from PSER RoadmapRegistry interface.
   */
  async ingest(paths: string[]): Promise<RoadmapHierarchy> {
    const hierarchy: RoadmapHierarchy = {
      phases: [],
      waves: [],
      epics: [],
    };

    for (const path of paths) {
      try {
        // Read and parse the document
        const content = await this.readDocument(path);
        const parsed = this.parseDocument(content, path);
        hierarchy.phases.push(...parsed.phases);
        hierarchy.waves.push(...parsed.waves);
        hierarchy.epics.push(...parsed.epics);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new RoadmapIngestionError(`Failed to ingest ${path}: ${msg}`);
      }
    }

    this.currentHierarchy = hierarchy;
    return hierarchy;
  }

  /**
   * Validate the roadmap hierarchy for completeness and consistency.
   * Returns a ValidationResult with errors and warnings.
   */
  validate(hierarchy: RoadmapHierarchy): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check that all waves have a parent phase
    for (const wave of hierarchy.waves) {
      const parent = hierarchy.phases.find((p) => p.id === wave.phase_id);
      if (!parent) {
        errors.push(`Wave "${wave.name}" (${wave.id}) references missing phase ${wave.phase_id}`);
      }
    }

    // Check that all epics have a parent wave
    for (const epic of hierarchy.epics) {
      const parent = hierarchy.waves.find((w) => w.id === epic.wave_id);
      if (!parent) {
        errors.push(`Epic "${epic.name}" (${epic.id}) references missing wave ${epic.wave_id}`);
      }
    }

    // Check for empty phases
    for (const phase of hierarchy.phases) {
      const waveCount = hierarchy.waves.filter((w) => w.phase_id === phase.id).length;
      if (waveCount === 0) {
        warnings.push(`Phase "${phase.name}" (${phase.id}) has no waves`);
      }
    }

    // Check for empty waves
    for (const wave of hierarchy.waves) {
      const epicCount = hierarchy.epics.filter((e) => e.wave_id === wave.id).length;
      if (epicCount === 0) {
        warnings.push(`Wave "${wave.name}" (${wave.id}) has no epics`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      phases_found: hierarchy.phases.length,
      waves_found: hierarchy.waves.length,
      epics_found: hierarchy.epics.length,
    };
  }

  /**
   * Returns the current structured hierarchy (last ingested).
   */
  hierarchy(): RoadmapHierarchy | null {
    return this.currentHierarchy;
  }

  /**
   * Produce a diff between two roadmap hierarchies.
   * Useful for incremental planning across sessions.
   */
  diff(old: RoadmapHierarchy, current: RoadmapHierarchy): RoadmapDiff {
    const diff: RoadmapDiff = {
      added_phases: [],
      removed_phases: [],
      added_waves: [],
      removed_waves: [],
      added_epics: [],
      removed_epics: [],
      changed_items: [],
    };

    // Detect added/removed phases
    const oldPhaseIds = new Set(old.phases.map((p) => p.id));
    const newPhaseIds = new Set(current.phases.map((p) => p.id));

    diff.added_phases = current.phases.filter((p) => !oldPhaseIds.has(p.id));
    diff.removed_phases = old.phases.filter((p) => !newPhaseIds.has(p.id)).map((p) => p.id);

    // Detect added/removed waves
    const oldWaveIds = new Set(old.waves.map((w) => w.id));
    const newWaveIds = new Set(current.waves.map((w) => w.id));

    diff.added_waves = current.waves.filter((w) => !oldWaveIds.has(w.id));
    diff.removed_waves = old.waves.filter((w) => !newWaveIds.has(w.id)).map((w) => w.id);

    // Detect added/removed epics
    const oldEpicIds = new Set(old.epics.map((e) => e.id));
    const newEpicIds = new Set(current.epics.map((e) => e.id));

    diff.added_epics = current.epics.filter((e) => !oldEpicIds.has(e.id));
    diff.removed_epics = old.epics.filter((e) => !newEpicIds.has(e.id)).map((e) => e.id);

    return diff;
  }

  /**
   * Read a document from the filesystem.
   * Uses Deno/Node-compatible path resolution.
   */
  private async readDocument(path: string): Promise<string> {
    // In Workers environment, read via env bindings
    // In Hermes environment, read via file system
    // For v1.0, this is a placeholder that returns empty string
    // Real implementation will use the platform's document reader
    return "";
  }

  /**
   * Parse a document into structured roadmap data.
   * Expects markdown with known section headers:
   *   ## Phase N — Name
   *   ### Wave N - Name
   *   #### EPIC-X.Y.Z — Name
   */
  private parseDocument(content: string, path: string): RoadmapHierarchy {
    const phases: PhaseDef[] = [];
    const waves: WaveDef[] = [];
    const epics: EpicDef[] = [];

    // TODO: Implement markdown-based hierarchy parsing
    // Pattern: Phase headers → Wave headers → Epic headers
    // For v1.0, returns empty hierarchy (structure is designed, impl is in Hermes skill)

    return { phases, waves, epics };
  }
}

export class RoadmapIngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoadmapIngestionError";
  }
}