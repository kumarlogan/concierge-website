# AI Workforce (Hermes-Owned)

> **Status:** Planning only. Companion to [HERMES_PLATFORM.md](./HERMES_PLATFORM.md)
> and [ADR-005](../../docs/decisions/ADR-005-hermes-platform.md).

The **AI Workforce is owned by Hermes** (Organization scope), not by any
application. Every worker is registered in the **AI Registry**, is `inactive`
until assigned, and accesses application data only through the application's
published API.

---

## 1. Registry Model

The AI Registry is the single source of truth. Each worker record contains:

| Field | Description |
|---|---|
| `id` | Unique worker identifier (stable, namespaced) |
| `name` | Human-readable name |
| `purpose` | What the worker does |
| `owner` | Responsible team/principal (org scope) |
| `application_assignment` | List of app IDs currently assigned (empty = unassigned) |
| `permissions` | Permission keys it requires from assigned apps |
| `status` | `inactive` / `active` / `deprecated` |
| `interfaces` | Channels it speaks (Telegram, dashboard, API, CLI) |
| `supported_providers` | Backends it can run on (model/infra) |
| `activation_state` | Whether it is currently live (`inactive` by default) |

**Inactive-by-default:** a worker is registered (metadata exists) but does
nothing until (a) `activation_state` → `active` and (b) at least one
`application_assignment` is set. Activation is **configuration, not code**.

---

## 2. Initial Worker Catalog (illustrative)

Hermes seeds the registry with organizational workers. None are active until
assigned to an application.

**Cross-application (org-wide) workers:**
Owner Assistant · Operations Assistant · Developer Assistant · Documentation
Assistant · Security Assistant · Compliance Assistant · Audit Assistant ·
Monitoring Assistant · Deployment Assistant · Analytics Assistant · Customer
Support Assistant · Knowledge Assistant · Reporting Assistant · Notification
Assistant · Scheduler Assistant · Research Assistant.

**Domain-specialized workers (assignable per app):**
Finance Assistant · Marketing Assistant · Sales Assistant · HR Assistant ·
Legal Assistant.

> Note: The Executive / Engineering / Medical / Intelligence families described
> in [ORGANIZATION_ARCHITECTURE.md](../organization/ORGANIZATION_ARCHITECTURE.md)
> are a superset view; this catalog is the Hermes-platform-owned baseline. The
> two are reconciled by treating all of them as registry entries under Hermes
> ownership.

---

## 3. Lifecycle

```
register (status=inactive, assignment=[])
        │
        ▼
assign to application(s)   ──►  application_assignment populated
        │
        ▼
activate (activation_state=active)   ──►  worker begins serving
        │
        ▼
deprecate (status=deprecated)   ──►  stops serving; history retained
```

No architectural change is required at any transition. Applications consume
assigned workers through the platform's agent-assignment contract; they never
import a worker's internals.

---

## 4. Boundary Enforcement

- A worker **may not** read another application's database directly. It calls
  the target app's API using scoped `permissions`.
- Worker `permissions` are validated by the **assigned application's** RBAC
  (e.g. today's `leads.read` model in Application #1), not by Hermes.
- Hermes owns the *registry and activation*; the *application owns the
  authorization* the worker must satisfy.

This preserves Application Isolation (ADR-004) while enabling a shared workforce.
