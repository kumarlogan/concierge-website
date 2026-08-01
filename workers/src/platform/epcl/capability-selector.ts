// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL Capability Selector                     │
// │ Deterministic routing of epic requirements to platform     │
// │ capabilities. No LLM calls — pure registry lookup.         │
// └─────────────────────────────────────────────────────────────┘

import {
  type CapabilitySelection,
  type CapabilityAvailability,
  SelectionReason,
  CapabilitySource,
  type RoadmapEpic,
} from "./types.js";

// ── Error ────────────────────────────────────────────────────

export class CapabilitySelectionError extends Error {
  constructor(
    message: string,
    public readonly capabilityId: string
  ) {
    super(`CapabilitySelectionError: ${message} (capability: ${capabilityId})`);
    this.name = "CapabilitySelectionError";
  }
}

// ── Capability Registry Entry ────────────────────────────────

export interface CapabilityEntry {
  id: string;
  name: string;
  description: string;
  provider: string;
  healthy: boolean;
  enabled: boolean;
  active: boolean;
  requiresApproval: boolean;
  estimatedCost: number;
  fallbackCapabilities: string[];
  keywords: string[];
  disciplines: string[];
  registeredAt: string;
}

// ── Capability Selector ──────────────────────────────────────

export class CapabilitySelector {
  private static instance: CapabilitySelector;
  private registry: Map<string, CapabilityEntry> = new Map();

  private constructor() {}

  static getInstance(): CapabilitySelector {
    if (!CapabilitySelector.instance) {
      CapabilitySelector.instance = new CapabilitySelector();
    }
    return CapabilitySelector.instance;
  }

  // ── Registry Management ─────────────────────────────────

  /** Register a capability in the selector's registry. */
  register(entry: CapabilityEntry): void {
    this.registry.set(entry.id, entry);
  }

  /** Get a capability entry by ID. */
  get(id: string): CapabilityEntry | undefined {
    return this.registry.get(id);
  }

  /** List all registered capabilities. */
  list(): CapabilityEntry[] {
    return Array.from(this.registry.values());
  }

  /** Remove a capability from the registry. */
  remove(id: string): boolean {
    return this.registry.delete(id);
  }

  /** Check availability of a capability. */
  checkAvailability(id: string): CapabilityAvailability {
    const entry = this.registry.get(id);
    if (!entry) {
      return {
        capabilityId: id,
        available: false,
        provider: null,
        healthy: false,
        enabled: false,
        active: false,
        approvalRequired: false,
        error: `Capability "${id}" not found in registry`,
      };
    }
    return {
      capabilityId: id,
      available: entry.healthy && entry.enabled && entry.active,
      provider: entry.provider,
      healthy: entry.healthy,
      enabled: entry.enabled,
      active: entry.active,
      approvalRequired: entry.requiresApproval,
    };
  }

  // ── Selection Logic ─────────────────────────────────────

  /**
   * Select capabilities for a set of epic requirements.
   * Deterministic matching: exact match → keyword match → discipline match.
   */
  selectForEpic(epic: RoadmapEpic): CapabilitySelection[] {
    const selections: CapabilitySelection[] = [];
    const matched = new Set<string>();

    for (const requiredCap of epic.requiredCapabilities) {
      // 1. Exact match (preferred)
      let match = this.registry.get(requiredCap);
      if (match) {
        matched.add(match.id);
        selections.push({
          capabilityId: match.id,
          selectionReason: SelectionReason.EXISTING_CAPABILITY,
          source: CapabilitySource.PROVIDER_REGISTRY,
          provider: match.provider,
          requiresApproval: match.requiresApproval,
          estimatedCost: match.estimatedCost,
          fallbackCapabilities: match.fallbackCapabilities,
        });
        continue;
      }

      // 2. Keyword match
      const keywordMatches = Array.from(this.registry.values()).filter((e) =>
        e.keywords.some((kw) =>
          requiredCap.toLowerCase().includes(kw.toLowerCase()) ||
          kw.toLowerCase().includes(requiredCap.toLowerCase())
        )
      );
      if (keywordMatches.length > 0) {
        const best = keywordMatches[0]; // First match wins
        matched.add(best.id);
        selections.push({
          capabilityId: best.id,
          selectionReason: SelectionReason.EXISTING_CAPABILITY,
          source: CapabilitySource.PROVIDER_REGISTRY,
          provider: best.provider,
          requiresApproval: best.requiresApproval,
          estimatedCost: best.estimatedCost,
          fallbackCapabilities: best.fallbackCapabilities,
        });
        continue;
      }

      // 3. Discipline-based match
      const disciplineMatches = Array.from(this.registry.values()).filter((e) =>
        e.disciplines.some((d) =>
          epic.assignedDisciplines.some((ed) =>
            ed.toLowerCase() === d.toLowerCase()
          )
        )
      );
      if (disciplineMatches.length > 0) {
        const best = disciplineMatches[0];
        matched.add(best.id);
        selections.push({
          capabilityId: best.id,
          selectionReason: SelectionReason.EXISTING_KNOWLEDGE,
          source: CapabilitySource.KNOWLEDGE_BASE,
          provider: best.provider,
          requiresApproval: best.requiresApproval,
          estimatedCost: best.estimatedCost,
          fallbackCapabilities: best.fallbackCapabilities,
        });
        continue;
      }

      // 4. No match — mark as new work
      selections.push({
        capabilityId: requiredCap,
        selectionReason: SelectionReason.NEW_WORK,
        source: CapabilitySource.NEW_REGISTRATION,
        provider: "unknown",
        requiresApproval: true,
        estimatedCost: 10,
        fallbackCapabilities: [],
      });
    }

    return selections;
  }

