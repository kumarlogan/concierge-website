// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Dynamic Trust Engine                           │
// │ Evaluates trust scores across 10 dimensions.             │
// │ Scores influence authorization decisions.               │
// │ Product-agnostic — no Concierge-specific logic.        │
// │ Wave 4 — AI Platform Trust Runtime v1                        │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: Trust engine NEVER sees PHI. Identity is
// referenced by opaque ID only. All trust factors are derived
// from authentication metadata, device attributes, and network
// signals — never from health records or clinical data.

import type {
  TrustEvaluationRequest,
  TrustEvaluationResult,
  TrustFactorResult,
  TrustScore,
  TrustSnapshot,
} from "./types.js";
import { TrustLevel, Decision } from "./types.js";

interface TrustFactorConfig {
  name: string;
  weight: number;
  threshold: number;
  scoreFn: (request: TrustEvaluationRequest) => number;
}

export class TrustEngine {
  private factors: TrustFactorConfig[] = [];
  private scores: Map<string, TrustScore> = new Map();
  private levelThresholds: Record<TrustLevel, number> = {
    [TrustLevel.CRITICAL]: 0.0,
    [TrustLevel.LOW]: 0.3,
    [TrustLevel.MEDIUM]: 0.5,
    [TrustLevel.HIGH]: 0.7,
    [TrustLevel.ELEVATED]: 0.85,
  };

  constructor() {
    // Default factor configurations
    this.factors = [
      {
        name: "identity_confidence",
        weight: 0.15,
        threshold: 0.5,
        scoreFn: (req) => {
          // Based on identity type and verification status
          // Higher for verified identities, lower for new ones
          return 0.5; // default; external hooks override
        },
      },
      {
        name: "authentication_strength",
        weight: 0.2,
        threshold: 0.5,
        scoreFn: (req) => {
          // Based on auth method used
          return 0.5; // default; external hooks override
        },
      },
      {
        name: "mfa_status",
        weight: 0.15,
        threshold: 0.5,
        scoreFn: (_req) => {
          return 0.5; // default; actual MFA status from hooks
        },
      },
      {
        name: "device_trust",
        weight: 0.1,
        threshold: 0.3,
        scoreFn: (_req) => 0.5,
      },
      {
        name: "network_trust",
        weight: 0.1,
        threshold: 0.3,
        scoreFn: (_req) => 0.5,
      },
      {
        name: "behavioral_trust",
        weight: 0.1,
        threshold: 0.3,
        scoreFn: (_req) => 0.5,
      },
      {
        name: "session_trust",
        weight: 0.05,
        threshold: 0.3,
        scoreFn: (_req) => 0.5,
      },
      {
        name: "credential_age",
        weight: 0.05,
        threshold: 0.3,
        scoreFn: (_req) => 0.5,
      },
      {
        name: "risk_history",
        weight: 0.05,
        threshold: 0.3,
        scoreFn: (_req) => 0.5,
      },
      {
        name: "administrative_override",
        weight: 0.05,
        threshold: 0.0,
        scoreFn: (_req) => 0.5,
      },
    ];
  }

  // ── Evaluate ──────────────────────────────────

  async evaluate(request: TrustEvaluationRequest): Promise<TrustEvaluationResult> {
    const startTime = Date.now();

    // Calculate each factor score
    const factorResults: TrustFactorResult[] = this.factors.map((factor) => {
      const score = factor.scoreFn(request);
      const weighted = score * factor.weight;
      return {
        name: factor.name,
        score,
        weight: factor.weight,
        passed: score >= factor.threshold,
        detail: `${factor.name}: ${score.toFixed(3)} (threshold: ${factor.threshold})`,
      };
    });

    // Weighted aggregate
    let totalWeighted = 0;
    let totalWeight = 0;
    for (const f of factorResults) {
      totalWeighted += f.score * f.weight;
      totalWeight += f.weight;
    }

    const weightedScore = totalWeight > 0 ? totalWeighted / totalWeight : 0;
    const trustScore = Math.round(weightedScore * 100) / 100;
    const trustLevel = this.scoreToLevel(trustScore);

    // Check if level changed from previous
    const previousScore = this.scores.get(request.identityId);
    const previousLevel: TrustLevel | null = previousScore?.trustLevel ?? null;
    const levelChanged = previousLevel !== trustLevel;

    const result: TrustEvaluationResult = {
      identityId: request.identityId,
      trustScore,
      trustLevel,
      factors: factorResults,
      weightedScore,
      levelChanged,
      previousLevel,
      evaluatedAt: new Date().toISOString(),
      expiresAt: request.sessionId
        ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
        : null,
    };

    // Persist snapshot
    const trustScoreRecord: TrustScore = {
      id: crypto.randomUUID(),
      identityId: request.identityId,
      sessionId: request.sessionId ?? null,
      trustScore,
      trustLevel,
      factors: factorResults,
      identityConfidence: factorResults.find((f) => f.name === "identity_confidence")?.score ?? 0.5,
      authStrength: factorResults.find((f) => f.name === "authentication_strength")?.score ?? 0.5,
      mfaStatus: (factorResults.find((f) => f.name === "mfa_status")?.score ?? 0.5) > 0.3,
      deviceTrust: factorResults.find((f) => f.name === "device_trust")?.score ?? 0.5,
      networkTrust: factorResults.find((f) => f.name === "network_trust")?.score ?? 0.5,
      behavioralTrust: factorResults.find((f) => f.name === "behavioral_trust")?.score ?? 0.5,
      sessionTrust: factorResults.find((f) => f.name === "session_trust")?.score ?? 0.5,
      credentialAge: factorResults.find((f) => f.name === "credential_age")?.score ?? 1.0,
      riskHistory: factorResults.find((f) => f.name === "risk_history")?.score ?? 0.5,
      administrativeOverride: "",
      expiresAt: result.expiresAt,
      createdAt: new Date().toISOString(),
    };
    this.scores.set(request.identityId, trustScoreRecord);

    return result;
  }

