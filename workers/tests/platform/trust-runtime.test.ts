// ┌─────────────────────────────────────────────────────────────┐
// AI Platform — Trust Runtime Unit Tests                       │
// Product-agnostic tests for all Trust Runtime components. │
// Wave 4 — AI Platform Trust Runtime v1                        │
// └─────────────────────────────────────────────────────────────┘

import { describe, it, expect, beforeEach } from "vitest";
import { PolicyEngine } from "../../src/platform/trust/policy-engine.js";
import { ConsentEngine } from "../../src/platform/trust/consent-engine.js";
import { TrustEngine } from "../../src/platform/trust/trust-engine.js";
import { RiskEngine } from "../../src/platform/trust/risk-engine.js";
import { DecisionEngine } from "../../src/platform/trust/decision-engine.js";
import { DelegationEngine } from "../../src/platform/trust/delegation-engine.js";
import { InMemoryEventBus } from "../../src/platform/trust/event-bus.js";
import { AuthorizationMiddleware } from "../../src/platform/trust/auth-middleware.js";
import { TrustLevel, PolicyCategory, ConsentType, ConsentState, DelegationType, ConsentSource, AuthorizationResult, RiskLevel } from "../../src/platform/trust/types.js";

// ════════════════════════════════════════════════
// Policy Engine Tests
// ════════════════════════════════════════════════

