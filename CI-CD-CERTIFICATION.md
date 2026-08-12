# CI/CD Certification — AG Synergy Concierge

> **CI/CD STATUS: CERTIFIED**
>
> The production application/deployment path is certified, and the required
> governance control (branch protection) has been applied and verified.
> No blocking governance condition remains.
>
> **Certification date:** 2026-08-12
> **Scope:** GitHub Actions CI/CD governance, documentation, and certification
> closure for the AG Synergy Concierge platform.

---

## Executive Result

**CI/CD STATUS: CERTIFIED**

The recurring CI/CD failures that previously required repeated manual repair
have been resolved at their systemic root causes. All validation gates pass on
the certified production path, both Cloudflare Workers deploy successfully,
production health is verified, repeatability is confirmed on both the push and
`workflow_dispatch` paths, and branch protection on `main` is now enforced.

---

## Scope

Exactly what is certified in this closure pass:

- CI/CD contract and workflow inventory documentation
- Branch-protection configuration on `main`
- Final certification documentation
- Verification that the documented state matches the actual repository state

No application code, patient functionality, database architecture, workflow
redesign, dependency upgrade, or new CI/security tooling was introduced in this
closure pass.

---

## Root Causes

Three confirmed recurring causes were identified and fixed in the stabilization
phase that this closure pass documents and locks in:

1. **Committed synthetic private-key fixture triggering Gitleaks**
   Commit `97cfa70` added `workers/tests/.phase-l-attack-keys.json` containing
   an RS256 private key. No test read it. Gitleaks' `private-key` rule flagged
   it on every run, so the Secret Scan kept failing.

2. **CI tests depending on a local-only `.dev.vars`**
   The Phase L/M security-attack tests read `env.JWT_PRIVATE_KEY` from an
   untracked `workers/.dev.vars`. CI has no `.dev.vars`, so the value was
   `undefined` and the tests crashed in `beforeAll`.

3. **Cross-workflow `needs` causing a deployment workflow parse failure and
   bypassing main-branch CI**
   `deploy.yml` declared `deploy.needs: [ci, security]`. GitHub Actions `needs`
   can only reference jobs in the *same* workflow file; `ci` and `security` are
   separate files. Every deploy run was rejected as a workflow-file parse error,
   and because `ci.yml` skipped `main`, the deploy path ran no validation gate
   at all.

---

## Remediation

| Root cause | Fix |
|-----------|-----|
| Committed synthetic private key | Removed `workers/tests/.phase-l-attack-keys.json` from source control. |
| Tests depending on local `.dev.vars` | `workers/vitest.config.ts` now generates a fresh synthetic RS256 keypair at pool load and injects it via Miniflare bindings, so tests sign and the worker verifies identically in CI and local. 887/887 tests pass with `.dev.vars` absent. |
| Cross-workflow `needs` | Rebuilt `deploy.yml` as a self-contained, self-gating authoritative pipeline: `test`, `typecheck`, `secret-scan` jobs, with `deploy` requiring all three. `security.yml` scoped to PR-only. |
| Gitleaks determinism | Corrected allowlist escapes in `.gitleaks.toml`; added `.gitleaksignore` acknowledging the historical synthetic key by fingerprint. Full-history gitleaks scan (244 commits) passes clean. |

---

## Current Workflow Architecture

```
                 AG SYNERGY CI/CD
                        |
              +---------+---------+
              |                   |
             PR                  main
              |                   |
        +-----+-----+             |
        |           |             |
       CI       Security          |
        |           |             |
        +-----+-----+             |
              |                   |
            MERGE <---------------+
              |
      deploy.yml
              |
    +---------+---------+
    |         |         |
  tests   typecheck  secret-scan
    |         |         |
    +---------+---------+
              |
            PASS
              |
           DEPLOY
              |
          Cloudflare
              |
           HEALTHY
```

### Workflow inventory

| Workflow | Responsibility | Trigger | Production deploy |
|----------|---------------|---------|-------------------|
| `ci.yml` | Tests + typecheck ratchet | PR / non-main push | No |
| `deploy.yml` | Test + typecheck + secret scan + deploy | Approved production path (push to main / `workflow_dispatch`) | **Yes** |
| `security.yml` | PR Gitleaks gate | Pull request | No |
| `secure-access.yml` | Cloudflare Access setup (governance/ops) | `workflow_dispatch` | No |
| `migrate-d1.yml` | D1 migration operations | `workflow_dispatch` | No |
| `phase-l-prod-replay.yml` | Phase L production replay | `workflow_dispatch` | No |
| `phase-m-prod-replay.yml` | Phase M production replay | `workflow_dispatch` | No |
| `phase-m-edge-config.yml` | Phase M edge configuration | `workflow_dispatch` | No |

