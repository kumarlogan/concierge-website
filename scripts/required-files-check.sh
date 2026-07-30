#!/usr/bin/env bash
# =============================================================================
# Required File Verification — P0 Deployment Gate
#
# Verifies that all files required for a successful deployment exist. Designed
# for both CI and local use. Supports per-environment file lists.
#
# Usage:
#   scripts/required-files-check.sh [--env production] [--workers]
#
# Options:
#   --env <name>   Deployment environment (production, preview, dev)
#   --workers      Only check API worker files
#   --root         Only check frontend root files
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

ENVIRONMENT="production"
SCOPE="both"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENVIRONMENT="$2"; shift 2 ;;
    --workers) SCOPE="workers"; shift ;;
    --root) SCOPE="root"; shift ;;
    *) echo "::error::Unknown option: $1"; exit 2 ;;
  esac
done

HAS_ERROR=false
report_error() {
  local file="$1"
  echo "::error::Required file missing: $file"
  HAS_ERROR=true
}

cd "$PROJECT_ROOT"

echo "========================================"
echo " REQUIRED FILE VERIFICATION"
echo " Environment: $ENVIRONMENT"
echo " Scope:       $SCOPE"
echo "========================================"
echo ""

# ── Root-level required files (both workers) ──────────────────────────
ROOT_FILES=(
  "package.json"
  "pnpm-lock.yaml"
  "tsconfig.base.json"
  "tsconfig.json"
  ".github/workflows/deploy.yml"
)

# ── Frontend root worker required files ───────────────────────────────
ROOT_WORKER_FILES=(
  "wrangler.jsonc"
  "artifacts/ags-fertility/package.json"
  "artifacts/ags-fertility/tsconfig.json"
  "artifacts/ags-fertility/vite.config.ts"
  "artifacts/ags-fertility/index.html"
)

# ── API worker required files ─────────────────────────────────────────
WORKER_API_FILES=(
  "workers/package.json"
  "workers/wrangler.jsonc"
  "workers/tsconfig.json"
  "workers/vitest.config.ts"
  "workers/src/index.ts"
)

# ── Check by scope ────────────────────────────────────────────────────
case "$SCOPE" in
  "both")
    echo "--- Root-level files ---"
    for f in "${ROOT_FILES[@]}"; do
      if [[ -f "$f" ]]; then
        echo "  ✅ $f"
      else
        report_error "$f"
      fi
    done

    echo ""
    echo "--- Frontend worker (hermes-website) ---"
    for f in "${ROOT_WORKER_FILES[@]}"; do
      if [[ -f "$f" ]]; then
        echo "  ✅ $f"
      else
        report_error "$f"
      fi
    done

    echo ""
    echo "--- API worker (agsynergy-api) ---"
    for f in "${WORKER_API_FILES[@]}"; do
      if [[ -f "$f" ]]; then
        echo "  ✅ $f"
      else
        report_error "$f"
      fi
    done
    ;;

  "root")
    echo "--- Root-level + Frontend worker ---"
    ALL_ROOT=("${ROOT_FILES[@]}" "${ROOT_WORKER_FILES[@]}")
    for f in "${ALL_ROOT[@]}"; do
      if [[ -f "$f" ]]; then
        echo "  ✅ $f"
      else
        report_error "$f"
      fi
    done
    ;;

  "workers")
    echo "--- API worker ---"
    for f in "${WORKER_API_FILES[@]}"; do
      if [[ -f "$f" ]]; then
        echo "  ✅ $f"
      else
        report_error "$f"
      fi
    done
    ;;
esac

echo ""

# ── Environment-specific files ────────────────────────────────────────
if [[ "$ENVIRONMENT" == "production" && "$SCOPE" != "workers" ]]; then
  echo "--- Production-specific ---"
  PROD_FILES=(
    "artifacts/ags-fertility/.env.production"
  )
  for f in "${PROD_FILES[@]}"; do
    if [[ -f "$f" ]]; then
      echo "  ✅ $f"
    elif [[ "$f" == *.env* ]]; then
      # .env files may be injected by CI, not committed
      echo "  ⚠️  $f (optional — may be injected by CI)"
    else
      report_error "$f"
    fi
  done
fi

echo ""

# ── Summary ───────────────────────────────────────────────────────────
if [[ "$HAS_ERROR" == "true" ]]; then
  echo "⛔ REQUIRED FILE VERIFICATION FAILED — missing files above must exist before deployment."
  exit 1
else
  echo "✅ REQUIRED FILE VERIFICATION PASSED — all required files present."
  exit 0
fi