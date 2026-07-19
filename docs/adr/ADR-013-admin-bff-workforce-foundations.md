# ADR-013 — Admin Console BFF (Secure Access Layer) & AI Workforce Integration Foundations

**Status:** Accepted
**Date:** 2026-07-19
**Epic:** EPIC-002-006F (Admin Platform Evolution → usable operating platform)
**Author:** Hermes (Night Execution Mode)

## Context

EPIC-002-006E delivered the Admin Platform as contract-only scaffolding: pure
`adminView*` functions, a permission model, and provider-abstracted tool
adapters — but no runtime boundary, no console UI, and no AI-workforce
dashboard surface. The platform was "governed" but not yet "operable."

This ADR records the decisions that turn that foundation into a usable internal
operating platform while preserving the standing safety invariants:

- No public HTTP endpoints without security controls.
- Agents disabled by default; human-gated activation (no autonomous path).
- Provider abstraction to avoid vendor lock-in.
- AGS Fertility remains isolated and untouched.

## Decision

### 1. Single internal authenticated BFF boundary
All console reads flow through **one** module: `hermes/admin/bff.ts`
(`bffBootstrap`, `bffDomain`). It is the only module the (future) SPA imports.

- **Receives a verified human `Principal` — never constructs one.** The
  upstream authenticated handler is responsible for identity; the BFF only
  validates (`assertHumanPrincipal`) and authorizes (`requireDomainRead`).
- **Fail-closed.** An agent principal or a principal missing the required
  domain permission throws before any facade call.
- **Never imports `hermes/services/*`** directly — only the `adminView*`
  facade. This keeps the console boundary decoupled from business services.

### 2. Canonical six-domain information architecture
The dashboard is governed by exactly six domains (replacing the earlier
`resources` / `platform-health` placeholders):

| Domain | Read permission | Source |
|--------|-----------------|--------|
| `organization` | `hermes:admin:read` | `adminViewApplications` |
| `infrastructure` | `hermes:admin:read` | `adminViewResources`, `adminViewServiceStatus`, `adminViewPlatformHealth` |
| `workforce` | `hermes:admin:read` | `adminViewWorkforce`, `adminViewAgent` |
| `operations` | `hermes:admin:read` | `adminViewTasks`, events, status |
| `security` | `hermes:admin:audit-read` | `adminViewAuthzDenials`, `adminViewAuditTrail` |
| `governance` | `hermes:admin:audit-read` | ADRs, policies, pending approvals |

`DOMAIN_READ_PERMISSION` in `access.ts` and `DASHBOARD_IA` in `ui-contracts.ts`
are the single source of truth; both were updated in lockstep.

### 3. AI Workforce dashboard surface
`hermes/admin/workforce-view.ts` projects the agent roster into
`AgentCardView` + `WorkforceSummaryView`, asserting the safety invariants on
every read:

- `activation === "disabled"` for every agent (disabled-by-default).
- `capabilities[].autonomous === false` (no autonomous agents).
- `memoryScope` surfaced (isolated default; shared/global audited).

`viewGovernancePolicies()` advertises the zero-trust policy set including
`policy:agent-disabled-by-default` and `policy:human-approval`.

### 4. Tool ecosystem prep (provider-neutral)
`hermes/services/tools/tool-capabilities.ts` defines a `ToolCapability` model
(capability id + description + `requiresApproval`). The dev-tools and
security-tools adapters now expose `declaredCapabilities()` with
**vendor-neutral** ids (no GitHub/Snyk/Semgrep names). Backends remain swappable
via the `ToolProvider` interface — no concrete vendor is wired in.

### 5. Agent sandbox model (Phase 5a hardening)
`hermes/agents/tool-contracts.ts` is extended, not replaced:

- **Ephemeral execution:** `beginEphemeralRun` / `sealEphemeralRun` — scratch
  state is discarded on seal; the run is isolated to a non-platform root
  (`/tmp/hermes-agent-workspace`). Only `ephemeral`/`read-only` tiers are
  permitted for agent execution.
- **Approval workflow:** `requestApproval` emits `agent.request.approval` and
  returns a `pending` request — there is **no** autonomous approval path. The
  state can only move to `approved`/`rejected` via a human actor.
- **Real application scoping:** `guardToolCall` now enforces
  `grant.applications` (a non-empty list restricts the grant). The previous
  dead `inScope` check (`grant.applications.length === 0 || true`) was removed.
- **Namespace separation:** a `tool:code.*` grant cannot invoke
  `tool:security.*` (verified by test).

## Consequences

- **Positive.** The platform is now operable from a single internal boundary;
  the console UI can be built against `bffBootstrap`/`bffDomain` with zero
  access logic in the frontend. All safety invariants are locked by tests.
- **Negative / deferred.** The console SPA shell (`console/app.ts`) is a
  skeleton — component rendering is not yet implemented. No concrete vendor
  backend is wired (intentional; keeps the platform provider-independent).
- **Reversible.** Every change is additive or a contract correction. No
  endpoint, migration, D1 schema, Cloudflare config, or secret was touched.
  Rollback = `git revert` of the EPIC-002-006F commits. AGS Fertility is
  unchanged and still isolated.

## Validation

- `npx tsc --noEmit` — clean (0 errors).
- `workers` vitest suite — **217/217 passing** (12 new tests across BFF
  fail-closed, workforce invariants, ephemeral-run sealing, approval-pending,
  application scoping, namespace separation).
- Secret scan — clean (no literals in new modules).
- Import boundary — `hermes/admin/console/*` imports no `hermes/services/*`,
  `hermes/agents/*`, or `hermes/workforce/*` internals.

