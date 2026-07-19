# ADR-012 — Admin Platform Internal-Only Facade (No Direct HTTP Exposure)

**Status:** Accepted
**Date:** 2026-07-19
**Epic:** EPIC-002-006E (Admin Platform Foundation)
**Author:** Hermes (Night Execution Mode)

## Context

The platform needs centralized admin visibility (organization, resources, AI
workforce, operations, security, platform health) and permission-aware access
for human operators. A naive approach would expose these as HTTP routes on the
public worker. That conflicts with the standing security posture:

- No public HTTP endpoints without security controls.
- Agents disabled by default; human-gated activation.
- Provider abstraction to avoid vendor lock-in.

## Decision

1. **Internal-only facade.** All admin read/build/deliver operations live in
   `hermes/admin/*` as pure functions. No `fetch()` handlers, no route table.
   The future console reaches them ONLY through the authenticated BFF in
   `workforce/api.ts` (human principal required), never by importing service
   modules directly.

2. **Permission-aware access model.** Every admin call runs through
   `requireDomainRead` / `requireAdminPermission` / `assertHumanPrincipal`.
   Agent principals and service-account tokens are rejected at the gate.

3. **Provider-abstracted tools.** `hermes/services/tools/*` defines a
   `ToolProvider` interface + swappable backend. Concrete vendor adapters can be
   dropped in later without touching call sites. Five domains scaffolded:
   code (dev), security, docs, research, monitoring.

4. **Agent tool contracts.** `hermes/agents/tool-contracts.ts` enforces:
   namespace-scoped grants, environment-gated approval (dev auto → prod human),
   ephemeral sandbox with no production secrets, isolated memory scope.

5. **AI Workforce expansion** adds 5 agents (developer claude-code, developer
   local, security-tooling, monitoring) — all `disabled` + `non-autonomous`,
   consistent with the safety invariant.

## Consequences

- Positive: clean boundary, auditable, no new attack surface, testable as pure
  functions (205/205 worker tests pass).
- Negative: the console UI is not yet built (Phase 2 is contract-only). The
  BFF must be extended to expose `adminView*` before any UI ships.
- Reversible: all new files are additive; no existing endpoint, migration, or
  Cloudflare config changed. Rollback = `git revert` of the EPIC commit.

## Alternatives Considered

- **Public `/admin` routes:** rejected — violates no-public-endpoint rule.
- **Embed admin in existing ops worker:** rejected — mixes governance with
  business ops; harder to scope permissions.
- **Vendor-specific tool SDKs directly:** rejected — locks platform to one
  provider; abstraction keeps swap cost near zero.
