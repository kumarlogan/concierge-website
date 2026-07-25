# PHASE 2 — REPOSITORY RECONCILIATION REPORT
## Hermes Platform v1.0

| Category | Count | Disposition |
|----------|-------|-------------|
| **KEEP — Commit to baseline** | 3 files | git add, part of v1.0 baseline |
| **DEFER — Experimental / Deferred** | ~152 files | Leave untracked, gitignore candidate |
| **DELETE — Temp session artifacts** | 5 files | rm |
| **TOTAL UNTRACKED** | ~160 | |

---

## MODIFIED FILES (2)

| File | Status | Classification | Action |
|------|--------|---------------|--------|
| `hermes/services/workforce/orchestration.ts` | Modified (unstaged) | **KEEP** — intentional persistence hooks from EPIC-003-005 Phase 5/6 | Stage for v1.0 baseline |
| `workers/vitest.config.ts` | Modified (unstaged) | **KEEP** — intentional test exclude patterns from stabilization | Stage for v1.0 baseline |

---

## UNTRACKED FILES

### KEEP — Commit to Baseline (3 files)

| File | Reason |
|------|--------|
| `hermes/permissions/package.json` | Package resolution fix (`@hermes/permissions` exports mapping) — needed for test isolation |
| `hermes/services/activation/package.json` | Package resolution fix (`@hermes/services/activation` exports mapping) — needed for test isolation |
| `workers/migrations/0005_workforce_persistence.sql` | D1 migration for workforce persistence schema — needed for production readiness |

These files are **stabilization deliverables** that fix real test failures and provide necessary production infrastructure. They belong in the v1.0 baseline.

### DEFER — Leave Untracked (~105 files)

These are experimental subsystems, architecture design proposals, operations session reports, and deferred code that should NOT be committed as part of the v1.0 baseline. They're valid work product but belong to future EPICs.

**Provider Subsystem (Experimental) — ~20 files:**
`hermes/services/providers/discovery.ts`, `executor.ts`, `loader.ts`, `manager.ts`, `marketplace-view.ts`, `marketplace.ts`, `package.ts`, `platform.ts`, `runtime/marketplace-security.ts`, `transport-health.ts`, `transport/`, `claude-code/`, `trust/checksum/VALIDATION_REPORT.md`, `trust/webhooks/`, `__tests__/epic-*.test.ts`, `dynamic.test.ts`

→ Deferred to Provider Marketplace EPIC

**Activation Provider Subsystem (Experimental) — ~8 files:**
`hermes/services/activation/providers/bootstrap.ts`, `cloudflare/`, `deployment/`, `github/`, `secret-source.ts`, `website.ts`, `__tests__/`

→ Deferred to AGS Activation EPIC

**Workforce Persistence Subsystem (Experimental) — ~8 files:**
`hermes/services/workforce/activation-workflow.ts`, `d1-backend.ts`, `d1-backend.test.ts`, `observability.ts`, `persistence.ts`, `repository.ts`, `workflow-repository.ts`, `workflow-store.ts`, `workforce-metrics.ts`

→ Deferred to Production Workflow Persistence EPIC

**Architecture Design Proposals — ~34 files:**
`docs/architecture/CAPABILITY_MODEL.md` through `docs/architecture/PROVIDER_VIOLATION_MODEL.md` + `review/`

→ Deferred — design documents for future implementation

**Operations Session Reports — ~54 files:**
`docs/operations/AGS_*`, `docs/operations/EPIC-*`, `docs/operations/HERMES_V1_*`, `docs/operations/TECHNICAL_DEBT_INVENTORY.md`, etc.

→ Deferred — completion reports and session artifacts. Living docs already exist at root level.

**Root-level Session Summaries — 4 files:**
`ACTIVATION_WORKFLOW_SUMMARY.md`, `EPIC-010_DEPLOY_GOVERNANCE.md`, `EPIC-010_PREVIEW.md`, `HERMES_CORE_NIGHT_PROMPT.md`, `WORKFORCE_OBSERVABILITY_SUMMARY.md`

→ Deferred — one-shot session outputs

**Config Files (Per-EPIC / Unused) — 5 files:**
`hermes/tsconfig.epic005.json`, `hermes/tsconfig.epic007.json`, `hermes/tsconfig.epic008.json`, `hermes/tsconfig.json`, `hermes/vitest.config.js`

→ Deferred — per-epic configs; baseline config is sufficient

**Other Deferred — ~5 items:**
`artifacts/ags-fertility/typography-exploration.html` — Design exploration
`hermes-website/` — Nested working directory (session artifact)
`hermes/docs/operations/` — Duplicate operations docs in hermes/ space
`hermes/services/application/types.ts` — Stub, no consumers
`workers/tests/workforce-activation.test.ts` — Needs Node-native runner
`workers/tests/workforce-persistence.test.ts` — Needs Node-native runner
`workers/tests-epic0059/` — Test files for EPIC-005.9 (deferred)
`vitest.config.ts` (root) — vitest not in root deps

### DELETE — Temp Session Artifacts (5 files)

| File | Reason |
|------|--------|
| `recovery-step-2-report.md` | Temporary recovery session output |
| `run-documentation-agent-dry-run.ts` | One-shot temp script for doc agent test |
| `test-activation-workflow.sh` | Temporary test script |
| `test-workforce-observability.sh` | Temporary test script |
| `test-workforce-persistence.sh` | Temporary test script |

---

## SUMMARY

| Action | Count |
|--------|-------|
| KEEP (stage for baseline) | 3 files + 2 modified |
| DEFER (leave untracked) | ~152 files |
| DELETE (temp artifacts) | 5 files |
| **Total reconciled** | **160 untracked + 2 modified** |