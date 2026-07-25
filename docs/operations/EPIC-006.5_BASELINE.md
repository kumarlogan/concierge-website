# EPIC-006.5 — Recovery Baseline

**Date:** 2026-07-21
**EPIC:** Operational Readiness & Production Wiring Preparation
**Foundation:** Hermes Platform Foundation v1.0 — FROZEN (Class B, Approved)
**Status:** Phase 0 complete. No architecture drift detected.

---

## 1. Foundation Status (per HERMES_FOUNDATION_FREEZE.md)

- **Classification:** B — Architecture Frozen. Approved.
- **Single execution boundary:** `HermesExecutionGateway` (Principle 3). All capability
  execution passes through it. No exceptions.
- **Fail-closed:** Principle 4 — Unknown ⇒ Denied.
- **Provider neutrality:** Principle 5 — core may not contain AGS/vendor-specific logic.
- **Mandatory audit:** Principle 6. **Mandatory tenancy:** Principle 7.
- **Frozen components (DO NOT touch this EPIC):** `HermesExecutionGateway`,
  `UniversalCapabilityPlatform`, `ProviderRuntimeGuard`, `TrustLifecycle`,
  `ApprovalService`, Tenant Enforcement, Audit Architecture, Provider SDK contracts.

**Verdict:** Foundation intact, frozen, no redesign required.

---

## 2. AGS Provider Status (per EPIC-006_COMPLETION.md + AGS_PROVIDER_INTEGRATION.md)

| Layer | Status |
|---|---|
| GitHub provider (`vcs.github`, 6 caps) | Registered, governed, fail-closed until backend wired |
| Cloudflare provider (`edge.cloudflare`, 7 caps) | Registered, governed, fail-closed until backend wired |
| Website app layer (`website.*`, 10 caps) | Reconciled superset, routes through gateway |
| Secret-source abstraction | Implemented (`SecretSource`, `EnvSecretSource`) |
| Bootstrap (register/validate/audit) | Implemented (`bootstrapProviders`) |
| Dry-run mode | Implemented (`website.preview`, `dryRun` flag) |
| Prod approval adapter | Implemented (`executeWithProductionApproval`) |

**Drift note:** `AGS_PROVIDER_INTEGRATION.md` still references the older
`connectGitHubBackend` / `CapabilityExecutor` wiring names; the **code** (EPIC-006)
uses typed `backend.ts` + `bootstrap.ts`. Code is source of truth. This EPIC does NOT
fix that doc (out of scope; doc-only edits are permitted but not required for readiness).

---

## 3. Existing Website Capabilities (reconciled)

```
website.status   → edge.cloudflare / ops.health
website.build    → edge.cloudflare / deploy.build
website.deploy   → edge.cloudflare / deploy.pages   (approval: production)
website.preview  → edge.cloudflare / deploy.pages   (dry-run plan)
website.publish  → edge.cloudflare / deploy.pages   (approval: production)
website.rollback → edge.cloudflare / deploy.rollback (approval: production)
website.health   → edge.cloudflare / ops.health
website.logs     → edge.cloudflare / ops.logs
website.analytics→ edge.cloudflare / ops.analytics
website.version  → edge.cloudflare / deploy.history
```

---

## 4. Existing GitHub / Cloudflare Providers

- `vcs.github`: `code.vcs.repo`, `code.vcs.pull-request`*, `code.vcs.branch`*,
  `code.vcs.commit-history`, `code.vcs.tag`*, `code.vcs.rollback`* (*= approval in prod).
- `edge.cloudflare`: `deploy.pages`*, `deploy.worker`*, `deploy.history`,
  `deploy.rollback`*, `ops.health`, `ops.logs`, `ops.analytics` (*= approval in prod).
- Both providers execute ONLY through `HermesExecutionGateway`. No direct path.

---

## 5. Current Approval Path

- `requestApproval(action, env)` (human-gated queue) — `approval-gates.ts`.
- `grantStackBApproval(actor, applicationId, capability, env)` → durable `ApprovalRef`
  (the only thing that unlocks a prod deploy). Verified fail-closed in EPIC-006.
- Policy table in `approval-gates.ts`: `deploy` is **NEVER auto** in any env.

---

## 6. Current Audit Path

- `emitAudit(event, actorId, data)` from `hermes/services/audit/event.js`.
- Every gateway execution, provider activation, and approval grant emits an audit event.
- Audit store is configured at runtime (file/fileProxy) — not modified this EPIC.

---

## 7. Drift Check (STOP condition)

| Check | Result |
|---|---|
| Foundation component modified? | No |
| New execution boundary introduced? | No |
| Vendor logic added to core? | No |
| Fail-closed weakened? | No |

**Conclusion: NO DRIFT. Proceed to Phase 1.**

---

## 8. Design Constraint for EPIC-006.5

This EPIC adds **operational-readiness controls AROUND** the frozen architecture:
- New self-contained module `hermes/services/activation/providers/deployment/` composed
  of existing frozen primitives (`Env`, `SecretSource`, `emitAudit`, `grantStackBApproval`,
  `executeCapability`, `bootstrapProviders`).
- NO edit to any frozen component.
- NO deploy, NO prod secrets, NO commit/stage/branch (HARD RULES).
