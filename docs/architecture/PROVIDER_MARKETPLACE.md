# EPIC-005 — Provider Marketplace

**Phase:** 5 — Runtime provider discovery
**Status:** Architecture-only. No source code modified.
**Date:** 2026-07-20

---

## 1. Purpose

The Marketplace is Hermes' **read-only runtime view** of all known providers and their live state. It answers the operator questions from the EPIC directly, by composing the Trust Model (Phase 4) lifecycle state, the Manifest (Phase 2) metadata, and Transport (Phase 3) health.

It is a **query surface**, not a registry writer. The Registry (capability.ts seam) owns capability registration; the Marketplace observes.

---

## 2. Marketplace Record

```ts
interface MarketplaceEntry {
  id: string;                 // provider id
  vendor: string;
  version: string;
  lifecycle: ProviderLifecycleState;  // DISCOVERED|VALIDATED|AUTHORIZED|AUTHENTICATED|LOADED|ACTIVE|SUSPENDED|RUNNING|REJECTED|UNLOADED
  trustLevel: "untrusted" | "sandbox" | "trusted" | "privileged";
  health: HealthStatus;       // healthy | degraded | unhealthy | unknown
  transports: TransportKind[];
  capabilities: string[];     // intention ids this provider can serve
  approval: {
    requiredByDefault: boolean;
    humanInLoop?: boolean;
  };
  deprecated: boolean;
  preferredFor: string[];     // intention ids this provider is preferred for
  lastHealthCheck?: string;   // ISO timestamp
  failureCount: number;       // consecutive failures (drives SUSPENDED)
}
```

---

## 3. Operator Questions → Marketplace Queries

| EPIC question | Query |
|---------------|-------|
| Which providers are installed? | `marketplace.list()` → all entries |
| Which are trusted? | `marketplace.list({ trustLevel: ["trusted","privileged"] })` |
| Which are healthy? | `marketplace.list({ health: "healthy" })` |
| Which support capability X? | `marketplace.list({ capability: "deploy.website" })` |
| Which require approval? | `marketplace.list({ approvalRequired: true })` |
| Which are offline? | `marketplace.list({ health: ["unhealthy","unknown"] })` |
| Which are deprecated? | `marketplace.list({ deprecated: true })` |
| Which are preferred? | `marketplace.get(id).preferredFor` |
| Which are rejected? | `marketplace.list({ lifecycle: "REJECTED" })` |

---

## 4. Data Flow

```
Provider Manifests ──▶ Trust Model (lifecycle + integrity)
                              │
Provider Transports ──▶ Health probes (Transform.health())
                              │
                              ▼
                   Marketplace (aggregates both)
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
  Selection Engine      Operator console       Audit/reports
  (Phase 6 picks)       (human visibility)     (compliance)
```

The Marketplace is **derived state** — it never mutates a provider. Mutations happen only through the Trust Model lifecycle (operator action or policy decision).

---

## 5. Health Aggregation

| Signal | Source | Effect on `health` |
|--------|--------|--------------------|
| Transport probe ok | `Transport.health()` | `healthy` |
| Transport probe slow | timeout within `healthyWithinMs` | `degraded` |
| Transport probe fail | exceeds `timeoutMs` | `unhealthy` |
| No probe configured | `probe: "none"` | `unknown` (still selectable if trusted) |
| Consecutive failures ≥ N | Trust Model counter | `unhealthy` + `SUSPENDED` |

---

## 6. Relationship to Other Phases

| Phase | Marketplace dependency |
|-------|------------------------|
| Phase 2 (Manifest) | Reads `capabilities`, `approval`, `deprecated`, `preferredFor` |
| Phase 3 (Transport) | Reads `transports`, drives `health` via `Transport.health()` |
| Phase 4 (Trust) | Reads `lifecycle`, `trustLevel`, `failureCount` |
| Phase 6 (Selection) | Consumes the filtered `list()` output as candidate set |
| Phase 7 (AGS) | AGS scenario queries the marketplace for `claude-code`, `github`, `cloudflare` |

---

## 7. Rules

- The Marketplace is **read-only** — it never loads, rejects, or changes a provider.
- Health is **transport-measured**, never provider-self-reported.
- `REJECTED` and `UNLOADED` providers remain visible (for audit/forensics) but are excluded from Selection by default.
- Adding a provider automatically appears in the Marketplace once it reaches `LOADED` — no separate registration.
- The Marketplace query API is the **only** supported way for operators/engines to ask "what can run" — no direct manifest inspection.
