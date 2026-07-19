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
| `security` | `hermes:admin:read` | `adminViewAuthzDenials`, `adminViewAuditTrail` |
| `governance` | `hermes:admin:read` | ADRs, policies, pending approvals |

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
