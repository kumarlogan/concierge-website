#!/bin/bash
# ──────────────────────────────────────────────────────────────────────
# AG Synergy Platform — Dry-Run Deployment Validation
# Type: pre-deployment gate
# Validates: wrangler config, dry-run deploy, build artifacts
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' 
BOLD='\033[1m'

PASS=0
FAIL=0
WARN=0

pass() { PASS=$((PASS+1)); echo -e "  ${GREEN}✓${NC} $1"; }
fail() { FAIL=$((FAIL+1)); echo -e "  ${RED}✗${NC} $1"; }
warn() { WARN=$((WARN+1)); echo -e "  ${YELLOW}⚠${NC} $1"; }

echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  Dry-Run Deployment Validation                            ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

HOOK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HOOK_DIR"

# ── 1. Prerequisites ─────────────────────────────────────────────────
echo -e "${BOLD}[1/5] Prerequisites${NC}"

if command -v wrangler &>/dev/null; then
    pass "wrangler CLI found: $(wrangler --version 2>&1 | head -1)"
else
    fail "wrangler CLI not found (install: npm install -g wrangler)"
fi

if command -v node &>/dev/null; then
    pass "node $(node --version)"
else
    fail "node not found"
fi

if command -v pnpm &>/dev/null; then
    pass "pnpm $(pnpm --version 2>&1)"
else
    fail "pnpm not found"
fi

echo ""

# ── 2. Wrangler Config Validation ────────────────────────────────────
echo -e "${BOLD}[2/5] Wrangler Configuration${NC}"

if [ -f "wrangler.jsonc" ]; then
    pass "Root wrangler.jsonc (hermes-website)"
else
    fail "Root wrangler.jsonc not found"
fi

if [ -f "workers/wrangler.jsonc" ]; then
    pass "workers/wrangler.jsonc (agsynergy-api)"
else
    fail "workers/wrangler.jsonc not found"
fi

echo ""

# ── 3. Dry-Run Deployments ───────────────────────────────────────────
echo -e "${BOLD}[3/5] Dry-Run Deploy${NC}"

# API worker dry-run
echo "    ── API worker (agsynergy-api) ──"
if [ -f "workers/wrangler.jsonc" ]; then
    cd workers
    if wrangler deploy --dry-run --env production 2>&1 | head -5; then
        pass "API worker dry-run passed"
    else
        fail "API worker dry-run failed"
    fi
    cd "$HOOK_DIR"
else
    fail "Skipped — workers/wrangler.jsonc not found"
fi

# Frontend worker dry-run
echo "    ── Frontend worker (hermes-website) ──"
if wrangler deploy --dry-run 2>&1 | head -5; then
    pass "Frontend worker dry-run passed"
else
    fail "Frontend worker dry-run failed"
fi

echo ""

# ── 4. Build Validation ──────────────────────────────────────────────
echo -e "${BOLD}[4/5] Build Validation${NC}"

if [ -d "artifacts/ags-fertility/dist" ]; then
    BUNDLE_COUNT=$(find artifacts/ags-fertility/dist -name "*.js" -o -name "*.css" 2>/dev/null | wc -l)
    pass "Frontend build output exists ($BUNDLE_COUNT assets)"
else
    warn "Frontend build output not found (run: pnpm --filter @workspace/ags-fertility run build)"
fi

if [ -d "workers/dist" ]; then
    WORKER_BUNDLE=$(find workers/dist -name "*.js" 2>/dev/null | head -1)
    if [ -n "$WORKER_BUNDLE" ]; then
        pass "API worker build output exists"
    else
        warn "API worker build output empty"
    fi
else
    warn "API worker build output not found"
fi

echo ""

# ── 5. Summary ───────────────────────────────────────────────────────
echo -e "${BOLD}[5/5] Results${NC}"
echo ""
echo -e "  ${GREEN}✓${NC} Passed: $PASS    ${RED}✗${NC} Failed: $FAIL    ${YELLOW}⚠${NC} Warnings: $WARN"
echo ""

if [ "$FAIL" -gt 0 ]; then
    echo -e "${RED}⛔ DRY-RUN DEPLOYMENT FAILED — ${FAIL} check(s) must be resolved.${NC}"
    exit 1
else
    echo -e "${GREEN}✅ DRY-RUN DEPLOYMENT PASSED — ready for deployment.${NC}"
fi