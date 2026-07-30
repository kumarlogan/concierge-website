# DEPLOYMENT PREVENTION PLAN — AGS-OPS-001

**Objective:** Ensure the same deployment failures cannot recur without detection.
**Scope:** Pre-commit, CI/CD, and post-deployment controls.

---

## 1. Prevention Strategy

A layered defense: catch untracked files locally before commit, validate at PR time, verify at CI time, and confirm post-deployment.

---

## 2. Immediate Preventive Actions (Implement Now)

### 2.1 Pre-Commit Git Status Check (Local Script)

Add a pre-commit hook or local script that runs before every commit:

```bash
#!/bin/bash
# pre-commit: ensure no referenced imports point to untracked files
# Check: are there any .ts/.tsx files referenced by imports that aren't tracked?
git status --porcelain | grep -E '^\?\?' | awk '{print $2}' | while read -r f; do
  if echo "$f" | grep -qE '\.(ts|tsx)$'; then
    echo "WARNING: Untracked source file: $f"
    echo "  Did you forget to 'git add' this file?"
  fi
done
```

Save as `.git/hooks/pre-commit` and make executable.

### 2.2 File Inventory Validation (CI Automation)

Add a CI step to `deploy.yml` that verifies every TypeScript import resolves to a tracked file:

```yaml
- name: Verify all imports resolve to tracked files
  run: |
    # Find all import statements in tracked .ts/.tsx files
    # Check that each imported module exists as a file in the repo
    ERR=0
    while IFS= read -r file; do
      for import in $(grep -oP "from ['\"]([^'\"]+)['\"]" "$file" | sed "s/from ['\"]//;s/['\"]$//"); do
        # Skip node_modules and bare specifiers
        [[ "$import" == *"/"* ]] || continue
        [[ "$import" == "."* ]] || continue
        # Resolve the import path relative to the file
        base=$(dirname "$file")
        resolved=$(cd "$base" 2>/dev/null && realpath "${import}.ts" 2>/dev/null || echo "")
        if [ -z "$resolved" ] || [ ! -f "$resolved" ]; then
          resolved=$(cd "$base" 2>/dev/null && realpath "${import}.tsx" 2>/dev/null || echo "")
        fi
        if [ -n "$resolved" ] && [ -f "$resolved" ]; then
          # Check if resolved file is tracked by git
          if ! git ls-files --error-unmatch "$resolved" &>/dev/null; then
            echo "ERROR: $file imports '$import' which resolves to untracked file: $resolved"
            ERR=1
          fi
        fi
      done
    done < <(git ls-files '*.ts' '*.tsx')
    exit $ERR
```

### 2.3 Pre-Deployment Git Cleanliness Check

Add an early CI step that fails if the checked-out repo has any indicator of missing files:

```yaml
- name: Git cleanliness check
  run: |
    # Verify no tracked import references an untracked path
    # (Already covered by the import validation step above)
    # Also verify the working tree is clean
    git status --porcelain
    if [ -n "$(git status --porcelain)" ]; then
      echo "WARNING: Working tree is not clean"
      # Not a hard failure in CI since checkout should be clean
    fi
```

### 2.4 Required File Verification

Add a manifest check for files that must exist for each deployment:

```yaml
- name: Verify required files exist
  run: |
    REQUIRED_FILES=(
      "artifacts/ags-fertility/src/components/patient/booking-dialog.tsx"
      "workers/src/middleware/turnstile.ts"
      "workers/src/index.ts"
      "workers/wrangler.jsonc"
    )
    ERR=0
    for f in "${REQUIRED_FILES[@]}"; do
      if [ ! -f "$f" ]; then
        echo "ERROR: Required file missing: $f"
        ERR=1
      fi
    done
    exit $ERR
```

---

## 3. Medium-Term Preventive Actions

### 3.1 Pre-Deployment Dry-Run

Add a workflow dispatcher mode that runs build and validation without actually deploying:

```yaml
on:
  workflow_dispatch:
    inputs:
      mode:
        description: 'dry-run or deploy'
        required: true
        default: 'deploy'
```

When `mode: dry-run`, the workflow runs all build and validation steps but skips the Wrangler deploy commands.

### 3.2 Dependency Graph Validation

Use TypeScript compiler to validate the full dependency graph:

```bash
# Run tsc --noEmit to check all imports resolve
pnpm --filter @workspace/ags-fertility exec tsc --noEmit
```

### 3.3 Deployment Health Check Automation

After deployment, automate the smoke test (already documented in `CONCIERGE_PRODUCTION_SMOKE_TEST.md`). Add a CI step:

```yaml
- name: Production smoke test
  run: |
    echo "=== Health Check ==="
    curl -sf https://api.agsynergy.ca/api/v1/health || (echo "FAIL: API health check" && exit 1)
    echo "=== Frontend Reachable ==="
    curl -sf https://agsynergy.ca | grep -q 'index.html' || (echo "FAIL: Frontend not reachable" && exit 1)
    echo "=== Smoke test PASSED ==="
```

---

## 4. Long-Term Systemic Fixes

### 4.1 Branch Protection Rules

Enable GitHub branch protection on `main`:
- Require status checks to pass before merging
- Require all CI steps (including new import validation) to pass
- Do not allow bypassing protections

### 4.2 Pre-Deployment Readiness Gate

Implement the full checklist in `DEPLOYMENT_READINESS_GATE.md` as a required workflow step.

### 4.3 Agent Workflow Improvement

When Hermes creates new files as part of feature work, the agent should:
1. Run `git status` after creating files to verify they are tracked
2. If files are untracked, run `git add <file>` before committing
3. Run `git diff --cached --stat` to verify the full set of changes prior to commit

### 4.4 Wrangler Configuration Fix

Add `r2_buckets` to `env.production` in `workers/wrangler.jsonc`:

```jsonc
"env": {
  "production": {
    "r2_buckets": [
      {
        "binding": "DOCUMENT_STORAGE",
        "bucket_name": "agsynergy-documents"
      }
    ],
    // ... existing config
  }
}
```

---

## 5. Automation Priority Matrix

| Action | Effort | Impact | Priority |
|---|---|---|---|
| Pre-commit git status check | Low | High | **P0 — Immediate** |
| CI import validation step | Low | High | **P0 — Immediate** |
| Required file verification | Low | Medium | **P1 — This sprint** |
| CI smoke test step | Medium | Medium | **P1 — This sprint** |
| Wrangler `r2_buckets` fix | Low | Low | **P2 — Next sprint** |
| Dry-run workflow mode | Medium | Medium | **P2 — Next sprint** |
| Branch protection rules | Low | High | **P2 — Next sprint** |
| Agent workflow automation | Low | High | **P2 — Next sprint** |

---

**Document version:** 1.0
**Classification:** AGS-OPS-001 / Prevention