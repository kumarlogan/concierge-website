# Release Management — Release Metadata

> **AI Platform Capability — Release Metadata Standard**
> Standardized release metadata for all AGS products.
>
> **Version:** 1.0.0 — Architecture
> **Status:** Architecture Complete
> **Last Updated:** 2026-07-27

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Capability:     Release Management Platform
Document:       Release Metadata
Framework:      WEF v1.0 (Workforce Execution Framework)
```

---

## 1. Metadata Schema

Every deployment carries structured metadata exposed through the health endpoint.

```typescript
interface ReleaseMetadata {
  // ── Identity ───────────────────────────────
  version: string;              // "1.18.1" — semantic version
  git_commit: string;           // Full SHA: "7a5b751..."
  deployment_id: string;        // UUID: "dep_<uuid>"
  environment: string;          // "development" | "preview" | "production"

  // ── Timing ─────────────────────────────────
  timestamp: string;            // ISO 8601: "2026-07-27T10:00:00Z"
  branch: string;               // "main" | "feature/*"

  // ── Platform ───────────────────────────────
  platform_version: string;     // "1.0.0" — AI Platform version
  platform_name: string;        // "AI Platform"

  // ── Product ────────────────────────────────
  product_name: string;         // "Concierge"
  product_version: string;      // "1.18.1"
  product_brand: string;        // "AG Synergy"
}
```

---

## 2. Health Endpoint

### 2.1 Response Contract

```typescript
// GET /api/v1/health
interface HealthResponse {
  status: "ok" | "degraded" | "down";
  service: string;
  version: string;                    // SERVICE_VERSION (from CHANGELOG.md)
  environment: string;
  timestamp: string;
  release: ReleaseMetadata;           // Full release metadata block
  // Existing fields maintained
  identity?: {
    issuer: string;
    jwks_url: string;
  };
  db: {
    status: "connected" | "error";
    migrations: number;
    last_migration: string;
  };
  uptime: number;
}
```

### 2.2 Example Response

```json
{
  "status": "ok",
  "service": "concierge-api",
  "version": "1.18.1",
  "environment": "production",
  "timestamp": "2026-07-27T10:00:00Z",
  "release": {
    "version": "1.18.1",
    "git_commit": "7a5b751abcd1234ef5678901234567890abcdef01",
    "deployment_id": "dep_abc123def456",
    "environment": "production",
    "timestamp": "2026-07-27T10:00:00Z",
    "branch": "main",
    "platform_version": "1.0.0",
    "platform_name": "AI Platform",
    "product_name": "Concierge",
    "product_version": "1.18.1",
    "product_brand": "AG Synergy"
  }
}
```

---

## 3. Metadata Sources

| Field | Source | Injection Method |
|-------|--------|-----------------|
| `version` | `CHANGELOG.md` | Auto-extracted to `version.ts` |
| `git_commit` | `git rev-parse HEAD` | CI/CD pipeline |
| `deployment_id` | UUID generation | CI/CD pipeline |
| `environment` | Environment config | `.env.<environment>` |
| `timestamp` | `Date.now()` | CI/CD pipeline |
| `branch` | `git rev-parse --abbrev-ref HEAD` | CI/CD pipeline |
| `platform_version` | `AI_PLATFORM_STATUS.md` | Platform config |
| `product_name` | Product config | `release.yaml` |
| `product_version` | `CHANGELOG.md` | Auto-extracted |
| `product_brand` | Product config | `release.yaml` |

---

## 4. Version Sourcing

### 4.1 Single Source of Truth

```
CHANGELOG.md
    │
    ├──▶ scripts/extract-version.sh
    │         │
    │         ▼
    │    workers/src/version.ts
    │         │
    │         ▼
    │    Health endpoint: GET /api/v1/health
    │
    ├──▶ Git tag: v<version>
    │
    ├──▶ PSER: deployment event
    │
    └──▶ Governance dashboards
```

### 4.2 Extract Version Script

```bash
#!/bin/bash
# scripts/extract-version.sh
# Extracts the latest version from CHANGELOG.md and writes to version.ts

VERSION=$(grep -m1 '^## \[' CHANGELOG.md | sed 's/## \[\(.*\)\].*/\1/')

cat > workers/src/version.ts << EOF
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
```

---

## 5. CI/CD Metadata Injection

### 5.1 Environment Variables

The CI/CD pipeline injects the following variables at build time:

| Variable | Source | Used By |
|----------|--------|---------|
| `GIT_COMMIT` | `git rev-parse HEAD` | Release metadata |
| `DEPLOYMENT_ID` | `uuidgen` | Release metadata |
| `DEPLOY_TIMESTAMP` | `date -u +%Y-%m-%dT%H:%M:%SZ` | Release metadata |
| `BRANCH_NAME` | `git rev-parse --abbrev-ref HEAD` | Release metadata |
| `SERVICE_VERSION` | `bash scripts/extract-version.sh` | version.ts |

### 5.2 Wrangler Pass-Through

```bash
# CI/CD pipeline injects these as Wrangler environment variables
export GIT_COMMIT=$(git rev-parse HEAD)
export DEPLOYMENT_ID=$(uuidgen)
export DEPLOY_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
export BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
export SERVICE_VERSION=$(grep -m1 '^## \[' CHANGELOG.md | sed 's/## \[\(.*\)\].*/\1/')
```

---

## 6. Deployment Identifier Format

Deployment IDs follow the format:

```
dep_<timestamp>_<short-sha>
```

Example: `dep_20260727T100000Z_7a5b751`

---

## 7. Metadata Storage

Release metadata is stored in:

1. **Health endpoint** — live runtime access
2. **PSER** — historical execution registry
3. **Git tags** — versioned release history
4. **CHANGELOG.md** — human-readable release log
5. **Governance dashboards** — program-level visibility

---

*Release Management Platform — AI Platform Capability*
*Release Metadata — v1.0.0*
*Last updated: 2026-07-27*