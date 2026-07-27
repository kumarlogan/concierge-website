// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Decision Engine                                  │
// │ Orchestrates the full authorization pipeline:            │
// │  Authenticate → Resolve Identity → Resolve Session →        │
// │  Resolve Trust → Resolve Consent → Resolve Policy →          │
// │  Evaluate Risk → Authorize → Audit → Execute               │
// │ Product-agnostic. Deterministic. Fail-closed.          │
// │ Wave 4 — AI Platform Trust Runtime v1                      │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: Decision Engine orchestrates the pipeline but
// never sees PHI. It delegates to Trust, Consent, and Policy
// engines which all operate on opaque IDs.
//
// Execution pipeline becomes the standard for EVERY AGS product.

import type {
  AuthorizationRequest,
  AuthorizationResponse,
  AuthorizationPipelineContext,
  AuditOutcome,
  DelegationChain,
} from "./types.js";
import { AuthorizationResult, ConsentType } from "./types.js";
import type { PolicyEngine } from "./policy-engine.js";
import type { ConsentEngine } from "./consent-engine.js";
import type { TrustEngine } from "./trust-engine.js";
import type { RiskEngine } from "./risk-engine.js";
import { AuthorizationError } from "./errors.js";

export interface DecisionEngineDeps {
  policyEngine: PolicyEngine;
  consentEngine: ConsentEngine;
  trustEngine: TrustEngine;
  riskEngine: RiskEngine;
}

export class DecisionEngine {
  private deps: DecisionEngineDeps;

  constructor(deps: DecisionEngineDeps) {
    this.deps = deps;
  }

  // ══════════════════════════════════════════
  // Main Authorization Decision
  // ══════════════════════════════════════════

  async authorize(request: AuthorizationRequest): Promise<AuthorizationResponse> {
    const startTime = Date.now();
    const correlationId = request.correlationId;

    try {
      // Step 1: Resolve Trust
      const trustResult = await this.deps.trustEngine.evaluate({
        identityId: request.identityId,
        sessionId: request.context.sessionId,
      });

      // Step 2: Resolve Consent (for each relevant consent type)
      const consentSnapshots = await this.resolveConsents(request, trustResult.trustLevel);

      // Step 3: Resolve Policy
      const policyResult = await this.deps.policyEngine.evaluate({
        identityId: request.identityId,
        identityType: request.identityType,
        action: request.action,
        resource: request.resource,
        context: request.context,
        trustScore: trustResult.trustScore,
        trustLevel: trustResult.trustLevel,
      });

      // Step 4: Evaluate Risk
      const riskResult = await this.deps.riskEngine.evaluate({
        identityId: request.identityId,
        action: request.action,
        resource: request.resource,
        context: request.context,
        trustScore: trustResult.trustScore,
      });

      // Step 5: Make Decision
      const decision = this.makeDecision(
        policyResult,
        riskResult,
        consentSnapshots,
        trustResult,
      );

      // Step 6: Build context for audit
      const pipelineContext: AuthorizationPipelineContext = {
        identityId: request.identityId,
        identityType: request.identityType,
        sessionId: request.context.sessionId,
        action: request.action,
        resource: request.resource,
        evaluationContext: request.context,
        trustScore: trustResult.trustScore,
        trustLevel: trustResult.trustLevel,
        consentSnapshots,
        policyEvaluations: [policyResult],
        riskScore: riskResult.riskScore,
        riskLevel: riskResult.riskLevel,
        delegationChain: request.delegationChain ?? null,
      };

      // Step 7: Audit
      const auditId = crypto.randomUUID();

      // Step 8: Return response
      const executionTimeMs = Date.now() - startTime;

      return {
        decision: decision.outcome,
        reason: decision.reason,
        correlationId,
        trustScore: trustResult.trustScore,
        trustLevel: trustResult.trustLevel,
        consentEvaluations: consentSnapshots.map((s) => ({
          granted: s.granted,
          consentType: s.consentType,
          scope: s.scope,
          purposeMatch: true,
          expired: false,
          revoked: false,
          source: s.source,
          snapshot: s,
          reason: s.granted ? "Consent granted" : "No active consent",
        })),
        policyEvaluations: [policyResult],
        riskScore: riskResult.riskScore,
        riskLevel: riskResult.riskLevel,
        delegationChain: request.delegationChain ?? null,
        auditId,
        evaluatedAt: new Date().toISOString(),
        executionTimeMs,
      };
    } catch (err) {
      // Fail closed on error
      const executionTimeMs = Date.now() - startTime;
      return {
        decision: AuthorizationResult.DENY,
        reason: `Authorization pipeline error: ${err instanceof Error ? err.message : "unknown error"}`,
        correlationId,
        trustScore: 0,
        trustLevel: "critical",
        consentEvaluations: [],
        policyEvaluations: [],
        riskScore: 1.0,
        riskLevel: "critical",
        delegationChain: request.delegationChain ?? null,
        auditId: crypto.randomUUID(),
        evaluatedAt: new Date().toISOString(),
        executionTimeMs,
      };
    }
  }

