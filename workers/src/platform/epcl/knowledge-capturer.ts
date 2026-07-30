// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL Knowledge Capturer                      │
// │ Captures and integrates knowledge from execution back      │
// │ into the platform — skills, references, and insights.      │
// └─────────────────────────────────────────────────────────────┘

import {
  type KnowledgeEntry,
  type KnowledgeQuery,
  KnowledgeType,
  FeatureFlag,
} from "./types.js";
import { isEnabled } from "./feature-flags.js";

// ── Error ────────────────────────────────────────────────────

export class KnowledgeCaptureError extends Error {
  constructor(message: string) {
    super(`KnowledgeCaptureError: ${message}`);
    this.name = "KnowledgeCaptureError";
  }
}

// ── Knowledge Capturer ───────────────────────────────────────

export class KnowledgeCapturer {
  private static instance: KnowledgeCapturer;
  private entries: Map<string, KnowledgeEntry> = new Map();
  private entryCounter = 0;
  private reuseHits = 0;
  private totalLookups = 0;

  private constructor() {}

  static getInstance(): KnowledgeCapturer {
    if (!KnowledgeCapturer.instance) {
      KnowledgeCapturer.instance = new KnowledgeCapturer();
    }
    return KnowledgeCapturer.instance;
  }

  // ── Capture ────────────────────────────────────────────────

  /**
   * Capture a knowledge entry from execution output.
   */
  capture(
    type: KnowledgeType,
    title: string,
    content: string,
    source: string,
    planId: string,
    batchId: string,
    evidence: string[] = []
  ): KnowledgeEntry {
    if (!isEnabled(FeatureFlag.ENABLE_KNOWLEDGE_CAPTURE)) {
      throw new KnowledgeCaptureError(
        "Knowledge capture is disabled. Enable FeatureFlag.ENABLE_KNOWLEDGE_CAPTURE."
      );
    }

    const id = `knowledge-${this.entryCounter++}-${Date.now()}`;
    const entry: KnowledgeEntry = {
      id,
      type,
      title,
      content,
      source,
      planId,
      batchId,
      evidence,
      tags: this.extractTags(title, content),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reuseCount: 0,
      lastReusedAt: null,
    };

    this.entries.set(id, entry);
    return entry;
  }

  /**
   * Capture a decision made during execution.
   */
  captureDecision(
    title: string,
    content: string,
    source: string,
    planId: string,
    batchId: string,
    evidence: string[] = []
  ): KnowledgeEntry {
    return this.capture(
      KnowledgeType.DECISION,
      title,
      content,
      source,
      planId,
      batchId,
      evidence
    );
  }

  /**
   * Capture a reusable knowledge item (skill, pattern, workflow).
   */
  captureReusable(
    title: string,
    content: string,
    source: string,
    planId: string,
    batchId: string
  ): KnowledgeEntry {
    return this.capture(
      KnowledgeType.REUSABLE_KNOWLEDGE,
      title,
      content,
      source,
      planId,
      batchId
    );
  }

  /**
   * Capture a lesson learned from execution.
   */
  captureLesson(
    title: string,
    content: string,
    source: string,
    planId: string,
    batchId: string,
    evidence: string[] = []
  ): KnowledgeEntry {
    return this.capture(
      KnowledgeType.LESSON_LEARNED,
      title,
      content,
      source,
      planId,
      batchId,
      evidence
    );
  }

  /**
   * Capture evidence (test results, tool output, verification).
   */
  captureEvidence(
    title: string,
    content: string,
    source: string,
    planId: string,
    batchId: string
  ): KnowledgeEntry {
    return this.capture(
      KnowledgeType.EVIDENCE,
      title,
      content,
      source,
      planId,
      batchId
    );
  }

  // ── Retrieval ──────────────────────────────────────────────

