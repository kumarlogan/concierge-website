# AI-Native Engineering Foundation Report

**Repository:** `kumarlogan/concierge-website`
**Engagement:** External Engineering Workforce — AI-Native Engineering Context Foundation
**Date:** 2026-08-04
**Prepared by:** External AI engineering session (HyperAgent)
**Status:** Complete

---

## 1. Executive summary

This engagement set out to make the Concierge repository AI-native: self-describing,
machine-readable, and sufficient on its own to onboard a new engineering contributor —
human or AI — without recourse to prior conversations.

The repository was analysed end to end without modification, assessed against
repository evidence, and then extended with a purely additive AI Context Layer at
`docs/context/` plus an engineering evidence base at `docs/engineering/reports/`.

**The central discovery reframes the problem.** This repository does not lack
documentation. It contains 514 markdown files against roughly 400 source files — more
prose than code. What it lacked was navigation, authority ranking, and any mechanism
distinguishing a current-state document from a point-in-time historical record. Roughly
half of the 47 root markdown files are reports, audits, and certifications that read
like descriptions of the present. An AI session exploring this repository undirected
would, with high probability, act on a superseded document. That is the failure this
foundation addresses.

**The second discovery is a gap between documented and running capability.** The Hermes
AI platform track — EPCL planning, WAS activation, WEF execution — is extensively
designed, substantially coded, and almost entirely unreachable at runtime. All eleven
relevant feature flags default to `false`, no HTTP route reaches the pipeline, and WEF
has no execution engine at all. The repository's own `WAVE2_AUDIT_REPORT.md`
independently reached the same conclusion. The product track, by contrast, is genuinely
operational: identity, trust, workflow, and documents are real, D1-backed, and live,
and the patient portal is in production.

Twelve context documents and three engineering reports were created. No application
code was changed, no configuration was touched, and no existing documentation was
deleted or moved — a hard constraint of the engagement, honoured throughout.

**Repository readiness improved from 1.7 to 3.6 out of 5.** The remaining ceiling is
not documentation-shaped: it is the absence of automated quality gates and code review,
which no context layer can supply.

---

## 2. Repository changes

All changes are additive. Two new directories were created; one existing file was
extended by a pointer block.

| Change | Path | Nature |
|---|---|---|
| New directory | `docs/context/` | 12 files — the AI Context Layer |
| New directory | `docs/engineering/reports/` | 3 files — the engineering evidence base |
| Extended | `README.md` | Added a short "AI Context Layer" pointer section directing readers to `docs/context/` |

**Explicitly not done**, per the engagement constraints:

- No application code, test, or configuration file was modified.
- No existing documentation was deleted, moved, renamed, or rewritten.
- No product or platform redesign was proposed.
- No speculative architecture was introduced.
- The 20 catalogued defects were recorded, not fixed. Every remedy is labelled
  `[RECOMMENDED]`.

---

## 3. New documents created

### `docs/context/` — the AI Context Layer

| File | Format | Purpose |
|---|---|---|
| `README.md` | Markdown | Entry point; reading order; the three things to know first |
| `PROJECT_STATE.yaml` | YAML | What the repository is, what is deployed, what actually works |
| `ARCHITECTURE.yaml` | YAML | The system as built — topology, bindings, all 15 subsystems with maturity and persistence, data layer, dependency direction |
| `KNOWN_GAPS.yaml` | YAML | 20 catalogued defects with severity, evidence, consequence, recommended remedy |
| `CURRENT_WORK.yaml` | YAML | Point-in-time snapshot of active streams, open PRs, branches, with self-re-derivation instructions |
| `ROADMAP.yaml` | YAML | Phases, 11 waves, platform track, and 8 recorded roadmap conflicts |
| `ENGINEERING_GUIDE.md` | Markdown | How to work here — setup, commands, route/migration conventions, deployment, hazards checklist |
| `DOCUMENT_INDEX.md` | Markdown | All 47 root files and 26 docs directories with authority ranking; 7 named conflicts; placement decision table |
| `DECISION_LOG.md` | Markdown | Index of all 19 ADR entries across 18 files; the ADR-016 collision; decisions recorded outside the ADR system |
| `GLOSSARY.md` | Markdown | 26 terms defined with evidence paths; the AGS/Hermes/Concierge/AG Synergy naming chain |
| `AI_COLLABORATION.md` | Markdown | Session start and end protocol; the rules that prevent the most common failures |
| `CONTEXT_MAINTENANCE.md` | Markdown | The update contract — change type mapped to files it obliges you to update |

