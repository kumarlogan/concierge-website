// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Admin Console — Verified Principal & Session            │
// │ EPIC-002-006G · PHASE 2                                        │
// │ The console's trust boundary. A VerifiedPrincipal is a branded  │
// │ wrapper proving that identity + human-kind were established     │
// │ UPSTREAM (the Hermes Identity provider). The console NEVER      │
// │ mints a principal from raw request data — it only accepts a     │
// │ value that has passed verifyPrincipal(). This is defense-in-     │
// │ depth against an agent/service-account ever reaching the BFF.    │
// │                                                 BOUNDARY:      │
// │  • No network, no secrets, no platform service imports.         │
// │  • verifyPrincipal() is the ONLY constructor; it rejects        │
// │    anything that isn't an explicit human principal.             │
// └─────────────────────────────────────────────────────────────┘

import type { Principal } from "../../contracts/platform-api.js";
import type { AdminRole } from "../access.js";

/**
 * Branded type. The brand is a compile-time + runtime signal that this
 * principal has cleared the human/identity gate. Only `verifyPrincipal`
 * returns one. The BFF accepts ONLY this type.
 */
export interface VerifiedPrincipal extends Principal {
  readonly __verified: "human-identity-checked";
}

const HUMAN_PREFIXES = ["principal:", "human:", "user:"];

/**
 * Verify and brand a principal. This is the single trust entry point.
 *
 * Rules (fail-closed):
 *  - Rejects any id that looks like an agent/service-account
 *    (prefixes `agent:`, `principal:agent`, `svc:`, `service:`).
 *  - Requires a non-empty id and an explicit id prefix in HUMAN_PREFIXES.
 *  - Does NOT invent permissions — it uses exactly what the upstream
 *    identity provider supplied.
 *
 * Returns null (never throws) so callers can fail-closed without leaking
 * which check failed (avoid enumeration). Audit of the rejection is the
 * caller's responsibility if desired.
 */
export function verifyPrincipal(input: unknown): VerifiedPrincipal | null {
  if (!input || typeof input !== "object") return null;
  const p = input as Partial<Principal>;
  if (typeof p.id !== "string" || p.id.length === 0) return null;
  if (typeof p.permissions !== "object" || !Array.isArray(p.permissions)) return null;

  const id = p.id;
  // Agent / service-account ids are forbidden at the console boundary.
  if (
    id.startsWith("agent:") ||
    id.startsWith("principal:agent") ||
    id.startsWith("svc:") ||
    id.startsWith("service:")
  ) {
    return null;
  }
  // Must be explicitly a human principal from the identity provider.
  const isHuman = HUMAN_PREFIXES.some((pre) => id.startsWith(pre));
  if (!isHuman) return null;

  return {
    id,
    permissions: [...p.permissions],
    __verified: "human-identity-checked",
  };
}

/**
 * Console session: binds a verified principal to a BFF client for the
 * lifetime of one authenticated console connection. It is the runtime
 * object the SPA/server passes around — never the raw Principal.
 */
export class ConsoleSession {
  private constructor(
    public readonly principal: VerifiedPrincipal,
    public readonly establishedAt: string,
  ) {}

  /** Establish a session from an already-validated upstream principal. */
  static establish(principal: Principal): ConsoleSession {
    const verified = verifyPrincipal(principal);
    if (!verified) {
      throw new Error("ConsoleSession.establish: principal failed human-identity verification");
    }
    return new ConsoleSession(verified, new Date().toISOString());
  }

  /** The human id, for display/audit. */
  get id(): string {
    return this.principal.id;
  }

  /** Audit-safe descriptor (no permission leakage to logs by default). */
  describe(): { id: string; role: string; permissionCount: number } {
    return {
      id: this.principal.id,
      role: deriveRoleHint(this.principal.permissions),
      permissionCount: this.principal.permissions.length,
    };
  }
}

/** Lightweight role hint for display (authoritative role lives in access.ts). */
export function deriveRoleHint(permissions: string[]): AdminRole {
  if (permissions.includes("hermes:admin:role-grant")) return "owner";
  if (permissions.includes("hermes:admin:workforce-write") || permissions.includes("hermes:admin:resource-write"))
    return "platform-admin";
  if (permissions.includes("hermes:admin:task-write")) return "operator";
  if (permissions.includes("hermes:admin:audit-read")) return "auditor";
  if (permissions.includes("hermes:admin:read")) return "viewer";
  return "viewer";
}

// NOTE: This module imports only the Principal contract type. It holds the
// console's trust boundary and must remain free of platform service deps.
