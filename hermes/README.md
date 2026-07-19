# Hermes Platform

The **Hermes Platform** is the reusable, application-independent control plane of
the AGS Organization. It owns the AI workforce, shared security services
(identity, permissions, audit), provider abstractions, and agent registry.

Hermes owns **no application business logic**. Applications (AGS Fertility = #1,
and future apps) consume Hermes capabilities through stable contracts.

## Structure

| Directory | Responsibility |
|---|---|
| `identity/` | Identity resolution + principal building (extracted from `workers/src/auth`) |
| `permissions/` | Data-driven permission resolver + authorization middleware |
| `audit/` | Non-blocking audit event writer |
| `providers/` | Provider adapter skeletons + registry (Cloudflare is first adapter) |
| `contracts/` | Shared capability contracts between platform and apps |
| `agents/` | Agent registry + agent definitions |

## Extraction Source

All capabilities here were extracted from `workers/src/auth/` during
EPIC-002-006B without changing production behavior. The application continues to
import through `workers/src/auth/index.ts`, which now re-exports from Hermes.

See `docs/operations/EPIC-002-006B_EXECUTION_PLAN.md`.
