# EPIC-003-006 — Completion Report

**Epic:** Platform Hardening & Boundary Segregation
**Completed:** 2026-07-20
**Status:** ✅ M1–M7 complete; validated; ready for commit

---

## What was delivered

| Milestone | Deliverable | Key files |
|-----------|-------------|-----------|
| M1 | Fix Hermes source type errors + quarantine legacy `api-server` | `hermes/admin/ui-contracts.ts`, `hermes/admin/console/app.ts`, `hermes/services/discovery/discovery.ts`, `artifacts/api-server/package.json` |
| M2 | Agent registration contract hardening | `shared/contracts/lifecycle.ts`, `shared/contracts/resource.ts`, `hermes/agents/registry.ts` |
| M3 | Audit persistence boundary | `shared/interfaces/audit.ts`, `hermes/audit/event.ts`, `hermes/audit/store.ts` |
| M4 | Tenant/org boundary declaration | `hermes/contracts/platform-api.ts`, `hermes/admin/access.ts` |
| M5 | Provider loader seam | `hermes/services/providers/capability.ts`, `hermes/services/providers/index.ts` |
| M6 | Validation (typecheck, tests, secret scan, boundary checks) | See VALIDATION_REPORT.md |
| M7 | Docs | `VALIDATION_REPORT.md` (this pair), `ROADMAP.md` |

---

## Authoritative contracts established

### Agent lifecycle (M2)
- **Two orthogonal axes**, never conflated:
  - *Lifecycle state*: `registered → assigned → approved → active → (paused | suspended) → retired`
  - *Activation*: `disabled | enabled` (explicit, authorized out-of-band)
- Canonical transition table in `shared/contracts/lifecycle.ts` is the single
  gate for all lifecycle moves (`setState` rejects illegal transitions).
- `canAgentAct(agent)` is the authoritative execution gate: requires
  `activation === "enabled" && state === "active"`.
- `suspended` added as a valid hold state (reached only from `active`/`paused`;
  blocked from executing by `canAgentAct`).

### Audit persistence (M3)
- Single canonical `AuditEvent` type in `shared/interfaces/audit.ts`.
- Provider-neutral `AuditStore` interface (append / query / clear); default
  `MemoryAuditStore` is append-only and non-blocking.
- `hermes/audit/event.ts` `emitAudit()` now routes through `defaultAuditStore`
  (the real boundary); an optional `setAuditSink` remains for D1 forwarding.
- Swappable for D1 behind the same interface (ADR-007) without touching callers.

### Tenant boundary (M4)
- `Principal` (in `platform-api.ts`) carries `organizationId`, `tenantId`, and
  `scopes: AccessScope[]`.
- `withinTenantScope(principal, target, opts)` in `hermes/admin/access.ts` is the
  single enforcement point: hard cross-org wall; scope-narrowed grants; unbound
  principals denied for protected resources.

### Provider seam (M5)
- `ProviderManifest` (declarative data) → `ProviderLoader` (the ONLY place vendor
  code enters, via an `implKey` → factory map) → `CapabilityRegistry` (single
  source of truth for "what can run here").
- Decoupled from the low-level `ProviderBundle` adapter service in
  `hermes/services/providers/index.ts`; re-exported from the same barrel.

---

## Validation summary (full detail in VALIDATION_REPORT.md)

- **Typecheck:** `pnpm run typecheck` → EXIT 0
- **Tests:** 375/375 pass (26 files)
- **Secret scan:** clean (no leaked credentials)
- **Boundary checks:** tenant isolation, agent-safety transition rejection,
  audit persistence, capability registry — all verified independently

---

## Commit plan (isolated, reversible)

Each milestone maps to one logical commit, staging only its own files and
verifying per commit:

1. `M1: fix Hermes platform type errors; quarantine legacy api-server`
   - `hermes/admin/ui-contracts.ts`, `hermes/admin/console/app.ts`,
     `hermes/services/discovery/discovery.ts`, `artifacts/api-server/package.json`
2. `M2: harden agent lifecycle contract (state table, suspended, audit-safe register)`
   - `shared/contracts/lifecycle.ts`, `shared/contracts/resource.ts`, `hermes/agents/registry.ts`
3. `M3: add audit persistence boundary (AuditEvent + AuditStore + Memory impl)`
   - `shared/interfaces/audit.ts`, `hermes/audit/event.ts`, `hermes/audit/store.ts`
4. `M4: declare tenant/org boundary on Principal + withinTenantScope guard`
   - `hermes/contracts/platform-api.ts`, `hermes/admin/access.ts`
5. `M5: add provider loader seam (Manifest -> Loader -> CapabilityRegistry)`
   - `hermes/services/providers/capability.ts`, `hermes/services/providers/index.ts`
6. `M7: docs — validation/completion reports + ROADMAP update`
   - `VALIDATION_REPORT.md`, `COMPLETION_REPORT.md`, `ROADMAP.md`

(M6 validation is not a commit — it is the evidence these commits are sound.)

---

## Constraints honored

- No modifications to unrelated legacy AGS prototype code.
- No types weakened to silence errors.
- `artifacts/api-server` quarantined via documented typecheck override only
  (no logic change).
- No Cloudflare/D1 changes; no secrets accessed.
- All commits are isolated and reversible (staged-file verification per commit).
