# EXECUTION_GUIDE.md

**EPIC-012 — Release Management & Multi-Mode Execution**
**Phase J: Final Certification — Execution Guide**
**Date:** 2026-08-01
**Product:** Hermes Platform (reusable by every future Hermes product)
**Wave:** EPIC-012
**Hermes Runtime:** v1.0 (Foundation frozen)

---

## Executive Summary

Execution Guide provides step-by-step instructions for executing releases across all three modes (Development, Preview, Production). Each step includes the exact commands, expected outputs, and failure handling. This guide is for operators and engineers who execute releases.

---

## 1. Prerequisites

### 1.1 Required Tools

| Tool | Version | Purpose | Verify |
|------|---------|---------|--------|
| pnpm | 9.x+ | Package manager | `pnpm --version` |
| wrangler | 4.x+ | Cloudflare deployment | `npx wrangler@4 --version` |
| Node.js | 22.x | Runtime | `node --version` |
| git | 2.x+ | Version control | `git --version` |
| Python 3 | 3.x+ | Integrity checks | `python3 --version` |

### 1.2 Required Secrets (Production Only)

| Secret | Purpose | Source |
|--------|---------|--------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare Workers authentication | GitHub repo Settings → Secrets |
| `JWT_PRIVATE_KEY` | JWT signing for API worker | GitHub repo Settings → Secrets |
| `JWT_PUBLIC_KEY` | JWT verification for API worker | GitHub repo Settings → Secrets |
| `JWT_KID` | JWT key ID | GitHub repo Settings → Secrets |
| `VITE_API_BASE` | Frontend API endpoint | GitHub repo Settings → Secrets |

### 1.3 Required Files

| File | Purpose | Verify |
|------|---------|--------|
| `CHANGELOG.md` | Version source of truth | Exists and has latest version |
| `.github/workflows/deploy.yml` | CI/CD pipeline | Exists and valid YAML |
| `wrangler.jsonc` | Frontend worker config | Exists |
| `workers/wrangler.jsonc` | API worker config | Exists |
| `scripts/extract-version.sh` | Version extraction | Exists and executable |
| `scripts/deployment-summary.sh` | Deployment reporting | Exists and executable |

---

## 2. Development Mode Execution

### 2.1 Local Development Deploy

```bash
# Step 1: Navigate to project root
cd /home/ubuntu/concierge-website

# Step 2: Install dependencies
pnpm install --frozen-lockfile=false

# Step 3: Build frontend
pnpm --filter @workspace/ags-fertility run build

# Step 4: Start local dev server
cd artifacts/ags-fertility && npx wrangler dev

# Expected output: Local server running on localhost:8787
# Expected output: Vite dev server running on localhost:5173
```

### 2.2 Development Mode Verification

| Check | Command | Expected |
|-------|---------|----------|
| Build passes | `pnpm --filter @workspace/ags-fertility run build` | Exit code 0 |
| TypeScript clean | `pnpm typecheck` | 0 errors |
| Local server running | `curl http://localhost:8787` | HTTP 200 |

### 2.3 Development Mode Failure Handling

| Failure | Action |
|---------|--------|
| Build fails | Fix source errors, rebuild |
| TypeScript errors | Fix type errors, rebuild |
| Local server fails | Check wrangler config, retry |
| Import errors | Ensure all imports are tracked by git |

---

## 3. Preview Mode Execution

### 3.1 Preview Deploy (Automated)

Preview deploy is triggered automatically on push to `feat/*` or `preview` branches via GitHub Actions.

```bash
# Step 1: Create feature branch
git checkout -b feat/my-feature

# Step 2: Make changes and commit
git add .
git commit -m "feat: my feature description"

# Step 3: Push to remote
git push origin feat/my-feature

# Step 4: CI/CD automatically runs:
#   - Gate 1: Repository Integrity
#   - Gate 2: Required Files
#   - Gate 3: Import Resolution
#   - Build
#   - Deploy to preview environment
```

