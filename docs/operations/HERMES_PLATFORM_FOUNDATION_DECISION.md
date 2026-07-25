# Hermes Platform — Foundation v1 Decision (Architecture Freeze)

**Companion to:** `docs/architecture/HERMES_PLATFORM_ARCHITECTURE_FREEZE_REVIEW.md`
**Mode:** READ-ONLY Architecture Freeze Review · No implementation · Awaiting approval
**Target:** EPIC-005.8 (Foundation v1) readiness gate

---

## Decision

> **FREEZE THE FOUNDATION (Classification B).**
> Proceed to EPIC-005.8 implementation **on the current module boundaries, interfaces, and layering** — they are stable.
> **Do NOT declare v1 GA** until the EPIC-005.7 trust-enforcement gaps are closed.

---

## Overall Architecture Score: **79 / 100**

| Band | Meaning | This Review |
|---|---|---|
| A | Freeze immediately | — |
| **B** | **Freeze after minor adjustments** | ✅ **THIS** |
| C | Major redesign required | — |
| D | Unsafe for implementation | — |

---

## Strengths (freeze-positive)

- **Single, governed execution boundary.** `HermesExecutionGateway` is the only capability-execution path; fail-closed ordering (tenant → policy → approval → runtime-guard) is preserved. No hidden bypasses.
- **Provider-neutral persistence seam.** `ExecutionStore` / `WorkflowStore` / `AgentStateStore` all expose a `XPersistenceBackend` interface with D1/Postgres/KV as future impls — zero redesign to scale storage.
- **Centralized, fail-closed tenant enforcement.** One `enforceTenant()` gate shared by every store; no per-store tenant logic; cross-tenant access throws.
- **Read-only marketplace by construction.** `ProviderMarketplace` and `MarketplaceSecurityView` cannot execute or mutate — guaranteed by code shape, not convention.
- **Clean dependency boundaries.** No provider-specific imports in core; no dependency inversion; no circular deps; `audit/emitter.ts` is import-safe.
- **Orchestration/execution separation.** `workforce/orchestration.ts` composes governed primitives; introduces no new execution mechanics; fail-closed approval gates.
- **Stable capability model.** Capabilities represent intent (resolved to providers at runtime), not providers themselves.

---

## Weaknesses (must address)

- **Trust enforcement gaps (HIGH).** Checksum (`return true` stub), signature enforcement (`enforceSignatures:false`), authentication (no-op), and revocation/quarantine hooks (unwired in production). *All designed; all owned by EPIC-005.7.*
- **Capability-id contract drift.** V1 registry doc claims `:` namespacing; V2 manifest forbids `:`. Reconcile before v1.
- **Provider onboarding touches core.** New providers require adding `implKey→factory` entries in core factory wiring — not fully declarative. Needs a registration/discovery mechanism.
- **Audit is best-effort.** Sink/store failures are logged silently; no dead-letter. Acceptable for freeze, required hardening for enterprise GA.

---

## Unresolved Risks (tracked, not blockers for freeze)

| ID | Risk | Severity | Owner | Status |
|---|---|---|---|---|
| G-1 | Checksum verification stubbed (`return true`) | HIGH | EPIC-005.7 | Designed, not enforced |
| G-2 | Signature enforcement disabled by default | HIGH | EPIC-005.7 | Designed, not enforced |
| G-3 | Authentication no-op for all modes | HIGH | EPIC-005.7 | Designed, not enforced |
| G-4 | Revoke/quarantine `setHooks` unwired | MED | EPIC-005.7 | Designed, not enforced |
| R-1 | In-memory persistence loses state across runtimes/restart | HIGH | EPIC-005.8+ | Seam exists; impl pending |
| R-2 | Audit event loss on sink failure (silent) | MED | EPIC-005.8+ | Hardening pending |
| R-3 | Capability-id convention drift (V1 vs V2) | LOW | EPIC-005.8 | Reconcile contract |
| R-4 | Synthetic `root` system principal for Stack A | LOW | Document | By-design; audit-doc needed |
| R-5 | Core factory edit required for new provider | MED | EPIC-005.8 | Discovery mechanism pending |

---

## Freeze Recommendation

**FREEZE.** The architecture's structural foundations — execution boundary, persistence seams, tenant enforcement, marketplace isolation, dependency layering — are sound, consistent, and ready to be locked as the v1 contract.

**Conditions attached to the freeze:**
1. The *frozen contract* = module boundaries + public interfaces + fail-closed defaults as reviewed. EPIC-005.8 may implement against these interfaces without changing them.
2. EPIC-005.7 (trust enforcement) MUST complete before any **v1 GA / production multi-tenant** declaration.
3. EPIC-005.8 may proceed now for foundation implementation (durable backends, contract reconciliation, provider discovery) but must not alter the frozen interfaces.

---

## Implementation Recommendation (EPIC-005.8 sequencing)

1. **Reconcile capability contract** (R-3) — pick one id convention; update V1 doc comment or V2 rule. No interface change, just clarity for the 100-provider future.
2. **Implement durable persistence backend** (R-1) — D1/Postgres behind existing `XPersistenceBackend` interfaces. Zero redesign; unlocks multi-runtime + restart recovery.
3. **Provider registration/discovery** (R-5) — move `implKey→factory` out of core into a declarative registry/config so new providers are drop-in.
4. **Audit sink hardening** (R-2) — startup assertion on durable sink + optional dead-letter.
5. **Parallel-track EPIC-005.7** — close G-1…G-4 (enforcement only; design done).
6. **Document synthetic principal boundary** (R-4) for enterprise auditors.

---

## Sign-off Gate

- [ ] Architecture freeze review accepted (this document)
- [ ] EPIC-005.7 enforcement complete (G-1…G-4) — **required before GA**
- [ ] EPIC-005.8 foundation impl complete (R-1, R-3, R-5)
- [ ] v1 GA declared

**Status: AWAITING YOUR APPROVAL to freeze and proceed to EPIC-005.8.**
*No implementation performed. No commits, no deploys, no source changes.*
