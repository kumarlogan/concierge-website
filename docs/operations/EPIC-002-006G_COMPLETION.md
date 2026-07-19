# EPIC-002-006G — Admin Console Runtime (Real UI + Safe Runtime)

**Status:** ✅ Complete (real 6-domain renderer, verified-human session, non-autonomous workflow, MCP-ready tool adapter)
**Date:** 2026-07-19
**Parent epic lineage:** EPIC-002-006A → 006B → 006C → 006D → 006E → 006F → **006G**
**Author:** Hermes (Night Execution Mode — Large Batch)

---

## 1. Objective

Turn the EPIC-002-006F "skeleton SPA" into a **real, runnable Admin Console**
without relaxing any standing safety invariant:

- No public HTTP endpoints.
- Agents disabled by default; human-gated activation (no autonomous path).
- Verified-human boundary — the console never mints or trusts a principal.
- Provider abstraction (no vendor lock-in; MCP-ready).
- AGS Fertility isolated and untouched.

006F delivered the BFF + skeleton (`app.ts` emitted placeholder text). 006G
implements the actual view layer, the verified-principal boundary, a
controlled workflow engine, and a safe tool adapter.

## 2. What Was Built

### Phase 1 — Real console view renderer (all 6 domains)
- `hermes/admin/console/render.ts` — single view-builder. Exports
  `renderConsoleFull(boot)` (full markdown for all six domains) and
  `renderDomain(boot, domainId)` (single-domain). Both read from the BFF
  payload — **no** `hermes/services/*`, `hermes/agents/*`, `hermes/workforce/*`
  imports. Fail-closed: unknown domain or missing permission → `REDACTED`.
- `hermes/admin/console/app.ts` — the skeleton `renderDomain` now **delegates**
  to `render.ts` instead of returning placeholder text. The `BffClient`
  interface stays the only runtime contact with the platform.

### Phase 2 — Verified-principal session + BFF client
- `hermes/admin/console/session.ts` — branded `VerifiedPrincipal` type. Only
  `verifyPrincipal(p)` can construct it; returns `null` for any non-human
  (`agent:*`, `svc:*`, no `principal:` prefix, malformed). `ConsoleSession.establish(p)`
  throws unless verified — no silent low-privilege fallback.
- `hermes/admin/console/bff-client.ts` — `LocalBffClient` implements `BffClient`;
  takes an already-verified `Principal`, delegates to `bffBootstrap`/`bffDomain`.
  Does NOT construct, trust, or escalate principals.

### Phase 3 — Controlled (non-autonomous) workflow orchestrator
- `hermes/admin/console/workflow.ts` — `ControlledWorkflow` state machine:
  `drafted → submitted → awaiting-approval → approved → executing → completed | failed | cancelled`.
  - `execute()` refuses to run unless `approved` (fail-closed).
  - `approve(p)` requires `hermes:admin:task-write` (permission-gated).
  - Steps are human-supplied closures; the orchestrator never self-approves.
  - Every transition is audited; `cancel()` is human-only.

### Phase 4 — Safe, MCP-ready tool adapter
- `hermes/admin/console/tool-adapter.ts` — `ConsoleToolAdapter` wraps any
  `ToolProvider`:
  - **Allowlist default-deny** — only listed tool ids run.
  - **Human approval token** — write/env-gated capabilities require an explicit token.
  - **Never throws** — provider errors returned as `ToolResult`.
  - **MCP-ready** — `ToolCall`/`ToolResult` map 1:1 to MCP `tools/call`; an
    MCP server drops in behind `ToolProvider` with zero console changes.
  - Runtime provider injected; only type imports from `services/tools` (boundary preserved).

### Phase 5 — Runtime hardening + boundary tests
- 4 new test files (22 tests): `console.session.test.ts`,
  `console.workflow.test.ts`, `console.tool-adapter.test.ts`,
  `console.render.boundary.test.ts`.
- Defect corrections (see §3).

### Phase 6 — Documentation
- `docs/adr/ADR-013-admin-bff-workforce-foundations.md` — Addendum (006G)
  recording the runtime decisions + defect corrections; corrected the
  `security`/`governance` read-permission row to `hermes:admin:audit-read`.
- This completion report.

## 3. Defects Fixed
- `ui-contracts.ts` — reverted a stray cosmetic edit to `CONSOLE_AUTH.authorization`
  (risked reintroducing the `***` typo already fixed in 006F).
- `render.ts` `renderDomain` — fixed `domain.id` access on a string-typed
  `DashboardDomainId` (was reading `.id` on a union member).
- `permissions.ts` — `governance` now requires `hermes:admin:audit-read` (was
  mismatched at `read`; now aligned with the BFF gate).
- `bff.ts` — workforce domain returns `adminWorkforceDashboard(principal)`
  (`AgentCardView[]`) instead of the raw roster, so the renderer receives the
  contracted view-model.

## 4. Roadmap Status Update
| Epic | Scope | Status | Notes |
|------|-------|--------|-------|
| EPIC-002-006F | Admin Operating Platform (BFF + Workforce + Sandbox) | ✅ Complete | 217/217 tests |
| **EPIC-002-006G** | **Admin Console Runtime (real UI + safe runtime)** | **✅ Complete** | **239/239 tests; 6-domain renderer, verified-human session, non-autonomous workflow, MCP-ready adapter** |

## 5. Safety Guardrails Preserved
- ✅ No public HTTP endpoint added. All admin access is internal/facade-only.
- ✅ Agents remain `disabled` + `non-autonomous`. Workflow engine has no autonomous path.
- ✅ Verified-human boundary — `verifyPrincipal` rejects agent/service/malformed input.
- ✅ Provider-independent tool adapter (default-deny allowlist; no vendor wired).
- ✅ AGS Fertility isolated and untouched (no shared code path changed).
- ✅ No secrets, migrations, D1, Cloudflare, or deploy changes.

## 6. Reversibility
All changes are additive (new `console/*.ts` modules + tests) or contract
corrections. Rollback = `git revert` of the 006G commits. No production
behavior altered. AGS Fertility unchanged and still isolated.

## 7. Deferred (explicitly out of scope)
- Console SPA component rendering (markdown renderer is the runtime surface; no framework UI yet).
- Concrete vendor tool backends (dev/security adapters stay interface-only).
- Runtime wiring of `bffBootstrap`/`bffDomain` into an authenticated HTTP handler
  (upstream identity provider not yet integrated — the boundary is ready for it).