  /**
   * Query knowledge entries with filters.
   */
  query(query: KnowledgeQuery): KnowledgeEntry[] {
    this.totalLookups++;
    let results = Array.from(this.entries.values());

    // Filter by type
    if (query.byType && query.byType.length > 0) {
      results = results.filter((e) => query.byType!.includes(e.type));
    }

    // Filter by tags
    if (query.byTags && query.byTags.length > 0) {
      results = results.filter((e) =>
        query.byTags!.some((tag) => e.tags.includes(tag))
      );
    }

    // Filter by batch
    if (query.byBatch) {
      results = results.filter((e) => e.batchId === query.byBatch);
    }

    // Filter by plan
    if (query.byPlan) {
      results = results.filter((e) => e.planId === query.byPlan);
    }

    // Text search
    if (query.text) {
      const textLower = query.text.toLowerCase();
      results = results.filter(
        (e) =>
          e.title.toLowerCase().includes(textLower) ||
          e.content.toLowerCase().includes(textLower) ||
          e.tags.some((t) => t.toLowerCase().includes(textLower))
      );
    }

    // Sort by creation date descending
    results.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Paginate
    const offset = query.offset || 0;
    const limit = query.limit || results.length;
    const paginated = results.slice(offset, offset + limit);

    // Track hits
    if (paginated.length > 0) {
      this.reuseHits++;
      for (const result of paginated) {
        result.reuseCount++;
        result.lastReusedAt = new Date().toISOString();
      }
    }

    return paginated;
  }

  /**
   * Find knowledge entries by type.
   */
  findByType(
    type: KnowledgeType,
    limit: number = 20
  ): KnowledgeEntry[] {
    return this.query({ byType: [type], limit });
  }

  /**
   * Find the most frequently reused entries.
   */
  findMostReused(limit: number = 10): KnowledgeEntry[] {
    return Array.from(this.entries.values())
      .sort((a, b) => b.reuseCount - a.reuseCount)
      .slice(0, limit);
  }

  /**
   * Get a specific entry by ID.
   */
  get(id: string): KnowledgeEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * List all entries.
   */
  list(): KnowledgeEntry[] {
    return Array.from(this.entries.values());
  }

  // ── Metrics ────────────────────────────────────────────────

  /**
   * Get knowledge reuse rate.
   */
  getReuseRate(): number {
    if (this.entries.size === 0) return 0;
    const totalReuses = Array.from(this.entries.values()).reduce(
      (sum, e) => sum + e.reuseCount,
      0
    );
    return totalReuses / this.entries.size;
  }

  /**
   * Get total entries count.
   */
  getEntryCount(): number {
    return this.entries.size;
  }

  /**
   * Get entries by type.
   */
  getEntryCountByType(): Record<KnowledgeType, number> {
    const counts: Record<string, number> = {};
    for (const entry of this.entries.values()) {
      counts[entry.type] = (counts[entry.type] || 0) + 1;
    }
    return counts as Record<KnowledgeType, number>;
  }

  /**
   * Get growth rate (entries per day since first entry).
   */
  getGrowthRate(): number {
    const entries = Array.from(this.entries.values());
    if (entries.length === 0) return 0;

    const firstEntry = entries.reduce((earliest, e) =>
      new Date(e.createdAt).getTime() <
      new Date(earliest.createdAt).getTime()
        ? e
        : earliest
    );
    const elapsedDays =
      (Date.now() - new Date(firstEntry.createdAt).getTime()) /
      (1000 * 60 * 60 * 24);
    return elapsedDays > 0 ? entries.length / elapsedDays : 0;
  }

  // ── Private ────────────────────────────────────────────────

  private extractTags(title: string, content: string): string[] {
    const tags = new Set<string>();

    // Extract words from title
    title.split(/[\s-_]+/).forEach((word) => {
      const clean = word.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (clean.length >= 3) tags.add(clean);
    });

    // Extract key technical terms from content
    const techTerms = content.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
    techTerms.forEach((term) => tags.add(term.toLowerCase().trim()));

    return Array.from(tags).slice(0, 10);
  }

  // ── Reset for testing ──────────────────────────────────────

  reset(): void {
    this.entries.clear();
    this.entryCounter = 0;
    this.reuseHits = 0;
    this.totalLookups = 0;
  }
}