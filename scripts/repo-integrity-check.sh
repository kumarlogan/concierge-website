#!/usr/bin/env bash
# =============================================================================
# Repository Integrity Validation — P0 Deployment Gate
#
# Verifies the git working tree is clean, branch is correct, and HEAD is
# in an expected state for deployment. Exits 0 (pass) or 1 (fail) with
# human-readable error messages. Designed for both CI and local use.
#
# Usage:
#   scripts/repo-integrity-check.sh [--allow-dirty] [--branch <name>]
#
# Options:
#   --allow-dirty   Skip working-tree-clean checks (for CI after build steps)
#   --branch <name> Expected branch name (default: main)
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

ALLOW_DIRTY=false
EXPECTED_BRANCH="main"
RC_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --allow-dirty) ALLOW_DIRTY=true; shift ;;
    --branch) EXPECTED_BRANCH="$2"; shift 2 ;;
    --rc-file) RC_FILE="$2"; shift 2 ;;
    *) echo "::error::Unknown option: $1"; exit 2 ;;
  esac
done

HAS_ERROR=false
report_error() {
  local msg="$1"
  echo "::error::$msg"
  HAS_ERROR=true
}

# ── 1. Git repository exists ──────────────────────────────────────────────
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  report_error "Not inside a git repository."
  exit 1
fi

# ── 2. Working tree clean ─────────────────────────────────────────────────
if [[ "$ALLOW_DIRTY" == "false" ]]; then
  # Check for unstaged changes
  if ! git diff --exit-code --stat > /dev/null 2>&1; then
    UNSTAGED=$(git diff --stat 2>/dev/null | tail -1)
    report_error "Unstaged changes detected: ${UNSTAGED:-yes}"
    echo "  Run 'git diff --stat' to see details."
  fi

  # Check for staged-but-uncommitted changes
  if ! git diff --cached --exit-code --stat > /dev/null 2>&1; then
    STAGED=$(git diff --cached --stat 2>/dev/null | tail -1)
    report_error "Staged but uncommitted changes: ${STAGED:-yes}"
    echo "  Run 'git diff --cached --stat' to see details."
  fi

  # Check for untracked files
  UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null)
  if [[ -n "$UNTRACKED" ]]; then
    UNTRACKED_COUNT=$(echo "$UNTRACKED" | wc -l)
    report_error "Untracked files detected (${UNTRACKED_COUNT}):"
    echo "$UNTRACKED" | head -20 | sed 's/^/  /'
    if [[ "$UNTRACKED_COUNT" -gt 20 ]]; then
      echo "  ... and $(($UNTRACKED_COUNT - 20)) more"
    fi
  fi
fi

# ── 3. Current branch is valid ────────────────────────────────────────────
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [[ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]]; then
  report_error "Current branch is '${CURRENT_BRANCH}', expected '${EXPECTED_BRANCH}'"
fi

# ── 4. HEAD is synchronized with remote ───────────────────────────────────
if git remote get-url origin > /dev/null 2>&1; then
  git fetch origin "$EXPECTED_BRANCH" 2>/dev/null || true

  LOCAL_HASH=$(git rev-parse HEAD 2>/dev/null)
  REMOTE_HASH=$(git rev-parse "origin/$EXPECTED_BRANCH" 2>/dev/null || echo "")

  if [[ -z "$REMOTE_HASH" ]]; then
    echo "::warning::Could not resolve origin/$EXPECTED_BRANCH (remote may not exist)"
  elif [[ "$LOCAL_HASH" != "$REMOTE_HASH" ]]; then
    BEHIND=$(git rev-list --count "origin/$EXPECTED_BRANCH..HEAD" 2>/dev/null || echo "?")
    AHEAD=$(git rev-list --count "HEAD..origin/$EXPECTED_BRANCH" 2>/dev/null || echo "?")
    report_error "HEAD is not synchronized with origin/$EXPECTED_BRANCH"
    echo "  Local:  $LOCAL_HASH"
    echo "  Remote: $REMOTE_HASH"
    echo "  Commits ahead of remote: ${AHEAD}"
    echo "  Commits behind remote:  ${BEHIND}"
  fi
else
  echo "::warning::No remote 'origin' configured — skipping remote sync check"
fi

# ── 5. Summary ────────────────────────────────────────────────────────────
if [[ "$HAS_ERROR" == "true" ]]; then
  echo ""
  echo "⛔ REPOSITORY INTEGRITY CHECK FAILED — correct issues above before deploying."
  exit 1
else
  echo "✅ Repository integrity check passed: branch=$CURRENT_BRANCH clean=$ALLOW_DIRTY"
  exit 0
fi