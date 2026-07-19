# Hermes Platform Services

> **Status:** Planning only. Companion to [HERMES_PLATFORM.md](./HERMES_PLATFORM.md)
> and [ADR-005](../../docs/decisions/ADR-005-hermes-platform.md).

Hermes delivers **cross-application capabilities as platform services**. These
are Organization-scoped and exposed through the shared interfaces — never as
application business logic.

---

## 1. Service Catalog

| Service | Responsibility | Consumed via |
|---|---|---|
| **AI Registry Service** | CRUD + lookup of worker records | `AIRegistry` interface |
| **AI Activation Service** | Toggle `activation_state`; validates assignment before activate | `AIRegistry` interface |
| **Agent Assignment Service** | Bind/unbind workers ↔ applications; enforce boundary rules | `AIRegistry` interface |
| **Organization Governance Service** | ADR process, standards registry, new-app onboarding checklist | org API |
| **Shared Notification Service** | Send notifications across providers (Telegram, email, SMS) | `NotificationProvider` interface |
| **Shared Scheduler Service** | Time-based / recurring triggers | `Scheduler` interface |
| **Organization Audit Service** | Receive + store org-level audit events from apps | `LoggingProvider` / audit interface |
| **Shared Identity Service** | Org identity resolution; maps principals to apps | `IdentityProvider` interface |
| **Secret Broker Service** | Provides per-app secrets to authorized platform services | `SecretProvider` interface |
| **Observability Service** | Aggregated logging/metrics across apps (read-only) | `LoggingProvider` interface |

---

## 2. Service Ownership Rules

- **Platform services own orchestration, not business data.** The Notification
  Service knows *how* to send; it does not know *what* a lead is.
- **Applications call services through interfaces.** A service implementation
  may change provider (e.g. Notification: Telegram → Slack) with zero app
  change.
- **No service reads application databases directly.** It invokes the app's API
  using the calling worker's scoped permissions.
- **Services are themselves org-scoped components** — they belong to Hermes, not
  to any application.

---

## 3. How Application #1 Uses Platform Services Today (classification)

Today's AGS Fertility bot already demonstrates the pattern informally:

- The Telegram bot (Application #1) is a *consumer* of Hermes
  Engineering/Operations workers.
- Its RBAC (`leads.read`, etc.) is the **application-owned authorization** that
  assigned workers must satisfy.

The platform formalizes this: the bot becomes a first-class assignment of Hermes
workers to Application #1, governed by the AI Registry.

---

## 4. Extending Services

New platform services are added by:
1. Defining an interface in `shared/interfaces/`.
2. Implementing an adapter in `hermes/` (provider-specific).
3. Registering the service in the Organization Governance Service.

Applications opt in via the interface — no cross-application code coupling.