## Alternatives Considered

- **Console imports `adminView*` directly (no BFF):** rejected — no single
  audit/authorization choke point; audit events would be inconsistent.
- **Keep `resources`/`platform-health` domains:** rejected — the task mandates
  the six named domains (Organization, Infrastructure, AI Workforce, Security,
  Operations, Governance); the old names were placeholders.
- **Wire a concrete vendor tool backend now:** rejected — violates provider
  independence; adapters stay interface-only until a backend is chosen.

---

## Addendum — EPIC-002-006G (Admin Console Runtime)

**Date:** 2026-07-19
**Epic:** EPIC-002-006G (Admin Console → real UI + safe runtime)
**Author:** Hermes (Night Execution Mode)

006F delivered the BFF + skeleton SPA. 006G turns that skeleton into a
**real, runnable console** with a verified-human boundary, a non-autonomous
workflow engine, and an MCP-ready tool adapter — without relaxing any 006F
safety invariant.

### A1. Real console renderer (Phase 1)
`hermes/admin/console/render.ts` is the single view-builder. It exports
`renderConsoleFull(boot)` and `renderDomain(boot, domainId)` which produce
Markdown for **all six** dashboard domains from the BFF payload — no direct
`hermes/services/*`, `hermes/agents/*`, or `hermes/workforce/*` imports. The
skeleton `app.ts` `renderDomain` now delegates to `render.ts` instead of
emitting placeholder text, and `renderConsoleFull` is the full-markdown
renderer used by the BFF/SSR path. Fail-closed: unknown domain id or missing
permission returns a `REDACTED` block.

### A2. Verified-principal session (Phase 2)
- `hermes/admin/console/session.ts` introduces a **branded**
  `VerifiedPrincipal` type. It can ONLY be produced by `verifyPrincipal(p)`,
  which returns `null` for any non-human principal (`agent:*`, `svc:*`, no
  `principal:` prefix, or malformed input). The console NEVER mints a
  principal from raw request data.
- `ConsoleSession.establish(p)` throws unless `verifyPrincipal` succeeds —
  there is no silent fallback to a low-privilege identity.
- `hermes/admin/console/bff-client.ts` implements the `BffClient` interface
  from `app.ts`. It takes an already-verified `Principal` and delegates to
  `bffBootstrap`/`bffDomain`. It does NOT trust, construct, or escalate
  principals.

### A3. Controlled (non-autonomous) workflow orchestrator (Phase 3)
`hermes/admin/console/workflow.ts` — `ControlledWorkflow` is a staged state
machine: `drafted → submitted → awaiting-approval → approved → executing →
completed | failed | cancelled`.
- `execute()` **refuses to run** unless state === `approved` (fail-closed:
  a submitted-but-unapproved workflow throws `approval required`).
- `approve(p)` requires `hermes:admin:task-write`; a reader without that
  permission cannot approve (throws `requires hermes:admin:task-write`).
- Steps are supplied as closures by the human; the orchestrator never
  self-approves or self-submits. Every transition is audited. This satisfies
  the standing invariant: **no autonomous execution path exists.**

### A4. Safe, MCP-ready tool adapter (Phase 4)
`hermes/admin/console/tool-adapter.ts` — `ConsoleToolAdapter` wraps any
`ToolProvider` behind two safety gates:
- **Allowlist default-deny:** a tool runs only if its id is in the explicit
  `allowedTools` set; everything else returns `{ ok: false, error: "tool not
  in allowlist" }`.
- **Human approval token:** any capability whose `requiresApprovalIn` list
  includes the current env requires an explicit `approvalToken` on the call.
- **Never throws:** provider errors are returned as `ToolResult`, never
  leaked as exceptions.
- **MCP-ready:** the `ToolCall`/`ToolResult` shape is the existing
  `services/tools` contract that maps 1:1 to MCP `tools/call`. An MCP server
  drops in by implementing `ToolProvider` — zero console changes. (Type-only
  imports from `services/tools` are used; the runtime provider is injected,
  preserving the console boundary.)

### A5. Runtime validation (Phase 5)
- `npx tsc --noEmit` — clean (0 errors).
- `workers` vitest — **239/239 passing** (22 new tests: session
  human-only verification, workflow non-autonomous guarantees, tool-adapter
  default-deny + human-token gate, renderer fail-closed boundary).
- Secret scan — clean.
- Import boundary — `hermes/admin/console/*` runtime code imports no
  `hermes/services/*`, `hermes/agents/*`, or `hermes/workforce/*` internals
  (only types, for the tool adapter).

### A6. Defect corrections during 006G
- `ui-contracts.ts` — reverted a stray cosmetic edit to the `CONSOLE_AUTH`
  `authorization` field (the `***` typo was already fixed in 006F; the edit
  risked reintroducing it).
- `render.ts` `renderDomain` — fixed `domain.id` access on a string-typed
  domain id (was reading `.id` on a `DashboardDomainId` union).
- `permissions.ts` — `governance` now requires `hermes:admin:audit-read`
  (aligned with the BFF's actual gate; previously mismatched at `read`).
- `bff.ts` — workforce domain now returns `adminWorkforceDashboard(principal)`
  (`AgentCardView[]`) instead of the raw roster, so the renderer receives the
  contracted view-model.

### A7. Reversibility
All 006G changes are additive (new `console/*.ts` modules + tests) or
contract corrections. No endpoint, migration, D1 schema, Cloudflare config,
or secret was touched. Rollback = `git revert` of the 006G commits. AGS
Fertility unchanged and still isolated.