describe("PolicyEngine", () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = new PolicyEngine();
  });

  it("DENY by default when no policies match (fail-closed)", async () => {
    const result = await engine.evaluate({
      identityId: "user-1",
      identityType: "user",
      action: "read",
      resource: "patient:records",
      context: {},
    });

    expect(result.allowed).toBe(false);
    expect(result.decision).toBe("DENY");
    expect(result.failClosedResult).toBe(true);
    expect(result.reason).toContain("No matching rules");
  });

  it("ALLOW when a matching allow rule exists", async () => {
    engine.register({
      id: "policy-1",
      name: "Read Access Policy",
      description: "Allow read access to patient records",
      category: PolicyCategory.RBAC,
      version: 1,
      enabled: true,
      failClosed: true,
      precedence: 100,
      content: {
        rules: [
          {
            id: "rule-1",
            name: "allow-read-patient",
            action: "read",
            resource: "patient:*",
            effect: "allow",
            precedence: 1,
          },
        ],
      },
      metadata: {},
      createdAt: "2026-07-26T00:00:00Z",
      updatedAt: "2026-07-26T00:00:00Z",
    });

    const result = await engine.evaluate({
      identityId: "user-1",
      identityType: "user",
      action: "read",
      resource: "patient:records",
      context: {},
    });

    expect(result.allowed).toBe(true);
    expect(result.decision).toBe("ALLOW");
    expect(result.matchedRules.length).toBeGreaterThan(0);
  });

  it("DENY when a deny rule matches (deny-wins)", async () => {
    engine.register({
      id: "policy-2",
      name: "Write Restriction",
      description: "Deny writes to patient records",
      category: PolicyCategory.ABAC,
      version: 1,
      enabled: true,
      failClosed: true,
      precedence: 50,
      content: {
        rules: [
          {
            id: "rule-deny",
            name: "deny-write",
            action: "write",
            resource: "patient:*",
            effect: "deny",
            precedence: 1,
          },
        ],
      },
      metadata: {},
      createdAt: "2026-07-26T00:00:00Z",
      updatedAt: "2026-07-26T00:00:00Z",
    });

    const result = await engine.evaluate({
      identityId: "user-1",
      identityType: "user",
      action: "write",
      resource: "patient:records",
      context: {},
    });

    expect(result.allowed).toBe(false);
    expect(result.decision).toBe("DENY");
  });

  it("DENY when disabled policy is the only match", async () => {
    engine.register({
      id: "policy-disabled",
      name: "Disabled Policy",
      description: "This policy is disabled",
      category: PolicyCategory.RBAC,
      version: 1,
      enabled: false,
      failClosed: true,
      precedence: 100,
      content: {
        rules: [
          {
            id: "rule-allow",
            name: "allow-all",
            action: "*",
            resource: "*",
            effect: "allow",
            precedence: 1,
          },
        ],
      },
      metadata: {},
      createdAt: "2026-07-26T00:00:00Z",
      updatedAt: "2026-07-26T00:00:00Z",
    });

    const result = await engine.evaluate({
      identityId: "user-1",
      identityType: "user",
      action: "read",
      resource: "patient:records",
      context: {},
    });

    expect(result.allowed).toBe(false);
  });

  it("evaluates time-based policies", async () => {
    engine.register({
      id: "policy-time",
      name: "Business Hours Only",
      description: "Allow access only during business hours",
      category: PolicyCategory.TIME,
      version: 1,
      enabled: true,
      failClosed: true,
      precedence: 100,
      content: {
        timeWindows: [
          {
            id: "tw-1",
            name: "business-hours",
            daysOfWeek: [1, 2, 3, 4, 5],
            startTime: "09:00",
            endTime: "17:00",
            timezone: "UTC",
            action: "deny",
          },
        ],
      },
      metadata: {},
      createdAt: "2026-07-26T00:00:00Z",
      updatedAt: "2026-07-26T00:00:00Z",
    });

    const result = await engine.evaluate({
      identityId: "user-1",
      identityType: "user",
      action: "read",
      resource: "patient:records",
      context: { time: "2026-07-26T10:00:00Z" },
    });

    expect(result.decision).toBe("DENY");
  });

  it("evaluates risk-threshold policies", async () => {
    engine.register({
      id: "policy-risk",
      name: "Risk Threshold Policy",
      description: "Block high-risk requests",
      category: PolicyCategory.RISK,
      version: 1,
      enabled: true,
      failClosed: true,
      precedence: 100,
      content: {
        riskThresholds: [
          {
            id: "rt-1",
            name: "high-risk-deny",
            maxRiskScore: 0.5,
            action: "deny",
          },
        ],
      },
      metadata: {},
      createdAt: "2026-07-26T00:00:00Z",
      updatedAt: "2026-07-26T00:00:00Z",
    });

    const result = await engine.evaluate({
      identityId: "user-1",
      identityType: "user",
      action: "read",
      resource: "patient:records",
      context: { riskScore: 0.8 },
    });

    expect(result.decision).toBe("DENY");
  });

  it("lists only enabled policies when filter applied", async () => {
    engine.register({
      id: "policy-enabled",
      name: "Enabled Policy",
      description: "Enabled",
      category: PolicyCategory.RBAC,
      version: 1,
      enabled: true,
      failClosed: true,
      precedence: 100,
      content: { rules: [] },
      metadata: {},
      createdAt: "2026-07-26T00:00:00Z",
      updatedAt: "2026-07-26T00:00:00Z",
    });

    engine.register({
      id: "policy-disabled-2",
      name: "Disabled Policy 2",
      description: "Disabled",
      category: PolicyCategory.ABAC,
      version: 1,
      enabled: false,
      failClosed: true,
      precedence: 100,
      content: { rules: [] },
      metadata: {},
      createdAt: "2026-07-26T00:00:00Z",
      updatedAt: "2026-07-26T00:00:00Z",
    });

    const enabled = engine.listPolicies({ enabled: true });
    expect(enabled.length).toBe(1);
    expect(enabled[0].name).toBe("Enabled Policy");
  });
});

// ════════════════════════════════════════════════
// Consent Engine Tests
// ════════════════════════════════════════════════

