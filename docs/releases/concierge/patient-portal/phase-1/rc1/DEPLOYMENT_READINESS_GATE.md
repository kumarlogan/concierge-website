# DEPLOYMENT READINESS GATE — Production Deployment Checklist

**Purpose:** All items must pass before a production deployment is authorized.
**Accountability:** Merge to `main` is the deployment trigger. This gate must be satisfied before merging.

---

## Gate 1: Git State

| # | Check | Command / Method | Pass/Fail |
|---|---|---|---|
| 1.1 | Working tree is clean | `git status --porcelain` must be empty | ☐ |
| 1.2 | All new files are tracked | `git ls-files --others --exclude-standard` must be empty | ☐ |
| 1.3 | All imports resolve to tracked files | Run `tsc --noEmit` on all workspace packages | ☐ |
| 1.4 | Commit contains all expected files | `git diff --cached --stat` — verify file count matches expectations | ☐ |
| 1.5 | Branch is up to date with main | `git log main..HEAD` — only your commits, no merge conflicts | ☐ |
| 1.6 | Tag exists (if versioned release) | `git tag -l "v*"` | ☐ |

---

## Gate 2: Required Files

| # | File | Purpose | Must Exist |
|---|---|---|---|
| 2.1 | `workers/src/index.ts` | API worker entry point | ☐ |
| 2.2 | `workers/wrangler.jsonc` | API worker configuration | ☐ |
| 2.3 | `artifacts/ags-fertility/src/main.tsx` | Frontend entry point | ☐ |
| 2.4 | `artifacts/ags-fertility/vite.config.ts` | Frontend build configuration | ☐ |
| 2.5 | `.github/workflows/deploy.yml` | CI/CD pipeline definition | ☐ |
| 2.6 | `pnpm-lock.yaml` | Dependency lockfile | ☐ |
| 2.7 | `package.json` | Root package manifest | ☐ |

Add any new files created by the feature to this list.

---

## Gate 3: CI/CD Validation

| # | Check | Verification | Pass/Fail |
|---|---|---|---|
| 3.1 | Dependencies install | `pnpm install --frozen-lockfile=false` succeeds | ☐ |
| 3.2 | Frontend builds | `pnpm --filter @workspace/ags-fertility run build` succeeds | ☐ |
| 3.3 | Production endpoint guard | Bundle must contain `api.agsynergy.ca` and no dev endpoints | ☐ |
| 3.4 | API worker builds | `wrangler deploy --env production --dry-run` (or equivalent) succeeds | ☐ |
| 3.5 | JWT secrets accessible | All JWT secrets present in GitHub Secrets | ☐ |
| 3.6 | No untracked imports | All import statements resolve to git-tracked files | ☐ |
| 3.7 | TypeScript type-check | `tsc --noEmit` passes on all workspace packages | ☐ |

---

## Gate 4: Configuration Validation

| # | Check | Verification | Pass/Fail |
|---|---|---|---|
| 4.1 | `VITE_API_BASE` is set to `https://api.agsynergy.ca` | GitHub Secret verified | ☐ |
| 4.2 | `CLOUDFLARE_API_TOKEN` is set | GitHub Secret verified | ☐ |
| 4.3 | `JWT_PRIVATE_KEY` is set | GitHub Secret verified (length > 0) | ☐ |
| 4.4 | `JWT_PUBLIC_KEY` is set | GitHub Secret verified (length > 0) | ☐ |
| 4.5 | `JWT_KID` is set | GitHub Secret verified (length > 0) | ☐ |
| 4.6 | `r2_buckets` configured for `env.production` | `workers/wrangler.jsonc` verified | ☐ |
| 4.7 | `d1_databases` configured for `env.production` | `workers/wrangler.jsonc` verified | ☐ |
| 4.8 | Wrangler compatibility flags correct | `nodejs_compat` enabled | ☐ |

---

## Gate 5: Pre-Deployment Dry-Run

| # | Check | Verification | Pass/Fail |
|---|---|---|---|
| 5.1 | Run full build pipeline locally | All build steps succeed from clean checkout | ☐ |
| 5.2 | No warnings from Wrangler config | Review Wrangler output for `r2_buckets` or other warnings | ☐ |
| 5.3 | Version bump verified | `CHANGELOG.md` and `version.ts` match | ☐ |

---

## Gate 6: Post-Deployment Smoke Test

| # | Check | Command | Pass/Fail |
|---|---|---|---|
| 6.1 | API health check | `curl -sf https://api.agsynergy.ca/api/v1/health` | ☐ |
| 6.2 | API returns 200 | Response status code is 200 | ☐ |
| 6.3 | Frontend reachable | `curl -sf https://agsynergy.ca` | ☐ |
| 6.4 | Frontend returns HTML | Response contains `<!DOCTYPE html>` or `index.html` | ☐ |
| 6.5 | Deployment verified | `wrangler deployments list --name agsynergy-api` shows latest version | ☐ |
| 6.6 | Frontend deployment verified | `wrangler deployments list --name hermes-website` shows latest version | ☐ |
| 6.7 | JWT endpoints functional | Authenticate a test request | ☐ |

---

## Gate 7: Rollback Readiness

| # | Check | Pass/Fail |
|---|---|---|
| 7.1 | Previous deployment version known | ☐ |
| 7.2 | Rollback command documented | `wrangler rollback --name agsynergy-api --version <id>` | ☐ |
| 7.3 | Rollback within 5 minutes | Known procedure | ☐ |

---

## Sign-Off

| Role | Name | Date | Signature |
|---|---|---|---|
| **Deployer** | | | ☐ |
| **Reviewer** | | | ☐ |

---

**To use:** Copy this checklist into the PR description or release ticket. Check each item before merging to `main`. If any item fails, stop deployment and fix the issue.

---

**Document version:** 1.0
**Classification:** AGS-OPS-001 / Readiness Gate