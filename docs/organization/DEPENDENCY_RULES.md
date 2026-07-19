# Dependency Rules

> **Status:** Planning only. Companion to [HERMES_PLATFORM.md](./HERMES_PLATFORM.md)
> and [ADR-005](../../docs/decisions/ADR-005-hermes-platform.md).

Every component belongs to **exactly one scope** — Organization **or**
Application. Never both. Dependencies flow **one way only**.

---

## 1. Scope Ownership

| Scope | Owns | Must NOT own |
|---|---|---|
| **Organization** (incl. Hermes Platform) | Identity standards, AI workforce, security policies, audit framework, provider abstractions, governance, global config, shared libraries, cross-app services | Application business logic, app databases, app UI |
| **Application** | App identity, database, Worker, Pages, R2, KV, Queues, secrets, deployments, permissions, business rules, APIs, UI | Org-wide auth/security policy, other apps' data, Hermes internals |

---

## 2. One-Way Dependency Graph

```
organization/  ──►  shared/  ──►  hermes/  ──►  applications/<x>/
   (standards)      (interfaces)   (platform)      (business logic)
```

**Rules:**
1. `applications/*` **may** import from `shared/`, `organization/standards/`,
   and `hermes/` (platform services + interfaces).
2. `hermes/` **may** import from `shared/` and `organization/`.
3. `shared/` **may** import from `organization/standards/` only (never from
   apps or hermes internals).
4. `organization/` imports **nothing** from apps, hermes, or shared business
   code.
5. **No cross-application imports.** `applications/ags-finance/` cannot import
   from `applications/ags-fertility/`.
6. **No application imports another application's infrastructure client.**

---

## 3. Communication Across Boundaries

- **Application ↔ Application:** only through **documented APIs/contracts**.
  Never direct database access across boundaries.
- **Hermes worker ↔ Application:** worker calls the app's API using its scoped
  `permissions` (validated by the app's RBAC). Never direct DB access.
- **Platform service ↔ Application:** via the shared interface + the app's API.
- **Organization ↔ Application:** standards are *inherited*, not *called*;
  governance is *referenced*, not *imported as code*.

---

## 4. Enforcement

- **Lint/architecture test** (future, planning-only): a CI check asserts the
  import direction rules above (e.g. `dependency-cruiser` policy). Proposed in
  the roadmap but not implemented here.
- **Registry as contract:** AI assignments and service bindings are validated
  against the rules at activation time.

---

## 5. Violation Examples (forbidden)

❌ `applications/ags-finance/src` imports `applications/ags-fertility/src/db`
❌ `workers/` (app #1) imports `hermes/internal/activation-engine` directly
❌ Business logic imports `hermes/providers/cloudflare/DataStoreD1` (must use
   `shared/interfaces/DataStore`)
✅ App imports `shared/interfaces/DataStore` and is given the active adapter
✅ Hermes assigns a worker to App #1 via the registry; worker calls App #1's API
