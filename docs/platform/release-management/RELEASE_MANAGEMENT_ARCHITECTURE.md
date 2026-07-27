# Release Management Platform — Architecture

> **AI Platform Capability — Release Management Architecture**
> Standardized preview and production deployment workflows for all AGS products.
>
> **Version:** 1.0.0 — Architecture
> **Status:** Architecture Complete
> **Last Updated:** 2026-07-27

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Capability:     Release Management Platform
Document:       Release Management Architecture
Framework:      WEF v1.0 (Workforce Execution Framework)
```

---

## 1. Purpose

The Release Management Platform provides a **standardized, repeatable, and auditable** deployment workflow for all AGS products. It eliminates environment ambiguity, deployment inconsistencies, and ad-hoc release practices.

### 1.1 Design Principles

| Principle | Description |
|-----------|-------------|
| **Platform First** | All constructs are product-agnostic. Products configure, not extend. |
| **Deterministic** | Same commit → same deployment — no environment drift. |
| **Auditable** | Every deployment, promotion, and rollback is recorded. |
| **Fail-Closed** | Deployment gates block unless explicitly passed. |
| **Self-Service** | Products consume via interfaces, not custom pipelines. |
| **Environment Parity** | Preview and production environments are structurally identical. |

### 1.2 Scope

| In Scope | Out of Scope |
|----------|-------------|
| Deployment pipeline architecture | CI/CD runner implementation (GitHub Actions, etc.) |
| Environment model (Dev, Preview, Production) | Cloud provider provisioning |
| Preview → Production promotion flow | Runtime monitoring |
| Rollback architecture | Performance testing |
| Release metadata standard | Feature flags |
| Smoke test framework | Canary deployment |
| PSER integration | A/B testing |
| WEF integration | |

---

## 2. Deployment Lifecycle

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   DEVELOP    │────▶│   PREVIEW    │────▶│  PROMOTION   │────▶│  PRODUCTION  │
│              │     │              │     │    GATE      │     │              │
│ Local dev    │     │ Preview env  │     │ Smoke tests  │     │ Production   │
│ Unit tests   │     │ Integration  │     │ Rollback     │     │ env          │
│              │     │ tests        │     │ checkpoints  │     │ Health       │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                    │
                                                    ▼
                                              ┌──────────────┐
                                              │  ROLLBACK    │
                                              │              │
                                              │ Recovery     │
                                              │ PSER update  │
                                              └──────────────┘
```

### 2.1 Stage Definitions

| Stage | Purpose | Environment | Gate Required |
|-------|---------|-------------|---------------|
| **Develop** | Local development and testing | Local / Dev | No |
| **Preview** | Pre-production validation | Preview | No |
| **Promotion** | Preview → Production gate | N/A | Yes — smoke tests + operator approval |
| **Production** | Live deployment | Production | Yes — promotion gate |
| **Rollback** | Incident recovery | Production | Yes — operator approval |

### 2.2 Stage Lifecycle

```
───▶ DEVELOP ──▶ PREVIEW ──▶ PROMOTION_GATE ──▶ PRODUCTION ──▶ MONITOR ──▶
                              │                                    │
                              │ (fail)                             │ (issue)
                              ▼                                    ▼
                          FIX + RE-DEPLOY                     ROLLBACK
```

---

## 3. Environment Model

The environment model is a **reusable configuration template** that all products consume. Products do not define their own environments — they reference the platform model.

| Dimension | Development | Preview | Production |
|-----------|-------------|---------|------------|
| **Purpose** | Local development | Pre-production validation | Live service |
| **Data** | Local / seeded | Isolated copy (anonymized) | Real user data |
| **Secrets** | Local dev secrets | Preview secrets | Production secrets |
| **API Base** | `http://localhost:8787` | `https://preview.<product>.workers.dev` | `https://<product>.agsynergy.ca` |
| **Identity** | Dev identity provider | Preview identity provider | Production identity provider |
| **Trust Runtime** | Dev mode | Preview mode | Production mode |
| **Consent Runtime** | Dev mode | Preview mode | Production mode |
| **D1** | Local / preview D1 | Preview D1 | Production D1 |
| **KV** | Local / preview KV | Preview KV | Production KV |
| **R2** | Local / preview R2 | Preview R2 | Production R2 |
| **Workers** | `wrangler dev` | `wrangler deploy --env preview` | `wrangler deploy --env production` |
| **Pages** | Local dev server | Pages preview branch | Pages production branch |
| **Worker Bindings** | Dev bindings | Preview bindings | Production bindings |
| **Pages Configuration** | Dev config | Preview config | Production config |