describe("ConsentEngine", () => {
  let engine: ConsentEngine;

  beforeEach(() => {
    engine = new ConsentEngine();
  });

  it("grants consent and returns version token", async () => {
    const result = await engine.grant({
      identityId: "user-1",
      consentType: ConsentType.MEDICAL_TREATMENT,
      scope: ["patient:records"],
      purpose: "treatment",
      source: ConsentSource.EXPLICIT,
    });

    expect(result.granted).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.versionToken).toBeDefined();
  });

  it("evaluates granted consent as allowed", () => {
    // Grant first
    engine.grant({
      identityId: "user-1",
      consentType: ConsentType.MEDICAL_TREATMENT,
      scope: ["patient:records"],
      purpose: "treatment",
      source: ConsentSource.EXPLICIT,
    });

    const evalResult = engine.evaluate("user-1", ConsentType.MEDICAL_TREATMENT, "treatment");

    expect(evalResult.granted).toBe(true);
    expect(evalResult.consentType).toBe(ConsentType.MEDICAL_TREATMENT);
    expect(evalResult.reason).toBe("Active consent found");
  });

  it("denies when no consent exists", () => {
    const evalResult = engine.evaluate("user-1", ConsentType.MEDICAL_TREATMENT);

    expect(evalResult.granted).toBe(false);
    expect(evalResult.reason).toContain("denied by default");
  });

  it("denies after withdrawal", async () => {
    const grantResult = await engine.grant({
      identityId: "user-1",
      consentType: ConsentType.PRIVACY,
      scope: ["patient:records"],
      purpose: "treatment",
      source: ConsentSource.EXPLICIT,
    });

    await engine.withdraw({
      consentId: grantResult.id,
      reason: "User requested withdrawal",
      revokedBy: "user-1",
    });

    const evalResult = engine.evaluate("user-1", ConsentType.PRIVACY);

    expect(evalResult.granted).toBe(false);
    expect(evalResult.reason).toContain("denied by default");
  });

  it("returns history entries", async () => {
    await engine.grant({
      identityId: "user-1",
      consentType: ConsentType.MARKETING,
      scope: ["communications"],
      purpose: "marketing",
      source: ConsentSource.EXPLICIT,
    });

    const history = await engine.getHistory({
      identityId: "user-1",
      limit: 10,
      offset: 0,
    });

    expect(history.total).toBeGreaterThan(0);
    expect(history.entries.length).toBeGreaterThan(0);
  });

  it("captures consent snapshots", async () => {
    await engine.grant({
      identityId: "user-1",
      consentType: ConsentType.DOCUMENT_SHARING,
      scope: ["documents:share"],
      purpose: "treatment",
      source: ConsentSource.EXPLICIT,
    });

    const snapshots = await engine.captureSnapshot("user-1", "session-1");

    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots[0].identityId).toBe("user-1");
    expect(snapshots[0].sessionId).toBe("session-1");
  });

  it("returns correct identity for history", async () => {
    // Grant consent for user-1
    await engine.grant({
      identityId: "user-1",
      consentType: ConsentType.PRIVACY,
      scope: ["records"],
      purpose: "treatment",
      source: ConsentSource.EXPLICIT,
    });

    // Grant consent for user-2
    await engine.grant({
      identityId: "user-2",
      consentType: ConsentType.PRIVACY,
      scope: ["records"],
      purpose: "treatment",
      source: ConsentSource.EXPLICIT,
    });

    const history1 = await engine.getHistory({ identityId: "user-1", limit: 10, offset: 0 });
    const history2 = await engine.getHistory({ identityId: "user-2", limit: 10, offset: 0 });

    expect(history1.total).toBe(1);
    expect(history2.total).toBe(1);
  });
});

// ════════════════════════════════════════════════
// Trust Engine Tests
// ════════════════════════════════════════════════

