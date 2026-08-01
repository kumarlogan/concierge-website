// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Execution — Research Intelligence Integration          │
// │ EPIC-007 · Deliverable 05                                     │
// │ Integrates EPCL Research Intelligence (web search,           │
// │ evidence gathering) into the executive execution pipeline.    │
// │ Produces Evidence Packages that attach to ExecutionContext    │
// │ and feed into Executive Trace. Fail-closed: no evidence     │
// │ means execution proceeds without external data.              │
// └─────────────────────────────────────────────────────────────┘

import { ExecutionContext } from "./context.js";
import type { TraceSpan, ExecutionPhase, ExecutionEvidence } from "./context.js";
import { emitAudit } from "../../audit/event.js";

// ── Types ──────────────────────────────────────────────

export type ResearchQuery = {
  /** The search query or research question. */
  query: string;
  /** Source type for the research. */
  source: "web" | "internal" | "docs" | "codebase";
  /** Maximum number of results to retrieve. */
  limit?: number;
};

export type ResearchHit = {
  /** Title of the result. */
  title: string;
  /** URL or reference to the source. */
  url: string;
  /** Snippet or excerpt from the source. */
  snippet: string;
  /** Relevance score (0.0–1.0). */
  relevance: number;
};

export type ResearchResult = {
  /** The original query. */
  query: string;
  /** The hits found. */
  hits: ResearchHit[];
  /** Whether the research was successful. */
  success: boolean;
  /** Error message if unsuccessful. */
  error?: string;
  /** When the research was performed. */
  performedAt: string;
};

export type EvidencePackage = {
  /** Unique id for this evidence package. */
  id: string;
  /** Type of evidence (e.g. "research-results", "deployment", "pr"). */
  type: string;
  /** The research results (if type is "research-results"). */
  research?: ResearchResult;
  /** The evidence items attached to the execution. */
  items: ExecutionEvidence[];
  /** When the package was created. */
  createdAt: string;
  /** Summary of what this evidence supports. */
  summary: string;
};

export type ResearchOptions = {
  /** Queries to run during research phase. */
  queries: ResearchQuery[];
  /** Optional timeout per query in ms (default 10000). */
  timeoutMs?: number;
};

// ── Class ──────────────────────────────────────────────

export class ResearchIntelligence {
  private static instance: ResearchIntelligence;

  private constructor() {}

  static getInstance(): ResearchIntelligence {
    if (!ResearchIntelligence.instance) {
      ResearchIntelligence.instance = new ResearchIntelligence();
    }
    return ResearchIntelligence.instance;
  }

  /**
   * Run research queries and return an EvidencePackage.
   * Fail-closed: if all queries fail, returns an empty package
   * with success=false — execution continues without external data.
   *
   * @param ctx - The execution context.
   * @param opts - Research configuration (queries, timeout).
   * @returns EvidencePackage with research results.
   */
  async research(
    ctx: ExecutionContext,
    opts: ResearchOptions,
  ): Promise<EvidencePackage> {
    const packageId = `evp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();
    const allHits: ResearchHit[] = [];
    const errors: string[] = [];

    for (const query of opts.queries) {
      try {
        const hits = await this._executeQuery(query, opts.timeoutMs ?? 10000);
        allHits.push(...hits);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Query "${query.query}" failed: ${message}`);
      }
    }

    const result: ResearchResult = {
      query: opts.queries.map((q) => q.query).join("; "),
      hits: allHits.sort((a, b) => b.relevance - a.relevance),
      success: errors.length === 0 || allHits.length > 0,
      ...(errors.length > 0 && allHits.length === 0 ? { error: errors.join("; ") } : {}),
      performedAt: new Date().toISOString(),
    };

    const evidenceItems: ExecutionEvidence[] = allHits.map((hit, i) => ({
      type: "research-hit",
      reference: hit.url,
      backend: "research-intelligence",
      capturedAt: new Date().toISOString(),
      metadata: {
        title: hit.title,
        snippet: hit.snippet,
        relevance: hit.relevance,
        rank: i + 1,
      },
    }));

    // Attach evidence to the execution context
    for (const item of evidenceItems) {
      ctx.attachEvidence(item);
    }

    // Audit the research event
    emitAudit("epic007.research.complete", ctx.principal.id, {
      contextId: ctx.id,
      packageId,
      queryCount: opts.queries.length,
      hitCount: allHits.length,
      errorCount: errors.length,
      durationMs: Date.now() - startTime,
      tenant: ctx.tenant,
    }, { tenant: ctx.tenant });

    // Create the evidence package
    const package_: EvidencePackage = {
      id: packageId,
      type: "research-results",
      research: result,
      items: evidenceItems,
      createdAt: new Date().toISOString(),
      summary: `Research: ${opts.queries.length} queries, ${allHits.length} hits, ${errors.length} errors`,
    };

    // Record a trace span for this research phase
    const span: TraceSpan = {
      phase: "execution",
      spanId: `span_${Date.now()}_research`,
      parentSpanId: "",
      startedAt: new Date(startTime).toISOString(),
      endedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: errors.length > 0 && allHits.length === 0 ? "error" : "ok",
      details: {
        packageId,
        queryCount: opts.queries.length,
        hitCount: allHits.length,
      },
    };
    ctx.recordSpan(span);

    return package_;
  }

  /**
   * Execute a single research query. This is the provider hook —
   * in production this calls the actual research backend.
   * For now, returns mock data to demonstrate the integration.
   */
  private async _executeQuery(
    query: ResearchQuery,
    timeoutMs: number,
  ): Promise<ResearchHit[]> {
    // Simulate async research (in production, this calls web search / internal KB)
    await new Promise((resolve) => setTimeout(resolve, Math.min(10, timeoutMs)));

    // Return mock hits for demonstration
    return [
      {
        title: `Research result for: ${query.query}`,
        url: `https://example.com/search?q=${encodeURIComponent(query.query)}`,
        snippet: `Top result for "${query.query}" — relevant context for execution.`,
        relevance: 0.9,
      },
      {
        title: `Secondary result: ${query.query}`,
        url: `https://example.com/search?q=${encodeURIComponent(query.query)}&page=2`,
        snippet: `Additional context supporting the execution of "${query.query}".`,
        relevance: 0.7,
      },
    ];
  }
}