### 3.1 Environment Variable Categories

| Category | Examples | Scope |
|----------|----------|-------|
| **API Endpoints** | `VITE_API_BASE`, `API_URL`, `IDENTITY_URL` | Per-environment |
| **Identity Endpoints** | `IDENTITY_AUTHORITY`, `OAUTH_URL`, `MFA_ISSUER` | Per-environment |
| **Trust Runtime** | `TRUST_EVALUATOR_URL`, `TRUST_THRESHOLD` | Per-environment |
| **Consent Runtime** | `CONSENT_SERVICE_URL`, `CONSENT_EXPIRY_DAYS` | Per-environment |
| **Worker Bindings** | `D1`, `KV`, `R2` namespaces | Per-environment |
| **Pages Configuration** | `PAGES_ACCOUNT_ID`, `PAGES_PROJECT_NAME` | Per-environment |
| **Secrets** | `API_KEY`, `JWT_SECRET`, `ENCRYPTION_KEY` | Per-environment, never in code |

### 3.2 Environment Configuration Storage

Environment configuration is stored in platform-managed config files, not in product code:

```
.env.development      — Developer machine defaults
.env.preview          — Preview environment values
.env.production       — Production environment values (secrets excluded)
```

Platform secrets are injected at deploy time via secret managers (Wrangler secrets, Cloudflare secret store, etc.).

---

## 4. VITE_API_BASE Standard

### 4.1 Problem

Environment ambiguity in API base URLs causes hard-to-debug issues where the frontend calls the wrong environment's API.

### 4.2 Standard

| Environment | `VITE_API_BASE` Value | Verified By |
|-------------|----------------------|-------------|
| Development | `http://localhost:8787` | `wrangler dev` |
| Preview | `https://preview.<product>.workers.dev` | Smoke test: API reachable |
| Production | `https://api.<product>.<domain>` | Smoke test: API reachable + TLS valid |

### 4.3 Recommended Implementation

```typescript
// Vite environment config — vite.config.ts
// VITE_API_BASE is set per-environment via .env files.
// No runtime detection — the value is baked at build time.

// Frontend: api-client.ts
const API_BASE = import.meta.env.VITE_API_BASE;
if (!API_BASE) {
  throw new Error("VITE_API_BASE is not defined. Set it in .env.<environment>");
}
```

### 4.4 Migration Strategy

1. **Audit** every `VITE_API_BASE` usage across all products — verify no hardcoded values
2. **Standardize** all `.env.*` files to use the standard values above
3. **Validate** each environment's API base with a smoke test
4. **Remove** fallback logic that guesses the environment

### 4.5 Validation Strategy

| Check | Command | Expected |
|-------|---------|----------|
| Development | `curl http://localhost:8787/api/v1/health` | 200 |
| Preview | `curl https://preview.<product>.workers.dev/api/v1/health` | 200 |
| Production | `curl https://api.<product>.<domain>/api/v1/health` | 200 + TLS |

---

## 5. Release Metadata

Every deployment must expose structured metadata through the health endpoint.

### 5.1 Metadata Fields

```typescript
interface ReleaseMetadata {
  version: string;           // Semantic version (e.g. "1.18.1")
  git_commit: string;        // Full SHA of deployed commit
  deployment_id: string;     // Unique deployment identifier
  environment: string;       // "development" | "preview" | "production"
  timestamp: string;         // ISO 8601 deployment timestamp
  branch: string;            // Git branch
  platform_version: string;  // AI Platform version
  product_version: string;   // Product version
}
```

### 5.2 Health Endpoint Contract

```typescript
// GET /api/v1/health
interface HealthResponse {
  status: "ok" | "degraded" | "down";
  service: string;
  version: string;             // SERVICE_VERSION from CHANGELOG.md
  environment: string;
  timestamp: string;
  release: ReleaseMetadata;    // Full release metadata
  // ... existing health fields
}
```

### 5.3 Source of Truth