This table was verified against the actual `.github/workflows/*.yml` files at
certification time.

---

## Deployment Contract

`deploy.yml` is the **authoritative production deployment path**. It contains
its own gates and does not depend on jobs defined in separate workflow files.

```
No passing test gate        → NO DEPLOY
No passing typecheck        → NO DEPLOY
No passing secret scan      → NO DEPLOY
All gates PASS              → DEPLOY
```

The `deploy` job requires `test`, `typecheck` and `secret-scan` to all succeed
within `deploy.yml` itself. There is no independent path by which production
deployment can bypass these checks. This explicitly preserves the corrected
architecture: the earlier `needs: [ci, security]` cross-workflow reference is
gone and must not be reintroduced.

---

## Security

### Gitleaks

- **`.gitleaks.toml`** is the repository-level Gitleaks configuration (extends
  the default ruleset with a CI-only Cloudflare token detector and narrow
  documentation/test-pattern allowlist).
- **`.gitleaksignore`** formally acknowledges one reviewed historical finding by
  fingerprint.
- **Policy:** real secrets must never be allowlisted merely to make CI pass.
  The only acknowledged historical finding is a synthetic, non-production test
  artifact (see below).

### Historical synthetic key

- **Status:** Known historical synthetic test artifact.
- **Production credential exposure:** None identified.
- **Reasoning:** The key was generated by `workers/scripts/phase-l-attack-keygen.mjs`
  whose header states *"LOCAL ONLY, NOT COMMITTED"*. It was used only to mint
  synthetic Patient A/B JWTs for the local end-to-end IDOR/security-attack
  test harness. It was never referenced by any test after the deterministic
  keypair injection was implemented, never used in production, and has been
  removed from the working tree. Production signing uses the `JWT_PRIVATE_KEY`
  GitHub secret injected at deploy time — unrelated to the fixture.
- **Handling:** Acknowledged by fingerprint in `.gitleaksignore`. An optional
  Git-history purge (`git filter-repo`) remains deferred hygiene work; it is
  **not** required for certification because the artifact is non-production and
  inactive.

---

## Toolchain (certified)

| Tool | Version |
|------|---------|
| Node.js | 22 |
| pnpm | 11.13.1 |
| gitleaks | 8.24.3 (CI-pinned) |

Critical GitHub Actions (checkout, setup-node, pnpm/action-setup,
wrangler-action, gitleaks-action) are pinned to **immutable commit SHAs** for
deterministic CI.

---

## Production Verification

Verified live at certification time:

- **API worker:** `https://api.agsynergy.ca/api/v1/health` → **200**
  ```json
  {"status":"healthy","service":"agsynergy-api","version":"1.1.0",
   "environment":"production","database":{"connected":true,"migrationVersion":17,"migrationCount":17}}
  ```
- **Frontend worker:** `https://www.agsynergy.ca` → **200**
- **Root domain:** `https://agsynergy.ca` unauthenticated → **302** redirect to
  the Cloudflare Access login. This is the **intentional** hardened behavior
  (email-OTP gate) for the root domain; it is not a deployment failure.

---

## Repeatability

The deploy pipeline was validated green on both supported triggers:

- **Push path** (push to `main`): Test, Typecheck, Secret Scan, deploy — all
  pass.
- **`workflow_dispatch` path** (manual deploy): Test, Typecheck, Secret Scan,
  deploy — all pass.

This confirms the pipeline behaves deterministically regardless of trigger
type.

---

## Remaining Governance

Branch protection on `main` has been **enabled and verified**:

- **Pull request required** (1 approving review), stale reviews dismissed.
- **Required status checks (strict):** `Tests (workers)`, `Typecheck (ratchet)`,
  `gitleaks` — the actual check names produced by the certified workflows.
- Force pushes and deletions on `main` are blocked.
- Administrator enforcement was deliberately left non-forced (existing
  admin/repository-owner flexibility preserved).

No blocking governance condition remains.

---

## Deferred Findings

- **Optional Git-history purge** of the historical synthetic key
  (`git filter-repo` + force push). Deferred hygiene; not required for
  certification because the artifact is synthetic, non-production, and inactive.

No other out-of-scope improvements were identified or implemented in this
closure pass.

---

## Certification Decision

**CERTIFIED.**

The production application/deployment path is certified: tests pass, typecheck
passes, Gitleaks passes on full history, both Workers deploy, production health
is verified, repeatability is confirmed on the push and `workflow_dispatch`
paths, and branch protection on `main` is enabled and verified. Documentation
matches the actual repository state.
