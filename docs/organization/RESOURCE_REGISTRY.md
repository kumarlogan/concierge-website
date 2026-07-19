# Resource Registry

> **Status:** Planning only. Companion to [ADR-006](../decisions/ADR-006-organization-resource-registry.md).
> **Epic:** EPIC-002-005B.

The **Resource Registry is the authoritative inventory of everything AGS owns**.
Hermes **discovers** infrastructure through it — it **never hardcodes** provider
endpoints, resource names, or topology.

---

## 1. Purpose

- Single source of truth for all infrastructure resources across orgs, apps,
  environments, and providers.
- Enables Hermes discovery, orchestration, governance, and future automation.
- Decouples Hermes logic from provider-specific topology.

---

## 2. Resource Schema (metadata only)

| Field | Description |
|---|---|
| `resource_id` | Unique, namespaced: `res:<org>:<app>:<env>:<type>:<name>` |
| `organization` | Owning org ID (L0) |
| `application` | Owning app ID (L1) |
| `environment` | Owning env ID (L2) |
| `provider` | `cloudflare` \| `oci` \| `aws` \| `azure` \| `gcp` \| `local` \| `unknown` |
| `region` | Provider region / zone (or `global`) |
| `resource_type` | See §3 |
| `name` | Human label |
| `status` | Lifecycle state (LIFECYCLE_MODEL.md) |
| `owner` | Responsible identity |
| `tags` | Free-form key/value for filtering |
| `dependencies` | `resource_id` list this resource depends on |
| `created` / `modified` | Timestamps |
| `version` | Schema/resource version |
| `health` | `healthy` \| `degraded` \| `unhealthy` \| `unknown` |
| `criticality` | `low` \| `medium` \| `high` \| `critical` |
| `lifecycle` | Lifecycle policy reference |

---

## 3. Supported Resource Types

**Known (explicitly modeled):**
`worker` · `pages` · `d1` · `r2` · `kv` · `queues` · `secrets` ·
`github_repository` · `oci_instance` · `docker_host` · `telegram_bot` ·
`webhook` · `cron` · `analytics` · `logging` · `monitoring`.

**Unknown / future:** the registry stores any `resource_type` string. Unknown
types are valid records — Hermes treats them as opaque but still discoverable,
filterable, and governed. **No schema redesign required** to register a new type.

---

## 4. Example Records

```
res:ags:fertility:prod:worker:ops-api
  provider=cloudflare region=global health=healthy criticality=high
  deps=[res:ags:fertility:prod:d1:ops-db]

res:ags:fertility:prod:d1:ops-db
  provider=cloudflare health=healthy criticality=critical

res:ags:fertility:prod:telegram_bot:ops-bot
  provider=cloudflare health=healthy criticality=medium

res:ags:cyber:dev:oci_instance:scan-node
  provider=oci region=us-ashburn-1 health=unknown criticality=low
```

---

## 5. Discovery Queries (Hermes reads, never assumes)

- "All production databases" → filter `environment=prod AND resource_type=d1`
- "Every staging Worker" → `environment=staging AND resource_type=worker`
- "Every Telegram Bot" → `resource_type=telegram_bot`
- "Unhealthy resources" → `health=unhealthy`
- "All resources owned by AGS Fertility" → `application=fertility`
- "Every OCI resource" → `provider=oci`

See DISCOVERY_MODEL.md for the full query contract.

---

## 6. Provider Neutrality

`provider` is a **data field**, not a code path. Hermes logic branches on
`resource_type` + `tags`, never on `provider`. Provider-specific behavior lives
in adapters (PROVIDER_ABSTRACTIONS.md). Adding a provider = new records with a
new `provider` value + a new adapter — **no registry redesign**.

---

## 7. Storage Note (planning)

The registry itself is an **Organization-scoped** resource. Its backing store is
a `DataStore` (shared/interfaces) — provider-agnostic. Whether it lives in D1,
Postgres, or elsewhere is an adapter decision, not an architecture one.
