// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Resource Authorization Middleware              │
// │ Ownership and role enforcement for record-level access.      │
// └─────────────────────────────────────────────────────────────┘
//
// WHY THIS EXISTS
// ---------------
// `withJwtAuth` answers "who is calling?". It does NOT answer "may this
// caller touch THIS record?". Before this module, that second question was
// answered ad hoc inside individual handlers — and in most handlers it was
// not answered at all, which produced a family of IDOR/BOLA defects where an
// authenticated patient could read another patient's appointments, message
// threads and notifications by changing an id in the URL.
//
// This module makes the ownership check a shared, testable primitive so that
// "authenticated" can never again be mistaken for "authorised".
//
// PHI Boundary: this module reads identity ids and owner ids only. It never
// inspects or logs record contents.
//
// Usage:
//   router.get("/api/v1/appointments/:id", protectedRoute(_getAppointmentById));
//   ...then inside the handler:
//   assertOwnership(identityOf(request), appointment.patientId, "appointment");

import type { Env, RouteHandler } from "../types/env.js";
import { withJwtAuth, getAuthenticatedIdentity, type AuthenticatedIdentity } from "./jwt-auth.js";
import { IdentityType } from "../platform/identity/types.js";

// ════════════════════════════════════════════════
// Staff identity model
// ════════════════════════════════════════════════

/**
 * Identity types permitted to access records belonging to another identity.
 *
 * Deliberately an allowlist: any identity type not named here — including
 * future ones — is treated as a patient-equivalent and confined to its own
 * records. This mirrors CLINIC_IDENTITY_TYPES in the frontend ClinicGuard
 * (artifacts/ags-fertility/src/lib/auth-guard.tsx) so the client-side and
 * server-side notions of "clinic staff" cannot drift apart.
 */
export const STAFF_IDENTITY_TYPES: readonly string[] = Object.freeze([
  IdentityType.CLINIC,
  IdentityType.STAFF,
  IdentityType.ADMINISTRATOR,
]);

// ════════════════════════════════════════════════
// Authorization error
// ════════════════════════════════════════════════

export class AuthzError extends Error {
  constructor(
    message: string,
    public readonly code: string = "FORBIDDEN",
    public readonly status: number = 403,
  ) {
    super(message);
    this.name = "AuthzError";
  }
}

// ════════════════════════════════════════════════
// Predicates
// ════════════════════════════════════════════════

/** True when the identity type may act across other identities' records. */
export function isStaffIdentity(identityType: string | null | undefined): boolean {
  if (!identityType) return false;
  return STAFF_IDENTITY_TYPES.includes(identityType);
}

/**
 * Read the JWT-bound identity attached by `withJwtAuth`.
 * Throws if the handler was not wrapped — fail closed rather than fail open.
 */
export function identityOf(request: Request): AuthenticatedIdentity {
  return getAuthenticatedIdentity(request);
}

// ════════════════════════════════════════════════
// Assertions
// ════════════════════════════════════════════════

/** Require that the caller is clinic staff. Throws AuthzError otherwise. */
export function requireStaff(
  identity: AuthenticatedIdentity,
  action = "this operation",
): void {
  if (!isStaffIdentity(identity.identityType)) {
    throw new AuthzError(
      `Clinic staff identity required for ${action}`,
      "STAFF_REQUIRED",
    );
  }
}

/**
 * Require that the caller owns the record, or is staff.
 *
 * Fails closed on a missing/unknown owner: a record whose owner cannot be
 * determined is never returned to a non-staff caller, because an unattributed
 * record is exactly the shape a leaked record takes.
 */
export function assertOwnership(
  identity: AuthenticatedIdentity,
  ownerId: string | null | undefined,
  resource = "resource",
): void {
  if (isStaffIdentity(identity.identityType)) return;

  if (!ownerId) {
    throw new AuthzError(
      `Not authorized to access this ${resource}`,
      "OWNER_UNKNOWN",
    );
  }

  if (ownerId !== identity.identityId) {
    throw new AuthzError(
      `Not authorized to access this ${resource}`,
      "NOT_OWNER",
    );
  }
}

