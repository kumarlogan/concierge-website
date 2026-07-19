# AI Registry V2

> **Status:** Planning only. Expands the AI Registry from ADR-005 / AI_WORKFORCE.md.
> Companion to [ADR-006](../decisions/ADR-006-organization-resource-registry.md).
> **Epic:** EPIC-002-005B.

Supersedes the AI Registry schema in `AI_WORKFORCE.md` with a richer V2 record
that supports **unlimited future AI workers without redesign**.

---

## 1. V2 Record Schema

| Field | Description |
|---|---|
| `agent_id` | Unique, namespaced: `ai:<org>:<name>` (or `ai:<org>:<app>:<name>`) |
| `name` | Human label |
| `description` | Summary of role |
| `role` | Functional category (executive / engineering / ops / business / medical / intelligence) |
| `capabilities` | What it can do (skills, task types) |
| `interfaces` | Channels it speaks (telegram, dashboard, api, cli) |
| `applications` | App IDs assigned to (empty = org-wide/unassigned) |
| `environment_scope` | Envs it may operate in (`prod`, `dev`, `*` = any) |
| `provider` | Backend it runs on (model/infra) — data field, adapter-swappable |
| `version` | Worker version |
| `status` | Lifecycle: `inactive` \| `assigned` \| `active` \| `retired` (LIFECYCLE_MODEL.md) |
| `health` | `healthy` \| `degraded` \| `unhealthy` \| `unknown` |
| `owner` | Responsible team/principal |
| `memory` | Memory store reference (scoped, never cross-app) |
| `knowledge_sources` | Allowed knowledge bases / docs |
| `tools` | Tool/function set it may invoke |
| `dependencies` | Other agent IDs or services it requires |
| `activation_state` | `inactive` (default) / `active` |
| `last_activity` | Timestamp of last action |
| `security_classification` | `public` \| `internal` \| `confidential` \| `restricted` |
| `identity_ref` | Links to Identity Model AI identity (IDENTITY_MODEL.md, L3b) |

---

## 2. Lifecycle (AI-specific)

```
inactive ──assign──► assigned ──activate──► active ──retire──► retired
   (registered,       (bound to app(s),     (serving)          (history kept)
    no assignment)    env scope set)
```

Activation is **configuration only** — no code change, no redesign.

---

## 3. Isolation & Scope

- An agent's `applications` + `environment_scope` define its blast radius.
- `memory` and `knowledge_sources` are **scoped per assignment** — an agent
  assigned to AGS Fertility cannot read AGS Cyber memory.
- `security_classification` gates which data the agent may touch; `restricted`
  agents require explicit org-level grant.
- Permissions the agent needs are validated by the **target app's RBAC**
  (e.g. today's `leads.read` model) — Hermes owns activation, the app owns authz.

---

## 4. Future-Proofing

- **New agent types:** just a new `role` + record. No schema change.
- **New providers:** set `provider` + supply adapter. No redesign.
- **New capabilities/tools:** extend `capabilities` / `tools` arrays.
- **Unknown fields:** registry tolerates extra metadata; V2 is additive over V1.

---

## 5. Example (Application #1 today)

```
ai:ags:fertility:ops-bot
  role=operations  capabilities=[lead_read, lead_update, assign, dashboard]
  interfaces=[telegram]  applications=[fertility]  environment_scope=prod
  provider=cloudflare-workers  status=active  activation_state=active
  security_classification=internal  identity_ref=ai:ags:fertility:ops-bot
```

This matches the existing Telegram Operations Bot, now formally a registered,
assigned, active agent.
