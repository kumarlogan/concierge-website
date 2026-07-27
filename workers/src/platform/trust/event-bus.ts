// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Event Bus Foundation                                │
// │ Provider-independent domain events for the Trust     │
// │ Runtime. Future capabilities subscribe instead       │
// │ of direct coupling.                                    │
// │ Wave 4 — AI Platform Trust Runtime v1                      │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: Events contain NO PHI. All identifiers
// are opaque IDs. Event payloads reference external stores
// for any personal data — never embed it here.

import type {
  TrustEvent,
  TrustEventType,
  ConsentEvent,
  ConsentEventType,
  PolicyEvent,
  PolicyEventType,
  DecisionAuditEntry,
} from "./types.js";

// ══════════════════════════════════════════════════════════
// Event Bus Interface — Provider-Independent
// ══════════════════════════════════════════════════════════

export interface EventSubscriber<T> {
  (event: T): void | Promise<void>;
}

export interface EventBus {
  publish<T>(topic: string, event: T): Promise<void>;
  subscribe<T>(topic: string, subscriber: EventSubscriber<T>): () => void;
  getTopicStats(topic: string): { published: number; subscribers: number };
  getTopics(): string[];
}

// ══════════════════════════════════════════════════════════
// In-Memory Event Bus (Default Implementation)
// ══════════════════════════════════════════════════════════

export class InMemoryEventBus implements EventBus {
  private subscribers: Map<string, EventSubscriber<unknown>[]> = new Map();
  private publishedCount: Map<string, number> = new Map();
  private eventHistory: Array<{ topic: string; event: unknown; timestamp: string }> = [];
  private maxHistory: number = 10000;

  async publish<T>(topic: string, event: T): Promise<void> {
    // Track publication count
    const count = this.publishedCount.get(topic) ?? 0;
    this.publishedCount.set(topic, count + 1);

    // Store in history
    this.eventHistory.push({ topic, event, timestamp: new Date().toISOString() });
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    // Notify subscribers
    const subs = this.subscribers.get(topic) ?? [];
    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await sub(event);
        } catch (err) {
          // Subscriber errors don't propagate — log and continue
          console.error(`EventBus subscriber error on topic "${topic}":`, err);
        }
      }),
    );
  }

  subscribe<T>(topic: string, subscriber: EventSubscriber<T>): () => void {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, []);
    }
    const subs = this.subscribers.get(topic)!;
    subs.push(subscriber as EventSubscriber<unknown>);

    // Return unsubscribe function
    return () => {
      const idx = subs.indexOf(subscriber as EventSubscriber<unknown>);
      if (idx >= 0) subs.splice(idx, 1);
    };
  }

  getTopicStats(topic: string): { published: number; subscribers: number } {
    return {
      published: this.publishedCount.get(topic) ?? 0,
      subscribers: this.subscribers.get(topic)?.length ?? 0,
    };
  }

  getTopics(): string[] {
    return Array.from(this.subscribers.keys());
  }

  getHistory(topic: string, limit?: number): Array<{ topic: string; event: unknown; timestamp: string }> {
    const filtered = this.eventHistory.filter((e) => e.topic === topic);
    return limit ? filtered.slice(-limit) : filtered;
  }
}

// ══════════════════════════════════════════════════════════
// Trust Event Publisher
// ══════════════════════════════════════════════════════════

export interface TrustEventPublisher {
  publishTrustScoreChanged(
    identityId: string,
    sessionId: string | undefined,
    trustScore: number,
    trustLevel: string,
    previousLevel: string | null,
    factors: Array<{ name: string; score: number; weight: number; passed: boolean }>,
    correlationId: string,
  ): Promise<void>;

  publishTrustLevelChanged(
    identityId: string,
    sessionId: string | undefined,
    trustScore: number,
    newLevel: string,
    previousLevel: string,
    correlationId: string,
  ): Promise<void>;

  publishTrustDecayed(
    identityId: string,
    sessionId: string | undefined,
    oldScore: number,
    newScore: number,
    hoursIdle: number,
    correlationId: string,
  ): Promise<void>;

  publishAdministrativeOverride(
    identityId: string,
    sessionId: string | undefined,
    trustLevel: string,
    reason: string,
    overriddenBy: string,
    correlationId: string,
  ): Promise<void>;
}

export class TrustEventPublisherImpl implements TrustEventPublisher {
  constructor(private bus: EventBus) {}

