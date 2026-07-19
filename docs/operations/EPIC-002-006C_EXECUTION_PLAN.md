# EPIC-002-006C — Execution Plan (Night Run)

> **Mission:** Transform Hermes from extracted platform libraries into an operational internal platform foundation.
> **Baseline:** `baseline-002-006` (immutable) @ `ded1c953`
> **Pre-state:** EPIC-002-006B complete — Identity/Permissions/Audit extracted, 10 provider interfaces, AGS Fertility consumes `@hermes/*`, `ags-fertility-ops-agent` registered+disabled.
> **Start commit:** `bb76292`
> **Date:** 2026-07-19

---

## Preflight Results (PHASE 0)

| Check | Result |
|-------|--------|
| `baseline-002-006` tag | ✅ exists |
| Working tree | ✅ clean (3 untracked planning docs only) |
| Full test suite | ✅ 141/141 passing (7 files) |
| Production `tsc` (src/) | ✅ 0 errors |
| Secret scan (`sk-` etc.) | ✅ clean |

**Verdict: baseline SAFE — proceed.**

---

## Implementation Phases

| Phase | Name | Deliverable | Reversible |
|-------|------|-------------|------------|
| 0 | Preflight + plan | this doc + commit planning docs | ✅ |
| 1 | Service foundation | `hermes/services/{registry,discovery,lifecycle,scheduler,notification,memory,providers}/` + `shared/contracts/` | ✅ unused modules |
| 2 | Resource Registry | registry service impl over provider-neutral contracts | ✅ flag-gated (unused at runtime) |
| 3 | Discovery Service | discovery queries registry | ✅ |
| 4 | Lifecycle Service | state machine for resources + agents | ✅ |
| 5 | AI Registry runtime | extend 006B registry → platform agent records; register 8 agents (1 existing + 7 placeholders), all disabled | ✅ |
| 6 | Provider Adapter expansion | `providers/` adapter boundary; contracts for OCI/AWS/Azure/Local (Cloudflare only implemented) | ✅ |
| 7 | Platform APIs/contracts | internal contracts for Registry/Discovery/Lifecycle/Agent mgmt; authz+audit enforced | ✅ |
| 8 | AGS Fertility protection | verify isolation; ownership assertions | ✅ doc/assert only |
| 9 | Validation + docs | PROGRESS.md, VALIDATION_REPORT.md, roadmap update, ADR-008 update if needed | ✅ |

---

## Affected Files (anticipated)

### Created
```
hermes/services/registry/{registry.ts,types.ts,index.ts}
hermes/services/discovery/{discovery.ts,index.ts}
hermes/services/lifecycle/{lifecycle.ts,types.ts,index.ts}
hermes/services/scheduler/{scheduler.ts,index.ts}        (contract-only stub)
hermes/services/notification/{notification.ts,index.ts}  (contract-only stub)
hermes/services/memory/{memory.ts,types.ts,index.ts}     (contract-only stub)
hermes/services/providers/{index.ts,cloudflare.ts}       (adapter boundary)
hermes/contracts/{resource.ts,lifecycle.ts,memory.ts,agent.ts}
shared/contracts/{resource.ts,discovery.ts,lifecycle.ts,agent.ts}
docs/operations/EPIC-002-006C_{PROGRESS,VALIDATION_REPORT}.md
```

### Modified
```
hermes/agents/registry.ts     — extend to platform AgentRecord (backward-compatible)
hermes/agents/seed.ts         — add 7 placeholder agents (all disabled)
docs/operations/AGS_MASTER_ROADMAP.md (append 006C entry)
docs/decisions/ADR-008_*.md   (update if implementation diverges)
```

### NOT touched (per constraints)
- No migrations (D1 schema frozen; registry state is in-memory/contract-only in this run)
- No `wrangler.jsonc` bindings/routes/secrets
- No `workers/src/` business logic
- No Cloudflare production changes
- No agent activation

---

## Dependencies

- 006B extracted caps (`hermes/identity`, `permissions`, `audit`, `agents`)
- `shared/interfaces/*` (10 provider contracts)
- ADR-007 (extraction strategy), ADR-008 (core services proposal)
- ADR-004 (three-layer org architecture)

---

## Rollback Strategy

- Every phase = one git commit. Rollback = `git revert <sha>` or `git reset --hard <prev>`.
- Services are **in-process, unused at runtime** until explicitly wired (Phase 7 wiring is flag-gated and not activated in this run). App behavior unchanged → zero blast radius.
- Registry/Discovery/Lifecycle operate on in-memory + contract types; no DB writes → no migration to roll back.
- Agent registry extension is additive (new optional fields); 006B `RegisteredAgent` shape preserved for backward compat.

---

## Validation Gates (run after EVERY phase)

1. `npx vitest run` → must stay **141/141** (no regression).
2. `npx tsc --noEmit` on `hermes/`+`shared/` → 0 new errors.
3. Secret scan (`grep -rIn "sk-"` on new dirs) → clean.
4. **No autonomous agent activation** — assert all 8 agents `activation=disabled`.

**STOP** if any gate fails or architecture must deviate from ADR-007/008.

---

## Stop Conditions (per mission)

- Migrations become unavoidable without approval → STOP
- Production infrastructure must change → STOP
- Secrets required → STOP
- AGS Fertility behavior changes → STOP
- Tests regress → STOP
- Architecture violates ADR principles → STOP
