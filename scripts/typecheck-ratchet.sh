#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# TypeScript error ratchet
# ─────────────────────────────────────────────────────────────
#
# The repository carries a known baseline of pre-existing TypeScript errors
# (tracked as EPIC-015). A plain `tsc --noEmit` gate would therefore fail on
# day one and would have to be disabled — which is how the baseline grew in
# the first place.
#
# This script instead enforces a RATCHET: the error count may fall, may stay
# level, but may never rise. New code must be clean even while the historical
# debt is paid down separately.
#
# Usage:
#   scripts/typecheck-ratchet.sh <label> <baseline> <workdir> <command...>
#
# Exits non-zero if the current error count exceeds <baseline>.

set -uo pipefail

LABEL="${1:?label required}"
BASELINE="${2:?baseline required}"
WORKDIR="${3:?workdir required}"
shift 3

echo "── Typecheck ratchet: ${LABEL} ──"
echo "   workdir : ${WORKDIR}"
echo "   command : $*"
echo "   baseline: ${BASELINE} error(s)"

OUTPUT_FILE="$(mktemp)"
( cd "${WORKDIR}" && "$@" ) >"${OUTPUT_FILE}" 2>&1 || true

# tsc emits one "error TSxxxx" per diagnostic.
COUNT="$(grep -c "error TS" "${OUTPUT_FILE}" || true)"
COUNT="${COUNT:-0}"

echo "   actual  : ${COUNT} error(s)"
echo ""

if [ "${COUNT}" -gt "${BASELINE}" ]; then
  echo "::error::${LABEL}: TypeScript errors increased — ${COUNT} > baseline ${BASELINE}."
  echo ""
  echo "New errors must be fixed before merge. Full output:"
  echo "────────────────────────────────────────────────────"
  cat "${OUTPUT_FILE}"
  rm -f "${OUTPUT_FILE}"
  exit 1
fi

if [ "${COUNT}" -lt "${BASELINE}" ]; then
  echo "::notice::${LABEL}: error count fell to ${COUNT} (baseline ${BASELINE})."
  echo "Lower the baseline in .github/workflows/ci.yml to lock in the improvement."
fi

# Always surface the diagnostics so the debt stays visible rather than silent.
if [ "${COUNT}" -gt 0 ]; then
  echo "Current diagnostics (within baseline, not blocking):"
  echo "────────────────────────────────────────────────────"
  head -n 60 "${OUTPUT_FILE}"
  if [ "${COUNT}" -gt 60 ]; then
    echo "... output truncated; ${COUNT} diagnostics total."
  fi
fi

rm -f "${OUTPUT_FILE}"
echo "OK: ${LABEL} within baseline."
