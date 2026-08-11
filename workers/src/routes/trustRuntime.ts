// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Trust Runtime APIs                              │
// │ REST API handlers for the Trust Runtime.              │
// │ Product-agnostic endpoints consumed by Concierge       │
// │ and all future AGS products.                              │
// │ Wave 4 — AI Platform Trust Runtime v1                      │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: API handlers store NO PHI in request/response
// bodies. PHI references are opaque IDs only. All trust/consent/policy
// decisions return metadata — never health data.

import type { Env } from "../types/env.js";
import type { Router } from "../router/index.js";
import type {
  EvaluateTrustRequest,
  EvaluateTrustResponse,
  EvaluatePolicyRequest,
  EvaluatePolicyResponse,
  GrantConsentRequest,
  GrantConsentResponse,
  RevokeConsentRequest,
  RevokeConsentResponse,
  ConsentHistoryRequest,
  ConsentHistoryResponse,
  GetTrustScoreRequest,
  GetTrustScoreResponse,
  CreateDelegationRequest,
  CreateDelegationResponse,
  RevokeDelegationRequest,
  RevokeDelegationResponse,
  CheckAuthorizationRequest,
  CheckAuthorizationResponse,
  ListPoliciesRequest,
  ListPoliciesResponse,
  ListPermissionsRequest,
  ListPermissionsResponse,
} from "../platform/trust/types.js";
import { withJwtAuth, getIdentityId } from "../middleware/jwt-auth.js";
import {
  identityOf,
  resolveScopedIdentityId,
  withAuthzErrors,
  protectedRoute,
} from "../middleware/authz.js";

// ════════════════════════════════════════════════
// Trust Evaluation API
// ════════════════════════════════════════════════

export async function trustEvaluate(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const body = await request.json<EvaluateTrustRequest>();

  if (!body.identityId) {
    return jsonResponse(
      { error: "identityId is required" },
      400,
    );
  }

  // Delegate to Trust Engine
  const trustResult = await env.TRUST_ENGINE.evaluate({
    identityId: body.identityId,
    sessionId: body.sessionId,
    factors: body.factors,
  });

  const response: EvaluateTrustResponse = {
    trustScore: trustResult.trustScore,
    trustLevel: trustResult.trustLevel,
    factors: trustResult.factors,
    evaluatedAt: trustResult.evaluatedAt,
  };

  return jsonResponse(response);
}

// ════════════════════════════════════════════════
// Policy Evaluation API
// ════════════════════════════════════════════════

export async function policyEvaluate(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const body = await request.json<EvaluatePolicyRequest>();

  if (!body.identityId || !body.action || !body.resource) {
    return jsonResponse(
      { error: "identityId, action, and resource are required" },
      400,
    );
  }

  const policyResult = await env.POLICY_ENGINE.evaluate({
    identityId: body.identityId,
    identityType: body.identityType ?? "user",
    action: body.action,
    resource: body.resource,
    context: body.context ?? {},
  });

  const response: EvaluatePolicyResponse = {
    allowed: policyResult.allowed,
    decision: policyResult.decision,
    reason: policyResult.reason,
    matchedRules: policyResult.matchedRules,
    evaluatedAt: new Date().toISOString(),
  };

  return jsonResponse(response);
}

// ════════════════════════════════════════════════
// Consent Grant API
// ════════════════════════════════════════════════

export async function consentGrant(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identity = identityOf(request);
  const body = await request.json<GrantConsentRequest>();

  if (!body.consentType) {
    return jsonResponse(
      { error: "consentType is required" },
      400,
    );
  }

  // Authoritative-identity model (Phase L IDOR remediation):
  // The acting patient identity is derived from the verified JWT — NEVER from
  // the client. Any client-supplied identityId (body OR query) is checked
  // against the caller's own identity; a patient cannot act for another
  // identity. resolveScopedIdentityId throws AuthzError (→ 403) on a mismatch.
  const url = new URL(request.url);
  const queryIdentityId = url.searchParams.get("identityId");
  const suppliedIds = [body.identityId, queryIdentityId].filter((id): id is string => !!id);
  const resolvedIds = suppliedIds.map((id) => resolveScopedIdentityId(identity, id));
  if (new Set(resolvedIds).size > 1) {
    return jsonResponse({ error: "Conflicting identity identifiers supplied" }, 400);
  }
  const actingIdentityId = resolvedIds[0] ?? identity.identityId;

  // The engine writes identity_id = actingIdentityId (JWT-derived) and ignores
  // any client-supplied identifier; the payload carries no identityId at all.
  const result = await env.CONSENT_ENGINE.grantConsent(actingIdentityId, {
    consentType: body.consentType,
    scope: Array.isArray(body.scope) ? body.scope : [],
    purpose: body.purpose ?? "",
    source: body.source,
    expiresAt: body.expiresAt,
    delegatorId: body.delegatorId,
    metadata: body.metadata,
  });

  const response: GrantConsentResponse = {
    consentId: result.id,
    granted: result.granted,
    versionToken: result.versionToken,
    createdAt: result.createdAt,
  };

  // Publish event
  await env.EVENT_BUS.publish("consent.granted", {
    identityId: actingIdentityId,
    consentType: body.consentType,
    granted: true,
    version: 1,
    timestamp: new Date().toISOString(),
    correlationId: crypto.randomUUID(),
    source: "api",
    metadata: {},
  });

  return jsonResponse(response, 201);
}

