# EPIC-004 ROADMAP — Persistent Operations Platform

**Status:** PHASES 0–6 COMPLETE (abstractions + durable seams + tenant enforcement + validation). Phases 7–8 = documentation/review + future wiring.

## What Is Done Now (this cycle)
- ✅ Durable `AuditStore` seam (`DurableAuditStore` + `AuditPersistenceBackend`) — provider-neutral, NO D1 hardcode.
- ✅ `WorkflowStore` abstraction — wraps the workflow/queue state model (tenant, owner, state, transitions, approvals, linked audit events). Ready to back the in-memory `ENTRIES` queue later.
- ✅ `AgentStateStore` abstraction — durable agent registry state; preserves `canAgentAct()` as the ONLY execution gate.
- ✅ Tenant enforcement ACTIVATED across audit, workflow, agent stores + `MemoryAuditStore.queryScoped` defense-in-depth.
- ✅ `PersistenceProvider` seam (`memory` ships; `d1`/`postgres`/`kv` declared, not implemented — no vendor lock-in).
- ✅ 40 new tests (all green), full suite 415/415, type-clean sources, secret scan clean.

## Phased Future Work
| Phase | Work | Depends on | Risk |
|---|---|---|---|
| 7 | Architecture review answers + final report (docs) | — | low |
| 8 | Wire `execution-queue` to `WorkflowStore` (swap `ENTRIES` Map reads/writes to the store behind the same boundary) | approval | low |
| 9 | Implement `D1PersistenceProvider` + `D1*Backend` (each implements the `*PersistenceBackend` interface) | D1 access/token | med |
| 10 | Implement `PostgresPersistenceProvider` (optional) | Postgres provisioned | med |
| 11 | `KVPersistenceProvider` for audit-only (eventual) | KV namespace | low |
| 12 | `MemoryCapabilityRegistry` tenant write-enforcement (register/grant scoped) | approval | low |

## Non-Negotiable Principles (carried from spec)
1. **Hermes owns trust-critical state.** External capabilities (LLM, browser, email) are *used*, never *trusted* to store durable truth.
2. **No vendor lock-in.** All persistence is behind provider-neutral interfaces. D1 is a pluggable backend, never referenced in core logic.
3. **Tenant isolation + fail-closed.** Cross-tenant access denied; unbound principal denied; illegal transitions rejected.
4. **`canAgentAct()` is the only execution gate.** Never bypassed by the durable layer.

## How To Extend (no redesign needed)
To add a backend (e.g., D1):
1. Implement `AuditPersistenceBackend` / `WorkflowPersistenceBackend` / `AgentPersistenceBackend` against D1.
2. Add `D1PersistenceProvider implements PersistenceProvider` (kind `"d1"`) injecting those backends.
3. Call `createPersistenceProvider("d1")` — every consumer stays unchanged.
No store interface, transition table, or tenant check needs editing.
