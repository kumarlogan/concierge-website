// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — EPIC-005.7A F-1 Regression Suite             │
// │ AUTHENTICATED ≠ runtime-active (fail-closed)                  │
// └─────────────────────────────────────────────────────────────┘
//
// Proves the ProviderRuntimeGuard treats AUTHENTICATED (proof-of-identity,
// NOT runtime readiness) and all negative/pre-active states as NON-runtime,
// denying execution. ACTIVE/LOADED/RUNNING remain the only runnable states.
// No stubs — real guard over a real (minimal) context.

import { describe, it, expect } from "vitest";
import { ProviderRuntimeGuard } from "../runtime/index.js";
import type { GuardContext } from "../runtime/index.js";
import type { ProviderManifestV2 } from "../manifest-v2.js";
import type { TrustRecord } from "../trust/lifecycle.js";
import type { ProviderRequest } from "../sdk.js";

const MANIFEST: ProviderManifestV2 = {
  id: "demo",
  name: "Demo",
  version: "1.0.0",
  transports: [{ kind: "cli", endpoint: "demo" }],
  capabilities: [{ id: "demo.echo", implKey: "demo:echo" }],
  permissions: [{ capability: "demo.echo", scope: "demo", grantedBy: "operator" }],
  limits: { maxConcurrent: 2, maxDurationMs: 5000 },
  trust: { level: "sandbox", sandboxPolicy: { isolation: "seccomp" } },
} as unknown as ProviderManifestV2;

function ctxWithTrust(state: string): GuardContext {
  const request: ProviderRequest = {
    invocationId: "inv",
    capabilityId: "demo.echo",
    implKey: "demo:echo",
    args: {},
    timeoutMs: 1000,
    context: { principal: { id: "p", organizationId: "t", tenantId: "t" }, targetTenantId: "t" },
  };
  return {
    providerId: "demo",
    manifest: MANIFEST,
    trust: { id: "demo", state: state as TrustRecord["state"], createdAt: 0 } as unknown as TrustRecord,
    transports: {} as never,
    capabilities: {} as never,
    request,
  } as unknown as GuardContext;
}

describe("EPIC-005.7A F-1 — AUTHENTICATED is NOT runtime-active (fail-closed)", () => {
  // Fresh guard per test: guard() is stateful (bumps concurrency), so sharing
  // one across the runnable-state cases would hit maxConc and false-DENY.
  const makeGuard = () => new ProviderRuntimeGuard(() => {});

  it("AUTHENTICATED trust state is DENIED (pre-active identity, not runnable)", () => {
    const d = makeGuard().guard(ctxWithTrust("AUTHENTICATED"));
    expect(d.allow).toBe(false);
    expect(d.violationClass).toBe("trust-state");
    expect(d.code).toBe("RUNTIME_TRUST_STATE");
  });

  it("UNAUTHENTICATED trust state is DENIED", () => {
    const d = makeGuard().guard(ctxWithTrust("UNAUTHENTICATED"));
    expect(d.allow).toBe(false);
    expect(d.violationClass).toBe("trust-state");
    expect(d.code).toBe("RUNTIME_TRUST_STATE");
  });

  for (const neg of ["QUARANTINED", "REJECTED", "REVOKED", "UNLOADED", "VALIDATION_FAILED", "UNKNOWN"] as const) {
    it(`${neg} trust state is DENIED`, () => {
      const d = makeGuard().guard(ctxWithTrust(neg));
      expect(d.allow).toBe(false);
      expect(d.violationClass).toBe("trust-state");
      expect(d.code).toBe("RUNTIME_TRUST_STATE");
    });
  }

  for (const ok of ["ACTIVE", "LOADED", "RUNNING"] as const) {
    it(`${ok} trust state is ALLOWED (runtime-active)`, () => {
      const d = makeGuard().guard(ctxWithTrust(ok));
      expect(d.allow).toBe(true);
    });
  }
});
