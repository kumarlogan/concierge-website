# EPIC-002-006C — Implementation Roadmap (Core Services)

> **Planning artifact only.** Phases below are SEQUENCED but NOT executed in this EPIC.
> Each phase is independently reversible and gated. No code/migrations/deployments/secrets in planning.

---

## Phase Map (summary)

| Phase | Name | Output | Reversible? | Gate |
|-------|------|--------|-------------|------|
| C-P0 | Contracts & interfaces extension | `shared/contracts/*`, extended `shared/interfaces` | ✅ delete files | tsc clean |
| C-P1 | Service modules (in-process, unused) | `hermes/services/*` (7 svcs) | ✅ unused = no blast radius | unit tests green |
| C-P2 | Registry backfill (dual-write) | D1 tables + dual-write | ✅ flag flip | parity check |
| C-P3 | App adopts services (flag-gated) | `HERMES_PLATFORM_MODE=services` | ✅ flag flip | golden-req replay == baseline |
| C-P4 | Agent activation pathway | human-authorized `activateAgent` flow | ✅ deactivate | audit row present |
| C-P5 | Repo placement (org/app/agents dirs) | `organization/`, `applications/`, `agents/` | ✅ move only | CI lint passes |
| C-P6 | AI workforce onboarding (7 agents) | 7 registered+disabled agents | ✅ disabled default | registry lists 8 |

---

## Detailed Phases

### C-P0 — Contracts & Interfaces Extension
- Add `shared/contracts/` with service-level schemas (ResourceRecord, LifecycleEvent, MemoryRecord).
- Extend `shared/interfaces/` if any of the 10 contracts need service-specific methods (e.g., Scheduler `register` already exists).
- **No runtime change.** Gate: `tsc` clean on `shared/`.

### C-P1 — Service Modules (in-process, unused at runtime)
- Create `hermes/services/{registry,discovery,lifecycle,scheduler,notification,memory,provider-adapter}/`.
- Each service: pure logic over extracted caps + `shared/interfaces`. Provider Adapter Service binds Cloudflare.
- App does NOT call them yet → zero production impact.
- Gate: new unit tests for each service green; 141/141 existing still pass.

### C-P2 — Registry Backfill (dual-write)
- Add D1 tables (`resources`, `lifecycle_events`, `memory`) via migration `00xx_*.sql` (DEFERRED to implementation EPIC).
- Dual-write: resource changes recorded to both existing store and new tables; read from existing.
- Gate: row-count + sample parity check.

### C-P3 — App Adopts Services (flag-gated)
- `HERMES_PLATFORM_MODE`: `legacy` (direct extracted caps) vs `services` (via Hermes services).
- Golden-request replay must match `baseline-002-006` auth responses.
- Gate: replay identical; 141/141 green.

### C-P4 — Agent Activation Pathway
- Build authorized operator flow invoking `activateAgent(id)` (human-in-loop).
- Agent stays disabled until explicitly activated; every activation writes an audit event.
- Gate: audit row present; agent `activation=enabled` only post-human-action.

### C-P5 — Repository Placement
- Create `organization/`, `applications/`, `agents/` top-level dirs; move governance docs + app manifests.
- Add CI lint enforcing: apps import only `@hermes/*`/`@shared/*`; services never import vendor SDKs directly.
- Gate: CI lint green.

### C-P6 — AI Workforce Onboarding (7 agents)
- Register QA, Security, Documentation, Deployment, Research, Finance, Customer Support agents — all `disabled`, `autonomous: false`.
- Each declares capabilities per EPIC-002-006C §7.
- Gate: `listAgents()` returns 8 (1 existing + 7 new), all `activation=disabled`.

---

## Dependency Graph

```
C-P0 ──> C-P1 ──> C-P2 ──> C-P3 ──> C-P4
                     │
                     └──> C-P5 (can run parallel after C-P1)
                     │
                     └──> C-P6 (after C-P1; needs Registry + Lifecycle)
```

C-P5 (repo placement) and C-P6 (agent onboarding) can start after C-P1 since
they only need the service contracts + registry, not the full runtime cutover.

---

## Expected Commits (implementation EPIC, post-approval)

1. `006C P0: shared/contracts + interface extensions`
2. `006C P1: hermes/services scaffolding (7 services, in-process)`
3. `006C P2: registry dual-write + D1 tables`
4. `006C P3: HERMES_PLATFORM_MODE flag + app wiring`
5. `006C P4: human-authorized agent activation flow`
6. `006C P5: organization/applications/agents placement + CI lint`
7. `006C P6: register 7 workforce agents (disabled)`

---

## Stopping Rules (inherit from 006B)

STOP immediately if:
- AGS Fertility behavior changes unexpectedly
- Migrations required before dual-write parity confirmed
- Production configuration/secrets touched
- Tests regress below 141/141
- Any agent activated without human authorization

Report blocker instead of proceeding.

---

## Out of Scope (explicitly deferred)
- Promoting Hermes services to a standalone deployable Worker (ADR-007 P4) — separate EPIC.
- Replacing Cloudflare with another provider (adapter authoring only).
- Any autonomous agent action — all agents remain disabled pending human activation.
