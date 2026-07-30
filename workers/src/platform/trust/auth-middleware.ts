// ┌─────────────────────────────────────────────────────────────┐
// AI Platform — Authorization Middleware (Integration Layer)
// │ Bridges Identity Core hooks → Trust Runtime pipeline.    │
// │ Every request: Auth→Identity→Session→Trust→Consent→       │
// │ Policy→Risk→Authorize→Audit.                              │
// │ Wave 4 — AI Platform Trust Runtime v1                        │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: Middleware only handles metadata.
// PHI references are opaque IDs only.

import type { Env } from "../../types/env.js";
import type { AuthorizationRequest, AuthorizationResponse, EvaluationContext } from "./types.js";

// ══════════════════════════════════════════
// Identity Hook Interface (from Identity Core)
// ══════════════════════════════════════════

export interface IdentityHooks {
  authenticate(request: Request): Promise<{
    identityId: string;
    identityType: string;
    authenticated: boolean;
    sessionId: string;
    mfaVerified: boolean;
    credentialsAge: number;
  } | null>;

  resolveSession(sessionId: string): Promise<{
    sessionId: string;
    identityId: string;
    expiresAt: string;
    deviceId?: string;
    ipAddress?: string;
  } | null>;

  resolvePermissions(identityId: string, action: string, resource: string): Promise<string[]>;
}

// ══════════════════════════════════════════
// Middleware Configuration
// ══════════════════════════════════════════

export interface AuthMiddlewareConfig {
  trustEngine: {
    evaluate: (req: { identityId: string; sessionId?: string }) => Promise<{
      trustScore: number; trustLevel: string;
    }>;
  };
  consentEngine: {
    evaluate: (identityId: string, consentType: string) => Promise<{
      granted: boolean; scope: string[]; reason: string;
    }>;
  };
  policyEngine: {
    evaluate: (req: { identityId: string; identityType: string; action: string; resource: string; context: EvaluationContext }) => Promise<{
      allowed: boolean; decision: string; reason: string;
    }>;
  };
  riskEngine: {
    evaluate: (req: { identityId: string; action: string; resource: string; context: EvaluationContext }) => Promise<{
      riskScore: number; riskLevel: string; elevated: boolean; blocked: boolean;
    }>;
  };
  delegationEngine: {
    resolveChain: (identityId: string, resource: string, action: string) => Promise<{
      valid: boolean; depth: number; delegations: unknown[];
    }>;
  };
  auditLogger: (entry: unknown) => Promise<void>;
}

// ══════════════════════════════════════════
// Authorization Middleware
// ══════════════════════════════════════════

export class AuthMiddleware {
  private config: AuthMiddlewareConfig;
  private identityHooks: IdentityHooks;

  constructor(config: AuthMiddlewareConfig, identityHooks: IdentityHooks) {
    this.config = config;
    this.identityHooks = identityHooks;
  }

  // ════════════════════════════════
  // Main Middleware Handler
  // ════════════════════════════════

