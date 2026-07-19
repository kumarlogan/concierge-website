# Lifecycle Model

> **Status:** Planning only. Companion to [ADR-006](../decisions/ADR-006-organization-resource-registry.md).
> **Epic:** EPIC-002-005B.

Every resource and AI agent has a **lifecycle state**. States are explicit,
queryable, and drive Hermes automation (discovery, cleanup, alerts).

---

## 1. Resource Lifecycle

| State | Meaning | Hermes behavior |
|---|---|---|
| `planning` | Designed, not yet provisioned | Discoverable; not acted on |
| `provisioning` | Being created | Watched; not yet serving traffic |
| `active` | Serving | Normal discovery + monitoring |
| `maintenance` | Temporarily offline for upkeep | Suppressed alerts; no deploy |
| `suspended` | Intentionally paused | No traffic; retained |
| `archived` | Retained, cold | Not in active discovery by default |
| `deleted` | Removed | Soft-delete record retained for audit |

---

## 2. AI Agent Lifecycle (overlays resource states)

| State | Meaning |
|---|---|
| `inactive` | Registered, unassigned, not serving (default) |
| `assigned` | Bound to app(s) + env scope; not yet active |
| `active` | Serving assigned apps |
| `retired` | Stopped; history retained (maps to `archived`/`deleted` for cleanup) |

---

## 3. State Transitions (allowed)

```
planning → provisioning → active ⇄ maintenance
active → suspended → active
active → archived → deleted (soft)
inactive → assigned → active → retired
```

**Forbidden:** `deleted → active` (must be re-provisioned); `suspended →
provisioning` (wrong direction).

---

## 4. Status vs Lifecycle

- `status` (lifecycle state) = where it is in its arc.
- `health` (from Resource Registry) = how well it's running *while active*.
- A resource can be `active` but `health=unhealthy` → Hermes alerts.

---

## 5. Lifecycle Policies

Each resource references a `lifecycle` policy (e.g. "sandbox auto-deletes after
7 days", "archived after 90 days suspended"). Policies are org-standardized
(Organization scope) and applied per resource via tags — not hardcoded in Hermes.

---

## 6. Discovery Interaction

Discovery queries filter on lifecycle: "show unhealthy **active** resources",
"list everything in **planning** for AGS Cyber". Lifecycle is a first-class query
dimension (DISCOVERY_MODEL.md).
