// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Audit Middleware                       │
// │ EPIC-002-002: Identity & Authorization Engine                │
// └─────────────────────────────────────────────────────────────┘
//
// Every authorization decision — allow OR deny — is recorded in audit_logs.
// This is the accountability backstop required by RBAC_DESIGN.md §5.3:
// deleting a user never erases their historical actions because actor_id is
// a soft link (user id), not a hard foreign key.
//
// The audit writer is deliberately tolerant: a failure to persist an audit row
// logs server-side but does NOT fail the request (audit loss is less severe
// than a broken authorization pipeline). This matches the platform's
// "log, don't leak" posture — no stack traces reach the client.

import type { D1Database } from "@cloudflare/workers-types";
import type { AuthorizationDecision } from "@hermes/identity/types.js";

/**
 * Persist an authorization decision to audit_logs.
 *
 * The audit_logs schema (migration 0002) expects:
 *   actor_id, action, target_type, target_id, ip_address,
 *   user_agent, decision, metadata (JSON), created_at, updated_at
 *
 * `action` is the permission key for allows and `denied:<key>` for denials,
 * so both are trivially queryable by the `idx_audit_logs_action` index.
 *
 * @returns the generated audit row id (or null if persistence failed).
 */
export async function writeAuditEvent(
  db: D1Database,
  decision: AuthorizationDecision,
): Promise<string | null> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const action =
    decision.result === "allow"
      ? decision.permission
      : `denied:${decision.permission}`;

  const metadata = JSON.stringify({
    provider: decision.context?.provider ?? null,
    providerIdentifier: decision.context?.providerIdentifier ?? null,
    requestId: decision.context?.requestId ?? null,
    reason: decision.reason ?? null,
    roleContext: undefined,
  });

  try {
    await db
      .prepare(
        `INSERT INTO audit_logs
           (id, actor_id, action, target_type, target_id, ip_address,
            user_agent, decision, metadata, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      )
      .bind(
        id,
        decision.actorId,
        action,
        decision.resource?.type ?? null,
        decision.resource?.id ?? null,
        decision.context?.ipAddress ?? null,
        decision.context?.userAgent ?? null,
        decision.result,
        metadata,
        now,
        now,
      )
      .run();
    return id;
  } catch (err) {
    // Audit failure must NEVER break the request path. Log and continue.
    console.error(
      "audit_logs write failed:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
