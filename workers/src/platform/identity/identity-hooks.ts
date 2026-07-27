// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Identity Core Hooks Framework                   │
// │ Audit, Trust, Consent, and Policy integration points.       │
// │ Wave 3 — AI Platform Identity Core v1                        │
// └─────────────────────────────────────────────────────────────┘

import { IdentityRepository } from "./identity-repository.js";
import type {
  IdentityAuditRecord,
  TrustSnapshotRecord,
  ConsentSnapshotRecord,
  TrustFactor,
  SessionRecord,
  IdentityRecord,
} from "./types.js";

/**
 * Audit hook interface — called on identity events.
 */
export interface IAuditHook {
  onIdentityEvent(event: IdentityAuditRecord): Promise<void>;
}

/**
 * Trust evaluation hook — evaluates trust for an identity/session.
 */
export interface ITrustHook {
  evaluateTrust(identity: IdentityRecord, session: SessionRecord): Promise<{
    score: number;
    level: string;
    factors: TrustFactor[];
  }>;
}

/**
 * Consent verification hook — checks active consents.
 */
export interface IConsentHook {
  getActiveConsents(identityId: string): Promise<{
    activeConsents: string[];
    hash: string;
  }>;
}

/**
 * Policy enforcement hook — evaluates platform policies.
 */
export interface IPolicyHook {
  evaluate(action: string, identity: IdentityRecord, resource: string): Promise<{
    allowed: boolean;
    reason?: string;
  }>;
}

/**
 * Identity Hooks — collects all extension points for identity events.
 * Delegates to registered hook implementations.
 * Fail-closed: if a hook is registered and throws, identity operations fail.
 */
export class IdentityHooks {
  private readonly repo: IdentityRepository;
  private auditHooks: IAuditHook[] = [];
  private trustHooks: ITrustHook[] = [];
  private consentHooks: IConsentHook[] = [];
  private policyHooks: IPolicyHook[] = [];

  constructor(repo: IdentityRepository) {
    this.repo = repo;
  }

  registerAuditHook(hook: IAuditHook): void {
    this.auditHooks.push(hook);
  }

  registerTrustHook(hook: ITrustHook): void {
    this.trustHooks.push(hook);
  }

  registerConsentHook(hook: IConsentHook): void {
    this.consentHooks.push(hook);
  }

  registerPolicyHook(hook: IPolicyHook): void {
    this.policyHooks.push(hook);
  }

  async onAuditEvent(event: IdentityAuditRecord): Promise<void> {
    for (const hook of this.auditHooks) {
      await hook.onIdentityEvent(event);
    }
  }

  async evaluateTrust(
    identity: IdentityRecord,
    session: SessionRecord,
  ): Promise<TrustSnapshotRecord> {
    // Default trust evaluation
    const defaultFactors: TrustFactor[] = [
      { name: "auth_method", score: 0.5, weight: 0.3, passed: true },
      { name: "mfa_level", score: session.mfa_level >= 2 ? 0.9 : 0.3, weight: 0.4, passed: session.mfa_level >= 2 },
      { name: "device_known", score: session.device_fingerprint ? 0.7 : 0.3, weight: 0.15, passed: !!session.device_fingerprint },
      { name: "account_age", score: 0.6, weight: 0.15, passed: true },
    ];

    let aggregateScore = 0;
    let totalWeight = 0;
    for (const f of defaultFactors) {
      aggregateScore += f.score * f.weight;
      totalWeight += f.weight;
    }

    const finalScore = totalWeight > 0 ? aggregateScore / totalWeight : 0.5;
    const trustLevel = finalScore >= 0.8 ? "high" : finalScore >= 0.5 ? "medium" : "low";

    const snapshot: TrustSnapshotRecord = {
      id: crypto.randomUUID(),
      identity_id: identity.id,
      session_id: session.id,
      trust_score: Math.round(finalScore * 100) / 100,
      trust_level: trustLevel,
      factors: defaultFactors,
      created_at: new Date().toISOString(),
    };

    // Run registered trust hooks (override defaults)
    for (const hook of this.trustHooks) {
      const result = await hook.evaluateTrust(identity, session);
      if (result.factors.length > 0) {
        snapshot.factors = result.factors;
        snapshot.trust_score = result.score;
        snapshot.trust_level = result.level;
      }
    }

    // Store snapshot
    await this.repo.storeTrustSnapshot(snapshot);
    return snapshot;
  }

  async getConsentSnapshot(
    identityId: string,
    sessionId: string,
  ): Promise<ConsentSnapshotRecord> {
    let snapshot: ConsentSnapshotRecord;

    if (this.consentHooks.length > 0) {
      // Use first registered consent hook
      const result = await this.consentHooks[0].getActiveConsents(identityId);
      snapshot = {
        id: crypto.randomUUID(),
        identity_id: identityId,
        session_id: sessionId,
        consent_type: "auth_session",
        granted: result.activeConsents.length > 0,
        snapshot_data: { activeConsents: result.activeConsents, hash: result.hash },
        created_at: new Date().toISOString(),
      };
    } else {
      snapshot = {
        id: crypto.randomUUID(),
        identity_id: identityId,
        session_id: sessionId,
        consent_type: "auth_session",
        granted: true,
        snapshot_data: { activeConsents: [], hash: "" },
        created_at: new Date().toISOString(),
      };
    }

    await this.repo.storeConsentSnapshot(snapshot);
    return snapshot;
  }

  async evaluatePolicy(
    action: string,
    identity: IdentityRecord,
    resource: string,
  ): Promise<boolean> {
    if (this.policyHooks.length === 0) {
      // No policy hooks — pass (but warn)
      return true;
    }

    for (const hook of this.policyHooks) {
      const result = await hook.evaluate(action, identity, resource);
      if (!result.allowed) {
        return false;
      }
    }

    return true;
  }
}