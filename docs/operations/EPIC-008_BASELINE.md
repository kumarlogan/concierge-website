# EPIC-008 Baseline — Controlled AGS Operations Pilot

> **Phase:** Baseline (pre-implementation)
> **Date:** 2026-07-21
> **Depends on:** EPIC-007 Completion Report · AGS Provider Integration (EPIC-006) · Hermes Foundation Freeze
> **Constraint:** Foundation FROZEN. Documentation + minimal required-gap implementation only.

---

## 1. Objective

**Enable Hermes to operate the AGS website lifecycle through controlled real-world usage.**

Concretely: connect the AGS GitHub repository and Cloudflare project through the
governed launch path, exercise website capability operations behind a controlled change
workflow and a human approval workflow, validate in staging, enforce the production
approval gate, and produce audit evidence for every action — **without** making
autonomous business or content decisions.

---

## 2. Scope

### INCLUDE
- GitHub repository connection readiness
- Cloudflare deployment readiness
- Website capability operations
- Controlled change workflow
- Human approval workflow
- Staging validation
- Production approval gate
- Audit evidence

### EXCLUDE
- Autonomous business decisions
- Autonomous content publishing
- SEO automation
- Marketing automation
- Redesign engine
- New foundation components

---

## 3. Constraints (Non-Negotiable)

- **Foundation FROZEN** — no architecture redesign, no new foundation abstractions.
- **Do not modify** `HermesExecutionGateway` or `ProviderRuntimeGuard`.
- **Preserve:**
  - provider neutrality
  - single execution boundary
  - mandatory audit
  - mandatory tenancy
  - explicit approval model
  - durable trust model
- **Fail-closed always** — any guard throw aborts before any provider call.

---

## 4. Relationship to EPIC-007

EPIC-007 delivered the governed launch **function** (`runLaunch` / `agsLaunch`) with
**15/15 verified guarantees**:
staging-isolation, production denial (no/expired/mismatched-tenant/unauthorized-approver),
durable+revocable ledger, rollback pre-flight gate, real `probeSite`, backend fail-closed,
tenant isolation, idempotency replay-denial, audit correlation, independent guardrails.

EPIC-008 is the **operations pilot**: verify that *every supporting capability*
(GitHub/Cloudflare providers, secret boundary, approval workflow, audit, rollback,
tenant isolation) is ready, and implement **only the gaps required** to run controlled
AGS operation end-to-end. No enhancements beyond those gaps.

---

## 5. Success Criteria (carried into PHASE4 validation)

- AGS integration tests pass.
- EPIC-007 regression (guarantee) suite passes.
- Trust regression suite passes.
- Approval regression suite passes.
- **No bypass paths** to provider execution.
- **No direct provider execution** outside the governed workflow.
- **No secrets in source.**
- **No provider-specific logic in core** (Foundation) modules.

---

*Baseline established 2026-07-21. Next: PHASE2 Readiness Review (read-only).*