- **Version**: `CHANGELOG.md` (single source, auto-extracted to `version.ts`)
- **Git Commit**: CI/CD pipeline injects `GIT_COMMIT` at build time
- **Deployment ID**: CI/CD pipeline generates UUID at deploy time
- **Environment**: Injected via environment config
- **Timestamp**: Generated at deploy time
- **Platform Version**: Read from `AI_PLATFORM_STATUS.md` or platform config
- **Product Version**: Read from product's `PRODUCT_STATUS.md`

---

## 6. Deployment Pipeline

### 6.1 Pipeline Stages

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   BUILD      │──▶│   DEPLOY     │──▶│   VERIFY     │──▶│   RECORD     │
│              │   │              │   │              │   │              │
│ Compile      │   │ wrangler     │   │ Smoke tests  │   │ PSER update  │
│ Package      │   │ deploy       │   │ Health check │   │ Release log  │
│ Tests        │   │ Pages        │   │ API test     │   │ Tag          │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

### 6.2 Pipeline Triggers

| Trigger | Environment | Automation |
|---------|-------------|------------|
| Push to `main` | Preview | Automatic |
| Promotion approval | Production | Manual + smoke test gate |
| Rollback | Production | Manual (operator approval) |

### 6.3 Pipeline Configuration

Products configure the pipeline through a platform-managed config file:

```yaml
# release.yaml — Product pipeline configuration
product: <product-name>
environments:
  preview:
    workers: <worker-name>         # Cloudflare Worker name
    pages: <pages-project>         # Cloudflare Pages project
    d1: <d1-database-name>         # D1 database
    kv: <kv-namespace-name>        # KV namespace
    r2: <r2-bucket-name>           # R2 bucket
    smoke_tests: <smoke-test-file> # Path to smoke test suite
  production:
    workers: <worker-name>         # Cloudflare Worker name (production)
    pages: <pages-project>         # Cloudflare Pages project (production)
    d1: <d1-database-name>         # D1 database (production)
    kv: <kv-namespace-name>        # KV namespace (production)
    r2: <r2-bucket-name>           # R2 bucket (production)
    smoke_tests: <smoke-test-file> # Path to smoke test suite
```

---

## 7. Promotion Process

### 7.1 Preview → Production Promotion

```
1. Developer merges to main
2. CI/CD auto-deploys to Preview environment
3. Smoke tests run on Preview
4. Operator reviews Preview health
5. Operator triggers promotion gate
6. Promotion gate:
   a. Run smoke tests on Preview
   b. Record PSER checkpoint
   c. Create rollback checkpoint
   d. Generate deployment metadata
7. CI/CD deploys to Production
8. Smoke tests run on Production
9. Health check on Production
10. PSER records successful deployment
```

### 7.2 Promotion Gate Criteria

| Criterion | Pass Condition |
|-----------|---------------|
| Build | Zero errors |
| Unit Tests | 100% pass rate |
| Smoke Tests (Preview) | All passing |
| Health Check (Preview) | 200 + correct metadata |
| Security Scan | Clean |
| Operator Approval | Manual approval |
| PSER Checkpoint | Checkpoint recorded |

### 7.3 Promotion Failure

If any gate criterion fails:
1. Promotion is **blocked** — production is not deployed
2. PSER records the failed promotion attempt
3. Operator is notified with failure details
4. Developer fixes the issue
5. Pipeline restarts from Preview deploy

---

## 8. PSER Integration

### 8.1 Checkpoints

The Release Management Platform records the following PSER events:

| Event | Trigger | Data |
|-------|---------|------|
| `deployment.started` | Pipeline begins | Environment, version, commit |
| `deployment.preview.completed` | Preview deploy done | Preview URL, smoke test results |
| `deployment.promotion.started` | Promotion gate triggered | Gate criteria evaluation |
| `deployment.promotion.approved` | Operator approves | Approver, timestamp |
| `deployment.promotion.denied` | Operator denies | Reason, timestamp |
| `deployment.production.completed` | Production deploy done | Production URL, health check |
| `deployment.rollback.started` | Rollback initiated | Reason, target version |
| `deployment.rollback.completed` | Rollback finished | Resolved version, health check |

### 8.2 Resume Point

