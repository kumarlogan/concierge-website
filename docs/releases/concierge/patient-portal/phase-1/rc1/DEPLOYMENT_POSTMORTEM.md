# DEPLOYMENT POSTMORTEM — AGS-OPS-001

**Incident:** Production deployment of v1.1.0 (Patient Zero Experience)
**Date:** 2026-07-30
**Duration:** 01:31:53 UTC (first commit) — 01:44:43 UTC (final docs commit); ~13 minutes from first push to successful deployment
**Environment:** Production (CI/CD via GitHub Actions → Cloudflare Workers)
**Tag:** v1.1.0
**Authoring Agent:** Hermes (hy3)

---

## 1. Timeline

| # | Timestamp (UTC) | Commit | Run ID | Environment | Result | Duration |
|---|---|---|---|---|---|---|
| 1 | 01:31:53 | `42377bd` — v1.1.0 — Patient Zero Experience | 30505982717 | Production | **FAILURE** | 30s |
| 2 | 01:35:05 | `ade5cc1` — fixup: add missing booking-dialog.tsx | 30506055425 | Production | **FAILURE** | 36s |
| 3 | 01:36:29 | `fd03575` — fixup: add missing turnstile.ts | 30506121675 | Production | **SUCCESS** | 58s |
| 4 | 01:44:43 | `c43ca9f` — docs: add deployment deliverables | 30506505952 | Production | **SUCCESS** | N/A (docs only) |

## 2. Failure Detail

### Attempt 1 — Commit `42377bd`

**Error (excerpt from CI log):**
```
[vite:load-fallback] Could not load .../booking-dialog (imported by
src/pages/patient/AppointmentsPage.tsx): ENOENT: no such file or directory
```

**Root cause:** The file `artifacts/ags-fertility/src/components/patient/booking-dialog.tsx` existed on the local development machine (created by Hermes) but was **never staged with `git add`** before the commit. The commit `42377bd` records 40 files changed — `booking-dialog.tsx` is not among them. CI fetches a clean checkout from GitHub, so the file was absent at build time. Vite failed while resolving the import from `AppointmentsPage.tsx`.

**Failure class:** Untracked file (process failure).

### Attempt 2 — Commit `ade5cc1`

**Fixup applied:** The file `booking-dialog.tsx` was `git add`ed and committed. This commit pushed only that file (+247 lines).

**Error (excerpt from CI log):**
```
[ERROR] Could not resolve "../middleware/turnstile.js"
    src/routes/consultations.ts:25:32:
        import { verifyTurnstile } from "../middleware/turnstile.js";
```

**Root cause:** The file `workers/src/middleware/turnstile.ts` existed on the local development machine but was **never staged with `git add`** before either commit. The API worker build (`wrangler deploy --env production` in `workers/`) failed because `consultations.ts` imports `verifyTurnstile` from `../middleware/turnstile.js`. The frontend build succeeded (all frontend imports resolved), but the API worker independently failed.

**Failure class:** Untracked file (process failure — same root cause, different file).

## 3. Why Attempt 3 Succeeded

Commit `fd03575` tracked `turnstile.ts` (+69 lines). With both missing files now committed:

- **Frontend build:** Passed — `booking-dialog.tsx` was available.
- **Guard step:** Passed — production bundle contained `api.agsynergy.ca` and no dev endpoints.
- **JWT injection:** Passed — all JWT secrets available from GitHub Secrets.
- **API worker build:** Passed — `turnstile.ts` was available.
- **API worker deploy:** Succeeded — `agsynergy-api` deployed to `api.agsynergy.ca`.
- **Frontend worker deploy:** Succeeded — `hermes-website` deployed to `agsynergy.ca`.

No other failures occurred. The infrastructure, secrets, and configuration were correct from the start.

## 4. Failure Classification

| Failure | Category | Details |
|---|---|---|
| Missing `booking-dialog.tsx` | **Process failure** | File existed on disk, was never `git add`ed, was referenced by committed code |
| Missing `turnstile.ts` | **Process failure** | Same pattern — file existed on disk, was never `git add`ed, was referenced by committed code |
| `r2_buckets` not in `env.production` | **Configuration issue** (latent, non-fatal) | Wrangler warning — `r2_buckets` defined at top level but not under `env.production`; won't be available in production API worker |

## 5. Contributing Factors

1. **No pre-commit `git status` check** — The deployment workflow has no step that verifies all referenced files are tracked.
2. **No file-inventory validation** — No manifest or dependency tree check that every imported module exists in the repository.
3. **Manual `git add` process** — The agent committed via `git add .` or selective `git add` but missed files that were created as part of the same feature work.
4. **No deployment dry-run** — The pipeline runs directly; there is no "preview" or "validate" mode that checks for missing files before pushing to production.
5. **CI/CD is the only gate** — The pipeline is the first and only line of defense; there is no local pre-flight check.

## 6. Corrective Actions Taken

- Both missing files were committed in separate fixup commits.
- The deployment succeeded and v1.1.0 is live.
- A deployment readiness gate checklist is now documented.

## 7. Recommendations

See the companion documents:
- `DEPLOYMENT_ROOT_CAUSE_ANALYSIS.md` — root cause for each failure
- `DEPLOYMENT_PREVENTION_PLAN.md` — permanent preventive solutions
- `DEPLOYMENT_READINESS_GATE.md` — pre-deployment checklist

---

**Document version:** 1.0
**Classification:** AGS-OPS-001