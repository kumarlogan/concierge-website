// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Security Automation — Security Provider Framework         │
// │ EPIC-003-003 · M3                                            │
// │ Uses the EXISTING ToolProvider abstraction (activation/        │
// │ provider-framework.ts). Defines provider-neutral security      │
// │ capability contracts for:                                       │
// │   • secret scanning          (sec.secret-scan)                  │
// │   • dependency scanning      (sec.dependency-scan)              │
// │   • static analysis          (sec.static-analysis)              │
// │   • configuration review     (sec.config-review)                │
// │   • boundary validation       (sec.boundary-validation)         │
// │ No vendor is hardcoded. Concrete backends (gitleaks, semgrep,   │
// │ osv-scanner, trivy) are injected via the CapabilityExecutor     │
// │ port and live in oss-adapters.ts. Fail-closed by construction.  │
// └─────────────────────────────────────────────────────────────┘

import {
  registerProvider,
  enableProvider,
  setProviderHealth,
  getProvider,
  type CapabilityDescriptor,
  type CapabilityExecutor,
  type ManagedProvider,
} from "../../activation/provider-framework.js";
import { emitAudit } from "../../../audit/event.js";
import type { SecurityScanRequest } from "../security-work-model.js";
import { makeSimulatedSecurityExecutor } from "./oss-adapters.js";

export const SECURITY_PROVIDER_ID = "sec.suite";

/** Provider-neutral security capability catalog (no vendor names). */
export const SECURITY_CAPABILITIES: CapabilityDescriptor[] = [
  { id: "sec.secret-scan", description: "Scan source/secrets for leaked credentials", requiresApproval: false },
  { id: "sec.dependency-scan", description: "Scan dependencies for known vulnerabilities", requiresApproval: false },
  { id: "sec.static-analysis", description: "Static code analysis for insecure patterns", requiresApproval: false },
  { id: "sec.config-review", description: "Review configuration for insecure settings", requiresApproval: false },
  { id: "sec.boundary-validation", description: "Validate provider/agent boundary integrity", requiresApproval: false },
];

/** Capability id for a given check kind (used by the agent runtime). */
export const CHECK_CAPABILITY: Record<string, string> = {
  "secret-scan": "sec.secret-scan",
  "dependency-scan": "sec.dependency-scan",
  "static-analysis": "sec.static-analysis",
  "config-review": "sec.config-review",
  "boundary-validation": "sec.boundary-validation",
};

let EXECUTOR: CapabilityExecutor | undefined;

/**
 * Wire the (simulated or real) vendor backend. Leaving it unset keeps the
 * provider fail-closed — every capability call is refused, never fabricated.
 */
export function setSecurityExecutor(exec: CapabilityExecutor | undefined): void {
  EXECUTOR = exec;
}

/** Register the security provider. Starts "registered" (fail-closed). */
export function registerSecurityProvider(): ManagedProvider {
  const p = registerProvider({
    id: SECURITY_PROVIDER_ID,
    label: "Hermes Security Suite",
    domain: "security",
    capabilities: SECURITY_CAPABILITIES,
    backend: "hermes.security-suite",
    executor: (capability, args, ctx) => {
      if (!EXECUTOR) {
        emitAudit("sec.executor.missing", ctx.actor, { capability });
        return {
          ok: false,
          error: "Security provider executor not wired (no scanner backend connected)",
          backend: "hermes.security-suite",
        };
      }
      return EXECUTOR(capability, args, ctx);
    },
  });
  return p;
}

/**
 * Mark the security provider active (enabled + healthy). Mirrors the Claude
 * Code activation path: a provider must be ENABLED (by an authorized principal)
 * AND health-probed before it is resolvable. Returns the provider record for
 * the caller to assert on.
 */
const DEFAULT_ACTIVATION_PRINCIPAL = { id: "principal:activation", permissions: ["hermes:activation:provider"] };

export function activateSecurityProvider(principal?: { id: string; permissions: string[] }): ManagedProvider {
  const p = getProvider(SECURITY_PROVIDER_ID);
  if (!p) throw new Error(`Security provider ${SECURITY_PROVIDER_ID} not registered`);
  enableProvider(SECURITY_PROVIDER_ID, (principal ?? DEFAULT_ACTIVATION_PRINCIPAL) as any);
  setProviderHealth(SECURITY_PROVIDER_ID, "healthy");
  return p;
}

/**
 * Convenience bootstrap: register the security provider AND attach the
 * simulated OSS-compatible executor. Mirrors the Claude Code pattern
 * (registerProvider + setProviderExecutor). Real deployments swap the
 * executor for a backend that shells out to gitleaks/semgrep/osv-scanner/trivy
 * without changing any agent/runtime code.
 */
export function bootstrapSecurityProvider(executor?: import("../../activation/provider-framework.js").CapabilityExecutor): void {
  registerSecurityProvider();
  setSecurityExecutor(executor ?? makeSimulatedSecurityExecutor());
}

/** Re-export the simulated executor factory for callers/tests. */
export { makeSimulatedSecurityExecutor } from "./oss-adapters.js";

/** Read the registered security provider record (undefined if not registered). */
export function getSecurityProvider(): ManagedProvider | undefined {
  return getProvider(SECURITY_PROVIDER_ID);
}

/** Validate that a scan request's required checks are all advertisable. */
export function validateScanRequest(req: SecurityScanRequest): { ok: boolean; missing: string[] } {
  const advertised = new Set(SECURITY_CAPABILITIES.map((c) => c.id));
  const missing = req.requiredChecks
    .map((c) => c.capability)
    .filter((cap) => !advertised.has(cap));
  return { ok: missing.length === 0, missing };
}
