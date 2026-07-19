# Provider Abstractions (Mobility)

> **Status:** Planning only. Companion to [HERMES_PLATFORM.md](./HERMES_PLATFORM.md)
> and [ADR-005](../../docs/decisions/ADR-005-hermes-platform.md).

**Cloudflare is an implementation, not an architecture.** Business logic depends
on interfaces; changing providers means replacing adapters only.

---

## 1. Core Interfaces (defined in `shared/interfaces/`)

| Interface | Responsibility | Today (Cloudflare) | Future alt. |
|---|---|---|---|
| `DataStore` | Relational/structured data | D1 | SQLite, Postgres, Spanner |
| `ObjectStorage` | Blob/asset storage | R2 | S3, OCI Object Storage |
| `Queue` | Async message delivery | Queues | SQS, OCI Queue, NATS |
| `IdentityProvider` | Principal authn/authz | Org identity + app RBAC | OIDC, Auth0, Keycloak |
| `NotificationProvider` | Outbound notifications | Telegram/email | Slack, SMS, webhook |
| `Scheduler` | Time/recurring triggers | Cron / Queues | Cloud Scheduler, k8s CronJob |
| `SecretProvider` | Secret storage/retrieval | Cloudflare Secrets / wrangler | Vault, OCI Vault, AWS SM |
| `LoggingProvider` | Structured logs + audit | Workers logs + org audit | Loki, CloudWatch, OCI Logging |

---

## 2. Adapter Pattern

```
Application Business Logic
        │  depends on
        ▼
shared/interfaces/DataStore   (interface, no impl)
        │  implemented by
        ▼
hermes/providers/cloudflare/DataStoreD1.ts   (adapter — swappable)
```

- Business logic imports **only the interface**, never the adapter.
- Migrating providers = writing a new adapter under
  `hermes/providers/<provider>/` and repointing configuration.
- **Application code is untouched** during a provider change.

---

## 3. Mobility Guarantees

- ✅ Each application can move providers **independently** (its own adapters).
- ✅ The Organization Layer and other applications are **unaffected** by one
  app's migration.
- ✅ The AI Workforce is provider-agnostic (`supported_providers` field) — a
  worker runs on whatever backend its assignment permits.
- ✅ No application hard-codes `cloudflare:` URLs or Workers-only APIs in
  business logic.

---

## 4. What is NOT abstracted (intentionally)

- **Application business rules** stay in the app — they are not provider
  concerns.
- **Application-specific data schemas** stay in the app's migration set.
- The abstraction boundary is *infrastructure*, not *domain*.

This keeps the interface surface small and the mobility benefit high.
