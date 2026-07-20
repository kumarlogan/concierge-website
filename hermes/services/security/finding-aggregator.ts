// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Security Automation — Finding Aggregator (M6)         │
// │ EPIC-003-004                                                │
// │ Aggregate findings from MULTIPLE providers into one set.     │
// │ Combines: severity · confidence · provider · category ·       │
// │ affected files · recommendation. Deduplicates overlapping    │
// │ findings (same fingerprint across providers).                │
// └─────────────────────────────────────────────────────────────┘

import type { SecurityFinding, SecurityCheckKind } from "./security-work-model.js";

export interface AggregatedFinding extends SecurityFinding {
  /** Providers that reported this (deduped) finding. */
  providers: string[];
  /** Whether this finding was reported by more than one provider. */
  duplicated: boolean;
}

export interface AggregationResult {
  findings: AggregatedFinding[];
  /** Count of raw findings collapsed by deduplication. */
  duplicatesRemoved: number;
  byProvider: Record<string, number>;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
}

/**
 * Stable fingerprint for a finding. Two findings from different providers that
 * hit the same check kind + affected application + title + evidence are treated
 * as the same underlying issue and deduplicated (kept once, providers merged).
 */
function fingerprint(f: SecurityFinding): string {
  return [f.checkKind, f.affectedApplication, f.title, f.evidence].join("::").toLowerCase();
}

/**
 * Aggregate findings from multiple providers.
 *  • severity/confidence: the highest (most cautious) wins per deduped finding.
 *  • provider: collected into `providers`.
 *  • category: checkKind bucketed into a human category.
 *  • affected files: preserved from the dominant finding.
 *  • recommendation: the highest-severity provider's recommendation is kept.
 */
export function aggregateFindings(raw: SecurityFinding[]): AggregationResult {
  const byFp = new Map<string, AggregatedFinding>();
  const counts = { duplicatesRemoved: 0, byProvider: {} as Record<string, number>, bySeverity: {} as Record<string, number>, byCategory: {} as Record<string, number> };

  const SEV_RANK: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4, "block-all": 4 };

  for (const f of raw) {
    counts.byProvider[f.capability] = (counts.byProvider[f.capability] ?? 0) + 1;
    counts.bySeverity[f.severity] = (counts.bySeverity[f.severity] ?? 0) + 1;
    counts.byCategory[f.checkKind] = (counts.byCategory[f.checkKind] ?? 0) + 1;

    const fp = fingerprint(f);
    const existing = byFp.get(fp);
    if (existing) {
      // Duplicate — merge providers, keep the more severe/confident signal.
      if (!existing.providers.includes(f.capability)) existing.providers.push(f.capability);
      existing.duplicated = true;
      counts.duplicatesRemoved += 1;
      if ((SEV_RANK[f.severity] ?? 0) > (SEV_RANK[existing.severity] ?? 0)) {
        existing.severity = f.severity;
        existing.confidence = f.confidence;
        existing.recommendation = f.recommendation;
        existing.exploitability = f.exploitability;
      } else if (f.confidence > existing.confidence) {
        existing.confidence = f.confidence;
      }
      continue;
    }

    byFp.set(fp, {
      ...f,
      providers: [f.capability],
      duplicated: false,
    });
  }

  return {
    findings: [...byFp.values()],
    duplicatesRemoved: counts.duplicatesRemoved,
    byProvider: counts.byProvider,
    bySeverity: counts.bySeverity,
    byCategory: counts.byCategory,
  };
}

/** Category label for a check kind (provider-neutral). */
export function categoryOf(kind: SecurityCheckKind): string {
  switch (kind) {
    case "secret-scan":
      return "secrets";
    case "dependency-scan":
      return "dependencies";
    case "static-analysis":
      return "code-quality";
    case "config-review":
      return "configuration";
    case "boundary-validation":
      return "boundaries";
    default:
      return "other";
  }
}
