# Organization Identity Model

> **Status:** Planning only. Companion to [ADR-004](../decisions/ADR-004-organization-architecture.md)
> and [ADR-005](../decisions/ADR-005-hermes-platform.md). ADR-006 ratifies this model.
> **Epic:** EPIC-002-005B.

Defines the **permanent identity hierarchy** for AGS. Every identity has its own
scope; **permissions never leak upward**.

---

## 1. Identity Hierarchy (top → bottom)

```
Organization Identity          (AGS)
└── Application Identity        (AGS Fertility, AGS Cyber, …)
    └── Environment Identity    (dev, test, staging, prod, sandbox, experimental)
        ├── Service Identity    (Worker, Pages, API, Bot)
        ├── AI Identity         (each registered worker — see AI_REGISTRY_V2.md)
        └── Human Identity      (owner, admin, ops, developer)
```

Each level is a **distinct identity scope**. An identity at level N can hold
permissions granted *at or below* its scope, never above.

---

## 2. Identity Scopes & Rules

| Level | Identity | Owns | Permission rule |
|---|---|---|---|
| L0 | **Organization** | Org policies, provider registry, AI workforce, global config | Grants org-wide roles only; never inherits app perms |
| L1 | **Application** | App identity, infra, deployments, app RBAC | Sees only its own app; cannot read sibling apps |
| L2 | **Environment** | Env-specific resources, secrets, deploy state | `prod` perms ≠ `dev` perms; isolated |
| L3a | **Service** | Its own credentials/calls | Scoped to the env+app it belongs to |
| L3b | **AI** | Its assigned capabilities + tools | Limited to assigned apps/envs; validated by app RBAC |
| L3c | **Human** | Personal role within app/env | Least-privilege; no cross-app by default |

**No upward leak:** a Human identity in `AGS Fertility / prod` cannot acquire
`AGS Cyber` permissions, nor org-level permissions, without an explicit,
separate grant at that higher scope.

---

## 3. Identity Attributes (metadata)

Every identity record carries:
- `id` (namespaced: `org:<o>` / `app:<o>:<a>` / `env:<o>:<a>:<e>` / `svc:…` / `ai:…` / `human:…`)
- `parent_id` (the identity one level up)
- `scope` (L0–L3)
- `type` (organization | application | environment | service | ai | human)
- `status` (see LIFECYCLE_MODEL.md)
- `owner`
- `created` / `modified`

---

## 4. Mapping to Today (Application #1)

| Today | Identity classification |
|---|---|
| `kumarlogan` GitHub org | Org Identity (L0) |
| `hermes-website` repo / AGS Fertility | Application Identity (L1) |
| `wrangler.jsonc` deploy target | Environment Identity (L2, prod) |
| `workers/` Cloudflare Worker | Service Identity (L3a) |
| Telegram bot (callOps) | Service + AI Identity (L3a + L3b, assigned to App #1) |
| `users` table + RBAC (`leads.read`…) | Human Identity (L3c) within App #1 |

No code change implied — this is the formal classification ADR-004 Phase 1–2 will enact.

---

## 5. Future-Proofing

- **Unlimited organizations:** L0 is keyed by `org:<o>`; a second org is just
  another L0 root with its own subtree.
- **Unlimited AI:** each AI identity is a leaf under the env/app it's assigned
  to (or org-wide if unassigned) — see AI_REGISTRY_V2.md.
- **No redesign** when adding orgs/apps/envs/agents: the hierarchy is a tree keyed
  by composite IDs; new nodes attach without restructuring existing ones.