### `docs/engineering/reports/`

| File | Purpose |
|---|---|
| `REPOSITORY_DISCOVERY_REPORT.md` | Consolidated Phase 1 record — the reproducible evidence base |
| `ENGINEERING_ASSESSMENT_REPORT.md` | Phase 2 judgement layer — capability assessment, debt register, prioritised recommendations |
| `AI_NATIVE_ENGINEERING_FOUNDATION_REPORT.md` | This document |

**Three additions to the suggested structure**, each justified by a condition found in
the repository rather than added speculatively:

- **Authority tiers inside `DOCUMENT_INDEX.md`.** An index of 514 files without conflict
  resolution would not stop a session acting on a stale document. Every document is
  ranked `AUTHORITATIVE` / `HISTORICAL` / `SUPERSEDED` / `UNCERTAIN`.
- **`CONTEXT_MAINTENANCE.md`.** The corpus drifted because nothing obliged anyone to
  update it. Without an explicit contract, this layer would become the 515th stale file.
- **`GLOSSARY.md`.** Four overlapping product names and a dense acronym set (EPCL, WAS,
  WEF, PSER, GOV, EPIC, Wave) make the corpus unreadable to a newcomer.

---

## 4. Existing documents updated

| Document | Change | Rationale |
|---|---|---|
| `README.md` | Appended an "AI Context Layer" section pointing to `docs/context/` | Without a root pointer, the layer is undiscoverable by a session that starts where every reader starts. Existing content untouched. |

No other existing file was modified. Fourteen documents were identified as stale,
superseded, or internally contradictory — including `SECURITY.md`, `TASKS.md`, and
`DECISIONS.md` — and every one was left exactly as found. Their status is recorded in
`DOCUMENT_INDEX.md` instead. This honours the preservation constraint while removing
the risk that a reader trusts them: the index, not the file, carries the correction.

---

## 5. Key findings

### 5.1 Documentation volume is not documentation health

514 markdown files, no index, no authority convention. Approximately half of the root
corpus consists of point-in-time reports named indistinguishably from current-state
documents. Seven direct contradictions were catalogued, including `TASKS.md` frozen at
Phase 1 while `ROADMAP.md` declares Phase 2 complete across nine waves, and `SECURITY.md`
describing authentication as "upcoming" eleven days after it shipped on 39 routes.

The mechanism is identifiable: work is tracked in markdown rather than an issue tracker
(there are zero GitHub Issues), so every status update creates a document, and no
document is ever retired.

### 5.2 The platform track is documented far beyond what it runs

EPCL has a complete twelve-stage planning workflow. WAS has a full seven-state
activation machine with observability and duplicate protection. Both are well-structured
code. Neither is reachable: eleven feature flags default to `false`, no HTTP route
touches them, and `WEFDelegator` carries an explicit TODO stating that delegation
returns a simulated success. The repository's own Wave 2 audit records that the
certified orchestration path was never invoked and the wave was delivered as a direct
coding task.

This is not dead code and not deception — it is design outpacing integration, a
characteristic pattern of documentation-driven AI development where artifacts are cheap
to produce and wiring is not. But it means capability claims in the corpus cannot be
taken at face value, which is precisely why `ARCHITECTURE.yaml` assigns every subsystem
an explicit `maturity` and `http_exposed` flag.