  /**
   * Select capabilities for a set of discipline requirements.
   * Returns capabilities that can serve a given discipline.
   */
  selectForDiscipline(discipline: string): CapabilitySelection[] {
    const matches = Array.from(this.registry.values()).filter((e) =>
      e.disciplines.some((d) => d.toLowerCase() === discipline.toLowerCase())
    );

    if (matches.length === 0) {
      return [];
    }

    return matches.map((match) => ({
      capabilityId: match.id,
      selectionReason: SelectionReason.EXISTING_CAPABILITY,
      source: CapabilitySource.PROVIDER_REGISTRY,
      provider: match.provider,
      requiresApproval: match.requiresApproval,
      estimatedCost: match.estimatedCost,
      fallbackCapabilities: match.fallbackCapabilities,
    }));
  }

  /** Get the provider for a selected capability. */
  getProvider(capabilityId: string): string | null {
    const entry = this.registry.get(capabilityId);
    return entry ? entry.provider : null;
  }

  /** Check if a capability requires approval. */
  requiresApproval(capabilityId: string): boolean {
    const entry = this.registry.get(capabilityId);
    return entry ? entry.requiresApproval : true; // fail-closed: unknown requires approval
  }

  // ── Reset for testing ───────────────────────────────────

  reset(): void {
    this.registry.clear();
  }