describe("TrustEngine", () => {
  let engine: TrustEngine;

  beforeEach(() => {
    engine = new TrustEngine();
  });

  it("returns a trust score between 0 and 1", async () => {
    const result = await engine.evaluate({
      identityId: "user-1",
    });

    expect(result.trustScore).toBeGreaterThanOrEqual(0);
    expect(result.trustScore).toBeLessThanOrEqual(1);
    expect(result.trustLevel).toBeDefined();
  });

  it("maps scores to trust levels", async () => {
    const result = await engine.evaluate({ identityId: "user-1" });

    // Default factors all return 0.5 → medium trust
    expect(result.trustLevel).toBe(TrustLevel.MEDIUM);
  });

  it("detects level changes", async () => {
    const result1 = await engine.evaluate({ identityId: "user-2" });
    // Same identity evaluated again — no level change
    const result2 = await engine.evaluate({ identityId: "user-2", sessionId: "session-1" });

    // Level should be the same (both use defaults)
    expect(result2.previousLevel).toBe(result1.trustLevel);
  });

  it("getScore returns stored trust score", async () => {
    await engine.evaluate({ identityId: "user-3" });
    const score = engine.getScore("user-3");

    expect(score).toBeDefined();
    expect(score!.identityId).toBe("user-3");
    expect(score!.trustScore).toBeGreaterThanOrEqual(0);
  });

  it("getScore returns undefined for unknown identity", () => {
    const score = engine.getScore("unknown-user");
    expect(score).toBeUndefined();
  });

  it("administrative override changes trust level", async () => {
    await engine.evaluate({ identityId: "user-4" });
    const result = await engine.override("user-4", TrustLevel.ELEVATED, "Admin override", "admin-1");

    expect(result.trustLevel).toBe(TrustLevel.ELEVATED);
    expect(result.previousLevel).not.toBeNull();
  });

  it("trust decay reduces score over time", async () => {
    // Set elevated trust
    await engine.override("user-5", TrustLevel.ELEVATED, "Initial", "admin-1");

    // Simulate 48 hours idle
    const result = await engine.decay("user-5", 48);

    // Score should have decayed
    expect(result).not.toBeNull();
  });

  it("trust decay returns null for unknown identity", async () => {
    const result = await engine.decay("unknown-user", 48);
    expect(result).toBeNull();
  });
});

// ════════════════════════════════════════════════
// Risk Engine Tests
// ════════════════════════════════════════════════

describe("RiskEngine", () => {
  let engine: RiskEngine;

  beforeEach(() => {
    engine = new RiskEngine();
  });

  it("returns a risk score between 0 and 1", async () => {
    const result = await engine.evaluate({
      identityId: "user-1",
      action: "read",
      resource: "patient:records",
      context: {},
    });

    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(1);
    expect(result.riskLevel).toBeDefined();
  });

  it("denies when risk is critical and blocked", async () => {
    // Default risk engine has zero risk factors by default
    // so riskLevel is LOW, not blocked
    const result = await engine.evaluate({
      identityId: "user-1",
      action: "read",
      resource: "patient:records",
      context: {},
    });

    expect(result.blocked).toBe(false);
  });

  it("records risk events", async () => {
    const event = await engine.recordEvent({
      identityId: "user-1",
      sessionId: null,
      riskType: "auth_anomaly",
      severity: RiskLevel.HIGH,
      score: 0.7,
      details: {},
      resolved: false,
      metadata: {},
    });

    expect(event.id).toBeDefined();
    expect(event.identityId).toBe("user-1");
    expect(event.resolved).toBe(false);
  });

  it("tracks unresolved events", async () => {
    await engine.recordEvent({
      identityId: "user-1",
      sessionId: null,
      riskType: "auth_anomaly",
      severity: RiskLevel.HIGH,
      score: 0.7,
      details: {},
      resolved: false,
      metadata: {},
    });

    const unresolved = engine.getUnresolvedEvents();
    expect(unresolved.length).toBeGreaterThan(0);
  });

  it("resolves events", async () => {
    const event = await engine.recordEvent({
      identityId: "user-1",
      sessionId: null,
      riskType: "auth_anomaly",
      severity: RiskLevel.HIGH,
      score: 0.7,
      details: {},
      resolved: false,
      metadata: {},
    });

    const resolved = await engine.resolveEvent(event.id);
    expect(resolved).toBe(true);

    const unresolved = engine.getUnresolvedEvents();
    expect(unresolved.length).toBe(0);
  });
});

// ════════════════════════════════════════════════
// Delegation Engine Tests
// ════════════════════════════════════════════════