  async publishTrustScoreChanged(
    identityId: string,
    sessionId: string | undefined,
    trustScore: number,
    trustLevel: string,
    previousLevel: string | null,
    factors: Array<{ name: string; score: number; weight: number; passed: boolean }>,
    correlationId: string,
  ): Promise<void> {
    const event: TrustEvent = {
      eventType: "trust.score_changed" as TrustEventType,
      identityId,
      sessionId,
      trustScore,
      trustLevel: trustLevel as any,
      previousTrustLevel: previousLevel as any,
      factors,
      timestamp: new Date().toISOString(),
      correlationId,
      source: "trust-engine",
      metadata: {},
    };
    await this.bus.publish("trust.score_changed", event);
  }

  async publishTrustLevelChanged(
    identityId: string,
    sessionId: string | undefined,
    trustScore: number,
    newLevel: string,
    previousLevel: string,
    correlationId: string,
  ): Promise<void> {
    const event: TrustEvent = {
      eventType: "trust.level_changed" as TrustEventType,
      identityId,
      sessionId,
      trustScore,
      trustLevel: newLevel as any,
      previousTrustLevel: previousLevel as any,
      factors: [],
      timestamp: new Date().toISOString(),
      correlationId,
      source: "trust-engine",
      metadata: {},
    };
    await this.bus.publish("trust.level_changed", event);
  }

  async publishTrustDecayed(
    identityId: string,
    sessionId: string | undefined,
    oldScore: number,
    newScore: number,
    hoursIdle: number,
    correlationId: string,
  ): Promise<void> {
    const event: TrustEvent = {
      eventType: "trust.decayed" as TrustEventType,
      identityId,
      sessionId,
      trustScore: newScore,
      trustLevel: newScore >= 0.7 ? "high" : newScore >= 0.5 ? "medium" : newScore >= 0.3 ? "low" : "critical",
      previousTrustLevel: oldScore >= 0.7 ? "high" : oldScore >= 0.5 ? "medium" : oldScore >= 0.3 ? "low" : "critical",
      factors: [{ name: "inactivity_decay", score: hoursIdle / 72, weight: 1.0, passed: hoursIdle / 72 < 0.5, detail: `${hoursIdle}h idle` }],
      timestamp: new Date().toISOString(),
      correlationId,
      source: "trust-engine",
      metadata: { hoursIdle },
    };
    await this.bus.publish("trust.decayed", event);
  }

  async publishAdministrativeOverride(
    identityId: string,
    sessionId: string | undefined,
    trustLevel: string,
    reason: string,
    overriddenBy: string,
    correlationId: string,
  ): Promise<void> {
    const event: TrustEvent = {
      eventType: "trust.admin_override" as TrustEventType,
      identityId,
      sessionId,
      trustScore: 0,
      trustLevel: trustLevel as any,
      previousTrustLevel: null,
      factors: [],
      timestamp: new Date().toISOString(),
      correlationId,
      source: "administrative",
      metadata: { overriddenBy, reason },
    };
    await this.bus.publish("trust.admin_override", event);
  }
}

// ══════════════════════════════════════════════════════════
// Consent Event Publisher
// ══════════════════════════════════════════════════════════

export interface ConsentEventPublisher {
  publishConsentGranted(
    identityId: string,
    consentType: string,
    scope: string[],
    purpose: string,
    version: number,
    correlationId: string,
  ): Promise<void>;

  publishConsentRevoked(
    identityId: string,
    consentType: string,
    version: number,
    reason: string,
    revokedBy: string,
    correlationId: string,
  ): Promise<void>;

  publishConsentExpired(
    identityId: string,
    consentType: string,
    version: number,
    correlationId: string,
  ): Promise<void>;

  publishConsentSnapshotCaptured(
    identityId: string,
    sessionId: string,
    consentTypes: string[],
    correlationId: string,
  ): Promise<void>;

  publishConsentVersionChanged(
    identityId: string,
    consentType: string,
    oldVersion: number,
    newVersion: number,
    correlationId: string,
  ): Promise<void>;
}

export class ConsentEventPublisherImpl implements ConsentEventPublisher {
  constructor(private bus: EventBus) {}

  async publishConsentGranted(
    identityId: string, consentType: string, scope: string[], purpose: string,
    version: number, correlationId: string,
  ): Promise<void> {
    const event: ConsentEvent = {
      eventType: "consent.granted" as ConsentEventType,
      identityId, consentType: consentType as any, granted: true, version,
      timestamp: new Date().toISOString(), correlationId, source: "trust-engine", metadata: {},
    };
    await this.bus.publish("consent.granted", event);
  }

  async publishConsentRevoked(
    identityId: string, consentType: string, version: number,
    reason, revokedBy, correlationId,
  ): Promise<void> {
    const event: ConsentEvent = {
      eventType: "consent.revoked" as ConsentEventType,
      identityId, consentType: consentType as any, granted: false, version,
      timestamp: new Date().toISOString(), correlationId, source: "trust-engine",
      metadata: { reason, revokedBy },
    };
    await this.bus.publish("consent.revoked", event);
  }

