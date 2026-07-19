# Discovery Model

> **Status:** Planning only. Companion to [RESOURCE_REGISTRY.md](./RESOURCE_REGISTRY.md)
> and [ADR-006](../decisions/ADR-006-organization-resource-registry.md).
> **Epic:** EPIC-002-005B.

Hermes **discovers** infrastructure through the Resource Registry. It **never
hardcodes** endpoints, names, or topology. This document defines the discovery
contract.

---

## 1. Principle

> Hermes logic says *what* it needs ("the prod databases for AGS Fertility").
> The registry says *where* they are. The adapter says *how* to talk to them.

No Hermes code contains a literal `cloudflare.com/...` resource path or a
hardcoded app/env list.

---

## 2. Query Contract (logical)

A discovery query is a **filter** over registry fields:

```
DISCOVER WHERE <field> <op> <value> [AND <field> <op> <value> …]
```

Supported fields: `organization`, `application`, `environment`, `provider`,
`region`, `resource_type`, `status`, `health`, `criticality`, `tags`,
`owner`, `name`.

Operators: `=`, `!=`, `IN`, `LIKE`, `IS_NULL`.

---

## 3. Example Queries (from the brief)

| Question | Query |
|---|---|
| Show all production databases | `environment=prod AND resource_type=d1` |
| Show every staging Worker | `environment=staging AND resource_type=worker` |
| Show every Telegram Bot | `resource_type=telegram_bot` |
| Show unhealthy resources | `health=unhealthy` |
| Show all resources owned by AGS Fertility | `application=fertility` |
| Show every OCI resource | `provider=oci` |
| Show critical prod resources in bad health | `environment=prod AND criticality=critical AND health!=healthy` |
| Show everything in sandbox about to expire | `environment=sandbox AND lifecycle=sandbox-ttl` |

---

## 4. Resolution Flow

```
1. Hermes issues DISCOVER query
2. Registry returns matching resource_id list (+ metadata)
3. For each resource, Hermes selects the adapter for its `provider`
4. Adapter performs the actual operation (read health, list, etc.)
```

The provider is **read from the record**, never assumed.

---

## 5. Future Dashboard Feeds

The same query contract powers dashboards (org / app / infra / ops / AI /
monitoring) — each dashboard is a saved query over the registry. No redesign
when a new dashboard is added; it's a new saved query.

---

## 6. Unknown Types & Providers

A query on `resource_type=unknown_future_type` or `provider=futurecloud`
returns whatever records exist. Hermes treats them as discoverable metadata;
only operations needing a missing adapter are skipped (with a clear
"no adapter" signal), never a hard failure.
