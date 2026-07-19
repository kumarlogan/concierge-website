# Shared

Cross-application shared code consumed **by contract only**.

| Directory | Responsibility |
|---|---|
| `interfaces/` | Provider abstraction interfaces (IdentityProvider, PermissionProvider, AuditProvider, DataStore, ObjectStorage, Queue, NotificationProvider, Scheduler, SecretProvider, LoggingProvider). Definitions only — Cloudflare implementations are NOT replaced here. |
| `contracts/` | Shared data contracts between applications and the Hermes Platform. |

## Rules

- Applications import from `shared/interfaces` and `shared/contracts` by contract.
- No provider-specific implementation lives here.
- No application business logic lives here.

See `docs/organization/DEPENDENCY_RULES.md` and ADR-004/005.
