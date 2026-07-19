# Infrastructure Inventory (Current State → Registry)

> **Status:** Planning only. Companion to [RESOURCE_REGISTRY.md](./RESOURCE_REGISTRY.md)
> and [ADR-006](../decisions/ADR-006-organization-resource-registry.md).
> **Epic:** EPIC-002-005B.

A **snapshot** of AGS's current infrastructure, expressed as Resource Registry
entries. This is the seed inventory Hermes will ingest — it is documentation of
reality, not a change to it.

---

## 1. Current Inventory (Application #1 — AGS Fertility)

| resource_id | type | provider | env | status | criticality |
|---|---|---|---|---|---|
| `res:ags:fertility:prod:worker:ops-api` | worker | cloudflare | production | active | high |
| `res:ags:fertility:prod:pages:web` | pages | cloudflare | production | active | medium |
| `res:ags:fertility:prod:d1:ops-db` | d1 | cloudflare | production | active | critical |
| `res:ags:fertility:prod:r2:assets` | r2 | cloudflare | production | active | medium |
| `res:ags:fertility:prod:kv:cache` | kv | cloudflare | production | active | low |
| `res:ags:fertility:prod:queues:ops-queue` | queues | cloudflare | production | active | low |
| `res:ags:fertility:prod:secrets:worker` | secrets | cloudflare | production | active | critical |
| `res:ags:fertility:prod:telegram_bot:ops-bot` | telegram_bot | cloudflare | production | active | medium |
| `res:ags:fertility:prod:github_repository:hermes-website` | github_repository | github | production | active | medium |
| `res:ags:fertility:prod:webhook:telegram` | webhook | cloudflare | production | active | medium |
| `res:ags:fertility:prod:cron:deploy` | cron | cloudflare | production | active | low |
| `res:ags:fertility:prod:logging:workers` | logging | cloudflare | production | active | low |
| `res:ags:fertility:prod:monitoring:health` | monitoring | cloudflare | production | active | low |

> All entries are `provider=cloudflare` today. The registry's `provider` field
> is what makes a future multi-cloud inventory possible without restructuring.

---

## 2. Coverage of Suggested Resource Types

| Suggested type | Present today? | Note |
|---|---|---|
| Worker | ✅ | `ops-api` |
| Pages | ✅ | `web` |
| D1 | ✅ | `ops-db` |
| R2 | ✅ | `assets` |
| KV | ✅ | `cache` |
| Queues | ✅ | `ops-queue` |
| Secrets | ✅ | `worker` |
| GitHub Repository | ✅ | `hermes-website` |
| OCI Instance | ❌ | future provider |
| Docker Host | ❌ | future |
| Telegram Bot | ✅ | `ops-bot` |
| Webhook | ✅ | `telegram` |
| Cron | ✅ | `deploy` |
| Analytics | ❌ | future |
| Logging | ✅ | `workers` |
| Monitoring | ✅ | `health` |

Missing types are simply **absent records** — the schema already supports them.

---

## 3. Future Inventory (illustrative)

When AGS Cyber joins on OCI:
```
res:ags:cyber:dev:oci_instance:scan-node     provider=oci
res:ags:cyber:prod:d1:cyber-db                provider=oci (or cloudflare)
res:ags:cyber:prod:worker:cyber-api           provider=cloudflare
```
Mixed providers per app/env are first-class — proven by the `provider` field.

---

## 4. Using the Inventory

Hermes reads this inventory via the Discovery Model (DISCOVERY_MODEL.md). No
resource is contacted by hardcoded name; Hermes queries the registry, then acts
through the appropriate adapter.