### 5.3 Four defects are live production risks

`AUTHORIZATION_ENGINE` is declared in the environment type and called by two endpoints
but never constructed — both will throw at runtime. The `consents` table is defined
twice with incompatible schemas, so the wider definition's columns never reach the live
database. Six clinic console routes lack an authentication guard, with the fix sitting
in unmerged PR #3. And every push to `main` auto-deploys both Cloudflare Workers with no
test and no typecheck in the pipeline.

### 5.4 Persistence is not where it appears to be

Consent grants and delegations — records with compliance weight in a clinical context —
are held in module-level `Map` singletons while their D1 tables sit unwired. Messaging,
appointments, timeline, and document metadata are likewise in-memory. All of it
evaporates on Worker cold start, and all of it passes testing.

### 5.5 Velocity is real, and so is its cost

Roughly 98% of commits go straight to `main`. Pull requests are exceptional and
self-merged without external review — one was merged two minutes after opening. The
throughput this buys is visible in the delivery record. The cost is visible too: a
2026-07-28 incident shipped a production bundle calling the wrong API endpoint, and the
guard added in response is good operational learning that a pre-merge check would have
made unnecessary.

### 5.6 The engineering foundations are genuinely sound

The subsystem code is well-structured with clean type separation. Identity, trust, and
workflow are substantively built and D1-backed. The OpenAPI-to-generated-client pipeline
is a real asset. The provider-neutral interfaces in `shared/` are a good abstraction. An
ADR practice exists even though its index did not. This is a repository with strong
bones and weak connective tissue — which is a far better position than the inverse.

---

## 6. Engineering recommendations

Ranked by risk reduction per unit of effort. All are `[RECOMMENDED]`; none were executed.

| # | Recommendation | Effort | Addresses |
|---|---|---|---|
| 1 | Merge PR #3 to add the clinic route auth guard | S | GAP-003 |
| 2 | Add typecheck and test jobs as required gates before deploy | S | GAP-004 |
| 3 | Fix or remove `AUTHORIZATION_ENGINE` — two endpoints are hard-broken | S | GAP-001 |
| 4 | Inspect live D1 schema, then reconcile the duplicate `consents` definition | M | GAP-002 |
| 5 | Wire ConsentEngine and DelegationEngine to their existing D1 tables | M | GAP-006 |
| 6 | Make an explicit, recorded decision on the dormant platform track — activate or park it, and state it at the head of the platform documents | S | GAP-005 |
| 7 | Provision or remove the `NOTIFICATIONS` binding | S | GAP-008 |
| 8 | Run the version extraction script in CI so `version.ts` cannot drift | S | GAP-016 |
| 9 | Point `security.yml` at the repository's own `.gitleaks.toml` | S | GAP-018 |
| 10 | Align Node versions between Replit and CI | S | GAP-019 |
| 11 | Add a stale-document header to `SECURITY.md` and `TASKS.md` pointing at current sources | S | GAP-013, GAP-014 |
| 12 | Adopt `docs/adr/` as the sole ADR home from ADR-019 onward | S | GAP-011 |
| 13 | Consolidate the overlapping documentation directories per the plan in `DOCUMENT_INDEX.md` | L | GAP-015 |
| 14 | Introduce frontend test coverage for the patient portal | L | GAP-010 |
| 15 | Move JWTs out of `localStorage`, or record acceptance of the risk as an ADR | M | GAP-009 |

Items 1 through 3 are each a small change against a live production risk and should be
treated as immediate.

---

## 7. Repository readiness score

Assessed across the five dimensions in the engagement brief, scored 1 (absent) to 5
(mature). "Before" reflects the repository as found on 2026-08-04; "after" reflects it
with the context layer in place.

