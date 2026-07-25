#!/usr/bin/env bash
# ┌─────────────────────────────────────────────────────────────┐
# │ Version Extraction Script                                   │
# │ GOV-002 — Single source of truth for SERVICE_VERSION        │
# │ Reads the latest version from CHANGELOG.md and writes       │
# │ workers/src/version.ts so the health endpoint derives       │
# │ version from the authoritative release source.              │
# └─────────────────────────────────────────────────────────────┘
set -euo pipefail

CHANGELOG="${1:-CHANGELOG.md}"
OUTPUT="${2:-workers/src/version.ts}"

# Extract the highest semver from CHANGELOG headers like "## [1.13.0]"
# Uses grep to find all version headers, sorts by semver, takes the latest.
VERSION=$(grep -oP '^## \[\K[0-9]+\.[0-9]+\.[0-9]+' "$CHANGELOG" \
  | sort -t. -k1,1nr -k2,2nr -k3,3nr \
  | head -1)

if [ -z "$VERSION" ]; then
  echo "ERROR: Could not extract version from $CHANGELOG" >&2
  exit 1
fi

cat > "$OUTPUT" <<EOF
// ┌─────────────────────────────────────────────────────────────┐
// │ SERVICE_VERSION — Auto-generated from CHANGELOG.md          │
// │ GOV-002: Single source of truth for version across:         │
// │   CHANGELOG · SERVICE_VERSION · Health endpoint             │
// │   Deployment metadata · All program dashboards               │
// │ DO NOT EDIT MANUALLY — Regenerate via:                       │
// │   bash scripts/extract-version.sh                           │
// └─────────────────────────────────────────────────────────────┘

/** Service version — sourced from CHANGELOG.md at build time. */
export const SERVICE_VERSION = "${VERSION}";
EOF

echo "✅ ${OUTPUT} ← ${VERSION}"