  async authorize(request: Request, env: Env): Promise<{
    authorized: boolean;
    decision: string;
    reason: string;
    correlationId: string;
    trustScore: number;
    trustLevel: string;
    consentEvaluations: unknown[];
    policyEvaluations: unknown[];
    riskScore: number;
    riskLevel: string;
    auditId: string;
  }> {
    const correlationId = crypto.randomUUID();

    // ── Step 1: Authenticate ────────────────────
    const authResult = await this.identityHooks.authenticate(request);
    if (!authResult || !authResult.authenticated) {
      return this.deny("Authentication required", correlationId);
    }

    // ── Step 2: Resolve Session ──────────────────
    const session = await this.identityHooks.resolveSession(authResult.sessionId);
    if (!session || new Date(session.expiresAt) < new Date()) {
      return this.deny("Session expired", correlationId);
    }

    // ── Step 3: Resolve Trust ────────────────────
    const trustResult = await this.config.trustEngine.evaluate({
      identityId: authResult.identityId,
      sessionId: authResult.sessionId,
    });

    // ── Step 4: Resolve Consent ──────────────────
    const consentEvals = await this.resolveConsents(authResult.identityId, request);
    const allConsentsGranted = consentEvals.every((c) => c.granted);

    // ── Step 5: Resolve Policy ───────────────────
    const url = new URL(request.url);
    const action = request.method.toLowerCase();
    const resource = url.pathname;

    const policyResult = await this.config.policyEngine.evaluate({
      identityId: authResult.identityId,
      identityType: "user",
      action,
      resource,
      context: {
        time: new Date().toISOString(),
        ipAddress: session.ipAddress,
        device: { mfaAuthenticated: authResult.mfaVerified },
        trustScore: trustResult.trustScore,
      },
    });

    // ── Step 6: Evaluate Risk ────────────────────
    const riskResult = await this.config.riskEngine.evaluate({
      identityId: authResult.identityId,
      action,
      resource,
      context: {
        time: new Date().toISOString(),
        riskScore: trustResult.trustScore,
      },
    });

    // ── Step 7: Decision ────────────────────────
    const decision = this.makeDecision(policyResult, riskResult, allConsentsGranted, trustResult);

    // ── Step 8: Audit ────────────────────────────
    await this.config.auditLogger({
      correlationId,
      identityId: authResult.identityId,
      action,
      resource,
      decision: decision.outcome,
      trustScore: trustResult.trustScore,
      riskScore: riskResult.riskScore,
      consentGranted: allConsentsGranted,
      timestamp: new Date().toISOString(),
    });

    // ── Step 9: Publish Event ────────────────────
    await env.EVENT_BUS.publish(
      decision.outcome === "ALLOW" ? "authorization.granted" : "authorization.denied",
      {
        correlationId,
        identityId: authResult.identityId,
        action,
        resource,
        decision: decision.outcome,
        timestamp: new Date().toISOString(),
      },
    );

    return {
      authorized: decision.outcome === "ALLOW" || decision.outcome === "CONDITIONAL",
      decision: decision.outcome,
      reason: decision.reason,
      correlationId,
      trustScore: trustResult.trustScore,
      trustLevel: trustResult.trustLevel,
      consentEvaluations: consentEvals,
      policyEvaluations: [policyResult],
      riskScore: riskResult.riskScore,
      riskLevel: riskResult.riskLevel,
      auditId: correlationId,
    };
  }

  // ── Consent Resolution ──────────────────────

  private async resolveConsents(identityId: string, request: Request): Promise<Array<{ granted: boolean; consentType: string; scope: string[]; reason: string }>> {
    const url = new URL(request.url);
    const resource = url.pathname;
    const consentTypes = this.inferConsentTypes(request.method, resource);

    const evals = await Promise.all(
      consentTypes.map(async (ct) => {
        const result = await this.config.consentEngine.evaluate(identityId, ct);
        return { granted: result.granted, consentType: ct, scope: result.scope, reason: result.reason };
      }),
    );

    return evals;
  }

  private inferConsentTypes(method: string, resource: string): string[] {
    const types: string[] = [];
    if (resource.includes("medical") || resource.includes("health") || resource.includes("patient")) {
      types.push("medical_treatment");
    }
    if (method === "GET" || method === "POST" || method === "PUT" || method === "DELETE") {
      types.push("privacy");
    }
    if (resource.includes("document") || resource.includes("file")) {
      types.push("document_sharing");
    }
    if (types.length === 0) types.push("privacy");
    return types;
  }

  // ── Decision Logic ──────────────────────────

  private makeDecision(
    policyResult: { allowed: boolean; decision: string; reason: string },
    riskResult: { riskScore: number; riskLevel: string; elevated: boolean; blocked: boolean },
    allConsentsGranted: boolean,
    trustResult: { trustScore: number; trustLevel: string },
  ): { outcome: string; reason: string } {
    if (riskResult.blocked) {
      return { outcome: "DENY", reason: `Critical risk (score=${riskResult.riskScore}) — blocked` };
    }
    if (!policyResult.allowed) {
      return { outcome: "DENY", reason: `Policy denied: ${policyResult.reason}` };
    }
    if (!allConsentsGranted) {
      return { outcome: "DENY", reason: "Consent not granted" };
    }
    if (trustResult.trustLevel === "critical") {
      return { outcome: "DENY", reason: "Trust level critical — access denied" };
    }
    if (riskResult.elevated) {
      return { outcome: "CONDITIONAL", reason: `Elevated risk — step-up required` };
    }
    return { outcome: "ALLOW", reason: "All checks passed" };
  }

  // ── Helpers ──────────────────────────────────

  private deny(reason: string, correlationId: string) {
    return {
      authorized: false,
      decision: "DENY" as const,
      reason,
      correlationId,
      trustScore: 0,
      trustLevel: "critical" as const,
      consentEvaluations: [],
      policyEvaluations: [],
      riskScore: 1,
      riskLevel: "critical" as const,
      auditId: correlationId,
    };
  }
}