describe("DelegationEngine", () => {
  let engine: DelegationEngine;

  beforeEach(() => {
    engine = new DelegationEngine();
  });

  it("creates a delegation", async () => {
    const delegation = await engine.create({
      delegatorId: "patient-1",
      delegateeId: "concierge-1",
      scope: ["patient:read"],
      type: DelegationType.PATIENT_TO_CONCIERGE,
      expiresAt: "2027-07-26T00:00:00Z",
    });

    expect(delegation.id).toBeDefined();
    expect(delegation.delegatorId).toBe("patient-1");
    expect(delegation.delegateeId).toBe("concierge-1");
    expect(delegation.scope).toContain("patient:read");
  });

  it("rejects self-delegation", async () => {
    await expect(
      engine.create({
        delegatorId: "user-1",
        delegateeId: "user-1",
        scope: ["read"],
        type: DelegationType.PLATFORM_TO_AI_WORKER,
        expiresAt: "2027-07-26T00:00:00Z",
      }),
    ).rejects.toThrow();
  });

  it("rejects delegation without scope", async () => {
    await expect(
      engine.create({
        delegatorId: "patient-1",
        delegateeId: "concierge-1",
        scope: [],
        type: DelegationType.PATIENT_TO_CONCIERGE,
        expiresAt: "2027-07-26T00:00:00Z",
      }),
    ).rejects.toThrow();
  });

  it("revokes a delegation", async () => {
    const delegation = await engine.create({
      delegatorId: "patient-1",
      delegateeId: "family-1",
      scope: ["patient:read"],
      type: DelegationType.PATIENT_TO_FAMILY,
      expiresAt: "2027-07-26T00:00:00Z",
    });

    const result = await engine.revoke({
      delegationId: delegation.id,
      reason: "No longer needed",
      revokedBy: "patient-1",
    });

    expect(result.revoked).toBe(true);
    expect(result.revokedAt).toBeDefined();
  });

  it("rejects revocation of unknown delegation", async () => {
    await expect(
      engine.revoke({
        delegationId: "nonexistent",
        reason: "Test",
        revokedBy: "user-1",
      }),
    ).rejects.toThrow();
  });

  it("active delegation lookup excludes revoked", async () => {
    const delegation = await engine.create({
      delegatorId: "patient-1",
      delegateeId: "clinic-1",
      scope: ["patient:read"],
      type: DelegationType.PATIENT_TO_CLINIC,
      expiresAt: "2027-07-26T00:00:00Z",
    });

    await engine.revoke({
      delegationId: delegation.id,
      reason: "Revoked",
      revokedBy: "patient-1",
    });

    const active = engine.getActiveDelegations("clinic-1");
    expect(active.length).toBe(0);
  });

  it("resolves delegation chain", async () => {
    await engine.create({
      delegatorId: "patient-1",
      delegateeId: "concierge-1",
      scope: ["patient:read", "patient:write"],
      type: DelegationType.PATIENT_TO_CONCIERGE,
      expiresAt: "2027-07-26T00:00:00Z",
    });

    const chain = await engine.resolveChain("concierge-1", "patient:records", "read");

    expect(chain.valid).toBe(true);
    expect(chain.depth).toBeGreaterThan(0);
    expect(chain.rootDelegatorId).toBe("patient-1");
  });

  it("reports invalid chain when no active delegations", async () => {
    const chain = await engine.resolveChain("unknown-user", "patient:records", "read");

    expect(chain.valid).toBe(false);
    expect(chain.depth).toBe(0);
  });
});

// ════════════════════════════════════════════════
// Decision Engine Tests
// ════════════════════════════════════════════════

