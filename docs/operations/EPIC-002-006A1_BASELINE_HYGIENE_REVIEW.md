# EPIC-002-006A.1 — Baseline Hygiene Review

> **Objective:** Prepare a clean, trustworthy baseline before `git tag baseline-002-006`.
> **Mode:** REVIEW ONLY. No commits, stashes, code/migration/Cloudflare changes, or deploys.
> **Date:** 2026-07-19 · **Repo:** `/home/ubuntu/hermes-website`
> **Current commit:** `8f836548985d4803abb290172a5adcbdcb07bd5b` (branch `main`)

> ⚠️ **Tag NOT created** (per task rules). This review only classifies and recommends.

---

## 1. Working-Tree Inventory (complete)

`git status` shows: **18 modified tracked files**, **3 deleted tracked files**, and a large set of **untracked files** (docs/, Python scripts, root Markdown, new frontend assets, the `docs/operations/*` reports written by this planning effort).

### 1.1 Modified tracked files

| # | Path | Change summary | Category | Ownership | Recommendation |
|---|---|---|---|---|---|
| 1 | `artifacts/ags-fertility/src/components/forms/ConsultationForm.tsx` | Reworked form: dropped partnerName/province/howDidYouHear/consent fields; renamed `treatmentInterest`→`treatment_interest` (free-text); added 400/409/5xx error UI | A | application | **commit** (intentional form change) |
| 2 | `artifacts/ags-fertility/src/main.tsx` | Added `setBaseUrl()` to point API client at Worker URL | A | application | **commit** (intentional) |
| 3 | `artifacts/ags-fertility/src/pages/AboutPage.tsx` | Major rewrite: new hero/timeline/mission/values sections, imports `BirthdayOverlay` | A | application | **commit** (intentional) |
| 4 | `lib/api-client-react/src/generated/api.schemas.ts` | Regenerated Zod schemas (field renames) | C | generated | **commit** (regenerated, matches #1) |
| 5 | `lib/api-client-react/src/generated/api.ts` | Regenerated client | C | generated | **commit** |
| 6 | `lib/api-client-react/src/index.ts` | Re-exports `ApiError` | A/C | shared | **commit** (supports #1 error UI) |
| 7 | `lib/api-spec/openapi.yaml` | Regenerated OpenAPI spec (field changes) | C | generated | **commit** |
| 8 | `lib/api-spec/orval.config.ts` | 1-line config tweak | C | generated | **commit** |
| 9 | `lib/api-zod/src/generated/api.ts` | Regenerated Zod types | C | generated | **commit** |
| 10 | `lib/api-zod/src/generated/types/consultationCount.ts` | Regenerated | C | generated | **commit** |
| 11 | `lib/api-zod/src/generated/types/consultationInput.ts` | Regenerated (renamed fields) | C | generated | **commit** |
| 12 | `lib/api-zod/src/generated/types/healthStatus.ts` | Regenerated | C | generated | **commit** |
| 13 | `lib/api-zod/src/generated/types/index.ts` | Regenerated index | C | generated | **commit** |
| 14 | `pnpm-lock.yaml` | +1705 lines (dep lock changes) | C | generated | **commit** (if #15 workspace change is committed) |
| 15 | `pnpm-workspace.yaml` | +1 line (workspace pkg add) | A | application/shared | **commit** (intentional) |

### 1.2 Deleted tracked files

| # | Path | Change summary | Category | Ownership | Recommendation |
|---|---|---|---|---|---|
| 16 | `lib/api-zod/.../consultationInputTreatmentInterest.ts` | Removed (enum dropped in #1) | C | generated | **commit** (matches #1) |
| 17 | `lib/api-zod/.../consultationInputTreatmentInterest.ts` ⚠️dup-entry | (see #16) | C | generated | **commit** |
| 18 | `lib/api-zod/.../errorResponse.ts` | Removed (replaced by `ApiError`) | C | generated | **commit** |

> Note: `git status` listed `consultationInputTreatmentInterest.ts` under both `D` and the untracked side as a rename target `consultationError.ts`/`consultationSuccess.ts` (see 2.x). The deletions are **generated artifacts** removed as part of the form/spec regeneration — safe to commit with the regenerated set.

### 1.3 Untracked — documentation tree (`docs/`)

| Path (sample; full list in Appendix) | Category | Ownership | Recommendation |
|---|---|---|---|
| `docs/decisions/ADR-001..007` (7 ADRs) | B | organization | **commit** (governance baseline) |
| `docs/operations/*` (13 files incl. this review + EPIC-002-006* reports) | B | organization | **commit** (planning artifacts) |
| `docs/organization/*` (18 files: architecture, registry, provider abstractions, etc.) | B | organization | **commit** |
| `docs/architecture/`, `docs/database/`, `docs/security/`, `docs/sprints/`, `docs/api/` | B | organization | **commit** |

> `docs/operations/EPIC-002-006A_BASELINE_REPORT.md`, `...READINESS_REPORT.md`,
> `...EPIC-002-006_HERMES_PLATFORM_EVOLUTION.md`, and this file
> (`EPIC-002-006A1_BASELINE_HYGIENE_REVIEW.md`) were produced by the planning
> effort and are **Category B, commit**.

### 1.4 Untracked — root Markdown docs

| # | Path | Category | Ownership | Recommendation |
|---|---|---|---|---|
| 19 | `AI_OPERATING_MODEL.md` | B | organization | **commit** |
| 20 | `API.md` | B | organization | **commit** |
| 21 | `ARCHITECTURE.md` | B | organization | **commit** (or merge into `docs/architecture`) |
| 22 | `CHANGELOG.md` | B | organization | **commit** |
| 23 | `CURRENT_SPRINT.md` | B | organization | **commit** |
| 24 | `DATABASE.md` | B | organization | **commit** (or merge into `docs/database`) |
| 25 | `DECISIONS.md` | B | organization | **commit** (index of ADRs) |
| 26 | `PRODUCT_BOUNDARIES.md` | B | organization | **commit** |
| 27 | `PROJECT.md` | B | organization | **commit** |
| 28 | `README.md` | B | organization | **commit** |
| 29 | `ROADMAP.md` | B | organization | **commit** |
| 30 | `SECURITY.md` | B | organization | **commit** |
| 31 | `STYLEGUIDE.md` | B | organization | **commit** |
| 32 | `TASKS.md` | B | organization | **commit** |

### 1.5 Untracked — deploy/utility Python & shell scripts (root)

| # | Path | Lines | Category | Ownership | Recommendation |
|---|---|---|---|---|---|
| 33 | `check_deploy.py` | 53 | D | unknown | **investigate** |
| 34 | `check_project.py` | 52 | D | unknown | **investigate** |
| 35 | `check_run3.py` | 34 | D | unknown | **investigate** |
| 36 | `check_token.py` | 35 | D | unknown | **investigate** |
| 37 | `check_worker_status.py` | 69 | D | unknown | **investigate** |
| 38 | `check_workflow.py` | 22 | D | unknown | **investigate** |
| 39 | `check_workflow_jobs.py` | 40 | D | unknown | **investigate** |
| 40 | `debug_upload_response.py` | 74 | D | unknown | **investigate** |
| 41 | `deploy.sh` | 23 | D | unknown | **investigate** |
| 42 | `deploy_assets.py` | 141 | D | unknown | **investigate** |
| 43 | `deploy_final.py` | 210 | D | unknown | **investigate** |
| 44 | `deploy_pages.py` | 86 | D | unknown | **investigate** |
| 45 | `deploy_pages2.py` | 116 | D | unknown | **investigate** |
| 46 | `deploy_redeploy.py` | 126 | D | unknown | **investigate** |
| 47 | `deploy_v2.py` | 121 | D | unknown | **investigate** |
| 48 | `deploy_worker.py` | 114 | D | unknown | **investigate** |
| 49 | `fetch_deploy_logs.py` | 62 | D | unknown | **investigate** |
| 50 | `fetch_workflow_logs.py` | 26 | D | unknown | **investigate** |
| 51 | `pipeline.sh` | 19 | D | unknown | **investigate** (note: prior context referenced `pipeline.sh` as the deploy trigger — verify it matches) |
| 52 | `poll_workflow.py` | 66 | D | unknown | **investigate** |
| 53 | `recreate_project.py` | 164 | D | unknown | **investigate** |
| 54 | `run_deploy.py` | 36 | D | unknown | **investigate** |
| 55 | `setup_github_secret.py` | 60 | D | unknown | **investigate** |
| 56 | `test_one_file.py` | 58 | D | unknown | **investigate** |
| 57 | `test_upload.py` | 83 | D | unknown | **investigate** |
| 58 | `test_upload_methods.py` | 80 | D | unknown | **investigate** |
| 59 | `upload_assets.py` | 172 | D | unknown | **investigate** |
| 60 | `upload_assets2.py` | 139 | D | unknown | **investigate** |
| 61 | `upload_assets3.py` | 137 | D | unknown | **investigate** |

### 1.6 Untracked — frontend assets & component

| # | Path | Category | Ownership | Recommendation |
|---|---|---|---|---|
| 62 | `artifacts/ags-fertility/src/components/BirthdayOverlay.tsx` | A | application | **commit** (referenced by #3) |
| 63 | `artifacts/ags-fertility/public/images/couple-portrait.jpg` | A | application | **commit** (referenced by #3 AboutPage) |
| 64 | `lib/api-zod/src/generated/types/consultationError.ts` | C | generated | **commit** (rename of errorResponse) |
| 65 | `lib/api-zod/src/generated/types/consultationSuccess.ts` | C | generated | **commit** (new generated type) |

---

## 2. Category Summary

| Category | Count | Description |
|---|---|---|
| **A — Required for AGS Fertility baseline** | 7 | Intentional app changes (form, About, main, BirthdayOverlay, image, api-client index, workspace yaml) |
| **B — Hermes/organization planning artifact** | ~45 | `docs/` tree + 14 root Markdown + `AI_OPERATING_MODEL.md` + `API.md` + EPIC-002-006* reports |
| **C — Generated artifact** | ~17 | Regenerated OpenAPI/Zod/client schemas, lockfile, new generated types |
| **D — Unknown requiring review** | 29 | Untracked Python deploy/check/upload scripts + `pipeline.sh` — provenance unclear |

**Total untracked files/dirs:** ~74 entries (docs/ subtree counts as many files).

---

## 3. Recommended Cleanup Plan (for human execution — NOT performed)

### Step 1 — Commit Category A (application baseline)
Stage and commit the 7 application files + `pnpm-workspace.yaml` as:
`chore(app): AGS Fertility form/About updates + API client base-url`
This preserves the real, intentional product state in the baseline.

### Step 2 — Commit Category C (generated, consistent with A)
Stage and commit all regenerated `lib/api-zod`, `lib/api-client-react`,
`lib/api-spec`, `pnpm-lock.yaml`, and new/removed generated types as:
`chore(gen): regenerate API client from updated consultation schema`
(Lockfile committed only if Step 1's workspace change is included.)

### Step 3 — Commit Category B (organization/planning)
Move root Markdown docs into `docs/` where a home exists (e.g. `ARCHITECTURE.md`
→ `docs/architecture/`, `DATABASE.md` → `docs/database/`, `DECISIONS.md` →
`docs/decisions/`) **or** add a `.gitignore`/README note if root docs are
intentional. Then commit the entire `docs/` tree + remaining root docs as:
`docs(org): add architecture decisions, operating model, and Hermes planning`
Includes the EPIC-002-006* and this hygiene review.

### Step 4 — Triage Category D (DO NOT commit blindly)
These 29 scripts are **unreviewed**. Recommended handling:
- **Investigate** each: determine if it touches secrets, deploys, or modifies
  infrastructure. The names suggest ad-hoc Cloudflare/GitHub deploy helpers and
  asset-upload experiments.
- **If proven safe & useful:** relocate into `scripts/` (or `tools/`) with a
  README, then commit separately: `chore(tools): add deploy/util scripts`.
- **If redundant/experimental:** add to `.gitignore` (so they stay local) **or**
  delete after human confirmation — but per task rules, **do not discard now**.
- **Critical:** verify none of these scripts contain hardcoded tokens/secrets
  before any commit. If any secret is found, rotate it and scrub from disk.

### Step 5 — Create the tag (human action, post-cleanup)
After Steps 1–4 land on `main` as clean commits:
```
git tag baseline-002-006 <new-clean-sha>
git push origin baseline-002-006
```
Then proceed to EPIC-002-006 Phase 1.

---

## 4. Readiness Impact

| Gate | Status |
|---|---|
| Tests green (141/141) | ✅ (unchanged) |
| Dirty tree resolved | ⚠️ **Blocked by Category D triage** |
| Clean commit for A | ⏳ pending Step 1 |
| Clean commit for C | ⏳ pending Step 2 |
| Clean commit for B | ⏳ pending Step 3 |
| Category D reviewed | ⏳ pending Step 4 (investigate) |

**Verdict:** Baseline is **not yet taggable** because (a) intentional app/gen/doc
changes are uncommitted, and (b) 29 unknown scripts need review before the tree
can be considered trustworthy. None of the changes alter the auth/RBAC baseline
(verified: no `workers/src/auth/*` or migration files are modified), so the
**security baseline itself is intact** — only repo hygiene blocks the tag.

---

## Appendix — Full untracked `docs/` file list
```
docs/api/README.md
docs/architecture/README.md
docs/database/DATABASE_DESIGN.md
docs/database/MIGRATION_STRATEGY.md
docs/database/RBAC_DESIGN.md
docs/database/README.md
docs/decisions/ADR-001..007 (7 files) + README.md
docs/operations/ (13 files: AI_SESSION_MANAGEMENT, DEPLOYMENT, EPIC-002-006*, PROJECT_STATUS, SESSION_HANDOFF, TESTING, README)
docs/organization/ (18 files: AI_REGISTRY_V2, AI_WORKFORCE, DEPENDENCY_*, DISCOVERY_MODEL, ENVIRONMENT_MODEL, HERMES_PLATFORM, IDENTITY_MODEL, INFRASTRUCTURE_INVENTORY, LIFECYCLE_MODEL, MIGRATION_STRATEGY, ORGANIZATION_*, PLATFORM_SERVICES, PROVIDER_ABSTRACTIONS, REPOSITORY_STRUCTURE, RESOURCE_REGISTRY, README)
docs/security/README.md
docs/sprints/ (EPIC-002-PLANNING, README, epic-001-retrospective)
```

*Review only. No commits, stashes, code, migrations, Cloudflare, secrets, or deploys performed. Tag not created.*
