# Environment Model

> **Status:** Planning only. Companion to [ADR-006](../decisions/ADR-006-organization-resource-registry.md).
> **Epic:** EPIC-002-005B.

Each application supports **independent environments**. Every environment owns
**completely independent resources** — **no shared production infrastructure**.

---

## 1. Standard Environments

| Env | Purpose | Isolation rule |
|---|---|---|
| `development` | Active coding | Own resources; may share provider account with test |
| `testing` | Automated/e2e | Own data; isolated from prod |
| `staging` | Pre-prod mirror | Near-prod shape; **separate** from prod infra |
| `production` | Live | Exclusive resources; nothing else touches these |
| `sandbox` | throwaway experiments | Ephemeral; disposable |
| `experimental` | future/beta features | Isolated; no prod dependency |

New environments are just new `environment` ID values — **no redesign**.

---

## 2. Isolation Guarantees

- Each `(application, environment)` pair gets its **own** Resource Registry
  entries: own Worker, Pages, D1, R2, KV, Queues, Secrets.
- **Production is sacred:** `env=production` resources are referenced only by
  `env=production` identities. Dev/test/staging/sandbox/experimental never read
  or write prod resources.
- Cross-environment access is forbidden by the dependency rules
  (DEPENDENCY_GRAPH.md): an env may depend *downward* (prod data is sourced from
  nothing; staging may be seeded *from a backup*, not live prod) but never
  *upward* or *sideways* into prod.

---

## 3. Identity Mapping

Environment Identity (L2) sits under Application Identity (L1):
`env:<org>:<app>:<env>`. Permissions are scoped per environment — a `prod` role
and a `dev` role are distinct grants.

---

## 4. Provider Independence per Environment

An application may use **different providers per environment**:
- `AGS Fertility / prod` → Cloudflare
- `AGS Fertility / dev` → Local or OCI

The Resource Registry records the `provider` per resource, so Hermes discovers
the right backend per env without hardcoding.

---

## 5. Today → Target (Application #1)

Today `hermes-website` deploys one Cloudflare target (`wrangler.jsonc`). The
model classifies it as `env:ags:fertility:production`. Adding `development` /
`staging` means creating separate Registry entries + separate Cloudflare
namespaces/secrets — structural only, no business-logic change.
