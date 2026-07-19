import type { Principal } from "./identity.js";

export type PermissionEffect = "allow" | "deny";

export interface PermissionCheck {
  principal: Principal;
  action: string;
  resource?: string;
}

export interface EffectivePermissions {
  permissions: string[];
  roles: string[];
  /** Explicitly revoked permission strings (always deny). */
  revocations: string[];
}

export interface PermissionProvider {
  /** Resolve the effective permission set for a principal. */
  resolveEffective(principal: Principal): Promise<EffectivePermissions>;
  /** Authoritative check — OWNER override + grants + revocations preserved. */
  hasPermission(principal: Principal, action: string, resource?: string): Promise<boolean>;
}