// ════════════════════════════════════════════════
// Consent Revoke API
// ════════════════════════════════════════════════

export async function consentRevoke(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const identity = identityOf(request);
  const body = await request.json<RevokeConsentRequest>();

  if (!body.consentId || !body.reason) {
    return jsonResponse(
      { error: "consentId and reason are required" },
      400,
    );
  }

  // Ownership is verified inside the engine BEFORE any mutation. A patient may
  // only revoke their OWN consent; a consent ID alone can never establish
  // authorization. Unauthorized revokes throw AuthzError (→ 403), never 500.
  const result = await env.CONSENT_ENGINE.revokeConsent(
    identity.identityId,
    identity.identityType,
    body.consentId,
    body.reason,
  );

  const response: RevokeConsentResponse = {
    consentId: result.consentId,
    revoked: result.revoked,
    revokedAt: result.revokedAt,
  };

  return jsonResponse(response);
}

// ════════════════════════════════════════════════
// Consent History API
// ════════════════════════════════════════════════

export async function consentHistory(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const url = new URL(request.url);
  const identityId = url.searchParams.get("identityId");
  const consentType = url.searchParams.get("consentType") as string | null;
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  if (!identityId) {
    return jsonResponse(
      { error: "identityId query parameter is required" },
      400,
    );
  }

  // Ownership check: a patient may only view their own consent history.
  const STAFF_TYPES_TR = ["clinic", "staff", "administrator"] as const;
  const callerIdentityType = request.headers.get("x-authenticated-identity-type") || "patient";
  const callerIdentityId = request.headers.get("x-authenticated-identity-id");
  const isTrStaff = STAFF_TYPES_TR.includes(callerIdentityType as any);
  if (!isTrStaff && callerIdentityId && callerIdentityId !== identityId) {
    return jsonResponse({ error: "Not authorized to view consent history for another identity" }, 403);
  }

  const result = await env.CONSENT_ENGINE.getHistory({
    identityId,
    consentType: consentType ?? undefined,
    limit,
    offset,
  });

  const response: ConsentHistoryResponse = {
    entries: result.entries,
    total: result.total,
    limit,
    offset,
  };

  return jsonResponse(response);
}

// ════════════════════════════════════════════════
// Get Trust Score API
// ════════════════════════════════════════════════

export async function getTrustScore(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const url = new URL(request.url);
  const identityId = url.searchParams.get("identityId");

  if (!identityId) {
    return jsonResponse(
      { error: "identityId query parameter is required" },
      400,
    );
  }

  const score = env.TRUST_ENGINE.getScore(identityId);

  if (!score) {
    return jsonResponse(
      { error: `No trust score found for identity ${identityId}` },
      404,
    );
  }

  const response: GetTrustScoreResponse = {
    identityId: score.identityId,
    trustScore: score.trustScore,
    trustLevel: score.trustLevel,
    factors: score.factors,
    expiresAt: score.expiresAt,
    evaluatedAt: score.createdAt,
  };

  return jsonResponse(response);
}

// ════════════════════════════════════════════════
// Create Delegation API
// ════════════════════════════════════════════════

export async function createDelegation(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const body = await request.json<CreateDelegationRequest>();

  if (!body.delegatorId || !body.delegateeId || !body.type || !body.expiresAt) {
    return jsonResponse(
      { error: "delegatorId, delegateeId, type, and expiresAt are required" },
      400,
    );
  }

  const delegation = await env.DELEGATION_ENGINE.create(body);

  const response: CreateDelegationResponse = {
    delegationId: delegation.id,
    delegatorId: delegation.delegatorId,
    delegateeId: delegation.delegateeId,
    scope: delegation.scope,
    type: delegation.type,
    expiresAt: delegation.expiresAt,
    createdAt: delegation.createdAt,
  };

  return jsonResponse(response, 201);
}

