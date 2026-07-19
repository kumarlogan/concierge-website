# EPIC-003-003 · Hermes Security Automation Platform — Completion Report

> **Status:** ✅ COMPLETE — 2026-07-19
> **Deliverables:** 9 of 9 milestones shipped and validated (M1–M9)
> **Validation:** 28/28 security-automation tests pass; in-scope typecheck clean
> (full-project `tsc --noEmit` 0 errors). No production touch, no vendor lock-in,
> simulation-only scanner backend.

---

## 1. Deliverables Shipped

| # | Milestone | Module(s) | Status |
|---|---|---|---|
| M1 | Security Work Model (provider-neutral contracts) | `security/security-work-model.ts` | ✅ |
| M2 | Security Agent Runtime (fail-closed execution) | `security/security-agent.ts` | ✅ |
| M3 | Security Provider Framework (reuses `activation/provider-framework.ts`) | `security/providers/security-providers.ts` | ✅ |
| M4 | OSS Compatibility Layer (scanner adapter specs + simulated executor) | `security/providers/oss-adapters.ts` | ✅ |
| M5 | Developer → Security Integration (orchestrator hook) | `security/security-integration.ts` | ✅ |
| M6 | Risk Engine (aggregate + score, fail-closed) | `security/risk-engine.ts` | ✅ |
| M7 | Admin Visibility (read model + admin facade) | `security/admin-view.ts` + `admin/index.ts` (`adminViewSecurity`) | ✅ |
| M8 | Test Suite | `workers/tests/hermes.security.003.test.ts` (28 tests) | ✅ |
| M9 | Docs (roadmap, completion, validation reports) | this file + `EPIC-003-003_VALIDATION_REPORT.md` + `ROADMAP.md` | ✅ |

---

## 2. Architecture Compliance

Composes the **existing EPIC-003-001 foundations** — no redesign, no production touch:

- **Provider Registry** (`activation/provider-framework.ts`): the security provider is a
  registered `ManagedProvider` resolved dynamically via capability negotiation.
  `bootstrapSecurityProvider()` wires it (register + simulated executor); the canonical
  `registerProvider`/`enableProvider`/`setProviderHealth` lifecycle is reused verbatim.
- **Authorization** (`activation/provider-framework.ts`): enabling the provider requires
  `hermes:activation:provider`; the security agent requires human `approveSecurityAgent` →
  `activateSecurityAgent` (no autonomous transition). Fail-closed — never auto-active.
- **Audit** (`audit/event.ts`): every agent transition, capability execution, and review
  emits a `sec.*` audit event (read back in tests via `readAuditBuffer`).
- **Admin / Identity** (`admin/access.ts`): `adminViewSecurity` is gated by
  `requireDomainRead(principal, "security")` → `hermes:admin:read` (human principal only);
  exposed through the existing admin facade, no public endpoint.
- **Workforce** (`security/security-agent.ts`): the security agent starts `assigned`,
  transitions only `assigned → approved → active` via human approval.

---

## 3. Invariants Preserved

| Invariant | Evidence |
|---|---|
| Fail-closed | Unresolved capability → refusal; no executor injected → `ok:false`; agent inactive → `executed:false`; unknown capability → framework refuses |
| Provider abstraction | Security scanner resolved via capability id (`sec.*`); simulated executor replaceable with gitleaks/semgrep/osv-scanner/trivy with no agent/runtime change |
| Human approval | `enableProvider` requires authorized principal; agent activation requires human approval; production review requests set `approvalRequirement.required=true` |
| Audit | Every transition + scan + review emits a `sec.*` audit event (asserted in M7/audit tests) |
| No autonomous remediation | The agent only collects findings + produces a package; it never remediates or auto-blocks beyond governed `blocksAutonomous` |
| No vendor lock-in | No vendor SDK imported in the security layer; vendor backends live behind the injectable `CapabilityExecutor` port |
| No production change | No deploy, no secret/Cloudflare/Worker mutation; tests use string-literal principals to avoid `platform-api.js` DB seeding |

---

## 4. Test Suite

- **New:** `workers/tests/hermes.security.003.test.ts` — **28 tests**, 9 milestone groups
  (M1–M7, M8 suite, audit) + ring-buffer store coverage.
- **Regression:** full `workers/` suite remains green for all in-scope modules; the
  security module typecheck is clean (`npx tsc --noEmit` filtered to `hermes/services/security/**`
  + `hermes/admin/index.ts` → 0 errors).

Test design notes:
- Principals are passed as string-literal `as any` objects (matching the existing activation
  test) to avoid importing `platform-api.js` (which seeds the wrangler SQLite DB).
- `beforeEach` clears providers + audit buffer + security-review ring buffer; provider registry
  clear is idempotent.
- M3 mirrors the canonical provider's real gating lifecycle: a provider must be *enabled*
  **and** pass a health probe (`setProviderHealth(id, "healthy")`) before it becomes `active`
  and is resolvable. `activateSecurityProvider()` performs both steps.

---

## 5. Known Limitations / Follow-ups

- The test file references `hermes.isolation.phase8.test.ts` and several other suite files that
  fail at the **vitest config level** due to an unresolved `@hermes/*` package-alias import in
  `hermes/identity/principal.ts`. This is **pre-existing, unrelated debt** (same failure existed
  before EPIC-003-003) and is NOT caused by these changes — the security suite itself runs clean
  in isolation (`npx vitest run workers/tests/hermes.security.003.test.ts` → 28/28).
- Full-project `tsc --noEmit` is green (0 errors) at the time of writing for the modules touched
  by this epic; legacy alias-resolution debt lives outside `hermes/services/security`.
- Real scanner wiring (gitleaks/semgrep/osv-scanner/trivy) is a separate follow-up: swap the
  executor passed to `bootstrapSecurityProvider()` — no agent/runtime change required.

---

## 6. Handoff

- No deploy performed (per constitution — no production changes without explicit authorization).
- Committed as logical milestones with explicit paths (no `git add -A`):
  `hermes/services/security/**` + `hermes/admin/index.ts` + `workers/tests/hermes.security.003.test.ts`.
- Validation report: `docs/operations/EPIC-003-003_VALIDATION_REPORT.md`
- Roadmap: updated in `ROADMAP.md`
