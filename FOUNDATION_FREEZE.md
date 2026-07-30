# FOUNDATION_FREEZE

## Freeze Declaration

**Effective:** 2026-07-30
**Version:** Hermes Foundation v1.0
**Status:** FROZEN — No new capabilities may be added to the Foundation

---

## What Is Frozen

All Foundation-level platform capabilities are frozen as of this date. The following are locked at their current state:

### Frozen Components

| Component | File/Location | Freeze Reason |
|-----------|---------------|---------------|
| Intent Engine | `workers/services/platform/intent/` | Production, certified |
| EPCL | `hermes/services/planning/` | Production, certified |
| WAS | `workers/src/platform/was/` | Production, certified |
| WEF | `workers/src/platform/wef/` | Production, certified |
| Execution Gateway | `hermes/services/execution/gateway/` | Production, certified |
| Capability Registry | `hermes/services/providers/capability.ts` | Production, certified |
| Governance Facade | `hermes/admin/governance.ts` | Production, certified |
| Security Model | `hermes/services/security/` | Production, certified |
| RBAC / Tenant Isolation | `hermes/persistence/` | Production, certified |
| Audit Framework | `hermes/audit/` | Production, certified |
| D1 Schema (M0001–M0006) | `drizzle/` | Production, certified |
| Platform Constitution | `docs/platform/PLATFORM_CONSTITUTION.md` | Authoritative, unchanged |
| Workforce Dev Cycle | `docs/governance/WORKFORCE_DEVELOPMENT_CYCLE.md` | Authoritative, unchanged |

### Frozen Interfaces

- `hermes/contracts/planning.ts` — EPCL TypeScript contracts
- `hermes/persistence/` — Repository interfaces
- `hermes/services/index.ts` — Service exports

### Frozen Test Baselines

- 614/614 passing tests (40 files) — Hermes core
- Test counts and file locations locked
- No test modifications to silence errors

---

## What Is Not Frozen

The following are governed by the Product Execution Lifecycle and may evolve per product need:

- AG Synergy product features
- Application-level code (`workers/src/`, `hermes-website/`)
- Product-specific Roadmaps and Backlogs
- Deferred capabilities (tracked separately)
- Operator tooling and UX (not platform infrastructure)

---

## Freeze Rules

1. **No new Foundation capabilities.** All new platform features must enter the product execution lifecycle.
2. **No Foundation refactoring.** Interface changes to frozen components require governance approval.
3. **No constitutional modifications.** Platform Constitution changes require a formal governance process (see Operating Model).
4. **Fixes permitted only for production blockers.** Genuine bugs in frozen components may be fixed, but must be reported and documented.
5. **Deferred backlog is the exception path.** New ideas go to the deferred backlog, not into the frozen foundation.

---

## Tag

```
Hermes-Foundation-v1.0
```

This Git tag marks the frozen state of the Foundation at v1.0.0.

---

## Governed By

- Platform Constitution (definitive)
- Operating Model v1 (`OPERATING_MODEL_v1.md`)
- Product Execution Model (`PRODUCT_EXECUTION_MODEL.md`)
- Deferred Backlog Process (`docs/platform/deferred-backlog.md`)