# Release Management — Deployment Pipeline

> **AI Platform Capability — Deployment Pipeline Design**
> Standardized build, deploy, verify, and record pipeline for all AGS products.
>
> **Version:** 1.0.0 — Architecture
> **Status:** Architecture Complete
> **Last Updated:** 2026-07-27

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Capability:     Release Management Platform
Document:       Deployment Pipeline
Framework:      WEF v1.0 (Workforce Execution Framework)
```

---

## 1. Pipeline Stages

The deployment pipeline consists of four sequential stages:

```
BUILD ──▶ DEPLOY ──▶ VERIFY ──▶ RECORD
```

### 1.1 Stage 1 — Build

| Step | Action | Validation |
|------|--------|------------|
| 1.1 | Checkout source code | Git commit exists |
| 1.2 | Install dependencies | Package manager lockfile valid |
| 1.3 | Run unit tests | 100% pass rate |
| 1.4 | Compile TypeScript | Zero errors |
| 1.5 | Build frontend | Zero errors |
| 1.6 | Package artifacts | Artifact hash generated |

### 1.2 Stage 2 — Deploy

| Step | Action | Validation |
|------|--------|------------|
| 2.1 | Select environment | Environment config valid |
| 2.2 | Inject environment variables | All required variables present |
| 2.3 | Deploy Workers | `wrangler deploy --env <environment>` |
| 2.4 | Deploy Pages | `wrangler pages deploy --branch <branch>` |
| 2.5 | Apply D1 migrations | `wrangler d1 migrations apply <db> --remote` |
| 2.6 | Set secret (if applicable) | `wrangler secret put <key>` |

### 1.3 Stage 3 — Verify

| Step | Action | Validation |
|------|--------|------------|
| 3.1 | Health check | `curl <url>/api/v1/health` → 200 |
| 3.2 | Release metadata check | Version, commit, environment match |
| 3.3 | Smoke tests | All smoke tests pass |
| 3.4 | Security scan | No secrets leaked |

### 1.4 Stage 4 — Record

| Step | Action | Validation |
|------|--------|------------|
| 4.1 | PSER deployment event | Event recorded |
| 4.2 | Git tag creation | Tag pushed |
| 4.3 | Release notes | CHANGELOG updated |
| 4.4 | Rollback checkpoint | Checkpoint metadata saved |

---

## 2. Preview Deployment Pipeline

### 2.1 Trigger

- Push to `main` branch (or any branch configured for preview)

### 2.2 Pipeline

```
1. BUILD
   - Checkout code
   - Install dependencies
   - Run unit tests
   - Compile
   - Build frontend

2. DEPLOY (Preview)
   - wrangler deploy --env preview
   - wrangler pages deploy --branch preview
   - wrangler d1 migrations apply <db> --remote

3. VERIFY (Preview)
   - curl https://preview.<product>.workers.dev/api/v1/health
   - Run smoke tests against preview URL
   - Verify release metadata

4. RECORD
   - PSER: deployment.preview.completed
   - Set resume point: "Promotion gate ready"
```

---

## 3. Production Deployment Pipeline

### 3.1 Trigger

- Manual promotion gate approval (operator)

### 3.2 Pipeline

```
1. PROMOTION GATE
   - Verify Preview is healthy
   - Run smoke tests on Preview
   - Record PSER checkpoint
   - Create rollback checkpoint
   - Operator approval

2. DEPLOY (Production)
   - wrangler deploy --env production
   - wrangler pages deploy --branch production
   - wrangler d1 migrations apply <db> --remote

3. VERIFY (Production)
   - curl https://<product>.<domain>/api/v1/health
   - Run smoke tests against production URL
   - Verify release metadata

4. RECORD
   - PSER: deployment.production.completed
   - Git tag: v<version>
   - CHANGELOG: mark as deployed
   - Set resume point: "Monitor for 15 minutes"
```

---

## 4. Rollback Pipeline

### 4.1 Trigger

- Operator-initiated rollback (via approval gate)

### 4.2 Pipeline

```
1. ROLLBACK GATE
   - Operator provides rollback reason
   - Operator selects target version
   - PSER records rollback attempt

2. DEPLOY (Previous Version)
   - wrangler deploy --env production --version <previous-commit>
   - wrangler pages deploy --branch <previous-branch>
   - D1 migration rollback (if applicable)

3. VERIFY
   - curl https://<product>.<domain>/api/v1/health
   - Run smoke tests
   - Verify release metadata shows rollback version

4. RECORD
   - PSER: deployment.rollback.completed
   - Set resume point: "Root cause analysis needed"
```

---

## 5. Pipeline Commands (Reference)

### 5.1 Workers Deploy

```bash
# Preview
cd workers && npx wrangler deploy --tsconfig tsconfig.json --env preview

# Production
cd workers && npx wrangler deploy --tsconfig tsconfig.json --env production
```

### 5.2 Pages Deploy

```bash
# Preview
cd artifacts/<product> && npx wrangler pages deploy --branch preview

# Production
cd artifacts/<product> && npx wrangler pages deploy --branch production
```

### 5.3 D1 Migrations

```bash
# Preview
npx wrangler d1 migrations apply <db> --remote

# Production
npx wrangler d1 migrations apply <db> --remote
```

### 5.4 Secrets

```bash
# Per environment
echo "<secret-value>" | npx wrangler secret put <KEY> --env <environment>
```

---

## 6. Failure Handling

| Failure Point | Action | Recovery |
|---------------|--------|----------|
| Build fails | Pipeline stops | Fix code, re-push |
| Deploy fails | Pipeline stops | Check env config, retry |
| Smoke test fails | Pipeline stops | Fix issue, re-deploy |
| Health check fails | Pipeline stops | Check worker, retry |
| Secrets missing | Pipeline stops | Set secrets, retry |
| D1 migration fails | Pipeline stops | Check migration, manual rollback |

---

## 7. Pipeline Configuration

Products configure their pipeline through a single config file:

```yaml
# release.yaml
product: <product-name>
version_scheme: semver
environments:
  preview:
    workers: <worker-name>
    pages: <pages-project>
    d1: <d1-database>
    kv: <kv-namespace>
    r2: <r2-bucket>
    smoke_tests: <smoke-test-file>
  production:
    workers: <worker-name>
    pages: <pages-project>
    d1: <d1-database>
    kv: <kv-namespace>
    r2: <r2-bucket>
    smoke_tests: <smoke-test-file>
gates:
  promotion:
    require_operator_approval: true
    require_smoke_tests: true
    require_health_check: true
  rollback:
    require_operator_approval: true
    require_reason: true
```

---

*Release Management Platform — AI Platform Capability*
*Deployment Pipeline — v1.0.0*
*Last updated: 2026-07-27*