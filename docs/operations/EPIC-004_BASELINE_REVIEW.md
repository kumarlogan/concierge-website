# EPIC-004 BASELINE REVIEW

**Document type:** Pre-change baseline (Phase 0 of EPIC-004 Persistent Operations Platform)
**Date:** 2026-07-20
**Branch:** main
**Rule:** Read-only inspection. No unrelated files modified.

---

## 1. Working Tree State

```
 M hermes/admin/console/bff-client.ts        (UNRELATED — not part of EPIC-004)
 M hermes/admin/console/session.ts           (UNRELATED — not part of EPIC-004)
 M hermes/services/execution/index.ts        (UNRELATED — not part of EPIC-004)
 M hermes/services/index.ts                  (UNRELATED — not part of EPIC-004)
 M workers/tests/globalSetup.ts              (UNRELATED — not part of EPIC-004)
?? docs/architecture/EPIC-004_PROPOSAL.md    (prior cycle deliverable, uncommitted)
?? docs/operations/HERMES_V1_FOUNDATION_REVIEW.md   (prior cycle deliverable, uncommitted)
?? docs/operations/TECHNICAL_DEBT_INVENTORY.md      (prior cycle deliverable, uncommitted)
```

- The 5 modified files are **pre-existing, unrelated** to EPIC-003-006 and EPIC-004.
  They are deliberately **excluded** from all EPIC-004 commits (no absorption).
- The 3 untracked docs are deliverables from the prior (PHASE 2-4) cycle. They are
  NOT part of EPIC-004 source and will remain uncommitted unless separately approved.
- EPIC-004 implementation files will be NEW files under `hermes/persistence/`,
  `hermes/audit/`, `hermes/agents/`, `hermes/services/execution/`, plus NEW test files.

## 2. EPIC-003 Foundation Commits — Intact

All six milestone commits are present and unmodified:

```
da6228e  M1: fix Hermes platform type errors; quarantine legacy api-server
9b0fd56  M2: harden agent lifecycle contract
960282f  M3: add audit persistence boundary (AuditEvent + AuditStore + Memory impl)
763aad3  M4: declare tenant/org boundary on Principal + withinTenantScope guard
74fab97  M5: add provider loader seam (Manifest -> Loader -> CapabilityRegistry)
2c5aca1  M7: docs — validation/completion reports + ROADMAP update
```

## 3. Current Persistence Gaps

| Area | Current state | Gap |
|---|---|---|
| Audit | `MemoryAuditStore` (in-memory Map) | Lost on restart; no tenant/principal/workflow query dims; `category`/`decision` unused at emission |
| Agent registry | `REGISTRY` Map in `agents/registry.ts` | Lost on restart; no tenant scoping on access |
| Execution queue | `ENTRIES` Map in `execution/execution-queue.ts` | Lost on restart; no tenant binding |
| Capability registry | `MemoryCapabilityRegistry` | Lost on restart; no bootstrap |
| Tenant boundary | `withinTenantScope()` declared in `admin/access.ts` | **Not called** by any store/mutator |
| Authorizer | type stub only | No implementation; checks use raw `permissions.includes` |

## 4. Existing Interfaces (reuse, do not duplicate)

- `shared/interfaces/audit.ts` — canonical `AuditEvent`, `AuditQuery`, `AuditStore`,
  `AuditProvider`. Already provider-neutral. `AuditStore.append/query/clear` exist.
- `hermes/audit/store.ts` — `MemoryAuditStore implements AuditStore` (default).
- `hermes/audit/event.ts` — `emitAudit()`; never throws; optional `setAuditSink`.
- `shared/contracts/lifecycle.ts` — `AGENT_TRANSITIONS`, `canTransitionAgent`.
- `hermes/agents/registry.ts` — `RegisteredAgent`, `canAgentAct`, `setState`, etc.
- `hermes/admin/access.ts` — `withinTenantScope(principal, target, opts)`.
- `hermes/contracts/platform-api.ts` — `Principal` (has `organizationId?`, `tenantId?`,
  `scopes?`), `Authorizer` type, `PLATFORM_PERMISSIONS`.
- `hermes/services/providers/capability.ts` — `ProviderLoader`, `CapabilityRegistry`.
- `hermes/services/execution/execution-queue.ts` — `QueueEntry`, `QueueStatus` (the
  in-memory workflow lifecycle EPIC-004 PHASE 2 models).

## 5. Migration Risks

1. **Tenant enforcement is additive** — wiring `withinTenantScope` into stores must
   not break existing callers that pass principals without `organizationId`. Mitigation:
   stores accept an explicit `tenantId` on write and a `Principal` on read; unbound
   principals are denied per the existing `requireScope` semantics.
2. **Audit query shape change** — adding `tenant`/`workflow` dims to `AuditQuery`
   extends the existing interface; existing callers unaffected (optional fields).
3. **Agent registry refactor** — replacing direct `REGISTRY` Map access with an
   `AgentStateStore` could ripple into `registry.ts` callers. Mitigation: keep
   `agents/registry.ts` API stable; introduce `AgentStateStore` as the backing
   abstraction the registry *can* delegate to, but EPIC-004 ships the store + tests
   without forcing the registry to switch (low-risk, no caller breakage). The
   durable impl is a seam, not wired into prod yet.
4. **PersistenceProvider seam** — new abstraction; must not couple to D1. Mitigation:
   interface-only + Memory impl now; D1/Postgres/KV are declared seams, not implemented.
5. **Test infra** — 37 pre-existing test-file type errors (vitest masks them). EPIC-004
   adds NEW test files; they must not introduce NEW runtime failures. Source stays clean.

## 6. Affected Modules (EPIC-004 touch surface)

- NEW `hermes/audit/store.durable.ts` — `DurableAuditStore` seam (interface) + adapter bridge.
- NEW `hermes/persistence/workflow-store.ts` — `WorkflowStore` interface + Memory + Durable seam.
- NEW `hermes/persistence/agent-state-store.ts` — `AgentStateStore` interface + Memory + Durable seam.
- NEW `hermes/persistence/provider.ts` — `PersistenceProvider` seam (memory + future-ready).
- NEW `hermes/persistence/tenant.ts` — shared tenant-enforcement helper used by all stores.
- MODIFY `hermes/audit/store.ts` — extend `AuditQuery` usage with new dims (interface already in shared).
- MODIFY `shared/interfaces/audit.ts` — extend `AuditQuery` with `tenant`/`workflow` (optional).
- NEW test files under `workers/tests/` for each store + boundary.

## 7. Conclusion

Baseline is clean and EPIC-003 is intact. The work is purely additive (new
interfaces + Memory implementations + durable seams) and does not modify AGS
Fertility code, deployment config, secrets, or unrelated files. Safe to proceed
with PHASE 1-6.
