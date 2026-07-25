# EPIC-005 — Provider Selection Engine

**Phase:** 6 — Provider intelligence (scoring architecture only)
**Status:** Architecture-only. No implementation. No source code modified.
**Date:** 2026-07-20

---

## 1. Purpose

When an intention (capability) can be served by **multiple providers**, Hermes must pick **one** deterministically, policy-compliantly, and observably. The Selection Engine consumes the Marketplace candidate set and produces a ranked, justified choice — then hands it to the Policy Evaluator (the existing single decision point) before execution.

> **No provider may ever become a special case.** Selection is pure data-driven scoring.

---

## 2. Inputs

```
Intention request
  ├─ capabilityId (intention, e.g. "deploy.website")
  ├─ principal + tenant (for policy/approval)
  ├─ riskContext (env, scope, required approvals)
  └─ constraints (max latency, cost ceiling, required trust level)
        │
        ▼
Marketplace.list({ capability: capabilityId })  → candidate providers
        │
        ▼
Policy pre-filter (fail-closed): drop candidates that
  - are not trusted/authorized
  - require approval the principal lacks
  - violate tenant/trust policy
        │
        ▼
Scoring Engine (below)
```

---

## 3. Scoring Architecture

Each surviving candidate receives a weighted score. Weights are **Hermes config**, never hardcoded per provider.

```
score(provider) = Σ  w_i · normalize(metric_i)

Metrics (all normalized 0..1, higher = better unless noted):
  ├─ capabilityMatch     : does provider declare this exact intention? (1/0)
  ├─ policy              : compliance margin vs required trust/approval (1=fully compliant)
  ├─ trust              : trustLevel ordinal (untrusted<sandbox<trusted<privileged)
  ├─ health             : healthy=1, degraded=0.5, unhealthy/unknown=0
  ├─ latency            : rolling p95 invocation latency (lower=better → inverted)
  ├─ historicalSuccess  : success rate over trailing N invocations
  ├─ resourceAvail      : current free capacity vs limits.maxConcurrent
  ├─ cost               : normalized $/invocation (lower=better → inverted)
  ├─ humanPreference    : operator-pinned preference (0 or 1, or weight boost)
  └─ confidence         : how certain the score is (sample size of history)
```

Weight vector `W = { capabilityMatch: ∞, policy: ∞, trust: w_t, health: w_h,
latency: w_l, historicalSuccess: w_s, resourceAvail: w_r, cost: w_c,
humanPreference: w_p, confidence: w_f }`

- `capabilityMatch` and `policy` are **hard gates** (∞): a non-match → score −∞ (excluded).
- All other weights are tunable in `hermes.config` under `selection.weights`.

---

## 4. Selection Flow (architecture)

```
candidates (from Marketplace, post policy pre-filter)
     │
     ▼
┌──────────────────────────────────────────┐
│  Scoring Engine                            │
│   for each candidate: compute score()     │
│   attach rationale { metric_i → value }   │
└──────────────┬───────────────────────────┘
               ▼
        rank by score (desc)
               │
               ▼
        tie-break:  preferredFor ⊆ intention
                    → humanPreference
                    → trustLevel
                    → latency
               │
               ▼
        pick top-1  ──▶  chosen provider + rationale
               │
               ▼
        hand to Policy Evaluator (existing single decision point)
               │
               ├─ DENY → fall back to rank #2, repeat
               └─ ALLOW → return SelectionResult to Coordinator
```

**Fallback:** if the top choice is denied by policy at execution time (e.g. approval expired), the engine walks down the ranked list — never re-scoring from scratch.

---

## 5. Selection Result (contract, for later implementation)

```ts
interface SelectionResult {
  providerId: string;
  capabilityId: string;
  score: number;
  rationale: Record<string, number>;   // metric → normalized value (auditable)
  alternatives: Array<{ providerId: string; score: number }>;
  decidedAt: string;
}
// Emitted as audit "provider.selected" with full rationale for review.
```

---

## 6. Why This Satisfies "No Special Cases"

- Weights are **global config**, not per-provider overrides.
- `preferredFor` is **manifest data** (Phase 2), not code branching.
- `humanPreference` is an **operator action**, recorded in audit — not a code path.
- The only hard gates are `capabilityMatch` and `policy` — both data-derived.
- Adding a provider changes **nothing** in the engine; it simply enters the candidate set.

---

## 7. Rules (architecture only)

- Selection is **scoring, not branching**. No `if (provider === "claude")`.
- The engine never executes — it returns a choice; the Coordinator executes.
- Every selection is **audited with rationale** (reviewable, reversible).
- Policy pre-filter and the existing Policy Evaluator remain the **authoritative gates**; selection only ranks among already-compliant candidates.
- Weights live in Hermes config; tuning selection never requires a code change.