// ════════════════════════════════════════════════
// Revoke Delegation API
// ════════════════════════════════════════════════

export async function revokeDelegation(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const body = await request.json<RevokeDelegationRequest>();

  if (!body.delegationId || !body.reason) {
    return jsonResponse(
      { error: "delegationId and reason are required" },
      400,
    );
  }

  const result = await env.DELEGATION_ENGINE.revoke(body);

  const response: RevokeDelegationResponse = {
    delegationId: result.delegationId,
    revoked: result.revoked,
    revokedAt: result.revokedAt,
  };

  return jsonResponse(response);
}

// ════════════════════════════════════════════════
// Check Authorization API
// ════════════════════════════════════════════════

export async function checkAuthorization(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const body = await request.json<CheckAuthorizationRequest>();

  if (!body.identityId || !body.action || !body.resource) {
    return jsonResponse(
      { error: "identityId, action, and resource are required" },
      400,
    );
  }

  const result = await env.AUTHORIZATION_ENGINE.check(body);

  const response: CheckAuthorizationResponse = {
    decision: result.decision,
    reason: result.reason,
    trustScore: result.trustScore,
    trustLevel: result.trustLevel,
    consentEvaluations: result.consentEvaluations,
    policyEvaluations: result.policyEvaluations,
    riskScore: result.riskScore,
    riskLevel: result.riskLevel,
    evaluatedAt: result.evaluatedAt,
  };

  return jsonResponse(response);
}

// ════════════════════════════════════════════════
// List Policies API
// ════════════════════════════════════════════════

export async function listPolicies(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const enabled = url.searchParams.get("enabled");
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const policies = env.POLICY_ENGINE.listPolicies({
    category: category as any | undefined,
    enabled: enabled === "true" ? true : enabled === "false" ? false : undefined,
  });

  const response: ListPoliciesResponse = {
    policies: policies.slice(offset, offset + limit),
    total: policies.length,
    limit,
    offset,
  };

  return jsonResponse(response);
}

// ════════════════════════════════════════════════
// List Permissions API
// ════════════════════════════════════════════════

export async function listPermissions(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const url = new URL(request.url);
  const identityId = url.searchParams.get("identityId");
  const identityType = url.searchParams.get("identityType") ?? "user";

  if (!identityId) {
    return jsonResponse(
      { error: "identityId query parameter is required" },
      400,
    );
  }

  // Ownership check: a patient may only list their own permissions.
  const callerIdForPerm = request.headers.get("x-authenticated-identity-id");
  const callerTypePerm = request.headers.get("x-authenticated-identity-type") || "patient";
  const isTrStaffPerm = ["clinic", "staff", "administrator"].includes(callerTypePerm);
  if (!isTrStaffPerm && callerIdForPerm && callerIdForPerm !== identityId) {
    return jsonResponse({ error: "Not authorized to view permissions for another identity" }, 403);
  }

  // Check all known action/resource combinations
  const permissions = await env.AUTHORIZATION_ENGINE.listPermissions({
    identityId,
    identityType,
  });

  const response: ListPermissionsResponse = {
    permissions,
    identityId,
    evaluatedAt: new Date().toISOString(),
  };

  return jsonResponse(response);
}

// ════════════════════════════════════════════════
// API Registration Helper
// ════════════════════════════════════════════════

export function registerTrustRuntimeRoutes(router: Router): void {
  router.post("/api/v1/trust/evaluate", withJwtAuth(trustEvaluate));
  router.post("/api/v1/policy/evaluate", withJwtAuth(policyEvaluate));
  router.post("/api/v1/consent/grant", protectedRoute(consentGrant));
  router.post("/api/v1/consent/revoke", protectedRoute(consentRevoke));
  router.get("/api/v1/consent/history", withJwtAuth(consentHistory));
  router.get("/api/v1/trust/score", withJwtAuth(getTrustScore));
  router.post("/api/v1/delegation/create", withJwtAuth(createDelegation));
  router.post("/api/v1/delegation/revoke", withJwtAuth(revokeDelegation));
  router.post("/api/v1/authorization/check", withJwtAuth(checkAuthorization));
  router.get("/api/v1/policies", withJwtAuth(listPolicies));
  router.get("/api/v1/permissions", withJwtAuth(listPermissions));
}

// ════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// Removed duplicate type — uses types from trust/types.js