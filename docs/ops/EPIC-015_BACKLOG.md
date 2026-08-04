# EPIC-015 — Technical Debt & Type Safety Baseline

**Status:** Backlog (deferred — document-only, do not implement)
**Owner:** Product Owner
**Discovered:** Wave 8 Engineering Reconciliation (2026-08-03)
**Waves affected:** Wave 3–7 (pre-existing) — **not** Wave 8

---

## Title

**Technical Debt & Type Safety Baseline** — resolve the 218 pre-existing TypeScript
issues across the platform.

## Scope

Resolve the **218 pre-existing TypeScript errors** carried by the Wave 3–7 baseline.
These are **outside** Wave 8 reconciliation scope because they live in other platform
capabilities. Per PO directive: **document only — do NOT implement** in this backlog
item.

## Affected Domains

| Domain | Location (subdirs under `workers/src/`) |
|--------|-----------------------------------------|
| Trust & security | `trust/` |
| Document management | `documents/` |
| Timeline engine | `timeline/` |
| Identity / credentials | `credentials/` |
| EPCL (Epic Clinical Link) | `epcl/` |
| Hermes platform services | `hermes/*` |

> The 218 count is the **post-reconciliation** project `tsc --noEmit` total, verified
> unchanged (net **+0**) by the Wave 8 reconciliation. Full per-file inventory to be
> produced as the first step when this EPIC is scheduled.

## Estimated Effort

- **Triage/inventory:** Low (1–2 sessions) — regen `tsc --noEmit`, bucket by domain,
  classify each error (real bug vs. missing-stdlib/unused/stale signature).
- **Remediation:** **High** — the errors span 6 domains and multiple platform
  capabilities; each domain requires its own owner and care not to alter runtime
  behavior while fixing types.
- **Verification:** Medium — full `tsc --noEmit` to 0 + regression suite re-run.
- **Overall:** **M (Medium–High)** — a cross-cutting, multi-owner effort, not a
  single-batch fix.

## Risk

- **If not addressed:** latent type drift persists; CI has no `tsc` gate so deploy
  still succeeds (esbuild type-stripping), but the risk is silent, unchecked drift and
  increased cost of future changes in these domains.
- **If addressed carelessly:** "fix the types" can mask/prevent runtime refactors or
  introduce regressions in Wave 3–7 features. Must be **behavior-preserving**.
- **Keep as-is today:** low immediate operational risk (all Wave 8 work is already
  type-clean); this is a **hygiene/cost** item, not a functional blocker.

## Dependencies

- Own cross-capability approval (touches `trust/`, `documents/`, `timeline/`,
  `credentials/`, `epcl/`, `hermes/*` — each is a governed platform capability).
- No runtime redesign, roadmap change, or Foundation modification.
- Requires a domain-owner-champion per affected capability.

## Suggested Execution Window

**Next available inter-wave hardening window** — defer at least until Wave 8 feature
delivery reaches a stable PO Review gate. Do **not** run concurrently with active Wave 8
feature work to avoid touching shared source mid-delivery.

## Reason Deferred

The 218 errors are **pre-existing** (Wave 3–7) and span **other platform capabilities**
(`trust/`, `documents/`, `timeline/`, `credentials/`, `epcl/`, `hermes/*`), not the Wave
8 workflow module. Fixing them would modify governed capabilities outside Wave 8 scope,
conflicting with the PO's "commit only the approved reconciliation / do not begin
unrelated initiatives" directive. They carry **no immediate functional or deploy risk**
(no `tsc` CI gate; deploy type-strips), so they are safely parked as a documented,
behavior-preserving technical-debt EPIC for a future hardening window.
