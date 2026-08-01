# Deployment Evidence Model

## Purpose

Standardized evidence collection for every release. Reuses the model established in EPIC-013 (Wave 4).

## Evidence Fields

| Field | Type | Description |
|-------|------|-------------|
| wave | number | Wave number |
| product | string | Product name |
| capability | string | Capability name |
| version | string | Version tag |
| commit | string | Git commit hash |
| tag | string | Git tag |
| timestamp | string | ISO 8601 timestamp |
| deployment.environment | string | preview / production |
| deployment.status | string | attempted / succeeded / failed / blocked |
| deployment.url | string | Preview or production URL |
| deployment.id | string | Cloudflare deployment ID |
| deployment.reason | string | Reason if blocked or failed |
| quality_gates | object | Results of all certification gates |
| foundation_changes | string | Description of any foundation changes (should be NONE) |
| governance_bypasses | number | Count of governance bypasses (should be 0) |

## Quality Gates

| Gate | Expected |
|------|----------|
| Build | PASS |
| Typecheck | PASS |
| Import Integrity | PASS |
| Unit Tests | PASS |
| Required Files | All present |
| No Placeholder Content | Clean |
| Accessibility | PASS |
| Performance | PASS |
| Security | PASS |
| Smoke Tests | PASS |
| Health Checks | PASS |

## Reuses

- Deployment Evidence Model from EPIC-013 (Wave 4)
- Same JSON schema as WAVE4_DEPLOYMENT_EVIDENCE.json
- Same verification gates from RELEASE_GATES.md
