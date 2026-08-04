# Proposed GitHub Actions workflows

Workflow files staged here for a human to install into `.github/workflows/`.

## Why these are not already installed

The external engineering integration that authored them does not hold the
GitHub App `workflows` permission, so it cannot create or modify files under
`.github/workflows/`. Every other path in the repository is writable; that one
directory returns `403 Resource not accessible by integration`.

Rather than drop the work, the workflow is committed here so the repository
keeps the knowledge. Installing it is a one-line move.

## ci.yml — test and typecheck gate

**Addresses:** PRG-002 / GAP-004 — the highest-leverage single change available
in this repository.

Today `deploy.yml` fires on every push to `main` and deploys both Cloudflare
Workers to production with no test run and no typecheck. The only thing between
a broken commit and `agsynergy.ca` is the author.

`ci.yml` runs on pull requests and non-main branches. It deploys nothing.

| Job | Behaviour |
|---|---|
| `test` | Runs the worker suite. **Blocking** — a failing test fails the check. |
| `typecheck` | Runs `tsc` against a **ratchet**: the error count may fall, never rise. |

### Why a ratchet rather than a plain gate

The repository carries a documented baseline of pre-existing TypeScript errors
(EPIC-015). A strict `tsc` gate would fail on its first run and would then be
disabled or bypassed — which is precisely how the baseline accumulated. The
ratchet lets the gate land immediately while still blocking any *new* error.

Note also that the workers package is not covered by the root `pnpm run
typecheck` script, so the API worker has never been typechecked in CI at all.
`ci.yml` adds that coverage.

### To install

```bash
git mv docs/engineering/proposed-workflows/ci.yml .github/workflows/ci.yml
git commit -m "ci: add test and typecheck gate (PRG-002)"
```

### After the first run

The baselines in `ci.yml` (`TYPECHECK_BASELINE_WORKERS`,
`TYPECHECK_BASELINE_REPO`) are deliberately loose so the gate can land without
a remediation project first. The first run prints the **actual** error count in
the job log. Tighten both numbers to those actuals immediately, then keep
tightening as the debt is paid down. A baseline left loose is a gate that does
not gate.

### Recommended follow-up

Once green, mark `test` and `typecheck` as **required status checks** on `main`
in branch protection. Without that, the gate advises rather than enforces.
