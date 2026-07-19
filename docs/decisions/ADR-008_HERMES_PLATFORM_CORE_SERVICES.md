# ADR-008 — Hermes Platform Core Services

- **Status:** ✅ Implemented (EPIC-002-006C, 2026-07-19) — 158/158 tests, AGS Fertility isolated & protected
- **Date:** 2026-07-19
- **Deciders:** Chief Architect (AGS), Human Product Owner (approval required)
- **Supersedes:** — (extends ADR-007)
- **Related:** ADR-001..007, EPIC-002-006B (extraction complete), EPIC-002-006C (this planning)

## Context

EPIC-002-006B completed the **extraction** of Identity, Permissions, Audit, and
the Agent Registry into `hermes/`, plus ten provider contracts in
`shared/interfaces/`. Hermes is now a set of **libraries** but has no
**operating services** — there is no Registry/Discovery/Lifecycle/Scheduler/
Notification/Memory/Adapter layer to make it an operational platform.

ADR-007 §Decision (Phases 3–6) anticipates exactly this: "stand up Hermes as
its own deployable unit," "Register + activate the Ops Bot as the first Hermes
agent via the new Registry runtime," and "app consumes `@hermes/*` only."
006C designs that services layer. The ratified target architecture
(docs/organization/*, ADR-004) requires a multi-application organization where
Hermes owns cross-cutting platform services consumed by independent apps.

We must design the services layer **without breaking AGS Fertility**, without
migrations/deployments/secrets in the planning phase, and while keeping every
AI agent inactive-by-default.

## Decision

Adopt a **seven-service Hermes Core Services layer** operating over the
already-extracted capabilities and the `shared/interfaces` contracts:

1. **Registry Service** — authoritative resource inventory (org, apps, envs, infra, agents, ownership).
2. **Discovery Service** — runtime resolution of "what/where" for apps + agents.
3. **Lifecycle Service** — state transitions for resources + agents; enforces inactive-by-default.
4. **Scheduler Service** — cron/event trigger dispatch (→ Cloudflare Cron + Queue).
5. **Notification Service** — fan-out via `NotificationProvider` (Telegram/email/webhook).
6. **Memory Service** — durable, agent-scoped memory (episodic + semantic).
7. **Provider Adapter Service** — the ONLY module binding `shared/interfaces` to Cloudflare; vendor code isolated here.

**Placement:**
```
organization/   applications/   shared/{interfaces,contracts}/
hermes/services/{registry,discovery,lifecycle,scheduler,notification,memory,provider-adapter}/
agents/
```

**Operating model:** services are **in-process libraries** first (ADR-007 P3 —
no new network failure domain), consuming extracted caps via `@hermes/*`.
Promotion to a deployable Hermes Worker is a later, gated phase (ADR-007 P4).

**Security:** zero-trust between services, least-privilege agent capabilities,
audit-everything (immutable log via extracted `AuditProvider`), and
inactive-by-default agents (006B `registerAgent` forces `disabled`; activation
is an explicit human-authorized out-of-band action).

## Rationale

- The extracted capabilities are already provider-abstracted and data-driven —
  they are the natural substrate for services; no redesign needed.
- In-process services avoid introducing distributed-systems failure modes
  before the boundary is proven (ADR-007 rationale).
- Isolating all vendor SDK usage in the Provider Adapter Service keeps the rest
  of Hermes cloud-provider-independent (ADR-007 cloud-mobility goal).
- The Agent Registry (006B) already implements inactive-by-default + explicit
  activation, so the AI-workforce readiness requirement is mostly declarative.
- Layered placement (`organization/`, `applications/`, `hermes/`, `agents/`)
  enforces the ADR-004 three-layer model and prevents app↔platform coupling.

## Alternatives Rejected

| Alternative | Why rejected |
|---|---|
| **Build services as a separate microservice now** | Contradicts ADR-007 P3 (in-process first); adds network failure domain before boundary proven. |
| **Skip services, call extracted caps directly forever** | Blocks multi-app reuse, agent orchestration, lifecycle governance; contradicts ratified target architecture. |
| **Put vendor SDKs in each service** | Violates cloud-mobility goal; makes provider swap require touching N services. Adapter Service centralizes it. |
| **Auto-activate agents on registration** | Violates AI Operating Model §3 authority boundary + user's explicit constraint; 006B already enforces disabled. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Service indirection/latency | Med | In-process; promote to Worker only after proven |
| Registry drift vs Cloudflare | Med | Dual-write + parity check; reconcile job |
| Agent activation abuse | Low–Med | Human-in-loop; audit every activation; disabled default |
| Layering violations | Med | CI lint enforcing import rules (added in P1) |

## Consequences

- **Positive:** Hermes becomes operational (not just extracted); multi-app
  onboarding = consume `@hermes/*` + register in Registry; AI workforce gains
  Lifecycle + Memory + Scheduler; cloud migration = adapter authoring only.
- **Negative / cost:** temporary duplication (services wrap extracted caps);
  additional CI lint; org owns Hermes services governance.
- **Must hold:** AGS Fertility customer behavior byte-identical; all agents
  inactive until explicitly activated by a human; no secrets exposed to services
  (only bound providers via Adapter Service).

## Validation Gates (pre-implementation, inherited from ADR-007)

- `pnpm -r test` green (≥141 passing) throughout.
- Golden-request replay identical vs `baseline-002-006` at each flag-gated cutover.
- Registry parity check before any read-cutover (P2).
- Agent activation only via human-authorized flow; audit row present.

---

## Implementation Note (added 2026-07-19, EPIC-002-006C)

Implemented exactly as proposed, in-process, provider-neutral. One deliberate
enhancement over the original proposal:

- **Provider-neutral audit emitter** (`hermes/audit/event.ts`) was added instead of
  wiring the extracted `writeAuditEvent` (which requires a `D1Database` instance)
  directly into the services. This keeps `hermes/services/*` free of any Cloudflare
  dependency and aligns with the ADR-007 cloud-mobility goal. The emitter writes to an
  in-memory ring buffer at runtime and is the single audit sink for all service actions;
  wiring it to the durable `AuditProvider` (D1/OCI) is a later, gated step.

Test evidence: 158/158 passing (141 baseline + 17 net-new); `tsc` clean on new code;
0 secrets; AGS Fertility behavior unchanged (no worker routes modified). Full report:
`docs/operations/EPIC-002-006C_VALIDATION_REPORT.md`.

*Implemented ADR — status promoted from Proposed to Implemented via EPIC-002-006C.*