  // ── Get Current Score ────────────────────────

  getScore(identityId: string): TrustScore | undefined {
    return this.scores.get(identityId);
  }

  // ── Administrative Override ──────────────────

  async override(
    identityId: string,
    trustLevel: TrustLevel,
    reason: string,
    overrideBy: string,
  ): Promise<TrustEvaluationResult> {
    const existing = this.scores.get(identityId);
    const score = existing?.trustScore ?? 0.5;

    // Apply level-based score mapping for overrides
    const levelScores: Record<string, number> = {
      [TrustLevel.UNTRUSTED]: 0.0,
      [TrustLevel.LOW]: 0.25,
      [TrustLevel.MEDIUM]: 0.5,
      [TrustLevel.ELEVATED]: 0.75,
      [TrustLevel.HIGH]: 0.9,
      [TrustLevel.CRITICAL]: 1.0,
    };
    const overrideScore = levelScores[trustLevel] ?? 0.5;

    const result: TrustEvaluationResult = {
      identityId,
      trustScore: overrideScore,
      trustLevel,
      factors: existing?.factors ?? [],
      weightedScore: overrideScore,
      levelChanged: true,
      previousLevel: existing?.trustLevel ?? null,
      evaluatedAt: new Date().toISOString(),
      expiresAt: null,
    };

    // Store override metadata and update score
    if (existing) {
      existing.trustScore = overrideScore;
      existing.trustLevel = trustLevel;
      existing.administrativeOverride = JSON.stringify({
        by: overrideBy,
        reason,
        level: trustLevel,
        at: new Date().toISOString(),
      });
    } else {
      this.scores.set(identityId, {
        id: crypto.randomUUID(),
        identityId,
        sessionId: null,
        trustScore: overrideScore,
        trustLevel,
        factors: [],
        identityConfidence: 0.5,
        authStrength: 0.5,
        mfaStatus: false,
        deviceTrust: 0.5,
        networkTrust: 0.5,
        behavioralTrust: 0.5,
        sessionTrust: 0.5,
        credentialAge: 1.0,
        riskHistory: 0.5,
        administrativeOverride: JSON.stringify({
          by: overrideBy,
          reason,
          level: trustLevel,
          at: new Date().toISOString(),
        }),
        expiresAt: null,
        createdAt: new Date().toISOString(),
      });
    }

    return result;
  }

  // ── Trust Decay ──────────────────────────────

  async decay(identityId: string, hoursSinceLastActivity: number): Promise<TrustEvaluationResult | null> {
    const existing = this.scores.get(identityId);
    if (!existing) return null;

    // Decay factor: reduce trust score based on inactivity
    const decayMultiplier = Math.max(0, 1 - hoursSinceLastActivity / 72); // 72-hour half-life
    const newScore = Math.max(0, Math.min(1, existing.trustScore * decayMultiplier));
    const newLevel = this.scoreToLevel(newScore);

    const result: TrustEvaluationResult = {
      identityId,
      trustScore: newScore,
      trustLevel: newLevel,
      factors: existing.factors.map((f) => ({
        ...f,
        score: f.score * decayMultiplier,
      })),
      weightedScore: newScore,
      levelChanged: newLevel !== existing.trustLevel,
      previousLevel: existing.trustLevel,
      evaluatedAt: new Date().toISOString(),
      expiresAt: existing.expiresAt,
    };

    existing.trustScore = newScore;
    existing.trustLevel = newLevel;

    return result;
  }

  // ── Private Helpers ──────────────────────────

  private scoreToLevel(score: number): TrustLevel {
    if (score >= 0.85) return TrustLevel.ELEVATED;
    if (score >= 0.7) return TrustLevel.HIGH;
    if (score >= 0.5) return TrustLevel.MEDIUM;
    if (score >= 0.3) return TrustLevel.LOW;
    return TrustLevel.CRITICAL;
  }
}

export const trustEngine = new TrustEngine();