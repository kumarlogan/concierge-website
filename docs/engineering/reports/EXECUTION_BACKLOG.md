# Execution Backlog — Concierge Production Readiness

**Repository:** `kumarlogan/concierge-website`
**Basis:** commit `0b5e0c3`, assessed 2026-08-04
**Target:** GA launch with real patients at scale
**Source register:** `IMPLEMENTATION_GAP_ANALYSIS.md` (PRG-001 … PRG-052)

Effort is expressed in **engineering days**, inferred from repository evidence. Excludes design, compliance review, procurement, and coordination overhead. Assumes engineers already familiar with the codebase.

Hermes AI platform (EPCL / WAS / WEF) is out of scope and appears nowhere in this backlog.

---

## How to read this

Items are grouped into four priority tiers, then sequenced. **The sequence matters more than the tier** — several Critical items are cheap and unblock expensive ones, so they are ordered first regardless of size.

| Tier | Meaning |
|---|---|
| **Critical** | Blocks GA. A real patient is harmed, exposed, or loses data if this ships as-is |
| **High** | Blocks GA at scale, or represents unacceptable operational risk |
| **Medium** | Required for a sustainable product; not a launch blocker |
| **Low** | Hygiene; do when convenient |

---

## Summary

| Tier | Items | Effort (days) |
|---|---|---|
| Critical | 22 | 55–90 |
| High | 20 | 71–133 |
| Medium | 8 | 45–100 |
| Low | 2 | 11–23 |
| **Total** | **52** | **182–346** |

---

## Recommended execution order — the shape of the plan

**Wave A — Stop the bleeding (days 1–10).** Close the exposure that exists right now. Merge the auth guard, fix the IDOR handlers, put a gate in CI. Mostly small changes, disproportionate risk reduction.

**Wave B — Make data real (days 10–35).** Nothing else matters until patient data persists and can be recovered. Backup/DR, then migrate every in-memory store to D1, then resolve the schema conflict.

**Wave C — Make the journey work (days 35–60).** Fix registration, MFA, care plan, document upload. Replace clinic mock data with real queries. Make notifications actually deliver.

**Wave D — Make it operable (days 60–80).** Observability, alerting, staging, rollback, runbooks. You cannot run a patient platform you cannot see.

**Wave E — Complete the product (days 80+).** Admin console, reporting, API contract, frontend tests, remaining debt.

Waves A and B should not overlap with feature work. Everything in Wave A is a precondition for honestly describing the system as safe.

---

## CRITICAL — 22 items · 55–90 days

Blocks GA absolutely. No real patient should be onboarded until every item here is closed.

| # | ID | Item | Evidence | Depends on | Days |
|---|---|---|---|---|---|
| 1 | PRG-001 | Merge PR #3 — clinic console routes have no auth guard | `workers/src/routes/clinic.ts`, PR #3 | — | 0.5–1 |
| 2 | PRG-015 | IDOR: appointment GET has no ownership check | `workers/src/routes/` appointments handler | — | 1–2 |
| 3 | PRG-016 | IDOR: appointment PATCH has no ownership check | same | PRG-015 | 0.5–1 |
| 4 | PRG-017 | IDOR: message thread GET has no ownership check | messages handler | — | 1–2 |
| 5 | PRG-019 | IDOR: clinic messaging permits sender impersonation | clinic-messages handler | PRG-001 | 1–2 |
| 6 | PRG-018 | IDOR: workflow and task search have no identity filter | `workers/src/routes/wave7.ts` | — | 2–3 |
| 7 | PRG-002 | No CI test or typecheck gate — broken code auto-deploys | `.github/workflows/deploy.yml` | — | 1–3 |
| 8 | PRG-013 | `AUTHORIZATION_ENGINE` never constructed — 2 endpoints throw | `workers/src/types/env.ts`, `routes/trustRuntime.ts` | — | 3–5 |
| 9 | PRG-012 | No disaster recovery — no backup or restore for patient data | absent | — | 5–8 |
| 10 | PRG-014 | `consents` table defined twice with incompatible schemas | `migrations/0006_`, `0008_` | PRG-012 | 2–4 |
| 11 | PRG-011 | Consent grants in-memory — compliance records evaporate | `platform/trust/consent-engine.ts` | PRG-014 | 3–5 |
| 12 | PRG-006 | Timeline in-memory per request — IVF journey data discarded | `platform/timeline/` | PRG-012 | 4–7 |
| 13 | PRG-003 | Registration auto-verifies email — identity never confirmed | registration handler (`// dev mode`) | — | 2–3 |
| 14 | PRG-004 | No email verification landing route exists | SPA router | PRG-003, PRG-026 | 1–2 |
| 15 | PRG-005 | MFA-enrolled patients 404 after login — permanent lockout | `LoginPage.tsx` → `/patient/mfa` | — | 1–2 |
| 16 | PRG-007 | Care Plan and Tasks pages 404 — backend routes absent | `/api/v1/timeline/phases`, `/tasks` | PRG-006 | 3–5 |
| 17 | PRG-008 | Document upload calls `fetchDocuments()` instead of `initiateUpload()` | upload dialog component | — | 0.5–1 |
| 18 | PRG-009 | Clinic portal shows 8 hardcoded mock patients | `workers/src/routes/clinic.ts` | PRG-001 | 3–5 |
| 19 | PRG-010 | Triage queue and conversations return hardcoded mocks | `routes/clinic-messages.ts` | PRG-009 | 3–5 |
| 20 | PRG-020 | Consultation submission notifies nobody | `routes/consultations.ts` | PRG-026 | 2–3 |
| 21 | PRG-021 | Lead status changes write no audit log | lead handlers | — | 2–3 |
| 22 | PRG-022 | Workflow dashboard JOIN always NULL — instances never inserted | `platform/workflow/` | — | 3–5 |

