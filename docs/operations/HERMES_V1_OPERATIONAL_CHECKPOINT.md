# HERMES PLATFORM v1.0 — Operational Checkpoint

> **Date:** 2026-07-21
> **Status:** Foundation FROZEN (Class B). Operational checkpoint + EPIC-008 Controlled AGS Operations Pilot kickoff.
> **Authority:** This checkpoint records the state of the Hermes Platform at the v1.0 boundary.
> The Foundation architecture is **frozen** — no redesign, no new foundation abstractions,
> `HermesExecutionGateway` and `ProviderRuntimeGuard` unchanged, fail-closed behaviour preserved.

---

## Completed — Production Foundation Capabilities

| Epic | Capability | State |
|---|---|---|
| EPIC-005.4 | Audit + Tenant Enforcement | ✅ Done |
| EPIC-005.5 | Runtime Guard | ✅ Done |
| EPIC-005.6 | Trust Verification | ✅ Done |
| EPIC-005.7A | Authentication Enforcement | ✅ Done |
| EPIC-005.8 | Cryptographic Trust | ✅ Done |
| EPIC-005.9 | Operational Trust Hardening | ✅ Done |
| EPIC-006 | AGS Provider Integration | ✅ Done |
| EPIC-006.5 | Operational Readiness Controls | ✅ Done |
| EPIC-007 | Controlled AGS Staging Launch | ✅ Done (15/15 guarantee suite green) |

---

## Classification

### DONE — Production Foundation Capabilities

The Hermes Foundation is **complete and frozen**:

- **Identity / Authorization / Audit / Trust / Tenant Enforcement** — the single
  execution boundary (`HermesExecutionGateway`) with mandatory audit, mandatory tenancy,
  an explicit approval model, and a durable trust model.
- **AGS Provider Integration (EPIC-006)** — GitHub (`gh`/`git`) and Cloudflare
  (`wrangler`) providers wired through the provider-neutral `Spawner` seam.
- **Operational Readiness Controls (EPIC-006.5)** — `DeploymentIdentity` validation,
  readiness executors (credential-gated, `NOT_INSTALLED` fail-closed), staging workflow.
- **Controlled AGS Staging Launch (EPIC-007)** — the governed launch *function*
  (`runLaunch` / `agsLaunch`): staging routine, production fail-closed gated
  (approval + authority + domain + release tag + change-freeze + live secret + verified
  rollback target), idempotent, tenant-isolated, audit-correlated, rollback-safe.
  **Verified: 15/15 guarantee suite green** (real execution, 2026-07-21).

The platform is at **operational-governance maturity** for AGS deployment: it will
refuse unsafe production actions by design and leaves an immutable audit trail.

---

## Deferred

| # | Deferred item | Tracked as |
|---|---|---|
| D1 | `workflow.ts` latent defect (`recordFromIdentity is not a function`) | Backlog B1 |
| D2 | Toolchain / `@types/node` cleanup (scoped typecheck noise) | Backlog B3 |
| D3 | Multi-region durability | Future epic |
| D4 | Marketplace expansion | Future epic |
| D5 | Advanced autonomous optimization | Out of scope |
| D6 | AI-driven website improvements | Out of scope (EPIC-008 EXCLUDE) |

---

## Why Deferred Items Do Not Block the Current Roadmap

**D1 — `workflow.ts` latent defect.**
The defect lives in `workflow.ts` (`runStagingWorkflow`), a **predecessor (EPIC-006.5)
artifact** that is **not imported by the EPIC-007 launch path** (`index.ts` / `agsLaunch`
→ `runLaunch`). The authoritative EPIC-007 acceptance gate (15/15 guarantee suite) is
fully green and independent of `workflow.ts`. The staging dry-run workflow is superseded
by `runLaunch`'s own `dryRun` branch. Fix is tracked but non-blocking for AGS operation.

**D2 — Toolchain / `@types/node` cleanup.**
The 13 scoped-typecheck errors surface only under `tsconfig.epic007.json`'s
`"types": []` (which excludes `@types/node`), and they appear **exclusively in frozen
Foundation modules** (`audit/store.durable.ts`, `services/providers/trust/*`,
`secret-source.ts`). **EPIC-007's own 9 files have 0 errors.** These are build-config
gaps in pre-existing frozen code, not runtime defects, and do not affect guarantees,
runtime behaviour, or deployment safety.

**D3 — Multi-region durability.**
Current AGS scope is single-region (Cloudflare `agsynergy.ca`). The deployment ledger
already supports a restart-safe `FileDeploymentLedgerBackend` (JSON-lines) and is
backend-swappable; multi-region replication is an availability enhancement, not required
for controlled operation. Deferred to a future availability epic.

**D4 — Marketplace expansion.**
Refers to a provider marketplace beyond the two AGS providers (GitHub, Cloudflare).
No current consumer exists; the provider-neutral `Spawner`/backend seam already supports
adding providers without Foundation change. Not on the AGS operations critical path.

**D5 — Advanced autonomous optimization.**
Explicitly outside EPIC-008 scope (no autonomous business decisions). The platform's
intentional design is *controlled* operation with human approval gates, not autonomous
optimization. Deferred by policy.

**D6 — AI-driven website improvements.**
Explicitly in EPIC-008's EXCLUDE list (no autonomous content publishing, SEO, marketing,
or redesign). AGS website content/design changes remain human-owned. Deferred by scope.

**Conclusion:** None of D1–D6 blocks the EPIC-008 Controlled AGS Operations Pilot.
EPIC-008's job is to verify readiness of the *already-delivered* capabilities and close
only the gaps required to run controlled AGS operation end-to-end.

---

*Checkpoint established 2026-07-21. Next: EPIC-008 Baseline + Readiness Review.*
