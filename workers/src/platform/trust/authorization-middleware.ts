// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Authorization Middleware                       │
// │ Integrates Identity Core hooks with Trust Runtime.    │
// │ Wraps request handling with the standard:                   │
// │  Authenticate → Resolve Identity → Resolve Session →        │
// │  Resolve Trust → Resolve Consent → Resolve Policy →          │
// │  Evaluate Risk → Authorize → Audit → Execute                │
// │ Wave 4 — AI Platform Trust Runtime v1                        │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: Middleware only handles metadata. All PHI
// references are opaque IDs. The middleware never inspects
// the content of resources — it only evaluates authorization
// metadata (identity, session, trust, consent, policy).

import type {
  AuthorizationRequest,
  AuthorizationResponse,
  AuthorizationPipelineContext,
  EvaluationContext,
  AuthorizationResult,
} from "./types.js";
import type { PolicyEngine } from "./policy-engine.js";
import type { ConsentEngine } from "./consent-engine.js";
import type { TrustEngine } from "./trust-engine.js";
import type { RiskEngine } from "./risk-engine.js";
import type { DelegationEngine } from "./delegation-engine.js";
import type { EventBus } from "./event-bus.js";
import { DecisionEngine } from "./decision-engine.js";

// ══════════════════════════════════════════════════════
// Identity Core Hooks Interface
// (Plugs into the existing identity module)
// ══════════════════════════════════════════════════════

export interface IdentityCoreHooks {
  authenticate(request: { token: string; sessionId?: string }): Promise<{
    identityId: string;
    identityType: string;
    authenticated: boolean;
    sessionId: string;
    mfaVerified: boolean;
    credentialsAge: number;
  } | null>;

  resolveIdentity(identityId: string): Promise<{
    id: string;
    type: string;
    roles: string[];
    attributes: Record<string, unknown>;
  } | null>;

  resolveSession(sessionId: string): Promise<{
    sessionId: string;
    identityId: string;
    createdAt: string;
    expiresAt: string;
    deviceId?: string;
    ipAddress?: string;
    userAgent?: string;
  } | null>;

  getDelegationChain(identityId: string): Promise<string[]>;
}

// ══════════════════════════════════════════════════════
// Middleware Options
// ══════════════════════════════════════════════════════

export interface AuthorizationMiddlewareOptions {
  trustWeight: number;        // How much trust score influences decision
  consentRequirement: "strict" | "relaxed" | "none";
  requireMfaForElevated: boolean;
  auditAllDecisions: boolean;
  correlationIdHeader: string;
  timeoutMs: number;
}

const DefaultOptions: AuthorizationMiddlewareOptions = {
  trustWeight: 0.3,
  consentRequirement: "strict",
  requireMfaForElevated: true,
  auditAllDecisions: true,
  correlationIdHeader: "X-Correlation-ID",
  timeoutMs: 5000,
};

// ══════════════════════════════════════════════════════
// Authorization Middleware
// ══════════════════════════════════════════════════════

export class AuthorizationMiddleware {
  private options: AuthorizationMiddlewareOptions;
  private decisionEngine: DecisionEngine;
  private eventBus: EventBus;

  constructor(
    decisionEngine: DecisionEngine,
    eventBus: EventBus,
    options?: Partial<AuthorizationMiddlewareOptions>,
  ) {
    this.options = { ...DefaultOptions, ...options };
    this.decisionEngine = decisionEngine;
    this.eventBus = eventBus;
  }

  // ══════════════════════════════════════════
  // Middleware Handler
  // ══════════════════════════════════════════

