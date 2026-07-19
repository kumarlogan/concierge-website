// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Authorization Middleware               │
// │ EPIC-002-002: Identity & Authorization Engine                │
// └─────────────────────────────────────────────────────────────┘
//
// The reusable enforcement layer. It composes the earlier stages into a single
// call that any interface (Hermes Admin, Operations Bot, future Dashboard,
// Mobile, Clinic Portal) uses identically:
//
//   Request → resolveIdentity → buildPrincipal → hasPermission
//          → writeAuditEvent → (Principal | 401/403)
//
// CRITICAL (ADR-003): this middleware contains NO hardcoded role→permission
// mappings. It delegates all permission logic to the data-driven
// PermissionResolver (permissions.ts), which reads role_permissions and
// user_permissions from the database. Changing what a role can do is a data
// write, not a code change.

import type { D1Database } from "@cloudflare/workers-types";
import { buildPrincipal } from "./principal.js";
import { hasPermission } from "./permissions.js";
import { writeAuditEvent } from "./audit.js";
import { resolveIdentity } from "./providers.js";
import { AuthError, type Principal } from "./types.js";

/** A resource the requested action targets. */
export interface ResourceTarget {
  type: string;
  id?: string | null;
}

/** Options controlling an authorization attempt. */
export interface AuthorizeOptions {
  /** The permission key required for the action, e.g. "leads.read". */
  permission: string;
  /** The resource being acted on (for audit). */
  resource?: ResourceTarget;
  /** Request id for correlation (set by upstream gateway). */
  requestId?: string | null;
}

/** Outcome of an authorization attempt. */
export type AuthorizeResult =
  | { authorized: true; principal: Principal }
  | { authorized: false; response: Response };

/** Standard JSON error body for unauthorized requests. */
function unauthorizedResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: status === 401 ? "unauthenticated" : "forbidden",
      message,
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

/** Extract forensic context from the request for the audit trail. */
function requestContext(request: Request, requestId?: string | null) {
  return {
    ipAddress:
      request.headers.get("CF-Connecting-IP") ??
      request.headers.get("X-Forwarded-For") ??
      null,
    userAgent: request.headers.get("User-Agent") ?? null,
    requestId: requestId ?? null,
  };
}

/**
 * Authorize a request for a single permission.
 *
 * Runs the full pipeline: identity resolution → principal building →
 * permission check → audit write. On success returns the Principal; on
 * failure returns a ready-to-send 401/403 Response. Callers simply do:
 *
 *   const result = await authorize(env.DB, request, { permission: "leads.read" });
 *   if (!result.authorized) return result.response;
 *   // use result.principal...
 *
 * @throws never — errors are translated into 401/403/500 responses so the
 *         Worker can return them directly. (DB faults during principal
 *         building surface as 500 to avoid leaking internals.)
 */
export async function authorize(
  db: D1Database,
  request: Request,
  options: AuthorizeOptions,
): Promise<AuthorizeResult> {
  const ctx = requestContext(request, options.requestId);
  const timestamp = new Date().toISOString();

  // ── 1. Identity Resolution ─────────────────────────────────
  let identity;
  try {
    identity = await resolveIdentity(request);
  } catch (err) {
    if (err instanceof AuthError) {
      return { authorized: false, response: unauthorizedResponse(err.status, err.message) };
    }
    console.error("Identity resolution fault:", err instanceof Error ? err.message : String(err));
    return { authorized: false, response: unauthorizedResponse(401, "Identity resolution failed") };
  }

  if (!identity) {
    return {
      authorized: false,
      response: unauthorizedResponse(401, "No recognized identity on request"),
    };
  }

  // ── 2. Principal Building ──────────────────────────────────
  let principal: Principal;
  try {
    principal = await buildPrincipal(db, identity);
  } catch (err) {
    if (err instanceof AuthError) {
      // Audit the failed authn attempt (actor unknown → use provider id).
      await writeAuditEvent(db, {
        actorId: identity.providerIdentifier,
        permission: options.permission,
        resource: options.resource
          ? { type: options.resource.type, id: options.resource.id ?? null }
          : undefined,
        result: "deny",
        reason: `authn_failed:${err.message}`,
        timestamp,
        context: {
          provider: identity.provider,
          providerIdentifier: identity.providerIdentifier,
          ...ctx,
        },
      });
      return { authorized: false, response: unauthorizedResponse(err.status, err.message) };
    }
    console.error("Principal build fault:", err instanceof Error ? err.message : String(err));
    return { authorized: false, response: unauthorizedResponse(500, "Authorization unavailable") };
  }

  // ── 3. Permission Check (data-driven) ─────────────────────
  let allowed = false;
  let reason = "";
  try {
    allowed = await hasPermission(
      db,
      principal.roleId,
      principal.userId,
      options.permission,
    );
    reason = allowed
      ? principal.roleName === "OWNER"
        ? "OWNER short-circuit"
        : "role/user grant"
      : "no matching grant";
  } catch (err) {
    console.error("Permission check fault:", err instanceof Error ? err.message : String(err));
    return { authorized: false, response: unauthorizedResponse(500, "Authorization unavailable") };
  }

  // ── 4. Audit (both outcomes) ──────────────────────────────
  await writeAuditEvent(db, {
    actorId: principal.userId,
    permission: options.permission,
    resource: options.resource
      ? { type: options.resource.type, id: options.resource.id ?? null }
      : undefined,
    result: allowed ? "allow" : "deny",
    reason,
    timestamp,
    context: {
      provider: principal.provider,
      providerIdentifier: principal.providerIdentifier,
      ...ctx,
    },
  });

  // ── 5. Respond ─────────────────────────────────────────────
  if (!allowed) {
    return {
      authorized: false,
      response: unauthorizedResponse(403, `Missing permission: ${options.permission}`),
    };
  }

  return { authorized: true, principal };
}

/**
 * Guard helper for route handlers: throws an AuthError-like signal by returning
 * the 403 response when unauthorized. Pattern:
 *
 *   const guard = await requirePermission(env.DB, request, "leads.read");
 *   if (guard.response) return guard.response;
 *   const { principal } = guard;
 */
export async function requirePermission(
  db: D1Database,
  request: Request,
  permission: string,
  resource?: ResourceTarget,
  requestId?: string | null,
): Promise<AuthorizeResult> {
  return authorize(db, request, { permission, resource, requestId });
}

/**
 * High-level pipeline composer used by interfaces that want the entire
 * Identity → Principal → Authorization → Audit flow in one call, returning a
 * uniformly-shaped result. This is the single security entry point every
 * future interface should use — no interface re-implements auth.
 */
export async function composeSecurityPipeline(
  db: D1Database,
  request: Request,
  permission: string,
  resource?: ResourceTarget,
  requestId?: string | null,
): Promise<AuthorizeResult> {
  return authorize(db, request, { permission, resource, requestId });
}