### 3.2 Preview Deploy (Manual)

```bash
# Step 1: Navigate to project root
cd /home/ubuntu/concierge-website

# Step 2: Run integrity gates
bash scripts/repo-integrity-check.sh
bash scripts/required-files-check.sh
python3 scripts/import-integrity-check.py --project-root . --exclude artifacts/ lib/ hermes-website/ __tests__ workers/tests-epic0059/ --allow-external

# Step 3: Build frontend
pnpm --filter @workspace/ags-fertility run build

# Step 4: Deploy to preview
cd workers && npx wrangler@4 deploy

# Expected output: Preview deployment URL
```

### 3.3 Preview Mode Verification

| Check | Command | Expected |
|-------|---------|----------|
| Integrity gates pass | Run all 3 scripts | Exit code 0 |
| Build passes | `pnpm build` | Exit code 0 |
| Preview deploy succeeds | wrangler deploy | Exit code 0 |
| Health check passes | DeploymentHealthFramework.isDeployable() | deployable: true |
| Preview URL captured | Check deployment output | URL recorded |

### 3.4 Preview Mode Failure Handling

| Failure | Action |
|---------|--------|
| Integrity gate fails | Fix the issue (untracked files, missing files, broken imports) |
| Build fails | Fix build errors, rebuild |
| Preview deploy fails | Check wrangler config, verify credentials |
| Health check fails | Review health check results, fix dependencies |

---

## 4. Production Mode Execution

### 4.1 Production Deploy (CI/CD — Automated)

Production deploy is triggered by push to `main` branch via GitHub Actions.

```bash
# Step 1: Ensure all changes are committed and pushed to main
git checkout main
git pull origin main

# Step 2: CI/CD automatically runs:
#   - Gate 1: Repository Integrity
#   - Gate 2: Required Files
#   - Gate 3: Import Resolution
#   - Gate 4: Production Bundle Guard
#   - Build
#   - JWT Injection
#   - Deploy API Worker (wrangler deploy --env production)
#   - Deploy Frontend Worker (wrangler deploy)
#   - Health Check
#   - Smoke Tests
#   - Evidence Collection
#   - Release Notes Generation
```

### 4.2 Production Deploy (Manual — For Emergency/Operator Use)

```bash
# Step 1: Navigate to project root
cd /home/ubuntu/concierge-website

# Step 2: Verify git state
git status --porcelain  # Must be empty
git log main..HEAD      # Must show only your commits

# Step 3: Run all integrity gates
bash scripts/repo-integrity-check.sh
bash scripts/required-files-check.sh
python3 scripts/import-integrity-check.py --project-root . --exclude artifacts/ lib/ hermes-website/ __tests__ workers/tests-epic0059/ --allow-external

# Step 4: Verify production bundle
shopt -s globstar nullglob
FILES=(artifacts/ags-fertility/dist/public/assets/*.js)
if [ ${#FILES[@]} -eq 0 ]; then
  echo "ERROR: No built JS bundles found"
  exit 1
fi
BAD=$(grep -rEl 'kumarlogan\.workers\.dev|localhost:[0-9]+' "${FILES[@]}" 2>/dev/null || true)
if [ -n "$BAD" ]; then
  echo "ERROR: Production bundle references dev/staging endpoint"
  exit 1
fi
PROD_HOST="${VITE_API_BASE%/}"
if ! grep -rqF "$PROD_HOST" "${FILES[@]}" 2>/dev/null; then
  echo "ERROR: VITE_API_BASE ($PROD_HOST) not found in production bundle"
  exit 1
fi
echo "OK: bundle points at $PROD_HOST"

# Step 5: Build frontend
pnpm --filter @workspace/ags-fertility run build

# Step 6: Inject JWT config (API worker)
cd workers
node -e '
const fs = require("fs");
let s = fs.readFileSync("wrangler.jsonc", "utf8");
const json = JSON.parse(s.replace(/((?:^|\s)\/\/.*$)/gm, ""));
const v = (json.env.production.vars = json.env.production.vars || {});
v.JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY;
v.JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;
v.JWT_KID = process.env.JWT_KID;
v.PLATFORM_JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;
v.PLATFORM_JWT_KID = process.env.JWT_KID;
fs.writeFileSync("wrangler.jsonc", JSON.stringify(json, null, 2) + "\n");
'

# Step 7: Deploy API Worker
npx wrangler@4 deploy --env production

# Step 8: Deploy Frontend Worker
cd .. && npx wrangler@4 deploy

# Step 9: Run post-deploy health checks
# (Manual verification — check DeploymentHealthFramework)

# Step 10: Run smoke tests
# (Manual verification — run smoke test suite)

# Step 11: Collect evidence
bash scripts/deployment-summary.sh

# Step 12: Generate release notes
# (Manual — extract from CHANGELOG.md for the version)
```