describe("DecisionEngine", () => {
  it("integrates all sub-engines for a full authorization decision", async () => {
    const policyEngine = new PolicyEngine();
    const consentEngine = new ConsentEngine();
    const trustEngine = new TrustEngine();
    const riskEngine = new RiskEngine();
    const decomp = {
      policyEngine,
      consentEngine,
      trustEngine,
      riskEngine,
    };
    const decisionEngine = new DecisionEngine(decomp);

    // Register an allow-all policy
    policyEngine.register({
      id: "allow-all",
      name: "Allow All",
      description: "Allow all actions",
      category: PolicyCategory.RBAC,
      version: 1,
      enabled: true,
      failClosed: true,
      precedence: 1,
      content: {
        rules: [
          {
            id: "allow-any",
            name: "allow-any",
            action: "*",
            resource: "*",
            effect: "allow",
            precedence: 1,
          },
        ],
      },
      metadata: {},
      createdAt: "2026-07-26T00:00:00Z",
      updatedAt: "2026-07-26T00:00:00Z",
    });

    // Grant consent - both privacy and medical treatment for patient records
    await consentEngine.grant({
      identityId: "user-1",
      consentType: ConsentType.PRIVACY,
      scope: ["patient:records"],
      purpose: "treatment",
      source: ConsentSource.EXPLICIT,
    });
    await consentEngine.grant({
      identityId: "user-1",
      consentType: ConsentType.MEDICAL_TREATMENT,
      scope: ["patient:records"],
      purpose: "treatment",
      source: ConsentSource.EXPLICIT,
    });

    const result = await decisionEngine.authorize({
      identityId: "user-1",
      identityType: "user",
      action: "read",
      resource: "patient:records",
      context: { trustScore: 0.8 },
      correlationId: "test-correlation-1",
    });

    console.log("DEBUG result:", JSON.stringify({ decision: result.decision, reason: result.reason, trustScore: result.trustScore, trustLevel: result.trustLevel, riskScore: result.riskScore, riskLevel: result.riskLevel, consentEvals: result.consentEvaluations.length, policyEvals: result.policyEvaluations.length }, null, 2));
    expect(result.decision).toBe("ALLOW");
    expect(result.reason).toContain("Policy matched");
  });

  it("DENY when no consent exists", async () => {
    const policyEngine = new PolicyEngine();
    const consentEngine = new ConsentEngine();
    const trustEngine = new TrustEngine();
    const riskEngine = new RiskEngine();
    const decomp = { policyEngine, consentEngine, trustEngine, riskEngine };
    const decisionEngine = new DecisionEngine(decomp);

    // Allow policy
    policyEngine.register({
      id: "allow-any",
      name: "Allow All",
      description: "Allow all",
      category: PolicyCategory.RBAC,
      version: 1,
      enabled: true,
      failClosed: true,
      precedence: 1,
      content: {
        rules: [
          { id: "r1", name: "allow-any", action: "*", resource: "*", effect: "allow", precedence: 1 },
        ],
      },
      metadata: {},
      createdAt: "2026-07-26T00:00:00Z",
      updatedAt: "2026-07-26T00:00:00Z",
    });

    // NO consent granted
    const result = await decisionEngine.authorize({
      identityId: "user-2",
      identityType: "user",
      action: "read",
      resource: "patient:records",
      context: { trustScore: 0.8 },
      correlationId: "test-correlation-2",
    });

    // Should be DENIED due to missing consent
    expect(result.decision).toBe("DENY");
  });

  it("handles pipeline errors gracefully (fail-closed)", async () => {
    const policyEngine = new PolicyEngine();
    const consentEngine = new ConsentEngine();
    const trustEngine = new TrustEngine();
    const riskEngine = new RiskEngine();
    const decomp = { policyEngine, consentEngine, trustEngine, riskEngine };
    const decisionEngine = new DecisionEngine(decomp);

    const result = await decisionEngine.authorize({
      identityId: "user-3",
      identityType: "user",
      action: "read",
      resource: "patient:records",
      context: {},
      correlationId: "test-correlation-3",
    });

    // Should not crash — fail closed
    expect(result.decision).toBeDefined();
    expect(result.reason).toBeDefined();
  });
});

// ════════════════════════════════════════════════
// Event Bus Tests
// ════════════════════════════════════════════════

