# TECHNICAL DEBT INVENTORY

**Document type:** Prioritized debt inventory (Phase 3 of EPIC-003-006 closeout)
**Date:** 2026-07-20
**Rule:** Inventory only. Nothing in this document is to be fixed in this cycle.

Categories:
- **A — V1 blockers** (must resolve before claiming Hermes V1 production-ready)
- **B — Important but safe to defer** (fix in V1.x; does not block operation)
- **C — V2 items** (architectural evolution, not urgent)

---

## Category A — V1 Blockers

### A1. In-memory durability (audit, agent, workflow, capability)
- All runtime state lives in process-local Maps/`MemoryAuditStore`/`MemoryCapabilityRegistry`.
- Lost on every deploy / worker isolate restart.
- **Impact:** audit trail and in-flight workflows vanish; no cross-deploy continuity.
- **Fix path:** D1-backed implementations behind the existing `AuditStore`,
  `CapabilityRegistry`, and agent/workflow registry interfaces (interfaces already
  designed for this — ADR-007).

### A2. Tenant boundary declared but not enforced
- `withinTenantScope()` exists and is correct, but **no API mutator calls it**.
- **Impact:** cross-tenant isolation is a library, not a guarantee.
- **Fix path:** insert the guard into registry/lifecycle/agent mutators; force
  `requireScope: true` on tenant-protected resources.

### A3. Capability registry empty at runtime
- `defaultCapabilityRegistry` is never populated at startup; no manifest bootstrap.
- **Impact:** "what can run here" is unknown to the running system.
- **Fix path:** startup bootstrap that loads provider manifests (incl. Cloudflare
  `ProviderBundle`) into the registry.

### A4. Activation authorization is advisory only
- `activateAgent()` doc forbids auto-activation but nothing enforces it.
- **Impact:** an agent could be activated without an authorized operator flow.
- **Fix path:** gate `activateAgent` behind an authorized `Principal`.

### A5. Authorizer is a stub
- `platform-api.ts` defines `Authorizer` type but no implementation; permission
  checks use raw `principal.permissions.includes(...)` in `access.ts`.
- **Impact:** no central authorization decision point; permission strings
  uncoupled from `PLATFORM_PERMISSIONS`.
- **Fix path:** implement `Authorizer`; route all checks through it.

---

## Category B — Important but Safe to Defer

### B1. Full-repo typecheck debt (suppressed)
- `artifacts/api-server`: **6** `error TS` suppressed via quarantine override
  (legacy AGS prototype, not platform code — acceptable to defer, but tracked).
- **Action:** keep quarantined; do NOT weaken types; schedule a real port or
  formal archival of api-server.

### B2. Test-file type errors (37 total, source clean)
Breakdown (from `tsc --noEmit` on workers):
- `tests/auth/*`: 16 errors
- `tests/integration/*`: 10 errors
- `tests/globalSetup.ts`: 4 errors
- `tests/hermes.services.smoke.test.ts`: 3
- `tests/hermes.tools.phase3-4.test.ts`: 2
- `tests/hermes.isolation.phase8.test.ts`: 1
- `tests/console.render.boundary.test.ts`: 1

- **Why safe:** vitest uses esbuild (no type checking), so all 375 tests pass at
  runtime; these are type-only errors that don't affect execution.
- **Why important:** masks real type drift; blocks a strict `tsc` CI gate on tests.
- **Fix path:** add `// @ts-expect-error` with reasons, or tighten test typings.
  Non-blocking for V1 operation.

### B3. Dual AuditEvent types
- Canonical (`shared/interfaces/audit.ts`, uses `meta`) and legacy-compatible
  (`hermes/audit/event.ts`, uses `detail`) coexist; adaptation is clean but duplicated.
- **Fix path:** migrate callers to canonical `meta`; deprecate the legacy shape.

### B4. Unused rich audit fields
- `emitAudit()` never sets `category` or `decision`; the canonical fields are unused
  at emission.
- **Fix path:** populate `category`/`decision` in call sites (enables retention +
  auth reporting).

### B5. Unrelated working-tree changes not yet committed
- 5 files modified outside EPIC-003-006 remain in the tree:
  `hermes/admin/console/bff-client.ts`, `hermes/admin/console/session.ts`,
  `hermes/services/execution/index.ts`, `hermes/services/index.ts`,
  `workers/tests/globalSetup.ts`.
- **Action:** these are NOT part of this epic and were intentionally excluded from
  commits. They should be reviewed and committed under their own epic/change, not
  absorbed here. (See PHASE 1 note.)

### B6. `Capability.impl` typed `unknown`
- No typed capability interface for callers to consume safely.
- **Fix path:** introduce a `CapabilityHandler` interface; narrow `impl`.

### B7. Scope `env` qualifier never checked
- `AccessScope.env` declared but `withinTenantScope` ignores it.
- **Fix path:** enforce env match when `opts` requests it.

---

## Category C — V2 Items

### C1. MCP / remote provider adapter
- Provider seam is MCP-shaped but no remote/MCP loader exists.
- **V2:** add a loader resolving `implKey` → remote MCP client; capability registry
  answers "can I run X remotely?".

### C2. Principal factory + identity issuance
- No canonical way to mint/verify a `Principal`; `id` prefixes string-matched.
- **V2:** identity service that issues signed principals; typed `Principal` source.

### C3. Per-agent capability scoping
- Agents are not first-class Principals; no per-agent `scopes`.
- **V2:** model agents as Principals with scopes; audit agent actions under agent id.

### C4. Multi-isolate audit coalescing
- Edge workers run multiple isolates; in-memory audit is per-isolate.
- **V2:** D1 (or durable log) as the cross-isolate source of truth.

### C5. Approval workflow persistence
- Human approval gate is env-driven, in-memory; no durable approval record.
- **V2:** persist approvals (who/what/when) for audit + replay.

### C6. Provider health → capability availability
- EPIC-003-004 has provider-health; not yet wired to capability registry
  availability (`registry.has` should reflect health).
- **V2:** capability availability = manifest loaded AND provider healthy.

---

## Debt Summary Table

| ID | Category | Area | Effort | Blocks V1? |
|----|----------|------|--------|------------|
| A1 | A | Durability | L | YES |
| A2 | A | Tenant enforcement | S | YES |
| A3 | A | Capability bootstrap | M | YES |
| A4 | A | Activation authz | S | YES |
| A5 | A | Authorizer impl | M | YES |
| B1 | B | api-server types (quarantined) | M | no (tracked) |
| B2 | B | 37 test-file type errors | M | no |
| B3 | B | Dual AuditEvent | S | no |
| B4 | B | Unused audit fields | S | no |
| B5 | B | Unrelated WT changes | S | no (separate) |
| B6 | B | Capability.impl unknown | S | no |
| B7 | B | Scope env unchecked | S | no |
| C1 | C | MCP adapter | L | V2 |
| C2 | C | Principal factory | M | V2 |
| C3 | C | Agent Principals | M | V2 |
| C4 | C | Cross-isolate audit | M | V2 |
| C5 | C | Approval persistence | M | V2 |
| C6 | C | Health→capability | M | V2 |

**A-items = the EPIC-004 must-fix list. B-items = V1.x hardening. C-items = V2 evolution.**
