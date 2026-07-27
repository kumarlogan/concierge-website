# Release Management — Environment Strategy

> **AI Platform Capability — Environment Strategy Design**
> Reusable environment model for all AGS products.
>
> **Version:** 1.0.0 — Architecture
> **Status:** Architecture Complete
> **Last Updated:** 2026-07-27

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Capability:     Release Management Platform
Document:       Environment Strategy
Framework:      WEF v1.0 (Workforce Execution Framework)
```

---

## 1. Environment Model

A single reusable environment model that supports three tiers:

| Tier | Name | Purpose | Data Isolation | Secrets |
|------|------|---------|---------------|---------|
| Tier 1 | Development | Local development and testing | Local / seeded | Dev secrets |
| Tier 2 | Preview | Pre-production validation | Isolated copy | Preview secrets |
| Tier 3 | Production | Live service | Real user data | Production secrets |

### 1.1 Tier Characteristics

All tiers share the same structural architecture. They differ only in:
- Data source and isolation level
- Secrets and credentials
- API endpoints
- Observability configuration

---

## 2. Environment Configuration

### 2.1 Configuration File Structure

```
.env                        — Shared defaults (all environments)
.env.development            — Development overrides
.env.preview                — Preview overrides
.env.production             — Production overrides (secrets excluded)
```

### 2.2 Required Configuration

```yaml
# Environment configuration — all fields required
environment:
  name: "<development|preview|production>"
  api_base_url: "<url>"
  identity:
    authority: "<identity-provider-url>"
    issuer: "<jwt-issuer>"
    mfa_issuer: "<mfa-app-name>"
  trust_runtime:
    evaluator_url: "<trust-evaluator-url>"
    threshold: "<trust-threshold>"
  consent_runtime:
    service_url: "<consent-service-url>"
    expiry_days: <days>
  workers:
    name: "<worker-name>"
    env: "<wrangler-environment-name>"
  pages:
    project: "<pages-project-name>"
    branch: "<pages-branch>"
  d1:
    database: "<d1-database-name>"
  kv:
    namespace: "<kv-namespace-name>"
  r2:
    bucket: "<r2-bucket-name>"
```

### 2.3 Secrets Management

| Secret | Scope | Storage |
|--------|-------|---------|
| `JWT_SECRET` | Per-environment | Wrangler secret |
| `ENCRYPTION_KEY` | Per-environment | Wrangler secret |
| `API_KEY` | Per-environment | Wrangler secret |
| `TELEGRAM_BOT_TOKEN` | Per-environment | Wrangler secret |
| `IDENTITY_CLIENT_SECRET` | Per-environment | Wrangler secret |
| `OAUTH_CLIENT_SECRET` | Per-environment | Wrangler secret |

**Rules:**
- Secrets are never stored in code or configuration files
- Secrets are injected at deploy time via `wrangler secret put`
- Each environment has its own secret scope
- Secret rotation is tracked in PSER

---

## 3. Worker Bindings

### 3.1 Standard Binding Template

```jsonc
// wrangler.jsonc — Environment binding template
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "agsynergy-db",
      "database_id": "<preview-or-production-id>"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "KV",
      "id": "<kv-namespace-id>"
    }
  ],
  "r2_buckets": [
    {
      "binding": "R2",
      "bucket_name": "<bucket-name>"
    }
  ],
  "env": {
    "preview": {
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "agsynergy-db",
          "database_id": "<preview-db-id>"
        }
      ],
      "kv_namespaces": [
        {
          "binding": "KV",
          "id": "<preview-kv-id>"
        }
      ],
      "r2_buckets": [
        {
          "binding": "R2",
          "bucket_name": "<preview-bucket>"
        }
      ]
    },
    "production": {
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "agsynergy-db",
          "database_id": "<production-db-id>"
        }
      ],
      "kv_namespaces": [
        {
          "binding": "KV",
          "id": "<production-kv-id>"
        }
      ],
      "r2_buckets": [
        {
          "binding": "R2",
          "bucket_name": "<production-bucket>"
        }
      ]
    }
  }
}
```

### 3.2 Binding Naming Convention

| Resource | Binding Name | Format |
|----------|-------------|--------|
| D1 Database | `DB` | Always `DB`, per-environment configurations |
| KV Namespace | `KV` | Always `KV`, per-environment configurations |
| R2 Bucket | `R2` | Always `R2`, per-environment configurations |
| Queue | `QUEUE` | Always `QUEUE`, per-environment configurations |

---

## 4. Pages Configuration

### 4.1 Standard Pages Template

```jsonc
// pages/wrangler.toml
name = "<product>-pages"
compatibility_date = "2024-12-01"

[env.preview]
routes = [{ pattern = "preview.<product>.workers.dev", zone_id = "<zone-id>" }]
d1_databases = [{ binding = "DB", database_name = "<db>", database_id = "<preview-db-id>" }]

[env.production]
routes = [{ pattern = "<product>.<domain>", zone_id = "<zone-id>" },
          { pattern = "www.<product>.<domain>", zone_id = "<zone-id>" }]
d1_databases = [{ binding = "DB", database_name = "<db>", database_id = "<production-db-id>" }]
```

---

## 5. Environment Promotion Rules

| Rule | Description | Enforcement |
|------|-------------|-------------|
| **No production data in preview** | Preview environments use anonymized or synthetic data | Pipeline gate |
| **No preview secrets in production** | Secret scopes are isolated by environment | Wrangler env isolation |
| **Same Worker version** | Preview and production run the same worker version | Pipeline verifies |
| **Same migration state** | D1 migrations are applied to both environments | Migration check gate |
| **Environment label** | Every deployment is tagged with its environment name | Release metadata |

---

## 6. Future Product Adoption

When a new product adopts the platform environment model:

1. **Register** the product in the pipeline configuration
2. **Create** environment config files (`.env.development`, `.env.preview`, `.env.production`)
3. **Provision** resoures (D1 databases, KV namespaces, R2 buckets) per environment
4. **Set** secrets per environment
5. **Configure** wrangler.jsonc with environment bindings
6. **Verify** smoke tests pass on all environments
7. **Record** in PSER as a new product deployment

No changes to the environment model are required — the model is product-agnostic.

---

*Release Management Platform — AI Platform Capability*
*Environment Strategy — v1.0.0*
*Last updated: 2026-07-27*