  async publishConsentExpired(
    identityId: string, consentType: string, version: number, correlationId: string,
  ): Promise<void> {
    const event: ConsentEvent = {
      eventType: "consent.expired" as ConsentEventType,
      identityId, consentType: consentType as any, granted: false, version,
      timestamp: new Date().toISOString(), correlationId, source: "trust-engine", metadata: {},
    };
    await this.bus.publish("consent.expired", event);
  }

  async publishConsentSnapshotCaptured(
    identityId: string, sessionId: string, consentTypes: string[], correlationId: string,
  ): Promise<void> {
    const event: ConsentEvent = {
      eventType: "consent.snapshot_captured" as ConsentEventType,
      identityId, consentType: "" as any, granted: true, version: 0,
      timestamp: new Date().toISOString(), correlationId, source: "trust-engine",
      metadata: { sessionId, consentTypes },
    };
    await this.bus.publish("consent.snapshot_captured", event);
  }

  async publishConsentVersionChanged(
    identityId: string, consentType: string, oldVersion: number, newVersion: number, correlationId: string,
  ): Promise<void> {
    const event: ConsentEvent = {
      eventType: "consent.version_changed" as ConsentEventType,
      identityId, consentType: consentType as any, granted: true, version: newVersion,
      timestamp: new Date().toISOString(), correlationId, source: "trust-engine",
      metadata: { oldVersion, newVersion },
    };
    await this.bus.publish("consent.version_changed", event);
  }
}

// ══════════════════════════════════════════════════════════
// Policy Event Publisher
// ══════════════════════════════════════════════════════════

export interface PolicyEventPublisher {
  publishPolicyCreated(policyId: string, policyName: string, category: string, version: number, correlationId: string): Promise<void>;
  publishPolicyUpdated(policyId: string, policyName: string, category: string, version: number, correlationId: string): Promise<void>;
  publishPolicyDeleted(policyId: string, policyName: string, category: string, version: number, correlationId: string): Promise<void>;
  publishPolicyEvaluated(policyId: string, policyName: string, category: string, version: number, result: string, correlationId: string): Promise<void>;
  publishPolicyPrecedenceChanged(policyId: string, policyName: string, oldPrecedence: number, newPrecedence: number, correlationId: string): Promise<void>;
}

export class PolicyEventPublisherImpl implements PolicyEventPublisher {
  constructor(private bus: EventBus) {}

  async publishPolicyCreated(policyId, policyName, category, version, correlationId): Promise<void> {
    await this.bus.publish("policy.created", { eventType: "policy.created", policyId, policyName, category, version, timestamp: new Date().toISOString(), correlationId, source: "policy-engine", metadata: {} });
  }
  async publishPolicyUpdated(policyId, policyName, category, version, correlationId): Promise<void> {
    await this.bus.publish("policy.updated", { eventType: "policy.updated", policyId, policyName, category, version, timestamp: new Date().toISOString(), correlationId, source: "policy-engine", metadata: {} });
  }
  async publishPolicyDeleted(policyId, policyName, category, version, correlationId): Promise<void> {
    await this.bus.publish("policy.deleted", { eventType: "policy.deleted", policyId, policyName, category, version, timestamp: new Date().toISOString(), correlationId, source: "policy-engine", metadata: {} });
  }
  async publishPolicyEvaluated(policyId, policyName, category, version, result, correlationId): Promise<void> {
    await this.bus.publish("policy.evaluated", { eventType: "policy.evaluated", policyId, policyName, category, version, result, timestamp: new Date().toISOString(), correlationId, source: "policy-engine", metadata: {} });
  }
  async publishPolicyPrecedenceChanged(policyId, policyName, oldPrecedence, newPrecedence, correlationId): Promise<void> {
    await this.bus.publish("policy.precedence_changed", { eventType: "policy.precedence_changed", policyId, policyName, category: "", version: 0, timestamp: new Date().toISOString(), correlationId, source: "policy-engine", metadata: { oldPrecedence, newPrecedence } });
  }
}

// ══════════════════════════════════════════════════════════
// Pre-built Event Bus instance
// ══════════════════════════════════════════════════════════

export const eventBus = new InMemoryEventBus();
export const trustEventPublisher = new TrustEventPublisherImpl(eventBus);
export const consentEventPublisher = new ConsentEventPublisherImpl(eventBus);
export const policyEventPublisher = new PolicyEventPublisherImpl(eventBus);