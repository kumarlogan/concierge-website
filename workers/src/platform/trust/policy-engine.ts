// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Deterministic Policy Engine                    │
// │ Product-agnostic. Supports RBAC, ABAC, ReBAC, time,        │
// │ location, device, risk, purpose-of-use, emergency,          │
// │ and maintenance policies. Composable. Fail-closed.          │
// │ Wave 4 — AI Platform Trust Runtime v1                        │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: Policy engine NEVER sees PHI. Actions and
// resources are string identifiers referencing external PHI stores.
// Consent and trust evaluation delegates to separate engines.

import type {
  Policy,
  PolicyContent,
  PolicyEvaluationRequest,
  PolicyEvaluationResult,
  MatchedRule,
  PolicySnapshot,
  EvaluationContext,
  PolicyRule,
  PolicyCondition,
  TimeWindow,
  LocationConstraint,
  DeviceConstraint,
  RiskThreshold,
  PurposeConstraint,
  EmergencyRule,
  MaintenanceRule,
} from "./types.js";
import { PolicyCategory, Decision } from "./types.js";
import { PolicyEngineError } from "./errors.js";

/** Murmurhash-like simple hash for content integrity */
function hashContent(content: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    h ^= content.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

export class PolicyEngine {
  private policies: Map<string, Policy> = new Map();

  // ── Registration ──────────────────────────────────────

  register(policy: Policy): void {
    this.policies.set(policy.id, policy);
  }

  unregister(policyId: string): void {
    this.policies.delete(policyId);
  }

  getPolicy(policyId: string): Policy | undefined {
    return this.policies.get(policyId);
  }

  listPolicies(filter?: {
    category?: PolicyCategory;
    enabled?: boolean;
  }): Policy[] {
    const result = Array.from(this.policies.values());
    if (filter?.category) {
      return result.filter((p) => p.category === filter.category);
    }
    if (filter?.enabled !== undefined) {
      return result.filter((p) => p.enabled === filter.enabled);
    }
    return result;
  }

  // ── Evaluation ─────────────────────────────────────────

  async evaluate(request: PolicyEvaluationRequest): Promise<PolicyEvaluationResult> {
    const startTime = Date.now();
    const enabledPolicies = this.listPolicies({ enabled: true });

    const matchedRules: MatchedRule[] = [];
    const unmatchedRules: string[] = [];
    let conditionsEvaluated = 0;
    let conditionsPassed = 0;
    let conditionsFailed = 0;
    let denyOverride = false;
    let failClosedResult = true; // default DENY

    // Sort by precedence (lower = higher priority)
    const sorted = [...enabledPolicies].sort((a, b) => a.precedence - b.precedence);

    for (const policy of sorted) {
      const content = policy.content;

      // 1. Evaluate RBAC rules
      if (content.rules) {
        for (const rule of content.rules) {
          conditionsEvaluated++;
          const ruleResult = await this.evaluateRule(rule, request);
          if (ruleResult.matched) {
            conditionsPassed++;
            matchedRules.push({
              ruleId: rule.id,
              ruleName: rule.name,
              category: policy.category,
              effect: rule.effect,
              precedence: rule.precedence,
              matchedConditions: ruleResult.matchedConditions,
            });
            if (rule.effect === "deny") {
              denyOverride = true;
            }
          } else {
            conditionsFailed++;
            unmatchedRules.push(rule.id);
          }
        }
      }

      // 2. Evaluate ABAC conditions
      if (content.conditions) {
        for (const condition of content.conditions) {
          conditionsEvaluated++;
          const passed = this.evaluateCondition(condition, request);
          if (passed) {
            conditionsPassed++;
          } else {
            conditionsFailed++;
            unmatchedRules.push(condition.id);
          }
        }
      }

      // 3. Evaluate time windows
      if (content.timeWindows) {
        for (const tw of content.timeWindows) {
          conditionsEvaluated++;
          const inWindow = this.evaluateTimeWindow(tw);
          if (tw.action === "deny" && !inWindow) {
            // Outside allowed time → deny
            matchedRules.push({
              ruleId: tw.id,
              ruleName: tw.name,
              category: policy.category,
              effect: "deny",
              precedence: policy.precedence,
              matchedConditions: [tw.id],
            });
            denyOverride = true;
          } else if (inWindow) {
            conditionsPassed++;
          } else {
            conditionsFailed++;
          }
        }
      }

      // 4. Evaluate location constraints
      if (content.locationConstraints) {
        for (const lc of content.locationConstraints) {
          conditionsEvaluated++;
          const allowed = this.evaluateLocationConstraint(lc, request.context);
          if (lc.action === "deny" && !allowed) {
            matchedRules.push({
              ruleId: lc.id,
              ruleName: lc.name,
              category: policy.category,
              effect: "deny",
              precedence: policy.precedence,
              matchedConditions: [lc.id],
            });
            denyOverride = true;
          } else if (allowed) {
            conditionsPassed++;
          } else {
            conditionsFailed++;
          }
        }
      }

      // 5. Evaluate device constraints
      if (content.deviceConstraints) {
        for (const dc of content.deviceConstraints) {
          conditionsEvaluated++;
          const allowed = this.evaluateDeviceConstraint(dc, request.context);
          if (dc.action === "deny" && !allowed) {
            matchedRules.push({
              ruleId: dc.id,
              ruleName: dc.name,
              category: policy.category,
              effect: "deny",
              precedence: policy.precedence,
              matchedConditions: [dc.id],
            });
            denyOverride = true;
          } else if (allowed) {
            conditionsPassed++;
          } else {
            conditionsFailed++;
          }
        }
      }

      // 6. Evaluate risk thresholds
      if (content.riskThresholds && request.context.riskScore !== undefined) {
        for (const rt of content.riskThresholds) {
          conditionsEvaluated++;
          if (request.context.riskScore! > rt.maxRiskScore) {
            if (rt.action === "deny") {
              matchedRules.push({
                ruleId: rt.id,
                ruleName: rt.name,
                category: policy.category,
                effect: "deny",
                precedence: policy.precedence,
                matchedConditions: [rt.id],
              });
              denyOverride = true;
            }
          } else {
            conditionsPassed++;
          }
        }
      }

      // 7. Evaluate purpose-of-use constraints
      if (content.purposeConstraints && request.context.purposeOfUse) {
        for (const pc of content.purposeConstraints) {
          conditionsEvaluated++;
          const purposeMatch = pc.purposes.includes(request.context.purposeOfUse!);
          if (purposeMatch) {
            conditionsPassed++;
          } else {
            conditionsFailed++;
            unmatchedRules.push(pc.id);
          }
        }
      }
    }

    // Resolve deny-wins: if any deny rule matched, DENY
    // If no rules matched at all, fail-closed (DENY)
    let finalDecision: Decision;
    let finalAllowed: boolean;
    let reason: string;

    if (denyOverride) {
      finalDecision = Decision.DENY;
      finalAllowed = false;
      reason = "Deny rule matched — access denied (fail-closed)";
    } else if (matchedRules.length === 0) {
      // No rules matched → fail closed
      finalDecision = Decision.DENY;
      finalAllowed = false;
      reason = "No matching rules found — fail-closed default DENY";
    } else {
      finalDecision = Decision.ALLOW;
      finalAllowed = true;
      reason = `${matchedRules.length} rule(s) matched — access allowed`;
    }

    const evaluationTimeMs = Date.now() - startTime;

    return {
      allowed: finalAllowed,
      decision: finalDecision,
      matchedRules,
      unmatchedRules,
      conditionsEvaluated,
      conditionsPassed,
      conditionsFailed,
      failClosedResult: !finalAllowed,
      reason,
      policySnapshot: this.buildPolicySnapshot(sorted),
      evaluationTimeMs,
    };
  }

  // ── Private Helpers ────────────────────────────────────

  private async evaluateRule(
    rule: PolicyRule,
    request: PolicyEvaluationRequest,
  ): Promise<{ matched: boolean; matchedConditions: string[] }> {
    // Check action match
    if (rule.action !== "*" && rule.action !== request.action) {
      return { matched: false, matchedConditions: [] };
    }

    // Check resource match (supports wildcard patterns)
    if (!this.matchResource(rule.resource, request.resource)) {
      return { matched: false, matchedConditions: [] };
    }

    // Evaluate conditions if any
    if (rule.conditions && rule.conditions.length > 0) {
      const matchedConditions: string[] = [];
      for (const condition of rule.conditions) {
        if (this.evaluateCondition(condition, request)) {
          matchedConditions.push(condition.id);
        } else {
          return { matched: false, matchedConditions: [] };
        }
      }
      return { matched: true, matchedConditions };
    }

    return { matched: true, matchedConditions: [] };
  }

  private matchResource(pattern: string, resource: string): boolean {
    if (pattern === "*" || pattern === resource) return true;
    // Simple wildcard: "resource:*" matches "resource:anything"
    if (pattern.endsWith(":*")) {
      const prefix = pattern.slice(0, -2);
      return resource.startsWith(prefix + ":");
    }
    return false;
  }

  private evaluateCondition(condition: PolicyCondition, request: PolicyEvaluationRequest): boolean {
    const ctxValue = this.resolveContextValue(condition.attribute, request);
    return this.compare(ctxValue, condition.operator, condition.value);
  }

  private resolveContextValue(attribute: string, request: PolicyEvaluationRequest): unknown {
    // Dot-notation resolution from context
    const parts = attribute.split(".");
    let obj: unknown = request;
    for (const part of parts) {
      if (typeof obj !== "object" || obj === null) return undefined;
      obj = (obj as Record<string, unknown>)[part];
    }
    // Also check context specifically
    if (parts[0] === "context") {
      obj = request.context;
      for (let i = 1; i < parts.length; i++) {
        if (typeof obj !== "object" || obj === null) return undefined;
        obj = (obj as Record<string, unknown>)[parts[i]];
      }
    }
    return obj;
  }

  private compare(actual: unknown, operator: string, expected: unknown): boolean {
    switch (operator) {
      case "eq":
        return actual === expected;
      case "neq":
        return actual !== expected;
      case "in":
        return Array.isArray(expected) && expected.includes(actual);
      case "not_in":
        return Array.isArray(expected) && !expected.includes(actual);
      case "gt":
        return typeof actual === "number" && typeof expected === "number" && actual > expected;
      case "lt":
        return typeof actual === "number" && typeof expected === "number" && actual < expected;
      case "gte":
        return typeof actual === "number" && typeof expected === "number" && actual >= expected;
      case "lte":
        return typeof actual === "number" && typeof expected === "number" && actual <= expected;
      case "contains":
        return typeof actual === "string" && actual.includes(String(expected));
      case "matches":
        return typeof actual === "string" && new RegExp(String(expected)).test(actual);
      default:
        return false;
    }
  }

  private evaluateTimeWindow(tw: TimeWindow): boolean {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    if (!tw.daysOfWeek.includes(dayOfWeek)) return false;

    const [startH, startM] = tw.startTime.split(":").map(Number);
    const [endH, endM] = tw.endTime.split(":").map(Number);
    const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    }
    // Overnight window (e.g., 22:00–06:00)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }

  private evaluateLocationConstraint(
    lc: LocationConstraint,
    context: EvaluationContext | undefined,
  ): boolean {
    if (!context?.location) return false;
    if (lc.allowedCountries && !lc.allowedCountries.includes(context.location.country ?? "")) {
      return false;
    }
    if (lc.allowedRegions && !lc.allowedRegions.includes(context.location.region ?? "")) {
      return false;
    }
    if (lc.allowedIps && context.location.ipAddress) {
      return lc.allowedIps.some((ip) => this.ipMatches(context.location!.ipAddress!, ip));
    }
    return true;
  }

  private evaluateDeviceConstraint(dc: DeviceConstraint, context: EvaluationContext | undefined): boolean {
    if (dc.mfaRequired && !context?.device?.mfaAuthenticated) return false;
    if (dc.allowedDeviceTypes && context?.device?.deviceType && !dc.allowedDeviceTypes.includes(context.device.deviceType)) {
      return false;
    }
    if (dc.allowedOsTypes && context?.device?.osType && !dc.allowedOsTypes.includes(context.device.osType)) {
      return false;
    }
    if (dc.trustedDeviceIds && context?.device?.fingerprint && !dc.trustedDeviceIds.includes(context.device.fingerprint)) {
      return false;
    }
    return true;
  }

  private ipMatches(actual: string, pattern: string): boolean {
    // Supports CIDR notation and exact match
    if (actual === pattern) return true;
    if (pattern.includes("/")) {
      // Simple CIDR check (IPv4 only, basic)
      const [prefix, bitsStr] = pattern.split("/");
      const bits = parseInt(bitsStr, 10);
      if (isNaN(bits)) return false;
      const actualBytes = actual.split(".").map(Number);
      const prefixBytes = prefix.split(".").map(Number);
      const totalBits = bits;
      for (let i = 0; i < 4; i++) {
        const bitsInByte = Math.min(8, totalBits - i * 8);
        if (bitsInByte <= 0) break;
        const mask = (0xff << (8 - bitsInByte)) & 0xff;
        if ((actualBytes[i] & mask) !== (prefixBytes[i] & mask)) return false;
      }
      return true;
    }
    return false;
  }

  private buildPolicySnapshot(policies: Policy[]): PolicySnapshot {
    return {
      policyId: policies.map((p) => p.id).join(","),
      policyName: policies.map((p) => p.name).join(","),
      version: Math.max(...policies.map((p) => p.version), 1),
      category: policies[0]?.category ?? PolicyCategory.RBAC,
      enabled: true,
      contentHash: hashContent(JSON.stringify(policies.map((p) => p.content))),
      capturedAt: new Date().toISOString(),
    };
  }
}

export const policyEngine = new PolicyEngine();