  async handleRequest(request: {
    token: string;
    sessionId: string;
    action: string;
    resource: string;
    correlationId?: string;
    context?: Partial<EvaluationContext>;
  }): Promise<AuthorizationResponse> {
    const correlationId = request.correlationId ?? crypto.randomUUID();

    // ── Step 1: Authenticate ──────────────────────────
    const authResult = await this.authenticate(request.token, request.sessionId);
    if (!authResult || !authResult.authenticated) {
      return this.buildDenyResponse("Authentication required", correlationId);
    }

    // ── Step 2: Resolve Identity ──────────────────────
    const identity = await this.resolveIdentity(authResult.identityId);
    if (!identity) {
      return this.buildDenyResponse("Identity not found", correlationId);
    }

    // ── Step 3: Resolve Session ───────────────────────
    const session = await this.resolveSession(request.sessionId);
    if (!session || new Date(session.expiresAt) < new Date()) {
      return this.buildDenyResponse("Session expired or not found", correlationId);
    }

    // ── Step 4: Resolve Trust ─────────────────────────
    const trustResult = await this.decisionEngine.deps.trustEngine.evaluate({
      identityId: authResult.identityId,
      sessionId: request.sessionId,
      factors: [
        { name: "mfa_status", score: authResult.mfaVerified ? 1.0 : 0.0, weight: 0.15, passed: authResult.mfaVerified },
        { name: "auth_strength", score: 0.8, weight: 0.2, passed: true, detail: "Strong authentication" },
      ],
    });

    // ── Step 5: Resolve Consent ───────────────────────
    // Delegated to decision engine

    // ── Step 6: Resolve Policy ────────────────────────
    // Delegated to decision engine

    // ── Step 7: Evaluate Risk ─────────────────────────
    // Delegated to decision engine

    // ── Step 8: Authorize ─────────────────────────────
    const evalContext: EvaluationContext = {
      time: new Date().toISOString(),
      sessionId: request.sessionId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      ...request.context,
    };

    const authRequest: AuthorizationRequest = {
      identityId: authResult.identityId,
      identityType: identity.type,
      action: request.action,
      resource: request.resource,
      context: evalContext,
      correlationId,
    };

    const response = await this.decisionEngine.authorize(authRequest);

    // ── Step 9: Audit ─────────────────────────────────
    if (this.options.auditAllDecisions) {
      await this.auditDecision(authResult, identity, response, correlationId);
    }

    // ── Step 10: Publish Event ────────────────────────
    await this.eventBus.publish(
      response.decision === AuthorizationResult.ALLOW ? "authorization.granted" : "authorization.denied",
      {
        correlationId,
        identityId: authResult.identityId,
        action: request.action,
        resource: request.resource,
        decision: response.decision,
        trustScore: response.trustScore,
        timestamp: new Date().toISOString(),
      },
    );

    return response;
  }

  // ── Quick Check (for policy/route guards) ────

  async check(request: {
    identityId: string;
    identityType: string;
    action: string;
    resource: string;
    correlationId?: string;
  }): Promise<{ allowed: boolean; reason: string }> {
    const correlationId = request.correlationId ?? crypto.randomUUID();
    const authRequest: AuthorizationRequest = {
      identityId: request.identityId,
      identityType: request.identityType,
      action: request.action,
      resource: request.resource,
      correlationId,
      context: { time: new Date().toISOString() },
    };
    const response = await this.decisionEngine.authorize(authRequest);
    return {
      allowed: response.decision === AuthorizationResult.ALLOW || response.decision === AuthorizationResult.CONDITIONAL,
      reason: response.reason,
    };
  }

  // ── Private Helpers ──────────────────────────────

  private async authenticate(token: string, sessionId?: string) {
    // Placeholder — integrates with Identity Core hooks
    // The actual Identity Core authentication is handled externally
    return null;
  }

  private async resolveIdentity(identityId: string) {
    // Placeholder — integrates with Identity Core hooks
    return null;
  }

  private async resolveSession(sessionId: string) {
    // Placeholder — integrates with Identity Core hooks
    return null;
  }

  private buildDenyResponse(reason: string, correlationId: string): AuthorizationResponse {
    return {
      decision: AuthorizationResult.DENY,
      reason,
      correlationId,
      trustScore: 0,
      trustLevel: "critical",
      consentEvaluations: [],
      policyEvaluations: [],
      riskScore: 1.0,
      riskLevel: "critical",
      delegationChain: null,
      auditId: crypto.randomUUID(),
      evaluatedAt: new Date().toISOString(),
      executionTimeMs: 0,
    };
  }

