# EPIC-008.1 — Working Tree Assessment (Phase 4)

**Date:** 2026-07-21 · **Mode:** read-only assessment, NO deletions/commits performed.

## Current Tree State

```
git status --short | sed 's/ .*//' | sort | uniq -c
   20   M   (modified, tracked)
  133   ??  (untracked)
    1   A   (added, staged)
    2   AM  (added then modified)
```

Total: **155 changed/untracked paths**. This predates EPIC-008.1 — it is the
in-progress EPIC-008 (Foundation consolidation) working tree, not something
introduced by this session.

## My EPIC-008.1 Footprint (8 files, all untracked `??`)

| File | Role | Status |
|------|------|--------|
| `hermes/services/activation/providers/deployment/backends/cloudflare-exec.ts` | B1 token | edited |
| `hermes/services/activation/providers/deployment/guardrails.ts` | B1 secret default | edited |
| `hermes/services/activation/providers/deployment/workflow.ts` | D1 fix | edited |
| `hermes/services/activation/providers/bootstrap.ts` | Phase 3 wire | edited |
| `hermes/services/activation/providers/deployment/stage-deploy.ts` | D1 wrapper | new |
| `hermes/services/activation/providers/deployment/__tests__/epic007.launch.test.ts` | G6b/G8 | edited |
| `hermes/tsconfig.epic008.json` | typecheck cfg | new |
| `docs/architecture/EPIC-008.1_BASELINE.md` | baseline doc | new |

All 8 are internally consistent and pass the full local validation harness
(128 assertions, 0 failures; production typecheck clean).

## Cleanup Recommendation (advisory — not executed)

1. **Do NOT bulk-commit the 155-file tree.** It mixes EPIC-008.1 (mine), other
   EPIC-008 foundation work (untracked), and 20 tracked modifications of
   unrelated modules (`audit/`, `services/security`, `admin/console`, etc.).
   A single `git add -A && commit` would silently bundle unreviewed changes.
2. **Stage EPIC-008.1 scope explicitly** when the user approves:
   ```
   git add hermes/services/activation/providers/deployment/backends/cloudflare-exec.ts \
           hermes/services/activation/providers/deployment/guardrails.ts \
           hermes/services/activation/providers/deployment/workflow.ts \
           hermes/services/activation/providers/bootstrap.ts \
           hermes/services/activation/providers/deployment/stage-deploy.ts \
           hermes/services/activation/providers/deployment/__tests__/epic007.launch.test.ts \
           hermes/tsconfig.epic008.json \
           docs/architecture/EPIC-008.1_BASELINE.md
   ```
3. **Leave the other 147 paths for their respective EPIC owners** to commit
   under their own milestone PRs. Flag the 20 tracked-modified files to the
   user — they are pre-existing and outside EPIC-008.1; confirm before any
   commit touches them.
4. **`hermes/tsconfig.epic008.json`** is a validation-only artifact. Recommend
   keeping it (cheap, scoped CI gate) or folding its `include` into a broader
   `tsconfig` once `@cloudflare/workers-types` + `@hermes/*` aliases are added
   repo-wide.

## Blockers / Flags

- ⚠️ **Dirty tree (155 paths).** Per EPIC rules, no commit/stash/deploy performed.
  Awaiting user decision on how to stage the EPIC-008.1 subset.
- ℹ️ **Pre-existing type quirks** in `ags.deployment.ts` / `epic007.launch.test.ts`
  (strict-mode only; pass at runtime). Two (G6b, G8) corrected to match the new
  canonical contract; the rest are out of EPIC-008.1 scope and documented in the
  baseline.
- ℹ️ **External deps** `@cloudflare/workers-types`, `@hermes/identity/types.js`
  unresolved under the EPIC-008.1 config — expected, since `audit/` is excluded
  from this scope.