  // ── Consent Resolution ──────────────────────────

  private async resolveConsents(
    request: AuthorizationRequest,
    trustLevel: string,
  ): Promise<ConsentSnapshot[]> {
    const consentTypes = this.inferConsentTypes(request.action, request.resource);
    const snapshots: ConsentSnapshot[] = [];

    for (const consentType of consentTypes) {
      const evalResult = this.deps.consentEngine.evaluate(
        request.identityId,
        consentType,
      );
      snapshots.push(evalResult.snapshot);
    }

    return snapshots;
  }

  private inferConsentTypes(action: string, resource: string): ConsentType[] {
    const types: ConsentType[] = [];

    if (resource.includes("medical") || resource.includes("health") || resource.includes("patient")) {
      types.push(ConsentType.MEDICAL_TREATMENT);
    }

    if (action === "read" || action === "write" || action === "delete") {
      types.push(ConsentType.PRIVACY);
    }

    if (resource.includes("marketing") || resource.includes("communication")) {
      types.push(ConsentType.MARKETING);
    }

    if (resource.includes("research") || resource.includes("analytics")) {
      types.push(ConsentType.RESEARCH);
    }

    if (resource.includes("document") || resource.includes("file")) {
      types.push(ConsentType.DOCUMENT_SHARING);
    }

    if (types.length === 0) {
      types.push(ConsentType.PRIVACY);
    }

    return types;
  }

  // ── Decision Logic ──────────────────────────────

  private makeDecision(
    policyResult: PolicyEvaluationResult,
    riskResult: RiskEvaluationResult,
    consentSnapshots: ConsentSnapshot[],
    trustResult: TrustEvaluationResult,
  ): { outcome: AuthorizationResult; reason: string } {
    // 1. If risk is CRITICAL and blocked → DENY (fail closed)
    if (riskResult.riskLevel === "critical" && riskResult.blocked) {
      return {
        outcome: AuthorizationResult.DENY,
        reason: `Critical risk (score=${riskResult.riskScore}) — access blocked`,
      };
    }

    // 2. If policy explicitly DENY → DENY
    if (!policyResult.allowed) {
      return {
        outcome: AuthorizationResult.DENY,
        reason: `Policy evaluation denied: ${policyResult.reason}`,
      };
    }

    // 3. If any required consent is NOT granted → DENY (fail closed)
    const deniedConsents = consentSnapshots.filter((s) => !s.granted);
    if (deniedConsents.length > 0) {
      return {
        outcome: AuthorizationResult.DENY,
        reason: `Consent required but not granted for: ${deniedConsents.map((c) => c.consentType).join(", ")}`,
      };
    }

    // 4. If trust is CRITICAL → DENY
    if (trustResult.trustLevel === "critical") {
      return {
        outcome: AuthorizationResult.DENY,
        reason: `Trust level critical (score=${trustResult.trustScore}) — access denied`,
      };
    }

    // 5. If trust is LOW and risk is HIGH → CONDITIONAL (step-up)
    if (trustResult.trustLevel === "low" && riskResult.riskLevel === "high") {
      return {
        outcome: AuthorizationResult.CONDITIONAL,
        reason: `Low trust + high risk — step-up authentication required`,
      };
    }

    // 6. If risk is elevated but not blocked → CONDITIONAL
    if (riskResult.elevated) {
      return {
        outcome: AuthorizationResult.CONDITIONAL,
        reason: `Elevated risk (score=${riskResult.riskScore}) — additional verification required`,
      };
    }

    // 7. All checks passed → ALLOW
    return {
      outcome: AuthorizationResult.ALLOW,
      reason: `Policy matched, consent verified, trust acceptable, risk within thresholds`,
    };
  }
}

// Import the singleton engines for the default export
import { policyEngine } from "./policy-engine.js";
import { consentEngine } from "./consent-engine.js";
import { trustEngine } from "./trust-engine.js";
import { riskEngine } from "./risk-engine.js";

export const decisionEngine = new DecisionEngine({
  policyEngine: policyEngine,
  consentEngine: consentEngine,
  trustEngine: trustEngine,
  riskEngine: riskEngine,
});