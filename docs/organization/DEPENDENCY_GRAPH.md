# Dependency Graph

> **Status:** Planning only. Companion to [DEPENDENCY_RULES.md](./DEPENDENCY_RULES.md)
> and [ADR-006](../decisions/ADR-006-organization-resource-registry.md).
> **Epic:** EPIC-002-005B.

Documents the allowed relationships between organizational layers and the
forbidden ones. Enforces Application Isolation and the one-way dependency rule.

---

## 1. Hierarchy (top → bottom)

```
Organization
└── Application
    └── Environment
        ├── Resources
        ├── Services
        ├── Agents (AI)
        └── Users (Human)
```

Each arrow is a **containment / ownership** edge. Lower nodes inherit the scope
of their parent but **never acquire permissions above it** (IDENTITY_MODEL.md).

---

## 2. Allowed Dependencies

| From | To | Rule |
|---|---|---|
| Organization | Application | Owns/registers it |
| Application | Environment | Owns/creates it |
| Environment | Resource | Owns/provisions it |
| Environment | Service | Hosts it |
| Environment | Agent | Assigns (via AI Registry) |
| Environment | User | Grants role within env |
| Resource | Resource | `dependencies` field (same app+env only) |
| Service | Resource | Same app+env only |
| Agent | Application API | Via published API + scoped perms (cross-env forbidden for prod) |
| Agent | Service | Via interface, same assignment scope |

**Same-scope rule:** resource-to-resource and service-to-resource dependencies
must stay within the **same `(application, environment)`** unless explicitly
approved (e.g. staging seeded from a prod *backup*, not live prod).

---

## 3. Forbidden Dependencies

❌ Application A reads Application B's database directly.
❌ Dev environment writes to Production resources.
❌ Agent assigned to App #1 calls App #2's internal infra (must use App #2 API,
   and only if assigned + permitted).
❌ Human identity leaks upward (Fertility ops → org admin) without separate grant.
❌ Hermes hardcodes a resource location instead of discovering it.
❌ Shared production infrastructure across environments (violates ENVIRONMENT_MODEL.md).
❌ Business logic imports a provider adapter directly (must use `shared/interfaces`).

---

## 4. Registry as the Edge Store

Every allowed edge is either:
- **Structural** (org→app→env→resource) — encoded in the resource's
  `organization`/`application`/`environment` fields, or
- **Explicit** (resource deps, agent assignments) — encoded in `dependencies`
  and AI Registry `applications`/`environment_scope`.

Hermes validates edges against this graph before any action. Forbidden edges
are rejected at activation/assignment time.

---

## 5. Diagram (text)

```
        Organization (AGS)
              │ owns
        Application (Fertility)
              │ owns
        Environment (prod)
         ┌────┼──────────────┐
      Resources            Services          Agents (AI)
      (Worker,            (API, Bot)        (ops-bot → calls API
       D1, R2, KV,         │                  via leads.read)
       Queues,             └── calls ──► D1
       Secrets)                  (same env)
              │ deps
              └── D1 ◄── Worker
```

No arrow crosses an application or environment boundary except via a published
API + explicit assignment.