**Wave A subset (do first, ~7–14 days):** items 1–8. These are the live exposures and the gate that stops new ones appearing.

---

## HIGH — 20 items · 71–133 days

Blocks GA at scale or represents unacceptable operational risk.

| # | ID | Item | Depends on | Days |
|---|---|---|---|---|
| 23 | PRG-023 | Appointments stored in `globalThis` — lost on isolate recycle | PRG-012 | 4–7 |
| 24 | PRG-024 | Messages stored in-memory — no `messages` table exists | PRG-012 | 4–7 |
| 25 | PRG-025 | `NOTIFICATIONS` D1 binding unprovisioned (empty `database_id`) | — | 1–2 |
| 26 | PRG-026 | Notification delivery simulated — no real email/SMS/push | PRG-025 | 6–10 |
| 27 | PRG-031 | IDOR: `?patientId=` overrides JWT binding on appointments | PRG-015 | 1–2 |
| 28 | PRG-032 | IDOR: `?participantId=` overrides JWT binding on threads | PRG-017 | 1–2 |
| 29 | PRG-033 | IDOR: consent history accepts arbitrary `identityId` | — | 1–2 |
| 30 | PRG-034 | Document share revocation has no ownership check | — | 0.5–1 |
| 31 | PRG-029 | No account lockout — credential stuffing undefended | PRG-030 | 3–5 |
| 32 | PRG-030 | Per-isolate rate limiting gives no global protection | — | 3–5 |
| 33 | PRG-035 | MFA implemented but never enforced | PRG-005 | 2–3 |
| 34 | PRG-028 | JWTs in `localStorage` — XSS yields account takeover | — | 3–5 |
| 35 | PRG-039 | No virus scanning on patient document upload | — | 3–5 |
| 36 | PRG-038 | PHI/non-PHI segregation is naming-convention only | — | 4–8 |
| 37 | PRG-036 | No observability — no error tracking, shipping, or alerting | — | 5–10 |
| 38 | PRG-037 | No React error boundaries — component crash blanks the page | — | 2–3 |
| 39 | PRG-040 | No staging — `preview` shares the production D1 database | PRG-012 | 3–5 |
| 40 | PRG-041 | Migrations not applied in CI | PRG-002 | 2–4 |
| 41 | PRG-042 | No documented or tested rollback procedure | PRG-040 | 2–4 |
| 42 | PRG-027 | No web admin console — Telegram read-only, users via manual SQL | — | 15–30 |

---

## MEDIUM — 8 items · 45–100 days

Required for a sustainable product; not launch blockers.

| # | ID | Item | Days |
|---|---|---|---|
| 43 | PRG-043 | `EventReader` D1 queries all commented out — no workflow history | 3–5 |
| 44 | PRG-044 | `ProjectionEngine` stubbed — all metrics hardcoded to zero | 4–8 |
| 45 | PRG-045 | `CronScheduler` not wired to a Cloudflare cron trigger | 2–4 |
| 46 | PRG-046 | Turnstile configured with an empty secret — bot protection skipped | 0.5–1 |
| 47 | PRG-048 | SSE notification stream stalls after one `connected` event | 2–4 |
| 48 | PRG-047 | Zero frontend tests | 10–20 |
| 49 | PRG-049 | OpenAPI spec covers 3 of ~110 endpoints | 8–15 |
| 50 | — | Reporting capability does not exist (business need at GA) | 15–40 |

*Item 50 is scored `Missing` in the assessment rather than as a defect; it is carried here because running a clinic business without reporting becomes untenable soon after launch.*

---

## LOW — 2 items · 11–23 days

| # | ID | Item | Days |
|---|---|---|---|
| 51 | PRG-050 | Gitleaks custom config inactive in CI | 0.5–1 |
| 52 | PRG-051 | Migration numbering broken (duplicate `0002_`, unpadded `011_`) | 0.5–1 |
| — | PRG-052 | Version constant stale (`1.1.0` vs CHANGELOG `1.6.0`) | 0.5–1 |
| — | — | TypeScript error baseline (~175 in live source, EPIC-015) | 10–20 |

*The TypeScript baseline is tiered Low because it is not independently a GA blocker — but it is a standing co-indicator of incompleteness in six domains, and PRG-002 will surface it the moment a typecheck gate lands. Expect to confront it during Wave A.*

---

## Dependencies worth planning around

- **PRG-012 (disaster recovery) gates the persistence work.** Migrating in-memory stores to D1 without a backup path increases the blast radius of a mistake. Do backup first.
- **PRG-002 (CI gate) will fail loudly on first run** because of the ~175 TypeScript errors. Budget for that — either fix the errors or land the gate with a documented, shrinking baseline.
- **PRG-026 (real notification delivery) unblocks four downstream items** — email verification, consultation alerts, appointment reminders, and the patient journey generally. It is the highest-leverage item in the High tier.
- **PRG-001 (clinic auth guard) gates all clinic portal work.** Merging PR #3 first avoids rewriting the mock-data replacements against an unguarded surface.

---

## A note on sequencing discipline

The critical path to a first safe real patient is **55–90 engineering days**. That figure only holds if Waves A and B run without parallel feature work. The pattern this assessment found — capability marked complete on merge rather than on working end to end — is what produced the current state, and it will reproduce it under schedule pressure.

The single cheapest change that prevents recurrence is PRG-002: a test and typecheck gate in CI. It costs 1–3 days and it is the reason most of the other 51 items were able to accumulate unnoticed.