| Dimension | Before | After | Assessment |
|---|---|---|---|
| **Multiple AI contributors** | 2.0 | 4.0 | A session can now orient from `docs/context/` in a single read rather than exploring 514 files. Authority ranking prevents acting on superseded documents. Ceiling is set by the absence of review. |
| **Parallel engineering** | 1.5 | 3.0 | `CURRENT_WORK.yaml` makes in-flight work visible and collision-avoidable. But trunk-based development at 98% direct-to-main with no review remains structurally hostile to parallel work — a process property no documentation can fix. |
| **Machine-readable onboarding** | 1.0 | 4.5 | Five validated YAML files carry state, architecture, gaps, roadmap, and current work in structured form with explicit confidence fields. This dimension moved furthest. |
| **Context publishing** | 1.5 | 3.5 | The layer is coherent, self-describing, and portable. `CONTEXT_MAINTENANCE.md` defines the update contract. It is not yet automated or CI-enforced, so it depends on discipline. |
| **Future engineering providers** | 2.5 | 3.5 | A new provider can onboard from the repository alone. Every claim is path-traceable and verifiable independently. Remaining friction is the unresolved documentation sprawl and the absence of live-environment ground truth. |
| **Overall** | **1.7** | **3.6** | |

**Interpretation.** The repository has moved from *conversation-dependent* — where
critical knowledge lived in chat histories and undocumented convention — to
*repository-sufficient*, where a short intent prompt plus `docs/context/` is enough to
begin productive work.

It is not yet *self-maintaining*. Reaching 4.5+ requires two things this engagement
could not deliver: automated quality gates in CI, and a review step before production.
Both are process changes, not documentation changes. The context layer removes the
knowledge barrier; it cannot remove the correctness barrier.

---

## 8. Remaining work

**Not done because it was out of scope** (the engagement was explicitly a foundation
project, not a remediation):

- All 20 catalogued defects remain open. They are documented, not fixed.
- The six overlapping documentation directory sets remain unconsolidated. A plan exists
  in `DOCUMENT_INDEX.md`; executing it means moving files, which the preservation
  constraint placed outside this engagement.
- Stale documents (`SECURITY.md`, `TASKS.md`, `DECISIONS.md`) were left untouched. Their
  status is recorded in the index rather than in the files themselves.

**Not done because the repository alone cannot answer it:**

- **Live D1 schema ground truth.** The `consents` conflict cannot be fully resolved
  without inspecting the deployed database. Requires `wrangler d1` access.
- **Whether dormant feature flags are off deliberately or by neglect.** This is a
  question for the team, and the answer determines whether GAP-005 is a defect or a
  parked decision.
- **Production behaviour** — traffic, error rates, whether the two broken authorization
  endpoints are actually being called. Requires Cloudflare observability access.
- **Which in-memory subsystems have already lost data** in production.

**Recommended next steps, in order:**

1. Address recommendations 1–3 above. Each is small and each closes a live risk.
2. Answer the two open questions the repository cannot: the live schema, and the
   intent behind the dormant platform track.
3. Add the CI quality gate. This is the single change that most raises the readiness
   ceiling.
4. Schedule the first context-layer reconciliation — the method is reproducible from
   `REPOSITORY_DISCOVERY_REPORT.md` — after the next wave completes.

---

## 9. Method and reproducibility

Discovery was conducted read-only via the GitHub API across nine parallel workstreams:
build tooling and CI/CD, the Worker HTTP layer, the fifteen platform subsystems, the
frontend, the D1 data layer, shared libraries, the root documentation corpus, the
`docs/` tree, and repository activity. Approximately 36,000 words of cited evidence were
produced and consolidated into `REPOSITORY_DISCOVERY_REPORT.md`.

Every claim in every deliverable traces to a repository path. Every statement is
classified `[OBSERVED]`, `[INFERRED]`, `[RECOMMENDED]`, or `[UNKNOWN]`. Nothing was
invented; where evidence was silent, the field reads `unknown` with a note on what would
resolve it. All five YAML files were validated as parseable.

The method is documented in enough detail that a future provider can reproduce it
independently and check this work rather than inherit it on trust.