### 4.3 Production Mode Verification

| Check | Command | Expected |
|-------|---------|----------|
| All 4 integrity gates pass | Run all scripts | Exit code 0 |
| Build passes | `pnpm build` | Exit code 0 |
| JWT injection succeeds | Check workers/wrangler.jsonc | JWT vars present |
| API deploy succeeds | wrangler deploy --env production | Exit code 0 |
| Frontend deploy succeeds | wrangler deploy | Exit code 0 |
| Health checks pass | DeploymentHealthFramework | All healthy |
| Smoke tests pass | Smoke Test Framework | All pass |
| Evidence collected | deployment-summary.sh | Report generated |
| Release notes generated | CHANGELOG.md parsed | Notes published |
| PO approval obtained | ApprovalRef | Approved |

### 4.4 Production Mode Failure Handling

| Failure | Action |
|---------|--------|
| Integrity gate fails | Fix the issue, recommit to main |
| Build fails | Fix build errors, push fix |
| JWT injection fails | Check GitHub Secrets are set |
| API deploy fails | Check wrangler config, verify credentials |
| Frontend deploy fails | Check wrangler config, verify credentials |
| Health check fails | Investigate, consider rollback |
| Smoke test fails | Investigate, consider rollback |
| PO approval denied | Address concerns, redeploy after fix |

### 4.5 Production Rollback

```bash
# Step 1: Identify previous release
# Check ReleaseRegistry for previous releaseId

# Step 2: Execute rollback
cd /home/ubuntu/concierge-website/workers
npx wrangler@4 deploy --env production --rollback

# Step 3: Verify rollback
# Check that previous version is serving correctly
# Run health checks
# Run smoke tests

# Step 4: Record rollback
# Update ReleaseRegistry with rollback metadata
# Emit audit event
```

---

## 5. Mode Comparison

| Aspect | Development | Preview | Production |
|--------|-------------|---------|------------|
| Trigger | `wrangler dev` | Push to feat/* | Push to main + PO approval |
| Target | localhost | preview.workers.dev | agsynergy.ca, api.agsynergy.ca |
| Gates | Build + TS | 3 integrity gates | 4 integrity gates + PO approval |
| Health checks | None | Pre-deploy | Pre + post deploy |
| Smoke tests | None | None | Full suite |
| Evidence | None | Preview URL | Full package |
| Audit | Local log | emitAudit() | emitAudit() + durable store |
| Rollback | N/A | wrangler rollback | wrangler rollback |
| Approval | None | None | PO approval required |

---

## 6. Phase J Completion Criteria

| # | Deliverable | Status |
|---|------------|--------|
| 1 | Execution Guide produced | ✅ Complete |
| 2 | All modes documented with step-by-step instructions | ✅ Complete |
| 3 | Failure handling documented | ✅ Complete |
| 4 | Rollback procedure documented | ✅ Complete |
| 5 | Mode comparison table provided | ✅ Complete |

---

*End of EXECUTION_GUIDE.md*
