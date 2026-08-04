# Production Readiness Assessment — Concierge

**Repository:** `kumarlogan/concierge-website`
**Assessed at:** commit `0b5e0c3` (`main`), 2026-08-04
**Prepared by:** External AI engineering session
**Engagement type:** Assessment only — no source code, configuration, or existing documentation was modified

---

## 1. The bar this is measured against

**GA launch with real patients at scale**, for a fertility clinic platform holding patient health information for Canadian patients.

This distinction matters more than any other input to this report. The system is already deployed and serving `agsynergy.ca`, so "is it in production" is not the question. The question is whether it is safe and complete enough to put **real patients** on it at volume. Judged against "does the site load", this repository looks healthy. Judged against the GA bar, it does not.

**Out of scope by instruction:** the Hermes AI platform track (EPCL / WAS / WEF). It is dormant, it is documented elsewhere, and it is not treated as a GA blocker here.

---

## 2. Headline verdict

> ### GA Readiness: **33.8%**
> **Not ready for real patients.** 22 Critical defects, including confirmed cross-patient data access, patient data held in memory that is lost on every Worker restart, and no backup or restore path for the patient database.

| Domain | Readiness |
|---|---|
| Product (14 areas) | **33.1%** |
| Platform (14 areas) | **34.6%** |
| **Overall (weighted)** | **33.8%** |

Of 28 assessed areas: **2 Missing · 14 Broken · 11 Partially Complete · 1 Complete-untested · 0 Complete-verified.**

Not a single area of this system reaches "Complete and verified" against the GA bar.

---

## 3. Scoring methodology

A single percentage is easy to misuse, so the method is published in full and anyone can recompute it.

Each of the 28 areas is scored 0–4:

| Score | Meaning |
|---|---|
| 0 | **Missing** — the capability does not exist |
| 1 | **Broken** — exists but does not work correctly, or is unsafe |
| 2 | **Partially Complete** — works in part; significant gaps remain |
| 3 | **Complete-untested** — appears complete but lacks verification |
| 4 | **Complete-verified** — complete and covered by tests/evidence |

Each area carries a weight reflecting production impact at the GA bar:

| Weight | Applies to |
|---|---|
| 3 | Patient safety, patient data integrity, security, recoverability |
| 2 | Core product function |
| 1 | Supporting capability |

**Readiness = Σ(score × weight) ÷ (4 × Σweight) = 92 / 272 = 33.8%.**

---

## 4. Per-area assessment

### Product