After a successful deployment, PSER records a resume point containing:
- Deployed version and commit
- Environment
- Deployment ID
- Next action (e.g., "Monitor for 15 minutes" or "Proceed to next task")

---

## 9. WEF Integration

The Release Management Platform operates within the WEF v1.0 framework:

| WEF Phase | Release Management Activity |
|-----------|----------------------------|
| **Phase 0 — Verification** | Verify pipeline health, environment config, secrets |
| **Phase 1 — Planning** | Release planning, version assignment |
| **Phase 2 — Implementation** | Build, test, deploy to Preview |
| **Phase 3 — Validation** | Smoke tests, health checks, PSER checkpoints |
| **Phase 4 — Approval** | Operator promotion gate |
| **Phase 5 — Deployment** | Production deployment |
| **Phase 6 — Verification** | Post-deployment smoke tests, monitoring |
| **Phase 7 — Closeout** | Release log, CHANGELOG update, PSER record |

---

## 10. Release Approval Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  DEVELOPER   │     │  OPERATOR    │     │  PLATFORM    │
│              │     │              │     │              │
│ Merge to     │     │ Review       │     │ Run smoke    │
│ main         │     │ Preview      │     │ tests        │
│              │     │ health       │     │              │
│              │     │              │     │              │
│              │     │ Approve or   │     │ Record       │
│              │     │ deny         │     │ checkpoint   │
│              │     │ promotion    │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
```

### 10.1 Approval Roles

| Role | Responsibility |
|------|---------------|
| **Developer** | Merges code, verifies local tests |
| **Operator** | Reviews Preview health, approves promotion to Production |
| **Platform** | Runs smoke tests, records PSER checkpoints, enforces gates |

### 10.2 Emergency Approval

For hotfixes and critical security patches, the operator may bypass the promotion gate with a documented reason. The bypass is recorded in PSER and auditable.

---

## 11. Versioning Strategy

### 11.1 Version Format

```
MAJOR.MINOR.PATCH
```

| Component | Bump When | Example |
|-----------|-----------|---------|
| **MAJOR** | Breaking change | 2.0.0 |
| **MINOR** | Feature addition | 1.19.0 |
| **PATCH** | Bug fix | 1.18.2 |

### 11.2 Version Source

- **Single source of truth**: `CHANGELOG.md`
- **Auto-extracted to**: `workers/src/version.ts` (via `scripts/extract-version.sh`)
- **Exposed via**: Health endpoint `GET /api/v1/health`
- **Recorded in**: PSER deployment events

---

## 12. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     RELEASE MANAGEMENT PLATFORM                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐ │
│  │  Pipeline Service │   │ Environment Svc  │   │ Promotion Gate   │ │
│  │  ─────────────── │   │ ──────────────── │   │ ─────────────── │ │
│  │  Build           │   │ Config mgmt      │   │ Criteria eval    │ │
│  │  Deploy          │   │ Secrets mgmt     │   │ Smoke test gate  │ │
│  │  Verify          │   │ Bindings mgmt    │   │ Approval gate    │ │
│  │  Record          │   │                  │   │ Rollback gate    │ │
│  └──────────────────┘   └──────────────────┘   └──────────────────┘ │
│                                                                      │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐ │
│  │  Release Registry │   │  Smoke Test Svc  │   │  Rollback Svc    │ │
│  │  ─────────────── │   │ ──────────────── │   │ ─────────────── │ │
│  │  Version history  │   │ Home check       │   │ Checkpoint mgmt  │ │
│  │  Deploy history   │   │ API check        │   │ Recovery flow    │ │
│  │  Metadata store   │   │ Auth check       │   │ PSER integration │ │
│  │  Rollback history │   │ Health check     │   │                  │ │
│  └──────────────────┘   └──────────────────┘   └──────────────────┘ │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    PSER Integration Layer                        │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│ │
│  │  │ Execution │  │ Resume   │  │ Gate     │  │ Deployment       ││ │
│  │  │ Registry  │  │ Point    │  │ Service  │  │ History          ││ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘│ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    WEF Compliance Layer                          │ │
│  │  Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5     │ │
│  │  Verification  Planning   Impl.    Valid.    Approval   Deploy  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

*Release Management Platform — AI Platform Capability*
*Architecture document — v1.0.0*
*Last updated: 2026-07-27*