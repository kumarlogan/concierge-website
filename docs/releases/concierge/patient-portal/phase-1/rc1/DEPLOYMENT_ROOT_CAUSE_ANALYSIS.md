# DEPLOYMENT ROOT CAUSE ANALYSIS — AGS-OPS-001

**Incident:** v1.1.0 Production Deployment — 3 attempts, 2 failures
**Date:** 2026-07-30

---

## Root Cause Summary

Both failures share **a single root cause**: files that existed on the local development filesystem and were referenced by committed source code were **never tracked by Git** (untracked files). The CI/CD pipeline fetched a clean checkout from GitHub, where those files did not exist, causing build failures at two different stages.

---

## Root Cause Tree

```
v1.1.0 Deployment Failure
├── Failure 1: Frontend build fails (Attempt 1, commit 42377bd)
│   └── Root cause: booking-dialog.tsx is untracked
│       ├── Created during feature work (Patient Zero Experience)
│       ├── Imported by AppointmentsPage.tsx (committed)
│       ├── NOT staged with `git add` before commit
│       ├── NOT in the 40 files recorded in commit 42377bd
│       └── CI checkout from GitHub → file absent → Vite ENOENT
│
├── Failure 2: API worker build fails (Attempt 2, commit ade5cc1)
│   └── Root cause: turnstile.ts is untracked
│       ├── Created during feature work (Turnstile middleware)
│       ├── Imported by consultations.ts (committed)
│       ├── NOT staged with `git add` before commit
│       ├── NOT in either commit 42377bd or ade5cc1
│       └── CI checkout from GitHub → file absent → Wrangler ENOENT
│
└── Latent Issue: r2_buckets not configured for env.production
    └── Root cause: wrangler.jsonc defines r2_buckets at top level
        but NOT under env.production. Wrangler does not inherit
        bindings across environments. Currently non-fatal warning
        but will cause DOCUMENT_STORAGE to be unavailable in
        production API worker.
```

---

## Why These Files Were Untracked

The Hermes agent created new files as part of the Patient Zero Experience feature implementation:

1. `booking-dialog.tsx` — A new component created for the appointment booking flow. It was wired into `AppointmentsPage.tsx` via an import statement. The file was created on disk but the `git add` command used to stage changes did not include it.

2. `turnstile.ts` — A new middleware file for Cloudflare Turnstile CAPTCHA validation. It was imported by `consultations.ts`. Same pattern: created on disk, never staged.

The agent committed using `git add <specific-files>` or `git add .` from a directory that didn't include these new files, or the files were created after the staging command was issued.

---

## Why the Same Root Cause Hit Two Separate Builds

The two untracked files affected different build stages:

| File | Build Stage | Build System | Error |
|---|---|---|---|
| `booking-dialog.tsx` | Frontend (Vite) | `pnpm --filter @workspace/ags-fertility run build` | `[vite:load-fallback] Could not load .../booking-dialog` |
| `turnstile.ts` | API Worker (Wrangler) | `wrangler deploy --env production` | `Could not resolve "../middleware/turnstile.js"` |

The fixup for `booking-dialog.tsx` (commit `ade5cc1`) only fixed the frontend build. The API worker had its own dependency (`turnstile.ts`) that was still untracked, requiring a second fixup commit.

---

## Root Cause Classification

| Criterion | Assessment |
|---|---|
| **Primary** | Process failure — no pre-commit file-status verification |
| **Secondary** | Documentation gap — no deployment readiness checklist |
| **Tooling** | Not a tooling failure — Git, Vite, Wrangler, and CI all behaved correctly |
| **Configuration** | Not a configuration failure — secrets, env vars, workflow were correct |
| **Human process** | Yes — files were created but not staged; no verification step caught it |

---

## If This Root Cause Is Not Fixed

The same pattern will recur on every future deployment where:
1. New files are created by an agent or developer
2. Those files are imported by existing committed code
3. No pre-commit verification confirms all imports resolve to tracked files

---

**Document version:** 1.0
**Classification:** AGS-OPS-001 / RCA