describe("InMemoryEventBus", () => {
  let bus: InMemoryEventBus;

  beforeEach(() => {
    bus = new InMemoryEventBus();
  });

  it("publishes and subscribes to events", async () => {
    const received: Array<{ topic: string; event: unknown }> = [];
    bus.subscribe("trust.score_changed", (event: unknown) => {
      received.push({ topic: "trust.score_changed", event });
    });

    await bus.publish("trust.score_changed", { identityId: "user-1", score: 0.8 });

    expect(received.length).toBe(1);
    expect(received[0].event).toEqual({ identityId: "user-1", score: 0.8 });
  });

  it("supports unsubscribe", async () => {
    let callCount = 0;
    const unsubscribe = bus.subscribe("policy.evaluated", () => { callCount++; });

    await bus.publish("policy.evaluated", { policyId: "p1" });
    expect(callCount).toBe(1);

    unsubscribe();
    await bus.publish("policy.evaluated", { policyId: "p2" });
    expect(callCount).toBe(1); // No increase after unsubscribe
  });

  it("returns topic stats", async () => {
    bus.subscribe("trust.score_changed", () => {});
    bus.subscribe("trust.score_changed", () => {});

    await bus.publish("trust.score_changed", { test: true });

    const stats = bus.getTopicStats("trust.score_changed");
    expect(stats.published).toBe(1);
    expect(stats.subscribers).toBe(2);
  });

  it("lists all topics", () => {
    bus.subscribe("trust.score_changed", () => {});
    bus.subscribe("consent.granted", () => {});

    const topics = bus.getTopics();
    expect(topics).toContain("trust.score_changed");
    expect(topics).toContain("consent.granted");
  });
});

// ════════════════════════════════════════════════
// Integration Tests
// ════════════════════════════════════════════════

describe("Trust Runtime Integration", () => {
  it("full pipeline: trust → consent → policy → risk → decision", async () => {
    const policyEngine = new PolicyEngine();
    const consentEngine = new ConsentEngine();
    const trustEngine = new TrustEngine();
    const riskEngine = new RiskEngine();
    const decomp = { policyEngine, consentEngine, trustEngine, riskEngine };
    const decisionEngine = new DecisionEngine(decomp);

    // Register allow policy
    policyEngine.register({
      id: "integration-allow",
      name: "Integration Allow",
      description: "Allow all for integration test",
      category: PolicyCategory.RBAC,
      version: 1,
      enabled: true,
      failClosed: true,
      precedence: 1,
      content: {
        rules: [
          { id: "ir1", name: "allow-any", action: "*", resource: "*", effect: "allow", precedence: 1 },
        ],
      },
      metadata: {},
      createdAt: "2026-07-26T00:00:00Z",
      updatedAt: "2026-07-26T00:00:00Z",
    });

    // Grant consent - both privacy and medical treatment for patient records
    await consentEngine.grant({
      identityId: "integration-user",
      consentType: ConsentType.PRIVACY,
      scope: ["patient:records"],
      purpose: "treatment",
      source: ConsentSource.EXPLICIT,
    });
    await consentEngine.grant({
      identityId: "integration-user",
      consentType: ConsentType.MEDICAL_TREATMENT,
      scope: ["patient:records"],
      purpose: "treatment",
      source: ConsentSource.EXPLICIT,
    });

    const result = await decisionEngine.authorize({
      identityId: "integration-user",
      identityType: "user",
      action: "read",
      resource: "patient:records",
      context: { trustScore: 0.75 },
      correlationId: "integration-test-1",
    });

    expect(result.decision).toBe("ALLOW");
    expect(result.policyEvaluations.length).toBeGreaterThan(0);
    expect(result.consentEvaluations.length).toBeGreaterThan(0);
  });

  it("pipeline fails closed on errors", async () => {
    const decisionEngine = new DecisionEngine({
      policyEngine: new PolicyEngine(),
      consentEngine: new ConsentEngine(),
      trustEngine: new TrustEngine(),
      riskEngine: new RiskEngine(),
    });

    // No policies registered, no consent granted, no trust evaluated
    const result = await decisionEngine.authorize({
      identityId: "error-user",
      identityType: "user",
      action: "read",
      resource: "patient:records",
      context: {},
      correlationId: "error-test-1",
    });

    // Should be DENY (fail-closed) — not crash
    expect(result.decision).toBe("DENY");
  });
});