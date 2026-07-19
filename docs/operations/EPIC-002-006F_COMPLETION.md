# EPIC-002-006F — Admin Platform Evolution: Operating Platform Foundation

**Status:** ✅ Complete (contract + runtime boundary; UI shell scaffolded)
**Date:** 2026-07-19
**Parent epic lineage:** EPIC-002-006A → 006B → 006C → 006D → 006E → **006F**
**Author:** Hermes (Night Execution Mode — Large Batch)

---

## 1. Objective

Move Hermes from a *governed internal platform foundation* (EPIC-002-006E) into
a *usable operating platform*: an Admin Console with a secure internal access
layer (BFF), an AI Workforce dashboard surface, and AI-workforce integration
foundations (tool ecosystem prep + agent sandbox model) — all while preserving
the standing safety invariants (no public endpoints, agents disabled by
default, human-gated activation, provider independence, AGS Fertility isolated).

## 2. What Was Built

### Phase 1 — Admin Console foundation
- `hermes/admin/console/app.ts` — SPA shell skeleton (application boundary).
- `hermes/admin/console/viewmodels.ts` — typed view-models
  (`ConsoleBootstrap`, `DomainView`, `AgentCardView`, `WorkforceSummaryView`).
- `hermes/admin/console/permissions.ts` — permission-aware render helper.
- `hermes/admin/ui-contracts.ts` — canonical 6-domain IA
  (`DASHBOARD_IA`, `CONSOLE_BOUNDARY`, `CONSOLE_AUTH`).

### Phase 2 — Secure access layer (BFF)
- `hermes/admin/bff.ts` — `bffBootstrap` / `bffDomain`: the single internal
  authenticated boundary. **Receives a verified human Principal; never mints
  one.** Fail-closed via `assertHumanPrincipal` + `requireDomainRead`. Every
  read is audited. Never imports `hermes/services/*`.
- `hermes/admin/governance.ts` — read-only aggregation of ADRs, policies, and
  pending human approvals.
- `requireDomainRead` / `DOMAIN_READ_PERMISSION` aligned to the 6-domain model.

### Phase 3 — AI Workforce dashboard
- `hermes/admin/workforce-view.ts` — `getWorkforceSummary` / `getAgentCard`
  projecting the roster into dashboard views. Asserts disabled-by-default and
  non-autonomous invariants on every read. Memory scope surfaced.

### Phase 4 — AI Tool ecosystem prep
- `hermes/services/tools/tool-capabilities.ts` — `ToolCapability` model
  (id + description + `requiresApproval`); provider-neutral.
- `dev-tools.ts` / `security-tools.ts` — `declaredCapabilities()` with
  vendor-neutral ids. Backends remain swappable via `ToolProvider`.

### Phase 5a — Agent sandbox model (hardening)
- `tool-contracts.ts` extended: `beginEphemeralRun` / `sealEphemeralRun`
  (scratch state discarded; isolated root; ephemeral/read-only only),
  `requestApproval` (emits `agent.request.approval`, stays `pending` — no
  autonomous path), real `application` scoping in `guardToolCall` (removed the
  dead `inScope` check), namespace separation enforced.

### Phase 5b — Validation
- `npx tsc --noEmit` — **0 errors**.
- `workers` vitest — **217/217 passing** (12 new tests).
- Secret scan — clean.
- Import boundary — console layer does not import `hermes/services/*`,
  `hermes/agents/*`, or `hermes/workforce/*` internals.

### Phase 5c — Documentation
- `docs/adr/ADR-013-admin-bff-workforce-foundations.md`
- This completion report.
- Roadmap epic table + status updated (see §4).

## 3. Defects Fixed
- `ui-contracts.ts` — removed a stray `***` typo that broke the `DOMAIN_READ_PERMISSION` map.
- `visibility.ts` — `WorkforceEvent` → `AuditEvent` type mismatch (audit integration).
- `access.ts` / `index.ts` — stale `resources` / `platform-health` domain
  references corrected to `infrastructure` (the 6-domain IA).
- `tool-contracts.ts` — removed dead `inScope` application-scoping check that
  always evaluated truthy.

## 4. Roadmap Status Update
| Epic | Scope | Status | Notes |
|------|-------|--------|-------|
| EPIC-002-006E | Admin Platform Foundation (contract-only) | ✅ Complete | 205/205 tests |
| **EPIC-002-006F** | **Admin Operating Platform (BFF + Workforce + Sandbox)** | **✅ Complete** | **217/217 tests; BFF boundary, 6-domain IA, sandbox model** |

## 5. Safety Guardrails Preserved
- ✅ No public HTTP endpoint added. All admin access is internal/facade-only.
- ✅ Agents remain `disabled` + `non-autonomous`. Human approval gate enforced.
- ✅ Provider-independent tool adapters (no vendor wired).
- ✅ AGS Fertility isolated and untouched (no shared code path changed).
- ✅ No secrets, migrations, D1, Cloudflare, or deploy changes.

## 6. Reversibility
All changes are additive or contract corrections. Rollback = `git revert` of
the EPIC-002-006F commits. No production behavior altered.

## 7. Deferred (explicitly out of scope)
- Console SPA component rendering (shell only — `app.ts` is a skeleton).
- Concrete vendor tool backends (dev/security adapters stay interface-only).
- Runtime wiring of `bffBootstrap`/`bffDomain` into an authenticated handler
  (upstream identity provider not yet integrated).