  /** Register built-in capabilities from the WEF capability graph. */
  registerBuiltIn(): void {
    // These reflect the WEF v2 capability graph capabilities
    // Plus all 21 capabilities referenced by the DISCIPLINE_CAPABILITY_MAP
    const builtIns: CapabilityEntry[] = [
      // ── Engineering & Quality (8 capabilities) ─────────────
      {
        id: "deploy.pages",
        name: "Deploy Pages",
        description: "Deploy static pages to Cloudflare Pages",
        provider: "wrangler",
        healthy: true,
        enabled: true,
        active: true,
        requiresApproval: true,
        estimatedCost: 1,
        fallbackCapabilities: [],
        keywords: ["deploy", "pages", "cloudflare", "publish"],
        disciplines: ["engineering_quality", "platform_intelligence"],
        registeredAt: new Date().toISOString(),
      },
      {
        id: "deploy.workers",
        name: "Deploy Workers",
        description: "Deploy Cloudflare Workers",
        provider: "wrangler",
        healthy: true,
        enabled: true,
        active: true,
        requiresApproval: true,
        estimatedCost: 1,
        fallbackCapabilities: [],
        keywords: ["deploy", "worker", "cloudflare"],
        disciplines: ["engineering_quality", "platform_intelligence"],
        registeredAt: new Date().toISOString(),
      },
      {
        id: "db.migrate",
        name: "Database Migration",
        description: "Run D1 database migrations",
        provider: "wrangler",
        healthy: true,
        enabled: true,
        active: true,
        requiresApproval: true,
        estimatedCost: 2,
        fallbackCapabilities: ["db.rollback"],
        keywords: ["database", "migration", "d1", "schema"],
        disciplines: ["engineering_quality"],
        registeredAt: new Date().toISOString(),
      },
      {
        id: "db.rollback",
        name: "Database Rollback",
        description: "Roll back D1 database migrations",
        provider: "wrangler",
        healthy: true,
        enabled: true,
        active: true,
        requiresApproval: true,
        estimatedCost: 2,
        fallbackCapabilities: [],
        keywords: ["database", "rollback", "d1"],
        disciplines: ["engineering_quality"],
        registeredAt: new Date().toISOString(),
      },
      {
        id: "code.review",
        name: "Code Review",
        description: "Automated code review and quality analysis",
        provider: "hermes",
        healthy: true,
        enabled: true,
        active: true,
        requiresApproval: false,
        estimatedCost: 5,
        fallbackCapabilities: [],
        keywords: ["review", "code", "quality", "lint"],
        disciplines: ["engineering_quality", "architecture_strategy"],
        registeredAt: new Date().toISOString(),
      },
      {
        id: "code.generate",
        name: "Code Generation",
        description: "Generate code from specifications",
        provider: "hermes",
        healthy: true,
        enabled: true,
        active: true,
        requiresApproval: false,
        estimatedCost: 10,
        fallbackCapabilities: [],
        keywords: ["generate", "code", "write", "implement"],
        disciplines: ["engineering_quality"],
        registeredAt: new Date().toISOString(),
      },
      {
        id: "test.run",
        name: "Test Runner",
        description: "Run test suites and verify results",
        provider: "hermes",
        healthy: true,
        enabled: true,
        active: true,
        requiresApproval: false,
        estimatedCost: 3,
        fallbackCapabilities: [],
        keywords: ["test", "run", "verify", "spec"],
        disciplines: ["engineering_quality"],
        registeredAt: new Date().toISOString(),
      },
      {
        id: "test.verify",
        name: "Test Verification",
        description: "Verify test results and generate coverage reports",
        provider: "hermes",
        healthy: true,
        enabled: true,
        active: true,
        requiresApproval: false,
        estimatedCost: 3,
        fallbackCapabilities: [],
        keywords: ["test", "verify", "coverage", "validation"],
        disciplines: ["engineering_quality"],
        registeredAt: new Date().toISOString(),
      },
      // ── Research Intelligence (3 capabilities) ────────────
      {
        id: "research.analyze",
        name: "Research Analysis",
        description: "Analyze and synthesize research findings",
        provider: "hermes",
        healthy: true,
        enabled: true,
        active: true,
        requiresApproval: false,
        estimatedCost: 5,
        fallbackCapabilities: [],
        keywords: ["research", "analyze", "synthesize", "investigate"],
        disciplines: ["research_intelligence", "architecture_strategy"],
        registeredAt: new Date().toISOString(),
      },
      {
        id: "research.synthesize",
        name: "Research Synthesis",
        description: "Synthesize multiple research sources into cohesive findings",
        provider: "hermes",
        healthy: true,
        enabled: true,
        active: true,
        requiresApproval: false,
        estimatedCost: 5,
        fallbackCapabilities: ["research.analyze"],
        keywords: ["research", "synthesize", "summary", "merge"],
        disciplines: ["research_intelligence"],
        registeredAt: new Date().toISOString(),
      },
      {
        id: "research.investigate",
        name: "Research Investigation",
        description: "Deep-dive investigation into specific topics with evidence gathering",
        provider: "hermes",
        healthy: true,
        enabled: true,
        active: true,
        requiresApproval: false,
        estimatedCost: 8,
        fallbackCapabilities: ["research.analyze"],
        keywords: ["research", "investigate", "deep-dive", "evidence"],
        disciplines: ["research_intelligence"],
        registeredAt: new Date().toISOString(),
      },
      // ── Architecture & Strategy (4 capabilities) ──────────
      {
        id: "architecture.design",
        name: "Architecture Design",
        description: "Design system architecture and document decisions",
        provider: "hermes",
        healthy: true,
        enabled: true,
        active: true,
        requiresApproval: false,
        estimatedCost: 8,
        fallbackCapabilities: [],
        keywords: ["architecture", "design", "adr", "system"],
        disciplines: ["architecture_strategy"],
        registeredAt: new Date().toISOString(),
      },
      {
        id: "architecture.review",
        name: "Architecture Review",
        description: "Review architecture decisions and validate against constraints",
        provider: "hermes",
        healthy: true,
        enabled: true,
        active: true,
        requiresApproval: false,
        estimatedCost: 5,
        fallbackCapabilities: ["code.review"],
        keywords: ["architecture", "review", "validate", "constraints"],
        disciplines: ["architecture_strategy"],
        registeredAt: new Date().toISOString(),
      },
      // ── Experience & Design (3 capabilities) ──────────────
      {
        id: "experience.design",
        name: "Experience Design",
        description: "Design user experiences and interfaces",
        provider: "hermes",
        healthy: true,
        enabled: true,
        active: true,
        requiresApproval: false,
        estimatedCost: 8,
        fallbackCapabilities: [],
        keywords: ["design", "ux", "ui", "experience", "interface"],
        disciplines: ["experience_design"],
        registeredAt: new Date().toISOString(),
      },
      {
        id: "experience.review",
        name: "Experience Review",
        description: "Review UX/UI designs against best practices and accessibility standards",
        provider: "hermes",
        healthy: true,
        enabled: true,
        active: true,
        requiresApproval: false,
        estimatedCost: 5,
        fallbackCapabilities: ["experience.design"],
        keywords: ["review", "ux", "ui", "accessibility", "heuristic"],
        disciplines: ["experience_design"],
        registeredAt: new Date().toISOString(),
      },
      {
        id: "experience.prototype",
        name: "Experience Prototype",
        description: "Create interactive prototypes for user testing and validation",
        provider: "hermes",
        healthy: true,
        enabled: true,
        active: true,
        requiresApproval: false,
        estimatedCost: 10,
        fallbackCapabilities: ["experience.design"],
        keywords: ["prototype", "ux", "ui", "mockup", "interactive"],
        disciplines: ["experience_design"],
        registeredAt: new Date().toISOString(),
      },
      // ── Business & Growth (3 capabilities) ────────────────
      {
        id: "business.analyze",
        name: "Business Analysis",
        description: "Analyze business requirements and market conditions",
        provider: "hermes",
        healthy: true,
        enabled: true,
        active: true,
        requiresApproval: false,
        estimatedCost: 5,
        fallbackCapabilities: [],
        keywords: ["business", "analyze", "market", "requirements"],
        disciplines: ["business_growth"],
        registeredAt: new Date().toISOString(),
      },
      {
        id: "business.plan",
        name: "Business Planning",
        description: "Develop business plans, roadmaps, and strategic initiatives",
        provider: "hermes",
        healthy: true,
        enabled: true,
        active: true,
        requiresApproval: false,
        estimatedCost: 8,
        fallbackCapabilities: ["business.analyze"],
        keywords: ["business", "plan", "roadmap", "strategy", "initiative"],
        disciplines: ["business_growth"],
        registeredAt: new Date().toISOString(),
      },
      {
        id: "business.report",
        name: "Business Reporting",
        description: "Generate business reports, dashboards, and executive summaries",
        provider: "hermes",
        healthy: true,
        enabled: true,
        active: true,
        requiresApproval: false,
        estimatedCost: 5,
        fallbackCapabilities: ["business.analyze"],
        keywords: ["business", "report", "dashboard", "summary", "executive"],
        disciplines: ["business_growth"],
        registeredAt: new Date().toISOString(),
      },
      // ── Platform Intelligence & Learning (2 capabilities) ─
      {
        id: "platform.learn",
        name: "Platform Learning",
        description: "Capture and integrate knowledge back into the platform",
        provider: "hermes",
        healthy: true,
        enabled: true,
        active: true,
        requiresApproval: false,
        estimatedCost: 3,
        fallbackCapabilities: [],
        keywords: ["learn", "knowledge", "capture", "skill"],
        disciplines: ["platform_intelligence"],
        registeredAt: new Date().toISOString(),
      },
      {
        id: "platform.observe",
        name: "Platform Observability",
        description: "Monitor platform health, performance, and operational metrics",
        provider: "hermes",
        healthy: true,
        enabled: true,
        active: true,
        requiresApproval: false,
        estimatedCost: 3,
        fallbackCapabilities: [],
        keywords: ["observe", "monitor", "health", "metrics", "performance"],
        disciplines: ["platform_intelligence"],
        registeredAt: new Date().toISOString(),
      },
    ];

    for (const entry of builtIns) {
      this.register(entry);
    }
  }
}