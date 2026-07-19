// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Developer Automation — Documentation Pipeline            │
// │ EPIC-003-002 · M6                                            │
// │ Determines documentation updates. May produce:                 │
// │  • ADR recommendation (ONLY when a genuinely new architectural  │
// │    decision is introduced)                                     │
// │  • Roadmap update   • Completion report   • Release notes      │
// │  • Architecture docs                                                │
// └─────────────────────────────────────────────────────────────┘

import type { DevelopmentWorkRequest, WorkKind } from "./work-request.js";
import type { AgentContribution } from "../execution/review-pipeline.js";

export type DocKind = "adr" | "roadmap" | "completion" | "release-notes" | "architecture";

export interface DocRecommendation {
  kind: DocKind;
  capability: string;
  title: string;
  body: string;
  /** True only for ADR when a new architectural decision is justified. */
  justified: boolean;
}

const DOC_CAP_MAP: Record<DocKind, string> = {
  adr: "docs.adr",
  roadmap: "docs.roadmap",
  completion: "docs.completion",
  "release-notes": "docs.release-notes",
  architecture: "docs.architecture",
};

/**
 * Decide which documentation artifacts to produce.
 *
 * ADR rule (fail-closed on over-documentation): an ADR is recommended ONLY when
 * the request introduces a new architectural decision — i.e. kind === "refactor"
 * or "architecture-affecting" feature, OR it touches a provider/security
 * boundary. Routine features/bugs/docs/testing do NOT spawn an ADR.
 */
export function recommendDocs(req: DevelopmentWorkRequest): DocRecommendation[] {
  const recs: DocRecommendation[] = [];

  // ADR — only when justified.
  const adrJustified =
    req.kind === "refactor" ||
    (req.kind === "feature" && req.constraints.some((c) => c.kind === "policy" || c.kind === "compliance")) ||
    req.affectedModules.some((m) => /provider|boundary|auth|security/i.test(m));
  if (adrJustified) {
    recs.push({
      kind: "adr",
      capability: DOC_CAP_MAP.adr,
      title: `ADR: ${req.title}`,
      body: `Record the architectural decision introduced by "${req.title}" (${req.kind}).`,
      justified: true,
    });
  }

  // Always produce a completion report and release notes for shippable kinds.
  if (req.kind !== "documentation") {
    recs.push({
      kind: "completion",
      capability: DOC_CAP_MAP.completion,
      title: `Completion report: ${req.title}`,
      body: `Summarize implemented change, tests, and validation for ${req.requestId}.`,
      justified: true,
    });
    recs.push({
      kind: "release-notes",
      capability: DOC_CAP_MAP["release-notes"],
      title: `Release notes: ${req.title}`,
      body: `User-facing summary of "${req.title}" for the ${req.targetApplication} changelog.`,
      justified: true,
    });
  }

  // Roadmap update when a milestone-closing kind.
  if (req.kind === "feature" || req.kind === "refactor") {
    recs.push({
      kind: "roadmap",
      capability: DOC_CAP_MAP.roadmap,
      title: `Roadmap update: ${req.title}`,
      body: `Mark the relevant roadmap milestone item complete for ${req.requestId}.`,
      justified: true,
    });
  }

  // Architecture docs when provider/security boundary touched.
  if (req.affectedModules.some((m) => /provider|boundary|architecture/i.test(m))) {
    recs.push({
      kind: "architecture",
      capability: DOC_CAP_MAP.architecture,
      title: `Architecture note: ${req.title}`,
      body: `Update architecture docs for changed modules: ${req.affectedModules.join(", ")}.`,
      justified: true,
    });
  }

  return recs;
}

export function docsContributions(recs: DocRecommendation[]): AgentContribution[] {
  return recs.map((r) => ({
    agentId: "documentation-agent",
    domain: "docs" as const,
    capability: r.capability,
    artifact: {
      docKind: r.kind,
      justified: r.justified,
      targetFile: `docs/sim_${r.kind}_${r.capability.replace(/\./g, "_")}.md`,
      approvalToken: "sim-token",
    },
    privileged: false,
    notes: r.justified ? `SIM doc: ${r.title}` : `SIM doc skipped: ${r.title}`,
  }));
}

/** Convenience: which kinds were recommended (for reporting). */
export function recommendedDocKinds(req: DevelopmentWorkRequest): DocKind[] {
  return recommendDocs(req).map((r) => r.kind);
}