| Area | Score | Wt | Classification | Basis |
|---|---|---|---|---|
| Website | 3 | 1 | Complete-untested | Marketing pages and consultation funnel largely functional |
| Patient Journey | 1 | 3 | Broken | Registration auto-verifies email; MFA route 404s; no onboarding |
| Patient Portal | 1 | 3 | Broken | Care Plan/Tasks routes absent; upload calls wrong function; in-memory data |
| Clinic Portal | 1 | 3 | Broken | No auth guard (PR #3 unmerged); patient list and triage are hardcoded mocks |
| CRM | 2 | 2 | Partially Complete | Real D1 lead API with RBAC; no UI, no pipeline, no lead→patient conversion |
| Consultation Workflow | 1 | 3 | Broken | Six sequential breaks; `consultations` table dead; no notification fires |
| Timeline | 1 | 2 | Broken | `InMemoryTimelineEngine` per request; every write discarded; no D1 table |
| Workflow Engine | 2 | 2 | Partially Complete | D1 core real; EventReader/ProjectionEngine stubbed; instances never inserted |
| Notifications | 1 | 3 | Broken | Zero delivery; binding unprovisioned; status forced to SENT; SSE stalls |
| Authentication | 2 | 3 | Partially Complete | Strong identity core; no lockout, MFA not enforced, MFA route missing |
| Authorization | 1 | 3 | Broken | Engine unwired; confirmed IDOR on appointments, messages, workflows, consent |
| File Management | 2 | 3 | Partially Complete | R2 + D1 metadata real; no virus scanning; PHI segregation naming-only |
| Reporting | 0 | 1 | Missing | No reporting, dashboards, exports, or metrics exist |
| Admin Functions | 1 | 2 | Broken | No web admin UI; Telegram bots read-only; users provisioned by manual SQL |

### Platform

| Area | Score | Wt | Classification | Basis |
|---|---|---|---|---|
| Frontend | 2 | 2 | Partially Complete | Vite/React sound; zero tests; production bundle guard present |
| Backend | 2 | 2 | Partially Complete | Clean structure; ~175 TypeScript errors in live source |
| Cloudflare Workers | 2 | 2 | Partially Complete | Configured; NOTIFICATIONS binding unprovisioned; no staging route |
| APIs | 1 | 2 | Broken | OpenAPI spec covers 3 of ~110 endpoints; generated client near-empty |
| Database / D1 | 2 | 3 | Partially Complete | 68 tables; `consents` defined twice incompatibly; index gaps |
| Storage / R2 | 2 | 2 | Partially Complete | Working; no lifecycle rules, no versioning, no backup |
| Security | 1 | 3 | Broken | IDOR live; localStorage tokens; per-isolate rate limiting only |
| Observability | 1 | 3 | Broken | Structured logs but ephemeral; no shipping, no alerting, no correlation ID |
| Error Handling | 1 | 2 | Broken | Router swallows exceptions without logging; no React error boundaries |
| Performance | 2 | 2 | Partially Complete | Unbounded list endpoints; missing indexes; cold start unmeasured |
| Deployment | 1 | 2 | Broken | No staging (preview shares production D1); rollback undocumented |
| CI/CD | 1 | 3 | Broken | No test gate, no typecheck gate; auto-deploy to production on every push |
| Testing | 2 | 3 | Partially Complete | 778 worker tests pass; zero frontend tests; critical paths untested |
| Disaster Recovery | 0 | 3 | Missing | No D1 backup, no confirmed PITR, no restore path |

---

## 5. The four findings that define the verdict

### 5.1 Any authenticated patient can read another patient's data `[OBSERVED]`

This is the most serious finding in the assessment. Authorization is enforced in middleware but not in the handlers, so several endpoints authenticate the caller and then never check whether that caller owns the record being requested.

Confirmed by reading the handler code: `GET`/`PATCH /api/v1/appointments/:id` take `_request` as an unused parameter and perform no ownership check. `GET /api/v1/messages/threads/:threadId` does the same. Workflow and task search return records across all patients with no identity filter. `GET /api/v1/consent/history?identityId=X` trusts a caller-supplied identity rather than the JWT subject.

In a fertility clinic context, the data exposed is among the most sensitive a person has.

### 5.2 Patient data does not survive a Worker restart `[OBSERVED]`

Appointments, messages, the IVF timeline, and consent grants are held in `globalThis` singletons and `Map` objects rather than D1. Cloudflare evicts and recycles isolates routinely. A patient can create an appointment in one isolate and find it gone from the next — silently, with no error.

Consent records carry compliance weight. They are among the records being lost.

### 5.3 There is no way to recover the patient database `[OBSERVED]`

No backup scripts exist, no point-in-time recovery is configured or confirmed, migrations are forward-only with an unresolved schema conflict, and R2 has no versioning. If `agsynergy-db` were corrupted or deleted today, patient data would be unrecoverable.

This alone disqualifies GA regardless of every other finding.

### 5.4 Nothing stands between a bad commit and production `[OBSERVED]`

Every push to `main` auto-deploys both Workers. There is no test gate and no typecheck gate. The project carries a documented baseline of **218 TypeScript errors** (approximately 175 in live source), acknowledged as a deferred backlog item and suppressed only by the absence of a `tsc` step in CI. Wrangler type-strips at build time, so genuinely broken code deploys successfully.

There is also no staging environment — the `preview` environment shares the production D1 database.

---

## 6. Documentation verification

| Finding | Detail | Evidence |
|---|---|---|
| **Incorrect** | The AI Context Layer classifies Workflow Engine and Document Management as `implemented`. This assessment finds both `Partially Complete` — workflow instances are never inserted, document metadata partly in-memory. | `docs/context/PROJECT_STATE.yaml` vs `workers/src/platform/workflow/`, `documents/` |
| **Incorrect** | Context layer lists Trust Runtime as `implemented` with a single caveat. The IDOR findings make this materially understated. | `docs/context/PROJECT_STATE.yaml` vs `workers/src/routes/` handlers |
| **Missing** | No documentation of the ~110-endpoint API surface. The OpenAPI spec covers 3 endpoints. | `lib/api-spec/openapi.yaml` |
| **Missing** | No runbook, no incident procedure, no rollback procedure, no on-call definition. | `docs/` — absent |
| **Missing** | No backup/restore documentation for D1 or R2. | absent |
| **Stale** | `SECURITY.md`, `TASKS.md`, `DECISIONS.md` — previously catalogued as GAP-013, GAP-014, GAP-012; all still stale at this commit. | `docs/context/KNOWN_GAPS.yaml` |
| **Incorrect** | `README.md` states hosting is "Cloudflare Pages". The SPA is served by a Cloudflare Worker named `hermes-website`. | `README.md` vs `wrangler.jsonc` |
| **Correct** | The context layer's core structural claims — topology, bindings, subsystem dormancy, the documentation-vs-capability gap — held up under verification. | — |

The context layer's *method* proved sound; its *capability ratings* were too generous in three places. Per the engagement constraint, `KNOWN_GAPS.yaml` and `PROJECT_STATE.yaml` were **not** amended. They should absorb these corrections in a follow-up.

---

## 7. Roadmap validation

Reported only. Nothing was modified.

| Claim | Source | Reality | Verdict |
|---|---|---|---|
| Phase 1 "Digital Concierge Platform ✅ Complete" | `README.md` | The consultation workflow — Phase 1's core — has six sequential breaks; submissions notify nobody and clinic staff cannot see real leads | **Mismatch** |
| Waves 5–7 "promoted to production" | `ROADMAP.yaml`, commit history | Document Centre partially real; Communication Centre messaging in-memory; Notifications deliver nothing | **Mismatch** |
| Wave 8 Workflow Engine "reconciled, 778/778 pass" | commit `8175ddd` | D1 core genuinely landed. But `EventReader` returns `[]` unconditionally, `ProjectionEngine` returns hardcoded zeroes, `workflow_instances` is never populated, and `workflow_templates` has no seed data | **Partial — the commit's own deferred list is load-bearing** |
| Phase 2 complete across nine waves | `ROADMAP.yaml`, `CURRENT_SPRINT.md` | Not corroborated by implementation for the patient-facing waves | **Mismatch** |
| Phase 1 in progress, EPIC-002-005 not started | `TASKS.md` | Nine waves stale | **Mismatch (previously GAP-013)** |

**Pattern:** waves are marked complete when code is merged, not when the capability is reachable, persistent, and tested end to end. That definition of done is the root cause of the documentation–reality gap, and it will keep reproducing it until the definition changes.

---

## 8. What this assessment could not determine `[UNKNOWN]`

| Unknown | What would resolve it |
|---|---|
| Live D1 schema ground truth — which `consents` definition actually exists | `wrangler d1 execute agsynergy-db --command ".schema consents"` |
| Whether the 22 Critical defects are already causing harm in production | Cloudflare analytics, error rates, support tickets |
| Actual patient volume and traffic profile | Cloudflare dashboard |
| Whether D1 point-in-time recovery is enabled at the account level | Cloudflare D1 settings |
| Exact per-file TypeScript error distribution | Run `tsc --noEmit` locally |
| Whether the IDOR paths have been exploited | Access logs |
| Real cold-start and query latency | Production telemetry |

None of these change the verdict. Several would sharpen the remediation plan.

---

## 9. Effort to reach GA

| Scope | Engineering days |
|---|---|
| Critical path to first safe real patient | **55–90** |
| Full register (52 gaps) | **182–346** |

Estimates are inferred from repository evidence — code size, test coverage, dependency depth. They exclude design, compliance review, vendor procurement, and coordination overhead, and assume engineers already familiar with the codebase. Treat as planning ranges, not commitments.

---

## 10. Companion documents

| Document | Contents |
|---|---|
| `IMPLEMENTATION_GAP_ANALYSIS.md` | The master register — 52 gaps (PRG-001…PRG-052), evidence, dependencies, effort, execution order, dependency graph, and the recurring root-cause themes |
| `PRODUCTION_CHECKLIST.md` | 72 binary go/no-go checks across 7 gates, each with a verification method. Currently 9 pass |
| `EXECUTION_BACKLOG.md` | The prioritised delivery plan in Critical / High / Medium / Low tiers with sequencing |
