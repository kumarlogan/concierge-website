# EPIC-002-006A4C — Baseline Tag Verification Report

> **Date:** 2026-07-19 · **Repo:** `/home/ubuntu/concierge-website`

## Tag Creation

| Attribute | Value |
|---|---|
| Tag name | `baseline-002-006` |
| Tag type | Annotated (`-a`) |
| Tagged commit | `ded1c9538ee5327027a4db6a042bdce9dcc027bb` |
| HEAD at tag time | `ded1c9538ee5327027a4db6a042bdce9dcc027bb` |
| Match | ✅ Tag == HEAD (verified `rev-list -n 1` == `rev-parse HEAD`) |
| Annotation | "EPIC-002-006A baseline — repository secure, secret scanning operational, owner rotations complete" |
| Tagger | kumarlogan `<kumarlogan@users.noreply.github.com>` |

## Staged Set Integrity

| Check | Result |
|---|---|
| Files staged explicitly (no `git add -A`) | ✅ 139 files via explicit paths |
| Deprecated scripts included? | ✅ NONE (29 quarantined outside repo) |
| `node_modules` / `dist` build artifacts included? | ✅ NONE (git-ignored) |
| Secrets in staged set? | ✅ NONE (only allowlisted pattern-doc refs + redacted forensic line) |
| Application behavior changed? | ✅ NO (workers/src, migrations, wrangler.jsonc, deploy.yml unchanged) |

## Post-Tag Working Tree State

| Check | Result |
|---|---|
| Uncommitted changes after tag | ✅ 0 (clean tree) |
| Rollback capability preserved | ✅ Tag is immutable ref; `git checkout baseline-002-006` restores state |

## Rollback Instructions (validated)

```bash
# Inspect the baseline without modifying current branch
git checkout baseline-002-006

# Return to main
git checkout main

# Hard-reset main to baseline (only if intentionally reverting)
git reset --hard baseline-002-006
```

> Note: 29 quarantined scripts live in `~/archive/category-d-2026-07-19/` (outside
> the repo), so they are NOT part of the baseline and do not affect rollback.

## Verification Conclusion

**✅ Tag `baseline-002-006` is valid, points to the correct commit, includes only
intentional files, and preserves rollback capability.**
