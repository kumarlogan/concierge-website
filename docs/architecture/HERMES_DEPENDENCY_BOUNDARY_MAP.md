# Hermes Dependency Boundary Map (PHASE 4)

**Purpose:** Prove no dependency-inversion violations in the Hermes platform
core. A platform that controls execution must have a **provable and
reproducible build** — and that starts with a clean, top-down dependency graph.

---

## 1. Canonical Dependency Order (top → bottom)

```
Identity
   │
Agents
   │
Capabilities
   │
Providers
   │
Execution
   │
Persistence
   │
Audit
```

Each layer may depend **only** on layers **below** it (or its own contracts).
A lower layer must NEVER import from a higher layer.

---

## 2. Layer Ownership

| Layer | Primary Module(s) | May depend on |
|---|---|---|
| **Identity** | `hermes/contracts/platform-api.js` | — |
| **Agents** | `hermes/services/agents`, `lifecycle`, `registry` | Identity, Contracts |
| **Capabilities** | `hermes/services/providers/capability.js` | Identity, Contracts |
| **Providers** | `hermes/services/providers/index.js` | Capabilities, Shared interfaces |
| **Execution** | `hermes/services/execution/**` | Capabilities, Persistence, Audit, Identity |
| **Persistence** | `hermes/persistence/**`, `shared/interfaces` | Contracts |
| **Audit** | `hermes/services/audit` (abstraction), `shared/interfaces` | Contracts |

---

## 3. EPIC-004.6 Boundary Hardening (verified)

- **Execution → Policy Evaluator → Capability Registry**: `ExecutionCoordinator`
  accepts `deps.policy.capabilities` (a `CapabilityRegistry`). The policy
  evaluator is the **single gate** for `canAgentAct()`. ✅
- **Policy evaluator never imports execution internals.** It depends on
  `capabilities`, `knownProviders`, `verifyApprover` — all injected. ✅
- **Security module does not bypass the policy evaluator.** Authorization
  flows through `canAgentAct()` / `PolicyEvaluator.canAct()`, not ad-hoc checks. ✅
- **Execution never bypasses AuditStore.** Every state transition is persisted
  via the injected `ExecutionStore` (durable approval, lease, idempotency). ✅
- **Lease contract** is Execution-owned (`execution/lease.js`) and validated
  before any run. ✅
- **Metrics boundary** is Execution-owned (`execution/metrics.js`) and
  side-effect-free at construction. ✅

---

## 4. Violation Scan Results

| Check | Result |
|---|---|
| Provider imports execution internals? | ❌ None found |
| Security module bypasses policy evaluator? | ❌ None found |
| Execution bypasses AuditStore? | ❌ None found |
| Circular barrel imports? | ❌ None found |
| Capability registry imported directly by Execution internals (instead of via injected deps)? | ❌ None found (registry passed as dep) |

Result: **0 dependency-inversion violations** in the Hermes platform core.

---

## 5. Known Boundary Friction (technical debt, not violation)

1. **`hermes/` is not a pnpm workspace package** (no `package.json`). It is only
   typechecked transitively via `workers/` `include: ["../hermes/**/*.ts"]`.
   This means `hermes/` has no independent, reproducible build step. Recommended
   remediation: add `hermes/package.json` (typecheck + test scripts) and register
   it in the workspace `pnpm-workspace.yaml` so the root `typecheck` covers it.
2. **`workers/` typecheck reaches into `../hermes/**`** via `include`. This is a
   pragmatic bridge until (1) lands; it should become an explicit `@hermes/*`
   dependency once `hermes/` is packaged.