/**
 * Require that the caller participates in a record with two sides
 * (for example a message: sender or recipient). Staff bypass.
 */
export function assertParticipant(
  identity: AuthenticatedIdentity,
  participantIds: ReadonlyArray<string | null | undefined>,
  resource = "resource",
): void {
  if (isStaffIdentity(identity.identityType)) return;

  const isParticipant = participantIds.some((id) => !!id && id === identity.identityId);
  if (!isParticipant) {
    throw new AuthzError(
      `Not authorized to access this ${resource}`,
      "NOT_PARTICIPANT",
    );
  }
}

/**
 * Resolve a caller-supplied identity filter (e.g. `?patientId=`).
 *
 * - omitted            → the caller's own id
 * - equal to own id    → the caller's own id
 * - staff              → the requested id (cross-patient querying is their job)
 * - anyone else        → AuthzError
 *
 * Note this DENIES rather than silently substituting the caller's own id.
 * Silent substitution returns a plausible-looking 200 to what is actually an
 * attempted cross-patient read, which hides the attempt from logs and from
 * the caller. An explicit 403 is both safer and more honest.
 */
export function resolveScopedIdentityId(
  identity: AuthenticatedIdentity,
  requestedId: string | null | undefined,
): string {
  if (!requestedId) return identity.identityId;
  if (requestedId === identity.identityId) return identity.identityId;
  if (isStaffIdentity(identity.identityType)) return requestedId;

  throw new AuthzError(
    "Not authorized to query another identity's records",
    "SCOPE_VIOLATION",
  );
}

// ════════════════════════════════════════════════
// Error → Response mapping
// ════════════════════════════════════════════════

/** Convert an AuthzError to a JSON Response. Returns null for other errors. */
export function authzErrorResponse(err: unknown): Response | null {
  if (!(err instanceof AuthzError)) return null;
  return new Response(
    JSON.stringify({ error: "Forbidden", message: err.message, code: err.code }),
    { status: err.status, headers: { "Content-Type": "application/json" } },
  );
}

// ════════════════════════════════════════════════
// Handler wrappers
// ════════════════════════════════════════════════

/**
 * Translate AuthzError thrown anywhere inside a handler into a 403 response.
 * Without this an ownership failure would surface as an unhandled 500, which
 * both leaks less useful information to legitimate callers and hides the
 * authorization signal from logs.
 */
export function withAuthzErrors(handler: RouteHandler): RouteHandler {
  return async (request: Request, env: Env, params: Record<string, string>): Promise<Response> => {
    try {
      return await handler(request, env, params);
    } catch (err) {
      const response = authzErrorResponse(err);
      if (response) return response;
      throw err;
    }
  };
}

/** Require a staff identity before the handler runs. */
export function withStaffOnly(handler: RouteHandler): RouteHandler {
  return async (request: Request, env: Env, params: Record<string, string>): Promise<Response> => {
    requireStaff(identityOf(request));
    return handler(request, env, params);
  };
}

// ════════════════════════════════════════════════
// Composed route helpers
// ════════════════════════════════════════════════
//
// Registration sites should use these rather than composing wrappers by hand,
// so that every protected route gets identical JWT + authorization handling.
// Wrapper order matters: withJwtAuth must be outermost (it attaches the
// identity headers the inner layers read), and withStaffOnly must sit inside
// withAuthzErrors so its AuthzError becomes a 403 rather than a 500.

/** JWT-authenticated route with AuthzError → 403 mapping. */
export function protectedRoute(handler: RouteHandler): RouteHandler {
  return withJwtAuth(withAuthzErrors(handler));
}

/** JWT-authenticated route restricted to clinic staff identities. */
export function staffRoute(handler: RouteHandler): RouteHandler {
  return withJwtAuth(withAuthzErrors(withStaffOnly(handler)));
}
