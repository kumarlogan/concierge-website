# EPIC-004 ARCHITECTURE REVIEW

Answers to the standing architecture-review questions for the Persistent Operations Platform.

## Q1. Who owns trust-critical state?
**Hermes owns it.** External capabilities (LLM, browser, email, payment) are *consumed*, never *trusted* to be the system of record for durable facts (audit, workflow lifecycle, agent registry). All three are now behind Hermes-owned abstractions:
- `AuditStore` / `DurableAuditStore` — append-only audit truth.
- `WorkflowStore` — canonical workflow/queue lifecycle state.
- `AgentStateStore` — agent registry + activation + lifecycle.

External systems are a *backend* behind a provider-neutral interface, never the interface itself. Swapping the backend cannot change what Hermes records or who may read it.

## Q2. How is vendor lock-in avoided?
**Interfaces first; backends pluggable.** Every durable capability is defined as a TypeScript interface (`*PersistenceBackend`) with a provider-neutral contract. Today only `Memory*Backend` is implemented (dev/edge/tests). D1 / Postgres / KV are **declared seams** (`PersistenceProvider.kind` union + documented stubs) but NOT imported or instantiated anywhere in core logic. To add a backend:
1. Implement the three `*PersistenceBackend` interfaces.
2. Add a `XxxPersistenceProvider implements PersistenceProvider`.
3. Call `createPersistenceProvider("xxx")`.
Zero changes to consumers, transition tables, or tenant checks. D1 is never referenced in source — it is a string in a union.

## Q3. How is tenant isolation guaranteed?
**Single enforcement point + fail-closed.** `hermes/persistence/tenant.ts` exposes `enforceTenant(principal, tenantId)` built on `withinTenantScope`. Every store method that reads or writes a tenant-scoped record calls it. Cross-tenant access throws (`TenantViolationError`); an unbound principal (no `organizationId`) is denied outright. `MemoryAuditStore.queryScoped` adds defense-in-depth by post-filtering results to the principal's org even if a filter is malformed. There is no code path that reads or mutates tenant data without the check.

## Q4. Is `canAgentAct()` still the only execution gate?
**Yes — preserved, not replaced.** `AgentStateStore.canAgentAct(agent)` is byte-for-byte equivalent to the registry's gate: `agent.activation === "enabled" && agent.state === "active"`. The durable layer only *persists* the two axes (activation switch + lifecycle state); it never derives a "may act" decision of its own. Lifecycle transitions are validated against `canTransitionAgent` (shared contract) so an agent cannot reach `active` without `approved`, and cannot be activated without an explicit authorized `setActivation("enabled")` call. The gate is therefore durable AND tamper-evident.

## Q5. What was deliberately NOT changed (scope discipline)?
- `execution-queue.ts` (in-memory `ENTRIES` Map) was NOT refactored. `WorkflowStore` is a parallel durable boundary ready to back it; wiring is ROADMAP phase 8 and requires approval.
- No AGS Fertility artifacts touched.
- No Cloudflare/D1 config or secrets changed or deployed.
- No commits made (rule: commits require user ownership verification).

## Q6. What is the regression posture?
- Full suite: **415/415 passing** (40 new EPIC-004 + 375 pre-existing).
- EPIC-004 sources: **0** TypeScript errors.
- Pre-existing tsc errors live only in unrelated legacy test/integration files (untouched).
- Secret scan: clean. No D1 hardcode. No leaked tokens.