  private async auditDecision(
    authResult: { identityId: string; identityType: string; authenticated: boolean; sessionId: string; mfaVerified: boolean; credentialsAge: number } | null,
    identity: { id: string; type: string; roles: string[]; attributes: Record<string, unknown> } | null,
    response: AuthorizationResponse,
    correlationId: string,
  ): Promise<void> {
    // Publish audit event — actual persistence is handled by the event bus
    await this.eventBus.publish("authorization.audited", {
      correlationId,
      identityId: authResult?.identityId,
      action: response.decision,
      resource: "request-context",
      decision: response.decision,
      trustScore: response.trustScore,
      riskScore: response.riskScore,
      timestamp: new Date().toISOString(),
    });
  }
}

// ══════════════════════════════════════════════════════
// Worker Authorization Middleware (extended)
// ══════════════════════════════════════════════════════

export interface WorkerAuthorizationMiddlewareOptions extends AuthorizationMiddlewareOptions {
  requireApprovalChain: boolean;
  trustDecayEnabled: boolean;
  credentialRotationMinutes: number;
}

export class WorkerAuthorizationMiddleware extends AuthorizationMiddleware {
  private delegationEngine: DelegationEngine;
  private credentialRotationMinutes: number;

  constructor(
    decisionEngine: DecisionEngine,
    eventBus: EventBus,
    delegationEngine: DelegationEngine,
    options?: Partial<WorkerAuthorizationMiddlewareOptions>,
  ) {
    super(decisionEngine, eventBus, options);
    this.delegationEngine = delegationEngine;
    this.credentialRotationMinutes = options?.credentialRotationMinutes ?? 60;
  }

  async handleWorkerRequest(request: {
    workerId: string;
    workerType: string;
    action: string;
    resource: string;
    taskId?: string;
    credentialId?: string;
    correlationId?: string;
    context?: Partial<EvaluationContext>;
  }): Promise<AuthorizationResponse> {
    const correlationId = request.correlationId ?? crypto.randomUUID();

    // ── Step 1: Validate Worker Credential ────────────
    // Credential validation delegated to external credential manager
    const credentialValid = true; // Placeholder — actual check against credential store

    // ── Step 2: Check Delegation Chain ────────────────
    if (request.credentialId) {
      const chain = await this.delegationEngine.resolveChain(request.workerId, request.resource, request.action);
      if (!chain.valid) {
        return this.buildDenyResponse("No valid delegation chain for worker", correlationId);
      }
    }

    // ── Step 3: Check Approval Chain ──────────────────
    // (For elevated worker actions)

    // ── Step 4: Evaluate Trust (Worker trust score) ────
    const trustResult = await this.decisionEngine.deps.trustEngine.evaluate({
      identityId: request.workerId,
      sessionId: undefined,
    });

    // ── Step 5: Evaluate Trust Decay ──────────────────
    if (this.credentialRotationMinutes > 0) {
      const decayResult = await this.decisionEngine.deps.trustEngine.decay(
        request.workerId,
        this.credentialRotationMinutes,
      );
      if (decayResult && decayResult.trustLevel === "critical") {
        return this.buildDenyResponse("Worker credential decayed — re-authorization required", correlationId);
      }
    }

    // ── Step 6: Authorize ──────────────────────────────
    const authRequest: AuthorizationRequest = {
      identityId: request.workerId,
      identityType: "ai_worker",
      action: request.action,
      resource: request.resource,
      context: {
        time: new Date().toISOString(),
        ...request.context,
        metadata: { workerType: request.workerType, taskId: request.taskId },
      },
      correlationId,
    };

    const response = await this.decisionEngine.authorize(authRequest);

    // ── Step 7: Audit ──────────────────────────────────
    await this.eventBus.publish("worker.authorization.audited", {
      correlationId,
      workerId: request.workerId,
      workerType: request.workerType,
      action: request.action,
      resource: request.resource,
      decision: response.decision,
      credentialValid,
      timestamp: new Date().toISOString(),
    });

    return response;
  }
}